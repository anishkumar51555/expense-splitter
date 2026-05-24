const Expense = require("../models/Expense");
const Group = require("../models/Group");
const Payment = require("../models/Payment");

const addExpense = async (req, res) => {
  try {
    const { groupId, amount, description } = req.body;

    const parsedAmount = parseFloat(amount);

    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ msg: "Invalid amount" });
    }

    if (!groupId) {
      return res.status(400).json({ msg: "Group ID is required" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ msg: "Group not found" });
    }

    if (!group.members.some((m) => m.toString() === req.user.id)) {
      return res.status(403).json({ msg: "You are not a member of this group" });
    }

    const participants = group.members.map((member) => ({
      user: member,
      paid: member.toString() === req.user.id.toString(),
    }));

    const expense = await Expense.create({
      group: groupId,
      amount: parsedAmount,
      description: description?.trim() || "Expense",
      paidBy: req.user.id,
      participants,
    });

    res.json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error adding expense" });
  }
};

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
      { _id: expenseId, "participants.user": req.user.id },
      { $set: { "participants.$.paid": true } }
    );

    if (result.modifiedCount === 0) {
      return res.status(500).json({ msg: "Could not update payment status" });
    }

    // Save a payment record to DB so it appears in history
    const split = expense.amount / expense.participants.length;

    await Payment.create({
      group: expense.group,
      expense: expense._id,
      paidBy: req.user.id,
      paidTo: expense.paidBy,
      amount: parseFloat(split.toFixed(2)),
    });

    res.json({ msg: "Marked as paid successfully" });
  } catch (err) {
    console.error("PAY EXPENSE ERROR:", err);
    res.status(500).json({ msg: "Error paying expense" });
  }
};

module.exports = { addExpense, payExpense };