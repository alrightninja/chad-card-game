const mongoose = require("mongoose");
const Match = require("../models/Match");
const User = require("../models/User");
const { createInitialGameState } = require("../engine/gameState");
const { applyAction } = require("../engine/applyAction");
const {
  serializeState,
  hydrateState,
  publicMatchState,
  compactFinishedState
} = require("../engine/serializeState");

const FINISHED_KEEP_MS = 60 * 60 * 1000;
const LIVE_TURN_MS = 3 * 60 * 1000;
const {
  shuffle,
  deckToUnits,
  randomAiDeckIds
} = require("../engine/cardRegistry");

const WIN_REPS = 50;
const LOSS_REPS = 20;
const DRAW_REPS = 30;

function validateDeck(deck) {
  if (!deck) {
    const err = new Error("Deck not found");
    err.status = 404;
    throw err;
  }
  if (!Array.isArray(deck.cards) || deck.cards.length !== 40) {
    const err = new Error("Deck must contain exactly 40 cards");
    err.status = 400;
    throw err;
  }
  const counts = {};
  for (const id of deck.cards) {
    counts[id] = (counts[id] || 0) + 1;
    if (counts[id] > 3) {
      const err = new Error(`Deck contains too many copies of card: ${id}`);
      err.status = 400;
      throw err;
    }
  }
}

function seatForUser(match, userId) {
  if (String(match.playerId) === String(userId)) return "player";
  if (match.opponentUserId && String(match.opponentUserId) === String(userId)) {
    return "opponent";
  }
  return null;
}

function nextDeadline(match) {
  if (match.mode !== "correspondence" || !match.hoursPerMove) return null;
  return new Date(Date.now() + match.hoursPerMove * 60 * 60 * 1000);
}

function isHumanTurn(match, turnPlayer) {
  if (turnPlayer === "player") return true;
  return match.opponentType === "user";
}

function liveDeadlineFor(match, state, winner) {
  if (match.mode !== "live" || winner || !state) return null;
  if (!isHumanTurn(match, state.turnPlayer)) return null;
  return new Date(Date.now() + LIVE_TURN_MS);
}

function repsForSeat(match, seat) {
  const r = match.rewards || {};
  if (seat === "opponent") return r.opponent != null ? r.opponent : r.reps || 0;
  return r.player != null ? r.player : r.reps || 0;
}

function toClient(match, userId) {
  const state = hydrateState(match.state);
  const seat = userId ? seatForUser(match, userId) : "player";
  const perspective = seat || "player";
  return {
    id: match._id,
    status: match.status,
    winner: match.winner,
    version: match.version,
    deckName: match.deckName,
    opponentDeckName: match.opponentDeckName,
    opponentType: match.opponentType,
    mode: match.mode || "live",
    hoursPerMove: match.hoursPerMove,
    moveDeadlineAt: match.moveDeadlineAt,
    versus: match.opponentType === "ai" ? "AI" : "Friend",
    yourSeat: perspective,
    youName: perspective === "opponent" ? match.opponentUsername : match.playerUsername,
    opponentName:
      perspective === "opponent"
        ? match.playerUsername
        : match.opponentUsername || (match.opponentType === "ai" ? "AI" : "Opponent"),
    rewards: { reps: repsForSeat(match, perspective) },
    tutorial: !!match.tutorial,
    state: publicMatchState(state, perspective)
  };
}

async function awardAndFinish(match) {
  if (match.status === "finished") return;

  const playerReps =
    match.winner === "player" ? WIN_REPS : match.winner === "draw" ? DRAW_REPS : LOSS_REPS;
  const opponentReps =
    match.winner === "opponent" ? WIN_REPS : match.winner === "draw" ? DRAW_REPS : LOSS_REPS;

  match.status = "finished";
  match.rewards = { reps: playerReps, player: playerReps, opponent: opponentReps };
  match.moveDeadlineAt = null;
  match.set("state", compactFinishedState(hydrateState(match.state)));
  match.markModified("state");
  match.purgeAt = new Date(Date.now() + FINISHED_KEEP_MS);
  await match.save();

  const player = await User.findById(match.playerId);
  if (player) {
    player.currency.reps = (player.currency.reps || 0) + playerReps;
    await player.save();
  }

  if (match.opponentType === "user" && match.opponentUserId) {
    const opponent = await User.findById(match.opponentUserId);
    if (opponent) {
      opponent.currency.reps = (opponent.currency.reps || 0) + opponentReps;
      await opponent.save();
    }
  }
}

