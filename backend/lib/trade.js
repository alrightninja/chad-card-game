const { getById } = require("../engine/cardRegistry");
const { hasCopies } = require("./inventory");

const MIN_CARDS = 1;
const MAX_CARDS = 5;

function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => String(id || "").trim()).filter(Boolean);
}

function assertOfferSide(ids, label) {
  const list = normalizeIds(ids);
  if (list.length < MIN_CARDS || list.length > MAX_CARDS) {
    const err = new Error(`${label} must be ${MIN_CARDS} to ${MAX_CARDS} cards`);
    err.status = 400;
    throw err;
  }
  for (const id of list) {
    if (!getById(id)) {
      const err = new Error(`Unknown card: ${id}`);
      err.status = 400;
      throw err;
    }
  }
  return list;
}

function assertOffer(give, want, fromCollection, toCollection) {
  const giveIds = assertOfferSide(give, "Your offer");
  const wantIds = assertOfferSide(want, "Their cards");
  if (!hasCopies(fromCollection, giveIds)) {
    const err = new Error("You do not own every card in your offer");
    err.status = 400;
    throw err;
  }
  if (toCollection && !hasCopies(toCollection, wantIds)) {
    const err = new Error("They do not own every card you asked for");
    err.status = 400;
    throw err;
  }
  return { give: giveIds, want: wantIds };
}

function expandCards(ids) {
  const counts = {};
  for (const id of ids || []) counts[id] = (counts[id] || 0) + 1;
  return Object.entries(counts)
    .map(([cardId, quantity]) => {
      const card = getById(cardId);
      if (!card) return null;
      return { ...card, quantity };
    })
    .filter(Boolean);
}

function publicTrade(trade, viewerId) {
  if (!trade) return null;
  const fromId = String(trade.fromUserId);
  const toId = String(trade.toUserId);
  const mine = viewerId && fromId === String(viewerId);
  return {
    id: trade._id,
    fromUserId: fromId,
    toUserId: toId,
    fromUsername: trade.fromUsername,
    toUsername: trade.toUsername,
    give: trade.give,
    want: trade.want,
    giveCards: expandCards(trade.give),
    wantCards: expandCards(trade.want),
    status: trade.status,
    parentId: trade.parentId || null,
    createdAt: trade.createdAt,
    incoming: viewerId ? toId === String(viewerId) : false,
    outgoing: !!mine
  };
}

module.exports = {
  MIN_CARDS,
  MAX_CARDS,
  normalizeIds,
  assertOffer,
  expandCards,
  publicTrade
};
