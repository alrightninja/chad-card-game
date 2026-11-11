// battle.js
const { triggerDefeatAbilities } = require("./abilities");
const { ASSIST_RATE, HP_MULT, TRAIT_BONUS, TRAIT_ARMOR, TRAIT_ADVANTAGE } = require("./rules");
const { addToActive, unitIsDown } = require("./board");

function ensureCombatStats(unit) {
  if (!unit) return unit;
  const printed = unit.printedPower ?? unit.power ?? 0;
  if (unit.printedPower == null) unit.printedPower = printed;
  if (unit.maxHp == null) unit.maxHp = printed * HP_MULT;
  if (unit.hp == null) unit.hp = unit.maxHp;
  return unit;
}

function resetCombatForPlay(unit) {
  if (!unit) return unit;
  ensureCombatStats(unit);
  unit.hp = unit.maxHp;
  unit.tiredTurns = 0;
  unit.stunned = false;
  unit.tempPower = 0;
  return unit;
}

/**
 * Simple 50/50 coin flip helper.
 * Returns true for Heads, false for Tails.
 */
function resolveCoinFlip() {
  return Math.random() < 0.5;
}

/**
 * Get trait advantage bonus based on attacker/defender traits.
 * 5‑Trait Loop:
 * Mind → Muscle → Mystic → Machina → Mayhem → Mind
 *
 * Returns +TRAIT_BONUS / -TRAIT_BONUS / 0 for the Lead only.
 */
function getTraitBonus(attacker, defender) {
  if (!attacker.trait || !defender.trait) return 0;

  const atk = attacker.trait;
  const def = defender.trait;

  const attackerHasAdvantage = TRAIT_ADVANTAGE[atk] === def;
  const defenderHasAdvantage = TRAIT_ADVANTAGE[def] === atk;
  const defenderHasReverseWeakness = !!defender.reverseWeakness;

  if (attackerHasAdvantage && !defenderHasReverseWeakness) return TRAIT_BONUS;
  if (attackerHasAdvantage && defenderHasReverseWeakness) return -TRAIT_BONUS;
  if (defenderHasAdvantage && !defenderHasReverseWeakness) return -TRAIT_BONUS;
  if (defenderHasAdvantage && defenderHasReverseWeakness) return TRAIT_BONUS;
  return 0;
}

/**
 * Compute final battle power for a single unit.
 * Includes:
 * - base power
 * - tempPower
 * - trait bonus
 * - armor (on defender)
 */
function computeBattlePower(unit, opponent, isDefender = false, opts = {}) {
  const applyTrait = opts.applyTrait !== false;
  const base = unit.power || 0;
  const temp = unit.tempPower || 0;
  const printedArmor = isDefender ? (unit.armor || 0) : 0;
  let traitBonus = 0;
  let traitArmor = 0;
  if (isDefender) {
    if (getTraitBonus(opponent, unit) < 0) traitArmor = TRAIT_ARMOR;
  } else if (applyTrait) {
    traitBonus = getTraitBonus(unit, opponent);
  }
  const armor = printedArmor + traitArmor;
  const raw = base + temp + traitBonus + armor;

  return {
    base,
    temp,
    traitBonus,
    traitArmor,
    armor,
    total: Math.max(0, raw)
  };
}

/**
 * Lead uses full Power. Each extra attacker adds half (floored).
 */
function computeTeamBattlePower(attackers, defender) {
  if (!attackers.length) {
    return { total: 0, breakdown: [], lead: null, assists: [] };
  }

  const lead = attackers[0];
  const leadStats = computeBattlePower(lead, defender, false, { applyTrait: true });
  const breakdown = [
    `LEAD ${lead.name}: ${leadStats.base} base + ${leadStats.temp} temp + ${leadStats.traitBonus} trait = ${leadStats.total}`
  ];
  const assists = [];
  let total = leadStats.total;

  attackers.slice(1).forEach((attacker) => {
    const stats = computeBattlePower(attacker, defender, false, { applyTrait: false });
    const added = Math.floor(stats.total * ASSIST_RATE);
    total += added;
    assists.push({ name: attacker.name, full: stats.total, added });
    breakdown.push(
      `ASSIST ${attacker.name}: ${stats.total} Power → +${added} (half, no trait)`
    );
  });

  return {
    total,
    breakdown,
    lead: { name: lead.name, total: leadStats.total },
    assists
  };
}

