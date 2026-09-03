const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

/**
 * Every suite runs against a real MongoDB — an in-memory one that is thrown
 * away afterwards. No Atlas connection, no credentials, no shared state.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-production";
process.env.APP_URL = "http://localhost:5173";

// Keep SMTP unconfigured so nothing is ever actually emailed during a test run.
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

// The email fallback logs verification links; silence it so test output stays
// readable. Tests read tokens straight from the database instead.
const realLog = console.log;
beforeAll(() => {
  console.log = (...args) => {
    if (typeof args[0] === "string" && args[0].includes("email not sent")) return;
    realLog(...args);
  };
});
afterAll(() => {
  console.log = realLog;
});
