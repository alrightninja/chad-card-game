const express = require("express");
const User = require("../models/User");
const { publicUser } = require("../lib/publicUser");

const router = express.Router();

function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  const provided = req.headers["x-admin-secret"] || req.body.adminSecret;
  if (!secret || provided !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.post("/verify-user", requireAdmin, async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const verified = req.body.verified !== false;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found" });

    user.verified = verified;
    user.verifiedAt = verified ? new Date() : null;
    await user.save();

    res.json({
      message: verified ? "User verified" : "Verification removed",
      user: publicUser(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
