const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");

/**
 * Register a user, verify them, and log in — the state most tests want to
 * start from. Returns the auth token plus the user document.
 */
const createVerifiedUser = async ({
  name,
  email,
  password = "password123",
  // Signup requires somewhere to be paid; tests that care about the details
  // themselves pass their own.
  payment = { upiId: `${email.split("@")[0]}@upi` },
}) => {
  await request(app)
    .post("/api/auth/register")
    .send({ name, email, password, payment })
    .expect(201);

  // Mark verified directly; the verification flow itself is covered in auth.test.js.
  await User.updateOne(
    { email: email.toLowerCase() },
    { $set: { isVerified: true }, $unset: { verificationTokenHash: "", verificationExpires: "" } }
  );

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password })
    .expect(200);

  const user = await User.findOne({ email: email.toLowerCase() });

  return { token: login.body.token, user, id: user._id.toString(), email: user.email };
};

const authed = (token) => ({ Authorization: `Bearer ${token}` });

/** Create a group owned by `token`'s user and add the given users to it. */
const createGroupWith = async (token, name, members = []) => {
  const res = await request(app)
    .post("/api/groups/create")
    .set(authed(token))
    .send({ name })
    .expect(200);

  const groupId = res.body._id;

  for (const m of members) {
    await request(app)
      .post("/api/groups/add-member")
      .set(authed(token))
      .send({ groupId, email: m.email })
      .expect(200);
  }

  return groupId;
};

module.exports = { app, request, createVerifiedUser, authed, createGroupWith };