function knockOut(state, unit, owner) {
  if (!unit || !owner) return;
  owner.discard = owner.discard || [];
  if (owner.discard.includes(unit)) return;
  for (const zone of ["active", "bench", "hand"]) {
    const arr = owner[zone];
    if (!arr) continue;
    const idx = arr.indexOf(unit);
    if (idx !== -1) arr.splice(idx, 1);
  }
  owner.discard.push(unit);
  if (owner.guardInstanceId === unit.instanceId) {
    owner.guardInstanceId = null;
  }
  state.lastKoSeat = owner === state.player ? "player" : "opponent";
  const scorer = owner === state.player ? state.opponent : state.player;
  if (scorer) {
    scorer.kos = (scorer.kos || 0) + 1;
    const who = scorer === state.player ? "Player" : "Opponent";
    const limit = state.koLimit || 5;
    state.log.push(`${who} ${scorer.kos}/${limit} KOs.`);
  }
  triggerDefeatAbilities(state, unit);

  while (owner.active.length === 0 && (owner.bench || []).length > 0) {
    const promoted = owner.bench.shift();
    if (unitIsDown(promoted)) {
      knockOut(state, promoted, owner);
      continue;
    }
    addToActive(owner, promoted);
    state.log.push(`${promoted.name} is promoted from the Bench to Active.`);
    break;
  }
  if (owner.active.length === 0 && !(owner.bench || []).length) {
    state.log.push(
      `${owner === state.player ? "Player" : "Opponent"} has no Bench units to promote.`
    );
  }
}

function sweepDeadUnits(state) {
  if (!state) return state;
  for (const who of ["player", "opponent"]) {
    const owner = state[who];
    if (!owner) continue;
    const dead = [];
    for (const zone of ["active", "bench", "hand"]) {
      for (const unit of owner[zone] || []) {
        if (unitIsDown(unit) && !dead.includes(unit)) dead.push(unit);
      }
    }
    for (const unit of dead) knockOut(state, unit, owner);
  }
  return state;
}

/**
 * Resolve a battle between one or more attackers and a single defender.
 * Attack total is dealt as HP damage (minus Armor). Attackers are not KO'd
 * for punching a bigger card. Decay is retired.
 */
function resolveBattle(state, attackersParam, defender) {
  const attackers = Array.isArray(attackersParam)
    ? attackersParam
    : [attackersParam];

  attackers.forEach(ensureCombatStats);
  ensureCombatStats(defender);

  const defenderOwner =
    state.turnPlayer === "player" ? state.opponent : state.player;

  const teamStats = computeTeamBattlePower(attackers, defender);
  const defStats = computeBattlePower(defender, attackers[0], true);
  const atkTotal = teamStats.total;
  const rawDamage = Math.max(0, atkTotal - (defStats.armor || 0));
  const hpBefore = defender.hp;

  state.log.push(
    `${teamStats.lead.name} leads an attack on ${defender.name}` +
      (attackers.length > 1 ? ` with ${attackers.length - 1} assist(s).` : ".")
  );
  teamStats.breakdown.forEach((line) => state.log.push(line));
  state.log.push(
    `${defender.name}: ${hpBefore}/${defender.maxHp} HP, ${defStats.armor} Armor` +
      (defStats.traitArmor ? ` (includes +${defStats.traitArmor} type Armor)` : "")
  );

  let damage = rawDamage;
  if ((defender.shield || 0) > 0) {
    defender.shield -= 1;
    damage = 0;
    state.log.push(`${defender.name}'s Power Shield absorbs the hit.`);
  } else {
    defender.hp = Math.max(0, defender.hp - damage);
    state.log.push(
      `${defender.name} takes ${damage} damage (${hpBefore} → ${defender.hp} HP).`
    );
  }

  const result = defender.hp <= 0 ? "ko" : "hit";
  state.lastBattle = {
    leadName: teamStats.lead.name,
    leadPower: teamStats.lead.total,
    assists: teamStats.assists,
    atkTotal,
    defTotal: defStats.armor,
    damage,
    hpBefore,
    hpAfter: defender.hp,
    maxHp: defender.maxHp,
    defenderName: defender.name,
    result,
    traitBonus: getTraitBonus(attackers[0], defender),
    traitArmor: defStats.traitArmor
  };

  if (defender.hp <= 0) {
    state.log.push(`${defender.name} is KO'd!`);
    knockOut(state, defender, defenderOwner);
  }
}

module.exports = {
  resolveBattle,
  resolveCoinFlip,
  getTraitBonus,
  computeBattlePower,
  computeTeamBattlePower,
  ensureCombatStats,
  resetCombatForPlay,
  knockOut,
  sweepDeadUnits
};
