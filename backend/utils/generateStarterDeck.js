// utils/generateStarterDeck.js
const cards = require("../cards.json");

// OPTIONAL: list of ability keywords to exclude from beginner decks
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

function generateStarterDeck() {
  // Filter cards by rarity and remove legendaries + banned abilities
  const commons = cards.filter(
    c => c.rarity === "C" && !bannedAbilities.has(c.abilityKeyword)
  );

  const uncommons = cards.filter(
    c => c.rarity === "U" && !bannedAbilities.has(c.abilityKeyword)
  );

  const rares = cards.filter(
    c => c.rarity === "R" && !bannedAbilities.has(c.abilityKeyword)
  );

  // Helper to pick N random unique cards
  function pickRandom(arr, count) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // Pick unique cards
  const selectedCommons = pickRandom(commons, 8);
  const selectedUncommons = pickRandom(uncommons, 4);
  const selectedRares = pickRandom(rares, 2);

  // Build deck with duplicates
  const deck = [
    ...selectedCommons.flatMap(c => Array(3).fill(c.cardId)), // 24 cards
    ...selectedUncommons.flatMap(c => Array(3).fill(c.cardId)), // 12 cards
    ...selectedRares.flatMap(c => Array(2).fill(c.cardId)) // 4 cards
  ];

  return deck; // 40 cards total
}

module.exports = generateStarterDeck;
