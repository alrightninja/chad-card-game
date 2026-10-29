// testTeamAttack.js
const { createInitialGameState } = require("./gameState");
const { attack } = require("./actions");

const a = { name: "A", power: 10 };
const b = { name: "B", power: 20 };
const c = { name: "C", power: 30 };
const boss = { name: "Boss", power: 40 };

function runTest() {
  const state = createInitialGameState([], []);

  state.player.active = [a, b, c];
  state.opponent.active = [boss];

  console.log("=== BEFORE ===");
  console.log(JSON.stringify(state, null, 2));

  attack(state, [0, 1, 2]);

  console.log("=== AFTER ===");
  console.log(JSON.stringify(state, null, 2));

  console.log("=== LOG ===");
  console.log(state.log.join("\n"));
}

runTest();
