const { app, request, createVerifiedUser, authed, createGroupWith } = require("./helpers");

let ann;
let bob;
let cal;
let dana;
let groupId;

beforeEach(async () => {
  ann = await createVerifiedUser({ name: "Ann", email: "ann@example.com" });
  bob = await createVerifiedUser({ name: "Bob", email: "bob@example.com" });
  cal = await createVerifiedUser({ name: "Cal", email: "cal@example.com" });
  dana = await createVerifiedUser({ name: "Dana", email: "dana@example.com" });

  groupId = await createGroupWith(ann.token, "Trip", [bob, cal]);
});

const addExpense = (token, body) =>
  request(app).post("/api/expenses/add").set(authed(token)).send({ groupId, ...body });

const groupDetails = (token) =>
  request(app).get(`/api/groups/${groupId}`).set(authed(token));

const shareOf = (expense, userId) =>
  expense.participants.find((p) => (p.user._id || p.user) === userId)?.share;

describe("equal split (the default)", () => {
  it("splits across the whole group when no participants are given", async () => {
    const res = await addExpense(ann.token, { amount: 300, description: "Dinner" }).expect(200);

    expect(res.body.splitType).toBe("equal");
    expect(res.body.participants).toHaveLength(3);
    expect(res.body.participants.map((p) => p.share)).toEqual([100, 100, 100]);
  });

  it("marks the payer's own share settled straight away", async () => {
    const res = await addExpense(ann.token, { amount: 300 }).expect(200);

    const mine = res.body.participants.find((p) => p.user === ann.id);
    expect(mine.paid).toBe(true);
    expect(res.body.participants.filter((p) => p.paid)).toHaveLength(1);
  });

  it("keeps the total exact when it does not divide cleanly", async () => {
    const res = await addExpense(ann.token, { amount: 100 }).expect(200);

    const total = res.body.participants.reduce((s, p) => s + p.share, 0);
    expect(parseFloat(total.toFixed(2))).toBe(100);
  });
});

describe("exact-amount split", () => {
  it("charges each participant the amount given", async () => {
    const res = await addExpense(ann.token, {
      amount: 100,
      description: "Groceries",
      splitType: "exact",
      participants: [
        { user: ann.id, value: 20 },
        { user: bob.id, value: 50 },
        { user: cal.id, value: 30 },
      ],
    }).expect(200);

    expect(res.body.splitType).toBe("exact");
    expect(shareOf(res.body, ann.id)).toBe(20);
    expect(shareOf(res.body, bob.id)).toBe(50);
    expect(shareOf(res.body, cal.id)).toBe(30);
  });

  it("rejects shares that do not add up to the total", async () => {
    const res = await addExpense(ann.token, {
      amount: 100,
      splitType: "exact",
      participants: [
        { user: ann.id, value: 20 },
        { user: bob.id, value: 50 },
      ],
    }).expect(400);

    expect(res.body.msg).toMatch(/add up to/i);
  });

  it("lets the payer take none of the cost", async () => {
    const res = await addExpense(ann.token, {
      amount: 100,
      splitType: "exact",
      participants: [
        { user: ann.id, value: 0 },
        { user: bob.id, value: 100 },
      ],
    }).expect(200);

    expect(shareOf(res.body, ann.id)).toBe(0);
    expect(shareOf(res.body, bob.id)).toBe(100);
  });

  it("can leave a group member out of an expense entirely", async () => {
    const res = await addExpense(ann.token, {
      amount: 80,
      splitType: "exact",
      participants: [
        { user: ann.id, value: 40 },
        { user: bob.id, value: 40 },
      ],
    }).expect(200);

    expect(res.body.participants).toHaveLength(2);
    expect(shareOf(res.body, cal.id)).toBeUndefined();
  });
});

describe("percentage split", () => {
  it("charges each participant their percentage", async () => {
    const res = await addExpense(ann.token, {
      amount: 200,
      splitType: "percentage",
      participants: [
        { user: ann.id, value: 25 },
        { user: bob.id, value: 75 },
      ],
    }).expect(200);

    expect(shareOf(res.body, ann.id)).toBe(50);
    expect(shareOf(res.body, bob.id)).toBe(150);
  });

  it("rejects percentages that do not add up to 100", async () => {
    const res = await addExpense(ann.token, {
      amount: 200,
      splitType: "percentage",
      participants: [
        { user: ann.id, value: 25 },
        { user: bob.id, value: 50 },
      ],
    }).expect(400);

    expect(res.body.msg).toMatch(/not 100%/);
  });

  it("remembers the percentages that were entered", async () => {
    const res = await addExpense(ann.token, {
      amount: 200,
      splitType: "percentage",
      participants: [
        { user: ann.id, value: 25 },
        { user: bob.id, value: 75 },
      ],
    }).expect(200);

    const bobEntry = res.body.participants.find((p) => p.user === bob.id);
    expect(bobEntry.value).toBe(75);
  });
});

