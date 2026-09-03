/**
 * Client-side preview of a split.
 *
 * Mirrors backend/src/utils/split.js so the numbers on screen match what the
 * server will store. The server still validates and recomputes — this is only
 * here so the form can show shares and errors as you type.
 */

export const SPLIT_TYPES = [
  { key: "equal", label: "Equally", hint: "Split the bill evenly" },
  { key: "exact", label: "Exact ₹", hint: "Type what each person owes" },
  { key: "percentage", label: "Percent %", hint: "Split by percentage" },
  { key: "shares", label: "Shares", hint: "Split by weight, e.g. 2 : 1" },
];

const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const toRupees = (paise) => parseFloat((paise / 100).toFixed(2));

const distributeByWeight = (total, weights) => {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (total * w) / weightSum);
  const floors = exact.map((v) => Math.floor(v));
  let remaining = total - floors.reduce((a, b) => a + b, 0);

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
 * @returns {{ shares: Object<string, number>, error: string|null, summary: string }}
 *          `shares` maps participant id -> rupees owed.
 */
export const previewSplit = (amount, splitType, participants) => {
  const empty = { shares: {}, error: null, summary: "" };

  const totalPaise = toPaise(amount);
  if (!Number.isFinite(totalPaise) || totalPaise <= 0) {
    return { ...empty, error: null };
  }
  if (participants.length === 0) {
    return { ...empty, error: "Pick at least one person" };
  }

  const ids = participants.map((p) => p.user);
  const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));
  const asMap = (paiseList) =>
    Object.fromEntries(ids.map((id, i) => [id, toRupees(paiseList[i])]));

  if (splitType === "equal") {
    const paise = distributeByWeight(totalPaise, ids.map(() => 1));
    return {
      shares: asMap(paise),
      error: null,
      summary: `₹${toRupees(paise[0]).toFixed(2)} each`,
    };
  }

  if (splitType === "exact") {
    const entered = participants.map((p) => num(p.value));
    if (entered.some((v) => Number.isNaN(v))) {
      return { ...empty, error: "Enter an amount for everyone" };
    }
    if (entered.some((v) => v < 0)) {
      return { ...empty, error: "Amounts can't be negative" };
    }

    const sum = entered.reduce((a, b) => a + toPaise(b), 0);
    const diff = totalPaise - sum;

    return {
      shares: asMap(entered.map(toPaise)),
      error:
        diff === 0
          ? null
          : diff > 0
          ? `₹${toRupees(diff).toFixed(2)} left to assign`
          : `₹${toRupees(-diff).toFixed(2)} over the total`,
      summary: diff === 0 ? "Adds up ✓" : "",
    };
  }

  if (splitType === "percentage") {
    const entered = participants.map((p) => num(p.value));
    if (entered.some((v) => Number.isNaN(v))) {
      return { ...empty, error: "Enter a percentage for everyone" };
    }
    if (entered.some((v) => v < 0)) {
      return { ...empty, error: "Percentages can't be negative" };
    }

    const sum = entered.reduce((a, b) => a + b, 0);
    const ok = Math.abs(sum - 100) <= 0.01;

    return {
      shares: ok ? asMap(distributeByWeight(totalPaise, entered)) : {},
      error: ok ? null : `Adds up to ${parseFloat(sum.toFixed(2))}%, needs to be 100%`,
      summary: ok ? "Adds up to 100% ✓" : "",
    };
  }

  // shares / weights
  const entered = participants.map((p) => num(p.value));
  if (entered.some((v) => Number.isNaN(v))) {
    return { ...empty, error: "Enter a share count for everyone" };
  }
  if (entered.some((v) => v < 0)) {
    return { ...empty, error: "Share counts can't be negative" };
  }
  if (entered.reduce((a, b) => a + b, 0) <= 0) {
    return { ...empty, error: "Give at least one person a share" };
  }

  const paise = distributeByWeight(totalPaise, entered);
  return {
    shares: asMap(paise),
    error: null,
    summary: `${entered.join(" : ")} split`,
  };
};
