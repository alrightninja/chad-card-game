const express = require("express");
const User = require("../models/User");
const Trade = require("../models/Trade");
const requireAuth = require("../middleware/requireAuth");
const { notifyUser } = require("../sockets/matchSocket");
const { assertOffer, publicTrade } = require("../lib/trade");
const { takeCopies, pruneDecksToCollection } = require("../lib/inventory");

const router = express.Router();

function idsEqual(a, b) {
  return String(a) === String(b);
}

function isFriend(user, otherId) {
  return (user.friends || []).some((id) => idsEqual(id, otherId));
}

async function loadTrade(id, userId) {
  const trade = await Trade.findById(id);
  if (!trade) {
    const err = new Error("Trade not found");
    err.status = 404;
    throw err;
  }
  if (!idsEqual(trade.fromUserId, userId) && !idsEqual(trade.toUserId, userId)) {
    const err = new Error("Trade not found");
    err.status = 404;
    throw err;
  }
  return trade;
}

router.get("/trades", requireAuth, async (req, res) => {
  try {
    const trades = await Trade.find({
      $or: [{ fromUserId: req.user._id }, { toUserId: req.user._id }]
    })
      .sort({ createdAt: -1 })
      .limit(80);
    res.json({ trades: trades.map((t) => publicTrade(t, req.user._id)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/trades", requireAuth, async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const target = await User.findOne({ username });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (idsEqual(target._id, req.user._id)) {
      return res.status(400).json({ error: "You cannot trade with yourself" });
    }
    const me = await User.findById(req.user._id);
    if (!isFriend(me, target._id)) {
      return res.status(400).json({ error: "You can only trade with friends" });
    }
    const { give, want } = assertOffer(req.body.give, req.body.want, me.collection, target.collection);
    const trade = await Trade.create({
      fromUserId: me._id,
      toUserId: target._id,
      fromUsername: me.username,
      toUsername: target.username,
      give,
      want,
      status: "pending"
    });
    notifyUser(target._id, "trade_update", { kind: "incoming", tradeId: trade._id });
    res.json({ trade: publicTrade(trade, me._id) });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
});

router.post("/trades/:id/accept", requireAuth, async (req, res) => {
  try {
    const trade = await loadTrade(req.params.id, req.user._id);
    if (trade.status !== "pending") {
      return res.status(400).json({ error: "This offer is no longer pending" });
    }
    if (!idsEqual(trade.toUserId, req.user._id)) {
      return res.status(400).json({ error: "Only the recipient can accept" });
    }
    const from = await User.findById(trade.fromUserId);
    const to = await User.findById(trade.toUserId);
    if (!from || !to) return res.status(404).json({ error: "User not found" });

    from.collection = takeCopies(from.collection, trade.give);
    to.collection = takeCopies(to.collection, trade.want);
    from.collection.push(...trade.want);
    to.collection.push(...trade.give);
    pruneDecksToCollection(from);
    pruneDecksToCollection(to);
    if (from.avatarCardId && !from.collection.includes(from.avatarCardId)) {
      from.avatarCardId = null;
    }
    if (to.avatarCardId && !to.collection.includes(to.avatarCardId)) {
      to.avatarCardId = null;
    }
    trade.status = "accepted";
    await from.save();
    await to.save();
    await trade.save();
    notifyUser(from._id, "trade_update", { kind: "accepted", tradeId: trade._id });
    res.json({ trade: publicTrade(trade, req.user._id) });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
});

router.post("/trades/:id/reject", requireAuth, async (req, res) => {
  try {
    const trade = await loadTrade(req.params.id, req.user._id);
    if (trade.status !== "pending") {
      return res.status(400).json({ error: "This offer is no longer pending" });
    }
    if (!idsEqual(trade.toUserId, req.user._id)) {
      return res.status(400).json({ error: "Only the recipient can reject" });
    }
    trade.status = "rejected";
    await trade.save();
    notifyUser(trade.fromUserId, "trade_update", { kind: "rejected", tradeId: trade._id });
    res.json({ trade: publicTrade(trade, req.user._id) });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
});

router.post("/trades/:id/cancel", requireAuth, async (req, res) => {
  try {
    const trade = await loadTrade(req.params.id, req.user._id);
    if (trade.status !== "pending") {
      return res.status(400).json({ error: "This offer is no longer pending" });
    }
    if (!idsEqual(trade.fromUserId, req.user._id)) {
      return res.status(400).json({ error: "Only the sender can cancel" });
    }
    trade.status = "cancelled";
    await trade.save();
    notifyUser(trade.toUserId, "trade_update", { kind: "cancelled", tradeId: trade._id });
    res.json({ trade: publicTrade(trade, req.user._id) });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
});

router.post("/trades/:id/counter", requireAuth, async (req, res) => {
  try {
    const trade = await loadTrade(req.params.id, req.user._id);
    if (trade.status !== "pending") {
      return res.status(400).json({ error: "This offer is no longer pending" });
    }
    if (!idsEqual(trade.toUserId, req.user._id)) {
      return res.status(400).json({ error: "Only the recipient can counter" });
    }
    const me = await User.findById(req.user._id);
    const other = await User.findById(trade.fromUserId);
    if (!me || !other) return res.status(404).json({ error: "User not found" });
    const { give, want } = assertOffer(req.body.give, req.body.want, me.collection, other.collection);
    trade.status = "countered";
    await trade.save();
    const next = await Trade.create({
      fromUserId: me._id,
      toUserId: other._id,
      fromUsername: me.username,
      toUsername: other.username,
      give,
      want,
      status: "pending",
      parentId: trade._id
    });
    notifyUser(other._id, "trade_update", { kind: "counter", tradeId: next._id });
    res.json({ trade: publicTrade(next, me._id), previous: publicTrade(trade, me._id) });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
});

module.exports = router;
