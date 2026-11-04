export function pickNextIndex(length, lastIndex, rand = Math.random) {
  if (length <= 1) return 0;
  let next = Math.floor(rand() * (length - 1));
  if (lastIndex == null || lastIndex < 0) return Math.floor(rand() * length);
  if (next >= lastIndex) next += 1;
  return next;
}

export function reshuffleOrder(length, lastIndex, rand = Math.random) {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (length > 1 && lastIndex != null && order[0] === lastIndex) {
    const swapWith = order.findIndex((n) => n !== lastIndex);
    if (swapWith > 0) {
      [order[0], order[swapWith]] = [order[swapWith], order[0]];
    }
  }
  return order;
}
