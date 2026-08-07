// const { Resend }    = require('resend');
// const nodemailer    = require('nodemailer');

// // const resend = new Resend(process.env.RESEND_API_KEY);
// const resend = process.env.RESEND_API_KEY
//   ? new Resend(process.env.RESEND_API_KEY)
//   : null;

// // const FROM   = process.env.EMAIL_FROM || 'RideShare NIT KKR <noreply@nitkkr.ac.in>';
// const FROM   = process.env.EMAIL_FROM || 'RideShare <onboarding@resend.dev>';

// // ─── Nodemailer fallback transport ────────────────────────────────────────────
// let _smtpTransport = null;
// const getSmtpTransport = () => {
//   if (!_smtpTransport) {
//     _smtpTransport = nodemailer.createTransport({
//       host  : process.env.SMTP_HOST || 'smtp.gmail.com',
//       port  : parseInt(process.env.SMTP_PORT, 10) || 587,
//       secure: false,
//       auth  : {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//       },
//     });
//   }
//   return _smtpTransport;
// };

// // ─── Core send function (Resend → Nodemailer fallback) ─────────────────────────
// const sendEmail = async ({ to, subject, html }) => {
//   const recipient = Array.isArray(to) ? to : [to];

//   // Try Resend first
//   if (resend) {
//     try {
//       // const result = await resend.emails.send({
//       //   from   : FROM,
//       //   to     : recipient,
//       //   subject,
//       //   html,
//       // });
//       // console.log(`📧 [Resend] Email sent to ${recipient.join(', ')}:`, result.id);
//       // return { success: true, provider: 'resend', id: result.id };

//       const { data, error } = await resend.emails.send({
//   from: FROM,
//   to: recipient,
//   subject,
//   html,
// });

// if (error) {
//   console.error('❌ [Resend] Error:', error);
//   throw new Error(error.message || 'Resend failed');
// }

// console.log(`✅ [Resend] Email sent to ${recipient.join(', ')}:`, data?.id);
// return { success: true, provider: 'resend', id: data?.id };

//     } catch (err) {
//       console.warn('⚠️  Resend failed, trying SMTP fallback:', err.message);
//     }
//   }

//   // Fallback to Nodemailer SMTP
//   if (process.env.SMTP_USER && process.env.SMTP_PASS) {
//     try {
//       const transport = getSmtpTransport();
//       const info      = await transport.sendMail({ from: FROM, to: recipient.join(', '), subject, html });
//       console.log(`📧 [SMTP] Email sent to ${recipient.join(', ')}:`, info.messageId);
//       return { success: true, provider: 'smtp', id: info.messageId };
//     } catch (err) {
//       console.error('❌ SMTP fallback also failed:', err.message);
//       return { success: false, error: err.message };
//     }
//   }

//   console.error('❌ No email provider configured (RESEND_API_KEY or SMTP_USER/PASS required)');
//   return { success: false, error: 'No email provider configured' };
// };

const nodemailer = require('nodemailer');

const FROM = process.env.EMAIL_FROM || 'RideShare <chapri3110@gmail.com>';

let _smtpTransport = null;

