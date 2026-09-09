// ─── Email providers (REST APIs) ──────────────────────────────────────────────
// Emails are sent through the Resend REST API and/or the Brevo REST API using
// plain fetch() — no SDK required.
//   Resend : POST https://api.resend.com/emails        (Header: Authorization: Bearer)
//   Brevo  : POST https://api.brevo.com/v3/smtp/email  (Header: api-key)
// Resend is tried first, then Brevo as fallback. Configure at least one of
// RESEND_API_KEY / BREVO_API_KEY in .env.

const fs = require('node:fs');
const path = require('node:path');

// NOTE: never hardcode a real/personal email as the fallback here — it leaks
// personal information into source code/repos. The sender must come from the
// operator's .env (EMAIL_FROM). If it's unset we fall back to a clearly
// neutral placeholder; production deployments should always set EMAIL_FROM.
const FROM = process.env.EMAIL_FROM || 'RideShare <no-reply@rideshares.local>';

// Inline the source logo so email clients do not need to fetch a remote URL.
const logoPath = path.resolve(__dirname, '../../../frontend/public/logo.png');
const LOGO_DATA_URI = fs.existsSync(logoPath)
  ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
  : null;

// Support/admin address shown in the frontend footer — used for domain
// request notifications. Override with ADMIN_EMAIL / HEALTH_ALERT_EMAIL.
const SUPPORT_EMAIL = (process.env.ADMIN_EMAIL || process.env.HEALTH_ALERT_EMAIL || '')
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean);

// Shared branded email header (logo + wordmark). Falls back to text-only if
// the source asset is unavailable in the deployment.
const brandHeader = (tagline) => `
  <div class="header">
    ${LOGO_DATA_URI ? `<img src="${LOGO_DATA_URI}" alt="RideShare logo" width="64" height="64" style="border-radius:50%;margin-bottom:8px;object-fit:cover" />` : ''}
    <h1>RideShare</h1>
    <p>${tagline}</p>
  </div>`;

const brandFooter = `<div class="footer">RideShare &nbsp;|&nbsp; Share rides. Split costs. Travel together.</div>`;

const parseFrom = (from) => {
  const match = from.match(/^(.*?)\s*<(.+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: 'RideShare', email: from };
};

// Send via the Resend REST API (https://resend.com/docs/api-reference/emails/send-email)
const sendViaResend = async (from, recipients, subject, html) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: recipients, subject, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `Resend error ${res.status}`);
  return { success: true, provider: 'resend', id: data?.id };
};

// Send via the Brevo REST API (https://developers.brevo.com/docs/get-started)
const sendViaBrevo = async (recipients, subject, html) => {
  const sender = parseFrom(FROM);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: recipients.map((email) => ({ email })),
      subject,
      htmlContent: html,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `Brevo API error ${res.status}`);
  return { success: true, provider: 'brevo-api', id: data?.messageId };
};

// ─── Core send function (Resend → Brevo fallback) ─────────────────────────────
const sendEmail = async ({ to, subject, html }) => {
  const recipients = Array.isArray(to) ? to : [to];

  const providers = [];
  if (process.env.RESEND_API_KEY) {
    providers.push(['Resend', () => sendViaResend(FROM, recipients, subject, html)]);
  }
  if (process.env.BREVO_API_KEY) {
    providers.push(['Brevo', () => sendViaBrevo(recipients, subject, html)]);
  }

  if (providers.length === 0) {
    console.error('❌ No email provider configured. Set RESEND_API_KEY and/or BREVO_API_KEY in .env');
    return { success: false, error: 'No email provider configured (set RESEND_API_KEY or BREVO_API_KEY)' };
  }

  let lastError = null;
  for (const [name, send] of providers) {
    try {
      const result = await send();
      console.log(`✅ [${name}] Email sent to ${recipients.join(', ')}:`, result.id);
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`⚠️  ${name} failed: ${err.message}`);
    }
  }

  console.error('❌ All email providers failed:', lastError?.message);
  return { success: false, error: lastError?.message };
};


