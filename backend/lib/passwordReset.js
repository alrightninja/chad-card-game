const crypto = require("crypto");

const RESET_TTL_MS = 60 * 60 * 1000;

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function createResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS)
  };
}

function publicAppOrigin() {
  return (process.env.FRONTEND_URL || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .find(Boolean) || "http://localhost:3000";
}

function resetLink(token) {
  return `${publicAppOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
}

module.exports = {
  RESET_TTL_MS,
  hashResetToken,
  createResetToken,
  publicAppOrigin,
  resetLink
};
