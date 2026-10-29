import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAudio } from "../audio/AudioProvider";
import { useAuth } from "../context/AuthContext";

export default function PlayPage() {
  const audio = useAudio();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState([]);
  const [deckName, setDeckName] = useState("");
  const [active, setActive] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [d, m] = await Promise.all([api("/api/decks"), api("/api/matches/active")]);
    const list = d.decks || [];
    setDecks(list);
    if (list[0]) setDeckName((name) => name || list[0].name);
    setActive(m.match || null);
  }

  useEffect(() => {
    audio?.setTrack("menu");
    load().catch((err) => setError(err.message));
  }, [audio]);

  async function startAi() {
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/matches", {
        method: "POST",
        body: JSON.stringify({ deckName })
      });
      navigate(`/battle/${data.match.id}`);
    } catch (err) {
      if (err.status === 409 && err.data?.match?.id) {
        setActive(err.data.match);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <h1>Play</h1>
      <p className="muted">
        Live games are for when both of you are here. Correspondence games give each player hours (or a day) per move.
      </p>
      {active ? (
        <div className="panel stack">
          <strong>You already have a match vs {active.versus || "an opponent"}.</strong>
          <p className="muted" style={{ margin: 0 }}>Resume it, or forfeit before starting another.</p>
          <div className="row">
            <button className="btn" type="button" onClick={() => navigate(`/battle/${active.id}`)}>Resume</button>
            <button
              className="btn secondary"
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm("Forfeit this match? You will take the loss.")) return;
                setBusy(true);
                setError("");
                try {
                  await api(`/api/matches/${active.id}/forfeit`, { method: "POST", body: JSON.stringify({}) });
                  await refresh();
                  setActive(null);
                } catch (err) {
                  setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Forfeit
            </button>
          </div>
        </div>
      ) : null}
      <label>
        Deck
        <select value={deckName} onChange={(e) => setDeckName(e.target.value)}>
          {decks.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name} ({d.cards?.length || 0})
            </option>
          ))}
        </select>
      </label>
      {error ? <div className="error">{error}</div> : null}
      <button className="btn" disabled={busy || !deckName || !!active} onClick={startAi}>
        Battle vs AI
      </button>
      <p className="muted">
        Friend challenges (live or correspondence) live on the Friends page. Open matchmaking can wait until there are enough players.
      </p>
    </div>
  );
}
