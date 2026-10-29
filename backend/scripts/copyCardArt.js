const fs = require("fs");
const path = require("path");
const cards = require("../cards.json");

const SRC = path.join(__dirname, "../../assets/character-card-images");
const DEST = path.join(__dirname, "../../frontend/public/cards");

function extOf(file) {
  return path.extname(file).toLowerCase();
}

function compact(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Source filenames that don't match the catalog name exactly. */
const ALIASES = {
  blitzkrueger: "Dr. Blitzkrueger",
  "churro-wielding astronaut": "Churro-Weilding Astronaut",
  "cosplay knight toaster": "Toaster Cosplay Knight",
  "depressed balloon animal": "Deressed Balloon Animal",
  "dumpster possum shaman": "Dumpster Possom Shaman",
  "emotionally available kraken": "Emotionally Available Kraket",
  "sentient cactus in a poncho": "Sentient Cactus",
  "unstoppable grandma scooter": "Unstoppable Granny Scooter",
  "pastor chadenbach": "Pastor Chadenbach 2",
  "pastor chadrigo": "Pastor Jorge",
  "the chadministrator": "The Chadministrator"
};

function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Missing art folder:", SRC);
    process.exit(1);
  }
  fs.mkdirSync(DEST, { recursive: true });

  const files = fs.readdirSync(SRC);
  const byStem = new Map();
  const byCompact = new Map();
  for (const file of files) {
    const stem = path.basename(file, path.extname(file));
    byStem.set(stem.toLowerCase(), file);
    byCompact.set(compact(stem), file);
  }

  let copied = 0;
  const missing = [];

  for (const card of cards) {
    const nameKey = card.name.toLowerCase();
    const artStem = path.basename(card.art || "", path.extname(card.art || "")).toLowerCase();
    const alias = ALIASES[nameKey];
    const file =
      (alias && (byStem.get(alias.toLowerCase()) || byCompact.get(compact(alias)))) ||
      byStem.get(nameKey) ||
      byStem.get(artStem.replace(/_/g, " ")) ||
      byStem.get(artStem) ||
      byCompact.get(compact(card.name)) ||
      byCompact.get(compact(artStem));

    if (!file) {
      missing.push(card.name);
      continue;
    }

    const destName = card.art && extOf(card.art)
      ? card.art
      : `${card.cardId}${extOf(file)}`;
    fs.copyFileSync(path.join(SRC, file), path.join(DEST, destName));
    copied += 1;
  }

  console.log(`Copied ${copied} card images to frontend/public/cards`);
  if (missing.length) {
    console.log(`Missing art for ${missing.length} cards:`);
    missing.forEach((n) => console.log(" -", n));
  }
}

main();
