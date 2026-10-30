import { useMemo, useState } from "react";
import { SETS, filterBySet, groupBySet } from "../lib/sets";

export function useSetFilter(cards) {
  const [layout, setLayout] = useState("all");
  const [setId, setSetId] = useState("all");

  const filtered = useMemo(() => filterBySet(cards, setId), [cards, setId]);
  const groups = useMemo(() => groupBySet(filtered), [filtered]);

  return { layout, setLayout, setId, setSetId, filtered, groups };
}

export default function SetFilterBar({
  cards,
  layout,
  setLayout,
  setId,
  setSetId
}) {
  const ownedSets = useMemo(() => {
    const have = new Set(cards.map((c) => Number(c.set)).filter(Boolean));
    return SETS.filter((s) => have.has(s.id));
  }, [cards]);

  return (
    <div className="set-filter" role="group" aria-label="Organize cards">
      <div className="set-filter-row">
        <span className="muted set-filter-label">View</span>
        <button
          className={`btn ${layout === "all" ? "" : "secondary"}`}
          type="button"
          onClick={() => setLayout("all")}
        >
          All cards
        </button>
        <button
          className={`btn ${layout === "grouped" ? "" : "secondary"}`}
          type="button"
          onClick={() => setLayout("grouped")}
        >
          Group by pack
        </button>
      </div>
      <div className="set-filter-row">
        <span className="muted set-filter-label">Pack</span>
        <button
          className={`btn ${setId === "all" ? "" : "secondary"}`}
          type="button"
          onClick={() => setSetId("all")}
        >
          All packs
        </button>
        {ownedSets.map((s) => (
          <button
            key={s.id}
            className={`btn ${String(setId) === String(s.id) ? "" : "secondary"}`}
            type="button"
            onClick={() => setSetId(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
