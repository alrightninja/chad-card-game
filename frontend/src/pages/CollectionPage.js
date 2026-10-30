import { useEffect, useState } from "react";
import { LayoutGroup } from "framer-motion";
import { api } from "../api/client";
import { useAudio } from "../audio/AudioProvider";
import CardView from "../components/CardView";
import SetFilterBar, { useSetFilter } from "../components/SetFilterBar";

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
          <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
            ×{card.quantity}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CollectionPage() {
  const audio = useAudio();
  const [collection, setCollection] = useState([]);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(null);
  const { layout, setLayout, setId, setSetId, filtered, groups } = useSetFilter(collection);

  useEffect(() => {
    audio?.setTrack("menu");
    api("/api/collection")
      .then((data) => setCollection(data.collection || []))
      .catch((err) => setError(err.message));
  }, [audio]);

  return (
    <LayoutGroup>
      <div>
        <h1>Collection</h1>
        <p className="muted">
          {filtered.length} unique card{filtered.length === 1 ? "" : "s"}
          {setId !== "all" ? " in this pack" : ""} — click one to inspect it.
        </p>
        {error ? <div className="error">{error}</div> : null}
        <SetFilterBar
          cards={collection}
          layout={layout}
          setLayout={setLayout}
          setId={setId}
          setSetId={setSetId}
        />
        {picked ? (
          <div className="panel row" style={{ marginBottom: "1rem", alignItems: "flex-start" }}>
            <CardView card={picked} layoutKey={`inspect-${picked.cardId}`} />
            <div>
              <h2 style={{ marginTop: 0 }}>{picked.name}</h2>
              <p>{picked.abilityText}</p>
              <p className="muted">{picked.flavorLine}</p>
              <p>
                Power {picked.power} · {picked.trait} · {picked.rarity} · ×{picked.quantity}
              </p>
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
