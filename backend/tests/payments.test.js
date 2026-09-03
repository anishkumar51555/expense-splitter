const crypto = require("crypto");

// Configure the gateway before anything reads process.env at require time.
process.env.RAZORPAY_KEY_ID = "rzp_test_fake_key";
process.env.RAZORPAY_KEY_SECRET = "test_secret_value";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";

// Stand in for Razorpay's HTTP API. Signatures are still produced and checked
// with real HMAC-SHA256, so the verification path under test is the real one.
const createdOrders = [];

jest.mock("razorpay", () =>
  jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn(async (opts) => {
        const order = { id: `order_${createdOrders.length + 1}`, ...opts };
        createdOrders.push(order);
        return order;
      }),
    },
  }))
);

const { app, request, createVerifiedUser, authed, createGroupWith } = require("./helpers");
const Payment = require("../src/models/Payment");

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const sign = (orderId, paymentId, secret = KEY_SECRET) =>
  crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");

let ann;
let bob;
let cal;
let groupId;
let expenseId;

beforeEach(async () => {
  createdOrders.length = 0;

  ann = await createVerifiedUser({ name: "Ann", email: "ann@example.com" });
  bob = await createVerifiedUser({ name: "Bob", email: "bob@example.com" });
  cal = await createVerifiedUser({ name: "Cal", email: "cal@example.com" });

  groupId = await createGroupWith(ann.token, "Trip", [bob, cal]);

  // Ann pays 100; Bob owes 60, Cal owes 30, Ann's own share is 10.
  const expense = await request(app)
    .post("/api/expenses/add")
    .set(authed(ann.token))
    .send({
      groupId,
      amount: 100,
      description: "Cab",
      splitType: "exact",
      participants: [
        { user: ann.id, value: 10 },
        { user: bob.id, value: 60 },
        { user: cal.id, value: 30 },
      ],
    })
    .expect(200);

  expenseId = expense.body._id;
});

const groupDetails = (token) => request(app).get(`/api/groups/${groupId}`).set(authed(token));

const createOrder = (token, body = { expenseId }) =>
  request(app).post("/api/payments/order").set(authed(token)).send(body);

const verify = (token, body) =>
  request(app).post("/api/payments/verify").set(authed(token)).send(body);

describe("gateway config", () => {
  it("tells the client the gateway is on and which key to use", async () => {
    const res = await request(app).get("/api/payments/config").expect(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.keyId).toBe("rzp_test_fake_key");
    expect(res.body.currency).toBe("INR");
  });

  it("does not leak the key secret", async () => {
    const res = await request(app).get("/api/payments/config").expect(200);
    expect(JSON.stringify(res.body)).not.toContain(KEY_SECRET);
  });
});

describe("creating an order", () => {
  it("charges the caller's own unequal share, in paise", async () => {
    const res = await createOrder(bob.token).expect(200);

    expect(res.body.amount).toBe(6000); // ₹60.00
    expect(res.body.currency).toBe("INR");
    expect(res.body.orderId).toBe("order_1");
    expect(res.body.keyId).toBe("rzp_test_fake_key");
    expect(res.body.payeeName).toBe("Ann");
  });

  it("charges a different participant their own different share", async () => {
    const res = await createOrder(cal.token).expect(200);
    expect(res.body.amount).toBe(3000); // ₹30.00
  });

  it("parks a pending record so the webhook can find the order", async () => {
    await createOrder(bob.token).expect(200);

    const record = await Payment.findOne({ razorpayOrderId: "order_1" });
    expect(record.status).toBe("created");
    expect(record.method).toBe("razorpay");
    expect(record.amount).toBe(60);
    expect(record.paidBy.toString()).toBe(bob.id);
    expect(record.paidTo.toString()).toBe(ann.id);
  });

  it("reuses a pending order instead of stacking up duplicates", async () => {
    const first = await createOrder(bob.token).expect(200);
    const second = await createOrder(bob.token).expect(200);

    expect(second.body.orderId).toBe(first.body.orderId);
    expect(createdOrders).toHaveLength(1);
    expect(await Payment.countDocuments({ expense: expenseId })).toBe(1);
  });

  it("refuses the person who already paid for the expense", async () => {
    const res = await createOrder(ann.token).expect(400);
    expect(res.body.msg).toMatch(/you paid for this/i);
  });

  it("refuses someone not on the expense", async () => {
    const dana = await createVerifiedUser({ name: "Dana", email: "dana@example.com" });
    await createOrder(dana.token).expect(403);
  });

  it("refuses a share that is already settled", async () => {
    await request(app)
      .post("/api/expenses/pay")
      .set(authed(bob.token))
      .send({ expenseId })
      .expect(200);

    const res = await createOrder(bob.token).expect(400);
    expect(res.body.msg).toMatch(/already settled/i);
  });

  it("requires an expense id", async () => {
    await createOrder(bob.token, {}).expect(400);
  });

  it("requires authentication", async () => {
    await request(app).post("/api/payments/order").send({ expenseId }).expect(401);
  });
});

