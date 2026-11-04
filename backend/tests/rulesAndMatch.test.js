const test = require("node:test");
const assert = require("node:assert/strict");

const { DECK_SIZE, MAX_ACTIVE, KO_LIMIT_DEFAULT, clampKoLimit } = require("../engine/rules");
const { createInitialGameState } = require("../engine/gameState");
const { applyAction } = require("../engine/applyAction");
const { playUnit, attack, swapActive, promoteFromBench } = require("../engine/actions");
const { resolveBattle } = require("../engine/battle");
const { checkWin, sideEliminated } = require("../engine/checkWin");
const { enforceBoardLimits } = require("../engine/board");
const { deckToUnits, shuffle, getAll, getById } = require("../engine/cardRegistry");
const generateStarterDeck = require("../utils/generateStarterDeck");
const { releasedSetNumbers } = require("../lib/packs");
const { isLegalDeckList, deckNeedsRebuild, deckIllegalReason } = require("../lib/deck");
const {
  canStartMode,
  clockKey,
  nextLiveDeadline,
  finishReps,
  LIVE_TURN_MS
} = require("../lib/matchLogic");
const {
  applyGrantOnce,
  applyPersonalCardsOnce,
  CYBER_CHAD_ID,
  MIGRATION_ID,
  PERSONAL_GRANT_ID,
  PERSONAL_GRANT_CARDS
} = require("../lib/startupMigrations");

function units(n) {
  return shuffle(deckToUnits(getAll().slice(0, n).map((c) => c.cardId)));
}

function dummyUnit(name, power = 10) {
  return {
    instanceId: name,
    name,
    power,
    printedPower: power,
    maxHp: power,
    hp: power,
    trait: "Mind"
  };
}

test("4. decks are 20 cards and old 40-card lists need rebuild", () => {
  assert.equal(DECK_SIZE, 20);
  const twenty = Array(20).fill("a").map((_, i) => `c${i}`);
  assert.equal(isLegalDeckList(twenty), true);
  assert.equal(deckNeedsRebuild(Array(40).fill("x")), true);
  assert.equal(isLegalDeckList(Array(40).fill("x").map((_, i) => `c${i}`)), false);
  const threeOf = Array(10).fill("c1").concat(Array(10).fill("c2"));
  assert.match(deckIllegalReason(threeOf) || "", /copies/i);
  const starter = generateStarterDeck(new Date("2026-11-03T12:00:00.000Z"));
  assert.equal(starter.length, 20);
  const counts = {};
  for (const id of starter) counts[id] = (counts[id] || 0) + 1;
  assert.equal(Object.values(counts).every((n) => n <= 2), true);
  assert.equal(isLegalDeckList(starter), true);

  const rares = getAll().filter((c) => c.rarity === "R").map((c) => c.cardId);
  const commons = getAll().filter((c) => c.rarity === "C").map((c) => c.cardId);
  const legends = getAll().filter((c) => c.rarity === "L").map((c) => c.cardId);
  const sevenRares = rares.slice(0, 7).concat(commons.slice(0, 13));
  assert.match(deckIllegalReason(sevenRares) || "", /Rares/i);
  const threeLegends = legends.slice(0, 3).concat(commons.slice(0, 17));
  assert.match(deckIllegalReason(threeLegends) || "", /Legendaries/i);
});

test("5. empty active and bench loses even with a hand", () => {
  const state = createInitialGameState(units(20), units(20));
  state.turn = 2;
  state.player.active = [];
  state.player.bench = [];
  state.player.hand = [dummyUnit("spare")];
  state.player.discard = [dummyUnit("gone")];
  state.opponent.active = [dummyUnit("foe", 20)];
  assert.equal(sideEliminated(state.player, state), true);
  checkWin(state);
  assert.equal(state.winner, "opponent");

  const opening = createInitialGameState(units(20), units(20));
  assert.equal(sideEliminated(opening.player, opening), false);
});

