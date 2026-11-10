const MAX_LEVEL = 100;
const WIN_XP = 40;

function xpForLevel(level) {
  if (level < 1 || level >= MAX_LEVEL) return 0;
  return 50 * level + 50;
}

function progressFromTotalXp(xp) {
  let remaining = Math.max(0, Number(xp) || 0);
  let level = 1;
  while (level < MAX_LEVEL) {
    const need = xpForLevel(level);
    if (remaining < need) {
      return {
        level,
        xpIntoLevel: remaining,
        xpForNext: need
      };
    }
    remaining -= need;
    level += 1;
  }
  return { level: MAX_LEVEL, xpIntoLevel: remaining, xpForNext: 0 };
}

function repsForReaching(level) {
  if (level < 2 || level > MAX_LEVEL) return 0;
  return 10 * (level - 1);
}

function applyWinXp(user) {
  if (!user) return { xpGained: 0, levelsGained: 0, repsAwarded: 0, level: 1 };
  const oldLevel = user.level || progressFromTotalXp(user.xp || 0).level;
  user.xp = (user.xp || 0) + WIN_XP;
  const next = progressFromTotalXp(user.xp);
  user.level = next.level;
  let repsAwarded = 0;
  for (let lv = oldLevel + 1; lv <= next.level; lv += 1) {
    repsAwarded += repsForReaching(lv);
  }
  if (repsAwarded) {
    user.currency = user.currency || { reps: 0 };
    user.currency.reps = (user.currency.reps || 0) + repsAwarded;
  }
  return {
    xpGained: WIN_XP,
    levelsGained: next.level - oldLevel,
    repsAwarded,
    level: next.level,
    ...next
  };
}

module.exports = {
  MAX_LEVEL,
  WIN_XP,
  xpForLevel,
  progressFromTotalXp,
  repsForReaching,
  applyWinXp
};
