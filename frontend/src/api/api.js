import axios from "axios";

// Point at a local backend with VITE_API_URL=http://localhost:5000/api in a
// .env.local file; falls back to the deployed API.
const baseURL =
  import.meta.env.VITE_API_URL ||
  "https://expense-splitter-backend-2q5v.onrender.com/api";

const API = axios.create({ baseURL });

// 🔥 TOKEN AUTO ATTACH
API.interceptors.request.use(
  (req) => {
    const token = localStorage.getItem("token");

    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }

    return req;
  },
  (error) => Promise.reject(error)
);

// A dead or expired token should drop you back to the login screen rather than
// leaving every panel stuck on an error.
API.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const onAuthPage = ["/", "/register", "/verify-email", "/reset-password"].includes(
      window.location.pathname
    );

    if (status === 401 && !onAuthPage) {
      localStorage.removeItem("token");
      window.location.href = "/";
    }

    return Promise.reject(error);
  }
);

export default API;