describe("share/weight split", () => {
  it("splits by relative weight", async () => {
    const res = await addExpense(ann.token, {
      amount: 120,
      splitType: "shares",
      participants: [
        { user: ann.id, value: 2 },
        { user: bob.id, value: 1 },
        { user: cal.id, value: 1 },
      ],
    }).expect(200);

    expect(shareOf(res.body, ann.id)).toBe(60);
    expect(shareOf(res.body, bob.id)).toBe(30);
    expect(shareOf(res.body, cal.id)).toBe(30);
  });
});

describe("validation and access control", () => {
  it("refuses an unknown split type", async () => {
    const res = await addExpense(ann.token, {
      amount: 100,
      splitType: "vibes",
      participants: [{ user: ann.id, value: 100 }],
    }).expect(400);

    expect(res.body.msg).toMatch(/invalid split type/i);
  });

  it("refuses a non-equal split with no participants list", async () => {
    const res = await addExpense(ann.token, { amount: 100, splitType: "exact" }).expect(400);
    expect(res.body.msg).toMatch(/explicit participants list/i);
  });

  it("refuses to bill someone outside the group", async () => {
    const res = await addExpense(ann.token, {
      amount: 100,
      splitType: "exact",
      participants: [
        { user: ann.id, value: 50 },
        { user: dana.id, value: 50 },
      ],
    }).expect(400);

    expect(res.body.msg).toMatch(/must be members/i);
  });

  it("refuses the same participant twice", async () => {
    const res = await addExpense(ann.token, {
      amount: 100,
      splitType: "exact",
      participants: [
        { user: bob.id, value: 50 },
        { user: bob.id, value: 50 },
      ],
    }).expect(400);

    expect(res.body.msg).toMatch(/more than once/i);
  });

  it("refuses a zero or negative amount", async () => {
    await addExpense(ann.token, { amount: 0 }).expect(400);
    await addExpense(ann.token, { amount: -50 }).expect(400);
  });

  it("refuses a non-member adding an expense", async () => {
    await addExpense(dana.token, { amount: 100 }).expect(403);
  });

  it("refuses an unauthenticated request", async () => {
    await request(app).post("/api/expenses/add").send({ groupId, amount: 100 }).expect(401);
  });
});

describe("balances from unequal splits", () => {
  it("owes exactly the agreed share, not an equal division", async () => {
    await addExpense(ann.token, {
      amount: 100,
      description: "Cab",
      splitType: "exact",
      participants: [
        { user: ann.id, value: 10 },
        { user: bob.id, value: 60 },
        { user: cal.id, value: 30 },
      ],
    }).expect(200);

    const res = await groupDetails(ann.token).expect(200);

    expect(res.body.balances[ann.id]).toBe(90);
    expect(res.body.balances[bob.id]).toBe(-60);
    expect(res.body.balances[cal.id]).toBe(-30);
  });

  it("produces settlements that clear the debts", async () => {
    await addExpense(ann.token, {
      amount: 100,
      splitType: "exact",
      participants: [
        { user: ann.id, value: 10 },
        { user: bob.id, value: 60 },
        { user: cal.id, value: 30 },
      ],
    }).expect(200);

    const res = await groupDetails(ann.token).expect(200);

    const toAnn = res.body.settlements.filter((s) => s.to === ann.email);
    expect(toAnn.reduce((sum, s) => sum + s.amount, 0)).toBe(90);
  });

  it("nets out expenses paid by different people", async () => {
    // Ann pays 100, split 10/60/30
    await addExpense(ann.token, {
      amount: 100,
      splitType: "exact",
      participants: [
        { user: ann.id, value: 10 },
        { user: bob.id, value: 60 },
        { user: cal.id, value: 30 },
      ],
    }).expect(200);

    // Bob pays 90, split evenly three ways
    await addExpense(bob.token, { amount: 90 }).expect(200);

    const res = await groupDetails(ann.token).expect(200);

    // Ann: +90 owed, -30 owing = +60. Bob: -60 owing, +60 owed = 0. Cal: -30 -30 = -60
    expect(res.body.balances[ann.id]).toBe(60);
    expect(res.body.balances[bob.id]).toBe(0);
    expect(res.body.balances[cal.id]).toBe(-60);

    const net = Object.values(res.body.balances).reduce((a, b) => a + b, 0);
    expect(parseFloat(net.toFixed(2))).toBe(0);
  });

  it("matches what the balances endpoint reports", async () => {
    await addExpense(ann.token, {
      amount: 100,
      splitType: "percentage",
      participants: [
        { user: ann.id, value: 10 },
        { user: bob.id, value: 90 },
      ],
    }).expect(200);

    const res = await request(app)
      .get(`/api/balances/${groupId}`)
      .set(authed(ann.token))
      .expect(200);

    expect(res.body[ann.id].balance).toBe(90);
    expect(res.body[bob.id].balance).toBe(-90);
  });

  it("keeps the settle endpoint in step", async () => {
    await addExpense(ann.token, {
      amount: 100,
      splitType: "exact",
      participants: [
        { user: ann.id, value: 40 },
        { user: bob.id, value: 60 },
      ],
    }).expect(200);

    const res = await request(app)
      .get(`/api/balances/settle/${groupId}`)
      .set(authed(ann.token))
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ from: bob.email, to: ann.email, amount: 60 });
  });

  it("locks out a non-member", async () => {
    await groupDetails(dana.token).expect(403);
    await request(app).get(`/api/balances/${groupId}`).set(authed(dana.token)).expect(403);
  });
});

