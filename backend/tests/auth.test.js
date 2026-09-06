const request = require("supertest");

// Capture the emails the app tries to send, so tests can follow the real links
// instead of reaching into the database for hashed tokens.
const sent = [];

jest.mock("../src/utils/email", () => ({
  sendVerificationEmail: jest.fn(async (user, rawToken) => {
    sent.push({ kind: "verify", to: user.email, token: rawToken });
    return { delivered: true };
  }),
  sendPasswordResetEmail: jest.fn(async (user, rawToken) => {
    sent.push({ kind: "reset", to: user.email, token: rawToken });
    return { delivered: true };
  }),
  smtpConfigured: () => true,
  appUrl: () => "http://localhost:5173",
}));

const app = require("../src/app");
const User = require("../src/models/User");

const lastEmail = (kind) => [...sent].reverse().find((e) => e.kind === kind);

beforeEach(() => {
  sent.length = 0;
});

const signUp = (over = {}) =>
  request(app).post("/api/auth/register").send({
    name: "Asha",
    email: "asha@example.com",
    password: "password123",
    payment: { upiId: "asha@upi" },
    ...over,
  });

describe("registration", () => {
  it("creates an unverified account and emails a verification link", async () => {
    const res = await signUp().expect(201);

    expect(res.body.emailSent).toBe(true);
    expect(res.body.user.email).toBe("asha@example.com");
    expect(res.body.user).not.toHaveProperty("password");

    const user = await User.findOne({ email: "asha@example.com" });
    expect(user.isVerified).toBe(false);

    const mail = lastEmail("verify");
    expect(mail.to).toBe("asha@example.com");
    expect(mail.token).toHaveLength(64);
  });

  it("stores only a hash of the verification token", async () => {
    await signUp().expect(201);

    const user = await User.findOne({ email: "asha@example.com" }).select(
      "+verificationTokenHash"
    );
    expect(user.verificationTokenHash).not.toBe(lastEmail("verify").token);
    expect(user.verificationTokenHash).toHaveLength(64);
  });

  it("never returns the password hash", async () => {
    const res = await signUp().expect(201);
    expect(JSON.stringify(res.body)).not.toContain("$2b$");
  });

  it("rejects a duplicate email", async () => {
    await signUp().expect(201);
    const res = await signUp().expect(400);
    expect(res.body.msg).toMatch(/already exists/i);
  });

  it("normalises email case so duplicates are caught", async () => {
    await signUp().expect(201);
    const res = await signUp({ email: "ASHA@example.com" }).expect(400);
    expect(res.body.msg).toMatch(/already exists/i);
  });

  it("rejects a malformed email", async () => {
    const res = await signUp({ email: "not-an-email" }).expect(400);
    expect(res.body.msg).toMatch(/valid email/i);
  });

  it("rejects a short password", async () => {
    const res = await signUp({ password: "12345" }).expect(400);
    expect(res.body.msg).toMatch(/at least 6/i);
  });

  it("rejects missing fields", async () => {
    await signUp({ name: "" }).expect(400);
  });
});

