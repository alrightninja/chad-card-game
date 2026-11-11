const { resolveCoinFlip, ensureCombatStats, sweepDeadUnits } = require("./battle");
const { getById } = require("./cardRegistry");
const { HAND_LIMIT, TRAIT_BONUS, MAX_ACTIVE, MAX_BENCH, MAX_ASSISTS, MAX_BENCH_MOVES_PER_TURN, KO_LIMIT_DEFAULT } = require("./rules");
const { enforceBoardLimits } = require("./board");

function stampPrintedPower(unit) {
  if (!unit) return unit;
  if (unit.printedPower == null) {
    const catalog = unit.cardId ? getById(unit.cardId) : null;
    if (catalog && catalog.power != null) unit.printedPower = catalog.power;
  }
  return ensureCombatStats(unit);
}

function stampSide(side) {
  if (!side) return;
  ["hand", "active", "bench", "discard", "deck"].forEach((zone) => {
    if (Array.isArray(side[zone])) side[zone].forEach(stampPrintedPower);
  });
}

const MAX_LOG = 40;
const FINISHED_LOG = 12;

function slimSide(side) {
  if (!side) return side;
  return {
    ...side,
    deck: [],
    discard: []
  };
}

function compactFinishedState(state) {
  const copy = serializeState(state);
  delete copy.secretLog;
  delete copy.lastBattle;
  copy.log = Array.isArray(copy.log) ? copy.log.slice(-FINISHED_LOG) : [];
  copy.player = slimSide(copy.player);
  copy.opponent = slimSide(copy.opponent);
  return copy;
}

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
  sweepDeadUnits(state);
  enforceBoardLimits(state.player);
  enforceBoardLimits(state.opponent);
  if (!state.player.guardInstanceId) state.player.guardInstanceId = null;
  if (!state.opponent.guardInstanceId) state.opponent.guardInstanceId = null;
  if (state.player.benchMovesThisTurn == null) state.player.benchMovesThisTurn = 0;
  if (state.opponent.benchMovesThisTurn == null) state.opponent.benchMovesThisTurn = 0;
  if (state.player.kos == null) state.player.kos = 0;
  if (state.opponent.kos == null) state.opponent.kos = 0;
  if (state.koLimit == null) state.koLimit = KO_LIMIT_DEFAULT;
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
    maxAssists: MAX_ASSISTS,
    maxBenchMovesPerTurn: MAX_BENCH_MOVES_PER_TURN,
    koLimit: serialized.koLimit || KO_LIMIT_DEFAULT,
    winner: serialized.winner || null,
    skipTurn: serialized.skipTurn || null,
    lastBattle: serialized.lastBattle || null,
    log: [...(serialized.log || []), ...secret].slice(-MAX_LOG),
    you: {
      health: you.health,
      silencedTurns: you.silencedTurns || 0,
      guardInstanceId: you.guardInstanceId || null,
      benchMovesThisTurn: you.benchMovesThisTurn || 0,
      kos: you.kos || 0,
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
      kos: them.kos || 0,
      handCount: (them.hand || []).length,
      active: them.active,
      bench: them.bench,
      discard: them.discard,
      deckCount: (them.deck || []).length
    }
  };
}

module.exports = {
  serializeState,
  hydrateState,
  publicMatchState,
  compactFinishedState
};
