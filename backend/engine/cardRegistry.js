const catalog = require("../cards.json");

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
  return cardIds.map((cardId, index) => {
    const card = getById(cardId);
    if (!card) {
      throw new Error(`Unknown cardId: ${cardId}`);
    }
    return toBattleUnit(card, `${cardId}:${index}:${instanceSeq + 1}`);
  });
}

function randomAiDeckIds(size = 40) {
  const ids = catalog.map((c) => c.cardId);
  return shuffle(ids).slice(0, size);
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
