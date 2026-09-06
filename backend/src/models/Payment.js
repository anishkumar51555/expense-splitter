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

    // Settlement always happens outside the app now — cash, UPI or a bank
    // transfer — and is simply recorded here once both sides agree.
    method: {
      type: String,
      enum: ["manual"],
      default: "manual",
    },
    status: {
      type: String,
      enum: ["created", "captured", "failed"],
      default: "captured",
    },
  },
  { timestamps: true }
);

// One settlement row per expense/payer pair; recording it twice is a no-op
// rather than a duplicate.
paymentSchema.index({ expense: 1, paidBy: 1 }, { unique: true });

module.exports = mongoose.model("Payment", paymentSchema);
