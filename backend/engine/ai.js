const { playUnit, attack, endTurn, setGuard } = require("./actions");
const { startPhase } = require("./phases");
const { checkWin } = require("./checkWin");
const { computeBattlePower, computeTeamBattlePower } = require("./battle");
const { MAX_ACTIVE, MAX_BENCH } = require("./rules");

function getUnitPower(unit) {
  return Math.max(0, (unit.power || 0) + (unit.tempPower || 0));
}

function chooseBestTarget(state) {
  const playerActive = state.player.active;
  if (!playerActive.length) return 0;

  if (state.player.guardInstanceId) {
    const gi = playerActive.findIndex(
      (u) => u && u.instanceId === state.player.guardInstanceId
    );
    if (gi >= 0) return gi;
  }

  let bestIndex = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < playerActive.length; i++) {
    const score = 200 - getUnitPower(playerActive[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function canFight(unit) {
  return unit && !unit.stunned && !(unit.tiredTurns > 0);
}

function chooseAttackers(state, defenderIndex) {
  const aiActive = state.opponent.active;
  const defender = state.player.active[defenderIndex];
  if (!defender || !aiActive.length) return [];

  const eligible = aiActive
    .map((unit, index) => ({ unit, index }))
    .filter((entry) => canFight(entry.unit))
    .sort((a, b) => getUnitPower(b.unit) - getUnitPower(a.unit));

  if (!eligible.length) return [];

  const defPower = computeBattlePower(defender, eligible[0].unit, true).total;
  const chosen = [eligible[0].index];
  let lineup = [eligible[0].unit];
  if (computeTeamBattlePower(lineup, defender).total > defPower) {
    return chosen;
  }

  for (const extra of eligible.slice(1)) {
    lineup = [...lineup, extra.unit];
    chosen.push(extra.index);
    if (computeTeamBattlePower(lineup, defender).total > defPower) break;
  }
  return chosen;
}

function beginTurnIfNeeded(state) {
  if (state.phase === "start") {
    startPhase(state);
    state.phase = "main";
  }
}

/**
 * One AI turn: fill Active, one team attack, end turn.
 * onStep(event) is called after each visible action so the client can replay.
 */
function aiTakeFullTurn(state, onStep = () => {}) {
  if (state.winner) return state;
  if (state.turnPlayer !== "opponent") return state;

  beginTurnIfNeeded(state);
  onStep({ kind: "turnStart" });

  if (state.skipTurn === "opponent") {
    state.log.push("Opponent skips their turn.");
    state.skipTurn = null;
    endTurn(state);
    beginTurnIfNeeded(state);
    onStep({ kind: "turnEnd" });
    return state;
  }

  const ai = state.opponent;

  while (ai.hand.length > 0 && ai.active.length < MAX_ACTIVE) {
    playUnit(state, 0);
    onStep({ kind: "play" });
  }

  while (ai.hand.length > 0 && ai.bench.length < MAX_BENCH && ai.active.length >= MAX_ACTIVE) {
    playUnit(state, 0);
    onStep({ kind: "play" });
  }

  if (ai.active.length === 0 && ai.bench.length > 0) {
    const promoted = ai.bench.shift();
    ai.active.push(promoted);
    state.log.push(`Opponent promotes ${promoted.name} from the Bench.`);
    onStep({ kind: "promote" });
  }

  if (checkWin(state)) return state;

  if (ai.active.length >= 2) {
    let tank = 0;
    for (let i = 1; i < ai.active.length; i++) {
      if (getUnitPower(ai.active[i]) > getUnitPower(ai.active[tank])) tank = i;
    }
    setGuard(state, tank);
    onStep({ kind: "guard", from: "opp" });
  }

  if (
    ai.active.length > 0 &&
    state.player.active.length > 0 &&
    !(ai.silencedTurns && ai.silencedTurns > 0)
  ) {
    const targetIndex = chooseBestTarget(state);
    const attackers = chooseAttackers(state, targetIndex);
    if (attackers.length) {
      attack(state, attackers, targetIndex);
      onStep({
        kind: "attack",
        attackerIndices: attackers,
        defenderIndex: targetIndex,
        from: "opp",
        battle: state.lastBattle || null
      });
    }
  } else if (ai.silencedTurns && ai.silencedTurns > 0) {
    state.log.push("Opponent is silenced and cannot attack this turn.");
  }

  if (checkWin(state)) return state;

  endTurn(state);
  if (state.turnPlayer === "player") {
    beginTurnIfNeeded(state);
  }
  onStep({ kind: "turnEnd" });

  checkWin(state);
  return state;
}

module.exports = { aiTakeFullTurn, chooseBestTarget, chooseAttackers };
