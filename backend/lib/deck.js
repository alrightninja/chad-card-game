const { DECK_SIZE } = require("../engine/rules");
const { getById } = require("../engine/cardRegistry");

const MAX_COPIES = 2;
const MAX_RARES = 6;
const MAX_LEGENDARIES = 2;

function copyCounts(cards) {
  const counts = {};
  for (const id of cards || []) {
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

function rarityBucket(cardId) {
  const rarity = getById(cardId)?.rarity || "C";
  if (rarity === "L") return "L";
  if (rarity === "R" || rarity === "SR" || rarity === "UR") return "R";
  if (rarity === "U") return "U";
  return "C";
}

function rarityCounts(cards) {
  const counts = { C: 0, U: 0, R: 0, L: 0 };
  for (const id of cards || []) {
    const bucket = rarityBucket(id);
    counts[bucket] = (counts[bucket] || 0) + 1;
  }
  return counts;
}

function deckLimits() {
  return {
    size: DECK_SIZE,
    copies: MAX_COPIES,
    rares: MAX_RARES,
    legendaries: MAX_LEGENDARIES
  };
}

function deckIllegalReason(cards, size = DECK_SIZE) {
  if (!Array.isArray(cards) || cards.length !== size) {
    return `Deck must contain exactly ${size} cards`;
  }
  const copies = copyCounts(cards);
  for (const [id, n] of Object.entries(copies)) {
    if (n > MAX_COPIES) {
      const name = getById(id)?.name || id;
      return `Too many copies of ${name} (max ${MAX_COPIES})`;
    }
  }
  const rarities = rarityCounts(cards);
  if (rarities.L > MAX_LEGENDARIES) {
    return `Too many Legendaries (max ${MAX_LEGENDARIES} in a ${size}-card deck)`;
  }
  if (rarities.R > MAX_RARES) {
    return `Too many Rares (max ${MAX_RARES} in a ${size}-card deck)`;
  }
  return null;
}

function isLegalDeckList(cards, size = DECK_SIZE) {
  return !deckIllegalReason(cards, size);
}

function deckNeedsRebuild(cards, size = DECK_SIZE) {
  return !isLegalDeckList(cards, size);
}

function describeDeck(deck, size = DECK_SIZE) {
  const cards = deck?.cards || [];
  return {
    name: deck?.name,
    cards,
    legal: isLegalDeckList(cards, size),
    needsRebuild: deckNeedsRebuild(cards, size)
  };
}

module.exports = {
  copyCounts,
  rarityCounts,
  deckLimits,
  deckIllegalReason,
  isLegalDeckList,
  deckNeedsRebuild,
  describeDeck,
  DECK_SIZE,
  MAX_COPIES,
  MAX_RARES,
  MAX_LEGENDARIES
};
