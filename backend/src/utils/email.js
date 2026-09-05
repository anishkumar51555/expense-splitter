const nodemailer = require("nodemailer");

/**
 * Mail delivery, over an HTTPS provider API where one is configured and SMTP
 * otherwise.
 *
 * Many hosts (Render's free instances among them) block outbound SMTP ports to
 * curb spam, which makes port 587 hang until it times out. Set BREVO_API_KEY or
 * RESEND_API_KEY and delivery goes over HTTPS instead, which those hosts allow.
 * SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS still work wherever SMTP is
 * reachable, such as local development.
 *
 * With nothing configured we fall back to logging the link, so signup and
 * password reset stay usable in development and in tests.
 */

let cachedTransport;

const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

// An HTTPS provider is preferred: it works on hosts that block SMTP.
const httpProvider = () => {
  if (process.env.BREVO_API_KEY) return "brevo";
  if (process.env.RESEND_API_KEY) return "resend";
  return null;
};

const emailConfigured = () => Boolean(httpProvider()) || smtpConfigured();

const activeTransport = () => httpProvider() || (smtpConfigured() ? "smtp" : null);

// MAIL_FROM may be `Name <addr>`, `"Name" <addr>` or a bare address. Dashboards
// keep the quotes that a .env file would strip, so tolerate them.
const parseFrom = () => {
  const raw = (process.env.MAIL_FROM || "").trim();
  const fallback = process.env.SMTP_USER || "";
  const match = raw.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim() || "Expense Splitter", email: match[2].trim() };
  const bare = raw.replace(/^"|"$/g, "").trim();
  return { name: "Expense Splitter", email: bare || fallback };
};

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
    // Without these a blocked port hangs the request for two minutes.
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  return cachedTransport;
};

const postJson = async (url, headers, body) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${raw.slice(0, 300)}`);
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const sendViaBrevo = async ({ to, subject, html, text }) => {
  const from = parseFrom();
  const out = await postJson(
    "https://api.brevo.com/v3/smtp/email",
    { "api-key": process.env.BREVO_API_KEY, accept: "application/json" },
    { sender: from, to: [{ email: to }], subject, htmlContent: html, textContent: text }
  );
  return out.messageId || "brevo-accepted";
};

const sendViaResend = async ({ to, subject, html, text }) => {
  const from = parseFrom();
  const out = await postJson(
    "https://api.resend.com/emails",
    { authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    { from: `${from.name} <${from.email}>`, to: [to], subject, html, text }
  );
  return out.id || "resend-accepted";
};

const appUrl = () => (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");

const sendMail = async ({ to, subject, html, text }) => {
  const transport = activeTransport();

  if (!transport) {
    // Nothing configured — surface the link instead of silently dropping it.
    console.log(`\n📧 [email not sent — no mail transport configured]\n   To: ${to}\n   Subject: ${subject}\n   ${text}\n`);
    return { delivered: false, reason: "email-not-configured" };
  }

  try {
    if (transport === "brevo") {
      return { delivered: true, messageId: await sendViaBrevo({ to, subject, html, text }) };
    }
    if (transport === "resend") {
      return { delivered: true, messageId: await sendViaResend({ to, subject, html, text }) };
    }

    const from = parseFrom();
    const info = await getTransport().sendMail({
      from: `"${from.name}" <${from.email}>`,
      to,
      subject,
      text,
      html,
    });
    return { delivered: true, messageId: info.messageId };
  } catch (err) {
    // A mail outage must not take down signup — the user can ask for a resend.
    console.error(`EMAIL SEND ERROR (${transport}):`, err.message);
    // The link would otherwise be lost entirely when delivery fails.
    console.log(`\n📧 [delivery failed — link below]\n   To: ${to}\n   ${text}\n`);
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
  emailConfigured,
  activeTransport,
  appUrl,
};
