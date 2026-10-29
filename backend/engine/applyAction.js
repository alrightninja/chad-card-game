const { playUnit, swapActive, attack, endTurn, promoteFromBench, setGuard } = require("./actions");
const { startPhase } = require("./phases");
const { checkWin } = require("./checkWin");
const { aiTakeFullTurn } = require("./ai");

function currentSide(state) {
  return state.turnPlayer === "player" ? state.player : state.opponent;
}

function findHandIndex(side, action) {
  if (Number.isInteger(action.handIndex)) return action.handIndex;
  if (action.instanceId) {
    return side.hand.findIndex((c) => c.instanceId === action.instanceId);
  }
  if (action.cardId) {
    return side.hand.findIndex((c) => c.cardId === action.cardId);
  }
  return -1;
}

function beginTurnIfNeeded(state) {
  if (state.phase === "start") {
    startPhase(state);
    state.phase = "main";
  }
}

function assertTurn(state, actor) {
  if (state.turnPlayer !== actor) {
    throw new Error("Not your turn");
  }
}

function assertMain(state) {
  if (state.phase !== "main") {
    throw new Error("Play and swaps only during Main Phase — do those before you attack.");
  }
}

/**
 * Apply one action. `actor` is "player" or "opponent" (engine seats).
 */
function applyAction(state, action, options = {}) {
  const { autoAi = true, actor = "player", onStep } = options;
  const notify = typeof onStep === "function" ? onStep : () => {};

  if (!action || !action.type) {
    throw new Error("Action type is required");
  }
  if (state.winner) {
    throw new Error("Match is already over");
  }

  beginTurnIfNeeded(state);

  if (state.skipTurn === state.turnPlayer) {
    state.log.push(`${state.turnPlayer} skips their turn.`);
    state.skipTurn = null;
    endTurn(state);
    beginTurnIfNeeded(state);
    if (autoAi && state.turnPlayer === "opponent" && !state.winner) {
      aiTakeFullTurn(state, notify);
    }
    checkWin(state);
    return state;
  }

  switch (action.type) {
    case "play": {
      assertTurn(state, actor);
      assertMain(state);
      const index = findHandIndex(currentSide(state), action);
      if (index < 0) {
        throw new Error("Card not found in hand");
      }
      playUnit(state, index, action.zone);
      notify({ kind: "play", from: "you" });
      break;
    }
    case "promote": {
      assertTurn(state, actor);
      assertMain(state);
      promoteFromBench(state, action.benchIndex);
      notify({ kind: "promote", from: "you" });
      break;
    }
    case "swap": {
      assertTurn(state, actor);
      assertMain(state);
      swapActive(state, action.activeIndex, action.benchIndex);
      notify({ kind: "swap", from: "you" });
      break;
    }
    case "guard": {
      assertTurn(state, actor);
      assertMain(state);
      setGuard(state, action.activeIndex);
      notify({ kind: "guard", from: "you" });
      break;
    }
    case "attack": {
      assertTurn(state, actor);
      const attackerIndices = Array.isArray(action.attackerIndices)
        ? action.attackerIndices
        : [action.attackerIndices ?? action.attackerIndex];
      const defenderIndex = action.defenderIndex ?? 0;
      attack(state, attackerIndices, defenderIndex);
      notify({
        kind: "attack",
        attackerIndices,
        defenderIndex,
        from: "you",
        battle: state.lastBattle || null
      });
      break;
    }
    case "endTurn": {
      assertTurn(state, actor);
      endTurn(state);
      beginTurnIfNeeded(state);
      break;
    }
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }

  checkWin(state);

  if (autoAi && !state.winner && state.turnPlayer === "opponent") {
    aiTakeFullTurn(state, notify);
  }

  checkWin(state);
  return state;
}

module.exports = { applyAction, beginTurnIfNeeded };
