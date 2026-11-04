/** Living rules numbers — keep in sync with RULEBOOK.md */

const OPENING_HAND = 5;
const HAND_LIMIT = 7;
const MAX_ACTIVE = 3;
const MAX_BENCH = 3;
const DECK_SIZE = 20;
const KO_LIMIT_DEFAULT = 5;
const KO_LIMIT_MIN = 3;
const KO_LIMIT_MAX = 10;
const DECAY_RATE = 0.2;
const ASSIST_RATE = 0.5;
const MAX_ASSISTS = 1;
const MAX_BENCH_MOVES_PER_TURN = 1;
const HP_MULT = 2;
const TRAIT_BONUS = 6;
const TRAIT_ARMOR = 8;
const TRAIT_WHEEL = ["Mind", "Muscle", "Mystic", "Machina", "Mayhem"];

const TRAIT_ADVANTAGE = {
  Mind: "Muscle",
  Muscle: "Mystic",
  Mystic: "Machina",
  Machina: "Mayhem",
  Mayhem: "Mind"
};

function rarityBucket(rarity) {
  if (rarity === "L") return "L";
  if (rarity === "R" || rarity === "SR" || rarity === "UR") return "R";
  if (rarity === "U") return "U";
  return "C";
}

function clampKoLimit(value) {
  const n = Number(value);
  if (!Number.isInteger(n)) return KO_LIMIT_DEFAULT;
  return Math.min(KO_LIMIT_MAX, Math.max(KO_LIMIT_MIN, n));
}

/** Commons and Uncommons may Assist or receive an Assist. Rares and Legendaries fight alone. */
function canAssist(unit) {
  if (!unit) return false;
  const bucket = rarityBucket(unit.rarity);
  return bucket === "C" || bucket === "U";
}

module.exports = {
  OPENING_HAND,
  HAND_LIMIT,
  MAX_ACTIVE,
  MAX_BENCH,
  DECK_SIZE,
  KO_LIMIT_DEFAULT,
  KO_LIMIT_MIN,
  KO_LIMIT_MAX,
  clampKoLimit,
  DECAY_RATE,
  ASSIST_RATE,
  MAX_ASSISTS,
  MAX_BENCH_MOVES_PER_TURN,
  HP_MULT,
  TRAIT_BONUS,
  TRAIT_ARMOR,
  TRAIT_WHEEL,
  TRAIT_ADVANTAGE,
  rarityBucket,
  canAssist
};
