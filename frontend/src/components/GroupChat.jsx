import { useEffect, useRef, useState } from "react";
import API from "../api/api";

const POLL_MS = 3000;

/**
 * Group chat.
 *
 * Mounted only while its tab is open, so the poll starts and stops with the
 * tab. Each poll asks for messages newer than the last one held, which keeps a
 * quiet group to one small empty response per interval.
 */
function GroupChat({ groupId, currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const bottomRef = useRef(null);
  // Read inside the interval, so the callback never closes over a stale list.
  const lastAtRef = useRef(null);

  const absorb = (incoming) => {
    if (!incoming?.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m._id));
      const fresh = incoming.filter((m) => !seen.has(m._id));
      if (!fresh.length) return prev;
      return [...prev, ...fresh];
    });
    lastAtRef.current = incoming[incoming.length - 1].createdAt;
  };

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const since = lastAtRef.current;
        const res = await API.get(
          `/messages/${groupId}${since ? `?since=${encodeURIComponent(since)}` : ""}`
        );
        if (active) {
          absorb(res.data.messages);
          setError("");
          // Anything delivered while the tab is open has been seen. Only worth
          // saying when something actually arrived.
          if (res.data.messages?.length) {
            API.post(`/messages/${groupId}/read`).catch(() => {});
          }
        }
      } catch {
        // A dropped poll is not worth showing; the next one will catch up.
      } finally {
        if (active) setLoading(false);
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [groupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    setError("");
    try {
      const res = await API.post(`/messages/${groupId}`, { text: body });
      absorb([res.data.message]);
      setText("");
    } catch (err) {
      setError(err.response?.data?.msg || "Could not send. Try again.");
    } finally {
      setSending(false);
    }
  };

  const timeOf = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-4 shadow-xl">
      <div className="h-[22rem] overflow-y-auto pr-1 flex flex-col gap-3">
        {loading && <p className="text-white/50 text-sm text-center my-auto">Loading messages…</p>}

        {!loading && messages.length === 0 && (
          <div className="text-center my-auto">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-white/60 font-medium">No messages yet</p>
            <p className="text-white/40 text-sm mt-1">
              Ask what an expense was for, or agree who pays next.
            </p>
          </div>
        )}

        {messages.map((m) => {
          const mine = m.sender?._id === currentUserId;
          return (
            <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  mine ? "bg-purple-500 text-white" : "bg-white/15 text-white"
                }`}
              >
                {!mine && (
                  <p className="text-xs font-semibold text-purple-200 mb-0.5">
                    {m.sender?.name || "Someone"}
                  </p>
                )}
                <p className="text-sm break-words whitespace-pre-wrap">{m.text}</p>
                <p className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-white/40"}`}>
                  {timeOf(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="text-red-300 text-xs bg-red-500/10 border border-red-400/20 rounded-xl px-3 py-2 mt-3">
          {error}
        </p>
      )}

      <form onSubmit={handleSend} className="flex gap-2 mt-3">
        <input
          type="text"
          value={text}
          maxLength={2000}
          placeholder="Message the group…"
          className="flex-1 bg-white text-gray-800 placeholder-gray-400 px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-400"
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="px-5 py-3 rounded-2xl bg-purple-500 text-white font-bold hover:bg-purple-600 transition disabled:opacity-40"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}

export default GroupChat;
