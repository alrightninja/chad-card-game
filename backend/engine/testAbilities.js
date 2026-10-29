// testAbilities.js
const { createInitialGameState } = require("./gameState");
const { applyAbility } = require("./abilities");

const unitA = {
  name: "Buff Chad",
  power: 20,
  abilityCategory: "Play",
  ability: { keyword: "PowerUp", value: 10 }
};

const unitB = {
  name: "Debuff Goblin",
  power: 15,
  abilityCategory: "Attack",
  ability: { keyword: "PowerDown", value: 5 }
};

function runTest() {
  const state = createInitialGameState([], []);

  state.player.active = [unitA];
  state.opponent.active = [unitB];

  console.log("=== BEFORE ===");
  console.log(JSON.stringify(state, null, 2));

  applyAbility(state, unitA, null, unitA.ability);
  applyAbility(state, unitB, unitA, unitB.ability);

  console.log("=== AFTER ===");
  console.log(JSON.stringify(state, null, 2));

  console.log("=== LOG ===");
  console.log(state.log.join("\n"));
}

runTest();
