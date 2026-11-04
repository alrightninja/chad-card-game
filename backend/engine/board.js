const { MAX_ACTIVE, MAX_BENCH } = require("./rules");

function enforceBoardLimits(side) {
  if (!side) return side;
  side.active = Array.isArray(side.active) ? side.active.filter(Boolean) : [];
  side.bench = Array.isArray(side.bench) ? side.bench.filter(Boolean) : [];
  while (side.active.length > MAX_ACTIVE) {
    const extra = side.active.pop();
    if (side.bench.length < MAX_BENCH) side.bench.push(extra);
    else (side.hand || (side.hand = [])).push(extra);
  }
  while (side.bench.length > MAX_BENCH) {
    const extra = side.bench.pop();
    (side.hand || (side.hand = [])).push(extra);
  }
  return side;
}

function addToActive(side, unit) {
  if ((side.active || []).length >= MAX_ACTIVE) {
    if ((side.bench || []).length < MAX_BENCH) {
      side.bench.push(unit);
      return "bench";
    }
    (side.hand || (side.hand = [])).push(unit);
    return "hand";
  }
  side.active.push(unit);
  return "active";
}

module.exports = { enforceBoardLimits, addToActive, MAX_ACTIVE, MAX_BENCH };
