const mongoose = require("mongoose");
const Payment = require("../src/models/Payment");

/**
 * Index behaviour on the Payment collection.
 *
 * Gateway ids must be unique so a retried verify call can't record the same
 * payment twice, but manual settlements carry no gateway id at all and must
 * never collide with each other.
 */

const oid = () => new mongoose.Types.ObjectId();

const base = () => ({
  group: oid(),
  expense: oid(),
  paidBy: oid(),
  paidTo: oid(),
  status: "captured",
});

beforeAll(async () => {
  // Build the indexes; without this the constraints under test don't exist.
  await Payment.init();
});

describe("manual settlements", () => {
  it("allows many, since none of them carry a gateway id", async () => {
    await Payment.create({ ...base(), amount: 10, method: "manual" });
    await Payment.create({ ...base(), amount: 20, method: "manual" });
    await Payment.create({ ...base(), amount: 30, method: "manual" });

    expect(await Payment.countDocuments({ method: "manual" })).toBe(3);
  });
});

describe("gateway settlements", () => {
  it("refuses to record the same payment id twice", async () => {
    await Payment.create({
      ...base(),
      amount: 60,
      method: "razorpay",
      razorpayOrderId: "order_A",
      razorpayPaymentId: "pay_A",
    });

    await expect(
      Payment.create({
        ...base(),
        amount: 60,
        method: "razorpay",
        razorpayOrderId: "order_B",
        razorpayPaymentId: "pay_A",
      })
    ).rejects.toThrow(/duplicate key/i);
  });

  it("refuses to record the same order twice", async () => {
    await Payment.create({
      ...base(),
      amount: 60,
      method: "razorpay",
      razorpayOrderId: "order_C",
    });

    await expect(
      Payment.create({
        ...base(),
        amount: 60,
        method: "razorpay",
        razorpayOrderId: "order_C",
      })
    ).rejects.toThrow(/duplicate key/i);
  });

  it("allows several pending orders that have no payment id yet", async () => {
    await Payment.create({
      ...base(),
      amount: 60,
      method: "razorpay",
      status: "created",
      razorpayOrderId: "order_D",
    });
    await Payment.create({
      ...base(),
      amount: 30,
      method: "razorpay",
      status: "created",
      razorpayOrderId: "order_E",
    });

    expect(await Payment.countDocuments({ status: "created" })).toBe(2);
  });
});