describe("verifying a payment", () => {
  it("settles the share when the signature is genuine", async () => {
    const order = await createOrder(bob.token).expect(200);
    const paymentId = "pay_abc123";

    const res = await verify(bob.token, {
      razorpay_order_id: order.body.orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(order.body.orderId, paymentId),
    }).expect(200);

    expect(res.body.msg).toMatch(/payment successful/i);
    expect(res.body.amount).toBe(60);

    const details = await groupDetails(ann.token).expect(200);
    expect(details.body.balances[bob.id]).toBe(0);
    expect(details.body.balances[ann.id]).toBe(30); // only Cal's 30 left outstanding
    expect(details.body.balances[cal.id]).toBe(-30);

    const record = await Payment.findOne({ razorpayOrderId: order.body.orderId });
    expect(record.status).toBe("captured");
    expect(record.razorpayPaymentId).toBe(paymentId);
  });

  it("rejects a forged signature and settles nothing", async () => {
    const order = await createOrder(bob.token).expect(200);

    const res = await verify(bob.token, {
      razorpay_order_id: order.body.orderId,
      razorpay_payment_id: "pay_forged",
      razorpay_signature: "deadbeef".repeat(8),
    }).expect(400);

    expect(res.body.msg).toMatch(/signature verification failed/i);

    const details = await groupDetails(ann.token).expect(200);
    expect(details.body.balances[bob.id]).toBe(-60); // still owing

    const record = await Payment.findOne({ razorpayOrderId: order.body.orderId });
    expect(record.status).toBe("failed");
  });

  it("rejects a signature made with the wrong secret", async () => {
    const order = await createOrder(bob.token).expect(200);
    const paymentId = "pay_wrongsecret";

    await verify(bob.token, {
      razorpay_order_id: order.body.orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(order.body.orderId, paymentId, "attacker_secret"),
    }).expect(400);

    const details = await groupDetails(ann.token).expect(200);
    expect(details.body.balances[bob.id]).toBe(-60);
  });

  it("rejects a signature that is valid for a different payment id", async () => {
    const order = await createOrder(bob.token).expect(200);

    await verify(bob.token, {
      razorpay_order_id: order.body.orderId,
      razorpay_payment_id: "pay_actual",
      razorpay_signature: sign(order.body.orderId, "pay_other"),
    }).expect(400);
  });

  it("does not double-count a replayed callback", async () => {
    const order = await createOrder(bob.token).expect(200);
    const paymentId = "pay_replay";
    const body = {
      razorpay_order_id: order.body.orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(order.body.orderId, paymentId),
    };

    await verify(bob.token, body).expect(200);
    const second = await verify(bob.token, body).expect(200);

    expect(second.body.msg).toMatch(/already recorded/i);
    expect(await Payment.countDocuments({ expense: expenseId })).toBe(1);

    const details = await groupDetails(ann.token).expect(200);
    expect(details.body.balances[ann.id]).toBe(30);
  });

  it("rejects an unknown order", async () => {
    const paymentId = "pay_ghost";
    await verify(bob.token, {
      razorpay_order_id: "order_does_not_exist",
      razorpay_payment_id: paymentId,
      razorpay_signature: sign("order_does_not_exist", paymentId),
    }).expect(404);
  });

  it("requires the full set of callback fields", async () => {
    const order = await createOrder(bob.token).expect(200);
    await verify(bob.token, { razorpay_order_id: order.body.orderId }).expect(400);
  });

  it("shows the settlement in history for both sides", async () => {
    const order = await createOrder(bob.token).expect(200);
    const paymentId = "pay_history";

    await verify(bob.token, {
      razorpay_order_id: order.body.orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(order.body.orderId, paymentId),
    }).expect(200);

    const bobHistory = await request(app)
      .get("/api/groups/history")
      .set(authed(bob.token))
      .expect(200);

    const sent = bobHistory.body.find((h) => h.type === "payment");
    expect(sent.amount).toBe(60);
    expect(sent.isSender).toBe(true);

    const annHistory = await request(app)
      .get("/api/groups/history")
      .set(authed(ann.token))
      .expect(200);

    const received = annHistory.body.find((h) => h.type === "payment");
    expect(received.amount).toBe(60);
    expect(received.isSender).toBe(false);
  });

  it("clears the group once everyone has paid", async () => {
    for (const who of [bob, cal]) {
      const order = await createOrder(who.token).expect(200);
      const paymentId = `pay_${who.id}`;
      await verify(who.token, {
        razorpay_order_id: order.body.orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sign(order.body.orderId, paymentId),
      }).expect(200);
    }

    const details = await groupDetails(ann.token).expect(200);
    expect(details.body.balances[ann.id]).toBe(0);
    expect(details.body.settlements).toEqual([]);
  });
});

