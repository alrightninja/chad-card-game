function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function emailsMatch(a, b) {
  return normalizeEmail(a) === normalizeEmail(b);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function emailKey(email) {
  const n = normalizeEmail(email);
  const at = n.lastIndexOf("@");
  if (at < 1) return n;
  let local = n.slice(0, at);
  let domain = n.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

function emailQuery(email) {
  const norm = normalizeEmail(email);
  const key = emailKey(email);
  return {
    $or: [
      { email: norm },
      { emailKey: key },
      { email: { $regex: `^${escapeRegex(norm)}$`, $options: "i" } }
    ]
  };
}

function emailTakenQuery(email, exceptUserId) {
  const query = emailQuery(email);
  if (exceptUserId) {
    return { $and: [{ _id: { $ne: exceptUserId } }, query] };
  }
  return query;
}

module.exports = {
  normalizeEmail,
  emailsMatch,
  isValidEmail,
  emailKey,
  emailQuery,
  emailTakenQuery
};
