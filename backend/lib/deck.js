const { DECK_SIZE } = require("../engine/rules");

function copyCounts(cards) {
  const counts = {};
  for (const id of cards || []) {
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

function isLegalDeckList(cards, size = DECK_SIZE) {
  if (!Array.isArray(cards) || cards.length !== size) return false;
  return Object.values(copyCounts(cards)).every((n) => n <= 3);
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

module.exports = { copyCounts, isLegalDeckList, deckNeedsRebuild, describeDeck, DECK_SIZE };
