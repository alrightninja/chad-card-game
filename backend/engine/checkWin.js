/**
 * A player loses when they have no Active Units and no Benched Units.
 * A hand does not keep you in the game once you have no board.
 * Opening setup is exempt until a unit has been KO'd/discarded or turn 2 begins.
 */
function fieldEmpty(side) {
  if (!side) return true;
  return (side.active || []).length === 0 && (side.bench || []).length === 0;
}

function sideEliminated(side, state) {
  if (!side) return true;
  if ((side.health ?? 100) <= 0) return true;
  if (!fieldEmpty(side)) return false;
  const opened = (state?.turn || 1) > 1 || (side.discard || []).length > 0;
  if (!opened && (side.hand || []).length > 0) return false;
  return true;
}

function checkWin(state) {
  if (state.winner) return true;

  const playerDead = sideEliminated(state.player, state);
  const opponentDead = sideEliminated(state.opponent, state);

  if (playerDead && opponentDead) {
    state.winner = "draw";
    state.log.push("Both players are eliminated. Draw.");
    return true;
  }

  if (playerDead) {
    state.winner = "opponent";
    state.log.push("Player has no units in play. Opponent wins.");
    return true;
  }

  if (opponentDead) {
    state.winner = "player";
    state.log.push("Opponent has no units in play. Player wins.");
    return true;
  }

  return false;
}

module.exports = { checkWin, sideEliminated, fieldEmpty };