// ─── HTML Templates ────────────────────────────────────────────────────────────
/**
 * HTML-escape user-controlled data before interpolating it into email
 * templates below. `name`, `identifier`, `from`, `to` etc. are all
 * user-supplied at registration/ride-creation time and are sent, unescaped,
 * inside emails to OTHER users — without this, a user could register with a
 * name like `<a href="https://evil.example">RideShare Support</a>` and have
 * it rendered as a live, styled link inside a legitimate-looking RideShare
 * email sent to someone else (a phishing vector).
 */
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const baseStyle = `
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px}
    .wrapper{max-width:520px;margin:0 auto}
    .card{background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
    .header{background:linear-gradient(135deg,#f97316,#ea580c);padding:28px 32px;text-align:center}
    .header h1{color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px}
    .header p{color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px}
    .body{padding:32px}
    .body h2{font-size:18px;color:#1e293b;margin-bottom:8px}
    .body p{font-size:14px;color:#475569;line-height:1.6;margin-bottom:12px}
    .otp-box{background:#fff7ed;border:2px dashed #f97316;border-radius:12px;text-align:center;padding:24px;margin:20px 0}
    .otp-code{font-size:40px;font-weight:800;color:#ea580c;letter-spacing:12px;font-family:monospace}
    .otp-note{font-size:12px;color:#94a3b8;margin-top:8px}
    .ride-card{background:#f8fafc;border-left:4px solid #f97316;border-radius:8px;padding:16px;margin:16px 0}
    .ride-card p{font-size:13px;color:#334155;margin-bottom:6px}
    .ride-card p:last-child{margin-bottom:0}
    .badge{display:inline-block;padding:4px 12px;border-radius:99px;font-size:13px;font-weight:600}
    .badge-green{background:#dcfce7;color:#15803d}
    .badge-red{background:#fee2e2;color:#b91c1c}
    .btn{display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;margin-top:16px}
    .footer{background:#f1f5f9;padding:16px 32px;text-align:center;font-size:11px;color:#94a3b8}
    .divider{height:1px;background:#e2e8f0;margin:16px 0}
  </style>
`;

const otpTemplate = (name, otp, purpose = 'email verification') => {
  const safeName = escapeHtml(name);
  const safePurpose = escapeHtml(purpose);
  const safeOtp = escapeHtml(otp); // OTP is server-generated digits, but escape defensively regardless
  return {
    subject: '🔐 Your RideShare Verification Code',
    html   : `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyle}</head><body>
    <div class="wrapper">
      <div class="card">
        ${brandHeader('Ride-Sharing & Carpooling Platform')}
        <div class="body">
          <h2>Hello, ${safeName}! 👋</h2>
          <p>Use the OTP below for <strong>${safePurpose}</strong>. It expires in <strong>5 minutes</strong>.</p>
          <div class="otp-box">
            <div class="otp-code">${safeOtp}</div>
            <p class="otp-note">⏱ Valid for 5 minutes · Do not share this code</p>
          </div>
          <div class="divider"></div>
          <p style="font-size:12px;color:#94a3b8">If you didn't request this OTP, please ignore this email. Your account is safe.</p>
        </div>
        ${brandFooter}
      </div>
    </div>
  </body></html>`,
  };
};

const rideRequestTemplate = (creatorName, requesterName, requesterIdentifier, ride) => {
  const safeCreatorName   = escapeHtml(creatorName);
  const safeRequesterName = escapeHtml(requesterName);
  const safeIdentifier    = escapeHtml(requesterIdentifier);
  const safeFrom          = escapeHtml(ride.from);
  const safeTo            = escapeHtml(ride.to);
  const safeVehicleType   = escapeHtml(ride.vehicleType);
  return {
    subject: `🚗 New Ride Request from ${safeRequesterName} (${safeIdentifier})`,
    html   : `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyle}</head><body>
    <div class="wrapper">
      <div class="card">
        ${brandHeader('You have a new ride request!')}
        <div class="body">
          <h2>Hi ${safeCreatorName},</h2>
          <p><strong>${safeRequesterName}</strong> (${safeIdentifier}) wants to join your ride.</p>
          <div class="ride-card">
            <p>📍 <strong>From:</strong> ${safeFrom}</p>
            <p>🏁 <strong>To:</strong> ${safeTo}</p>
            <p>📅 <strong>Date:</strong> ${new Date(ride.date).toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
            <p>⏰ <strong>Time:</strong> ${escapeHtml(ride.time)}</p>
            <p>🚙 <strong>Vehicle:</strong> ${safeVehicleType}</p>
            <p>💺 <strong>Seats Available:</strong> ${Number(ride.availableSeats) || 0}</p>
          </div>
          <p>Log in to RideShare to <strong>accept</strong> or <strong>reject</strong> this request.</p>
        </div>
        ${brandFooter}
      </div>
    </div>
  </body></html>`,
  };
};

