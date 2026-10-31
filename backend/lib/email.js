function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function emailsMatch(a, b) {
  return normalizeEmail(a) === normalizeEmail(b);
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function emailQuery(email) {
  const norm = normalizeEmail(email);
  return {
    $or: [
      { email: norm },
      { email: { $regex: `^${escapeRegex(norm)}$`, $options: "i" } }
    ]
  };
}

module.exports = { normalizeEmail, emailsMatch, emailQuery };
