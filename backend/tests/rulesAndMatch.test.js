const test = require("node:test");
const assert = require("node:assert/strict");

const { DECK_SIZE, MAX_ACTIVE, HAND_LIMIT, KO_LIMIT_DEFAULT, KO_LIMIT_AI, clampKoLimit } = require("../engine/rules");
const { createInitialGameState } = require("../engine/gameState");
const { applyAction } = require("../engine/applyAction");
const { playUnit, attack, swapActive, promoteFromBench, endTurn } = require("../engine/actions");
const { resolveBattle } = require("../engine/battle");
const { checkWin, sideEliminated } = require("../engine/checkWin");
const { enforceBoardLimits } = require("../engine/board");
const { deckToUnits, shuffle, getAll, getById, randomAiDeckIds } = require("../engine/cardRegistry");
const generateStarterDeck = require("../utils/generateStarterDeck");
const { releasedSetNumbers, packOnSale, PACKS } = require("../lib/packs");
const { progressFromTotalXp, applyWinXp, xpForLevel, MAX_LEVEL, repsForReaching } = require("../lib/xp");
const { assertOffer } = require("../lib/trade");
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
  stripRemovedCardsOnce,
  CYBER_CHAD_ID,
  MIGRATION_ID,
  PERSONAL_GRANT_ID,
  PERSONAL_GRANT_CARDS,
  STRIP_CARD_ID
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
  const uncommons = getAll().filter((c) => c.rarity === "U").map((c) => c.cardId);
  const legends = getAll().filter((c) => c.rarity === "L").map((c) => c.cardId);
  const mythics = getAll().filter((c) => c.rarity === "M").map((c) => c.cardId);
  const sevenRares = rares.slice(0, 7).concat(commons.slice(0, 13));
  assert.match(deckIllegalReason(sevenRares) || "", /Rares/i);
  const threeLegends = legends.slice(0, 3).concat(commons.slice(0, 17));
  assert.match(deckIllegalReason(threeLegends) || "", /Legendaries/i);
  const mixedChase = [mythics[0], legends[0]].concat(commons.slice(0, 18));
  assert.match(deckIllegalReason(mixedChase) || "", /Mythic or up to 2 Legendaries/i);
  const twoMythics = mythics.slice(0, 2).concat(commons.slice(0, 18));
  assert.match(deckIllegalReason(twoMythics) || "", /Mythics/i);
  const nineU = uncommons.slice(0, 9).concat(commons.slice(0, 11));
  assert.match(deckIllegalReason(nineU) || "", /Uncommons/i);
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
  assert.equal(KO_LIMIT_AI, 3);
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

