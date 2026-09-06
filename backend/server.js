require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./src/app");
const { activeTransport } = require("./src/utils/email");

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set — refusing to start.");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected ✅");
    const transport = activeTransport();
    console.log(
      transport === "smtp"
        ? `Email: SMTP ✅ (${process.env.SMTP_HOST} as ${process.env.SMTP_USER}) — note that many hosts block outbound SMTP`
        : transport
          ? `Email: ${transport} HTTPS API ✅`
          : "Email: not configured ⚠️  (set BREVO_API_KEY or RESEND_API_KEY; links will be logged to this console)"
    );
    if (!process.env.APP_URL) {
      console.warn("APP_URL is not set ⚠️  — emailed links will point at http://localhost:5173");
    }
    app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
  })
  .catch((err) => {
    console.error("DB Error:", err);
    process.exit(1);
  });
