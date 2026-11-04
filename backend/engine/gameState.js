const { resolveCoinFlip, resetCombatForPlay } = require("./battle");
const { OPENING_HAND, clampKoLimit, KO_LIMIT_DEFAULT } = require("./rules");

function emptySide() {
  return {
    deck: [],
    hand: [],
    active: [],
    bench: [],
    discard: [],
    health: 100,
    silencedTurns: 0,
    guardInstanceId: null,
    benchMovesThisTurn: 0,
    kos: 0
  };
}

function drawCards(side, count) {
  for (let i = 0; i < count; i++) {
    if (!side.deck.length) break;
    side.hand.push(resetCombatForPlay(side.deck.shift()));
  }
}

function createInitialGameState(playerDeck, opponentDeck, options = {}) {
  const player = emptySide();
  const opponent = emptySide();

  player.deck = [...playerDeck];
  opponent.deck = [...opponentDeck];

  drawCards(player, OPENING_HAND);
  drawCards(opponent, OPENING_HAND);

  const koLimit = clampKoLimit(options.koLimit ?? KO_LIMIT_DEFAULT);

  return {
    player,
    opponent,
    turnPlayer: "player",
    phase: "main",
    turn: 1,
    winner: null,
    skipTurn: null,
    lastKoSeat: null,
    cancelNextBattle: false,
    koLimit,
    log: [
      "Battle started.",
      "Both players draw 5 cards.",
      "Player goes first and does not draw this turn.",
      "The opponent draws at the start of their first turn.",
      `First to ${koLimit} KOs wins.`
    ],
    resolveCoinFlip
  };
}

module.exports = { createInitialGameState, drawCards, OPENING_HAND };
