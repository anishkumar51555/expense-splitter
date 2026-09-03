/**
 * Split engine.
 *
 * All money is handled internally as integer paise so that a split always adds
 * back up to the original amount exactly. Rounding remainders are handed out
 * one paisa at a time to the largest fractional parts, which keeps the result
 * stable and never off by a cent.
 */

const SPLIT_TYPES = ["equal", "exact", "percentage", "shares"];

const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const toRupees = (paise) => parseFloat((paise / 100).toFixed(2));

/**
 * Hand out `total` paise across `weights` proportionally, using the
 * largest-remainder method so the parts sum to exactly `total`.
 */
const distributeByWeight = (total, weights) => {
  const weightSum = weights.reduce((a, b) => a + b, 0);

  if (weightSum <= 0) {
    throw new Error("Split weights must add up to more than zero");
  }

  const exact = weights.map((w) => (total * w) / weightSum);
  const floors = exact.map((v) => Math.floor(v));
  let remaining = total - floors.reduce((a, b) => a + b, 0);

  // Rank by the size of the dropped fraction, biggest first.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const result = [...floors];
  for (let k = 0; remaining > 0; k = (k + 1) % order.length) {
    result[order[k].i] += 1;
    remaining -= 1;
  }

  return result;
};

/**
 * Work out what each participant owes.
 *
 * @param {number} amount     Total expense in rupees.
 * @param {string} splitType  One of SPLIT_TYPES.
 * @param {Array<{user: string, value?: number}>} participants
 *        `value` is an exact rupee amount for "exact", a percentage for
 *        "percentage", a relative weight for "shares", and ignored for "equal".
 * @returns {Array<{user: string, share: number}>} shares in rupees
 */
const computeShares = (amount, splitType, participants) => {
  if (!SPLIT_TYPES.includes(splitType)) {
    throw new Error(`Unknown split type "${splitType}"`);
  }

  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error("An expense needs at least one participant");
  }

  const totalPaise = toPaise(amount);
  if (!Number.isFinite(totalPaise) || totalPaise <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  // Guard against the same person being listed twice — otherwise they would be
  // charged twice and every balance downstream would be wrong.
  const ids = participants.map((p) => String(p.user));
  if (new Set(ids).size !== ids.length) {
    throw new Error("The same participant is listed more than once");
  }

  let sharePaise;

  if (splitType === "equal") {
    sharePaise = distributeByWeight(totalPaise, participants.map(() => 1));
  } else if (splitType === "exact") {
    sharePaise = participants.map((p, i) => {
      const v = toPaise(p.value);
      if (!Number.isFinite(v) || v < 0) {
        throw new Error(`Participant ${i + 1} has an invalid amount`);
      }
      return v;
    });

    const sum = sharePaise.reduce((a, b) => a + b, 0);
    if (sum !== totalPaise) {
      throw new Error(
        `Shares add up to ₹${toRupees(sum)} but the expense is ₹${toRupees(totalPaise)}`
      );
    }
  } else if (splitType === "percentage") {
    const percents = participants.map((p, i) => {
      const v = Number(p.value);
      if (!Number.isFinite(v) || v < 0) {
        throw new Error(`Participant ${i + 1} has an invalid percentage`);
      }
      return v;
    });

    const sum = percents.reduce((a, b) => a + b, 0);
    // Allow a hair of slack for values like 33.33 x 3.
    if (Math.abs(sum - 100) > 0.01) {
      throw new Error(`Percentages add up to ${parseFloat(sum.toFixed(2))}%, not 100%`);
    }

    sharePaise = distributeByWeight(totalPaise, percents);
  } else {
    // shares — relative weights, e.g. 2 shares vs 1 share
    const weights = participants.map((p, i) => {
      const v = Number(p.value);
      if (!Number.isFinite(v) || v < 0) {
        throw new Error(`Participant ${i + 1} has an invalid share count`);
      }
      return v;
    });

    sharePaise = distributeByWeight(totalPaise, weights);
  }

  return participants.map((p, i) => ({
    user: p.user,
    share: toRupees(sharePaise[i]),
  }));
};

module.exports = { computeShares, distributeByWeight, toPaise, toRupees, SPLIT_TYPES };