test("first to 5 KOs wins while the opponent still has a board", () => {
  assert.equal(KO_LIMIT_DEFAULT, 5);
  assert.equal(clampKoLimit(2), 3);
  assert.equal(clampKoLimit(11), 10);
  const state = createInitialGameState([], [], { koLimit: 5 });
  state.turn = 2;
  state.player.active = [dummyUnit("Hero", 80)];
  state.opponent.active = [dummyUnit("A", 5), dummyUnit("B", 5)];
  state.opponent.bench = [dummyUnit("C", 5)];
  for (let i = 0; i < 4; i++) {
    const snack = dummyUnit(`Snack${i}`, 5);
    state.opponent.active.push(snack);
    resolveBattle(state, state.player.active.slice(), snack);
    checkWin(state);
    assert.equal(state.winner, null);
  }
  assert.equal(state.player.kos, 4);
  const last = dummyUnit("Last", 5);
  state.opponent.active.push(last);
  resolveBattle(state, state.player.active.slice(), last);
  checkWin(state);
  assert.equal(state.player.kos, 5);
  assert.equal(state.winner, "player");
  assert.ok(state.opponent.active.length + state.opponent.bench.length > 0);

  const custom = createInitialGameState([], [], { koLimit: 3 });
  custom.turn = 2;
  custom.player.active = [dummyUnit("Hero", 80)];
  custom.opponent.active = [dummyUnit("Keep", 10)];
  custom.opponent.bench = [dummyUnit("Bench", 10)];
  for (let i = 0; i < 3; i++) {
    const snack = dummyUnit(`N${i}`, 5);
    custom.opponent.active.push(snack);
    resolveBattle(custom, custom.player.active.slice(), snack);
    checkWin(custom);
  }
  assert.equal(custom.winner, "player");
  assert.equal(custom.player.kos, 3);
});

test("6. never more than 3 active, including KO promote", () => {
  const extra = dummyUnit("Fourth");
  extra.power = 1;
  const state = {
    log: [],
    player: {
      active: [dummyUnit("A", 80)],
      bench: [],
      hand: [],
      discard: []
    },
    opponent: {
      active: [dummyUnit("Snack", 5)],
      bench: [dummyUnit("D", 5), dummyUnit("E", 5), dummyUnit("F", 5), dummyUnit("G", 5)],
      hand: [],
      discard: []
    },
    turnPlayer: "player",
    phase: "battle"
  };
  resolveBattle(state, state.player.active.slice(), state.opponent.active[0]);
  assert.ok(state.opponent.active.length <= MAX_ACTIVE);
  assert.equal(state.player.active.length, 1);

  const over = { active: [1, 2, 3, extra].map((n, i) => dummyUnit(String(i))), bench: [], hand: [] };
  enforceBoardLimits(over);
  assert.equal(over.active.length, 3);

  const playState = createInitialGameState(units(20), units(20));
  playState.phase = "main";
  while (playState.player.active.length < 3 && playState.player.hand.length) {
    playUnit(playState, 0, "active");
  }
  assert.equal(playState.player.active.length, 3);
  assert.throws(() => playUnit(playState, 0, "active"), /full/i);
});

test("7. one live and one correspondence at the same time", () => {
  assert.equal(canStartMode(["live"], "correspondence"), true);
  assert.equal(canStartMode(["live"], "live"), false);
  assert.equal(canStartMode(["correspondence"], "live"), true);
  assert.equal(canStartMode(["live", "correspondence"], "live"), false);
});

test("9. AI forfeit awards 0 reps", () => {
  const earlyLoss = finishReps({
    opponentType: "ai",
    winner: "opponent",
    forfeit: false,
    turn: 2
  });
  assert.equal(earlyLoss.player, 0);
  const lateLoss = finishReps({
    opponentType: "ai",
    winner: "opponent",
    forfeit: false,
    turn: 5
  });
  assert.equal(lateLoss.player, 20);
  const earlyWin = finishReps({
    opponentType: "ai",
    winner: "player",
    forfeit: false,
    turn: 2
  });
  assert.equal(earlyWin.player, 50);
  const forfeit = finishReps({ opponentType: "ai", winner: "opponent", forfeit: true, turn: 8 });
  assert.equal(forfeit.player, 0);
  const pvp = finishReps({ opponentType: "user", winner: "opponent", forfeit: true, turn: 8 });
  assert.equal(pvp.player, 0);
  assert.equal(pvp.opponent, 50);
});

test("10. live turn clock restarts when the turn changes, including PvE wrap", () => {
  const match = { mode: "live", opponentType: "ai", moveDeadlineAt: new Date("2026-11-03T00:00:00Z") };
  const before = { turn: 1, turnPlayer: "player" };
  const afterPveWrap = { turn: 2, turnPlayer: "player" };
  const next = nextLiveDeadline(match, before, afterPveWrap, Date.parse("2026-11-03T00:03:00Z"));
  assert.ok(next instanceof Date);
  assert.equal(next.getTime(), Date.parse("2026-11-03T00:03:00Z") + LIVE_TURN_MS);
  const sameTurn = nextLiveDeadline(match, before, { turn: 1, turnPlayer: "player" }, Date.now());
  assert.equal(sameTurn, match.moveDeadlineAt);
  assert.equal(clockKey(before), "1:player");
});

