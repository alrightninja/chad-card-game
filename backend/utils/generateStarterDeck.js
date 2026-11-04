const cards = require("../cards.json");
const { DECK_SIZE } = require("../engine/rules");
const { releasedSetNumbers } = require("../lib/packs");

const bannedAbilities = new Set([
  "Stun",
  "Silence",
  "SilenceTrait",
  "CoinFlipKO",
  "TraitSteal",
  "MultiAttack",
  "ResetHands",
  "TempoUp",
  "RevengeUp",
  "ChaosSwing",
  "Mill",
  "ShuffleBench"
]);

function pickRandom(arr, count, rand = Math.random) {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, count);
}

function generateStarterDeck(now = new Date(), rand = Math.random) {
  const released = releasedSetNumbers(now);
  const pool = cards.filter(
    (c) => released.has(c.set) && !bannedAbilities.has(c.abilityKeyword)
  );

  const commons = pool.filter((c) => c.rarity === "C");
  const uncommons = pool.filter((c) => c.rarity === "U");
  const rares = pool.filter((c) => c.rarity === "R");

  const selectedCommons = pickRandom(commons, Math.min(6, commons.length), rand);
  const selectedUncommons = pickRandom(uncommons, Math.min(3, uncommons.length), rand);
  const deck = [
    ...selectedCommons.flatMap((c) => Array(2).fill(c.cardId)),
    ...selectedUncommons.flatMap((c) => Array(2).fill(c.cardId))
  ];
  const rareSlots = DECK_SIZE - deck.length;
  const selectedRares = pickRandom(rares, rareSlots, rand);
  deck.push(...selectedRares.map((c) => c.cardId));

  if (deck.length !== DECK_SIZE) {
    throw new Error(
      `Starter deck expected ${DECK_SIZE} cards, built ${deck.length} from released sets`
    );
  }
  return deck;
}

module.exports = generateStarterDeck;
