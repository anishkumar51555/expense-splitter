const { computeShares } = require("../src/utils/split");
const { computeBalances, computeSettlements } = require("../src/utils/balances");

const sum = (shares) =>
  parseFloat(shares.reduce((a, s) => a + s.share, 0).toFixed(2));

describe("computeShares", () => {
  describe("equal", () => {
    it("splits evenly when it divides cleanly", () => {
      const shares = computeShares(120, "equal", [{ user: "a" }, { user: "b" }, { user: "c" }]);
      expect(shares.map((s) => s.share)).toEqual([40, 40, 40]);
    });

    it("gives the leftover paisa away instead of losing it", () => {
      const shares = computeShares(100, "equal", [{ user: "a" }, { user: "b" }, { user: "c" }]);
      expect(sum(shares)).toBe(100);
      expect(shares.map((s) => s.share)).toEqual([33.34, 33.33, 33.33]);
    });

    it("handles an amount smaller than the participant count", () => {
      const shares = computeShares(0.02, "equal", [{ user: "a" }, { user: "b" }, { user: "c" }]);
      expect(sum(shares)).toBe(0.02);
      expect(shares.map((s) => s.share)).toEqual([0.01, 0.01, 0]);
    });
  });

  describe("exact", () => {
    it("keeps the amounts it is given", () => {
      const shares = computeShares(100, "exact", [
        { user: "a", value: 70 },
        { user: "b", value: 25 },
        { user: "c", value: 5 },
      ]);
      expect(shares.map((s) => s.share)).toEqual([70, 25, 5]);
    });

    it("allows a participant to owe nothing", () => {
      const shares = computeShares(100, "exact", [
        { user: "a", value: 100 },
        { user: "b", value: 0 },
      ]);
      expect(shares.map((s) => s.share)).toEqual([100, 0]);
    });

    it("rejects a split that does not add up to the total", () => {
      expect(() =>
        computeShares(100, "exact", [
          { user: "a", value: 70 },
          { user: "b", value: 20 },
        ])
      ).toThrow(/add up to/);
    });

    it("rejects negative amounts", () => {
      expect(() =>
        computeShares(100, "exact", [
          { user: "a", value: 110 },
          { user: "b", value: -10 },
        ])
      ).toThrow(/invalid amount/i);
    });
  });

  describe("percentage", () => {
    it("splits by percentage", () => {
      const shares = computeShares(200, "percentage", [
        { user: "a", value: 75 },
        { user: "b", value: 25 },
      ]);
      expect(shares.map((s) => s.share)).toEqual([150, 50]);
    });

    it("still totals the full amount with repeating percentages", () => {
      const shares = computeShares(10, "percentage", [
        { user: "a", value: 33.33 },
        { user: "b", value: 33.33 },
        { user: "c", value: 33.34 },
      ]);
      expect(sum(shares)).toBe(10);
    });

    it("rejects percentages that do not reach 100", () => {
      expect(() =>
        computeShares(100, "percentage", [
          { user: "a", value: 50 },
          { user: "b", value: 30 },
        ])
      ).toThrow(/not 100%/);
    });
  });

  describe("shares", () => {
    it("splits by relative weight", () => {
      const shares = computeShares(90, "shares", [
        { user: "a", value: 2 },
        { user: "b", value: 1 },
      ]);
      expect(shares.map((s) => s.share)).toEqual([60, 30]);
    });

    it("totals the full amount when weights do not divide cleanly", () => {
      const shares = computeShares(100, "shares", [
        { user: "a", value: 1 },
        { user: "b", value: 1 },
        { user: "c", value: 1 },
      ]);
      expect(sum(shares)).toBe(100);
      expect(shares.map((s) => s.share)).toEqual([33.34, 33.33, 33.33]);
    });
  });

  describe("validation", () => {
    it("rejects an unknown split type", () => {
      expect(() => computeShares(100, "sideways", [{ user: "a" }])).toThrow(/Unknown split type/);
    });

    it("rejects an empty participant list", () => {
      expect(() => computeShares(100, "equal", [])).toThrow(/at least one participant/);
    });

    it("rejects a zero amount", () => {
      expect(() => computeShares(0, "equal", [{ user: "a" }])).toThrow(/greater than zero/);
    });

    it("rejects the same participant listed twice", () => {
      expect(() => computeShares(100, "equal", [{ user: "a" }, { user: "a" }])).toThrow(
        /more than once/
      );
    });

    it("rejects weights that are all zero", () => {
      expect(() =>
        computeShares(100, "shares", [
          { user: "a", value: 0 },
          { user: "b", value: 0 },
        ])
      ).toThrow(/more than zero/);
    });
  });

  it("never loses or invents money across many random splits", () => {
    for (let n = 2; n <= 9; n++) {
      for (let amount = 1; amount <= 200; amount += 7) {
        const participants = Array.from({ length: n }, (_, i) => ({ user: `u${i}` }));
        expect(sum(computeShares(amount + 0.37, "equal", participants))).toBe(
          parseFloat((amount + 0.37).toFixed(2))
        );
      }
    }
  });
});

