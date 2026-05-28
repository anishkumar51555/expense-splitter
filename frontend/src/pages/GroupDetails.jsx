import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";

function GroupDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

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
  const [activeTab, setActiveTab] = useState("expenses"); // expenses | settlements | members
  const [payModal, setPayModal] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
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

  useEffect(() => { fetchData(); }, []);

  const addExpense = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return alert("Enter a valid amount");
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

  const addMember = async () => {
  if (!memberEmail) {
    return alert("Enter email");
  }

  try {
    const res = await API.post("/groups/add-member", {
      groupId: id,
      email: memberEmail,
    });

    alert(res.data.msg);

    setMemberEmail("");

    fetchData();
  } catch (err) {
    alert(
      err.response?.data?.msg || "Error adding member"
    );
  }
};

  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${group.inviteCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  };

  const openPayModal = (expense, splitAmount) => {
    const upi = expense.paidBy?.payment?.upiId || "";
    const qr = expense.paidBy?.payment?.qrCode || null;
    const phone = expense.paidBy?.payment?.phone || "";
    const payerName = expense.paidBy?.name || expense.paidBy?.email || "them";

    if (!upi && !qr && !phone) {
      alert(`${payerName} hasn't set up a payment method yet.\nAsk them to add UPI/Phone in Payment Settings.`);
      return;
    }

    setPayModal({ expenseId: expense._id, amount: splitAmount, upiId: upi, qrCode: qr, phone, payerName });
  };

  const handleMarkPaid = async () => {
    if (!payModal) return;
    setMarkingPaid(true);
    try {
      await API.post("/expenses/pay", { expenseId: payModal.expenseId });
      setPayModal(null);
      fetchData();
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

  if (isPayer) {
    // For each participant who hasn't paid yet (excluding yourself), you are owed their share
    e.participants.forEach((p) => {
      const isMe = p.user?._id?.toString() === currentUserId?.toString();
      if (!isMe && !p.paid) {
        youAreOwed += split;
      }
    });
  } else {
    // Find my entry — if I haven't paid, I owe my share
    const my = e.participants?.find(
      (p) => p.user?._id?.toString() === currentUserId?.toString()
    );
    if (my && !my.paid) {
      youOwe += split;
    }
  }
});

  const categories = [
    { label: "🍔 Food", value: "Food" },
    { label: "✈️ Travel", value: "Travel" },
    { label: "🛍️ Shopping", value: "Shopping" },
    { label: "🎬 Entertainment", value: "Entertainment" },
    { label: "📦 Others", value: "Others" },
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">💰</div>
        <p className="text-white text-lg font-medium">Loading group...</p>
      </div>
    </div>
  );

  if (!group) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-white">Group not found.</p>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 px-4 pt-4">

      {/* ── PAYMENT MODAL ── */}
      {payModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">

            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">💸</span>
              </div>
              <h2 className="text-xl font-bold text-gray-800">Pay {payModal.payerName}</h2>
              <p className="text-gray-500 text-sm mt-1">
                Amount due: <span className="font-bold text-purple-600 text-lg">₹{payModal.amount.toFixed(2)}</span>
              </p>
            </div>

            {/* Phone */}
            {payModal.phone && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-3">
                <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">📱 Phone</p>
                <p className="font-bold text-gray-800 text-base">+91 {payModal.phone}</p>
              </div>
            )}

            {/* UPI ID */}
            {payModal.upiId && (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-3">
                <p className="text-xs text-purple-500 font-semibold uppercase tracking-wide mb-1">UPI ID</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono font-bold text-gray-800 text-base break-all">{payModal.upiId}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(payModal.upiId);
                      setCopiedUpi(true);
                      setTimeout(() => setCopiedUpi(false), 2000);
                    }}
                    className="shrink-0 text-xs bg-purple-500 text-white px-3 py-1.5 rounded-lg hover:bg-purple-600 transition font-medium"
                  >
                    {copiedUpi ? "✅" : "Copy"}
                  </button>
                </div>
              </div>
            )}

            {/* QR Code */}
            {payModal.qrCode && (
              <div className="flex flex-col items-center bg-gray-50 rounded-2xl p-4 mb-3">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">Scan QR Code</p>
                <img
                  src={payModal.qrCode}
                  alt="Payment QR"
                  className="w-44 h-44 object-contain rounded-xl border border-gray-200"
                />
              </div>
            )}

            <p className="text-xs text-center text-gray-400 mb-5">
              Send the payment, then tap "Mark as Paid" to confirm
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setPayModal(null)}
                className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={markingPaid}
                className="flex-1 py-3 rounded-2xl bg-green-500 text-white font-bold hover:bg-green-600 transition disabled:opacity-50 shadow-lg shadow-green-200"
              >
                {markingPaid ? "Saving..." : "✅ Mark as Paid"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 mb-4 shadow-xl">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition"
            >
              ←
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{group.name}</h1>
              <p className="text-white/60 text-sm">💰 Expense Group</p>
            </div>
          </div>
          <button
            onClick={copyInviteLink}
            className="bg-purple-500 text-white px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-purple-600 transition shadow"
          >
            {inviteCopied ? "✅ Copied!" : "🔗 Invite"}
          </button>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-green-500/20 border border-green-400/30 rounded-2xl p-4 text-center">
            <p className="text-green-300 text-xs font-medium mb-1">You are owed</p>
            <p className="text-green-400 text-2xl font-bold">₹{youAreOwed.toFixed(2)}</p>
          </div>
          <div className="bg-red-500/20 border border-red-400/30 rounded-2xl p-4 text-center">
            <p className="text-red-300 text-xs font-medium mb-1">You owe</p>
            <p className="text-red-400 text-2xl font-bold">₹{youOwe.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-1 mb-4">
        {[
          { key: "expenses", label: "💸 Expenses" },
          { key: "settlements", label: "🤝 Settle" },
          { key: "members", label: "👥 Members" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === tab.key
                ? "bg-purple-500 text-white shadow"
                : "text-white/60 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── EXPENSES TAB ── */}
      {activeTab === "expenses" && (
        <div>
          {/* Add Expense Card */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 mb-4 shadow-xl">
            <h2 className="text-white font-bold text-lg mb-4">➕ Add Expense</h2>

            {/* Category Pills */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {categories.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    category === c.value
                      ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                      : "bg-white/10 text-white/70 border border-white/20 hover:bg-white/20"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addExpense()}
                  placeholder="Enter amount"
                  className="w-full bg-white text-gray-800 pl-8 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-400 font-medium placeholder-gray-400"
                />
              </div>
              <button
                onClick={addExpense}
                disabled={addingExpense}
                className="bg-purple-500 text-white px-6 py-3 rounded-2xl font-bold hover:bg-purple-600 transition disabled:opacity-50 shadow-lg shadow-purple-500/30"
              >
                {addingExpense ? "..." : "Add"}
              </button>
            </div>
          </div>

          {/* Expense List */}
          {expenses.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">🧾</div>
              <p className="text-white/60 text-lg">No expenses yet</p>
              <p className="text-white/40 text-sm">Add your first expense above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map((e) => {
                const split = e.participants?.length ? e.amount / e.participants.length : 0;
                const isPaidByMe = e.paidBy?._id?.toString() === currentUserId?.toString();

                return (
                  <div key={e._id} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-lg overflow-hidden">
                    {/* Expense Header */}
                    <div className="p-4 border-b border-white/20">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center text-lg">
                            {e.description === "Food" ? "🍔" :
                             e.description === "Travel" ? "✈️" :
                             e.description === "Shopping" ? "🛍️" :
                             e.description === "Entertainment" ? "🎬" : "💸"}
                          </div>
                          <div>
                            <p className="font-bold text-white">{e.description}</p>
                            <p className="text-xs text-white/50">
                                Paid by <span className="font-semibold text-purple-300">
                                {isPaidByMe ? "You" : (e.paidBy?.name || e.paidBy?.email)}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white text-lg">₹{e.amount}</p>
                          <p className="text-xs text-white/40">₹{split.toFixed(2)}/person</p>
                        </div>
                      </div>
                    </div>

                    {/* Participants */}
                    <div className="p-4 space-y-2 bg-white/5">
                      {e.participants.map((p) => {
                        const isExpensePayer = p.user?._id?.toString() === e.paidBy?._id?.toString();
                        const isMe = p.user?._id?.toString() === currentUserId?.toString();

                        return (
                          <div key={p._id} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-purple-500/40 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                {(p.user?.name || p.user?.email || "?")[0].toUpperCase()}
                              </div>
                              <span className="text-sm text-white/80 font-medium">
                                {isMe ? "You" : (p.user?.name || p.user?.email)}
                              </span>
                            </div>

                            {isExpensePayer ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                                Paid ✓
                              </span>
                            ) : p.paid ? (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                                Settled ✓
                              </span>
                            ) : isMe ? (
                              <button
                                onClick={() => openPayModal(e, split)}
                                className="text-xs bg-purple-500 text-white px-3 py-1.5 rounded-full font-bold hover:bg-purple-600 transition shadow"
                              >
                                Pay ₹{split.toFixed(2)}
                              </button>
                            ) : (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">
                                Owes ₹{split.toFixed(2)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SETTLEMENTS TAB ── */}
      {activeTab === "settlements" && (
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 shadow-xl">
          <h2 className="text-white font-bold text-lg mb-4">🤝 Who Owes Whom</h2>
          {settlements.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-3">🎉</div>
              <p className="text-white font-semibold text-lg">All settled up!</p>
              <p className="text-white/50 text-sm mt-1">No pending payments</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settlements
  .filter((s) => {
    // Only show settlements involving current user's email
    const myEmail = group.members.find(
      (m) => m._id.toString() === currentUserId
    )?.email;
    return s.from === myEmail || s.to === myEmail;
  })
  .map((s, i) => {
    const myEmail = group.members.find(
      (m) => m._id.toString() === currentUserId
    )?.email;
    const iOwe = s.from === myEmail;

    return (
      <div key={i} className="bg-white/10 border border-white/20 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
            iOwe ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"
          }`}>
            {iOwe ? s.to[0].toUpperCase() : s.from[0].toUpperCase()}
          </div>
          <div>
            <p className="text-xs text-white/40">{iOwe ? "You owe" : "Owes you"}</p>
            <p className="font-bold text-white text-sm">{iOwe ? s.to : s.from}</p>
          </div>
        </div>
        <span className={`font-bold text-base ${iOwe ? "text-red-400" : "text-green-400"}`}>
          {iOwe ? `-₹${s.amount}` : `+₹${s.amount}`}
        </span>
      </div>
    );
  })}
            </div>
          )}
        </div>
      )}

      {/* ── MEMBERS TAB ── */}
{activeTab === "members" && (
  <div className="space-y-3">

    {/* Add Member Card */}
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 shadow-xl">
      <h2 className="text-white font-bold text-lg mb-4">➕ Add Member</h2>
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="Enter registered email"
          value={memberEmail}
          onChange={(e) => setMemberEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addMember()}
          className="flex-1 bg-white text-gray-800 placeholder-gray-400 px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <button
          onClick={addMember}
          className="bg-purple-500 text-white px-5 py-3 rounded-2xl font-bold hover:bg-purple-600 transition shadow-lg shadow-purple-500/30"
        >
          Add
        </button>
      </div>
    </div>
          {group.members.map((m) => (
            <div key={m._id} className="bg-white rounded-3xl p-4 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {(m.name || m.email || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-800">{m.name || m.email}</p>
                  <p className="text-xs text-gray-500">{m.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                {m.payment?.phone && (
                  <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
                    <span className="text-blue-500">📱</span>
                    <span className="text-sm text-blue-700 font-medium">+91 {m.payment.phone}</span>
                  </div>
                )}
                {m.payment?.upiId ? (
                  <div className="flex items-center gap-2 bg-purple-50 rounded-xl px-3 py-2">
                    <span className="text-purple-500">💳</span>
                    <span className="text-sm text-purple-700 font-medium font-mono">{m.payment.upiId}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <span className="text-gray-400">💳</span>
                    <span className="text-sm text-gray-400">No UPI set</span>
                  </div>
                )}
                {m.payment?.qrCode && (
                  <div className="mt-2">
                    <img src={m.payment.qrCode} alt="QR" className="w-20 h-20 object-contain rounded-xl border border-gray-200" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GroupDetails;