test("11. starter deck uses only released sets", () => {
  const now = new Date("2026-11-03T12:00:00.000Z");
  const released = releasedSetNumbers(now);
  assert.equal(released.has(1), true);
  assert.equal(released.has(2), false);
  assert.equal(released.has(3), false);
  assert.equal(released.has(4), false);
  const starter = generateStarterDeck(now);
  for (const id of starter) {
    const card = getById(id);
    assert.ok(card, id);
    assert.equal(released.has(card.set), true, `${id} set ${card.set} is not released`);
  }
  const early = generateStarterDeck(new Date("2026-10-15T12:00:00.000Z"));
  for (const id of early) {
    assert.equal(getById(id).set, 1);
  }
});

test("migration 2-3 cannot run twice", async () => {
  const users = [
    { id: "1", username: "alrightninja" },
    { id: "2", username: "CrkHero" }
  ];
  const cards = {};
  const reps = { 1: 2000, 2: 10 };
  let claimed = false;
  const store = {
    async claim(id) {
      assert.equal(id, MIGRATION_ID);
      if (claimed) return false;
      claimed = true;
      return true;
    },
    async listUsers() {
      return users;
    },
    async pushCard(userId, cardId) {
      cards[userId] = cards[userId] || [];
      cards[userId].push(cardId);
    },
    async addReps(userId, amount) {
      reps[userId] += amount;
    },
    async addRepsByUsername(username, amount) {
      const u = users.find((x) => x.username === username);
      if (u) reps[u.id] += amount;
    },
    async saveResult() {}
  };

  const first = await applyGrantOnce(store);
  const second = await applyGrantOnce(store);
  assert.equal(first.ran, true);
  assert.equal(second.ran, false);
  assert.equal(cards["1"].filter((id) => id === CYBER_CHAD_ID).length, 1);
  assert.equal(cards["2"].length, 1);
  assert.equal(reps["1"], 2500);
  assert.equal(reps["2"], 510);
  assert.equal(first.crkGranted, true);
});

test("HP combat chips a bigger defender and still one-shots equals", () => {
  const small = dummyUnit("Small", 26);
  const tank = dummyUnit("Tank", 51);
  const chip = {
    log: [],
    player: { active: [small], bench: [], hand: [], discard: [] },
    opponent: { active: [tank], bench: [], hand: [], discard: [] },
    turnPlayer: "player",
    phase: "battle"
  };
  resolveBattle(chip, [small], tank);
  assert.equal(chip.player.active.length, 1);
  assert.equal(chip.opponent.active[0].hp, 25);
  assert.equal(chip.opponent.active[0].power, 51);
  assert.equal(chip.lastBattle.result, "hit");

  const a = dummyUnit("A", 34);
  const b = dummyUnit("B", 34);
  const even = {
    log: [],
    player: { active: [a], bench: [], hand: [], discard: [] },
    opponent: { active: [b], bench: [], hand: [], discard: [] },
    turnPlayer: "player",
    phase: "battle"
  };
  resolveBattle(even, [a], b);
  assert.equal(even.lastBattle.result, "ko");
  assert.equal(even.opponent.active.length, 0);
  assert.equal(even.player.active.length, 1);
});

test("assists are one Common/Uncommon from Active only", () => {
  const lead = dummyUnit("Lead", 20);
  const help = dummyUnit("Help", 20);
  const extra = dummyUnit("Extra", 20);
  const wall = dummyUnit("Wall", 80);
  const state = createInitialGameState([], []);
  state.phase = "main";
  state.player.active = [lead, help, extra];
  state.opponent.active = [wall];
  assert.throws(() => attack(state, [0, 1, 2]), /one Assist/i);

  const rareLead = dummyUnit("RareLead", 20);
  rareLead.rarity = "R";
  const rareState = createInitialGameState([], []);
  rareState.phase = "main";
  rareState.player.active = [rareLead, dummyUnit("Help", 20)];
  rareState.opponent.active = [dummyUnit("Wall", 80)];
  assert.throws(() => attack(rareState, [0, 1]), /cannot receive an Assist/i);

  const legendHelp = dummyUnit("Legend", 20);
  legendHelp.rarity = "L";
  const legendState = createInitialGameState([], []);
  legendState.phase = "main";
  legendState.player.active = [dummyUnit("Lead", 20), legendHelp];
  legendState.opponent.active = [dummyUnit("Wall", 80)];
  assert.throws(() => attack(legendState, [0, 1]), /cannot Assist/i);

  const ok = createInitialGameState([], []);
  ok.phase = "main";
  ok.player.active = [dummyUnit("Lead", 20), dummyUnit("Help", 20)];
  ok.opponent.active = [dummyUnit("Wall", 80)];
  attack(ok, [0, 1]);
  assert.equal(ok.lastBattle.assists.length, 1);
});

