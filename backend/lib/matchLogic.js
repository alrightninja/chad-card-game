const LIVE_TURN_MS = 3 * 60 * 1000;
const WIN_REPS = 50;
const LOSS_REPS = 20;
const DRAW_REPS = 30;
const MIN_TURNS_FOR_LOSS_REPS = 5;

function canStartMode(existingModes, requestedMode) {
  const mode = requestedMode === "correspondence" ? "correspondence" : "live";
  return !existingModes.includes(mode);
}

function clockKey(state) {
  return `${state?.turn || 1}:${state?.turnPlayer || "player"}`;
}

function isHumanTurn(match, turnPlayer) {
  if (turnPlayer === "player") return true;
  return match?.opponentType === "user";
}

function nextLiveDeadline(match, stateBefore, stateAfter, now = Date.now()) {
  if (match?.mode !== "live") return match?.moveDeadlineAt || null;
  if (stateAfter?.winner) return null;
  if (clockKey(stateBefore) === clockKey(stateAfter)) {
    return match.moveDeadlineAt || null;
  }
  if (!isHumanTurn(match, stateAfter.turnPlayer)) return null;
  return new Date(now + LIVE_TURN_MS);
}

function finishReps({ opponentType, winner, forfeit = false, turn = 1 }) {
  let player =
    winner === "player" ? WIN_REPS : winner === "draw" ? DRAW_REPS : LOSS_REPS;
  let opponent =
    winner === "opponent" ? WIN_REPS : winner === "draw" ? DRAW_REPS : LOSS_REPS;

  if (forfeit) {
    if (winner === "player") player = WIN_REPS;
    else player = 0;
    if (winner === "opponent") opponent = WIN_REPS;
    else opponent = 0;
    if (opponentType === "ai") {
      return { player: 0, opponent: 0 };
    }
    return { player, opponent };
  }

  if ((turn || 1) < MIN_TURNS_FOR_LOSS_REPS) {
    if (winner === "opponent") player = 0;
    if (winner === "player") opponent = 0;
  }

  return { player, opponent };
}

module.exports = {
  LIVE_TURN_MS,
  WIN_REPS,
  LOSS_REPS,
  DRAW_REPS,
  MIN_TURNS_FOR_LOSS_REPS,
  canStartMode,
  clockKey,
  isHumanTurn,
  nextLiveDeadline,
  finishReps
};
