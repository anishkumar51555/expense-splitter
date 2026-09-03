/**
 * One-off migration.
 *
 * Email verification is now required to log in. Accounts that existed before
 * that change have no `isVerified` flag, so without this they would all be
 * locked out. Run once after deploying:
 *
 *   npm run migrate:verify-existing
 *
 * Only touches users created before the cutoff, so genuinely new unverified
 * signups still have to click their link.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.");

  // Anything without the field predates the feature.
  const filter = { $or: [{ isVerified: { $exists: false } }, { isVerified: null }] };

  const count = await User.countDocuments(filter);
  console.log(`Found ${count} pre-existing account(s) with no verification state.`);

  if (count > 0) {
    const result = await User.updateMany(filter, { $set: { isVerified: true } });
    console.log(`Marked ${result.modifiedCount} account(s) as verified.`);
  }

  await mongoose.disconnect();
  console.log("Done.");
};

run().catch(async (err) => {
  console.error("Migration failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