const requestStatusTemplate = (requesterName, status, ride, creatorName) => {
  const accepted = status === 'ACCEPTED';
  const safeRequesterName = escapeHtml(requesterName);
  const safeCreatorName   = escapeHtml(creatorName);
  const safeFrom          = escapeHtml(ride.from);
  const safeTo            = escapeHtml(ride.to);
  return {
    subject: `${accepted ? '✅ Ride Request Accepted!' : '❌ Ride Request Rejected'} — RideShare`,
    html   : `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyle}</head><body>
      <div class="wrapper">
        <div class="card">
          ${brandHeader('Request Update')}
          <div class="body">
            <h2>Hi ${safeRequesterName},</h2>
            <p>Your ride request has been
              <span class="badge ${accepted ? 'badge-green' : 'badge-red'}">
                ${accepted ? '✅ ACCEPTED' : '❌ REJECTED'}
              </span>
              by <strong>${safeCreatorName}</strong>.
            </p>
            <div class="ride-card">
              <p>📍 <strong>From:</strong> ${safeFrom}</p>
              <p>🏁 <strong>To:</strong> ${safeTo}</p>
              <p>📅 <strong>Date:</strong> ${new Date(ride.date).toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
              <p>⏰ <strong>Time:</strong> ${escapeHtml(ride.time)}</p>
            </div>
            ${accepted
              ? '<p>🎉 Great news! You can now <strong>chat</strong> with the ride creator and optionally share phone numbers. Log in to RideShare!</p>'
              : '<p>Don\'t worry — there are more rides available. Log in to search for other options.</p>'
            }
          </div>
          ${brandFooter}
        </div>
      </div>
    </body></html>`,
  };
};

/**
 * Notify the site admin that a user tried to sign up with an unregistered
 * organization domain, so they can review and activate it.
 */
const domainRequestTemplate = (domain, requesterEmail) => {
  const safeDomain   = escapeHtml(domain);
  const safeRequester = escapeHtml(requesterEmail);
  return {
    subject: `🌐 New organization domain request: ${safeDomain}`,
    html   : `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyle}</head><body>
      <div class="wrapper">
        <div class="card">
          ${brandHeader('New Domain Request')}
          <div class="body">
            <h2>Action needed: review domain request</h2>
            <p>A user tried to sign up with an organization email domain that isn't registered yet.</p>
            <div class="ride-card">
              <p>🌐 <strong>Domain:</strong> ${safeDomain}</p>
              <p>📧 <strong>Requested by:</strong> ${safeRequester}</p>
            </div>
            <p>A <strong>PENDING</strong> record has been created in the Domains table. Once you verify it's a genuine organization, mark it <strong>ACTIVE</strong> in the admin panel (Domains section) to allow signups from that domain.</p>
          </div>
          ${brandFooter}
        </div>
      </div>
    </body></html>`,
  };
};

// ─── Public email helpers ──────────────────────────────────────────────────────
const sendOTPEmail = (email, name, otp, purpose) =>
  sendEmail({ to: email, ...otpTemplate(name, otp, purpose) });

const sendRideRequestEmail = (creatorEmail, creatorName, requesterName, requesterIdentifier, ride) =>
  sendEmail({ to: creatorEmail, ...rideRequestTemplate(creatorName, requesterName, requesterIdentifier, ride) });

const sendRequestStatusEmail = (requesterEmail, requesterName, status, ride, creatorName) =>
  sendEmail({ to: requesterEmail, ...requestStatusTemplate(requesterName, status, ride, creatorName) });

const sendDomainRequestEmail = (domain, requesterEmail) => {
  if (!SUPPORT_EMAIL) {
    console.warn('⚠️  No ADMIN_EMAIL/HEALTH_ALERT_EMAIL configured — domain request email skipped.');
    return Promise.resolve({ success: false, error: 'No admin email configured' });
  }
  return sendEmail({ to: SUPPORT_EMAIL, ...domainRequestTemplate(domain, requesterEmail) });
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendRideRequestEmail,
  sendRequestStatusEmail,
  sendDomainRequestEmail,
};
