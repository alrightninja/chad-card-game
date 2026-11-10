import { useEffect, useState } from "react";
import { LayoutGroup } from "framer-motion";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useAudio } from "../audio/AudioProvider";
import CardView from "../components/CardView";

export default function ShopPage() {
  const { refresh } = useAuth();
  const audio = useAudio();
  const [packs, setPacks] = useState([]);
  const [opened, setOpened] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    audio?.setTrack("menu");
    api("/api/shop/packs")
      .then((data) => setPacks(data.packs || []))
      .catch((err) => setError(err.message));
  }, [audio]);

  async function buy(packType) {
    setBusy(true);
    setError("");
    setOpened([]);
    try {
      const data = await api("/api/shop/buy-pack", {
        method: "POST",
        body: JSON.stringify({ packType })
      });
      audio?.playSfx("play");
      setOpened(data.cards || []);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <LayoutGroup>
      <div className="stack">
        <h1>Shop</h1>
        {error ? <div className="error">{error}</div> : null}
        <div className="pack-shelf">
          {packs.map((pack) => {
            const ended = pack.sale === "ended" || (pack.onSale === false && pack.sale !== "soon");
            const soon = pack.sale === "soon";
            const locked = !pack.onSale;
            return (
              <div className={`pack-offer ${ended ? "ended" : ""} ${soon ? "soon" : ""}`} key={pack.id}>
                {pack.art ? (
                  <img className="pack-art" src={pack.art} alt={`${pack.name} booster pack`} />
                ) : null}
                <div className="pack-meta">
                  <strong>{pack.name}</strong>
                  <div className="muted">{pack.cards} cards · {pack.cost} reps</div>
                  {ended ? (
                    <div className="muted">Unavailable until further notice</div>
                  ) : soon ? (
                    <div className="muted">Not on sale yet</div>
                  ) : null}
                  <button
                    className="btn"
                    type="button"
                    disabled={busy || locked}
                    onClick={() => buy(pack.id)}
                  >
                    {ended ? "Unavailable" : soon ? "Coming soon" : "Open pack"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {opened.length ? (
          <div>
            <h2>You pulled</h2>
            <div className="card-grid">
              {opened.map((card, i) => (
                <CardView
                  key={`${card.cardId}-${i}`}
                  layoutKey={`pull-${card.cardId}-${i}`}
                  card={card}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </LayoutGroup>
  );
}
