import axios from "axios";

const API = axios.create({
  baseURL: "https://expense-splitter-backend-2q5v.onrender.com",
});

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

export default API;