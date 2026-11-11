const PVE_START_COOLDOWN_MS = 20 * 1000;
const PVE_DAILY_WIN_CAP = 20;
const MIN_ACTION_GAP_MS = 250;
const AUTH_WINDOW_MS = 10 * 60 * 1000;
const AUTH_MAX_HITS = 8;

const authHits = new Map();

function utcDay(now = new Date()) {
  return new Date(now).toISOString().slice(0, 10);
}

function bumpPveDay(user, now = new Date()) {
  const day = utcDay(now);
  if (user.pveFarmDay !== day) {
    user.pveFarmDay = day;
    user.pveWinsToday = 0;
  }
  return user;
}

function pveWinsToday(user, now = new Date()) {
  bumpPveDay(user, now);
  return user.pveWinsToday || 0;
}

function pveCapReached(user, now = new Date()) {
  return pveWinsToday(user, now) >= PVE_DAILY_WIN_CAP;
}

function assertCanStartPve(user, now = new Date()) {
  const last = user.lastPveStartAt ? new Date(user.lastPveStartAt).getTime() : 0;
  const wait = PVE_START_COOLDOWN_MS - (now.getTime() - last);
  if (last && wait > 0) {
    const err = new Error("Wait a few seconds before starting another AI battle.");
    err.status = 429;
    throw err;
  }
}

function notePveStart(user, now = new Date()) {
  user.lastPveStartAt = now;
}

function consumePveWin(user, now = new Date()) {
  bumpPveDay(user, now);
  user.pveWinsToday = (user.pveWinsToday || 0) + 1;
}

function assertActionPace(match, now = new Date()) {
  const last = match.lastHumanActionAt ? new Date(match.lastHumanActionAt).getTime() : 0;
  if (last && now.getTime() - last < MIN_ACTION_GAP_MS) {
    const err = new Error("Slow down a moment.");
    err.status = 429;
    throw err;
  }
}

function pveRewardsAllowed(match, user, now = new Date()) {
  if (!match || match.opponentType !== "ai" || match.tutorial) return true;
  if (pveCapReached(user, now)) return false;
  return true;
}

function clientKey(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || req.ip || "unknown";
}

function authLimited(req) {
  const key = clientKey(req);
  const now = Date.now();
  const bucket = authHits.get(key) || { n: 0, reset: now + AUTH_WINDOW_MS };
  if (now > bucket.reset) {
    bucket.n = 0;
    bucket.reset = now + AUTH_WINDOW_MS;
  }
  bucket.n += 1;
  authHits.set(key, bucket);
  return bucket.n > AUTH_MAX_HITS;
}

module.exports = {
  PVE_START_COOLDOWN_MS,
  PVE_DAILY_WIN_CAP,
  MIN_ACTION_GAP_MS,
  utcDay,
  bumpPveDay,
  pveWinsToday,
  pveCapReached,
  assertCanStartPve,
  notePveStart,
  consumePveWin,
  assertActionPace,
  pveRewardsAllowed,
  authLimited
};
