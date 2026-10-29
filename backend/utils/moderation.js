/**
 * Kid-safe text filter for usernames and DMs.
 * Normalizes leetspeak / spacing tricks, then blocks a denylist.
 * This is not perfect; keep tightening the list as workarounds appear.
 */

const BLOCKED = [
  "anal", "anus", "arse", "ass", "asses", "asshole", "assholes",
  "bastard", "bitch", "bitches", "bitchy", "blowjob", "bollock", "boner",
  "boob", "boobs", "bukkake", "bullshit",
  "chink", "clit", "cock", "cocks", "coon", "crap", "cum", "cunt",
  "damn", "dick", "dicks", "dildo", "dyke",
  "fag", "faggot", "fags", "felch", "fellatio", "feltch", "fuck", "fucked",
  "fucker", "fuckers", "fucking", "fucks", "fuk", "fvck",
  "goddamn", "gook",
  "handjob", "hell", "homo", "horny",
  "jackoff", "jap", "jerkoff", "jizz",
  "kike", "kys",
  "labia",
  "minge", "mothafucka", "motherfucker",
  "nazi", "nigga", "nigger", "nutsack",
  "orgasm",
  "paki", "penis", "piss", "pissed", "porn", "porno", "prick", "pussy",
  "queef", "queer",
  "rape", "rapist", "retard", "retarded", "rimjob",
  "semen", "sex", "sexy", "shit", "shits", "shitty", "slut", "sluts",
  "spic", "spunk",
  "tits", "titties", "tranny", "turd", "twat",
  "vagina", "wank", "wanker", "whore", "whores"
];

const BLOCKED_SET = new Set(BLOCKED);

const LEET = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
  "!": "i",
  "+": "t",
  "*": ""
};

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .split("")
    .map((ch) => LEET[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/(.)\1{2,}/g, "$1$1")
    .trim();
}

function containsBlocked(text) {
  const norm = normalize(text);
  if (!norm) return false;
  const compact = norm.replace(/ /g, "");
  const tokens = norm.split(/\s+/);

  for (const token of tokens) {
    if (BLOCKED_SET.has(token)) return true;
  }
  for (const word of BLOCKED_SET) {
    if (word.length >= 4 && compact.includes(word)) return true;
  }
  return false;
}

function assertClean(text, label = "Text") {
  if (containsBlocked(text)) {
    const err = new Error(`${label} contains language that isn’t allowed.`);
    err.status = 400;
    throw err;
  }
}

function assertCleanUsername(username) {
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username || "")) {
    const err = new Error("Username must be 3–20 letters, numbers, or underscores.");
    err.status = 400;
    throw err;
  }
  assertClean(username, "Username");
}

function sanitizeMessage(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    const err = new Error("Message cannot be empty");
    err.status = 400;
    throw err;
  }
  if (trimmed.length > 500) {
    const err = new Error("Message is too long (max 500 characters)");
    err.status = 400;
    throw err;
  }
  assertClean(trimmed, "Message");
  return trimmed;
}

module.exports = {
  containsBlocked,
  assertClean,
  assertCleanUsername,
  sanitizeMessage
};
