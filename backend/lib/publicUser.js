function publicUser(user) {
  if (!user) return null;
  return {
    id: user._id,
    username: user.username,
    verified: !!user.verified
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
    termsAcceptedAt: user.termsAcceptedAt || null
  };
}

module.exports = { publicUser, safeMe };