async function settleLiveTurnTimeout(match) {
  const state = hydrateState(match.state);
  const late = state.turnPlayer === "opponent" ? "opponent" : "player";
  const strikes = {
    player: match.timeoutStrikes?.player || 0,
    opponent: match.timeoutStrikes?.opponent || 0
  };
  strikes[late] = (strikes[late] || 0) + 1;
  match.timeoutStrikes = strikes;
  match.markModified("timeoutStrikes");
  state.log = state.log || [];

  if (strikes[late] >= 2) {
    match.winner = late === "player" ? "opponent" : "player";
    state.winner = match.winner;
    state.log.push("Time ran out twice in a row. Automatic forfeit.");
    match.version += 1;
    match.set("state", serializeState(state));
    match.markModified("state");
    await awardAndFinish(match);
    return match;
  }

  state.log.push("Turn timer expired. The turn passes.");
  const autoAi = match.opponentType === "ai";
  applyAction(state, { type: "endTurn" }, { autoAi, actor: late });
  match.winner = state.winner || null;
  match.version += 1;
  match.set("state", serializeState(state));
  match.markModified("state");
  if (state.winner) {
    await awardAndFinish(match);
    return match;
  }
  match.moveDeadlineAt = liveDeadlineFor(match, state, null);
  await match.save();
  return match;
}

async function settleIfTimedOut(match) {
  if (!match || match.status !== "active" || !match.moveDeadlineAt) return match;
  if (new Date() < new Date(match.moveDeadlineAt)) return match;

  if (match.mode === "live") {
    return settleLiveTurnTimeout(match);
  }
  if (match.mode !== "correspondence") return match;

  const state = hydrateState(match.state);
  const late = state.turnPlayer === "opponent" ? "opponent" : "player";
  match.winner = late === "player" ? "opponent" : "player";
  state.winner = match.winner;
  state.log = state.log || [];
  state.log.push("Time ran out on this correspondence game.");
  match.version += 1;
  match.set("state", serializeState(state));
  match.markModified("state");
  await awardAndFinish(match);
  return match;
}

async function startPveMatch(user, deckName, options = {}) {
  const deck = user.decks.find((d) => d.name === deckName);
  validateDeck(deck);

  const existing = await getActiveMatch(user._id);
  if (existing) {
    const err = new Error("You already have an active match. Resume or forfeit it first.");
    err.status = 409;
    err.payload = { match: toClient(existing, user._id) };
    throw err;
  }

  const playerUnits = shuffle(deckToUnits(deck.cards));
  const aiUnits = shuffle(deckToUnits(randomAiDeckIds(40)));
  const state = createInitialGameState(playerUnits, aiUnits);

  const match = await Match.create({
    playerId: user._id,
    opponentType: "ai",
    deckName,
    mode: "live",
    tutorial: !!options.tutorial,
    status: "active",
    state: serializeState(state),
    version: 1,
    playerUsername: user.username,
    opponentUsername: "AI",
    moveDeadlineAt: liveDeadlineFor({ mode: "live", opponentType: "ai" }, state, null)
  });

  return toClient(match, user._id);
}

async function startPvpMatch({
  playerUser,
  opponentUser,
  playerDeckName,
  opponentDeckName,
  mode = "correspondence",
  hoursPerMove = 24
}) {
  const playerDeck = playerUser.decks.find((d) => d.name === playerDeckName);
  const opponentDeck = opponentUser.decks.find((d) => d.name === opponentDeckName);
  validateDeck(playerDeck);
  validateDeck(opponentDeck);

  const playerUnits = shuffle(deckToUnits(playerDeck.cards));
  const opponentUnits = shuffle(deckToUnits(opponentDeck.cards));
  const state = createInitialGameState(playerUnits, opponentUnits);

  const match = await Match.create({
    playerId: playerUser._id,
    opponentType: "user",
    opponentUserId: opponentUser._id,
    deckName: playerDeckName,
    opponentDeckName,
    mode,
    hoursPerMove: mode === "correspondence" ? hoursPerMove : null,
    moveDeadlineAt:
      mode === "correspondence"
        ? nextDeadline({ mode, hoursPerMove })
        : liveDeadlineFor({ mode, opponentType: "user" }, state, null),
    playerUsername: playerUser.username,
    opponentUsername: opponentUser.username,
    status: "active",
    state: serializeState(state),
    version: 1
  });

  return match;
}

