const { toPaise, toRupees } = require("./split");

const idOf = (ref) => (ref && ref._id ? ref._id.toString() : String(ref));

/**
 * Net position per member, in rupees.
 *
 * Positive means the group owes them, negative means they owe the group. Only
 * unsettled shares count: once a participant is marked paid, that share drops
 * out of both sides of the ledger.
 *
 * Works in integer paise so a long list of thirds cannot drift.
 */
const computeBalances = (members, expenses) => {
  const balances = {};
  members.forEach((m) => {
    balances[idOf(m)] = 0; // paise
  });

  expenses.forEach((e) => {
    if (!e.participants || e.participants.length === 0) return;

    const payerId = idOf(e.paidBy);

    e.participants.forEach((p) => {
      if (p.paid) return; // already settled — nothing outstanding

      const uid = idOf(p.user);
      if (uid === payerId) return; // you never owe yourself

      const sharePaise = toPaise(p.share || 0);
      if (sharePaise === 0) return;

      if (balances[uid] !== undefined) balances[uid] -= sharePaise;
      if (balances[payerId] !== undefined) balances[payerId] += sharePaise;
    });
  });

  const asRupees = {};
  Object.entries(balances).forEach(([id, paise]) => {
    asRupees[id] = toRupees(paise);
  });

  return asRupees;
};

/**
 * Greedy settlement: match the biggest debtor against the biggest creditor
 * until everyone is square. Sorting by size keeps the number of transfers low.
 *
 * @param {Object} balances  id -> net rupees (from computeBalances)
 * @param {Object} labelById id -> display label (email or name)
 */
const computeSettlements = (balances, labelById = {}) => {
  const creditors = [];
  const debtors = [];

  Object.entries(balances).forEach(([id, rupees]) => {
    const paise = toPaise(rupees);
    if (paise > 0) creditors.push({ id, paise });
    else if (paise < 0) debtors.push({ id, paise: -paise });
  });

  creditors.sort((a, b) => b.paise - a.paise);
  debtors.sort((a, b) => b.paise - a.paise);

  const settlements = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].paise, creditors[j].paise);

    if (amount > 0) {
      settlements.push({
        fromId: debtors[i].id,
        toId: creditors[j].id,
        from: labelById[debtors[i].id] || debtors[i].id,
        to: labelById[creditors[j].id] || creditors[j].id,
        amount: toRupees(amount),
      });
    }

    debtors[i].paise -= amount;
    creditors[j].paise -= amount;

    if (debtors[i].paise === 0) i++;
    if (creditors[j].paise === 0) j++;
  }

  return settlements;
};

module.exports = { computeBalances, computeSettlements, idOf };
