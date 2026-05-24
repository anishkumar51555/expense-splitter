const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    payment: {
      upiId: { type: String, default: "" },
      qrCode: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    // tracks if user has completed payment setup after first login
    paymentSetup: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);