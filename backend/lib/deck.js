const { DECK_SIZE, rarityBucket: bucketOf } = require("../engine/rules");
const { getById } = require("../engine/cardRegistry");

const MAX_COPIES = 2;
const MAX_RARES = 6;
const MAX_UNCOMMONS = 8;
const MAX_LEGENDARIES = 2;
const MAX_MYTHICS = 1;

function copyCounts(cards) {
  const counts = {};
  for (const id of cards || []) {
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

function rarityBucket(cardId) {
  return bucketOf(getById(cardId)?.rarity || "C");
}

function rarityCounts(cards) {
  const counts = { C: 0, U: 0, R: 0, L: 0, M: 0 };
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
    uncommons: MAX_UNCOMMONS,
    rares: MAX_RARES,
    legendaries: MAX_LEGENDARIES,
    mythics: MAX_MYTHICS
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
  if (rarities.M > MAX_MYTHICS) {
    return `Too many Mythics (max ${MAX_MYTHICS} in a ${size}-card deck)`;
  }
  if (rarities.M > 0 && rarities.L > 0) {
    return "A deck can run 1 Mythic or up to 2 Legendaries, not both";
  }
  if (rarities.L > MAX_LEGENDARIES) {
    return `Too many Legendaries (max ${MAX_LEGENDARIES} in a ${size}-card deck)`;
  }
  if (rarities.R > MAX_RARES) {
    return `Too many Rares (max ${MAX_RARES} in a ${size}-card deck)`;
  }
  if (rarities.U > MAX_UNCOMMONS) {
    return `Too many Uncommons (max ${MAX_UNCOMMONS} in a ${size}-card deck)`;
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
  MAX_UNCOMMONS,
  MAX_LEGENDARIES,
  MAX_MYTHICS
};
