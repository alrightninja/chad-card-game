const { DECK_SIZE, rarityBucket: bucketOf } = require("../engine/rules");
const { getById, getByName } = require("../engine/cardRegistry");

const MAX_COPIES = 2;
const MAX_RARES = 6;
const MAX_UNCOMMONS = 8;
const MAX_LEGENDARIES = 2;
const MAX_MYTHICS = 1;

function asCardId(entry) {
  if (entry == null || entry === "") return "";
  if (typeof entry === "string" || typeof entry === "number") {
    return String(entry).trim();
  }
  if (typeof entry === "object") {
    const id = entry.cardId || entry.id;
    if (id != null && id !== "") return String(id).trim();
  }
  return "";
}

function lookupCard(entry) {
  const id = asCardId(entry);
  if (!id) return null;
  return getById(id) || getByName(id) || null;
}

function copyCounts(cards) {
  const counts = {};
  for (const entry of cards || []) {
    const id = lookupCard(entry)?.cardId || asCardId(entry);
    if (!id) continue;
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

function rarityBucket(entry) {
  return bucketOf(lookupCard(entry)?.rarity || "C");
}

function rarityCounts(cards) {
  const counts = { C: 0, U: 0, R: 0, L: 0, M: 0 };
  for (const entry of cards || []) {
    const bucket = rarityBucket(entry);
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

function normalizeDeckIds(cards) {
  return (cards || []).map((entry) => lookupCard(entry)?.cardId || asCardId(entry)).filter(Boolean);
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
  const illegalReason = deckIllegalReason(cards, size);
  return {
    name: deck?.name,
    cards,
    legal: !illegalReason,
    needsRebuild: Boolean(illegalReason),
    illegalReason,
    rarityCounts: rarityCounts(cards)
  };
}

module.exports = {
  asCardId,
  normalizeDeckIds,
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