describe("email verification", () => {
  it("blocks login until the address is verified", async () => {
    await signUp().expect(201);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "asha@example.com", password: "password123" })
      .expect(403);

    expect(res.body.needsVerification).toBe(true);
    expect(res.body.token).toBeUndefined();
  });

  it("verifies with the emailed token and returns a usable session", async () => {
    await signUp().expect(201);
    const { token } = lastEmail("verify");

    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token })
      .expect(200);

    expect(res.body.token).toBeDefined();

    // The returned session works against a protected route.
    await request(app)
      .get("/api/groups")
      .set("Authorization", `Bearer ${res.body.token}`)
      .expect(200);

    const user = await User.findOne({ email: "asha@example.com" });
    expect(user.isVerified).toBe(true);
  });

  it("lets a verified user log in", async () => {
    await signUp().expect(201);
    await request(app)
      .post("/api/auth/verify-email")
      .send({ token: lastEmail("verify").token })
      .expect(200);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "asha@example.com", password: "password123" })
      .expect(200);

    expect(res.body.token).toBeDefined();
  });

  it("refuses a token that has already been used", async () => {
    await signUp().expect(201);
    const { token } = lastEmail("verify");

    await request(app).post("/api/auth/verify-email").send({ token }).expect(200);

    const res = await request(app).post("/api/auth/verify-email").send({ token }).expect(400);
    expect(res.body.msg).toMatch(/invalid or has already been used/i);
  });

  it("refuses a made-up token", async () => {
    await signUp().expect(201);
    await request(app).post("/api/auth/verify-email").send({ token: "f".repeat(64) }).expect(400);
  });

  it("refuses an expired token", async () => {
    await signUp().expect(201);
    const { token } = lastEmail("verify");

    await User.updateOne(
      { email: "asha@example.com" },
      { $set: { verificationExpires: new Date(Date.now() - 1000) } }
    );

    const res = await request(app).post("/api/auth/verify-email").send({ token }).expect(400);
    expect(res.body.msg).toMatch(/expired/i);
  });

  it("also accepts the token as a query parameter, as the emailed link does", async () => {
    await signUp().expect(201);
    const { token } = lastEmail("verify");

    await request(app).get(`/api/auth/verify-email?token=${token}`).expect(200);
  });

  it("resends a fresh link and retires the old one", async () => {
    await signUp().expect(201);
    const first = lastEmail("verify").token;

    await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "asha@example.com" })
      .expect(200);

    const second = lastEmail("verify").token;
    expect(second).not.toBe(first);

    await request(app).post("/api/auth/verify-email").send({ token: first }).expect(400);
    await request(app).post("/api/auth/verify-email").send({ token: second }).expect(200);
  });

  it("does not reveal whether an address is registered on resend", async () => {
    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "nobody@example.com" })
      .expect(200);

    expect(res.body.msg).toMatch(/if that address/i);
    expect(sent).toHaveLength(0);
  });
});

describe("forgot password", () => {
  const verifiedSignup = async () => {
    await signUp().expect(201);
    await request(app)
      .post("/api/auth/verify-email")
      .send({ token: lastEmail("verify").token })
      .expect(200);
  };

  it("emails a reset link", async () => {
    await verifiedSignup();

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "asha@example.com" })
      .expect(200);

    expect(res.body.msg).toMatch(/if an account exists/i);
    expect(lastEmail("reset").token).toHaveLength(64);
  });

  it("gives the same answer for an unknown address and sends nothing", async () => {
    const known = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "asha@example.com" })
      .expect(200);

    const unknown = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "ghost@example.com" })
      .expect(200);

    expect(unknown.body.msg).toBe(known.body.msg);
    expect(sent.filter((e) => e.kind === "reset")).toHaveLength(0);
  });

  it("stores only a hash of the reset token", async () => {
    await verifiedSignup();
    await request(app).post("/api/auth/forgot-password").send({ email: "asha@example.com" });

    const user = await User.findOne({ email: "asha@example.com" }).select("+resetTokenHash");
    expect(user.resetTokenHash).not.toBe(lastEmail("reset").token);
  });

  it("checks a token before showing the form", async () => {
    await verifiedSignup();
    await request(app).post("/api/auth/forgot-password").send({ email: "asha@example.com" });

    const ok = await request(app)
      .post("/api/auth/verify-reset-token")
      .send({ token: lastEmail("reset").token })
      .expect(200);
    expect(ok.body.valid).toBe(true);
    expect(ok.body.email).toBe("asha@example.com");

    const bad = await request(app)
      .post("/api/auth/verify-reset-token")
      .send({ token: "0".repeat(64) })
      .expect(400);
    expect(bad.body.valid).toBe(false);
  });

  it("changes the password and lets the new one log in", async () => {
    await verifiedSignup();
    await request(app).post("/api/auth/forgot-password").send({ email: "asha@example.com" });

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: lastEmail("reset").token, newPassword: "brand-new-pass" })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({ email: "asha@example.com", password: "brand-new-pass" })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({ email: "asha@example.com", password: "password123" })
      .expect(400);
  });

  it("burns the token so the link cannot be reused", async () => {
    await verifiedSignup();
    await request(app).post("/api/auth/forgot-password").send({ email: "asha@example.com" });
    const { token } = lastEmail("reset");

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "first-new-pass" })
      .expect(200);

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "second-new-pass" })
      .expect(400);

    expect(res.body.msg).toMatch(/invalid or has expired/i);

    // The first reset still stands.
    await request(app)
      .post("/api/auth/login")
      .send({ email: "asha@example.com", password: "first-new-pass" })
      .expect(200);
  });

  it("refuses an expired reset token", async () => {
    await verifiedSignup();
    await request(app).post("/api/auth/forgot-password").send({ email: "asha@example.com" });

    await User.updateOne(
      { email: "asha@example.com" },
      { $set: { resetExpires: new Date(Date.now() - 1000) } }
    );

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: lastEmail("reset").token, newPassword: "brand-new-pass" })
      .expect(400);
  });

  it("will not reset a password without a token", async () => {
    await verifiedSignup();

    // This is what the old email-only endpoint allowed. It must not work.
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ email: "asha@example.com", newPassword: "hijacked-pass" })
      .expect(400);

    expect(res.body.msg).toMatch(/token/i);

    await request(app)
      .post("/api/auth/login")
      .send({ email: "asha@example.com", password: "password123" })
      .expect(200);
  });

  it("rejects a short new password", async () => {
    await verifiedSignup();
    await request(app).post("/api/auth/forgot-password").send({ email: "asha@example.com" });

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: lastEmail("reset").token, newPassword: "123" })
      .expect(400);
  });

  it("verifies an unverified account that completes a reset", async () => {
    await signUp().expect(201);
    await request(app).post("/api/auth/forgot-password").send({ email: "asha@example.com" });

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: lastEmail("reset").token, newPassword: "brand-new-pass" })
      .expect(200);

    const user = await User.findOne({ email: "asha@example.com" });
    expect(user.isVerified).toBe(true);
  });
});

