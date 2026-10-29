const { resolveCoinFlip } = require("./battle");
const { getById } = require("./cardRegistry");
const { HAND_LIMIT, TRAIT_BONUS, MAX_ACTIVE, MAX_BENCH } = require("./rules");

function stampPrintedPower(unit) {
  if (!unit || unit.printedPower != null) return unit;
  const catalog = unit.cardId ? getById(unit.cardId) : null;
  if (catalog && catalog.power != null) unit.printedPower = catalog.power;
  return unit;
}

function stampSide(side) {
  if (!side) return;
  ["hand", "active", "bench", "discard", "deck"].forEach((zone) => {
    if (Array.isArray(side[zone])) side[zone].forEach(stampPrintedPower);
  });
}

const MAX_LOG = 80;

function serializeState(state) {
  const copy = JSON.parse(JSON.stringify(state));
  delete copy.resolveCoinFlip;
  if (Array.isArray(copy.log) && copy.log.length > MAX_LOG) {
    copy.log = copy.log.slice(-MAX_LOG);
  }
  if (copy.secretLog) {
    for (const seat of ["player", "opponent"]) {
      const lines = copy.secretLog[seat];
      if (Array.isArray(lines) && lines.length > MAX_LOG) {
        copy.secretLog[seat] = lines.slice(-MAX_LOG);
      }
    }
  }
  return copy;
}

function hydrateState(raw) {
  const state = JSON.parse(JSON.stringify(raw || {}));
  delete state.resolveCoinFlip;
  state.resolveCoinFlip = resolveCoinFlip;
  if (!Array.isArray(state.log)) state.log = [];
  if (!state.player) state.player = {};
  if (!state.opponent) state.opponent = {};
  stampSide(state.player);
  stampSide(state.opponent);
  if (!state.player.guardInstanceId) state.player.guardInstanceId = null;
  if (!state.opponent.guardInstanceId) state.opponent.guardInstanceId = null;
  if (!state.secretLog) state.secretLog = { player: [], opponent: [] };
  return state;
}

/**
 * Hide the opponent's hand and deck from the client.
 * Safe to send to browsers or a future mobile app.
 */
function publicMatchState(state, perspective = "player") {
  const serialized = serializeState(state);
  const secret = (serialized.secretLog && serialized.secretLog[perspective]) || [];
  delete serialized.secretLog;
  const you = perspective === "opponent" ? serialized.opponent : serialized.player;
  const them = perspective === "opponent" ? serialized.player : serialized.opponent;

  function stampCombat(side) {
    if (!side) return;
    const gid = side.guardInstanceId;
    ["active", "bench"].forEach((zone) => {
      (side[zone] || []).forEach((unit) => {
        if (!unit) return;
        unit.guarding = !!(gid && unit.instanceId === gid);
        unit.tired = (unit.tiredTurns || 0) > 0;
      });
    });
  }
  stampCombat(you);
  stampCombat(them);

  return {
    turnPlayer: serialized.turnPlayer,
    phase: serialized.phase,
    turn: serialized.turn || 1,
    handLimit: HAND_LIMIT,
    traitBonus: TRAIT_BONUS,
    maxActive: MAX_ACTIVE,
    maxBench: MAX_BENCH,
    winner: serialized.winner || null,
    skipTurn: serialized.skipTurn || null,
    lastBattle: serialized.lastBattle || null,
    log: [...(serialized.log || []), ...secret].slice(-MAX_LOG),
    you: {
      health: you.health,
      silencedTurns: you.silencedTurns || 0,
      guardInstanceId: you.guardInstanceId || null,
      hand: you.hand,
      active: you.active,
      bench: you.bench,
      discard: you.discard,
      deckCount: (you.deck || []).length
    },
    opponent: {
      health: them.health,
      silencedTurns: them.silencedTurns || 0,
      guardInstanceId: them.guardInstanceId || null,
      handCount: (them.hand || []).length,
      active: them.active,
      bench: them.bench,
      discard: them.discard,
      deckCount: (them.deck || []).length
    }
  };
}

module.exports = { serializeState, hydrateState, publicMatchState };
