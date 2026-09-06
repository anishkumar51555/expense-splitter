const Group = require("../models/Group");
const Message = require("../models/Message");

const MAX_TEXT = 2000;
const PAGE_SIZE = 200;

/**
 * Group chat.
 *
 * Clients poll `since` with the timestamp of the newest message they hold, so
 * a quiet group costs one small empty response per interval rather than the
 * whole history each time.
 */

// Membership is the only permission that matters: chat is readable and
// writable by exactly the people in the group.
const memberOrNull = async (groupId, userId) => {
  const group = await Group.findById(groupId).select("members");
  if (!group) return { error: { status: 404, msg: "Group not found" } };

  if (!group.members.some((m) => m.toString() === userId)) {
    return { error: { status: 403, msg: "Access denied" } };
  }
  return { group };
};

const listMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { error } = await memberOrNull(groupId, req.user.id);
    if (error) return res.status(error.status).json({ msg: error.msg });

    const filter = { group: groupId };

    // An unparseable `since` would silently widen the query to everything, so
    // it is ignored rather than guessed at.
    if (req.query.since) {
      const since = new Date(req.query.since);
      if (!Number.isNaN(since.getTime())) filter.createdAt = { $gt: since };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: 1 })
      .limit(PAGE_SIZE)
      .populate({ path: "sender", select: "name email" });

    res.json({ messages });
  } catch (err) {
    console.error("LIST MESSAGES ERROR:", err);
    res.status(500).json({ msg: "Error loading messages" });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const text = String(req.body.text || "").trim();

    if (!text) return res.status(400).json({ msg: "Message cannot be empty" });
    if (text.length > MAX_TEXT) {
      return res.status(400).json({ msg: `Message cannot exceed ${MAX_TEXT} characters` });
    }

    const { error } = await memberOrNull(groupId, req.user.id);
    if (error) return res.status(error.status).json({ msg: error.msg });

    const created = await Message.create({ group: groupId, sender: req.user.id, text });
    const message = await created.populate({ path: "sender", select: "name email" });

    res.status(201).json({ message });
  } catch (err) {
    console.error("SEND MESSAGE ERROR:", err);
    res.status(500).json({ msg: "Error sending message" });
  }
};

module.exports = { listMessages, sendMessage };
