const Expense = require("../models/Expense");
const Group = require("../models/Group");

const addExpense = async (req, res) => {
  try {
    const { groupId, amount, description } = req.body;

    // FIX: parse amount to a number — string amounts cause silent arithmetic bugs
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

    // FIX: verify the user is actually a member of this group
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

    const participant = expense.participants.find(
      (p) => p.user.toString() === req.user.id.toString()
    );

    if (!participant) {
      return res.status(403).json({ msg: "Not part of this expense" });
    }

    if (participant.paid) {
      return res.json({ msg: "Already paid" });
    }

    const result = await Expense.updateOne(
  {
    _id: expenseId,
    "participants.user": req.user.id,
  },
  {
    $set: { "participants.$.paid": true },
  }
);

if (result.modifiedCount === 0) {
  return res.status(500).json({ msg: "Could not update payment status" });
}

res.json({ msg: "Marked as paid successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error paying expense" });
  }
};

module.exports = { addExpense, payExpense };
