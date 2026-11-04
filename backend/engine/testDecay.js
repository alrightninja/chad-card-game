const { createInitialGameState } = require("./gameState");
const { resolveBattle } = require("./battle");

const survivor = { name: "Tank", power: 100, printedPower: 100, maxHp: 100, hp: 100, tempPower: 0 };
const weakling = { name: "Weakling", power: 1, printedPower: 1, maxHp: 1, hp: 1, tempPower: 0 };

function runTest() {
  const state = createInitialGameState([], []);
  state.player.active = [survivor];
  state.opponent.active = [weakling];
  resolveBattle(state, [survivor], weakling);

  if (state.player.active[0].power !== 100) {
    throw new Error("Attacker Power should not decay");
  }
  if (state.opponent.active.length !== 0) {
    throw new Error("1 HP defender should be KO'd by 100 damage");
  }
  if (state.lastBattle.result !== "ko") {
    throw new Error(`Expected ko, got ${state.lastBattle.result}`);
  }
  console.log("testDecay (HP KO, no power decay) ok");
}

runTest();
