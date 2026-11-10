const registry = require("../engine/cardRegistry");
const { progressFromTotalXp } = require("./xp");

function avatarFields(user) {
  const avatarCardId = user.avatarCardId || null;
  const card = avatarCardId ? registry.getById(avatarCardId) : null;
  return {
    avatarCardId,
    avatarArt: card?.art || null,
    avatarName: card?.name || null
  };
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user._id,
    username: user.username,
    verified: !!user.verified,
    level: user.level || 1,
    ...avatarFields(user)
  };
}

function xpFields(user) {
  const xp = user.xp || 0;
  const progress = progressFromTotalXp(xp);
  return {
    xp,
    level: progress.level,
    xpIntoLevel: progress.xpIntoLevel,
    xpForNext: progress.xpForNext
  };
}

function safeMe(user) {
  if (!user) return null;
  return {
    id: user._id,
    email: user.email,
    username: user.username,
    verified: !!user.verified,
    tutorialCompleted: !!user.tutorialCompleted,
    currency: user.currency || { reps: 0 },
    termsAcceptedAt: user.termsAcceptedAt || null,
    ...xpFields(user),
    ...avatarFields(user)
  };
}

function publicProfile(user) {
  if (!user) return null;
  const unique = new Set((user.collection || []).filter((id) => registry.getById(id)));
  return {
    ...publicUser(user),
    ...xpFields(user),
    uniqueCards: unique.size
  };
}

module.exports = { publicUser, safeMe, publicProfile, avatarFields, xpFields };
