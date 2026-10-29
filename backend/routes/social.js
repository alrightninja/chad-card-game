const express = require("express");
const User = require("../models/User");
const Message = require("../models/Message");
const Challenge = require("../models/Challenge");
const requireAuth = require("../middleware/requireAuth");
const { publicUser } = require("../lib/publicUser");
const { sanitizeMessage } = require("../utils/moderation");
const matchService = require("../services/matchService");
const { notifyUser } = require("../sockets/matchSocket");

const router = express.Router();

function idsEqual(a, b) {
  return String(a) === String(b);
}

function isFriend(user, otherId) {
  return (user.friends || []).some((id) => idsEqual(id, otherId));
}

router.get("/friends", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("friends", "username verified")
      .populate("friendRequests", "username verified")
      .populate("sentRequests", "username verified");

    res.json({
      friends: (user.friends || []).map(publicUser),
      incoming: (user.friendRequests || []).map(publicUser),
      outgoing: (user.sentRequests || []).map(publicUser)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/friends/request", requireAuth, async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const target = await User.findOne({ username });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (idsEqual(target._id, req.user._id)) {
      return res.status(400).json({ error: "You cannot add yourself" });
    }
    if (isFriend(req.user, target._id)) {
      return res.status(400).json({ error: "Already friends" });
    }

    const me = await User.findById(req.user._id);
    if (me.sentRequests.some((id) => idsEqual(id, target._id))) {
      return res.status(400).json({ error: "Request already sent" });
    }
    if (me.friendRequests.some((id) => idsEqual(id, target._id))) {
      return res.status(400).json({ error: "They already sent you a request — accept it instead" });
    }

    me.sentRequests.push(target._id);
    target.friendRequests.push(me._id);
    await me.save();
    await target.save();
    res.json({ message: "Friend request sent", user: publicUser(target) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/friends/respond", requireAuth, async (req, res) => {
  try {
    const { userId, accept } = req.body;
    const me = await User.findById(req.user._id);
    const other = await User.findById(userId);
    if (!other) return res.status(404).json({ error: "User not found" });

    const incoming = me.friendRequests.find((id) => idsEqual(id, other._id));
    if (!incoming) return res.status(400).json({ error: "No request from that user" });

    me.friendRequests = me.friendRequests.filter((id) => !idsEqual(id, other._id));
    other.sentRequests = (other.sentRequests || []).filter((id) => !idsEqual(id, me._id));

    if (accept) {
      if (!me.friends.some((id) => idsEqual(id, other._id))) me.friends.push(other._id);
      if (!other.friends.some((id) => idsEqual(id, me._id))) other.friends.push(me._id);
    }

    await me.save();
    await other.save();
    res.json({ message: accept ? "Friend added" : "Request declined" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/friends/remove", requireAuth, async (req, res) => {
  try {
    const { userId } = req.body;
    const me = await User.findById(req.user._id);
    const other = await User.findById(userId);
    if (!other) return res.status(404).json({ error: "User not found" });

    me.friends = me.friends.filter((id) => !idsEqual(id, other._id));
    other.friends = (other.friends || []).filter((id) => !idsEqual(id, me._id));
    await me.save();
    await other.save();
    res.json({ message: "Friend removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/messages/:userId", requireAuth, async (req, res) => {
  try {
    const otherId = req.params.userId;
    if (!isFriend(req.user, otherId)) {
      return res.status(403).json({ error: "You can only message friends" });
    }
    const messages = await Message.find({
      $or: [
        { from: req.user._id, to: otherId },
        { from: otherId, to: req.user._id }
      ]
    })
      .sort({ createdAt: 1 })
      .limit(100);

    res.json({
      messages: messages.map((m) => ({
        id: m._id,
        from: m.from,
        to: m.to,
        body: m.body,
        createdAt: m.createdAt
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/messages", requireAuth, async (req, res) => {
  try {
    const { userId, body } = req.body;
    if (!isFriend(req.user, userId)) {
      return res.status(403).json({ error: "You can only message friends" });
    }
    const clean = sanitizeMessage(body);
    const message = await Message.create({
      from: req.user._id,
      to: userId,
      body: clean
    });
    const payload = {
      id: message._id,
      from: message.from,
      to: message.to,
      body: message.body,
      createdAt: message.createdAt
    };
    notifyUser(userId, "direct_message", payload);
    res.json({ message: payload });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
});

router.get("/challenges", requireAuth, async (req, res) => {
  try {
    const list = await Challenge.find({
      status: "pending",
      $or: [{ fromUserId: req.user._id }, { toUserId: req.user._id }]
    })
      .populate("fromUserId", "username verified")
      .populate("toUserId", "username verified")
      .sort({ createdAt: -1 });

    res.json({
      challenges: list.map((c) => ({
        id: c._id,
        mode: c.mode,
        hoursPerMove: c.hoursPerMove,
        fromDeckName: c.fromDeckName,
        from: publicUser(c.fromUserId),
        to: publicUser(c.toUserId),
        incoming: idsEqual(c.toUserId._id || c.toUserId, req.user._id)
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/challenges", requireAuth, async (req, res) => {
  try {
    const { username, deckName, mode, hoursPerMove } = req.body;
    const target = await User.findOne({ username: String(username || "").trim() });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (!isFriend(req.user, target._id)) {
      return res.status(403).json({ error: "You can only challenge friends" });
    }
    const deck = req.user.decks.find((d) => d.name === deckName);
    if (!deck) return res.status(400).json({ error: "Deck not found" });

    const challenge = await Challenge.create({
      fromUserId: req.user._id,
      toUserId: target._id,
      fromDeckName: deckName,
      mode: mode === "live" ? "live" : "correspondence",
      hoursPerMove: Number(hoursPerMove) > 0 ? Number(hoursPerMove) : 24
    });

    notifyUser(target._id, "challenge_update", { kind: "incoming", id: challenge._id });
    res.json({ message: "Challenge sent", id: challenge._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/challenges/:id/respond", requireAuth, async (req, res) => {
  try {
    const { accept, deckName } = req.body;
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge || challenge.status !== "pending") {
      return res.status(404).json({ error: "Challenge not found" });
    }
    if (!idsEqual(challenge.toUserId, req.user._id)) {
      return res.status(403).json({ error: "Not your challenge to answer" });
    }

    if (!accept) {
      challenge.status = "declined";
      await challenge.save();
      notifyUser(challenge.fromUserId, "challenge_update", { kind: "declined", id: challenge._id });
      return res.json({ message: "Challenge declined" });
    }

    if (!deckName) {
      return res.status(400).json({ error: "Choose a deck to accept" });
    }

    const fromUser = await User.findById(challenge.fromUserId);
    const toUser = await User.findById(req.user._id);
    const match = await matchService.startPvpMatch({
      playerUser: fromUser,
      opponentUser: toUser,
      playerDeckName: challenge.fromDeckName,
      opponentDeckName: deckName,
      mode: challenge.mode,
      hoursPerMove: challenge.hoursPerMove
    });

    challenge.status = "accepted";
    challenge.toDeckName = deckName;
    challenge.matchId = match._id;
    await challenge.save();

    const clientMatch = matchService.toClient(match, req.user._id);
    notifyUser(challenge.fromUserId, "challenge_update", {
      kind: "accepted",
      matchId: String(match._id)
    });

    res.json({
      message: "Match started",
      match: clientMatch
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
});

module.exports = router;
