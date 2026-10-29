import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useAudio } from "../audio/AudioProvider";
import VerifiedBadge from "../components/VerifiedBadge";

export default function HomePage() {
  const { user, refresh } = useAuth();
  const audio = useAudio();
  const navigate = useNavigate();
  const [active, setActive] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadActive() {
    const data = await api("/api/matches/active");
    setActive(data.match || null);
  }

  useEffect(() => {
    audio?.setTrack("menu");
    loadActive().catch(() => setActive(null));
  }, [audio]);

  async function forfeit() {
    if (!active?.id) return;
    if (!window.confirm("Forfeit this match? You will take the loss.")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/matches/${active.id}/forfeit`, { method: "POST", body: JSON.stringify({}) });
      await refresh();
      await loadActive();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="home">
      <section className="home-hero">
        <img
          className="home-logo"
          src="/brand/gigachad-smackdown-logo.png"
          alt="Gigachad Smackdown"
        />
        <div className="home-intro">
          <p className="home-kicker">Trading card game</p>
          <h1>
            Welcome{user?.username ? `, ${user.username}` : ""}
            <VerifiedBadge verified={user?.verified} />
          </h1>
          <p className="muted">
            3 Active, 3 Bench. Lead attacks at full Power; assists add half and get Tired. Guard forces the fight.
          </p>
          <div className="home-actions">
            <Link className="btn" to="/play">Play</Link>
            <Link className="btn secondary" to="/collection">Collection</Link>
            <Link className="btn secondary" to="/shop">Shop</Link>
            <Link className="btn secondary" to="/friends">Friends</Link>
          </div>
        </div>
      </section>

      {error ? <div className="error">{error}</div> : null}

      {active ? (
        <section className="panel home-card">
          <div>
            <strong>Match in progress</strong>
            <p className="muted" style={{ margin: "0.25rem 0 0" }}>
              {active.mode === "correspondence" ? "Correspondence" : "Live"} vs {active.versus || "opponent"}
              {active.status !== "active" ? " — finished" : ""}
            </p>
          </div>
          <div className="row">
            <button className="btn" type="button" onClick={() => navigate(`/battle/${active.id}`)}>
              Resume
            </button>
            <button className="btn secondary" type="button" disabled={busy} onClick={forfeit}>
              Forfeit
            </button>
          </div>
        </section>
      ) : null}

      <section className="home-grid">
        <div className="panel home-card stack">
          <strong>{user?.tutorialCompleted ? "How to play" : "New here?"}</strong>
          <p className="muted">
            {user?.tutorialCompleted
              ? "Open the lesson anytime. Practice still uses a coached AI fight."
              : "A short lesson, then a coached practice fight with a starter deck."}
          </p>
          <Link className="btn" to="/tutorial">
            {user?.tutorialCompleted ? "Review the rules" : "Learn how to play"}
          </Link>
        </div>
        <div className="panel home-card stack">
          <strong>Build and collect</strong>
          <p className="muted">40-card decks. Packs are 5 cards for 100 reps.</p>
          <div className="row">
            <Link className="btn secondary" to="/decks">Decks</Link>
            <Link className="btn secondary" to="/shop">Open a pack</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