describe("settling an unequal share manually", () => {
  const unequal = () =>
    addExpense(ann.token, {
      amount: 100,
      description: "Cab",
      splitType: "exact",
      participants: [
        { user: ann.id, value: 10 },
        { user: bob.id, value: 60 },
        { user: cal.id, value: 30 },
      ],
    });

  it("clears only that person's share", async () => {
    await unequal().expect(200);

    await request(app)
      .post("/api/expenses/pay")
      .set(authed(bob.token))
      .send({ expenseId: (await groupDetails(ann.token)).body.expenses[0]._id })
      .expect(200);

    const res = await groupDetails(ann.token).expect(200);
    expect(res.body.balances[bob.id]).toBe(0);
    expect(res.body.balances[cal.id]).toBe(-30);
    expect(res.body.balances[ann.id]).toBe(30);
  });

  it("records the payment for the agreed share, not an equal split", async () => {
    await unequal().expect(200);
    const expenseId = (await groupDetails(ann.token)).body.expenses[0]._id;

    await request(app)
      .post("/api/expenses/pay")
      .set(authed(bob.token))
      .send({ expenseId })
      .expect(200);

    const history = await request(app)
      .get("/api/groups/history")
      .set(authed(bob.token))
      .expect(200);

    const payment = history.body.find((h) => h.type === "payment");
    expect(payment.amount).toBe(60);
  });

  it("is idempotent", async () => {
    await unequal().expect(200);
    const expenseId = (await groupDetails(ann.token)).body.expenses[0]._id;

    await request(app)
      .post("/api/expenses/pay")
      .set(authed(bob.token))
      .send({ expenseId })
      .expect(200);

    const again = await request(app)
      .post("/api/expenses/pay")
      .set(authed(bob.token))
      .send({ expenseId })
      .expect(200);

    expect(again.body.msg).toMatch(/already/i);

    const res = await groupDetails(ann.token).expect(200);
    expect(res.body.balances[ann.id]).toBe(30);
  });

  it("lets everyone settle manually, clearing the expense", async () => {
    await unequal().expect(200);
    const expenseId = (await groupDetails(ann.token)).body.expenses[0]._id;

    for (const who of [bob, cal]) {
      await request(app)
        .post("/api/expenses/pay")
        .set(authed(who.token))
        .send({ expenseId })
        .expect(200);
    }

    const res = await groupDetails(ann.token).expect(200);
    expect(res.body.balances[ann.id]).toBe(0);
    expect(res.body.balances[bob.id]).toBe(0);
    expect(res.body.balances[cal.id]).toBe(0);
    expect(res.body.settlements).toEqual([]);
  });

  it("refuses someone who is not on the expense", async () => {
    await addExpense(ann.token, {
      amount: 80,
      splitType: "exact",
      participants: [
        { user: ann.id, value: 40 },
        { user: bob.id, value: 40 },
      ],
    }).expect(200);

    const expenseId = (await groupDetails(ann.token)).body.expenses[0]._id;

    await request(app)
      .post("/api/expenses/pay")
      .set(authed(cal.token))
      .send({ expenseId })
      .expect(403);
  });

  it("shows the payer what each person owes in history", async () => {
    await unequal().expect(200);

    const history = await request(app)
      .get("/api/groups/history")
      .set(authed(ann.token))
      .expect(200);

    const expense = history.body.find((h) => h.type === "expense");
    // Ann fronted 100 and owed 10 of it, so 90 is out with the others.
    expect(expense.amount).toBe(90);
    expect(expense.isPayer).toBe(true);
    expect(expense.splitType).toBe("exact");
  });

  it("shows a participant only their own share in history", async () => {
    await unequal().expect(200);

    const history = await request(app)
      .get("/api/groups/history")
      .set(authed(cal.token))
      .expect(200);

    const expense = history.body.find((h) => h.type === "expense");
    expect(expense.amount).toBe(30);
    expect(expense.isPayer).toBe(false);
  });
});
