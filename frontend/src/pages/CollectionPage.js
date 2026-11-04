import { useEffect, useMemo, useState } from "react";
import { LayoutGroup } from "framer-motion";
import { api } from "../api/client";
import { useAudio } from "../audio/AudioProvider";
import CardView from "../components/CardView";
import SetFilterBar, { useSetFilter } from "../components/SetFilterBar";
import { rarityLabel } from "../lib/rarity";

function mergeCatalog(catalog, owned) {
  const have = new Map((owned || []).map((card) => [card.cardId, card]));
  return (catalog || []).map((card) => {
    const copy = have.get(card.cardId);
    if (copy) return copy;
    return { ...card, quantity: 0, unowned: true };
  });
}

function CardGrid({ cards, picked, onPick, audio }) {
  if (!cards.length) {
    return <p className="muted">No cards in this pack yet.</p>;
  }
  return (
    <div className="card-grid">
      {cards.map((card) => (
        <div key={card.cardId}>
          <CardView
            layoutKey={`col-${card.cardId}`}
            card={card}
            selected={picked?.cardId === card.cardId}
            onClick={() => {
              audio?.playSfx("select");
              onPick(card);
            }}
          />
          <div className="muted card-slot-meta">
            {rarityLabel(card.rarity) || "Unknown"}
            {" · "}
            {card.unowned || !card.quantity ? "Not owned" : `×${card.quantity}`}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CollectionPage() {
  const audio = useAudio();
  const [owned, setOwned] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [ownedOnly, setOwnedOnly] = useState(true);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(null);

  const cards = useMemo(
    () => (ownedOnly ? owned : mergeCatalog(catalog, owned)),
    [ownedOnly, owned, catalog]
  );
  const { layout, setLayout, setId, setSetId, filtered, groups } = useSetFilter(cards);

  useEffect(() => {
    audio?.setTrack("menu");
    Promise.all([api("/api/collection"), api("/api/catalog")])
      .then(([mine, cat]) => {
        setOwned(mine.collection || []);
        setCatalog(cat.cards || []);
      })
      .catch((err) => setError(err.message));
  }, [audio]);

  const ownedCount = owned.length;
  const shownCount = filtered.length;

  return (
    <LayoutGroup>
      <div>
        <h1>Collection</h1>
        <p className="muted">
          {ownedOnly
            ? `${shownCount} unique card${shownCount === 1 ? "" : "s"} you own`
            : `${shownCount} cards in this view · ${ownedCount} unique owned`}
          {setId !== "all" ? " in this pack" : ""} — click one to inspect it.
        </p>
        {error ? <div className="error">{error}</div> : null}
        <SetFilterBar
          cards={cards}
          layout={layout}
          setLayout={setLayout}
          setId={setId}
          setSetId={setSetId}
          extraRow={(
            <div className="set-filter-row">
              <span className="muted set-filter-label">Show</span>
              <button
                className={`btn ${ownedOnly ? "" : "secondary"}`}
                type="button"
                onClick={() => {
                  setOwnedOnly(true);
                  setPicked(null);
                }}
              >
                Owned only
              </button>
              <button
                className={`btn ${ownedOnly ? "secondary" : ""}`}
                type="button"
                onClick={() => {
                  setOwnedOnly(false);
                  setPicked(null);
                }}
              >
                Full catalog
              </button>
            </div>
          )}
        />
        {picked ? (
          <div className="panel row" style={{ marginBottom: "1rem", alignItems: "flex-start" }}>
            <CardView card={picked} layoutKey={`inspect-${picked.cardId}`} />
            <div>
              <h2 style={{ marginTop: 0 }}>{picked.name}</h2>
              {picked.unowned || !picked.quantity ? (
                <p className="muted">
                  {rarityLabel(picked.rarity) || "Unknown rarity"}. Not in your collection yet. Open
                  packs to find this card.
                </p>
              ) : (
                <>
                  <p>{picked.abilityText}</p>
                  <p className="muted">{picked.flavorLine}</p>
                  <p>
                    Power {picked.power} · {picked.trait} · {rarityLabel(picked.rarity) || picked.rarity}
                    {picked.quantity ? ` · ×${picked.quantity}` : ""}
                  </p>
                </>
              )}
            </div>
          </div>
        ) : null}
        {layout === "grouped" ? (
          groups.map((group) => (
            <section key={group.id} className="set-section">
              <h2 className="set-heading">
                {group.name}
                <span className="muted"> · {group.cards.length}</span>
              </h2>
              <CardGrid cards={group.cards} picked={picked} onPick={setPicked} audio={audio} />
            </section>
          ))
        ) : (
          <CardGrid cards={filtered} picked={picked} onPick={setPicked} audio={audio} />
        )}
      </div>
    </LayoutGroup>
  );
}
