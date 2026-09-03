const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    expense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expense",
      required: true,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paidTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },

    // "razorpay" once money moved through the gateway; "manual" when the two
    // settled outside the app (cash, direct UPI) and just recorded it here.
    method: {
      type: String,
      enum: ["manual", "razorpay"],
      default: "manual",
    },
    status: {
      type: String,
      enum: ["created", "captured", "failed"],
      default: "captured",
    },

    // ── Razorpay bookkeeping ──
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
  },
  { timestamps: true }
);

// A gateway payment must only ever be recorded once, however many times the
// verify call is retried.
//
// These are partial rather than sparse on purpose: a sparse index only skips
// documents where the field is *absent*, so every manual settlement — which
// stores an explicit null — would collide on the second one. Restricting the
// index to string values leaves manual settlements out of it entirely.
const onlyRealIds = (field) => ({
  unique: true,
  partialFilterExpression: { [field]: { $type: "string" } },
});

paymentSchema.index({ razorpayPaymentId: 1 }, onlyRealIds("razorpayPaymentId"));
paymentSchema.index({ razorpayOrderId: 1 }, onlyRealIds("razorpayOrderId"));

module.exports = mongoose.model("Payment", paymentSchema);
