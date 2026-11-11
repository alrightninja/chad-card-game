const { getById } = require("../engine/cardRegistry");
const { rarityBucket } = require("../engine/rules");

const SALE_REPS = { C: 5, U: 10, R: 15, L: 20, M: 25 };

function saleRepsFor(cardId) {
  const bucket = rarityBucket(getById(cardId)?.rarity || "C");
  return SALE_REPS[bucket] || SALE_REPS.C;
}

function countsOf(ids) {
  const counts = {};
  for (const id of ids || []) {
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

function hasCopies(collection, needed) {
  const have = countsOf(collection);
  const want = countsOf(needed);
  for (const [id, n] of Object.entries(want)) {
    if ((have[id] || 0) < n) return false;
  }
  return true;
}

function takeCopies(collection, needed) {
  const next = [...(collection || [])];
  for (const id of needed || []) {
    const i = next.indexOf(id);
    if (i < 0) {
      const err = new Error("You no longer have those cards");
      err.status = 400;
      throw err;
    }
    next.splice(i, 1);
  }
  return next;
}

function pruneDecksToCollection(user) {
  const have = countsOf(user.collection);
  for (const deck of user.decks || []) {
    const used = {};
    deck.cards = (deck.cards || []).filter((id) => {
      if (!getById(id)) return false;
      used[id] = (used[id] || 0) + 1;
      return (have[id] || 0) >= used[id];
    });
  }
}

function uniqueOwnedIds(collection) {
  return [...new Set((collection || []).filter((id) => getById(id)))];
}

module.exports = {
  countsOf,
  hasCopies,
  takeCopies,
  pruneDecksToCollection,
  uniqueOwnedIds,
  SALE_REPS,
  saleRepsFor
};
