import { useEffect, useState } from "react";
import { LayoutGroup } from "framer-motion";
import { api } from "../api/client";
import { useAudio } from "../audio/AudioProvider";
import CardView from "../components/CardView";

export default function CollectionPage() {
  const audio = useAudio();
  const [collection, setCollection] = useState([]);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(null);

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
        <p className="muted">{collection.length} unique cards — click one to inspect it.</p>
        {error ? <div className="error">{error}</div> : null}
        {picked ? (
          <div className="panel row" style={{ marginBottom: "1rem", alignItems: "flex-start" }}>
            <CardView card={picked} layoutKey={`inspect-${picked.cardId}`} />
            <div>
              <h2 style={{ marginTop: 0 }}>{picked.name}</h2>
              <p>{picked.abilityText}</p>
              <p className="muted">{picked.flavorLine}</p>
              <p>Power {picked.power} · {picked.trait} · {picked.rarity} · ×{picked.quantity}</p>
            </div>
          </div>
        ) : null}
        <div className="card-grid">
          {collection.map((card) => (
            <div key={card.cardId}>
              <CardView
                layoutKey={`col-${card.cardId}`}
                card={card}
                selected={picked?.cardId === card.cardId}
                onClick={() => {
                  audio?.playSfx("select");
                  setPicked(card);
                }}
              />
              <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
                ×{card.quantity}
              </div>
            </div>
          ))}
        </div>
      </div>
    </LayoutGroup>
  );
}
