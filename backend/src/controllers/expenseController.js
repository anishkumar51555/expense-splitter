const Expense = require("../models/Expense");
const Group = require("../models/Group");
const Payment = require("../models/Payment");
const { computeShares, SPLIT_TYPES } = require("../utils/split");

/**
 * Add an expense.
 *
 * Body:
 *   groupId, amount, description
 *   splitType    "equal" | "exact" | "percentage" | "shares"  (default "equal")
 *   participants [{ user, value }]  — omit entirely to split equally across
 *                the whole group. `value` is a rupee amount, a percentage or a
 *                relative weight depending on splitType.
 */
const addExpense = async (req, res) => {
  try {
    const { groupId, amount, description, splitType = "equal", participants } = req.body;

    const parsedAmount = parseFloat(amount);

    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ msg: "Invalid amount" });
    }

    if (!groupId) {
      return res.status(400).json({ msg: "Group ID is required" });
    }

    if (!SPLIT_TYPES.includes(splitType)) {
      return res.status(400).json({ msg: `Invalid split type "${splitType}"` });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ msg: "Group not found" });
    }

    const memberIds = group.members.map((m) => m.toString());

    if (!memberIds.includes(req.user.id)) {
      return res.status(403).json({ msg: "You are not a member of this group" });
    }

    // Default: everyone in the group, split equally.
    let requested;
    if (Array.isArray(participants) && participants.length > 0) {
      requested = participants.map((p) => ({
        user: String(p.user || p.userId || p),
        value: p.value,
      }));
    } else {
      if (splitType !== "equal") {
        return res.status(400).json({
          msg: `A "${splitType}" split needs an explicit participants list`,
        });
      }
      requested = memberIds.map((id) => ({ user: id }));
    }

    // Nobody outside the group can be put on the hook for an expense.
    const outsider = requested.find((p) => !memberIds.includes(p.user));
    if (outsider) {
      return res.status(400).json({ msg: "All participants must be members of this group" });
    }

    let shares;
    try {
      shares = computeShares(parsedAmount, splitType, requested);
    } catch (err) {
      // computeShares throws with a message written for the end user.
      return res.status(400).json({ msg: err.message });
    }

    const expense = await Expense.create({
      group: groupId,
      amount: parsedAmount,
      description: description?.trim() || "Expense",
      paidBy: req.user.id,
      splitType,
      participants: shares.map((s, i) => ({
        user: s.user,
        share: s.share,
        value: requested[i].value ?? null,
        // Whoever fronted the money has nothing to settle with themselves.
        paid: s.user === req.user.id.toString(),
      })),
    });

    res.json(expense);
  } catch (err) {
    console.error("ADD EXPENSE ERROR:", err);
    res.status(500).json({ msg: "Error adding expense" });
  }
};

/**
 * Record a settlement made outside the app (cash, direct UPI transfer).
 * Gateway payments go through paymentController instead.
 */
const payExpense = async (req, res) => {
  try {
    const { expenseId } = req.body;

    if (!expenseId) {
      return res.status(400).json({ msg: "Expense ID is required" });
    }

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ msg: "Expense not found" });
    }

    const participantEntry = expense.participants.find(
      (p) => p.user.toString() === req.user.id.toString()
    );

    if (!participantEntry) {
      return res.status(403).json({ msg: "You are not part of this expense" });
    }

    if (participantEntry.paid) {
      return res.json({ msg: "Already marked as paid" });
    }

    // Mark as paid in the expense
    const result = await Expense.updateOne(
      { _id: expenseId, "participants.user": req.user.id, "participants.paid": false },
      { $set: { "participants.$.paid": true } }
    );

    if (result.modifiedCount === 0) {
      return res.status(500).json({ msg: "Could not update payment status" });
    }

    // Save a payment record to DB so it appears in history. The amount is this
    // participant's own share, not an equal division of the total.
    await Payment.create({
      group: expense.group,
      expense: expense._id,
      paidBy: req.user.id,
      paidTo: expense.paidBy,
      amount: participantEntry.share,
      method: "manual",
      status: "captured",
    });

    res.json({ msg: "Marked as paid successfully" });
  } catch (err) {
    console.error("PAY EXPENSE ERROR:", err);
    res.status(500).json({ msg: "Error paying expense" });
  }
};

module.exports = { addExpense, payExpense };
