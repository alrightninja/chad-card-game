// testAI.js
const { createInitialGameState } = require("./gameState");
const { aiTakeFullTurn } = require("./ai");

const weak = { name: "Weakling", power: 10 };
const medium = { name: "Medium", power: 20 };
const strong = { name: "Strong", power: 40 };

function runTest() {
  const state = createInitialGameState([], []);

  state.player.active = [weak, medium];
  state.opponent.active = [strong];
  state.turnPlayer = "opponent";
  state.phase = "main";

  console.log("=== BEFORE AI TURN ===");
  console.log(JSON.stringify(state, null, 2));

  aiTakeFullTurn(state);

  console.log("=== AFTER AI TURN ===");
  console.log(JSON.stringify(state, null, 2));

  console.log("=== LOG ===");
  console.log(state.log.join("\n"));
}

runTest();
