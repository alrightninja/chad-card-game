// testDecay.js
const { createInitialGameState } = require("./gameState");
const { resolveBattle } = require("./battle");

const survivor = { name: "Tank", power: 100, tempPower: 0 };
const weakling = { name: "Weakling", power: 1, tempPower: 0 };

function runTest() {
  const state = createInitialGameState([], []);

  state.player.active = [survivor];
  state.opponent.active = [weakling];

  console.log("=== BEFORE ===");
  console.log(JSON.stringify(state, null, 2));

  resolveBattle(state, [survivor], weakling);

  console.log("=== AFTER ===");
  console.log(JSON.stringify(state, null, 2));

  console.log("=== LOG ===");
  console.log(state.log.join("\n"));
}

runTest();
