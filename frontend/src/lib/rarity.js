const LABELS = {
  C: "Common",
  U: "Uncommon",
  R: "Rare",
  SR: "Rare",
  UR: "Rare",
  L: "Legendary"
};

export function rarityLabel(rarity) {
  if (!rarity) return "";
  return LABELS[rarity] || rarity;
}

export function rarityBucket(rarity) {
  if (rarity === "L") return "L";
  if (rarity === "R" || rarity === "SR" || rarity === "UR") return "R";
  if (rarity === "U") return "U";
  return "C";
}

export function rarityClass(rarity) {
  return `rarity-${rarityBucket(rarity)}`;
}
