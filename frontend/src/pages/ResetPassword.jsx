import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import API from "../api/api";

/**
 * Landing page for the link in the password-reset email. The token is checked
 * before the form is shown, so an expired link says so up front.
 */
function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [state, setState] = useState(token ? "checking" : "invalid");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const res = await API.post("/auth/verify-reset-token", { token });
        setEmail(res.data.email);
        setState("ready");
      } catch {
        setState("invalid");
      }
    })();
  }, [token]);

  const handleSubmit = async () => {
    setError("");

    if (!password || !confirm) return setError("Please fill both fields");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirm) return setError("Passwords do not match");

    setSaving(true);
    try {
      await API.post("/auth/reset-password", { token, newPassword: password });
      setState("done");
      setTimeout(() => navigate("/"), 1800);
    } catch (err) {
      setError(err.response?.data?.msg || "Something went wrong");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl w-full max-w-md p-8">

        {state === "checking" && (
          <div className="text-center">
            <div className="text-5xl mb-4 animate-bounce">🔐</div>
            <p className="text-white">Checking your link…</p>
          </div>
        )}

        {state === "invalid" && (
          <div className="text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white">Link expired</h1>
            <p className="text-white/60 mt-2 mb-6">
              Reset links last one hour and can only be used once. Request a fresh one from
              the login screen.
            </p>
            <Link
              to="/"
              className="inline-block bg-purple-500 text-white px-6 py-3 rounded-2xl font-bold hover:bg-purple-600 transition"
            >
              Back to login
            </Link>
          </div>
        )}

        {state === "done" && (
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-white">Password updated</h1>
            <p className="text-white/50 mt-2">Taking you to the login screen…</p>
          </div>
        )}

        {state === "ready" && (
          <>
            <div className="text-center mb-7">
              <div className="text-5xl mb-3">🔐</div>
              <h1 className="text-2xl font-bold text-white">Choose a new password</h1>
              <p className="text-white/50 mt-1 text-sm">for {email}</p>
            </div>

            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white text-gray-800 placeholder-gray-400 px-4 py-3 rounded-2xl mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full bg-white text-gray-800 placeholder-gray-400 px-4 py-3 rounded-2xl mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full bg-purple-500 text-white py-3.5 rounded-2xl font-bold text-lg hover:bg-purple-600 transition disabled:opacity-50 shadow-lg shadow-purple-500/30"
            >
              {saving ? "Saving…" : "Reset password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;
