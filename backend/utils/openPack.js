const cards = require("../cards.json");

// Rarity weights
const weights = {
  C: 70,
  U: 20,
  R: 9,
  L: 1
};

// Helper: pick a rarity based on weight
function rollRarity() {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;

  for (const rarity in weights) {
    if (roll < weights[rarity]) return rarity;
    roll -= weights[rarity];
  }

  return "C"; // fallback
}

function openPack(setNumber, packSize = 5) {
  const pulled = [];

  for (let i = 0; i < packSize; i++) {
    const rarity = rollRarity();

    // Filter by rarity AND set
    const pool = cards.filter(
      c => c.rarity === rarity && c.set === setNumber
    );

    // If no cards of that rarity exist in this set, fallback to any card in the set
    const finalPool = pool.length > 0
      ? pool
      : cards.filter(c => c.set === setNumber);

    const randomCard = finalPool[Math.floor(Math.random() * finalPool.length)];
    pulled.push(randomCard.cardId);
  }

  return pulled;
}

module.exports = openPack;
