const Expense = require("../models/Expense");
const Group = require("../models/Group");

// ✅ ADD EXPENSE
const addExpense = async (req, res) => {
  try {
    const { groupId, amount, description } = req.body;

    const parsedAmount = parseFloat(amount);

    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ msg: "Invalid amount" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ msg: "Group not found" });
    }

    if (!group.members.some((m) => m.toString() === req.user.id)) {
      return res.status(403).json({ msg: "Not a member" });
    }

    const participants = group.members.map((member) => ({
      user: member,
      paid: member.toString() === req.user.id.toString(),
    }));

    const expense = await Expense.create({
      group: groupId,
      amount: parsedAmount,
      description: description || "Expense",
      paidBy: req.user.id,
      participants,
    });

    res.json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error adding expense" });
  }
};

// ✅ GET SINGLE EXPENSE
const getExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate("paidBy", "email payment");

    res.json(expense);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching expense" });
  }
};

// ✅ MARK AS PAID (USER BASED)
const markPaid = async (req, res) => {
  try {
    const { expenseId } = req.body;

    if (!expenseId) {
      return res.status(400).json({ msg: "Expense ID missing" });
    }

    const expense = await Expense.findById(expenseId);

    if (!expense) {
      return res.status(404).json({ msg: "Expense not found" });
    }

    // 🔥 IMPORTANT DEBUG
    console.log("Logged in user:", req.user);

    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: "User not authenticated" });
    }

    let found = false;

    expense.participants = expense.participants.map((p) => {
      const userId =
        typeof p.user === "object"
          ? p.user._id.toString()
          : p.user.toString();

      if (userId === req.user.id.toString()) {
        found = true;
        return { ...p._doc, paid: true };
      }

      return p;
    });

    if (!found) {
      return res.status(403).json({ msg: "User not part of expense" });
    }

    await expense.save();

    res.json({ msg: "Payment marked successfully" });
  } catch (err) {
    console.error("PAY ERROR:", err);
    res.status(500).json({ msg: "Server error in payment" });
  }
};
// ✅ EXPORT ALL (IMPORTANT 🔥)
module.exports = {
  addExpense,
  getExpense,
  markPaid,
};