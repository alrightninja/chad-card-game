const { userFromToken, tokenFromHeader } = require("../lib/authToken");

async function requireAuth(req, res, next) {
  try {
    const token = tokenFromHeader(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const user = await userFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = requireAuth;
