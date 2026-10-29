/**
 * Official Rulebook v3.0 §1 / §14:
 * A player loses when they have no Active Units, no Benched Units,
 * and no Units left in hand to play.
 *
 * Direct damage (Unblockable) can also end the game via health.
 */
function sideEliminated(side) {
  if (!side) return true;
  return (
    (side.active || []).length === 0 &&
    (side.bench || []).length === 0 &&
    (side.hand || []).length === 0
  );
}

function checkWin(state) {
  if (state.winner) return true;

  const playerDead =
    sideEliminated(state.player) || (state.player.health ?? 100) <= 0;
  const opponentDead =
    sideEliminated(state.opponent) || (state.opponent.health ?? 100) <= 0;

  if (playerDead && opponentDead) {
    state.winner = "draw";
    state.log.push("Both players are eliminated. Draw.");
    return true;
  }

  if (playerDead) {
    state.winner = "opponent";
    state.log.push("Player has no Units left. Opponent wins.");
    return true;
  }

  if (opponentDead) {
    state.winner = "player";
    state.log.push("Opponent has no Units left. Player wins.");
    return true;
  }

  return false;
}

module.exports = { checkWin, sideEliminated };
