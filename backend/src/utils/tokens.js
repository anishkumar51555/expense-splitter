const crypto = require("crypto");

/**
 * Single-use tokens for email verification and password resets.
 *
 * The raw token goes in the emailed link; only its SHA-256 hash is stored, so a
 * leaked database dump can't be used to verify accounts or seize them.
 */

const RAW_BYTES = 32;

const createToken = (ttlMinutes) => {
  const raw = crypto.randomBytes(RAW_BYTES).toString("hex");
  return {
    raw,
    hash: hashToken(raw),
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
  };
};

const hashToken = (raw) =>
  crypto.createHash("sha256").update(String(raw)).digest("hex");

module.exports = { createToken, hashToken };
