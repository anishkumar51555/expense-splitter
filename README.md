# 💸 Expense Splitter (Splitwise Clone)

A full-stack expense sharing application where users can create groups, add expenses, split costs, and track balances — similar to Splitwise.

---

## 🚀 Features

- 🔐 Authentication (JWT based login/register)
- 📬 **Real email verification** — accounts stay inactive until the emailed link is clicked
- 🔑 **Token-based password reset** — one-time link, expires in 1 hour
- 👥 Create & join groups via invite code
- 💰 **Add expenses with four split modes** — equally, exact amounts, percentages, or shares/weights
- 📊 Per-user balance calculation (You owe / You are owed)
- 💳 **Razorpay checkout** (UPI, card, netbanking) with signature verification, plus UPI details / QR for direct transfers
- 📜 Transaction history
- 📱 Clean responsive UI

---

## 🛠 Tech Stack

**Frontend:**
- React
- Tailwind CSS
- Axios

**Backend:**
- Node.js
- Express.js
- MongoDB (Mongoose)
- JWT Authentication
- Nodemailer (SMTP)
- Razorpay

**Tests:**
- Jest + Supertest + mongodb-memory-server

---

## ⚙️ Setup Instructions

### 1. Clone the repo
```bash
git clone https://github.com/anishkumar51555/expense-splitter.git
cd expense-splitter
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env    # then fill it in — see the table below
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
# to point at a local backend instead of the deployed one:
echo "VITE_API_URL=http://localhost:5000/api" > .env.local
npm run dev
```

---

## 🔐 Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `MONGO_URI` | **yes** | MongoDB connection string |
| `JWT_SECRET` | **yes** | Signs session tokens. Use 32+ random characters; the server refuses to start without it |
| `APP_URL` | recommended | Frontend URL. Verification and reset links are built from this, and it is added to the CORS allow-list |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | no | Outgoing email. **Leave blank and links are printed to the server console** instead of being emailed — signup and reset still work |
| `MAIL_FROM` | no | From-address on outgoing mail |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | no | Online payments. Leave blank and the app falls back to UPI details + "Mark as Paid" |
| `RAZORPAY_WEBHOOK_SECRET` | no | Verifies the gateway webhook, a backup for when the browser drops out mid-payment |

### Getting SMTP credentials

- **Gmail** — enable 2FA, then create an *App Password* (not your account password). Host `smtp.gmail.com`, port `587`.
- **Brevo** — host `smtp-relay.brevo.com`, port `587`.
- **Mailtrap** — host `sandbox.smtp.mailtrap.io`, port `2525`. Catches mail in a test inbox instead of delivering it, which is ideal while developing.

### Getting Razorpay keys

Sign in at [dashboard.razorpay.com](https://dashboard.razorpay.com) → Settings → API Keys → **Generate Test Key**. Test keys (`rzp_test_…`) work immediately with no business verification, and no real money moves. For the webhook, add an endpoint pointing at `POST /api/payments/webhook`, subscribe it to `payment.captured` and `payment.failed`, and paste its secret into `RAZORPAY_WEBHOOK_SECRET`.

---

## ✅ Verifying your setup

```bash
cd backend
npm run check:config                  # checks DB, SMTP and Razorpay
npm run check:config you@example.com  # also sends a real test email
```

Every check reports ✅, ⚠️ (works, but running in fallback mode) or ❌.

---

## ⚠️ Upgrading an existing deployment

Email verification is now required to log in, and accounts created before that change have no verification flag — **they would all be locked out.** Run this once after deploying:

```bash
cd backend
npm run migrate:verify-existing
```

It marks pre-existing accounts as verified and leaves genuinely new signups alone.

---

## 🧪 Tests

```bash
cd backend
npm test
```

109 tests covering the split engine's rounding, email verification, password reset, and payment signature verification. They run against an in-memory MongoDB, so no credentials or network access are needed — and no real email or payment is ever sent.

---

## 🧮 How splitting works

Every participant's share is stored on the expense, so balances always settle for exactly what was agreed rather than re-dividing the total by head count.

| Mode | You enter | Example on ₹1000 |
| --- | --- | --- |
| **Equally** | nothing | 3 people → 333.34 / 333.33 / 333.33 |
| **Exact ₹** | each person's amount | 100 / 600 / 300 |
| **Percent %** | each person's share of 100% | 10% / 60% / 30% |
| **Shares** | relative weights | 1 : 6 : 3 |

Amounts are split in integer paise using the largest-remainder method, so the shares always add back up to the original total — no lost or invented paise, even on repeating thirds. Exact amounts must match the total and percentages must reach 100%, and both are checked on the server as well as in the form.
