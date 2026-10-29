// phases.js
const { applyAbility } = require("./abilities");
const { HAND_LIMIT } = require("./rules");

/**
 * START PHASE
 * - Clear tempPower
 * - Trigger start-of-turn passives
 */
function startPhase(state) {
  const playerState =
    state.turnPlayer === "player" ? state.player : state.opponent;

  if (playerState.silencedTurns && playerState.silencedTurns > 0) {
    playerState.silencedTurns -= 1;
  }

  if (playerState.guardInstanceId) {
    const guard = (playerState.active || []).find(
      (u) => u && u.instanceId === playerState.guardInstanceId
    );
    if (guard) {
      state.log.push(`${guard.name}'s Guard ends.`);
    }
    playerState.guardInstanceId = null;
  }

  if ((playerState.deck || []).length > 0) {
    const drawn = playerState.deck.shift();
    playerState.hand.push(drawn);
    const who = state.turnPlayer === "player" ? "Player" : "Opponent";
    state.log.push(`${who} draws a card.`);
  } else if (!(playerState.deck || []).length) {
    const who = state.turnPlayer === "player" ? "Player" : "Opponent";
    state.log.push(`${who} cannot draw — deck is empty.`);
  }

  // Clear tempPower on all units
  playerState.active.forEach(unit => {
    unit.tempPower = 0;
  });

  playerState.bench.forEach(unit => {
    unit.tempPower = 0;
  });

  // Trigger start-timing passive abilities
  playerState.active.forEach(unit => {
    if (unit.abilityCategory === "Passive" && unit.timing === "start") {
      applyAbility(state, unit, null, unit.ability);
    }
  });

  return state;
}

/**
 * MAIN PHASE
 * - Nothing automatic happens here
 * - Player chooses actions (play, swap, attack, end turn)
 */
function mainPhase(state) {
  return state;
}

/**
 * BATTLE PHASE
 * - No automatic battle
 * - Player must call attack() manually
 */
function battlePhase(state) {
  // Nothing happens automatically
  return state;
}

/**
 * END PHASE
 * - Trigger end-of-turn passives
 */
function discardToHandLimit(state) {
  const playerState =
    state.turnPlayer === "player" ? state.player : state.opponent;
  let dumped = 0;
  while ((playerState.hand || []).length > HAND_LIMIT) {
    const card = playerState.hand.shift();
    playerState.discard.push(card);
    dumped += 1;
    state.log.push(`${card.name} is discarded (hand limit ${HAND_LIMIT}).`);
  }
  if (dumped) {
    const who = state.turnPlayer === "player" ? "Player" : "Opponent";
    state.log.push(`${who} discards down to ${HAND_LIMIT}.`);
  }
  return state;
}

function endPhase(state) {
  const playerState =
    state.turnPlayer === "player" ? state.player : state.opponent;

  playerState.active.forEach((unit) => {
    if (unit.abilityCategory === "Passive" && unit.timing === "end") {
      applyAbility(state, unit, null, unit.ability);
    }
  });

  discardToHandLimit(state);
  return state;
}

module.exports = {
  startPhase,
  mainPhase,
  battlePhase,
  endPhase,
  discardToHandLimit
};
