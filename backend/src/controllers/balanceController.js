const Expense = require("../models/Expense");
const Group = require("../models/Group");

// Fix #2 & #12: single module.exports at bottom, correct per-expense balance logic
const getBalances = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId).populate("members", "name email");
    if (!group) return res.status(404).json({ msg: "Group not found" });

    const expenses = await Expense.find({ group: groupId }).populate(
      "participants.user",
      "email"
    );

    // Fix #12: use per-expense participant logic, not total/n
    let balances = {};
    group.members.forEach((m) => {
      balances[m._id.toString()] = { email: m.email, balance: 0 };
    });

    expenses.forEach((e) => {
      if (!e.participants || e.participants.length === 0) return;
      const split = e.amount / e.participants.length;
      const payerId = e.paidBy.toString();

      if (balances[payerId] !== undefined) {
        balances[payerId].balance += e.amount;
      }

      e.participants.forEach((p) => {
        const uid = p.user._id ? p.user._id.toString() : p.user.toString();
        if (balances[uid] !== undefined) {
          balances[uid].balance -= split;
        }
      });
    });

    // Round to 2 decimals
    Object.keys(balances).forEach((id) => {
      balances[id].balance = parseFloat(balances[id].balance.toFixed(2));
    });

    res.json(balances);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error calculating balance" });
  }
};

const settleUp = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId).populate("members", "name email");
    if (!group) return res.status(404).json({ msg: "Group not found" });

    const expenses = await Expense.find({ group: groupId });

    let balances = {};
    group.members.forEach((m) => {
      balances[m._id.toString()] = { email: m.email, balance: 0 };
    });

    expenses.forEach((e) => {
      if (!e.participants || e.participants.length === 0) return;
      const split = e.amount / e.participants.length;
      const payerId = e.paidBy.toString();

      if (balances[payerId] !== undefined) {
        balances[payerId].balance += e.amount;
      }

      e.participants.forEach((p) => {
        const uid = p.user.toString();
        if (balances[uid] !== undefined) {
          balances[uid].balance -= split;
        }
      });
    });

    let creditors = [];
    let debtors = [];

    Object.entries(balances).forEach(([id, data]) => {
      const bal = parseFloat(data.balance.toFixed(2));
      if (bal > 0.001) creditors.push({ id, email: data.email, balance: bal });
      else if (bal < -0.001) debtors.push({ id, email: data.email, balance: bal });
    });

    let settlements = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(Math.abs(debtors[i].balance), creditors[j].balance);

      settlements.push({
        from: debtors[i].email,
        to: creditors[j].email,
        amount: parseFloat(amount.toFixed(2)),
      });

      debtors[i].balance += amount;
      creditors[j].balance -= amount;

      if (Math.abs(debtors[i].balance) < 0.001) i++;
      if (Math.abs(creditors[j].balance) < 0.001) j++;
    }

    res.json(settlements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Settlement error" });
  }
};

// Fix #2: single export at the bottom
module.exports = { getBalances, settleUp };
