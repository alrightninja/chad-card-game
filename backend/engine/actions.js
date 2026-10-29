// actions.js

const { applyAbility } = require("./abilities");
const { resolveBattle } = require("./battle");
const { endPhase } = require("./phases");
const { MAX_ACTIVE, MAX_BENCH } = require("./rules");

function enterPlay(state, playerState, cardIndex, destination) {
  const card = playerState.hand[cardIndex];
  playerState.hand.splice(cardIndex, 1);
  if (destination === "bench") {
    playerState.bench.push(card);
    state.log.push(`${card.name} is added to the Bench.`);
  } else {
    playerState.active.push(card);
    state.log.push(`${card.name} enters the field as an Active Unit.`);
  }

  if (card.abilityCategory === "Play" || card.abilityCategory === "Passive") {
    const enemy = playerState === state.player ? state.opponent : state.player;
    applyAbility(state, card, enemy.active[0] || null, card.ability);
  }
  card.playedThisTurn = true;
  return state;
}

/**
 * PLAY A UNIT
 * zone: "active" | "bench" | undefined (auto: Active first, then Bench)
 */
function playUnit(state, cardIndex, zone) {
  const playerState =
    state.turnPlayer === "player" ? state.player : state.opponent;

  const card = playerState.hand[cardIndex];
  if (!card) {
    throw new Error("Card not found in hand");
  }

  if (zone === "bench") {
    if (playerState.bench.length >= MAX_BENCH) {
      throw new Error(`Bench is full (max ${MAX_BENCH}).`);
    }
    return enterPlay(state, playerState, cardIndex, "bench");
  }

  if (zone === "active") {
    if (playerState.active.length >= MAX_ACTIVE) {
      throw new Error("Active row is full (max 3). Play to the Bench, or swap.");
    }
    return enterPlay(state, playerState, cardIndex, "active");
  }

  if (playerState.active.length < MAX_ACTIVE) {
    return enterPlay(state, playerState, cardIndex, "active");
  }
  if (playerState.bench.length < MAX_BENCH) {
    return enterPlay(state, playerState, cardIndex, "bench");
  }

  throw new Error("No space in Active or Bench.");
}

/**
 * Move a benched unit into an empty Active slot.
 */
function promoteFromBench(state, benchIndex) {
  const playerState =
    state.turnPlayer === "player" ? state.player : state.opponent;

  if (playerState.active.length >= MAX_ACTIVE) {
    throw new Error("Active row is full. Swap instead.");
  }
  const unit = playerState.bench[benchIndex];
  if (!unit) {
    throw new Error("No unit on that Bench slot.");
  }
  playerState.bench.splice(benchIndex, 1);
  playerState.active.push(unit);
  state.log.push(`${unit.name} moves from the Bench to Active.`);
  return state;
}

/**
 * SWAP ACTIVE UNIT
 */
function swapActive(state, activeIndex, benchIndex) {
  const playerState =
    state.turnPlayer === "player" ? state.player : state.opponent;

  if (
    activeIndex < 0 ||
    activeIndex >= playerState.active.length ||
    benchIndex < 0 ||
    benchIndex >= playerState.bench.length
  ) {
    state.log.push("Invalid swap indices.");
    return state;
  }

  const activeUnit = playerState.active[activeIndex];
  const benchUnit = playerState.bench[benchIndex];

  if (activeUnit.rooted) {
    state.log.push(`${activeUnit.name} is Rooted and cannot be swapped.`);
    return state;
  }

  playerState.active[activeIndex] = benchUnit;
  playerState.bench[benchIndex] = activeUnit;
  if (playerState.guardInstanceId === activeUnit.instanceId) {
    playerState.guardInstanceId = null;
    state.log.push(`${activeUnit.name} left Active, so Guard ends.`);
  }

  if (playerState.nextSwapBoost) {
    benchUnit.tempPower = (benchUnit.tempPower || 0) + playerState.nextSwapBoost;
    state.log.push(`${benchUnit.name} gains +${playerState.nextSwapBoost} from Swap Boost.`);
    playerState.nextSwapBoost = 0;
  }

  state.log.push(`${activeUnit.name} swaps with ${benchUnit.name}.`);
  return state;
}

/**
 * Mark one Active unit as Guard. The opponent must attack it.
 * Click the same unit again to clear.
 */
function setGuard(state, activeIndex) {
  const playerState =
    state.turnPlayer === "player" ? state.player : state.opponent;
  const unit = playerState.active[activeIndex];
  if (!unit) {
    throw new Error("No unit in that Active slot.");
  }
  if (playerState.guardInstanceId === unit.instanceId) {
    playerState.guardInstanceId = null;
    state.log.push(`${unit.name} is no longer Guard.`);
    return state;
  }
  playerState.guardInstanceId = unit.instanceId;
  state.log.push(
    `${unit.name} is Guard — the opponent must attack this unit.`
  );
  return state;
}

/**
 * ATTACK ACTION (supports team attacks)
 * First index is the LEAD (full Power). Extra indices ASSIST (half Power) and become Tired.
 * attackerIndices: number | number[]
 * defenderIndex: which enemy Active Unit is defending (rulebook §6)
 */
