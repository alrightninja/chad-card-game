export const SETS = [
  { id: 1, name: "Ordo Chadorum" },
  { id: 2, name: "Ultra Nightmare Mode" },
  { id: 3, name: "To the Hilt" },
  { id: 4, name: "Chaos" }
];

export function setName(setId) {
  const found = SETS.find((s) => s.id === Number(setId));
  return found ? found.name : "Other";
}

export function filterBySet(cards, setId) {
  if (setId === "all") return cards;
  const n = Number(setId);
  return cards.filter((card) => Number(card.set) === n);
}

export function groupBySet(cards) {
  const buckets = new Map();
  SETS.forEach((s) => buckets.set(s.id, []));
  const other = [];
  cards.forEach((card) => {
    const n = Number(card.set);
    if (buckets.has(n)) buckets.get(n).push(card);
    else other.push(card);
  });
  const groups = SETS.map((s) => ({
    id: s.id,
    name: s.name,
    cards: buckets.get(s.id) || []
  })).filter((g) => g.cards.length);
  if (other.length) groups.push({ id: 0, name: "Other", cards: other });
  return groups;
}
