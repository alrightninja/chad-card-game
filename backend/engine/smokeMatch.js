const { createInitialGameState } = require("./gameState");
const { applyAction } = require("./applyAction");
const { deckToUnits, shuffle, randomAiDeckIds, getAll } = require("./cardRegistry");
const { serializeState, publicMatchState } = require("./serializeState");

function firstFortyIds() {
  return getAll().slice(0, 40).map((c) => c.cardId);
}

function run() {
  const player = shuffle(deckToUnits(firstFortyIds()));
  const opponent = shuffle(deckToUnits(randomAiDeckIds(40)));
  let state = createInitialGameState(player, opponent);

  if (state.player.hand.length !== 5) {
    throw new Error(`Expected opening hand of 5, got ${state.player.hand.length}`);
  }

  applyAction(state, { type: "play", instanceId: state.player.hand[0].instanceId }, { autoAi: false });
  if (!state.player.active.length) {
    throw new Error("Play did not put a unit in Active");
  }

  applyAction(state, { type: "endTurn" }, { autoAi: true });

  const publicState = publicMatchState(state, "player");
  if (publicState.opponent.hand) {
    throw new Error("Public state leaked opponent hand");
  }
  if (typeof publicState.opponent.handCount !== "number") {
    throw new Error("Public state missing opponent handCount");
  }

  serializeState(state);
  console.log("smokeMatch ok");
  console.log(`turnPlayer=${state.turnPlayer} phase=${state.phase} winner=${state.winner || "none"}`);
  console.log(`log lines=${state.log.length}`);
  console.log(state.log.slice(-8).join("\n"));
}

run();
