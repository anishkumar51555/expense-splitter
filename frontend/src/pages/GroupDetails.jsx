import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../api/api";

function GroupDetails() {
  const { id } = useParams();

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [addingExpense, setAddingExpense] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Payment modal state
  const [payModal, setPayModal] = useState(null);
  // payModal = { expenseId, amount, upiId, qrCode, payerName }
  const [markingPaid, setMarkingPaid] = useState(false);

  const fetchData = async () => {
    try {
      const res = await API.get(`/groups/${id}`);
      setGroup(res.data.group);
      setExpenses(res.data.expenses);
      setSettlements(res.data.settlements || []);
      setCurrentUserId(res.data.currentUserId);
    } catch {
      alert("Error loading group");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addExpense = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return alert("Invalid amount");

    setAddingExpense(true);
    try {
      await API.post("/expenses/add", {
        groupId: id,
        amount: parsed,
        description: category || "Expense",
      });
      setAmount("");
      setCategory("");
      fetchData();
    } catch {
      alert("Error adding expense");
    } finally {
      setAddingExpense(false);
    }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${group.inviteCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  };

  // Open the payment modal with payer's UPI details
  const openPayModal = (expense, splitAmount) => {
    const upi = expense.paidBy?.payment?.upiId || "";
    const qr = expense.paidBy?.payment?.qrCode || null;
    const payerName = expense.paidBy?.name || expense.paidBy?.email || "them";

    if (!upi && !qr) {
      alert(`${payerName} has not set up a payment method yet.\nAsk them to add their UPI ID in Payment Settings.`);
      return;
    }

    setPayModal({
      expenseId: expense._id,
      amount: splitAmount,
      upiId: upi,
      qrCode: qr,
      payerName,
    });
  };

  // Mark as paid — calls backend then refreshes
  const handleMarkPaid = async () => {
    if (!payModal) return;
    setMarkingPaid(true);
    try {
      await API.post("/expenses/pay", { expenseId: payModal.expenseId });
      setPayModal(null);
      fetchData(); // refresh so the expense shows "Settled"
    } catch {
      alert("Failed to mark as paid. Please try again.");
    } finally {
      setMarkingPaid(false);
    }
  };

  // Balance summary
  let youOwe = 0;
  let youAreOwed = 0;

  expenses.forEach((e) => {
    const split = e.participants?.length ? e.amount / e.participants.length : 0;
    const isPayer = e.paidBy?._id?.toString() === currentUserId?.toString();
    const my = e.participants?.find(
      (p) => p.user?._id?.toString() === currentUserId?.toString()
    );

    if (!my) return;
    if (isPayer) youAreOwed += e.amount - split;
    else if (!my.paid) youOwe += split;
  });

  if (loading || !group) return <p className="p-6 text-black">Loading...</p>;

  const categories = ["Food", "Travel", "Shopping", "Entertainment", "Others"];

  return (
    <div className="min-h-screen bg-gray-100 p-6 pb-20 text-black">

      {/* ── PAYMENT MODAL ── */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">

            {/* Title */}
            <h2 className="text-xl font-bold text-gray-800 mb-1">
              Pay {payModal.payerName}
            </h2>
            <p className="text-gray-500 text-sm mb-5">
              Send <span className="font-semibold text-gray-800">₹{payModal.amount.toFixed(2)}</span> using any of the methods below
            </p>

            {/* UPI ID */}
            {payModal.upiId && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
                <p className="text-xs text-purple-500 font-semibold uppercase tracking-wide mb-1">UPI ID</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono font-bold text-gray-800 text-base break-all">{payModal.upiId}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(payModal.upiId);
                    }}
                    className="shrink-0 text-xs bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* QR Code */}
            {payModal.qrCode && (
              <div className="flex flex-col items-center mb-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Scan QR Code</p>
                <img
                  src={payModal.qrCode}
                  alt="Payment QR"
                  className="w-48 h-48 object-contain border-2 border-gray-200 rounded-xl"
                />
              </div>
            )}

            <p className="text-xs text-center text-gray-400 mb-5">
              After sending the payment, tap "Mark as Paid" to confirm.
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setPayModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={markingPaid}
                className="flex-1 py-2.5 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition disabled:opacity-50"
              >
                {markingPaid ? "Saving..." : "✅ Mark as Paid"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <p
              className="text-gray-600 cursor-pointer hover:text-purple-600"
              onClick={() => setShowMembers(!showMembers)}
            >
              👥 {group.members?.length} members
            </p>
          </div>
          <button
            onClick={copyInviteLink}
            className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-sm hover:bg-purple-200 transition"
          >
            {inviteCopied ? "✅ Copied!" : "🔗 Invite Link"}
          </button>
        </div>

        {showMembers && (
          <div className="mt-3 space-y-2">
            {group.members.map((m) => (
              <div key={m._id} className="bg-gray-50 p-3 rounded">
                <p className="font-medium">{m.name || m.email}</p>
                <p className="text-sm text-gray-500">{m.email}</p>
                {m.payment?.upiId ? (
                  <p className="text-sm text-gray-600">UPI: {m.payment.upiId}</p>
                ) : (
                  <p className="text-sm text-red-400">No UPI set</p>
                )}
                {m.payment?.qrCode && (
                  <img src={m.payment.qrCode} alt="QR" className="w-20 mt-2 rounded" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BALANCE SUMMARY */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-green-100 p-4 rounded-xl text-center">
          <p className="text-gray-600 text-sm">You are owed</p>
          <h2 className="text-2xl font-bold text-green-700">₹{youAreOwed.toFixed(2)}</h2>
        </div>
        <div className="bg-red-100 p-4 rounded-xl text-center">
          <p className="text-gray-600 text-sm">You owe</p>
          <h2 className="text-2xl font-bold text-red-700">₹{youOwe.toFixed(2)}</h2>
        </div>
      </div>

      {/* WHO OWES WHOM */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="font-bold mb-3">Who owes whom</h2>
        {settlements.length === 0 ? (
          <p className="text-green-600">All settled up 🎉</p>
        ) : (
          settlements.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <p>
                <span className="font-medium">{s.from}</span>
                <span className="text-gray-400 mx-2">→</span>
                <span className="font-medium">{s.to}</span>
              </p>
              <span className="font-bold text-red-600">₹{s.amount}</span>
            </div>
          ))
        )}
      </div>

      {/* ADD EXPENSE */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="font-bold mb-3">Add Expense</h2>
        <div className="flex gap-2 mb-3 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1 rounded-full text-sm ${
                category === c ? "bg-purple-500 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (₹)"
            className="border p-2 rounded flex-1 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            onClick={addExpense}
            disabled={addingExpense}
            className="bg-purple-500 text-white px-4 rounded hover:bg-purple-600 disabled:opacity-50"
          >
            {addingExpense ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      {/* EXPENSES LIST */}
      {expenses.length === 0 ? (
        <p className="text-center text-gray-500">No expenses yet. Add one above!</p>
      ) : (
        expenses.map((e) => {
          const split = e.participants?.length ? e.amount / e.participants.length : 0;

          return (
            <div key={e._id} className="bg-white p-4 rounded-xl shadow mb-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold">{e.description}</p>
                  <p className="text-gray-700">₹{e.amount}</p>
                  <p className="text-sm text-gray-500">
                    Paid by: {e.paidBy?.name || e.paidBy?.email}
                  </p>
                </div>
                <div className="text-sm text-gray-500">₹{split.toFixed(2)} / person</div>
              </div>

              <div className="mt-3 space-y-2">
                {e.participants.map((p) => (
                  <div key={p._id} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">{p.user?.name || p.user?.email}</span>

                    {/* Payer themselves */}
                    {p.user?._id?.toString() === e.paidBy?._id?.toString() ? (
                      <span className="text-green-600 font-semibold">Paid ✓</span>

                    ) : p.paid ? (
                      /* Already settled */
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Settled ✓
                      </span>

                    ) : p.user?._id?.toString() === currentUserId?.toString() ? (
                      /* Current user owes — show Pay button */
                      <button
                        onClick={() => openPayModal(e, split)}
                        className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 font-medium transition"
                      >
                        Pay ₹{split.toFixed(2)}
                      </button>

                    ) : (
                      /* Someone else owes */
                      <span className="text-red-500">Owes ₹{split.toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default GroupDetails;
