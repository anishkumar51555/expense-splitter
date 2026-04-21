const Group = require("../models/Group");
const User = require("../models/User");
const Expense = require("../models/Expense");
const crypto = require("crypto");

// CREATE GROUP
const createGroup = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ msg: "Group name is required" });
    }

    const inviteCode = crypto.randomBytes(4).toString("hex");

    const group = new Group({
      name: name.trim(),
      members: [req.user.id],
      createdBy: req.user.id,
      inviteCode,
    });

    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// JOIN BY INVITE CODE
const joinByInvite = async (req, res) => {
  try {
    const { code } = req.params;

    const group = await Group.findOne({ inviteCode: code });
    if (!group) return res.status(404).json({ msg: "Invalid invite link" });

    if (group.members.some((m) => m.toString() === req.user.id)) {
      return res.json({ msg: "Already a member", group });
    }

    group.members.push(req.user.id);
    await group.save();

    res.json({ msg: "Joined group successfully", group });
  } catch (err) {
    res.status(500).json({ msg: "Error joining group" });
  }
};

// GET ALL GROUPS FOR CURRENT USER
const getGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.id }).populate({
      path: "members",
      select: "name email payment",
    });

    res.json(groups);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// ADD MEMBER BY EMAIL — only group creator can do this
const addMember = async (req, res) => {
  try {
    const { groupId, email } = req.body;

    if (!groupId || !email) {
      return res.status(400).json({ msg: "groupId and email are required" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });

    // Fix #10: only creator can add members
    if (group.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Only the group creator can add members" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (group.members.some((m) => m.toString() === user._id.toString())) {
      return res.status(400).json({ msg: "User is already a member" });
    }

    group.members.push(user._id);
    await group.save();

    res.json({ msg: "Member added", group });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// GET GROUP DETAILS WITH EXPENSES AND SETTLEMENTS
const getGroupDetails = async (req, res) => {
  try {
    const groupId = req.params.id;

    const group = await Group.findById(groupId).populate({
      path: "members",
      select: "name email payment",
    });

    if (!group) return res.status(404).json({ msg: "Group not found" });

    // Verify current user is a member
    if (!group.members.some((m) => m._id.toString() === req.user.id)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    const expenses = await Expense.find({ group: groupId })
      .populate({ path: "paidBy", select: "name email payment" })
      .populate({ path: "participants.user", select: "name email payment" })
      .sort({ createdAt: -1 });

    // Fix #6: correct balance calculation
    // Step 1: init balances
    let balances = {};
    group.members.forEach((m) => {
      balances[m._id.toString()] = 0;
    });

    // Step 2: for each expense, credit payer full amount, debit everyone their share
    expenses.forEach((e) => {
      if (!e.participants || e.participants.length === 0) return;
      const split = e.amount / e.participants.length;
      const payerId = e.paidBy._id.toString();

      // Credit the payer the full amount they paid
      if (balances[payerId] !== undefined) {
        balances[payerId] += e.amount;
      }

      // Debit each participant their share
      e.participants.forEach((p) => {
        const uid = p.user._id.toString();
        if (balances[uid] !== undefined) {
          balances[uid] -= split;
        }
      });
    });

    // Step 3: split into creditors (owed money) and debtors (owe money)
    let creditors = [];
    let debtors = [];

    group.members.forEach((m) => {
      const bal = parseFloat(balances[m._id.toString()].toFixed(2));
      if (bal > 0.001) creditors.push({ email: m.email, amount: bal });
      else if (bal < -0.001) debtors.push({ email: m.email, amount: bal });
    });

    // Step 4: greedy settlement
    let settlements = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const min = Math.min(Math.abs(debtors[i].amount), creditors[j].amount);

      settlements.push({
        from: debtors[i].email,
        to: creditors[j].email,
        amount: parseFloat(min.toFixed(2)),
      });

      debtors[i].amount += min;
      creditors[j].amount -= min;

      if (Math.abs(debtors[i].amount) < 0.001) i++;
      if (Math.abs(creditors[j].amount) < 0.001) j++;
    }

    res.json({
      group,
      expenses,
      settlements,
      currentUserId: req.user.id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching group details" });
  }
};

// LEAVE GROUP — Fix #11: creator cannot leave
const leaveGroup = async (req, res) => {
  try {
    const groupId = req.params.id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });

    // Fix #11: prevent creator from leaving
    if (group.createdBy.toString() === req.user.id) {
      return res.status(400).json({
        msg: "Group creator cannot leave. Delete the group or transfer ownership first.",
      });
    }

    group.members = group.members.filter(
      (m) => m.toString() !== req.user.id
    );

    await group.save();
    res.json({ msg: "Left group successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Error leaving group" });
  }
};

// EXPENSE HISTORY — Fix #5: populate group name
const getHistory = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    const groups = await Group.find({ members: { $in: [req.user.id] } });
    const groupIds = groups.map((g) => g._id);

    if (groupIds.length === 0) {
      return res.json([]);
    }

    const expenses = await Expense.find({ group: { $in: groupIds } })
      .populate("paidBy", "name email")
      .populate("group", "name")        // Fix #5: populate group so name is available
      .sort({ createdAt: -1 });

    res.json(expenses);
  } catch (err) {
    console.error("HISTORY ERROR:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = {
  createGroup,
  joinByInvite,
  getGroups,
  addMember,
  getGroupDetails,
  leaveGroup,
  getHistory,
};