test("7. one live and up to three correspondence matches at the same time", () => {
  assert.equal(canStartMode(["live"], "correspondence"), true);
  assert.equal(canStartMode(["live"], "live"), false);
  assert.equal(canStartMode(["correspondence"], "live"), true);
  assert.equal(canStartMode(["live", "correspondence"], "live"), false);
  assert.equal(canStartMode(["correspondence", "correspondence"], "correspondence"), true);
  assert.equal(
    canStartMode(["correspondence", "correspondence", "correspondence"], "correspondence"),
    false
  );
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

test("pending challenges with a missing player are skipped instead of crashing", () => {
  const { publicChallenge } = require("../lib/challengeView");
  const viewer = { _id: "me" };
  const from = { _id: "them", username: "Rival", verified: false, level: 2 };
  const ok = publicChallenge(
    { _id: "c1", mode: "live", hoursPerMove: 24, koLimit: 3, fromDeckName: "Starter Deck", fromUserId: from, toUserId: viewer },
    viewer._id
  );
  assert.equal(ok.incoming, true);
  assert.equal(ok.from.username, "Rival");
  assert.equal(publicChallenge({ _id: "c2", fromUserId: from, toUserId: null }, viewer._id), null);
  assert.equal(publicChallenge({ _id: "c3", fromUserId: null, toUserId: viewer }, viewer._id), null);
});

test("AI farming hits a daily win cap and a start cooldown", () => {
  const antiFarm = require("../lib/antiFarm");
  const user = { pveFarmDay: null, pveWinsToday: 0, lastPveStartAt: null };
  assert.equal(antiFarm.pveCapReached(user), false);
  for (let i = 0; i < antiFarm.PVE_DAILY_WIN_CAP; i += 1) antiFarm.consumePveWin(user);
  assert.equal(antiFarm.pveCapReached(user), true);
  antiFarm.notePveStart(user, new Date("2026-11-11T12:00:00.000Z"));
  assert.throws(() => antiFarm.assertCanStartPve(user, new Date("2026-11-11T12:00:10.000Z")));
  antiFarm.assertCanStartPve(user, new Date("2026-11-11T12:00:21.000Z"));
  const match = { lastHumanActionAt: new Date("2026-11-11T12:00:00.000Z") };
  assert.throws(() => antiFarm.assertActionPace(match, new Date("2026-11-11T12:00:00.100Z")));
  antiFarm.assertActionPace(match, new Date("2026-11-11T12:00:00.400Z"));
});

test("pack odds keep mythics at 0.2 percent of slots", () => {
  const { weights } = require("../utils/openPack");
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  assert.equal(total, 1000);
  assert.equal(weights.C, 700);
  assert.equal(weights.U, 200);
  assert.equal(weights.R, 90);
  assert.equal(weights.L, 8);
  assert.equal(weights.M, 2);
});

test("AI decks use only released sets and stay legal", () => {
  const now = new Date("2026-11-10T18:00:00.000Z");
  const released = releasedSetNumbers(now);
  const deck = randomAiDeckIds(DECK_SIZE, now);
  assert.equal(isLegalDeckList(deck), true);
  for (const id of deck) {
    const card = getById(id);
    assert.ok(card, id);
    assert.equal(released.has(card.set), true, `${id} set ${card.set} is not released`);
  }
  const afterUltra = new Date("2026-11-16T12:00:00.000Z");
  const laterReleased = releasedSetNumbers(afterUltra);
  assert.equal(laterReleased.has(2), true);
  const laterDeck = randomAiDeckIds(DECK_SIZE, afterUltra);
  assert.equal(isLegalDeckList(laterDeck), true);
  for (const id of laterDeck) {
    assert.equal(laterReleased.has(getById(id).set), true);
  }
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

test("one Active swap per turn; filling empty Active from Bench is free; KO fill only if Active is empty", () => {
  const state = createInitialGameState([], []);
  state.phase = "main";
  state.player.active = [dummyUnit("A", 10)];
  state.player.bench = [dummyUnit("B", 10), dummyUnit("C", 10)];
  swapActive(state, 0, 0);
  assert.throws(() => swapActive(state, 0, 0), /one Bench unit/i);
  promoteFromBench(state, 0);
  assert.equal(state.player.active.length, 2);
  assert.equal(state.player.benchMovesThisTurn, 1);

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

test("0 HP units leave Active, Bench, and Hand immediately and stay discarded", () => {
  const { applyAbility } = require("../engine/abilities");
  const { sweepDeadUnits } = require("../engine/battle");
  const corpse = dummyUnit("Corpse", 10);
  corpse.hp = 0;
  const leftover = dummyUnit("Leftover", 10);
  leftover.hp = 0;
  const pocket = dummyUnit("Pocket", 10);
  pocket.hp = 0;
  const alive = dummyUnit("Alive", 10);
  const state = {
    log: [],
    player: {
      active: [alive],
      bench: [corpse],
      hand: [pocket],
      discard: []
    },
    opponent: {
      active: [leftover],
      bench: [dummyUnit("Benched", 10)],
      hand: [],
      discard: []
    },
    turnPlayer: "player",
    phase: "main"
  };
  sweepDeadUnits(state);
  assert.equal(state.player.active.length, 1);
  assert.equal(state.player.active[0].name, "Alive");
  assert.ok(state.player.bench.every((u) => u.hp > 0));
  assert.ok(!state.player.hand.some((u) => u.hp <= 0));
  assert.ok(state.player.discard.some((u) => u.name === "Corpse"));
  assert.ok(state.player.discard.some((u) => u.name === "Pocket"));
  assert.ok(state.opponent.discard.some((u) => u.name === "Leftover"));
  assert.equal(state.opponent.active[0].name, "Benched");
  assert.ok(!state.opponent.active.some((u) => u.hp <= 0));
  assert.ok(!state.opponent.bench.some((u) => u.hp <= 0));

  const target = dummyUnit("Snack", 8);
  const flipState = {
    log: [],
    resolveCoinFlip: () => true,
    player: { active: [dummyUnit("Flipper", 20)], bench: [], hand: [], discard: [], kos: 0 },
    opponent: { active: [target], bench: [dummyUnit("Backup", 10)], hand: [], discard: [], kos: 0 },
    turnPlayer: "player"
  };
  applyAbility(flipState, flipState.player.active[0], target, { keyword: "CoinFlipKO" });
  assert.ok(flipState.opponent.discard.includes(target));
  assert.ok(!flipState.opponent.active.includes(target));
  assert.ok(!flipState.opponent.bench.includes(target));
  assert.ok(!flipState.opponent.hand.includes(target));
  assert.equal(target.hp, 0);
});

test("mulligan, extra swap, resist, and spike do real work", () => {
  const { applyAbility } = require("../engine/abilities");
  const a = dummyUnit("A", 20);
  const b = dummyUnit("B", 20);
  const c = dummyUnit("C", 20);
  const state = createInitialGameState([], []);
  state.phase = "main";
  state.player.active = [dummyUnit("Swapper", 20)];
  state.player.bench = [a];
  state.player.hand = [b, c];
  state.player.deck = [dummyUnit("D1", 10), dummyUnit("D2", 10)];
  applyAbility(state, state.player.active[0], null, { keyword: "ExtraSwap", value: 1 });
  swapActive(state, 0, 0);
  swapActive(state, 0, 0);
  assert.equal(state.player.benchMovesThisTurn, 2);

  const spikeTarget = dummyUnit("Snack", 20);
  spikeTarget.hp = 40;
  spikeTarget.maxHp = 40;
  applyAbility(state, state.player.active[0], spikeTarget, { keyword: "Spike", value: 12 });
  assert.equal(spikeTarget.hp, 28);

  const tank = dummyUnit("Tank", 20);
  applyAbility(state, tank, null, { keyword: "Resist", value: 6 });
  assert.equal(tank.tempArmor, 6);

  const beforeHand = state.player.hand.map((u) => u.name).sort();
  applyAbility(state, state.player.active[0], null, { keyword: "Mulligan", value: 1 });
  assert.equal(state.player.hand.length, beforeHand.length);
});

test("power-down lasts until the victim finishes their turn", () => {
  const { applyAbility } = require("../engine/abilities");
  const { startPhase } = require("../engine/phases");
  const prey = dummyUnit("Prey", 30);
  const state = createInitialGameState([], []);
  state.player.active = [dummyUnit("Bully", 20)];
  state.opponent.active = [prey];
  applyAbility(state, state.player.active[0], prey, { keyword: "PowerDown", value: 8 });
  assert.equal(prey.tempPower, -8);
  endTurn(state);
  startPhase(state);
  assert.equal(state.turnPlayer, "opponent");
  assert.equal(prey.tempPower, -8);
  endTurn(state);
  assert.equal(prey.tempPower, 0);
});

test("selling a card pays rarity reps", () => {
  const { saleRepsFor, SALE_REPS } = require("../lib/inventory");
  assert.equal(SALE_REPS.C, 5);
  assert.equal(SALE_REPS.U, 10);
  assert.equal(SALE_REPS.R, 15);
  assert.equal(SALE_REPS.L, 20);
  assert.equal(SALE_REPS.M, 25);
  assert.equal(saleRepsFor("bigback_tony_014"), 5);
  assert.equal(saleRepsFor("sir_kensworth_185"), 25);
  assert.equal(saleRepsFor("blitzkrueger_016"), 25);
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
  const band = { C: [18, 28], U: [29, 36], R: [37, 44], L: [47, 50], M: [51, 55] };
  const expectRarity = {
    joey_mac_116: "R",
    supreme_leader_chadenbach_196: "R",
    pastor_chadenbach_150: "R",
    pastor_studson_152: "R",
    pastor_chadrigo_151: "R",
    dwayne_068: "R",
    j_walker_110: "R",
    chadministrative_pastor_038: "R",
    janitor_chad_112: "R",
    bear_sized_goose_012: "R",
    bigback_tony_014: "C",
    john_wickthrop_221: "M",
    gigachad_088: "M",
    the_chadministrator_224: "M",
    cheyennomaly_044: "M",
    meemow_128: "M",
    toaster_daddy_issues_201: "M",
    sir_kensworth_185: "M",
    blitzkrueger_016: "M"
  };
  for (const [id, rarity] of Object.entries(expectRarity)) {
    const card = getById(id);
    assert.equal(card.rarity, rarity, id);
    const [lo, hi] = band[rarity];
    assert.ok(card.power >= lo && card.power <= hi, `${id} power ${card.power}`);
  }
  assert.ok(getById("gigachad_088").power >= getById("the_chadministrator_224").power);
  assert.ok(getById("j_walker_110").power < getById("sir_kensworth_185").power);
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

test("hand limit is 5 and catalog retunes for v4.9", () => {
  assert.equal(HAND_LIMIT, 5);
  assert.equal(getById("chad_of_consistency_033"), null);
  assert.equal(getById("skibidi_chad_186").name, "Fake Brazilian Chad");
  assert.equal(getById("e_unit_071").power, 23);
  assert.equal(getById("gigachad_088").power, 55);
  assert.equal(getById("the_chadministrator_224").power, 53);
  assert.equal(getById("the_chadministrator_224").abilityValue, 8);
  assert.equal(getById("cheesed_off_vacuum_cleaner_043").trait, "Machina");
  assert.equal(getById("chaos_kettlebell_041").trait, "Machina");
});

test("Ordo leaves the shop on Dec 1 but set 1 stays legal", () => {
  const ordo = PACKS.find((p) => p.id === "ordo_chadorum");
  assert.equal(packOnSale(ordo, new Date("2026-11-30T12:00:00.000Z")), true);
  assert.equal(packOnSale(ordo, new Date("2026-12-01T05:00:00.000Z")), false);
  const after = releasedSetNumbers(new Date("2026-12-02T12:00:00.000Z"));
  assert.equal(after.has(1), true);
});

test("XP curve awards increasing reps through level 100", () => {
  assert.equal(xpForLevel(1), 100);
  assert.ok(xpForLevel(2) > xpForLevel(1));
  const p = progressFromTotalXp(100);
  assert.equal(p.level, 2);
  const user = { xp: 0, level: 1, currency: { reps: 0 } };
  applyWinXp(user);
  assert.equal(user.xp, 40);
  assert.equal(user.level, 1);
  user.xp = 90;
  applyWinXp(user);
  assert.equal(user.level, 2);
  assert.equal(user.currency.reps, repsForReaching(2));
  let total = 0;
  for (let lv = 1; lv < MAX_LEVEL; lv += 1) total += xpForLevel(lv);
  const maxed = progressFromTotalXp(total);
  assert.equal(maxed.level, 100);
  assert.equal(maxed.xpForNext, 0);
});

test("trades require 1-5 owned cards each way", () => {
  const mine = ["e_unit_071", "e_unit_071", "gigachad_088"];
  const theirs = ["j_walker_110", "john_wickthrop_221"];
  assert.throws(() => assertOffer([], ["j_walker_110"], mine, theirs));
  const ok = assertOffer(["e_unit_071"], ["j_walker_110"], mine, theirs);
  assert.equal(ok.give.length, 1);
  assert.throws(() => assertOffer(["missing_card"], ["j_walker_110"], mine, theirs));
});

test("strip Chad of Consistency from collections and decks", async () => {
  let claimed = false;
  const users = [
    {
      collection: [STRIP_CARD_ID, "e_unit_071"],
      decks: [{ cards: [STRIP_CARD_ID, "e_unit_071"] }],
      avatarCardId: STRIP_CARD_ID
    }
  ];
  const store = {
    async claim() {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    async pullCardEverywhere(cardId) {
      let n = 0;
      for (const user of users) {
        user.collection = user.collection.filter((id) => id !== cardId);
        for (const deck of user.decks) {
          deck.cards = deck.cards.filter((id) => id !== cardId);
        }
        if (user.avatarCardId === cardId) user.avatarCardId = null;
        n += 1;
      }
      return n;
    },
    async saveResult() {}
  };
  const first = await stripRemovedCardsOnce(store);
  const second = await stripRemovedCardsOnce(store);
  assert.equal(first.ran, true);
  assert.equal(second.ran, false);
  assert.deepEqual(users[0].collection, ["e_unit_071"]);
  assert.equal(users[0].avatarCardId, null);
});

test("password reset tokens hash consistently and expire in one hour", () => {
  const { createResetToken, hashResetToken, RESET_TTL_MS } = require("../lib/passwordReset");
  const issued = createResetToken();
  assert.equal(hashResetToken(issued.token), issued.tokenHash);
  assert.notEqual(issued.token, issued.tokenHash);
  assert.ok(issued.expiresAt.getTime() - Date.now() <= RESET_TTL_MS);
  assert.ok(issued.expiresAt.getTime() - Date.now() > RESET_TTL_MS - 5000);
});

test("one account per email treats plus tags and Gmail dots as the same address", () => {
  const { emailKey, emailsMatch, isValidEmail } = require("../lib/email");
  assert.equal(isValidEmail("a@b.com"), true);
  assert.equal(isValidEmail("nope"), false);
  assert.equal(emailKey("Name+alt@Gmail.com"), "name@gmail.com");
  assert.equal(emailKey("n.a.me@gmail.com"), "name@gmail.com");
  assert.equal(emailKey("a+1@example.com"), emailKey("a+2@example.com"));
  assert.equal(emailsMatch("A@x.com", "a@x.com"), true);
});
