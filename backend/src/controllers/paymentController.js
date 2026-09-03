const crypto = require("crypto");
const Razorpay = require("razorpay");

const Expense = require("../models/Expense");
const Payment = require("../models/Payment");
const User = require("../models/User");
const { toPaise } = require("../utils/split");

/**
 * Razorpay settlement flow.
 *
 *   1. POST /api/payments/order   -> create an order for the caller's own share
 *   2. Razorpay Checkout runs in the browser
 *   3. POST /api/payments/verify  -> signature checked here, then share marked paid
 *   4. POST /api/payments/webhook -> gateway's own callback, a safety net for (3)
 *
 * A share is only ever marked paid after a signature made with our key secret
 * has been verified, so the client cannot claim a payment that never happened.
 */

let cachedClient;

const gatewayConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const getClient = () => {
  if (!gatewayConfigured()) return null;
  if (!cachedClient) {
    cachedClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return cachedClient;
};

const hmac = (secret, payload) =>
  crypto.createHmac("sha256", secret).update(payload).digest("hex");

/** Constant-time compare so we don't leak signature bytes through timing. */
const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/** Whether the gateway is usable, so the UI can hide or show the pay button. */
const getConfig = (req, res) => {
  res.json({
    enabled: gatewayConfigured(),
    keyId: process.env.RAZORPAY_KEY_ID || null,
    currency: "INR",
  });
};

const createOrder = async (req, res) => {
  try {
    const { expenseId } = req.body;

    if (!expenseId) {
      return res.status(400).json({ msg: "Expense ID is required" });
    }

    if (!gatewayConfigured()) {
      return res.status(503).json({
        msg: "Online payments aren't configured. Settle directly and use Mark as Paid.",
      });
    }

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ msg: "Expense not found" });
    }

    const entry = expense.participants.find(
      (p) => p.user.toString() === req.user.id.toString()
    );

    if (!entry) {
      return res.status(403).json({ msg: "You are not part of this expense" });
    }

    // Check this before `paid`, since the payer's own share is marked settled
    // on creation and the generic message would be confusing.
    if (expense.paidBy.toString() === req.user.id.toString()) {
      return res.status(400).json({ msg: "You paid for this expense" });
    }

    if (entry.paid) {
      return res.status(400).json({ msg: "Your share is already settled" });
    }

    const amountPaise = toPaise(entry.share);
    if (amountPaise <= 0) {
      return res.status(400).json({ msg: "Nothing to pay on this expense" });
    }

    // Reuse an existing unconsumed order rather than stacking up duplicates
    // when the user closes checkout and taps Pay again.
    const existing = await Payment.findOne({
      expense: expense._id,
      paidBy: req.user.id,
      method: "razorpay",
      status: "created",
    });

    if (existing && existing.amount === entry.share) {
      return res.json({
        orderId: existing.razorpayOrderId,
        amount: amountPaise,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID,
      });
    }

    const payee = await User.findById(expense.paidBy).select("name email");

    const order = await getClient().orders.create({
      amount: amountPaise,
      currency: "INR",
      // Razorpay caps receipts at 40 characters.
      receipt: `exp_${expense._id}`.slice(0, 40),
      notes: {
        expenseId: expense._id.toString(),
        groupId: expense.group.toString(),
        payerId: req.user.id.toString(),
        payeeId: expense.paidBy.toString(),
      },
    });

    // Park a "created" record so the webhook can find this order even if the
    // browser never comes back to us.
    await Payment.create({
      group: expense.group,
      expense: expense._id,
      paidBy: req.user.id,
      paidTo: expense.paidBy,
      amount: entry.share,
      method: "razorpay",
      status: "created",
      razorpayOrderId: order.id,
    });

    res.json({
      orderId: order.id,
      amount: amountPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      payeeName: payee?.name || payee?.email || "group member",
      description: expense.description,
    });
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).json({ msg: "Could not start the payment" });
  }
};

/**
 * Settle a share once a Razorpay signature checks out.
 *
 * Shared by the browser callback and the webhook. Idempotent: replaying the
 * same payment id is accepted but changes nothing.
 */
const settleFromGateway = async ({ orderId, paymentId }) => {
  const record = await Payment.findOne({ razorpayOrderId: orderId });

  if (!record) {
    return { ok: false, status: 404, msg: "Unknown order" };
  }

  if (record.status === "captured") {
    return { ok: true, alreadyDone: true, record };
  }

  const expense = await Expense.findById(record.expense);
  if (!expense) {
    return { ok: false, status: 404, msg: "Expense no longer exists" };
  }

  // Only flip the flag if it is still unpaid, so a concurrent manual settle
  // cannot be double-counted.
  await Expense.updateOne(
    { _id: expense._id, "participants.user": record.paidBy, "participants.paid": false },
    { $set: { "participants.$.paid": true } }
  );

  record.status = "captured";
  record.razorpayPaymentId = paymentId;
  await record.save();

  return { ok: true, record };
};

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ msg: "Incomplete payment details" });
    }

    if (!gatewayConfigured()) {
      return res.status(503).json({ msg: "Online payments aren't configured" });
    }

    const expected = hmac(process.env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);

    if (!safeEqual(expected, signature)) {
      // Mark the attempt so a tampered callback is visible in the record.
      await Payment.updateOne(
        { razorpayOrderId: orderId, status: "created" },
        { $set: { status: "failed" } }
      );
      return res.status(400).json({ msg: "Payment signature verification failed" });
    }

    const result = await settleFromGateway({ orderId, paymentId });

    if (!result.ok) {
      return res.status(result.status).json({ msg: result.msg });
    }

    res.json({
      msg: result.alreadyDone ? "Payment already recorded" : "Payment successful",
      amount: result.record.amount,
    });
  } catch (err) {
    console.error("VERIFY PAYMENT ERROR:", err);
    res.status(500).json({ msg: "Could not verify the payment" });
  }
};

/**
 * Razorpay webhook. Mounted with a raw body parser, because the signature is
 * computed over the exact bytes Razorpay sent.
 */
const handleWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ msg: "Webhook not configured" });

    const signature = req.header("x-razorpay-signature");
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

    if (!signature || !safeEqual(hmac(secret, raw), signature)) {
      return res.status(400).json({ msg: "Invalid webhook signature" });
    }

    const event = JSON.parse(raw.toString("utf8"));
    const entity = event?.payload?.payment?.entity;

    if (event?.event === "payment.captured" && entity?.order_id) {
      await settleFromGateway({ orderId: entity.order_id, paymentId: entity.id });
    } else if (event?.event === "payment.failed" && entity?.order_id) {
      await Payment.updateOne(
        { razorpayOrderId: entity.order_id, status: "created" },
        { $set: { status: "failed", razorpayPaymentId: entity.id } }
      );
    }

    // Always 200 on a valid signature, otherwise Razorpay keeps retrying.
    res.json({ received: true });
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    res.status(500).json({ msg: "Webhook processing failed" });
  }
};

module.exports = {
  getConfig,
  createOrder,
  verifyPayment,
  handleWebhook,
  gatewayConfigured,
};
