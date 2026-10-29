// testEdgeCases.js
const { createInitialGameState } = require("./gameState");
const { attack } = require("./actions");
const { applyAbility } = require("./abilities");

const silencer = {
  name: "Silencer",
  abilityCategory: "Attack",
  ability: { keyword: "Silence", value: 1 }
};

const rooted = { name: "Rooted Guy", power: 20, rooted: true };
const unblockable = { name: "Ghost Chad", power: 30, unblockable: true };
const victim = { name: "Victim", power: 25 };

function runTest() {
  const state = createInitialGameState([], []);

  state.player.active = [silencer];
  state.opponent.active = [victim];

  console.log("=== BEFORE ===");
  console.log(JSON.stringify(state, null, 2));

  applyAbility(state, silencer, victim, silencer.ability);

  console.log("=== AFTER SILENCE ===");
  console.log(JSON.stringify(state, null, 2));

  // Test unblockable
  state.player.active = [unblockable];
  state.opponent.active = [victim];

  attack(state, 0);

  console.log("=== AFTER UNBLOCKABLE ===");
  console.log(JSON.stringify(state, null, 2));

  console.log("=== LOG ===");
  console.log(state.log.join("\n"));
}

runTest();
