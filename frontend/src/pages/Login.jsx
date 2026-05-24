import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");

  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) return alert("Please fill all fields");
    setLoading(true);
    try {
      const res = await API.post("/auth/login", { email, password });
      localStorage.setItem("token", res.data.token);
      const paymentDone = localStorage.getItem("paymentSetup");
      const decoded = JSON.parse(atob(res.data.token.split(".")[1]));
      if (!decoded.paymentSetup && !paymentDone) {
        navigate("/payment-setup");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      alert(err.response?.data?.msg || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailCheck = async () => {
    if (!forgotEmail.trim()) return setForgotMsg("Enter your email");
    setForgotLoading(true);
    setForgotMsg("");
    try {
      await API.post("/auth/reset-password", {
        email: forgotEmail,
        newPassword: "__check__only__",
      });
      setEmailVerified(true);
    } catch (err) {
      const msg = err.response?.data?.msg || "";
      if (msg === "No account found with this email") {
        setForgotMsg("No account found with this email.");
      } else {
        setEmailVerified(true);
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setForgotMsg("");
    if (!newPassword || !confirmPassword) return setForgotMsg("Please fill both fields");
    if (newPassword.length < 6) return setForgotMsg("Password must be at least 6 characters");
    if (newPassword !== confirmPassword) return setForgotMsg("Passwords do not match");
    setForgotLoading(true);
    try {
      await API.post("/auth/reset-password", { email: forgotEmail, newPassword });
      setForgotMsg("✅ Password reset successfully!");
      setTimeout(() => {
        setShowForgot(false);
        setForgotEmail("");
        setNewPassword("");
        setConfirmPassword("");
        setEmailVerified(false);
        setForgotMsg("");
      }, 1500);
    } catch (err) {
      setForgotMsg(err.response?.data?.msg || "Something went wrong");
    } finally {
      setForgotLoading(false);
    }
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

        <div className="text-right mb-5">
          <button
            onClick={() => setShowForgot(true)}
            className="text-sm text-purple-300 hover:text-purple-200 hover:underline"
          >
            Forgot password?
          </button>
        </div>

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

      {/* FORGOT PASSWORD MODAL */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl w-full max-w-sm p-6">

            <div className="text-center mb-5">
              <div className="text-4xl mb-2">🔐</div>
              <h2 className="text-xl font-bold text-white">Reset Password</h2>
              <p className="text-sm text-white/50 mt-1">
                {emailVerified
                  ? `Setting new password for ${forgotEmail}`
                  : "Enter your registered email to continue"}
              </p>
            </div>

            {!emailVerified ? (
              <>
                <input
                  type="email"
                  placeholder="Your email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailCheck()}
                  className="w-full bg-white text-gray-800 placeholder-gray-400 px-4 py-3 rounded-2xl mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                {forgotMsg && (
                  <p className="text-sm text-red-400 mb-3">{forgotMsg}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowForgot(false); setForgotMsg(""); setForgotEmail(""); }}
                    className="flex-1 py-3 rounded-2xl border border-white/20 text-white/70 hover:bg-white/10 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEmailCheck}
                    disabled={forgotLoading}
                    className="flex-1 py-3 rounded-2xl bg-purple-500 text-white font-bold hover:bg-purple-600 transition disabled:opacity-50"
                  >
                    {forgotLoading ? "Checking..." : "Continue"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white text-gray-800 placeholder-gray-400 px-4 py-3 rounded-2xl mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                  className="w-full bg-white text-gray-800 placeholder-gray-400 px-4 py-3 rounded-2xl mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                {forgotMsg && (
                  <p className={`text-sm mb-3 ${forgotMsg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>
                    {forgotMsg}
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setEmailVerified(false); setForgotMsg(""); setNewPassword(""); setConfirmPassword(""); }}
                    className="flex-1 py-3 rounded-2xl border border-white/20 text-white/70 hover:bg-white/10 transition font-medium"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={forgotLoading}
                    className="flex-1 py-3 rounded-2xl bg-purple-500 text-white font-bold hover:bg-purple-600 transition disabled:opacity-50"
                  >
                    {forgotLoading ? "Saving..." : "Reset Password"}
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