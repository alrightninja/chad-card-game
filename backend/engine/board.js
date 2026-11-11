const { MAX_ACTIVE, MAX_BENCH } = require("./rules");

function unitIsDown(unit) {
  return Boolean(unit && Number.isFinite(Number(unit.hp)) && Number(unit.hp) <= 0);
}

function parkLiving(side, unit) {
  if (!unit) return "none";
  if (unitIsDown(unit)) {
    (side.discard || (side.discard = [])).push(unit);
    return "discard";
  }
  if ((side.bench || []).length < MAX_BENCH) {
    side.bench.push(unit);
    return "bench";
  }
  (side.hand || (side.hand = [])).push(unit);
  return "hand";
}

function enforceBoardLimits(side) {
  if (!side) return side;
  side.active = Array.isArray(side.active) ? side.active.filter(Boolean) : [];
  side.bench = Array.isArray(side.bench) ? side.bench.filter(Boolean) : [];
  side.hand = Array.isArray(side.hand) ? side.hand.filter(Boolean) : [];
  side.discard = Array.isArray(side.discard) ? side.discard : [];
  for (const zone of ["active", "bench", "hand"]) {
    const keep = [];
    for (const unit of side[zone]) {
      if (unitIsDown(unit)) side.discard.push(unit);
      else keep.push(unit);
    }
    side[zone] = keep;
  }
  while (side.active.length > MAX_ACTIVE) {
    parkLiving(side, side.active.pop());
  }
  while (side.bench.length > MAX_BENCH) {
    const extra = side.bench.pop();
    if (unitIsDown(extra)) side.discard.push(extra);
    else (side.hand || (side.hand = [])).push(extra);
  }
  return side;
}

function addToActive(side, unit) {
  if (!unit) return "none";
  if (unitIsDown(unit)) {
    (side.discard || (side.discard = [])).push(unit);
    return "discard";
  }
  if ((side.active || []).length >= MAX_ACTIVE) {
    return parkLiving(side, unit);
  }
  side.active.push(unit);
  return "active";
}

module.exports = { enforceBoardLimits, addToActive, unitIsDown, MAX_ACTIVE, MAX_BENCH };
