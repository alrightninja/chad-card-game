const { publicUser } = require("./publicUser");

function idsEqual(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function refId(ref) {
  if (!ref) return null;
  return ref._id || ref;
}

function publicChallenge(challenge, viewerId) {
  if (!challenge?.fromUserId || !challenge?.toUserId) return null;
  return {
    id: challenge._id,
    mode: challenge.mode,
    hoursPerMove: challenge.hoursPerMove,
    koLimit: challenge.koLimit || 5,
    fromDeckName: challenge.fromDeckName,
    from: publicUser(challenge.fromUserId),
    to: publicUser(challenge.toUserId),
    incoming: idsEqual(refId(challenge.toUserId), viewerId)
  };
}

module.exports = { idsEqual, refId, publicChallenge };
