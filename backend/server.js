require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./src/app");
const { smtpConfigured } = require("./src/utils/email");
const { gatewayConfigured } = require("./src/controllers/paymentController");

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set — refusing to start.");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected ✅");
    console.log(`Email: ${smtpConfigured() ? "SMTP configured ✅" : "not configured ⚠️  (links will be logged to this console)"}`);
    console.log(`Payments: ${gatewayConfigured() ? "Razorpay configured ✅" : "not configured ⚠️  (manual settle only)"}`);
    app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
  })
  .catch((err) => {
    console.error("DB Error:", err);
    process.exit(1);
  });
