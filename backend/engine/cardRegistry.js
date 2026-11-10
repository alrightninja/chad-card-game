const catalog = require("../cards.json");
const { DECK_SIZE, HP_MULT, rarityBucket } = require("./rules");
const { releasedSetNumbers } = require("../lib/packs");

const AI_MAX_COPIES = 2;
const AI_MAX_RARES = 6;
const AI_MAX_LEGENDARIES = 2;

const byId = new Map(catalog.map((card) => [card.cardId, card]));
const byName = new Map(catalog.map((card) => [card.name.toLowerCase(), card]));

const CATALOG_VERSION = catalog.reduce(
  (max, card) => Math.max(max, card.version || 1),
  1
);

function getAll() {
  return catalog;
}

function getById(cardId) {
  return byId.get(cardId) || null;
}

function getByName(name) {
  if (!name) return null;
  return byName.get(String(name).toLowerCase()) || null;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let instanceSeq = 0;

function toBattleUnit(card, instanceId) {
  instanceSeq += 1;
  const id = instanceId || `${card.cardId}:${instanceSeq}`;

  return {
    instanceId: id,
    cardId: card.cardId,
    name: card.name,
    trait: card.trait,
    power: card.power,
    printedPower: card.power,
    maxHp: card.power * HP_MULT,
    hp: card.power * HP_MULT,
    rarity: card.rarity,
    abilityCategory: card.abilityCategory,
    abilityKeyword: card.abilityKeyword,
    abilityValue: card.abilityValue,
    abilityText: card.abilityText,
    ability: {
      keyword: card.abilityKeyword,
      value: card.abilityValue
    },
    flavorLine: card.flavorLine,
    art: card.art,
    set: card.set,
    version: card.version,
    tempPower: 0,
    silencedTurns: 0,
    silenced: false,
    stunned: false,
    tiredTurns: 0,
    shield: 0,
    armor: 0,
    rooted: false,
    retreatFree: false,
    unblockable: false,
    reverseWeakness: false,
    multiAttack: 1,
    baseMultiAttack: 1,
    playedThisTurn: false
  };
}

function deckToUnits(cardIds) {
  return cardIds.flatMap((cardId, index) => {
    const card = getById(cardId);
    if (!card) return [];
    return [toBattleUnit(card, `${cardId}:${index}:${instanceSeq + 1}`)];
  });
}

function randomAiDeckIds(size = DECK_SIZE, now = new Date()) {
  const released = releasedSetNumbers(now);
  const pool = shuffle(catalog.filter((c) => released.has(c.set)));
  if (!pool.length) {
    throw new Error("No released cards available for the AI deck");
  }

  const deck = [];
  const copies = {};
  let rares = 0;
  let legendaries = 0;

  function tryAdd(card) {
    if (deck.length >= size) return false;
    const n = copies[card.cardId] || 0;
    if (n >= AI_MAX_COPIES) return false;
    const bucket = rarityBucket(card.rarity);
    if (bucket === "R" && rares >= AI_MAX_RARES) return false;
    if (bucket === "L" && legendaries >= AI_MAX_LEGENDARIES) return false;
    copies[card.cardId] = n + 1;
    if (bucket === "R") rares += 1;
    if (bucket === "L") legendaries += 1;
    deck.push(card.cardId);
    return true;
  }

  for (const card of pool) tryAdd(card);
  for (const card of pool) {
    if (deck.length >= size) break;
    tryAdd(card);
  }
  if (deck.length < size) {
    const fillers = shuffle(pool.filter((c) => {
      const bucket = rarityBucket(c.rarity);
      return bucket !== "R" && bucket !== "L";
    }));
    for (const card of fillers) {
      if (deck.length >= size) break;
      tryAdd(card);
    }
  }
  if (deck.length !== size) {
    throw new Error(`AI deck expected ${size} released cards, built ${deck.length}`);
  }
  return deck;
}

module.exports = {
  CATALOG_VERSION,
  getAll,
  getById,
  getByName,
  shuffle,
  toBattleUnit,
  deckToUnits,
  randomAiDeckIds
};