function attack(state, attackerIndices, defenderIndex = 0) {
  const playerState =
    state.turnPlayer === "player" ? state.player : state.opponent;
  const enemyState =
    state.turnPlayer === "player" ? state.opponent : state.player;

  if (state.phase === "end") {
    throw new Error("You already attacked this turn. End your turn.");
  }

  // Normalize input: allow single index or array
  const indices = Array.isArray(attackerIndices)
    ? attackerIndices
    : [attackerIndices];

  const attackers = [];
  for (const idx of indices) {
    if (idx < 0 || idx >= playerState.active.length) {
      throw new Error("Invalid attacker.");
    }
    const unit = playerState.active[idx];
    if (unit.stunned) {
      throw new Error(`${unit.name} is Stunned and cannot attack.`);
    }
    if ((unit.tiredTurns || 0) > 0) {
      throw new Error(`${unit.name} is Tired and cannot attack this turn.`);
    }
    attackers.push(unit);
  }
  if (!attackers.length) {
    throw new Error("Choose at least one attacker.");
  }

  const defIdx = Number.isInteger(defenderIndex) ? defenderIndex : 0;
  const defender = enemyState.active[defIdx];
  if (!defender) {
    state.log.push("Opponent has no Active Units left at that slot.");
    return state;
  }

  if (enemyState.guardInstanceId) {
    const guardIndex = enemyState.active.findIndex(
      (u) => u && u.instanceId === enemyState.guardInstanceId
    );
    if (guardIndex >= 0 && defIdx !== guardIndex) {
      throw new Error(
        `You must attack the Guard (${enemyState.active[guardIndex].name}).`
      );
    }
  }

  // Check silence
  if (playerState.silencedTurns && playerState.silencedTurns > 0) {
    state.log.push(
      `${state.turnPlayer} is silenced and cannot attack this turn.`
    );
    return state;
  }

  // Check unblockable (if any attacker has it)
  const unblockable = attackers.some(a => a.unblockable);

  if (state.phase === "main") state.phase = "battle";

  attackers.forEach((attacker) => {
    if (attacker.abilityCategory === "Attack") {
      applyAbility(state, attacker, defender, attacker.ability);
    }
  });

  if (state.cancelNextBattle) {
    state.cancelNextBattle = false;
    state.log.push("The battle is cancelled.");
    state.phase = "end";
    return state;
  }

  if (unblockable) {
    state.log.push(
      `${attackers.map(a => a.name).join(", ")} attack directly (Unblockable)!`
    );
    enemyState.health -= attackers.reduce((sum, a) => sum + a.power, 0);
    attackers.slice(1).forEach((unit) => {
      unit.tiredTurns = 2;
      state.log.push(`${unit.name} is Tired and cannot attack next turn.`);
    });
    state.phase = "end";
    return state;
  }

  resolveBattle(state, attackers, defender);

  attackers.slice(1).forEach((unit) => {
    unit.tiredTurns = 2;
    state.log.push(`${unit.name} is Tired and cannot attack next turn.`);
  });

  attackers.forEach((unit) => {
    if (!unit.pendingRetreat) return;
    unit.pendingRetreat = false;
    if (playerState.bench.length >= MAX_BENCH) return;
    const idx = playerState.active.indexOf(unit);
    if (idx < 0) return;
    playerState.active.splice(idx, 1);
    playerState.bench.push(unit);
    state.log.push(`${unit.name} retreats to the Bench.`);
  });

  if (attackers.length === 1) {
    const attacker = attackers[0];
    if (attacker.multiAttack && attacker.multiAttack > 1) {
      attacker.multiAttack -= 1;
      state.log.push(
        `${attacker.name} may attack again (${attacker.multiAttack} remaining).`
      );
      state.phase = "battle";
      return state;
    }
  }

  state.phase = "end";
  return state;
}

/**
 * END TURN ACTION
 */
function endTurn(state) {
  endPhase(state);

  const playerState =
    state.turnPlayer === "player" ? state.player : state.opponent;

  for (const unit of playerState.active) {
    unit.tempPower = 0;
    unit.playedThisTurn = false;

    if (unit.silencedTurns && unit.silencedTurns > 0) {
      unit.silencedTurns -= 1;
      if (unit.silencedTurns === 0) {
        unit.silenced = false;
      }
    }

    if (unit.multiAttack !== undefined) {
      unit.multiAttack = unit.baseMultiAttack || 1;
    }
    unit.stunned = false;
    if (unit.tiredTurns && unit.tiredTurns > 0) {
      unit.tiredTurns -= 1;
    }
  }

  // Reset bench units too
  for (const unit of playerState.bench) {
    unit.tempPower = 0;
    unit.playedThisTurn = false;

    if (unit.silencedTurns && unit.silencedTurns > 0) {
      unit.silencedTurns -= 1;
      if (unit.silencedTurns === 0) {
        unit.silenced = false;
      }
    }

    if (unit.multiAttack !== undefined) {
      unit.multiAttack = unit.baseMultiAttack || 1;
    }
    unit.stunned = false;
    if (unit.tiredTurns && unit.tiredTurns > 0) {
      unit.tiredTurns -= 1;
    }
  }

  state.cancelNextBattle = false;
  state.turnPlayer = state.turnPlayer === "player" ? "opponent" : "player";
  if (state.turnPlayer === "player") {
    state.turn = (state.turn || 1) + 1;
  }

  // Move to start phase
  state.phase = "start";

  state.log.push(`Turn ends. It is now ${state.turnPlayer}'s turn.`);

  return state;
}

module.exports = { playUnit, swapActive, attack, endTurn, promoteFromBench, setGuard, MAX_ACTIVE, MAX_BENCH };
