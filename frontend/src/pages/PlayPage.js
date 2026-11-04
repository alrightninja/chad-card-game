import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAudio } from "../audio/AudioProvider";
import { useAuth } from "../context/AuthContext";

function MatchBanner({ title, match, busy, onResume, onForfeit }) {
  if (!match) return null;
  return (
    <div className="panel stack">
      <strong>{title} vs {match.versus || "an opponent"}.</strong>
      <div className="row">
        <button className="btn" type="button" onClick={onResume}>Resume</button>
        <button className="btn secondary" type="button" disabled={busy} onClick={onForfeit}>
          Forfeit
        </button>
      </div>
    </div>
  );
}

export default function PlayPage() {
  const audio = useAudio();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState([]);
  const [deckName, setDeckName] = useState("");
  const [live, setLive] = useState(null);
  const [correspondence, setCorrespondence] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [d, m] = await Promise.all([api("/api/decks"), api("/api/matches/active")]);
    const list = d.decks || [];
    setDecks(list);
    const legal = list.find((deck) => deck.legal !== false && (deck.cards || []).length === 20);
    if (legal) setDeckName((name) => name || legal.name);
    else if (list[0]) setDeckName((name) => name || list[0].name);
    setLive(m.live || (m.match?.mode === "correspondence" ? null : m.match) || null);
    setCorrespondence(m.correspondence || (m.match?.mode === "correspondence" ? m.match : null) || null);
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
        setLive(err.data.match);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function forfeit(id, clear) {
    if (!window.confirm("Forfeit this match? You will take the loss.")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/matches/${id}/forfeit`, { method: "POST", body: JSON.stringify({}) });
      await refresh();
      clear();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const selected = decks.find((d) => d.name === deckName);
  const deckLegal = selected && (selected.legal !== false) && (selected.cards || []).length === 20;

  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <h1>Play</h1>
      <p className="muted">
        You can have one live match and one correspondence match at the same time. Live games are for when both of you are here. Correspondence games give each player hours (or a day) per move.
      </p>
      <MatchBanner
        title="Live match"
        match={live}
        busy={busy}
        onResume={() => navigate(`/battle/${live.id}`)}
        onForfeit={() => forfeit(live.id, () => setLive(null))}
      />
      <MatchBanner
        title="Correspondence match"
        match={correspondence}
        busy={busy}
        onResume={() => navigate(`/battle/${correspondence.id}`)}
        onForfeit={() => forfeit(correspondence.id, () => setCorrespondence(null))}
      />
      <label>
        Deck
        <select value={deckName} onChange={(e) => setDeckName(e.target.value)}>
          {decks.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name} ({d.cards?.length || 0}{d.needsRebuild ? " — rebuild to 20" : ""})
            </option>
          ))}
        </select>
      </label>
      {selected?.needsRebuild ? (
        <p className="muted">
          This deck is not 20 cards yet. Open Decks and save a legal 20 — your collection is unchanged.
        </p>
      ) : null}
      {error ? <div className="error">{error}</div> : null}
      <button className="btn" disabled={busy || !deckName || !!live || !deckLegal} onClick={startAi}>
        Battle vs AI
      </button>
      <p className="muted">
        Vs AI is first to 5 KOs. Friend challenges (live or correspondence, KO goal 3–10) live on the Friends page.
      </p>
    </div>
  );
}
