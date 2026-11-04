const { createInitialGameState } = require("../engine/gameState");
const { checkWin } = require("../engine/checkWin");
const { aiTakeFullTurn } = require("../engine/ai");
const { deckToUnits, shuffle, getAll } = require("../engine/cardRegistry");
const { playUnit, attack, endTurn } = require("../engine/actions");
const { startPhase } = require("../engine/phases");

function pickDeck(seed) {
  const ids = getAll().map((c) => c.cardId);
  const shuffled = shuffle(ids);
  return shuffled.slice(seed, seed + 20);
}

function remaining(side) {
  return [...(side.active || []), ...(side.bench || [])].map((u) => ({
    name: u.name,
    hp: u.hp,
    maxHp: u.maxHp,
    power: u.power
  }));
}

function run() {
  const playerDeck = deckToUnits(pickDeck(0));
  const aiDeck = deckToUnits(pickDeck(7));
  const state = createInitialGameState(playerDeck, aiDeck);

  const hits = [];
  const kos = [];
  let turns = 0;
  const maxTurns = 40;

  while (!state.winner && turns < maxTurns) {
    turns += 1;
    if (state.phase === "start") {
      startPhase(state);
      state.phase = "main";
    }

    if (state.turnPlayer === "player") {
      const me = state.player;
      while (me.hand.length && me.active.length < 3) {
        playUnit(state, 0, "active");
      }
      while (me.hand.length && me.bench.length < 3) {
        playUnit(state, 0, "bench");
      }
      const ready = me.active
        .map((unit, i) => ({ unit, i }))
        .filter(({ unit }) => unit && !unit.stunned && !(unit.tiredTurns > 0));
      if (ready.length && state.opponent.active.length) {
        let targetIndex = 0;
        if (state.opponent.guardInstanceId) {
          const gi = state.opponent.active.findIndex(
            (u) => u && u.instanceId === state.opponent.guardInstanceId
          );
          if (gi >= 0) targetIndex = gi;
        } else {
          targetIndex = state.opponent.active
            .map((unit, i) => ({ unit, i }))
            .sort((a, b) => (a.unit.hp ?? 99) - (b.unit.hp ?? 99))[0].i;
        }
        const lead = ready[0];
        attack(state, [lead.i], targetIndex);
        const battle = state.lastBattle;
        if (battle) {
          if (battle.result === "ko") kos.push(`${lead.unit.name} KO ${battle.defenderName} (${battle.atkTotal} dmg)`);
          else hits.push(`${lead.unit.name} chips ${battle.defenderName} ${battle.hpAfter}/${battle.maxHp} (${battle.damage} dmg)`);
        }
      }
      if (checkWin(state)) break;
      endTurn(state);
    } else {
      const beforeLog = state.log.length;
      aiTakeFullTurn(state);
      const added = state.log.slice(beforeLog);
      added.forEach((line) => {
        if (/takes \d+ damage/.test(line)) hits.push(`AI: ${line}`);
        if (/is KO'd/.test(line)) kos.push(`AI: ${line}`);
      });
    }
    if (checkWin(state)) break;
  }

  const summary = {
    winner: state.winner || "unfinished",
    turns,
    kos: kos.length,
    chips: hits.length,
    playerBoard: remaining(state.player),
    opponentBoard: remaining(state.opponent),
    lastLog: state.log.slice(-12)
  };
  console.log(JSON.stringify(summary, null, 2));
  console.log("\nCHIP HITS");
  hits.slice(0, 20).forEach((h) => console.log(h));
  console.log("\nKOs");
  kos.forEach((h) => console.log(h));
}

run();
