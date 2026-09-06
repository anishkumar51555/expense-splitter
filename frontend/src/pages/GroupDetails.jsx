import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";
import GroupChat from "../components/GroupChat";
import { previewSplit, SPLIT_TYPES } from "../utils/split";

const CATEGORIES = [
  { label: "🍔 Food", value: "Food" },
  { label: "✈️ Travel", value: "Travel" },
  { label: "🛍️ Shopping", value: "Shopping" },
  { label: "🎬 Entertainment", value: "Entertainment" },
  { label: "📦 Others", value: "Others" },
];

const ICONS = {
  Food: "🍔",
  Travel: "✈️",
  Shopping: "🛍️",
  Entertainment: "🎬",
};

const SPLIT_BADGE = {
  equal: "Split equally",
  exact: "Custom amounts",
  percentage: "By percentage",
  shares: "By shares",
};

const nameOf = (u) => u?.name || u?.email || "Unknown";
const idOf = (u) => (u?._id || u || "").toString();

function GroupDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);

  // ── Add-expense form ──
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [splitType, setSplitType] = useState("equal");
  const [selected, setSelected] = useState([]); // member ids taking part
  const [values, setValues] = useState({}); // member id -> raw input
  const [addingExpense, setAddingExpense] = useState(false);
  const [formError, setFormError] = useState("");

  const [activeTab, setActiveTab] = useState("expenses");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [unread, setUnread] = useState(0);

  const fetchData = async () => {
    try {
      const res = await API.get(`/groups/${id}`);
      setGroup(res.data.group);
      setExpenses(res.data.expenses);
      setSettlements(res.data.settlements || []);
      setCurrentUserId(res.data.currentUserId);

      // Default the split to everyone in the group.
      setSelected((prev) =>
        prev.length ? prev : res.data.group.members.map((m) => idOf(m))
      );
    } catch {
      alert("Error loading group");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const me = useMemo(
    () => group?.members.find((m) => idOf(m) === currentUserId),
    [group, currentUserId]
  );

  // ── Live split preview ──
  const participantsForPreview = useMemo(
    () => selected.map((uid) => ({ user: uid, value: values[uid] })),
    [selected, values]
  );

  const preview = useMemo(
    () => previewSplit(amount, splitType, participantsForPreview),
    [amount, splitType, participantsForPreview]
  );

  const toggleMember = (uid) => {
    setFormError("");
    setSelected((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  };

  const setValue = (uid, v) => {
    setFormError("");
    setValues((prev) => ({ ...prev, [uid]: v }));
  };

  /** Fill the remaining amount/percentage into the person you're editing. */
  const splitTheRest = (uid) => {
    const target = splitType === "percentage" ? 100 : parseFloat(amount);
    if (!target) return;

    const others = selected
      .filter((x) => x !== uid)
      .reduce((sum, x) => sum + (parseFloat(values[x]) || 0), 0);

    const rest = parseFloat((target - others).toFixed(2));
    if (rest >= 0) setValue(uid, String(rest));
  };

  const resetForm = () => {
    setAmount("");
    setCategory("");
    setValues({});
    setSplitType("equal");
    setSelected(group ? group.members.map((m) => idOf(m)) : []);
    setFormError("");
  };

  const addExpense = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return setFormError("Enter a valid amount");
    if (selected.length === 0) return setFormError("Pick at least one person");
    if (preview.error) return setFormError(preview.error);

    setAddingExpense(true);
    setFormError("");

    try {
      await API.post("/expenses/add", {
        groupId: id,
        amount: parsed,
        description: category || "Expense",
        splitType,
        participants: selected.map((uid) => ({
          user: uid,
          value: splitType === "equal" ? undefined : Number(values[uid]),
        })),
      });
      resetForm();
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.msg || "Error adding expense");
    } finally {
      setAddingExpense(false);
    }
  };

  const addMember = async () => {
    if (!memberEmail) return alert("Enter email");

    try {
      const res = await API.post("/groups/add-member", {
        groupId: id,
        email: memberEmail,
      });
      alert(res.data.msg);
      setMemberEmail("");
      fetchData();
    } catch (err) {
      alert(err.response?.data?.msg || "Error adding member");
    }
  };

  // Watch for messages only while the chat tab is closed; with it open,
  // GroupChat is already polling and marking them read.
  useEffect(() => {
    if (activeTab === "chat") {
      setUnread(0);
      return;
    }

    let active = true;
    const check = async () => {
      try {
        const res = await API.get(`/messages/${id}/unread`);
        if (active) setUnread(res.data.count || 0);
      } catch {
        // A dropped check is not worth surfacing; the next one will catch up.
      }
    };

    check();
    const timer = setInterval(check, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [activeTab, id]);

  const copyInviteLink = () => {
    // Belt and braces: the server issues a code on read, so this should not
    // happen — but copying "/join/undefined" is worse than saying so.
    if (!group?.inviteCode) {
      alert("This group has no invite link yet. Reload the page and try again.");
      return;
    }
    const link = `${window.location.origin}/join/${group.inviteCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  };

  const openPayModal = (expense, share) => {
    setPayModal({
      expenseId: expense._id,
      amount: share,
      upiId: expense.paidBy?.payment?.upiId || "",
      qrCode: expense.paidBy?.payment?.qrCode || null,
      phone: expense.paidBy?.payment?.phone || "",
      payerName: nameOf(expense.paidBy),
      error: "",
    });
  };

  const handleMarkPaid = async () => {
    setMarkingPaid(true);
    try {
      await API.post("/expenses/pay", { expenseId: payModal.expenseId });
      setPayModal(null);
      fetchData();
    } catch (err) {
      setPayModal((prev) => ({
        ...prev,
        error: err.response?.data?.msg || "Failed to mark as paid.",
      }));
    } finally {
      setMarkingPaid(false);
    }
  };

  // ── Balance summary, from each participant's own share ──
  const { youOwe, youAreOwed } = useMemo(() => {
    let owe = 0;
    let owed = 0;

    expenses.forEach((e) => {
      const isPayer = idOf(e.paidBy) === currentUserId;

      e.participants?.forEach((p) => {
        if (p.paid) return;
        const isMe = idOf(p.user) === currentUserId;

        if (isPayer && !isMe) owed += p.share || 0;
        else if (!isPayer && isMe) owe += p.share || 0;
      });
    });

    return { youOwe: owe, youAreOwed: owed };
  }, [expenses, currentUserId]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">💰</div>
          <p className="text-white text-lg font-medium">Loading group...</p>
        </div>
      </div>
    );

  if (!group)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white">Group not found.</p>
      </div>
    );

  const unitFor = (type) => (type === "percentage" ? "%" : type === "shares" ? "×" : "₹");

  return (
    <div className="min-h-screen pb-24 px-4 pt-4">

      {/* ── PAYMENT MODAL ── */}
      {payModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 my-auto">

            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">💸</span>
              </div>
              <h2 className="text-xl font-bold text-gray-800">Pay {payModal.payerName}</h2>
              <p className="text-gray-500 text-sm mt-1">
                Your share:{" "}
                <span className="font-bold text-purple-600 text-lg">
                  ₹{payModal.amount.toFixed(2)}
                </span>
              </p>
            </div>

            {payModal.error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                {payModal.error}
              </p>
            )}

            {/* Direct transfer details */}
            {payModal.phone && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-3">
                <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">📱 Phone</p>
                <p className="font-bold text-gray-800 text-base">+91 {payModal.phone}</p>
              </div>
            )}

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

            {!payModal.upiId && !payModal.qrCode && !payModal.phone && (
              <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 mb-3">
                {payModal.payerName} hasn't added UPI or phone details yet. Settle however
                suits you both, then mark it paid.
              </p>
            )}

            <p className="text-xs text-center text-gray-400 mb-4">
              Pay {payModal.payerName} using the details above, then record it below.
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
          { key: "chat", label: "💬 Chat" },
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
            <span className="relative inline-flex items-center">
              {tab.label}
              {tab.key === "chat" && unread > 0 && (
                <span
                  className="absolute -top-1 -right-2.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-black/40"
                  aria-label={`${unread} unread message${unread === 1 ? "" : "s"}`}
                />
              )}
            </span>
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
              {CATEGORIES.map((c) => (
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

            {/* Amount */}
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setFormError("");
                }}
                placeholder="Enter total amount"
                className="w-full bg-white text-gray-800 pl-8 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-400 font-medium placeholder-gray-400"
              />
            </div>

            {/* Split type selector */}
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">
              How to split
            </p>
            <div className="grid grid-cols-4 gap-1.5 bg-white/5 border border-white/10 rounded-2xl p-1.5 mb-1">
              {SPLIT_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setSplitType(t.key);
                    setValues({});
                    setFormError("");
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition ${
                    splitType === t.key
                      ? "bg-purple-500 text-white shadow"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-white/40 text-xs mb-4">
              {SPLIT_TYPES.find((t) => t.key === splitType)?.hint}
            </p>

            {/* Participants */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                Who's involved ({selected.length}/{group.members.length})
              </p>
              <button
                onClick={() =>
                  setSelected(
                    selected.length === group.members.length
                      ? []
                      : group.members.map((m) => idOf(m))
                  )
                }
                className="text-purple-300 text-xs hover:underline"
              >
                {selected.length === group.members.length ? "Clear all" : "Select all"}
              </button>
            </div>

            <div className="space-y-2 mb-3">
              {group.members.map((m) => {
                const uid = idOf(m);
                const isIn = selected.includes(uid);
                const share = preview.shares[uid];

                return (
                  <div
                    key={uid}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 border transition ${
                      isIn
                        ? "bg-white/10 border-white/20"
                        : "bg-white/5 border-transparent opacity-50"
                    }`}
                  >
                    <button
                      onClick={() => toggleMember(uid)}
                      className={`w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center text-xs font-bold transition ${
                        isIn
                          ? "bg-purple-500 border-purple-500 text-white"
                          : "border-white/30 text-transparent"
                      }`}
                      aria-label={isIn ? `Remove ${nameOf(m)}` : `Add ${nameOf(m)}`}
                    >
                      ✓
                    </button>

                    <div className="w-7 h-7 shrink-0 bg-purple-500/40 rounded-full flex items-center justify-center text-xs font-bold text-white">
                      {nameOf(m)[0].toUpperCase()}
                    </div>

                    <span className="flex-1 text-sm text-white/85 font-medium truncate">
                      {uid === currentUserId ? "You" : nameOf(m)}
                    </span>

                    {/* Per-person input for the unequal modes */}
                    {isIn && splitType !== "equal" && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">
                            {unitFor(splitType)}
                          </span>
                          <input
                            type="number"
                            value={values[uid] ?? ""}
                            onChange={(e) => setValue(uid, e.target.value)}
                            placeholder="0"
                            className="w-20 bg-white text-gray-800 text-sm pl-5 pr-2 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-right"
                          />
                        </div>
                        {splitType !== "shares" && (
                          <button
                            onClick={() => splitTheRest(uid)}
                            title="Assign the remainder to this person"
                            className="text-[10px] text-purple-300 hover:text-purple-200 font-bold px-1"
                          >
                            REST
                          </button>
                        )}
                      </div>
                    )}

                    {/* Resulting share */}
                    {isIn && share !== undefined && (
                      <span className="text-xs font-bold text-green-300 shrink-0 w-16 text-right">
                        ₹{share.toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Live validation */}
            {(preview.error || preview.summary || formError) && (
              <p
                className={`text-xs mb-3 px-3 py-2 rounded-xl border ${
                  formError || preview.error
                    ? "text-red-300 bg-red-500/10 border-red-400/20"
                    : "text-green-300 bg-green-500/10 border-green-400/20"
                }`}
              >
                {formError || preview.error || preview.summary}
              </p>
            )}

            <button
              onClick={addExpense}
              disabled={addingExpense || !!preview.error || selected.length === 0}
              className="w-full bg-purple-500 text-white py-3 rounded-2xl font-bold hover:bg-purple-600 transition disabled:opacity-40 shadow-lg shadow-purple-500/30"
            >
              {addingExpense ? "Adding..." : "Add Expense"}
            </button>
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
                const isPaidByMe = idOf(e.paidBy) === currentUserId;
                const type = e.splitType || "equal";

                return (
                  <div
                    key={e._id}
                    className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-lg overflow-hidden"
                  >
                    {/* Expense Header */}
                    <div className="p-4 border-b border-white/20">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center text-lg">
                            {ICONS[e.description] || "💸"}
                          </div>
                          <div>
                            <p className="font-bold text-white">{e.description}</p>
                            <p className="text-xs text-white/50">
                              Paid by{" "}
                              <span className="font-semibold text-purple-300">
                                {isPaidByMe ? "You" : nameOf(e.paidBy)}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white text-lg">₹{e.amount}</p>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              type === "equal"
                                ? "bg-white/10 text-white/50"
                                : "bg-amber-400/20 text-amber-200"
                            }`}
                          >
                            {SPLIT_BADGE[type]}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Participants — each with their own share */}
                    <div className="p-4 space-y-2 bg-white/5">
                      {e.participants.map((p) => {
                        const isExpensePayer = idOf(p.user) === idOf(e.paidBy);
                        const isMe = idOf(p.user) === currentUserId;
                        const share = p.share || 0;

                        return (
                          <div key={p._id} className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 shrink-0 bg-purple-500/40 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                {nameOf(p.user)[0].toUpperCase()}
                              </div>
                              <span className="text-sm text-white/80 font-medium truncate">
                                {isMe ? "You" : nameOf(p.user)}
                              </span>
                              <span className="text-xs text-white/40 shrink-0">
                                ₹{share.toFixed(2)}
                              </span>
                            </div>

                            {isExpensePayer ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold shrink-0">
                                Paid ✓
                              </span>
                            ) : p.paid ? (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold shrink-0">
                                Settled ✓
                              </span>
                            ) : isMe ? (
                              <button
                                onClick={() => openPayModal(e, share)}
                                className="text-xs bg-purple-500 text-white px-3 py-1.5 rounded-full font-bold hover:bg-purple-600 transition shadow shrink-0"
                              >
                                Pay ₹{share.toFixed(2)}
                              </button>
                            ) : (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium shrink-0">
                                Owes ₹{share.toFixed(2)}
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

          {(() => {
            const mine = settlements.filter(
              (s) => s.fromId === currentUserId || s.toId === currentUserId
            );

            if (mine.length === 0)
              return (
                <div className="text-center py-10">
                  <div className="text-5xl mb-3">🎉</div>
                  <p className="text-white font-semibold text-lg">All settled up!</p>
                  <p className="text-white/50 text-sm mt-1">No pending payments</p>
                </div>
              );

            return (
              <div className="space-y-3">
                {mine.map((s, i) => {
                  const iOwe = s.fromId === currentUserId;
                  const other = iOwe ? s.to : s.from;

                  return (
                    <div
                      key={i}
                      className="bg-white/10 border border-white/20 rounded-2xl p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                            iOwe
                              ? "bg-red-500/20 text-red-300"
                              : "bg-green-500/20 text-green-300"
                          }`}
                        >
                          {other[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-white/40">{iOwe ? "You owe" : "Owes you"}</p>
                          <p className="font-bold text-white text-sm truncate">{other}</p>
                        </div>
                      </div>
                      <span
                        className={`font-bold text-base shrink-0 ${
                          iOwe ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {iOwe ? `-₹${s.amount}` : `+₹${s.amount}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── MEMBERS TAB ── */}
      {/* ── CHAT TAB ── */}
      {activeTab === "chat" && (
        <GroupChat groupId={id} currentUserId={currentUserId} />
      )}

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
                  {nameOf(m)[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-800">{nameOf(m)}</p>
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
                    <span className="text-sm text-purple-700 font-medium font-mono">
                      {m.payment.upiId}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <span className="text-gray-400">💳</span>
                    <span className="text-sm text-gray-400">No UPI set</span>
                  </div>
                )}
                {m.payment?.qrCode && (
                  <div className="mt-2">
                    <img
                      src={m.payment.qrCode}
                      alt="QR"
                      className="w-20 h-20 object-contain rounded-xl border border-gray-200"
                    />
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
