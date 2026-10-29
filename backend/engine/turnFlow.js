// turnFlow.js
const { startPhase, mainPhase, battlePhase, endPhase } = require("./phases");

function advancePhase(state) {
  const order = ["start", "main", "battle", "end"];
  const currentIndex = order.indexOf(state.phase);

  // Skip turn if required
  if (state.skipTurn === state.turnPlayer) {
    state.log.push(`${state.turnPlayer} skips their turn.`);
    state.skipTurn = null;

    // Switch turn immediately
    state.turnPlayer = state.turnPlayer === "player" ? "opponent" : "player";
    state.phase = "start";
    return state;
  }

  // Run the phase logic
  if (state.phase === "start") startPhase(state);
  if (state.phase === "main") mainPhase(state);
  if (state.phase === "battle") battlePhase(state);
  if (state.phase === "end") endPhase(state);

  // Move to next phase
  if (currentIndex < order.length - 1) {
    state.phase = order[currentIndex + 1];
  } else {
    // End of turn → switch player
    state.turnPlayer = state.turnPlayer === "player" ? "opponent" : "player";
    state.phase = "start";
  }

  return state;
}

module.exports = { advancePhase };
