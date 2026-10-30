const { computeTeamBattlePower } = require("./battle");
const { ASSIST_RATE } = require("./rules");
const { createInitialGameState } = require("./gameState");
const { applyAction } = require("./applyAction");
const { deckToUnits, shuffle, getAll } = require("./cardRegistry");

function unit(name, power, trait = "Mind") {
  return {
    instanceId: name,
    name,
    power,
    printedPower: power,
    trait,
    tempPower: 0
  };
}

function run() {
  if (ASSIST_RATE !== 0.5) throw new Error("ASSIST_RATE should be 0.5");

  const lead = unit("Lead", 30, "Mind");
  const a = unit("Help", 30, "Mind");
  const b = unit("Help2", 30, "Mind");
  const wall = unit("Wall", 50, "Mind");

  const fullGang = computeTeamBattlePower([lead, a, b], wall);
  if (fullGang.total !== 30 + 15 + 15) {
    throw new Error(`Expected 60 assist total, got ${fullGang.total}`);
  }
  if (fullGang.total > 50) {
    // 60 > 50 still KO with three 30s vs 50, but old full-sum was 90
  }

  const oldStyleWouldBe90 = 90;
  if (fullGang.total >= oldStyleWouldBe90) {
    throw new Error("Assists should not count full Power");
  }

  const soloVsWall = computeTeamBattlePower([lead], wall);
  if (soloVsWall.total !== 30) throw new Error("Solo lead should be 30");

  const { TRAIT_BONUS } = require("./rules");
  const muscleWall = unit("MuscleWall", 30, "Muscle");
  const adv = computeTeamBattlePower([lead], muscleWall);
  if (adv.total !== 30 + TRAIT_BONUS) {
    throw new Error(`Lead type advantage should add ${TRAIT_BONUS}, got ${adv.total}`);
  }
  const assistMind = unit("HelpMind", 30, "Muscle");
  const withAssist = computeTeamBattlePower([lead, assistMind], muscleWall);
  if (withAssist.total !== 30 + TRAIT_BONUS + 15) {
    throw new Error(`Assists should ignore trait, got ${withAssist.total}`);
  }

  const ids = getAll().slice(0, 40).map((c) => c.cardId);
  const state = createInitialGameState(shuffle(deckToUnits(ids)), shuffle(deckToUnits(ids)));

  while (state.player.active.length < 2 && state.player.hand.length) {
    applyAction(state, { type: "play", instanceId: state.player.hand[0].instanceId, zone: "active" }, { autoAi: false });
  }
  if (state.player.active.length < 2) throw new Error("Need two Active to test tired");

  applyAction(state, { type: "guard", activeIndex: 0 }, { autoAi: false });
  if (!state.player.guardInstanceId) throw new Error("Guard should set");

  state.turnPlayer = "opponent";
  state.phase = "main";
  applyAction(
    state,
    { type: "play", instanceId: state.opponent.hand[0].instanceId, zone: "active" },
    { autoAi: false, actor: "opponent" }
  );

  let blocked = false;
  if (state.player.active.length > 1) {
    try {
      applyAction(
        state,
        { type: "attack", attackerIndices: [0], defenderIndex: 1 },
        { autoAi: false, actor: "opponent" }
      );
    } catch (err) {
      blocked = /Guard/i.test(err.message);
    }
  }
  if (state.player.guardInstanceId && state.player.active.length > 1 && !blocked) {
    throw new Error("Attacking a non-Guard should fail");
  }

  console.log("testCombatV42 ok");
}

run();
