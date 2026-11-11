const cards = require("../cards.json");

const weights = {
  C: 700,
  U: 200,
  R: 90,
  L: 8,
  M: 2
};

const FALLBACK = { M: "L", L: "R", R: "U", U: "C" };

function rollRarity() {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;

  for (const rarity in weights) {
    if (roll < weights[rarity]) return rarity;
    roll -= weights[rarity];
  }

  return "C";
}

function poolFor(setNumber, rarity) {
  let want = rarity;
  while (want) {
    const pool = cards.filter((c) => c.rarity === want && c.set === setNumber);
    if (pool.length) return pool;
    want = FALLBACK[want];
  }
  return cards.filter((c) => c.set === setNumber);
}

function openPack(setNumber, packSize = 5) {
  const pulled = [];

  for (let i = 0; i < packSize; i++) {
    const rarity = rollRarity();
    const pool = poolFor(setNumber, rarity);
    const randomCard = pool[Math.floor(Math.random() * pool.length)];
    pulled.push(randomCard.cardId);
  }

  return pulled;
}

module.exports = openPack;
module.exports.weights = weights;
