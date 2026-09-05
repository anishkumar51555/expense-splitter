/**
 * Check the live integrations, which the test suite deliberately never touches.
 *
 *   node scripts/checkConfig.js                  # check everything
 *   node scripts/checkConfig.js you@example.com  # also send a real test email
 *
 * Verifies the database connects, SMTP accepts your credentials, and the
 * Razorpay keys are accepted by the gateway.
 */

require("dotenv").config();

const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const Razorpay = require("razorpay");

const { smtpConfigured, activeTransport, sendMail } = require("../src/utils/email");

const pass = (m) => console.log(`  ✅ ${m}`);
const warn = (m) => console.log(`  ⚠️  ${m}`);
const fail = (m) => {
  console.log(`  ❌ ${m}`);
  process.exitCode = 1;
};

const checkDatabase = async () => {
  console.log("\nDatabase");

  if (!process.env.MONGO_URI) return fail("MONGO_URI is not set");

  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    const { host, name } = mongoose.connection;
    pass(`connected to ${host}/${name}`);

    const users = await mongoose.connection.db.collection("users").countDocuments();
    const unverified = await mongoose.connection.db
      .collection("users")
      .countDocuments({ $or: [{ isVerified: { $exists: false } }, { isVerified: false }] });

    pass(`${users} user record(s) stored`);
    if (unverified > 0) {
      warn(
        `${unverified} account(s) are unverified and cannot log in. ` +
          `If these predate email verification, run: npm run migrate:verify-existing`
      );
    }

    await mongoose.disconnect();
  } catch (err) {
    fail(`could not connect: ${err.message}`);
  }
};

const checkSecrets = () => {
  console.log("\nAuth");

  const secret = process.env.JWT_SECRET;
  if (!secret) return fail("JWT_SECRET is not set — the server will refuse to start");
  if (secret.length < 32) {
    warn(`JWT_SECRET is only ${secret.length} characters; 32+ is recommended`);
  } else {
    pass("JWT_SECRET looks strong enough");
  }

  if (process.env.APP_URL) pass(`APP_URL is ${process.env.APP_URL}`);
  else warn("APP_URL is not set — emailed links will point at http://localhost:5173");
};

const checkEmail = async (recipient) => {
  const transport = activeTransport();
  console.log(`\nEmail (${transport || "not configured"})`);

  if (!transport) {
    warn(
      "No mail transport is configured. Signup and password reset still work, " +
        "but links are printed to the server console instead of being emailed. " +
        "Set BREVO_API_KEY or RESEND_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS."
    );
    return;
  }

  if (transport === "smtp") {
    const port = Number(process.env.SMTP_PORT || 587);
    const smtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });

    try {
      await smtp.verify();
      pass(`${process.env.SMTP_HOST}:${port} accepted the credentials`);
    } catch (err) {
      fail(`SMTP rejected the connection: ${err.message}`);
      if (/timeout|ETIMEDOUT|ECONNREFUSED/i.test(err.message)) {
        warn(
          "That looks like a blocked port rather than bad credentials. Many hosts " +
            "(including Render's free instances) block outbound SMTP — use " +
            "BREVO_API_KEY or RESEND_API_KEY there instead."
        );
      }
      return;
    }
  }

  if (!recipient) {
    console.log("     (pass an email address to send a real test message)");
    return;
  }

  // Goes through the app's own sender, so this tests the real code path.
  const result = await sendMail({
    to: recipient,
    subject: "Expense Splitter — test email",
    text: "If you're reading this, outgoing email is working.",
    html: "<p>If you're reading this, outgoing email is working.</p>",
  });

  if (result.delivered) pass(`test email sent to ${recipient} (${result.messageId})`);
  else fail(`could not send via ${transport}: ${result.reason}`);
};

const checkPayments = async () => {
  console.log("\nPayments (Razorpay)");

  const { RAZORPAY_KEY_ID: id, RAZORPAY_KEY_SECRET: secret } = process.env;

  if (!id || !secret) {
    warn(
      "Razorpay keys are not set. Members will settle using UPI details plus " +
        '"Mark as Paid" instead of online checkout.'
    );
    return;
  }

  if (id.startsWith("rzp_test_")) pass("using TEST keys — no real money will move");
  else if (id.startsWith("rzp_live_")) warn("using LIVE keys — real payments will be charged");

  try {
    // A ₹1 order is the cheapest way to prove the keys are accepted.
    const client = new Razorpay({ key_id: id, key_secret: secret });
    const order = await client.orders.create({
      amount: 100,
      currency: "INR",
      receipt: `config_check_${Date.now()}`.slice(0, 40),
    });
    pass(`gateway accepted the keys (test order ${order.id})`);
  } catch (err) {
    const detail = err?.error?.description || err.message || String(err);
    return fail(`gateway rejected the keys: ${detail}`);
  }

  if (process.env.RAZORPAY_WEBHOOK_SECRET) {
    pass("webhook secret is set");
  } else {
    warn(
      "RAZORPAY_WEBHOOK_SECRET is not set. Payments still verify through the " +
        "browser callback; the webhook is a backup for when the browser drops out."
    );
  }
};

const run = async () => {
  const recipient = process.argv[2];

  console.log("Checking Expense Splitter configuration…");

  checkSecrets();
  await checkDatabase();
  await checkEmail(recipient);
  await checkPayments();

  console.log(
    process.exitCode === 1
      ? "\nSome checks failed — see the ❌ lines above.\n"
      : "\nAll configured integrations are working.\n"
  );
};

run().catch(async (err) => {
  console.error("Config check crashed:", err);
  process.exitCode = 1;
  await mongoose.disconnect().catch(() => {});
});
