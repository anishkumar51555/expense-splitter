const express = require("express");
const cors = require("cors");


const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://expense-splitter-ebon-xi.vercel.app",
];

// Let a deployment add its own frontend URL without a code change.
if (process.env.APP_URL && !allowedOrigins.includes(process.env.APP_URL)) {
  allowedOrigins.push(process.env.APP_URL.replace(/\/$/, ""));
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));

// Routes — all grouped before server starts
const authRoutes = require("./routes/authRoutes");
const groupRoutes = require("./routes/groupRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const balanceRoutes = require("./routes/balanceRoutes");
const userRoutes = require("./routes/userRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/balances", balanceRoutes);
app.use("/api/user", userRoutes);

app.get("/", (req, res) => res.send("API Running 🚀"));

module.exports = app;
