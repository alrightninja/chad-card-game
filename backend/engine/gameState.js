const { resolveCoinFlip } = require("./battle");
const { OPENING_HAND } = require("./rules");

function emptySide() {
  return {
    deck: [],
    hand: [],
    active: [],
    bench: [],
    discard: [],
    health: 100,
    silencedTurns: 0,
    guardInstanceId: null
  };
}

function drawCards(side, count) {
  for (let i = 0; i < count; i++) {
    if (!side.deck.length) break;
    side.hand.push(side.deck.shift());
  }
}

function createInitialGameState(playerDeck, opponentDeck) {
  const player = emptySide();
  const opponent = emptySide();

  player.deck = [...playerDeck];
  opponent.deck = [...opponentDeck];

  drawCards(player, OPENING_HAND);
  drawCards(opponent, OPENING_HAND);

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
    log: [
      "Battle started.",
      "Both players draw 5 cards.",
      "Player goes first and does not draw this turn.",
      "The opponent draws at the start of their first turn."
    ],
    resolveCoinFlip
  };
}

module.exports = { createInitialGameState, drawCards, OPENING_HAND };
