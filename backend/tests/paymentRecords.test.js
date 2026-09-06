const mongoose = require("mongoose");
const Payment = require("../src/models/Payment");

/**
 * Index behaviour on the Payment collection.
 *
 * Settlement happens outside the app, so a row records that two people squared
 * up. Recording the same person settling the same expense twice would
 * double-count it, so the pair is unique — but that must not stop different
 * people settling the same expense, or one person settling several.
 */

const oid = () => new mongoose.Types.ObjectId();

const base = () => ({
  group: oid(),
  expense: oid(),
  paidBy: oid(),
  paidTo: oid(),
  status: "captured",
  method: "manual",
});

beforeAll(async () => {
  // Build the indexes; without this the constraints under test don't exist.
  await Payment.init();
});

describe("settlement records", () => {
  it("records one settlement per person per expense", async () => {
    await Payment.create({ ...base(), amount: 10 });
    await Payment.create({ ...base(), amount: 20 });
    await Payment.create({ ...base(), amount: 30 });

    expect(await Payment.countDocuments()).toBe(3);
  });

  it("refuses to record the same person settling one expense twice", async () => {
    const expense = oid();
    const paidBy = oid();

    await Payment.create({ ...base(), expense, paidBy, amount: 60 });

    await expect(
      Payment.create({ ...base(), expense, paidBy, amount: 60 })
    ).rejects.toThrow(/duplicate key/i);
  });

  it("lets different people settle the same expense", async () => {
    const expense = oid();

    await Payment.create({ ...base(), expense, paidBy: oid(), amount: 25 });
    await Payment.create({ ...base(), expense, paidBy: oid(), amount: 25 });

    expect(await Payment.countDocuments({ expense })).toBe(2);
  });

  it("lets one person settle several expenses", async () => {
    const paidBy = oid();

    await Payment.create({ ...base(), paidBy, amount: 15 });
    await Payment.create({ ...base(), paidBy, amount: 45 });

    expect(await Payment.countDocuments({ paidBy })).toBe(2);
  });

  it("only accepts the manual method", async () => {
    await expect(
      Payment.create({ ...base(), amount: 10, method: "razorpay" })
    ).rejects.toThrow(/validation/i);
  });
});
