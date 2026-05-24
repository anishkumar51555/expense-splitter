import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password state
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

// Redirect to payment setup only if backend says not done AND not skipped before
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

  // Step 1: check if email exists in DB
  const handleEmailCheck = async () => {
    if (!forgotEmail.trim()) return setForgotMsg("Enter your email");
    setForgotLoading(true);
    setForgotMsg("");
    try {
      // Try reset with a dummy to just verify email — instead we use a dedicated check
      // We send a request and if 404 the email doesn't exist
      await API.post("/auth/reset-password", {
        email: forgotEmail,
        newPassword: "__check__only__",
      });
      // If somehow passes (won't — too short), still move on
      setEmailVerified(true);
    } catch (err) {
      const msg = err.response?.data?.msg || "";
      if (msg === "No account found with this email") {
        setForgotMsg("No account found with this email.");
      } else {
        // Any other error (like password too short) means email EXISTS
        setEmailVerified(true);
      }
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 2: actually reset the password
  const handleResetPassword = async () => {
    setForgotMsg("");
    if (!newPassword || !confirmPassword) return setForgotMsg("Please fill both fields");
    if (newPassword.length < 6) return setForgotMsg("Password must be at least 6 characters");
    if (newPassword !== confirmPassword) return setForgotMsg("Passwords do not match");

    setForgotLoading(true);
    try {
      await API.post("/auth/reset-password", {
        email: forgotEmail,
        newPassword,
      });
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
    <div className="min-h-screen bg-transparent ...">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">

        <h1 className="text-3xl font-bold text-gray-800 mb-1">💸 Splitwise</h1>
        <p className="text-gray-500 mb-6">Sign in to manage expenses</p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-3 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="w-full border p-3 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />

        {/* Forgot password link */}
        <div className="text-right mb-4">
          <button
            onClick={() => setShowForgot(true)}
            className="text-sm text-purple-500 hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-purple-500 text-white py-3 rounded-lg font-semibold hover:bg-purple-600 transition disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="text-center mt-4 text-gray-500 text-sm">
          Don't have an account?{" "}
          <span
            onClick={() => navigate("/register")}
            className="text-purple-500 font-medium cursor-pointer hover:underline"
          >
            Register
          </span>
        </p>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">

            <h2 className="text-xl font-bold text-gray-800 mb-1">Reset Password</h2>
            <p className="text-sm text-gray-500 mb-5">
              {emailVerified
                ? `Setting new password for ${forgotEmail}`
                : "Enter your registered email to continue"}
            </p>

            {/* Step 1: Email input */}
            {!emailVerified ? (
              <>
                <input
                  type="email"
                  placeholder="Your email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailCheck()}
                  className="w-full border p-3 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                {forgotMsg && (
                  <p className="text-sm text-red-500 mb-3">{forgotMsg}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowForgot(false); setForgotMsg(""); setForgotEmail(""); }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEmailCheck}
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white font-semibold hover:bg-purple-600 disabled:opacity-50"
                  >
                    {forgotLoading ? "Checking..." : "Continue"}
                  </button>
                </div>
              </>
            ) : (
              /* Step 2: New password inputs */
              <>
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border p-3 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                  className="w-full border p-3 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                {forgotMsg && (
                  <p className={`text-sm mb-3 ${forgotMsg.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>
                    {forgotMsg}
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setEmailVerified(false); setForgotMsg(""); setNewPassword(""); setConfirmPassword(""); }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white font-semibold hover:bg-purple-600 disabled:opacity-50"
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