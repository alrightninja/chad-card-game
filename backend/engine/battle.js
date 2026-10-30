// battle.js
const { triggerDefeatAbilities } = require("./abilities");
const { DECAY_RATE, ASSIST_RATE, TRAIT_BONUS, TRAIT_ARMOR, TRAIT_ADVANTAGE } = require("./rules");

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

/**
 * Apply percentage decay to a surviving unit.
 */
function applyDecay(unit, state) {
  if ((unit.shield || 0) > 0) {
    unit.shield -= 1;
    state.log.push(`${unit.name}'s Power Shield prevents decay.`);
    return;
  }
  const before = unit.power || 0;
  const after = Math.floor(before * (1 - DECAY_RATE));
  unit.power = after;
  state.log.push(
    `${unit.name} suffers decay: ${before} → ${after} Power after battle.`
  );
}

/**
 * Apply percentage decay to multiple surviving units.
 */
function applyDecayToTeam(units, state) {
  units.forEach((unit) => applyDecay(unit, state));
}

/**
 * Resolve a battle between one or more attackers and a single defender.
 *
 * - Supports team attacks (ganging up)
 * - Applies trait advantage
 * - Applies armor on defender
 * - Uses tempPower
 * - Applies percentage decay to survivors
 * - Handles KO + defeat movement
 * - Logs a detailed breakdown
 *
 * attackersParam can be:
 *  - a single unit
 *  - an array of units
 */
function resolveBattle(state, attackersParam, defender) {
  const attackers = Array.isArray(attackersParam)
    ? attackersParam
    : [attackersParam];

  const attackerOwner =
    state.turnPlayer === "player" ? state.player : state.opponent;
  const defenderOwner =
    state.turnPlayer === "player" ? state.opponent : state.player;

  // Compute team attack stats
  const teamStats = computeTeamBattlePower(attackers, defender);
  const defStats = computeBattlePower(defender, attackers[0], true);

  state.log.push(
    `${teamStats.lead.name} leads an attack on ${defender.name}` +
      (attackers.length > 1 ? ` with ${attackers.length - 1} assist(s).` : ".")
  );

  teamStats.breakdown.forEach((line) => state.log.push(line));

  state.log.push(
    `${defender.name}: ${defStats.base} base + ${defStats.temp} temp + ${defStats.armor} armor` +
      (defStats.traitArmor ? ` (includes +${defStats.traitArmor} type Armor)` : "") +
      ` = ${defStats.total}`
  );

  const atkTotal = teamStats.total;
  const defTotal = defStats.total;

  state.log.push(
    `Total Attack Power: ${atkTotal} vs Defender Power: ${defTotal}`
  );

  let result = "tie";
  if (atkTotal > defTotal) result = "ko";
  else if (atkTotal < defTotal) result = "wipe";

  state.lastBattle = {
    leadName: teamStats.lead.name,
    leadPower: teamStats.lead.total,
    assists: teamStats.assists,
    atkTotal,
    defTotal,
    defenderName: defender.name,
    result,
    traitBonus: getTraitBonus(attackers[0], defender),
    traitArmor: defStats.traitArmor
  };

  if (atkTotal > defTotal) {
    // Defender is KO'd
    state.log.push(`${defender.name} is KO'd!`);

    const defIndex = defenderOwner.active.indexOf(defender);
    if (defIndex !== -1) {
      defenderOwner.active.splice(defIndex, 1);
    }

    defenderOwner.discard.push(defender);
    if (defenderOwner.guardInstanceId === defender.instanceId) {
      defenderOwner.guardInstanceId = null;
    }
    state.lastKoSeat = defenderOwner === state.player ? "player" : "opponent";
    triggerDefeatAbilities(state, defender);

    // Promote from bench if available
    if (defenderOwner.bench.length > 0) {
      const promoted = defenderOwner.bench.shift();
      defenderOwner.active.push(promoted);
      state.log.push(
        `${promoted.name} is promoted from the Bench to Active.`
      );
    } else {
      state.log.push(
        `${defenderOwner === state.player ? "Player" : "Opponent"} has no Bench units to promote.`
      );
    }

    // Apply decay to surviving attackers
    applyDecayToTeam(attackers, state);
  } else if (atkTotal < defTotal) {
    // All attackers are KO'd
    state.log.push(
      `${attackers.map((a) => a.name).join(", ")} are KO'd!`
    );

    attackers.forEach((attacker) => {
      const atkIndex = attackerOwner.active.indexOf(attacker);
      if (atkIndex !== -1) {
        attackerOwner.active.splice(atkIndex, 1);
      }
      attackerOwner.discard.push(attacker);
      if (attackerOwner.guardInstanceId === attacker.instanceId) {
        attackerOwner.guardInstanceId = null;
      }
      state.lastKoSeat = attackerOwner === state.player ? "player" : "opponent";
      triggerDefeatAbilities(state, attacker);
    });

    // Promote from bench for each KO'd attacker (up to available bench)
    attackers.forEach(() => {
      if (attackerOwner.bench.length > 0) {
        const promoted = attackerOwner.bench.shift();
        attackerOwner.active.push(promoted);
        state.log.push(
          `${promoted.name} is promoted from the Bench to Active.`
        );
      }
    });

    if (attackerOwner.bench.length === 0) {
      state.log.push(
        `${attackerOwner === state.player ? "Player" : "Opponent"} has no more Bench units to promote.`
      );
    }

    // Apply decay to surviving defender
    applyDecay(defender, state);
  } else {
    // Rulebook §6: equal Power — both sides survive and both suffer Decay
    state.log.push("Battle tied. Both sides survive and suffer Decay.");
    applyDecayToTeam(attackers, state);
    applyDecay(defender, state);
  }
}

module.exports = {
  resolveBattle,
  resolveCoinFlip,
  getTraitBonus,
  computeBattlePower,
  computeTeamBattlePower,
  DECAY_RATE
};
