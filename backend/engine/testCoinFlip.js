// testCoinFlip.js
const { createInitialGameState } = require("./gameState");
const { applyAbility } = require("./abilities");

const flipper = {
  name: "Lucky Chad",
  abilityCategory: "Attack",
  ability: { keyword: "CoinFlipKO", value: 0 }
};

const target = { name: "Victim", power: 20, tempPower: 0 };

function runTest() {
  const state = createInitialGameState([], []);

  state.player.active = [flipper];
  state.opponent.active = [target];

  console.log("=== BEFORE ===");
  console.log(JSON.stringify(state, null, 2));

  applyAbility(state, flipper, target, flipper.ability);

  console.log("=== AFTER ===");
  console.log(JSON.stringify(state, null, 2));

  console.log("=== LOG ===");
  console.log(state.log.join("\n"));
}

runTest();
