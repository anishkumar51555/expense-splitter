import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import API from "../api/api";
import { landingRoute } from "../utils/pendingInvite";

/**
 * Landing page for the link in the verification email.
 * On success the API hands back a session, so we log the user straight in.
 */
function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [status, setStatus] = useState(token ? "checking" : "missing");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendState, setResendState] = useState("idle");

  // React 18+ runs effects twice in dev; a verification token is single-use, so
  // guard against the second call reporting "already used".
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        const res = await API.post("/auth/verify-email", { token });
        localStorage.setItem("token", res.data.token);
        setStatus("done");

        const decoded = JSON.parse(atob(res.data.token.split(".")[1]));
        setTimeout(
          () => navigate(landingRoute(decoded.paymentSetup)),
          1600
        );
      } catch (err) {
        setMessage(err.response?.data?.msg || "We couldn't verify that link.");
        setStatus("failed");
      }
    })();
  }, [token, navigate]);

  const handleResend = async () => {
    if (!resendEmail.trim()) return;
    setResendState("sending");
    try {
      await API.post("/auth/resend-verification", { email: resendEmail.trim() });
      setResendState("sent");
    } catch {
      setResendState("sent"); // the API answers the same either way
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">

        {status === "checking" && (
          <>
            <div className="text-5xl mb-4 animate-bounce">📬</div>
            <h1 className="text-2xl font-bold text-white">Verifying your email…</h1>
            <p className="text-white/50 mt-2">This will only take a moment.</p>
          </>
        )}

        {status === "done" && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-white">Email verified!</h1>
            <p className="text-white/50 mt-2">Signing you in…</p>
          </>
        )}

        {(status === "failed" || status === "missing") && (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white">
              {status === "missing" ? "No verification token" : "Link didn't work"}
            </h1>
            <p className="text-white/60 mt-2 mb-6">
              {status === "missing"
                ? "Open the link straight from your email, or request a new one below."
                : message}
            </p>

            {resendState === "sent" ? (
              <p className="text-green-400 text-sm mb-4">
                If that address still needs verifying, a new link is on its way.
              </p>
            ) : (
              <>
                <input
                  type="email"
                  placeholder="Your email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleResend()}
                  className="w-full bg-white text-gray-800 placeholder-gray-400 px-4 py-3 rounded-2xl mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  onClick={handleResend}
                  disabled={resendState === "sending"}
                  className="w-full bg-purple-500 text-white py-3.5 rounded-2xl font-bold hover:bg-purple-600 transition disabled:opacity-50 shadow-lg shadow-purple-500/30 mb-4"
                >
                  {resendState === "sending" ? "Sending…" : "Send a new link"}
                </button>
              </>
            )}

            <Link to="/" className="text-purple-300 text-sm hover:underline">
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;
