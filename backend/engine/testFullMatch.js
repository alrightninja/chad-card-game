// testFullMatch.js
const { createInitialGameState } = require("./gameState");
const { playUnit, attack, endTurn } = require("./actions");
const { aiTakeFullTurn } = require("./ai");

// --- Example Cards ---
function card(name, power, opts = {}) {
  return {
    name,
    power,
    tempPower: 0,
    abilityCategory: opts.category || null,
    ability: opts.ability || null,
    multiAttack: opts.multiAttack || 1,
    baseMultiAttack: opts.multiAttack || 1,
    unblockable: opts.unblockable || false,
    rooted: opts.rooted || false,
    trait: opts.trait || "Muscle"
  };
}

// Player deck
const playerDeck = [
  card("Goblin", 10),
  card("Orc", 15),
  card("Mage", 20, {
    category: "Attack",
    ability: { keyword: "PowerUp", value: 5 }
  }),
  card("Ghost Chad", 30, { unblockable: true }),
  card("Lucky Chad", 25, {
    category: "Attack",
    ability: { keyword: "CoinFlipKO", value: 0 }
  })
];

// AI deck
const aiDeck = [
  card("Skeleton", 12),
  card("Warrior", 18),
  card("Tank", 40),
  card("Silencer", 10, {
    category: "Attack",
    ability: { keyword: "Silence", value: 1 }
  }),
  card("Assassin", 22, { multiAttack: 2 })
];

function drawOpeningHands(state) {
  for (let i = 0; i < 3; i++) {
    playUnit(state, 0);
    state.turnPlayer = "opponent";
    playUnit(state, 0);
    state.turnPlayer = "player";
  }
}

function runFullMatch() {
  const state = createInitialGameState(playerDeck, aiDeck);

  // Draw opening hands
  state.player.hand = [...playerDeck];
  state.opponent.hand = [...aiDeck];

  drawOpeningHands(state);

  console.log("=== MATCH START ===");
  console.log(JSON.stringify(state, null, 2));

  let turn = 1;

  while (turn <= 20) {
    console.log(`\n=== TURN ${turn} (${state.turnPlayer}) ===`);

    if (state.turnPlayer === "player") {
      // Player attacks with all active units
      const attackers = state.player.active.map((_, i) => i);
      if (attackers.length > 0 && state.opponent.active.length > 0) {
        attack(state, attackers);
      }
      endTurn(state);
    } else {
      aiTakeFullTurn(state);
    }

    // Print logs for the turn
    console.log(state.log.join("\n"));
    state.log = [];

    // End condition: someone has no units
    if (state.player.active.length === 0 && state.player.bench.length === 0) {
      console.log("\n=== AI WINS ===");
      break;
    }
    if (state.opponent.active.length === 0 && state.opponent.bench.length === 0) {
      console.log("\n=== PLAYER WINS ===");
      break;
    }

    turn++;
  }

  console.log("\n=== FINAL STATE ===");
  console.log(JSON.stringify(state, null, 2));
}

runFullMatch();
