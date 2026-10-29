const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function userFromToken(token) {
  if (!token) return null;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select("-passwordHash");
  return user || null;
}

function tokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.split(" ")[1];
}

module.exports = { userFromToken, tokenFromHeader };
