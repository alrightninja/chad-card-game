import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAudio } from "../audio/AudioProvider";
import { useAuth } from "../context/AuthContext";
import SearchSelect from "../components/SearchSelect";

function MatchBanner({ match, busy, onResume, onForfeit }) {
  if (!match) return null;
  const kind = match.mode === "correspondence" ? "Correspondence" : "Live";
  const name = match.opponentName || match.versus || "opponent";
  return (
    <div className="panel stack">
      <strong>
        {kind} vs {name}
        {match.yourTurn ? " — Your turn" : ""}
      </strong>
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
  const [params] = useSearchParams();
  const [decks, setDecks] = useState([]);
  const [deckName, setDeckName] = useState("");
  const [live, setLive] = useState(null);
  const [correspondences, setCorrespondences] = useState([]);
  const [friends, setFriends] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [acceptDeck, setAcceptDeck] = useState("");
  const [challenge, setChallenge] = useState({
    username: params.get("friend") || "",
    deckName: "",
    mode: "correspondence",
    hoursPerMove: 24,
    koLimit: 5
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [d, m, f, c] = await Promise.all([
      api("/api/decks"),
      api("/api/matches/active"),
      api("/api/friends").catch(() => ({ friends: [] })),
      api("/api/challenges").catch(() => ({ challenges: [] }))
    ]);
    const list = d.decks || [];
    setDecks(list);
    const legal = list.find((deck) => deck.legal !== false && (deck.cards || []).length === 20);
    const fallback = legal?.name || list[0]?.name || "";
    if (fallback) {
      setDeckName((name) => name || fallback);
      setAcceptDeck((name) => name || fallback);
      setChallenge((ch) => ({ ...ch, deckName: ch.deckName || fallback }));
    }
    setLive(m.live || (m.match?.mode === "correspondence" ? null : m.match) || null);
    setCorrespondences(m.correspondences || (m.correspondence ? [m.correspondence] : []));
    setFriends(f.friends || []);
    setChallenges(c.challenges || []);
  }

  useEffect(() => {
    audio?.setTrack("menu");
    load().catch((err) => setError(err.message));
  }, [audio]);

  useEffect(() => {
    const friend = params.get("friend");
    if (friend) setChallenge((ch) => ({ ...ch, username: friend }));
  }, [params]);

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

  async function forfeit(id, after) {
    if (!window.confirm("Forfeit this match? You will take the loss.")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/matches/${id}/forfeit`, { method: "POST", body: JSON.stringify({}) });
      await refresh();
      after();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendChallenge(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/challenges", {
        method: "POST",
        body: JSON.stringify(challenge)
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function answerChallenge(id, accept) {
    setBusy(true);
    setError("");
    try {
      const data = await api(`/api/challenges/${id}/respond`, {
        method: "POST",
        body: JSON.stringify({ accept, deckName: acceptDeck })
      });
      await load();
      if (data.match?.id) navigate(`/battle/${data.match.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const selected = decks.find((d) => d.name === deckName);
  const deckLegal = selected && (selected.legal !== false) && (selected.cards || []).length === 20;
  const corrFull = correspondences.length >= 3;

  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <h1>Play</h1>
      <p className="muted">
        One live match and up to three correspondence matches at a time. Live is for when you are both here. Correspondence gives each player hours per move.
      </p>
      <MatchBanner
        match={live}
        busy={busy}
        onResume={() => navigate(`/battle/${live.id}`)}
        onForfeit={() => forfeit(live.id, () => setLive(null))}
      />
      {correspondences.map((match) => (
        <MatchBanner
          key={match.id}
          match={match}
          busy={busy}
          onResume={() => navigate(`/battle/${match.id}`)}
          onForfeit={() => forfeit(match.id, () => {
            setCorrespondences((list) => list.filter((m) => m.id !== match.id));
          })}
        />
      ))}
      <label>
        Deck
        <select value={deckName} onChange={(e) => setDeckName(e.target.value)}>
          {decks.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name} ({d.cards?.length || 0}{d.legal === false ? " — rebuild" : ""})
            </option>
          ))}
        </select>
      </label>
      {selected?.legal === false ? (
        <p className="muted">
          {selected.illegalReason || "This deck is not legal yet."} Open Decks and save a legal 20 — your collection is unchanged.
        </p>
      ) : null}
      {error ? <div className="error">{error}</div> : null}
      <button className="btn" disabled={busy || !deckName || !!live || !deckLegal} onClick={startAi}>
        Battle vs AI
      </button>
      <p className="muted">Vs AI is first to 3 KOs.</p>

      <div className="panel stack">
        <strong>Challenge a friend</strong>
        <form className="stack" onSubmit={sendChallenge}>
          <SearchSelect
            label="Friend"
            placeholder="Search friends"
            value={challenge.username}
            options={(friends || []).map((u) => ({
              value: u.username,
              label: u.username,
              search: u.username,
              art: u.avatarArt ? `/cards/${u.avatarArt}` : ""
            }))}
            onChange={(username) => setChallenge({ ...challenge, username })}
            emptyText="No friends match that name"
          />
          <label>
            Your deck
            <select
              value={challenge.deckName}
              onChange={(e) => setChallenge({ ...challenge, deckName: e.target.value })}
            >
              {decks.map((d) => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
          </label>
          <label>
            Mode
            <select
              value={challenge.mode}
              onChange={(e) => setChallenge({ ...challenge, mode: e.target.value })}
            >
              <option value="live">Live (both playing now)</option>
              <option value="correspondence">Correspondence</option>
            </select>
          </label>
          <label>
            First to how many KOs
            <select
              value={challenge.koLimit}
              onChange={(e) => setChallenge({ ...challenge, koLimit: Number(e.target.value) })}
            >
              {Array.from({ length: 8 }, (_, i) => i + 3).map((n) => (
                <option key={n} value={n}>{n}{n === 5 ? " (default)" : ""}</option>
              ))}
            </select>
          </label>
          {challenge.mode === "correspondence" ? (
            <label>
              Hours per move
              <input
                type="number"
                min="1"
                value={challenge.hoursPerMove}
                onChange={(e) => setChallenge({ ...challenge, hoursPerMove: Number(e.target.value) })}
              />
            </label>
          ) : null}
          <button
            className="btn"
            type="submit"
            disabled={
              busy ||
              !challenge.username ||
              !challenge.deckName ||
              (challenge.mode === "live" && !!live) ||
              (challenge.mode === "correspondence" && corrFull)
            }
          >
            Send challenge
          </button>
          {challenge.mode === "correspondence" && corrFull ? (
            <p className="muted">You already have three correspondence matches.</p>
          ) : null}
        </form>
      </div>

      <div className="panel">
        <strong>Open challenges</strong>
        {challenges.map((c) => (
          <div key={c.id} className="stack" style={{ marginTop: 12 }}>
            <div>
              {c.from.username} → {c.to.username} · {c.mode}
              {c.mode === "correspondence" ? ` · ${c.hoursPerMove}h/move` : ""}
              {` · first to ${c.koLimit || 5} KOs`}
            </div>
            {c.incoming ? (
              <div className="row">
                <select value={acceptDeck} onChange={(e) => setAcceptDeck(e.target.value)}>
                  {decks.map((d) => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
                <button className="btn" type="button" onClick={() => answerChallenge(c.id, true)}>Accept</button>
                <button className="btn secondary" type="button" onClick={() => answerChallenge(c.id, false)}>Decline</button>
              </div>
            ) : (
              <span className="muted">Waiting</span>
            )}
          </div>
        ))}
        {!challenges.length ? <p className="muted">None pending.</p> : null}
      </div>
    </div>
  );
}
