const PACKS = [
  {
    id: "ordo_chadorum",
    name: "Ordo Chadorum",
    cost: 100,
    cards: 5,
    set: 1,
    art: "/packs/ordo_chadorum.jpg"
  },
  {
    id: "ultra_nightmare_mode",
    name: "Ultra Nightmare Mode",
    cost: 100,
    cards: 5,
    set: 2,
    art: "/packs/ultra_nightmare_mode.jpg",
    availableFrom: process.env.ULTRA_NIGHTMARE_RELEASE_AT || "2026-11-16T05:00:00.000Z"
  },
  {
    id: "to_the_hilt",
    name: "To the Hilt",
    cost: 100,
    cards: 5,
    set: 3,
    art: "/packs/to_the_hilt.jpg",
    availableFrom: process.env.TO_THE_HILT_RELEASE_AT || "2026-12-01T05:00:00.000Z"
  },
  {
    id: "chaos",
    name: "Chaos",
    cost: 100,
    cards: 5,
    set: 4,
    art: "/packs/chaos.jpg",
    availableFrom: process.env.CHAOS_RELEASE_AT || "2027-02-01T05:00:00.000Z"
  }
];

function packOnSale(pack, now = new Date()) {
  if (pack.availableFrom) {
    const start = new Date(pack.availableFrom);
    if (Number.isNaN(start.getTime()) || now < start) return false;
  } else if (pack.available === false) {
    return false;
  }
  if (pack.availableUntil) {
    const end = new Date(pack.availableUntil);
    if (!Number.isNaN(end.getTime()) && now >= end) return false;
  }
  return true;
}

function releasedSetNumbers(now = new Date(), packs = PACKS) {
  return new Set(packs.filter((pack) => packOnSale(pack, now)).map((pack) => pack.set));
}

module.exports = { PACKS, packOnSale, releasedSetNumbers };
