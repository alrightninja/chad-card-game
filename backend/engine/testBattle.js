// testBattle.js
const { createInitialGameState } = require("./gameState");
const { attack } = require("./actions");

const goblin = { name: "Goblin", power: 10, tempPower: 0 };
const orc = { name: "Orc", power: 15, tempPower: 0 };
const boss = { name: "Chadministrator", power: 50, tempPower: 0 };

function runTest() {
  const state = createInitialGameState([], []);

  state.player.active = [goblin, orc];
  state.opponent.active = [boss];

  console.log("=== BEFORE ===");
  console.log(JSON.stringify(state, null, 2));

  attack(state, [0, 1]);

  console.log("=== AFTER ===");
  console.log(JSON.stringify(state, null, 2));

  console.log("=== LOG ===");
  console.log(state.log.join("\n"));
}

runTest();
