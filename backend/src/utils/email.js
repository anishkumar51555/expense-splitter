const nodemailer = require("nodemailer");

/**
 * Mail delivery over SMTP.
 *
 * Set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS and mail goes out for real.
 * With no credentials configured we fall back to logging the link, so signup and
 * password reset stay usable in local development and in tests.
 */

let cachedTransport;

const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransport = () => {
  if (cachedTransport) return cachedTransport;

  const port = Number(process.env.SMTP_PORT || 587);

  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 is implicit TLS; 587 upgrades via STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransport;
};

const appUrl = () => (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");

const sendMail = async ({ to, subject, html, text }) => {
  if (!smtpConfigured()) {
    // No SMTP set up — surface the link instead of silently dropping it.
    console.log(`\n📧 [email not sent — SMTP not configured]\n   To: ${to}\n   Subject: ${subject}\n   ${text}\n`);
    return { delivered: false, reason: "smtp-not-configured" };
  }

  try {
    const info = await getTransport().sendMail({
      from: process.env.MAIL_FROM || `"Expense Splitter" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    return { delivered: true, messageId: info.messageId };
  } catch (err) {
    // A mail outage must not take down signup — the user can ask for a resend.
    console.error("EMAIL SEND ERROR:", err.message);
    return { delivered: false, reason: err.message };
  }
};

const layout = (heading, body, button) => `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0f0f12;padding:32px">
    <div style="max-width:520px;margin:0 auto;background:#1a1a20;border:1px solid #2c2c36;border-radius:20px;padding:32px;color:#e8e8ef">
      <div style="font-size:34px;margin-bottom:12px">💸</div>
      <h1 style="margin:0 0 12px;font-size:22px;color:#fff">${heading}</h1>
      <div style="font-size:15px;line-height:1.6;color:#b9b9c6">${body}</div>
      ${button}
      <p style="margin-top:28px;font-size:12px;color:#6f6f7d">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  </div>`;

const cta = (url, label) => `
  <a href="${url}" style="display:inline-block;margin-top:24px;background:#8b5cf6;color:#fff;text-decoration:none;padding:13px 26px;border-radius:12px;font-weight:700">${label}</a>
  <p style="margin-top:20px;font-size:12px;color:#6f6f7d;word-break:break-all">Or paste this link into your browser:<br>${url}</p>`;

const sendVerificationEmail = async (user, rawToken) => {
  const url = `${appUrl()}/verify-email?token=${rawToken}`;

  return sendMail({
    to: user.email,
    subject: "Verify your email address",
    text: `Hi ${user.name}, confirm your email address to activate your account: ${url} (this link expires in 24 hours)`,
    html: layout(
      `Welcome, ${user.name}!`,
      "Confirm your email address to activate your Expense Splitter account. This link expires in 24 hours.",
      cta(url, "Verify email")
    ),
  });
};

const sendPasswordResetEmail = async (user, rawToken) => {
  const url = `${appUrl()}/reset-password?token=${rawToken}`;

  return sendMail({
    to: user.email,
    subject: "Reset your password",
    text: `Hi ${user.name}, reset your password here: ${url} (this link expires in 60 minutes and can be used once)`,
    html: layout(
      "Reset your password",
      "Click below to choose a new password. This link expires in 60 minutes and can only be used once.",
      cta(url, "Reset password")
    ),
  });
};

module.exports = {
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  smtpConfigured,
  appUrl,
};
