import { useState, useEffect } from "react";
import API from "../api/api";
import { useNavigate, Link } from "react-router-dom";

function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  // 🔥 FIX: useEffect inside component
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/dashboard");
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await API.post("/auth/login", form);
      localStorage.setItem("token", res.data.token);
      navigate("/dashboard");
    } catch {
      alert("Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">

      <div className="bg-white/80 backdrop-blur p-8 rounded-2xl shadow-2xl w-96">

        <h2 className="text-3xl font-bold text-center mb-2 text-gray-800">
          💸 Splitwise
        </h2>

        <p className="text-center text-gray-500 mb-6 text-sm">
          Welcome back 👋
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <input
            type="email"
            placeholder="Email"
            className="p-3 rounded-lg border border-gray-300 text-gray-800"
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
          />

          <input
            type="password"
            placeholder="Password"
            className="p-3 rounded-lg border border-gray-300 text-gray-800"
            onChange={(e) =>
              setForm({ ...form, password: e.target.value })
            }
          />

          <button className="bg-purple-500 text-white p-3 rounded-lg">
            Login
          </button>
        </form>

        <p className="text-gray-500 text-sm text-center mt-4">
          Don’t have an account?{" "}
          <Link to="/register" className="text-purple-500">
            Register
          </Link>
        </p>

      </div>
    </div>
  );
}

export default Login;