describe("computeBalances", () => {
  const members = [{ _id: "a" }, { _id: "b" }, { _id: "c" }];

  it("credits the payer and debits the others by their own share", () => {
    const expenses = [
      {
        paidBy: "a",
        amount: 100,
        participants: [
          { user: "a", share: 20, paid: true },
          { user: "b", share: 50, paid: false },
          { user: "c", share: 30, paid: false },
        ],
      },
    ];

    const balances = computeBalances(members, expenses);
    expect(balances).toEqual({ a: 80, b: -50, c: -30 });
  });

  it("drops a share out of the ledger once it is settled", () => {
    const expenses = [
      {
        paidBy: "a",
        amount: 100,
        participants: [
          { user: "a", share: 20, paid: true },
          { user: "b", share: 50, paid: true },
          { user: "c", share: 30, paid: false },
        ],
      },
    ];

    expect(computeBalances(members, expenses)).toEqual({ a: 30, b: 0, c: -30 });
  });

  it("always nets to zero", () => {
    const expenses = [
      {
        paidBy: "a",
        amount: 100,
        participants: [
          { user: "a", share: 33.34 },
          { user: "b", share: 33.33 },
          { user: "c", share: 33.33 },
        ],
      },
      {
        paidBy: "b",
        amount: 55.55,
        participants: [
          { user: "b", share: 18.52 },
          { user: "c", share: 18.52 },
          { user: "a", share: 18.51 },
        ],
      },
    ];

    const balances = computeBalances(members, expenses);
    const net = Object.values(balances).reduce((x, y) => x + y, 0);
    expect(parseFloat(net.toFixed(2))).toBe(0);
  });
});

describe("computeSettlements", () => {
  it("clears every debt", () => {
    const balances = { a: 80, b: -50, c: -30 };
    const settlements = computeSettlements(balances, { a: "a@x.com", b: "b@x.com", c: "c@x.com" });

    const paidTo = {};
    settlements.forEach((s) => {
      paidTo[s.toId] = (paidTo[s.toId] || 0) + s.amount;
    });

    expect(paidTo.a).toBe(80);
    expect(settlements.every((s) => s.amount > 0)).toBe(true);
  });

  it("returns nothing when the group is square", () => {
    expect(computeSettlements({ a: 0, b: 0 })).toEqual([]);
  });

  it("handles a debtor who owes several people", () => {
    const settlements = computeSettlements({ a: -100, b: 60, c: 40 });
    expect(settlements).toHaveLength(2);
    expect(settlements.reduce((s, x) => s + x.amount, 0)).toBe(100);
  });

  it("labels both sides with the supplied names", () => {
    const [s] = computeSettlements({ a: -25, b: 25 }, { a: "ann@x.com", b: "bob@x.com" });
    expect(s.from).toBe("ann@x.com");
    expect(s.to).toBe("bob@x.com");
    expect(s.amount).toBe(25);
  });
});