function userMatchQuery(userId) {
  return {
    $or: [{ playerId: userId }, { opponentUserId: userId }]
  };
}

async function getActiveMatch(userId) {
  for (let i = 0; i < 4; i += 1) {
    const match = await Match.findOne({
      ...userMatchQuery(userId),
      status: "active"
    }).sort({ updatedAt: -1 });
    if (!match) return null;
    const settled = await settleIfTimedOut(match);
    if (settled.status === "active") return settled;
  }
  return null;
}

async function listMatchesForUser(userId, limit = 20) {
  return Match.find(userMatchQuery(userId)).sort({ updatedAt: -1 }).limit(limit);
}

async function getMatchForUser(userId, matchId) {
  if (!mongoose.Types.ObjectId.isValid(matchId)) {
    const err = new Error("Match not found");
    err.status = 404;
    throw err;
  }
  const match = await Match.findOne({
    _id: matchId,
    ...userMatchQuery(userId)
  });
  if (!match) {
    const err = new Error("Match not found");
    err.status = 404;
    throw err;
  }
  return settleIfTimedOut(match);
}

async function forfeitMatch(user, matchId) {
  const match = await getMatchForUser(user._id, matchId);
  if (match.status !== "active") {
    const err = new Error("Match is already over");
    err.status = 400;
    throw err;
  }
  const seat = seatForUser(match, user._id);
  if (!seat) {
    const err = new Error("You are not in this match");
    err.status = 403;
    throw err;
  }

  const state = hydrateState(match.state);
  match.winner = seat === "player" ? "opponent" : "player";
  state.winner = match.winner;
  state.log = state.log || [];
  state.log.push(`${user.username} forfeited.`);
  match.version += 1;
  match.set("state", serializeState(state));
  match.markModified("state");
  await awardAndFinish(match);
  return toClient(match, user._id);
}

async function applyMatchAction(user, matchId, action) {
  const match = await getMatchForUser(user._id, matchId);
  if (match.status !== "active") {
    const err = new Error("Match is already over");
    err.status = 400;
    throw err;
  }

  const actor = seatForUser(match, user._id);
  if (!actor) {
    const err = new Error("You are not in this match");
    err.status = 403;
    throw err;
  }

  const state = hydrateState(match.state);
  const turnBefore = state.turnPlayer;
  const autoAi = match.opponentType === "ai";
  const replay = [];
  const perspective = actor;
  try {
    applyAction(state, action, {
      autoAi,
      actor,
      onStep(event) {
        replay.push({
          kind: event.kind,
          attackerIndices: event.attackerIndices,
          defenderIndex: event.defenderIndex,
          from: event.from,
          battle: event.battle || null,
          state: JSON.parse(
            JSON.stringify(publicMatchState(serializeState(state), perspective))
          )
        });
      }
    });
  } catch (err) {
    err.status = err.status || 400;
    throw err;
  }

  const serialized = serializeState(state);
  const winner = state.winner || null;
  match.winner = winner;
  if (state.turnPlayer !== turnBefore) {
    const strikes = {
      player: match.timeoutStrikes?.player || 0,
      opponent: match.timeoutStrikes?.opponent || 0
    };
    strikes[turnBefore] = 0;
    match.timeoutStrikes = strikes;
    match.markModified("timeoutStrikes");
  }
  if (winner) {
    match.moveDeadlineAt = null;
  } else if (match.mode === "live") {
    if (state.turnPlayer !== turnBefore) {
      match.moveDeadlineAt = liveDeadlineFor(match, state, null);
    }
  } else {
    match.moveDeadlineAt = nextDeadline(match);
  }
  match.version += 1;
  match.set("state", serialized);
  match.markModified("state");
  await match.save();

  const saved = await getMatchForUser(user._id, matchId);

  if (winner) {
    await awardAndFinish(saved);
  }

  const freshUser = await User.findById(user._id);
  return {
    payload: { ...toClient(saved, user._id), replay },
    user: freshUser
  };
}

module.exports = {
  toClient,
  startPveMatch,
  startPvpMatch,
  getActiveMatch,
  listMatchesForUser,
  getMatchForUser,
  applyMatchAction,
  forfeitMatch,
  seatForUser,
  WIN_REPS,
  LOSS_REPS,
  LIVE_TURN_MS
};
