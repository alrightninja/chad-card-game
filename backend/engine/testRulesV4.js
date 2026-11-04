const { createInitialGameState } = require("./gameState");
const { applyAction } = require("./applyAction");
const { getTraitBonus } = require("./battle");
const { TRAIT_BONUS, HAND_LIMIT } = require("./rules");
const { deckToUnits, shuffle, randomAiDeckIds, getAll } = require("./cardRegistry");

function ids() {
  return getAll().slice(0, 20).map((c) => c.cardId);
}

function run() {
  if (TRAIT_BONUS !== 6) throw new Error("TRAIT_BONUS should be 6");
  const bonus = getTraitBonus({ trait: "Mind" }, { trait: "Muscle" });
  if (bonus !== 6) throw new Error(`Mind vs Muscle should be +${TRAIT_BONUS}, got ${bonus}`);
  const weak = getTraitBonus({ trait: "Muscle" }, { trait: "Mind" });
  if (weak !== -6) throw new Error(`Muscle vs Mind should be -${TRAIT_BONUS}, got ${weak}`);

  let state = createInitialGameState(
    shuffle(deckToUnits(ids())),
    shuffle(deckToUnits(randomAiDeckIds(20)))
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
  applyAction(
    state,
    { type: "play", instanceId: state.opponent.hand[0].instanceId, zone: "bench" },
    { autoAi: false, actor: "opponent" }
  );
  state.turnPlayer = "player";
  state.phase = "main";

  if (state.player.active.length !== 1) throw new Error("Expected one Active");

  state.phase = "end";
  state.winner = null;
  let blocked = false;
  try {
    applyAction(
      state,
      { type: "play", instanceId: state.player.hand[0].instanceId, zone: "bench" },
      { autoAi: false }
    );
  } catch (err) {
    blocked = /Main Phase|already over/i.test(err.message);
  }
  if (!blocked) throw new Error("Should not allow play after attacking");

  state.winner = null;
  state.phase = "end";
  applyAction(state, { type: "endTurn" }, { autoAi: false });
  if (state.player.hand.length > HAND_LIMIT) {
    throw new Error("Hand should discard down to 7");
  }

  console.log("testRulesV4 ok");
}

run();
