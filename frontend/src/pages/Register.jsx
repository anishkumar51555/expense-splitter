import { useState } from "react";
import API from "../api/api";
import { useNavigate, Link } from "react-router-dom";

function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(null);
  const [resendState, setResendState] = useState("idle");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name || !form.email || !form.password) return setError("Please fill all fields");
    if (form.password.length < 6) return setError("Password must be at least 6 characters");

    setLoading(true);
    try {
      const res = await API.post("/auth/register", form);
      setRegistered({ email: form.email, emailSent: res.data.emailSent });
    } catch (err) {
      setError(err.response?.data?.msg || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendState("sending");
    try {
      await API.post("/auth/resend-verification", { email: registered.email });
    } catch {
      // Same reply either way — nothing extra to report.
    }
    setResendState("sent");
  };

  // ── After signup: nothing works until the link is clicked, so say so clearly ──
  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-2xl font-bold text-white">Check your email</h1>
          <p className="text-white/60 mt-3">
            We sent a verification link to{" "}
            <span className="text-purple-300 font-semibold">{registered.email}</span>.
            Click it to activate your account.
          </p>

          {registered.emailSent === false && (
            <p className="text-amber-300 text-xs mt-4 bg-amber-500/10 border border-amber-400/30 rounded-xl px-4 py-3">
              Email delivery isn't configured on the server yet, so the link was printed to
              the backend console instead.
            </p>
          )}

          <p className="text-white/40 text-xs mt-4">
            The link expires in 24 hours. Check your spam folder if it hasn't arrived.
          </p>

          <div className="mt-6 space-y-3">
            {resendState === "sent" ? (
              <p className="text-green-400 text-sm">✅ A new link is on its way.</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resendState === "sending"}
                className="w-full border border-white/20 text-white/80 py-3 rounded-2xl font-medium hover:bg-white/10 transition disabled:opacity-50"
              >
                {resendState === "sending" ? "Sending…" : "Resend the email"}
              </button>
            )}

            <button
              onClick={() => navigate("/")}
              className="w-full bg-purple-500 text-white py-3.5 rounded-2xl font-bold hover:bg-purple-600 transition shadow-lg shadow-purple-500/30"
            >
              Go to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    // FIX: centered vertically and horizontally
    <div className="min-h-screen flex items-center justify-center px-4">

      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl w-full max-w-md p-8">

        <div className="text-center mb-8">
          <div className="text-5xl mb-3">📝</div>
          <h1 className="text-3xl font-bold text-white">Create Account</h1>
          <p className="text-white/50 mt-1">Join Splitwise and split expenses easily</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Full Name"
            value={form.name}
            className="w-full bg-white text-gray-800 placeholder-gray-400 px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-400"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <input
            type="email"
            placeholder="Email"
            value={form.email}
            className="w-full bg-white text-gray-800 placeholder-gray-400 px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-400"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={form.password}
            className="w-full bg-white text-gray-800 placeholder-gray-400 px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-400"
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-400/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-500 text-white py-3.5 rounded-2xl font-bold text-lg hover:bg-purple-600 transition disabled:opacity-50 shadow-lg shadow-purple-500/30 mt-2"
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p className="text-center text-white/50 text-sm mt-5">
          Already have an account?{" "}
          <Link to="/" className="text-purple-300 font-semibold hover:text-purple-200 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
