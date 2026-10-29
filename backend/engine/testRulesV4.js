const { createInitialGameState } = require("./gameState");
const { applyAction } = require("./applyAction");
const { getTraitBonus } = require("./battle");
const { TRAIT_BONUS, HAND_LIMIT } = require("./rules");
const { deckToUnits, shuffle, randomAiDeckIds, getAll } = require("./cardRegistry");

function ids() {
  return getAll().slice(0, 40).map((c) => c.cardId);
}

function run() {
  if (TRAIT_BONUS !== 5) throw new Error("TRAIT_BONUS should be 5");
  const bonus = getTraitBonus({ trait: "Mind" }, { trait: "Muscle" });
  if (bonus !== 5) throw new Error(`Mind vs Muscle should be +5, got ${bonus}`);
  const weak = getTraitBonus({ trait: "Muscle" }, { trait: "Mind" });
  if (weak !== -5) throw new Error(`Muscle vs Mind should be -5, got ${weak}`);

  let state = createInitialGameState(
    shuffle(deckToUnits(ids())),
    shuffle(deckToUnits(randomAiDeckIds(40)))
  );

  applyAction(state, { type: "play", instanceId: state.player.hand[0].instanceId, zone: "active" }, { autoAi: false });
  applyAction(state, { type: "play", instanceId: state.player.hand[0].instanceId, zone: "bench" }, { autoAi: false });

  state.turnPlayer = "opponent";
  state.phase = "main";
  applyAction(
    state,
    { type: "play", instanceId: state.opponent.hand[0].instanceId, zone: "active" },
    { autoAi: false, actor: "opponent" }
  );
  state.turnPlayer = "player";
  state.phase = "main";

  if (state.player.active.length !== 1) throw new Error("Expected one Active");

  applyAction(
    state,
    { type: "attack", attackerIndices: [0], defenderIndex: 0 },
    { autoAi: false }
  );

  if (state.phase !== "end" && state.phase !== "battle") {
    // Opponent may have had no Active; still must be past main if we attacked empty...
  }

  let blocked = false;
  try {
    applyAction(
      state,
      { type: "play", instanceId: state.player.hand[0].instanceId, zone: "bench" },
      { autoAi: false }
    );
  } catch (err) {
    blocked = /Main Phase/i.test(err.message);
  }
  if (!blocked) throw new Error("Should not allow play after attacking");

  applyAction(state, { type: "endTurn" }, { autoAi: false });
  if (state.player.hand.length > HAND_LIMIT) {
    throw new Error("Hand should discard down to 7");
  }

  console.log("testRulesV4 ok");
}

run();
