const Expense = require("../models/Expense");
const Group = require("../models/Group");
const { computeBalances, computeSettlements } = require("../utils/balances");

const loadLedger = async (groupId) => {
  const group = await Group.findById(groupId).populate("members", "name email");
  if (!group) return null;

  const expenses = await Expense.find({ group: groupId });
  const balances = computeBalances(group.members, expenses);

  const labelById = {};
  group.members.forEach((m) => {
    labelById[m._id.toString()] = m.email;
  });

  return { group, expenses, balances, labelById };
};

const getBalances = async (req, res) => {
  try {
    const { groupId } = req.params;

    const ledger = await loadLedger(groupId);
    if (!ledger) return res.status(404).json({ msg: "Group not found" });

    if (!ledger.group.members.some((m) => m._id.toString() === req.user.id)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    // Keep the original shape: id -> { email, balance }
    const out = {};
    ledger.group.members.forEach((m) => {
      const id = m._id.toString();
      out[id] = { email: m.email, balance: ledger.balances[id] };
    });

    res.json(out);
  } catch (err) {
    console.error("GET BALANCES ERROR:", err);
    res.status(500).json({ msg: "Error calculating balance" });
  }
};

const settleUp = async (req, res) => {
  try {
    const { groupId } = req.params;

    const ledger = await loadLedger(groupId);
    if (!ledger) return res.status(404).json({ msg: "Group not found" });

    if (!ledger.group.members.some((m) => m._id.toString() === req.user.id)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    res.json(computeSettlements(ledger.balances, ledger.labelById));
  } catch (err) {
    console.error("SETTLE UP ERROR:", err);
    res.status(500).json({ msg: "Settlement error" });
  }
};

module.exports = { getBalances, settleUp };
