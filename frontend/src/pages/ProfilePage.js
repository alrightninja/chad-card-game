import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useAudio } from "../audio/AudioProvider";
import CardView, { cardArtSrc } from "../components/CardView";
import SearchSelect from "../components/SearchSelect";
import VerifiedBadge from "../components/VerifiedBadge";
import { rarityLabel } from "../lib/rarity";

function addCopy(list, id, max, owned) {
  if (list.length >= max) return list;
  if (list.filter((x) => x === id).length >= owned) return list;
  return [...list, id];
}

function removeAt(list, index) {
  return list.filter((_, i) => i !== index);
}

function TradeSide({ title, cards, picked, onAdd, onRemove }) {
  const options = (cards || []).map((card) => ({
    value: card.cardId,
    label: card.name,
    search: `${card.name} ${card.trait || ""} ${rarityLabel(card.rarity) || ""}`,
    sublabel: `${rarityLabel(card.rarity) || card.rarity}${card.quantity > 1 ? ` · ×${card.quantity}` : ""}`,
    art: cardArtSrc(card),
    quantity: card.quantity || 1
  }));
  const byId = useMemo(() => new Map((cards || []).map((c) => [c.cardId, c])), [cards]);

  return (
    <div>
      <strong>{title}</strong>
      <p className="muted">{picked.length}/5 selected</p>
      <SearchSelect
        placeholder="Search cards to add"
        options={options}
        value=""
        onChange={(id) => {
          const card = byId.get(id);
          onAdd(id, card?.quantity || 1);
        }}
        emptyText="No cards match"
      />
      <div className="chip-row">
        {picked.map((id, i) => {
          const card = byId.get(id);
          return (
            <button
              type="button"
              key={`${id}-${i}`}
              className="chip"
              onClick={() => onRemove(i)}
            >
              {card?.name || id} ×
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { username } = useParams();
  const { refresh, setUser } = useAuth();
  const audio = useAudio();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [give, setGive] = useState([]);
  const [want, setWant] = useState([]);
  const [pendingTrade, setPendingTrade] = useState(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [myCards, setMyCards] = useState([]);
  const [pass, setPass] = useState({
    currentPassword: "",
    newPassword: "",
    newPasswordConfirm: ""
  });
  const [passMsg, setPassMsg] = useState("");

  async function load() {
    const [data, tradeData] = await Promise.all([
      api(`/api/users/${encodeURIComponent(username)}`),
      api("/api/trades")
    ]);
    setProfile(data.user);
    const incoming = (tradeData.trades || []).find(
      (t) => t.status === "pending" && t.incoming && t.fromUsername === data.user.username
    );
    setPendingTrade(incoming || null);
  }

  useEffect(() => {
    audio?.setTrack("menu");
    setGive([]);
    setWant([]);
    setAvatarOpen(false);
    load().catch((err) => setError(err.message));
  }, [audio, username]);

  const mine = profile?.mine;
  const canTrade = profile?.friend && !mine;

  useEffect(() => {
    if (!canTrade) return undefined;
    api("/api/collection")
      .then((data) => setMyCards(data.collection || []))
      .catch(() => setMyCards([]));
    return undefined;
  }, [canTrade, username]);

  async function setAvatar(cardId) {
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ avatarCardId: cardId })
      });
      setUser(data.user);
      setAvatarOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTrade(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (pendingTrade) {
        await api(`/api/trades/${pendingTrade.id}/counter`, {
          method: "POST",
          body: JSON.stringify({ give, want })
        });
      } else {
        await api("/api/trades", {
          method: "POST",
          body: JSON.stringify({ username: profile.username, give, want })
        });
      }
      setGive([]);
      setWant([]);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setPassMsg("");
    setError("");
    try {
      await api("/api/me/password", {
        method: "POST",
        body: JSON.stringify(pass)
      });
      setPass({ currentPassword: "", newPassword: "", newPasswordConfirm: "" });
      setPassMsg("Password updated.");
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!profile && !error) return <p>Loading profile…</p>;
  if (!profile) return <div className="error">{error}</div>;

  const xpPct = profile.xpForNext
    ? Math.min(100, Math.round((profile.xpIntoLevel / profile.xpForNext) * 100))
    : 100;
  const src = profile.avatarArt ? `/cards/${profile.avatarArt}` : "";

  return (
    <div className="stack">
      <h1>Profile</h1>
      {error ? <div className="error">{error}</div> : null}
      <div className="panel profile-hero">
        {mine ? (
          <button
            type="button"
            className="avatar-btn"
            onClick={() => setAvatarOpen(true)}
            title="Change profile picture"
          >
            {src ? <img className="avatar-lg" src={src} alt="" /> : <div className="avatar-lg avatar-empty" />}
          </button>
        ) : src ? (
          <img className="avatar-lg" src={src} alt="" />
        ) : (
          <div className="avatar-lg avatar-empty" />
        )}
        <div>
          <h2 style={{ margin: 0 }}>
            {profile.username}
            <VerifiedBadge verified={profile.verified} />
          </h2>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Level {profile.level} · {profile.uniqueCards} unique cards
          </p>
          <div className="xp-bar" aria-label="Experience">
            <div className="xp-fill" style={{ width: `${xpPct}%` }} />
          </div>
          <p className="muted">
            {profile.level >= 100
              ? "Max level"
              : `${profile.xpIntoLevel} / ${profile.xpForNext} XP to next level`}
          </p>
          {mine ? <p className="muted">Click your picture to change it.</p> : null}
          {profile.friend && !mine ? (
            <p>
              <Link to={`/play?friend=${encodeURIComponent(profile.username)}`}>Challenge on Play</Link>
            </p>
          ) : null}
        </div>
      </div>

      {avatarOpen && mine ? (
        <div className="scrim" onClick={() => setAvatarOpen(false)} role="presentation">
          <div
            className="panel avatar-modal"
            role="dialog"
            aria-label="Choose profile picture"
            onClick={(e) => e.stopPropagation()}
          >
            <strong>Profile picture</strong>
            <p className="muted">Pick art from a card you own.</p>
            <div className="profile-avatars">
              {(profile.ownedAvatars || []).map((card) => (
                <button
                  type="button"
                  key={card.cardId}
                  className={profile.avatarCardId === card.cardId ? "selected" : ""}
                  disabled={busy}
                  onClick={() => setAvatar(card.cardId)}
                  title={card.name}
                >
                  <img src={`/cards/${card.art}`} alt={card.name} />
                </button>
              ))}
            </div>
            <button className="btn secondary" type="button" onClick={() => setAvatarOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {mine ? (
        <form className="panel stack" onSubmit={resetPassword}>
          <strong>Reset password</strong>
          <label>
            Current password
            <input
              type="password"
              value={pass.currentPassword}
              onChange={(e) => setPass((p) => ({ ...p, currentPassword: e.target.value }))}
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={pass.newPassword}
              onChange={(e) => setPass((p) => ({ ...p, newPassword: e.target.value }))}
              required
              minLength={6}
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={pass.newPasswordConfirm}
              onChange={(e) => setPass((p) => ({ ...p, newPasswordConfirm: e.target.value }))}
              required
            />
          </label>
          {passMsg ? <p className="muted">{passMsg}</p> : null}
          <button className="btn" type="submit">Update password</button>
        </form>
      ) : null}

      {canTrade ? (
        <form className="panel stack" onSubmit={sendTrade}>
          <strong>{pendingTrade ? "Counter-offer" : "Propose a trade"}</strong>
          <p className="muted">Offer 1 to 5 of your cards for 1 to 5 of theirs.</p>
          <TradeSide
            title="You give"
            cards={myCards}
            picked={give}
            onAdd={(id, owned) => setGive((list) => addCopy(list, id, 5, owned))}
            onRemove={(i) => setGive((list) => removeAt(list, i))}
          />
          <TradeSide
            title="You want"
            cards={profile.collection}
            picked={want}
            onAdd={(id, owned) => setWant((list) => addCopy(list, id, 5, owned))}
            onRemove={(i) => setWant((list) => removeAt(list, i))}
          />
          <button className="btn" type="submit" disabled={busy || !give.length || !want.length}>
            {pendingTrade ? "Send counter" : "Send offer"}
          </button>
        </form>
      ) : null}

      {profile.collection && !canTrade ? (
        <div>
          <h2>{mine ? "Your cards" : "Collection"}</h2>
          <div className="collection-grid card-grid">
            {profile.collection.slice(0, 24).map((card) => (
              <div key={card.cardId}>
                <CardView card={card} />
                <div className="muted card-slot-meta">
                  {rarityLabel(card.rarity)} · ×{card.quantity}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
