const Group = require("../models/Group");
const User = require("../models/User");
const Expense = require("../models/Expense");
const crypto = require("crypto");
const { computeBalances, computeSettlements } = require("../utils/balances");

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
  } catch {
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
  } catch {
    res.status(500).json({ msg: "Error joining group" });
  }
};

// GET ALL GROUPS
const getGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.id }).populate({
      path: "members",
      select: "name email payment",  // FIX: include name
    });

    res.json(groups);
  } catch {
    res.status(500).json({ msg: "Server error" });
  }
};

// ADD MEMBER — FIX: only creator can add members
const addMember = async (req, res) => {
  try {
    const { groupId, email } = req.body;

    if (!groupId || !email) {
      return res.status(400).json({ msg: "groupId and email are required" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });

    // FIX: authorization check — only creator can add members
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
  } catch {
    res.status(500).json({ msg: "Server error" });
  }
};

// GET GROUP DETAILS WITH EXPENSES AND SETTLEMENTS
const getGroupDetails = async (req, res) => {
  try {
    const groupId = req.params.id;

    const group = await Group.findById(groupId).populate({
      path: "members",
      select: "name email payment",  // FIX: include name
    });

    if (!group) return res.status(404).json({ msg: "Group not found" });

    // FIX: verify requesting user is actually a member
    if (!group.members.some((m) => m._id.toString() === req.user.id)) {
      return res.status(403).json({ msg: "Access denied" });
    }

    const expenses = await Expense.find({ group: groupId })
      .populate({ path: "paidBy", select: "name email payment" })
      .populate({ path: "participants.user", select: "name email payment" })
      .sort({ createdAt: -1 });

    // Balances come from each participant's stored share, so unequal splits
    // settle for exactly what was agreed.
    const balances = computeBalances(group.members, expenses);

    const labelById = {};
    group.members.forEach((m) => {
      labelById[m._id.toString()] = m.email;
    });

    const settlements = computeSettlements(balances, labelById);

    res.json({
      group,
      expenses,
      settlements,
      balances,
      currentUserId: req.user.id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching group details" });
  }
};

// LEAVE GROUP — FIX: creator cannot leave and orphan the group
const leaveGroup = async (req, res) => {
  try {
    const groupId = req.params.id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ msg: "Group not found" });

    // FIX: prevent creator from leaving
    if (group.createdBy.toString() === req.user.id) {
      return res.status(400).json({
        msg: "Group creator cannot leave. Delete the group or transfer ownership first.",
      });
    }

    group.members = group.members.filter((m) => m.toString() !== req.user.id);
    await group.save();

    res.json({ msg: "Left group successfully" });
  } catch {
    res.status(500).json({ msg: "Error leaving group" });
  }
};

// HISTORY — FIX: populate group so group.name is available on frontend
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

    // Fetch expenses
    const expenses = await Expense.find({ group: { $in: groupIds } })
  .populate("paidBy", "name email")
  .populate("participants.user", "name email")
  .populate("group", "name")
  .sort({ createdAt: -1 });

    // Fetch payments (settlements)
    const Payment = require("../models/Payment");
    const payments = await Payment.find({ group: { $in: groupIds } })
      .populate("paidBy", "name email")
      .populate("paidTo", "name email")
      .populate("group", "name")
      .sort({ createdAt: -1 });

    // Combine into a unified list with a type tag
    // Only show expenses where the current user is the payer OR a participant
const expenseItems = expenses
  .filter((e) => {
    const isParticipant = e.participants?.some(
      (p) => p.user?._id?.toString() === req.user.id.toString()
    );
    return isParticipant;
  })
  .map((e) => {
    const isPayer = e.paidBy?._id?.toString() === req.user.id?.toString() || e.paidBy?.toString() === req.user.id?.toString();
    const myEntry = e.participants?.find(
      (p) => p.user?._id?.toString() === req.user.id.toString()
    );

    // What this row is worth to me: as the payer, everyone else's shares put
    // together; otherwise just my own share.
    const othersTotal = (e.participants || [])
      .filter((p) => p.user?._id?.toString() !== req.user.id.toString())
      .reduce((sum, p) => sum + (p.share || 0), 0);

    return {
      type: "expense",
      description: e.description,
      amount: parseFloat((isPayer ? othersTotal : myEntry?.share || 0).toFixed(2)),
      total: e.amount,
      splitType: e.splitType || "equal",
      groupName: e.group?.name || "Unknown Group",
      paidBy: isPayer ? "You" : (e.paidBy?.name || e.paidBy?.email || "Someone"),
      isPayer,
      settled: myEntry?.paid || false,
      time: e.createdAt,
    };
  });

// Only show payments where current user is sender or receiver
const paymentItems = payments
  .filter((p) =>
    p.paidBy?._id?.toString() === req.user.id.toString() ||
    p.paidTo?._id?.toString() === req.user.id.toString()
  )
  .map((p) => {
    const isSender = p.paidBy?._id?.toString() === req.user.id.toString();
    return {
      type: "payment",
      description: "Settled payment",
      amount: p.amount,
      groupName: p.group?.name || "Unknown Group",
      isSender,
      paidBy: isSender ? "You" : (p.paidBy?.name || p.paidBy?.email),
      paidTo: isSender ? (p.paidTo?.name || p.paidTo?.email) : "You",
      time: p.createdAt,
    };
  });

    // Merge and sort by time descending
    const combined = [...expenseItems, ...paymentItems].sort(
      (a, b) => new Date(b.time) - new Date(a.time)
    );

    res.json(combined);
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