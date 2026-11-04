import { pickNextIndex, reshuffleOrder } from "./shufflePlaylist";

test("never picks the same track twice in a row", () => {
  for (let last = 0; last < 6; last += 1) {
    for (let r = 0; r < 1; r += 0.1) {
      const next = pickNextIndex(6, last, () => r);
      expect(next).not.toBe(last);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(6);
    }
  }
});

test("reshuffled order does not start with the last track", () => {
  const order = reshuffleOrder(6, 2, () => 0.1);
  expect(order[0]).not.toBe(2);
  expect(new Set(order).size).toBe(6);
});
