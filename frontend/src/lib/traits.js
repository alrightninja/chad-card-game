export const TRAIT_BONUS = 12;
export const TRAIT_ARMOR = 8;

export const TRAIT_ADVANTAGE = {
  Mind: "Muscle",
  Muscle: "Mystic",
  Mystic: "Machina",
  Machina: "Mayhem",
  Mayhem: "Mind"
};

export function leadTraitBonus(lead, defender) {
  if (!lead?.trait || !defender?.trait) return 0;
  const atk = lead.trait;
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

export function defenderTraitArmor(lead, defender) {
  return leadTraitBonus(lead, defender) < 0 ? TRAIT_ARMOR : 0;
}

export function matchupPhrase(lead, defender) {
  if (!lead?.trait || !defender?.trait) return "";
  const bonus = leadTraitBonus(lead, defender);
  if (bonus > 0) return `${lead.trait} beats ${defender.trait} (+${bonus})`;
  if (bonus < 0) {
    return `${defender.trait} resists (${bonus} Lead, +${TRAIT_ARMOR} Armor)`;
  }
  return `${lead.trait} vs ${defender.trait} even`;
}
