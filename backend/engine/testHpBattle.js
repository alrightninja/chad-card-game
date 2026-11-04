const { createInitialGameState } = require("./gameState");
const { resolveBattle, ensureCombatStats } = require("./battle");
const { attack, endTurn } = require("./actions");

function unit(name, power, trait = "Mind") {
  return ensureCombatStats({
    instanceId: name,
    name,
    power,
    printedPower: power,
    trait,
    tempPower: 0
  });
}

function run() {
  const tank = unit("Gigachad", 51, "Muscle");
  const jab = unit("Jab", 26, "Muscle");
  const state = createInitialGameState([], []);
  state.player.active = [jab];
  state.opponent.active = [tank];
  resolveBattle(state, [jab], tank);
  if (state.player.active.length !== 1) throw new Error("Jab should survive punching Gigachad");
  if (tank.hp !== 76) throw new Error(`Gigachad should have 76 HP (2× printed minus 26), got ${tank.hp}`);
  if (jab.power !== 26) throw new Error("Jab Power should be unchanged");

  const lead = unit("Lead", 40);
  const wall = unit("Wall", 80);
  const tiredState = createInitialGameState([], []);
  tiredState.phase = "main";
  tiredState.player.active = [lead];
  tiredState.opponent.active = [wall];
  attack(tiredState, [0], 0);
  if (lead.tiredTurns !== 2) throw new Error("Lead should be Tired");
  endTurn(tiredState);
  if (lead.tiredTurns !== 1) throw new Error("Tired should tick to 1 after end turn");

  console.log("testHpBattle ok");
}

run();