describe("webhook", () => {
  const signRaw = (raw, secret = process.env.RAZORPAY_WEBHOOK_SECRET) =>
    crypto.createHmac("sha256", secret).update(raw).digest("hex");

  const post = (payload, secret) => {
    const raw = JSON.stringify(payload);
    return request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signRaw(raw, secret))
      .send(raw);
  };

  it("settles a share on payment.captured", async () => {
    const order = await createOrder(bob.token).expect(200);

    await post({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_webhook", order_id: order.body.orderId } } },
    }).expect(200);

    const details = await groupDetails(ann.token).expect(200);
    expect(details.body.balances[bob.id]).toBe(0);

    const record = await Payment.findOne({ razorpayOrderId: order.body.orderId });
    expect(record.status).toBe("captured");
    expect(record.razorpayPaymentId).toBe("pay_webhook");
  });

  it("rejects a webhook signed with the wrong secret", async () => {
    const order = await createOrder(bob.token).expect(200);

    await post(
      {
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_bad", order_id: order.body.orderId } } },
      },
      "not_the_webhook_secret"
    ).expect(400);

    const details = await groupDetails(ann.token).expect(200);
    expect(details.body.balances[bob.id]).toBe(-60);
  });

  it("rejects a webhook with no signature", async () => {
    await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ event: "payment.captured" }))
      .expect(400);
  });

  it("marks the record failed on payment.failed", async () => {
    const order = await createOrder(bob.token).expect(200);

    await post({
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_failed", order_id: order.body.orderId } } },
    }).expect(200);

    const record = await Payment.findOne({ razorpayOrderId: order.body.orderId });
    expect(record.status).toBe("failed");

    const details = await groupDetails(ann.token).expect(200);
    expect(details.body.balances[bob.id]).toBe(-60);
  });

  it("is safe to deliver twice", async () => {
    const order = await createOrder(bob.token).expect(200);
    const payload = {
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_twice", order_id: order.body.orderId } } },
    };

    await post(payload).expect(200);
    await post(payload).expect(200);

    expect(await Payment.countDocuments({ expense: expenseId })).toBe(1);

    const details = await groupDetails(ann.token).expect(200);
    expect(details.body.balances[ann.id]).toBe(30);
  });
});
