import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import { landingRoute } from "../utils/pendingInvite";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Shown when the account exists but hasn't clicked its verification link.
  const [unverified, setUnverified] = useState(null);
  const [resendState, setResendState] = useState("idle");

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotState, setForgotState] = useState("idle");
  const [forgotMsg, setForgotMsg] = useState("");

  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) return setError("Please fill all fields");

    setLoading(true);
    setError("");
    setUnverified(null);

    try {
      const res = await API.post("/auth/login", { email, password });
      localStorage.setItem("token", res.data.token);

      const decoded = JSON.parse(atob(res.data.token.split(".")[1]));
      navigate(landingRoute(decoded.paymentSetup));
    } catch (err) {
      if (err.response?.data?.needsVerification) {
        setUnverified(err.response.data.email || email);
        setResendState("idle");
      } else {
        setError(err.response?.data?.msg || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendState("sending");
    try {
      await API.post("/auth/resend-verification", { email: unverified });
    } catch {
      // The endpoint answers the same either way; nothing useful to show.
    }
    setResendState("sent");
  };

  const handleForgot = async () => {
    if (!forgotEmail.trim()) return setForgotMsg("Enter your email");

    setForgotState("sending");
    setForgotMsg("");

    try {
      const res = await API.post("/auth/forgot-password", { email: forgotEmail.trim() });
      setForgotMsg(res.data.msg);
      setForgotState("sent");
    } catch (err) {
      setForgotMsg(err.response?.data?.msg || "Something went wrong");
      setForgotState("idle");
    }
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotEmail("");
    setForgotMsg("");
    setForgotState("idle");
  };

  return (
    // FIX: full screen flex center so card is always in the middle
    <div className="min-h-screen flex items-center justify-center px-4">

      {/* Login Card — glass style matching rest of app */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl w-full max-w-md p-8">

        <div className="text-center mb-8">
          <div className="text-5xl mb-3">💸</div>
          <h1 className="text-3xl font-bold text-white">Splitwise</h1>
          <p className="text-white/50 mt-1">Sign in to manage expenses</p>
        </div>

        {/* FIX: inputs have bg-white text-gray-800 so typed text is visible */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white text-gray-800 placeholder-gray-400 px-4 py-3 rounded-2xl mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="w-full bg-white text-gray-800 placeholder-gray-400 px-4 py-3 rounded-2xl mb-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />

        <div className="text-right mb-4">
          <button
            onClick={() => setShowForgot(true)}
            className="text-sm text-purple-300 hover:text-purple-200 hover:underline"
          >
            Forgot password?
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-400/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* Unverified account — offer a resend rather than a dead end */}
        {unverified && (
          <div className="mb-4 bg-amber-500/10 border border-amber-400/30 rounded-2xl p-4">
            <p className="text-amber-200 text-sm font-semibold mb-1">📬 Verify your email first</p>
            <p className="text-amber-100/70 text-xs mb-3">
              We sent a link to <span className="font-medium">{unverified}</span>. Click it to
              activate your account.
            </p>
            {resendState === "sent" ? (
              <p className="text-green-400 text-xs">✅ A new link is on its way.</p>
            ) : (
              <button
                onClick={handleResendVerification}
                disabled={resendState === "sending"}
                className="text-xs bg-amber-500 text-white px-3 py-2 rounded-xl font-bold hover:bg-amber-600 transition disabled:opacity-50"
              >
                {resendState === "sending" ? "Sending…" : "Resend verification email"}
              </button>
            )}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-purple-500 text-white py-3.5 rounded-2xl font-bold text-lg hover:bg-purple-600 transition disabled:opacity-50 shadow-lg shadow-purple-500/30 mb-4"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="text-center text-white/50 text-sm">
          Don't have an account?{" "}
          <span
            onClick={() => navigate("/register")}
            className="text-purple-300 font-semibold cursor-pointer hover:text-purple-200 hover:underline"
          >
            Register
          </span>
        </p>
      </div>

      {/* FORGOT PASSWORD MODAL — sends a one-time link by email */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl w-full max-w-sm p-6">

            <div className="text-center mb-5">
              <div className="text-4xl mb-2">🔐</div>
              <h2 className="text-xl font-bold text-white">Reset Password</h2>
              <p className="text-sm text-white/50 mt-1">
                {forgotState === "sent"
                  ? "Check your inbox"
                  : "We'll email you a link to set a new password"}
              </p>
            </div>

            {forgotState === "sent" ? (
              <>
                <p className="text-sm text-green-400 mb-2">✅ {forgotMsg}</p>
                <p className="text-xs text-white/40 mb-5">
                  The link expires in 1 hour and can only be used once. Remember to check
                  your spam folder.
                </p>
                <button
                  onClick={closeForgot}
                  className="w-full py-3 rounded-2xl bg-purple-500 text-white font-bold hover:bg-purple-600 transition"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <input
                  type="email"
                  placeholder="Your email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleForgot()}
                  className="w-full bg-white text-gray-800 placeholder-gray-400 px-4 py-3 rounded-2xl mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />

                {forgotMsg && <p className="text-sm text-red-400 mb-3">{forgotMsg}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={closeForgot}
                    className="flex-1 py-3 rounded-2xl border border-white/20 text-white/70 hover:bg-white/10 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleForgot}
                    disabled={forgotState === "sending"}
                    className="flex-1 py-3 rounded-2xl bg-purple-500 text-white font-bold hover:bg-purple-600 transition disabled:opacity-50"
                  >
                    {forgotState === "sending" ? "Sending…" : "Send link"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