describe("login", () => {
  it("rejects a wrong password with the same message as an unknown user", async () => {
    await signUp().expect(201);
    await request(app)
      .post("/api/auth/verify-email")
      .send({ token: lastEmail("verify").token })
      .expect(200);

    const wrongPass = await request(app)
      .post("/api/auth/login")
      .send({ email: "asha@example.com", password: "wrong-password" })
      .expect(400);

    const noUser = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@example.com", password: "wrong-password" })
      .expect(400);

    expect(wrongPass.body.msg).toBe(noUser.body.msg);
  });

  it("requires a token on protected routes", async () => {
    await request(app).get("/api/groups").expect(401);
    await request(app).get("/api/groups").set("Authorization", "Bearer nonsense").expect(401);
  });
});

describe("payment details at signup", () => {
  it("refuses an account with no way to be paid", async () => {
    const res = await signUp({ payment: {} }).expect(400);

    expect(res.body.msg).toMatch(/at least one payment detail/i);
    expect(await User.countDocuments({ email: "asha@example.com" })).toBe(0);
  });

  it("refuses when the payment field is missing entirely", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Asha", email: "asha@example.com", password: "password123" })
      .expect(400);

    expect(res.body.msg).toMatch(/at least one payment detail/i);
  });

  it("accepts a UPI id on its own", async () => {
    await signUp({ payment: { upiId: "asha@okaxis" } }).expect(201);

    const user = await User.findOne({ email: "asha@example.com" });
    expect(user.payment.upiId).toBe("asha@okaxis");
    expect(user.paymentSetup).toBe(true);
  });

  it("accepts a phone number on its own", async () => {
    await signUp({ payment: { phone: "9876543210" } }).expect(201);

    const user = await User.findOne({ email: "asha@example.com" });
    expect(user.payment.phone).toBe("9876543210");
  });

  it("accepts a QR code on its own", async () => {
    await signUp({ payment: { qrCode: "data:image/png;base64,iVBORw0KGgo=" } }).expect(201);

    const user = await User.findOne({ email: "asha@example.com" });
    expect(user.payment.qrCode).toMatch(/^data:image\/png/);
  });

  it("rejects a phone number that is not ten digits", async () => {
    const res = await signUp({ payment: { phone: "98765" } }).expect(400);

    expect(res.body.msg).toMatch(/10-digit/i);
    expect(await User.countDocuments({ email: "asha@example.com" })).toBe(0);
  });

  it("trims surrounding whitespace off the details", async () => {
    await signUp({ payment: { upiId: "  asha@okaxis  ", phone: " 9876543210 " } }).expect(201);

    const user = await User.findOne({ email: "asha@example.com" });
    expect(user.payment.upiId).toBe("asha@okaxis");
    expect(user.payment.phone).toBe("9876543210");
  });

  it("goes straight past the payment-setup prompt on login", async () => {
    await signUp({ payment: { upiId: "asha@okaxis" } }).expect(201);
    await User.updateOne({ email: "asha@example.com" }, { $set: { isVerified: true } });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "asha@example.com", password: "password123" })
      .expect(200);

    const claims = JSON.parse(
      Buffer.from(login.body.token.split(".")[1], "base64").toString()
    );
    expect(claims.paymentSetup).toBe(true);
  });
});
