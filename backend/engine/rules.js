/** Living rules numbers — keep in sync with RULEBOOK.md */

const OPENING_HAND = 5;
const HAND_LIMIT = 7;
const MAX_ACTIVE = 3;
const MAX_BENCH = 3;
const DECK_SIZE = 40;
const DECAY_RATE = 0.2;
const ASSIST_RATE = 0.5;
const TRAIT_BONUS = 12;
const TRAIT_ARMOR = 8;
const TRAIT_WHEEL = ["Mind", "Muscle", "Mystic", "Machina", "Mayhem"];

const TRAIT_ADVANTAGE = {
  Mind: "Muscle",
  Muscle: "Mystic",
  Mystic: "Machina",
  Machina: "Mayhem",
  Mayhem: "Mind"
};

module.exports = {
  OPENING_HAND,
  HAND_LIMIT,
  MAX_ACTIVE,
  MAX_BENCH,
  DECK_SIZE,
  DECAY_RATE,
  ASSIST_RATE,
  TRAIT_BONUS,
  TRAIT_ARMOR,
  TRAIT_WHEEL,
  TRAIT_ADVANTAGE
};