const getSmtpTransport = () => {
  if (!_smtpTransport) {
    _smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      requireTLS: true,
      family: 4,
      connectionTimeout: 60000,
      greetingTimeout: 60000,
      socketTimeout: 60000,

      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return _smtpTransport;
};

const parseFrom = (from) => {
  const match = from.match(/^(.*?)\s*<(.+)>$/);

  if (match) {
    return {
      name: match[1].trim(),
      email: match[2].trim(),
    };
  }

  return {
    name: 'RideShare',
    email: from,
  };
};

const sendEmail = async ({ to, subject, html }) => {
  const recipient = Array.isArray(to) ? to : [to];

  console.log('📨 Sending email to:', recipient);

  // Brevo HTTP API first
  if (process.env.BREVO_API_KEY) {
    try {
      console.log('🚀 Trying Brevo API...');

      const sender = parseFrom(FROM);

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender,
          to: recipient.map((email) => ({ email })),
          subject,
          htmlContent: html,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Brevo API email sent:', data.messageId);
        return {
          success: true,
          provider: 'brevo-api',
          id: data.messageId,
        };
      }

      console.error('❌ Brevo API failed:', data);
      console.log('⚠️  Falling back to SMTP...');
      // Fall through to SMTP fallback
    } catch (err) {
      console.error('❌ Brevo API error:', err.message);
    }
  } else {
    console.warn('⚠️ BREVO_API_KEY missing, trying SMTP fallback');
  }

  // SMTP fallback
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      console.log('📧 Trying SMTP fallback...');

      const transport = getSmtpTransport();

      const info = await transport.sendMail({
        from: FROM,
        to: recipient.join(', '),
        subject,
        html,
      });

      console.log('✅ SMTP email sent:', info.messageId);

      return {
        success: true,
        provider: 'smtp',
        id: info.messageId,
      };
    } catch (err) {
      console.error('❌ SMTP fallback also failed:', err.message);

      return {
        success: false,
        provider: 'smtp',
        error: err.message,
      };
    }
  }

  return {
    success: false,
    error: 'No email provider configured',
  };
};

module.exports = {
  sendEmail,
};


// ─── HTML Templates ────────────────────────────────────────────────────────────
/**
 * HTML-escape user-controlled data before interpolating it into email
 * templates below. `name`, `rollNo`, `from`, `to` etc. are all
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
        <div class="header">
          <h1>🚗 RideShare · NIT Kurukshetra</h1>
          <p>Campus Ride-Sharing Platform</p>
        </div>
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
        <div class="footer">RideShare © NIT Kurukshetra &nbsp;|&nbsp; Secure Ride Sharing for Students</div>
      </div>
    </div>
  </body></html>`,
  };
};

const rideRequestTemplate = (creatorName, requesterName, requesterRollNo, ride) => {
  const safeCreatorName   = escapeHtml(creatorName);
  const safeRequesterName = escapeHtml(requesterName);
  const safeRollNo        = escapeHtml(requesterRollNo);
  const safeFrom          = escapeHtml(ride.from);
  const safeTo            = escapeHtml(ride.to);
  const safeVehicleType   = escapeHtml(ride.vehicleType);
  return {
    subject: `🚗 New Ride Request from ${safeRequesterName} (${safeRollNo})`,
    html   : `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyle}</head><body>
    <div class="wrapper">
      <div class="card">
        <div class="header">
          <h1>🚗 RideShare · NIT Kurukshetra</h1>
          <p>You have a new ride request!</p>
        </div>
        <div class="body">
          <h2>Hi ${safeCreatorName},</h2>
          <p><strong>${safeRequesterName}</strong> (${safeRollNo}) wants to join your ride.</p>
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
        <div class="footer">RideShare © NIT Kurukshetra &nbsp;|&nbsp; Secure Ride Sharing for Students</div>
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
          <div class="header">
            <h1>🚗 RideShare · NIT Kurukshetra</h1>
            <p>Request Update</p>
          </div>
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
          <div class="footer">RideShare © NIT Kurukshetra &nbsp;|&nbsp; Secure Ride Sharing for Students</div>
        </div>
      </div>
    </body></html>`,
  };
};

// ─── Public email helpers ──────────────────────────────────────────────────────
const sendOTPEmail = (email, name, otp, purpose) =>
  sendEmail({ to: email, ...otpTemplate(name, otp, purpose) });

const sendRideRequestEmail = (creatorEmail, creatorName, requesterName, requesterRollNo, ride) =>
  sendEmail({ to: creatorEmail, ...rideRequestTemplate(creatorName, requesterName, requesterRollNo, ride) });

const sendRequestStatusEmail = (requesterEmail, requesterName, status, ride, creatorName) =>
  sendEmail({ to: requesterEmail, ...requestStatusTemplate(requesterName, status, ride, creatorName) });

module.exports = {
  sendOTPEmail,
  sendRideRequestEmail,
  sendRequestStatusEmail,
};
