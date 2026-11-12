const { resolveCoinFlip, resetCombatForPlay } = require("./battle");
const { OPENING_HAND, HAND_LIMIT, clampKoLimit, KO_LIMIT_DEFAULT } = require("./rules");

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
    extraSwaps: 0,
    kos: 0
  };
}

function tryDraw(side, count = 1) {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if ((side.hand || []).length >= HAND_LIMIT) break;
    if (!(side.deck || []).length) break;
    side.hand.push(resetCombatForPlay(side.deck.shift()));
    drawn += 1;
  }
  return drawn;
}

function drawCards(side, count) {
  return tryDraw(side, count);
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

module.exports = { createInitialGameState, drawCards, tryDraw, OPENING_HAND };
