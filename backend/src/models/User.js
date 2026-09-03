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
      select: false, // never ship the hash out by accident
    },

    // ── Email verification ──
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationTokenHash: { type: String, default: null, select: false },
    verificationExpires: { type: Date, default: null, select: false },

    // ── Password reset ──
    resetTokenHash: { type: String, default: null, select: false },
    resetExpires: { type: Date, default: null, select: false },

    // ── Payout details, shown to members who owe this user ──
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

// Reset and verification lookups hit these directly.
userSchema.index({ resetTokenHash: 1 });
userSchema.index({ verificationTokenHash: 1 });

module.exports = mongoose.model("User", userSchema);
