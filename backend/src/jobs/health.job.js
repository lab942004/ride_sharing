/**
 * JOB: Backend health check + email alerting
 *
 * Runs every 15 minutes (configurable via HEALTH_CRON) and performs a
 * self health inspection:
 *   1. Database ping — `SELECT 1` with a short timeout (catches a dead or
 *      unresponsive Postgres connection).
 *   2. Self HTTP check against our own /health endpoint (catches a hung
 *      request pipeline; /health itself also reports the DB status).
 *
 * If either check fails, an alert email is sent to the operator. The default
 * is the support address shown in the frontend footer (lab.942004@gmail.com)
 * — override it with HEALTH_ALERT_EMAIL in backend/.env.
 *
 * Alerting policy (avoids email floods during a long outage):
 *   - first failure                → immediate alert
 *   - every REMEMBER_EVERY_FAILURES (every ~1 h) → "still down" reminder
 *   - back to healthy              → recovery notification
 *
 * NOTE: this job runs INSIDE the backend process, so if the whole process is
 * down it obviously cannot run or email. It is designed for the common
 * failure modes (DB connectivity, degraded API, DB timeouts). For true
 * external uptime monitoring you'd additionally point a separate uptime
 * service (UptimeRobot, BetterStack…) at your /health endpoint.
 */
const cron   = require('node-cron');
const prisma = require('../config/db');
const { sendEmail } = require('../services/email.service');

const HEALTH_CRON            = process.env.HEALTH_CRON || '*/15 * * * *';
const HEALTH_ALERT_EMAIL     = process.env.HEALTH_ALERT_EMAIL || 'lab.942004@gmail.com'; // footer contact
const REMEMBER_EVERY_FAILURES = parseInt(process.env.HEALTH_REMINDER_EVERY, 10) || 4; // ~1 h @ 15-min checks
const CHECK_TIMEOUT_MS       = 6000;

let isDown               = false;
let consecutiveFailures  = 0;
let lastErrorTimestamp   = null;

/** Race a promise against a timer so a hung DB/HTTP call can't block the job. */
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)
    ),
  ]);

/**
 * Send a health alert/recovery email via the existing email service.
 */
const sendHealthAlert = async ({ alertType, subject, results, errorMsg }) => {

  const lines = [
    `🕐 Timestamp            : ${new Date().toISOString()}`,
    `🧪 Environment          : ${process.env.NODE_ENV || 'development'}`,
    `🗄️  Database             : ${results.db}`,
    `📡 HTTP /health          : ${results.http}`,
    `🔢 Consecutive failures  : ${consecutiveFailures}`,
    lastErrorTimestamp ? `📅 First failure at     : ${lastErrorTimestamp}` : null,
    errorMsg ? `\nError detail:\n${errorMsg}` : null,
  ].filter(Boolean);

  const accent = alertType === 'recover' ? '#10b981' : '#dc2626';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:Arial,sans-serif;background:#f8fafc;padding:24px}
    .card{max-width:560px;margin:0 auto;background:#fff;border-radius:14px;
      box-shadow:0 4px 24px rgba(0,0,0,.08);overflow:hidden}
    .head{background:${accent};color:#fff;padding:20px 26px;font-size:16px;font-weight:700}
    .body{padding:22px 26px;color:#1e293b;line-height:1.6;font-size:14px}
    pre{background:#f1f5f9;padding:12px;border-radius:8px;white-space:pre-wrap;font-size:12.5px}
    .foot{background:#f1f5f9;padding:12px 26px;font-size:12px;color:#64748b}
  </style></head><body><div class="card">
    <div class="head">${alertType === 'recover' ? '✅ RideShare backend recovered' : '🚨 RideShare backend health check failed'}</div>
    <div class="body"><pre>${lines.join('\n')}</pre></div>
    <div class="foot">RideShare — automated health alert</div>
  </div></body></html>`;

  const response = await sendEmail({ to: HEALTH_ALERT_EMAIL, subject, html });
  if (response?.success === false) {
    console.error('❌ [Health] Alert email failed:', response.error || 'no provider configured');
  }
  return response;
};

/**
 * Run one health check and email the operator only when the state actually
 * changes (healthy → down → healthy) plus periodic reminders while down.
 */
const checkBackendHealth = async () => {
  const results = { db: 'unknown', http: 'unknown' };
  let errorMsg  = null;

  // 1. Database ping
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS, 'Database ping');
    results.db = 'connected';
  } catch (err) {
    results.db = 'disconnected';
    errorMsg   = err.message;
  }

  // 2. Self HTTP /health (also reports DB status from the running server)
  const PORT = process.env.PORT || 5000;
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    const res        = await fetch(`http://127.0.0.1:${PORT}/health`, {
      signal : controller.signal,
      headers: { accept: 'application/json' },
    });
    clearTimeout(timer);

    const data = await res.json().catch(() => ({}));
    if (data && typeof data.database === 'string') results.db = data.database;
    results.http = res.status;

    if (!res.ok)                           errorMsg = errorMsg || `HTTP /health returned ${res.status}`;
    if (data?.database === 'disconnected') errorMsg = errorMsg || 'Database reported disconnected by /health';
  } catch (err) {
    results.http = 'unreachable';
    errorMsg     = errorMsg || err.message;
  }

  const healthy = results.db === 'connected';

  // ── Healthy ────────────────────────────────────────────────────────────────
  if (healthy) {
    consecutiveFailures = 0;
    if (isDown) {
      isDown              = false;
      lastErrorTimestamp  = null;
      await sendHealthAlert({
        alertType: 'recover',
        subject  : '✅ RideShare backend recovered',
        results,
        errorMsg : null,
      });
    }
    return { healthy, results };
  }

  // ── Unhealthy ──────────────────────────────────────────────────────────────
  consecutiveFailures  += 1;
  lastErrorTimestamp    = lastErrorTimestamp || new Date().toISOString();
  const isFirstFailure  = !isDown;
  isDown                = true;

  // Immediate alert on the first failure; thereafter a reminder every N checks.
  if (isFirstFailure || consecutiveFailures % REMEMBER_EVERY_FAILURES === 0) {
    await sendHealthAlert({
      alertType: 'fail',
      subject  : isFirstFailure
        ? '🚨 RideShare backend health check FAILED'
        : `🔄 RideShare backend is still down (${consecutiveFailures} consecutive checks)`,
      results,
      errorMsg,
    });
  }

  return { healthy, results };
};

/** Register the 15-minute health check job. Call once from server.js. */
const initHealthCheckJob = () => {
  if (process.env.DISABLE_HEALTH_JOB === 'true') {
    console.log('💤 [Health] Health check disabled via DISABLE_HEALTH_JOB=true');
    return;
  }

  cron.schedule(HEALTH_CRON, () => {
    checkBackendHealth().catch((err) =>
      console.error('❌ [Health] checkBackendHealth failed:', err.message)
    );
  }, { name: 'backend-health-check' });

  // One immediate preflight right after startup (delayed a few seconds so the
  // HTTP server is ready) so a broken DB is reported ASAP rather than waiting
  // for the first 15-minute tick.
  setTimeout(() => {
    checkBackendHealth().catch((err) =>
      console.error('❌ [Health] initial health check failed:', err.message)
    );
  }, 5000);

  console.log(`❤️  [Health] Health check scheduled: ${HEALTH_CRON} → alerts to ${HEALTH_ALERT_EMAIL}`);
};

module.exports = {
  initHealthCheckJob,
  checkBackendHealth,
};