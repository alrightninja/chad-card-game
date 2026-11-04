const test = require("node:test");
const assert = require("node:assert/strict");

const { DECK_SIZE, MAX_ACTIVE } = require("../engine/rules");
const { createInitialGameState } = require("../engine/gameState");
const { applyAction } = require("../engine/applyAction");
const { playUnit } = require("../engine/actions");
const { resolveBattle } = require("../engine/battle");
const { checkWin, sideEliminated } = require("../engine/checkWin");
const { enforceBoardLimits } = require("../engine/board");
const { deckToUnits, shuffle, getAll, getById } = require("../engine/cardRegistry");
const generateStarterDeck = require("../utils/generateStarterDeck");
const { releasedSetNumbers } = require("../lib/packs");
const { isLegalDeckList, deckNeedsRebuild } = require("../lib/deck");
const {
  canStartMode,
  clockKey,
  nextLiveDeadline,
  finishReps,
  LIVE_TURN_MS
} = require("../lib/matchLogic");
const { applyGrantOnce, CYBER_CHAD_ID, MIGRATION_ID } = require("../lib/startupMigrations");

function units(n) {
  return shuffle(deckToUnits(getAll().slice(0, n).map((c) => c.cardId)));
}

function dummyUnit(name, power = 10) {
  return { instanceId: name, name, power, printedPower: power, trait: "Mind" };
}

test("4. decks are 20 cards and old 40-card lists need rebuild", () => {
  assert.equal(DECK_SIZE, 20);
  const twenty = Array(20).fill("a").map((_, i) => `c${i}`);
  assert.equal(isLegalDeckList(twenty), true);
  assert.equal(deckNeedsRebuild(Array(40).fill("x")), true);
  assert.equal(isLegalDeckList(Array(40).fill("x").map((_, i) => `c${i}`)), false);
  const starter = generateStarterDeck(new Date("2026-11-03T12:00:00.000Z"));
  assert.equal(starter.length, 20);
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

test("6. never more than 3 active, including KO promote", () => {
  const extra = dummyUnit("Fourth");
  extra.power = 1;
  const state = {
    log: [],
    player: {
      active: [dummyUnit("A", 5), dummyUnit("B", 5), dummyUnit("C", 5)],
      bench: [dummyUnit("D", 5), dummyUnit("E", 5), dummyUnit("F", 5)],
      hand: [],
      discard: []
    },
    opponent: { active: [dummyUnit("Tank", 80)], bench: [], hand: [], discard: [] },
    turnPlayer: "player",
    phase: "battle"
  };
  resolveBattle(state, state.player.active.slice(), state.opponent.active[0]);
  assert.ok(state.player.active.length <= MAX_ACTIVE);

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
  const loss = finishReps({ opponentType: "ai", winner: "opponent", forfeit: false });
  assert.equal(loss.player, 20);
  const forfeit = finishReps({ opponentType: "ai", winner: "opponent", forfeit: true });
  assert.equal(forfeit.player, 0);
  const pvp = finishReps({ opponentType: "user", winner: "opponent", forfeit: true });
  assert.equal(pvp.player, 20);
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
