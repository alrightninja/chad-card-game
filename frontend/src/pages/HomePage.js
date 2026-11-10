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
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadActive() {
    const data = await api("/api/matches/active");
    setMatches([
      ...(data.live ? [data.live] : []),
      ...(data.correspondences || (data.correspondence ? [data.correspondence] : []))
    ]);
  }

  useEffect(() => {
    audio?.setTrack("menu");
    loadActive().catch(() => setMatches([]));
  }, [audio]);

  async function forfeit(id) {
    if (!window.confirm("Forfeit this match? You will take the loss.")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/matches/${id}/forfeit`, { method: "POST", body: JSON.stringify({}) });
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
            3 Active, 3 Bench. First to 5 KOs. HP is twice Power. One Assist (Commons/Uncommons only). One Bench swap per turn. The Lead’s type is +6 / −6. Guard forces the fight.
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

      {matches.map((match) => (
        <section className="panel home-card" key={match.id}>
          <div>
            <strong>
              {match.mode === "correspondence" ? "Correspondence" : "Live"} vs {match.opponentName || match.versus || "opponent"}
            </strong>
            <p className="muted" style={{ margin: "0.25rem 0 0" }}>
              {match.yourTurn ? "Your turn" : "Waiting"}
              {match.status !== "active" ? " — finished" : ""}
            </p>
          </div>
          <div className="row">
            <button className="btn" type="button" onClick={() => navigate(`/battle/${match.id}`)}>
              Resume
            </button>
            <button className="btn secondary" type="button" disabled={busy} onClick={() => forfeit(match.id)}>
              Forfeit
            </button>
          </div>
        </section>
      ))}

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
          <p className="muted">20-card decks. Packs are 5 cards for 100 reps.</p>
          <div className="row">
            <Link className="btn secondary" to="/decks">Decks</Link>
            <Link className="btn secondary" to="/shop">Open a pack</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
