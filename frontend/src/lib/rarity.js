const LABELS = {
  C: "Common",
  U: "Uncommon",
  R: "Rare",
  SR: "Rare",
  UR: "Rare",
  L: "Legendary",
  M: "Mythic"
};

export function rarityLabel(rarity) {
  if (!rarity) return "";
  return LABELS[rarity] || rarity;
}

export function rarityBucket(rarity) {
  if (rarity === "M") return "M";
  if (rarity === "L") return "L";
  if (rarity === "R" || rarity === "SR" || rarity === "UR") return "R";
  if (rarity === "U") return "U";
  return "C";
}

export function rarityClass(rarity) {
  return `rarity-${rarityBucket(rarity)}`;
}

/** Commons and Uncommons may Assist or receive an Assist. */
export function canAssist(unit) {
  if (!unit) return false;
  const bucket = rarityBucket(unit.rarity);
  return bucket === "C" || bucket === "U";
}
