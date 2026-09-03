const mongoose = require("mongoose");
const { SPLIT_TYPES } = require("../utils/split");

const expenseSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    description: {
      type: String,
      default: "Expense",
    },

    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // How `participants[].share` was worked out. Kept so the UI can show the
    // original intent (and re-open the same editor) rather than guessing.
    splitType: {
      type: String,
      enum: SPLIT_TYPES,
      default: "equal",
    },

    // 🔥 MAIN LOGIC
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        // What this person owes, in rupees. Authoritative — every balance and
        // settlement reads this instead of dividing the total by head count.
        share: {
          type: Number,
          required: true,
          default: 0,
        },
        // The raw input that produced `share` (exact amount, percentage or
        // weight, depending on splitType). Purely for redisplay.
        value: {
          type: Number,
          default: null,
        },
        paid: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  { timestamps: true }
);

expenseSchema.index({ group: 1, createdAt: -1 });

module.exports = mongoose.model("Expense", expenseSchema);