test("one Bench-to-Active move per turn and KO fill only if Active is empty", () => {
  const state = createInitialGameState([], []);
  state.phase = "main";
  state.player.active = [dummyUnit("A", 10)];
  state.player.bench = [dummyUnit("B", 10), dummyUnit("C", 10)];
  swapActive(state, 0, 0);
  assert.throws(() => swapActive(state, 0, 0), /one Bench unit/i);
  assert.throws(() => promoteFromBench(state, 0), /one Bench unit/i);

  const snack = dummyUnit("Snack", 5);
  const other = dummyUnit("Other", 10);
  const koKeep = {
    log: [],
    player: { active: [dummyUnit("A", 80)], bench: [], hand: [], discard: [] },
    opponent: {
      active: [snack, other],
      bench: [dummyUnit("D", 5)],
      hand: [],
      discard: []
    },
    turnPlayer: "player",
    phase: "battle"
  };
  resolveBattle(koKeep, koKeep.player.active.slice(), snack);
  assert.equal(koKeep.opponent.active.length, 1);
  assert.equal(koKeep.opponent.active[0].name, "Other");
  assert.equal(koKeep.opponent.bench.length, 1);

  const last = dummyUnit("Last", 5);
  const filler = dummyUnit("Filler", 10);
  const koEmpty = {
    log: [],
    player: { active: [dummyUnit("A", 80)], bench: [], hand: [], discard: [] },
    opponent: {
      active: [last],
      bench: [filler],
      hand: [],
      discard: []
    },
    turnPlayer: "player",
    phase: "battle"
  };
  resolveBattle(koEmpty, koEmpty.player.active.slice(), last);
  assert.equal(koEmpty.opponent.active.length, 1);
  assert.equal(koEmpty.opponent.active[0].name, "Filler");
  assert.equal(koEmpty.opponent.bench.length, 0);
});

test("Lead becomes Tired after attacking", () => {
  const state = createInitialGameState(units(20), units(20));
  state.phase = "main";
  state.player.active = [dummyUnit("Lead", 40)];
  state.opponent.active = [dummyUnit("Wall", 80)];
  attack(state, [0], 0);
  assert.equal(state.player.active[0].tiredTurns, 2);
  assert.equal(state.opponent.active[0].hp, 40);
});

test("Jerry, Howard, and Wickthrop sit in the requested packs", () => {
  assert.equal(getById("jerry_bag_o_donuts_114").set, 2);
  assert.equal(getById("hand_me_down_howard_220").set, 2);
  assert.equal(getById("john_wickthrop_221").set, 3);
});

test("requested rarity and power retunes landed", () => {
  const expect = {
    joey_mac_116: { rarity: "R", power: 38 },
    supreme_leader_chadenbach_196: { rarity: "R", power: 44 },
    pastor_chadenbach_150: { rarity: "R", power: 43 },
    pastor_studson_152: { rarity: "R", power: 43 },
    pastor_chadrigo_151: { rarity: "R", power: 43 },
    dwayne_068: { rarity: "R", power: 43 },
    j_walker_110: { rarity: "U", power: 35 },
    chadministrative_pastor_038: { rarity: "R", power: 43 },
    janitor_chad_112: { rarity: "R", power: 43 },
    bear_sized_goose_012: { rarity: "R", power: 43 },
    bigback_tony_014: { rarity: "C", power: 28 },
    john_wickthrop_221: { rarity: "L", power: 55 }
  };
  for (const [id, want] of Object.entries(expect)) {
    const card = getById(id);
    assert.equal(card.rarity, want.rarity, id);
    assert.equal(card.power, want.power, id);
  }
});

test("personal kensworth/wickthrop grant cannot run twice", async () => {
  const cards = {};
  let claimed = false;
  const store = {
    async claim(id) {
      assert.equal(id, PERSONAL_GRANT_ID);
      if (claimed) return false;
      claimed = true;
      return true;
    },
    async pushCardByUsername(username, cardId) {
      assert.equal(username, "alrightninja");
      cards[username] = cards[username] || [];
      cards[username].push(cardId);
      return true;
    },
    async saveResult() {}
  };

  const first = await applyPersonalCardsOnce(store);
  const second = await applyPersonalCardsOnce(store);
  assert.equal(first.ran, true);
  assert.equal(second.ran, false);
  assert.deepEqual(cards.alrightninja, PERSONAL_GRANT_CARDS);
});
