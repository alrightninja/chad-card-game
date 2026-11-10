import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAudio } from "../audio/AudioProvider";
import { useSocialInbox } from "../context/SocialInbox";
import UserLink from "../components/UserLink";

export default function FriendsPage() {
  const audio = useAudio();
  const { ping } = useSocialInbox();
  const [friends, setFriends] = useState({ friends: [], incoming: [], outgoing: [] });
  const [username, setUsername] = useState("");
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [matches, setMatches] = useState([]);
  const [trades, setTrades] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    const [f, m, t] = await Promise.all([
      api("/api/friends"),
      api("/api/matches/active"),
      api("/api/trades")
    ]);
    setFriends(f);
    const list = [
      ...(m.live ? [m.live] : []),
      ...(m.correspondences || (m.correspondence ? [m.correspondence] : []))
    ];
    setMatches(list);
    setTrades(t.trades || []);
  }

  useEffect(() => {
    audio?.setTrack("menu");
    load().catch((err) => setError(err.message));
  }, [audio, ping]);

  useEffect(() => {
    if (!selectedFriend) return undefined;
    api(`/api/messages/${selectedFriend.id}`)
      .then((data) => setMessages(data.messages || []))
      .catch(() => {});
    return undefined;
  }, [ping, selectedFriend]);

  useEffect(() => {
    const timer = setInterval(() => {
      load().catch(() => {});
      if (!selectedFriend) return;
      api(`/api/messages/${selectedFriend.id}`)
        .then((data) => setMessages(data.messages || []))
        .catch(() => {});
    }, 8000);
    return () => clearInterval(timer);
  }, [selectedFriend]);

  async function addFriend(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/friends/request", {
        method: "POST",
        body: JSON.stringify({ username })
      });
      setUsername("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function respond(userId, accept) {
    await api("/api/friends/respond", {
      method: "POST",
      body: JSON.stringify({ userId, accept })
    });
    await load();
  }

  async function openChat(friend) {
    setSelectedFriend(friend);
    const data = await api(`/api/messages/${friend.id}`);
    setMessages(data.messages || []);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!selectedFriend) return;
    try {
      const data = await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({ userId: selectedFriend.id, body: draft })
      });
      setMessages((m) => [...m, data.message]);
      setDraft("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function actTrade(id, action) {
    setError("");
    try {
      await api(`/api/trades/${id}/${action}`, { method: "POST", body: JSON.stringify({}) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <h1>Friends</h1>
      {error ? <div className="error">{error}</div> : null}
      {matches.map((match) => (
        <div className="panel" key={match.id}>
          {match.mode === "correspondence" ? "Correspondence" : "Live"} vs {match.opponentName || match.versus}
          {match.yourTurn ? " — Your turn" : ""}
          {" — "}
          <Link to={`/battle/${match.id}`}>Join now</Link>
        </div>
      ))}

      <form className="row" onSubmit={addFriend}>
        <input
          placeholder="Add by username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button className="btn" type="submit">Send request</button>
      </form>

      <div className="panel">
        <strong>Incoming requests</strong>
        {(friends.incoming || []).map((u) => (
          <div className="row" key={u.id} style={{ marginTop: 8 }}>
            <span>
              <UserLink user={u} />
            </span>
            <button className="btn" type="button" onClick={() => respond(u.id, true)}>Accept</button>
            <button className="btn secondary" type="button" onClick={() => respond(u.id, false)}>Decline</button>
          </div>
        ))}
        {!friends.incoming?.length ? <p className="muted">None</p> : null}
      </div>

      <div className="panel">
        <strong>Sent requests</strong>
        {(friends.outgoing || []).map((u) => (
          <div key={u.id} style={{ marginTop: 8 }}><UserLink user={u} /></div>
        ))}
        {!friends.outgoing?.length ? <p className="muted">None</p> : null}
      </div>

      <div className="panel">
        <strong>Friends</strong>
        {(friends.friends || []).map((u) => (
          <div className="row" key={u.id} style={{ marginTop: 8 }}>
            <span>
              <UserLink user={u} />
            </span>
            <button className="btn secondary" type="button" onClick={() => openChat(u)}>Message</button>
            <Link className="btn" to={`/play?friend=${encodeURIComponent(u.username)}`}>Play</Link>
          </div>
        ))}
        {!friends.friends?.length ? <p className="muted">Add someone by username, then challenge them from Play.</p> : null}
      </div>

      {selectedFriend ? (
        <div className="panel stack">
          <strong>Chat with {selectedFriend.username}</strong>
          <div className="log">
            {messages.map((m) => (
              <div key={m.id}>{m.body}</div>
            ))}
          </div>
          <form className="row" onSubmit={sendMessage}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Say something kind" />
            <button className="btn" type="submit">Send</button>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <strong>Trades</strong>
        {(trades || []).filter((tr) => tr.status === "pending").map((tr) => (
          <div key={tr.id} className="stack" style={{ marginTop: 12 }}>
            <div>
              {tr.fromUsername} offers {tr.giveCards.map((c) => `${c.name}×${c.quantity}`).join(", ")}
              {" for "}
              {tr.wantCards.map((c) => `${c.name}×${c.quantity}`).join(", ")}
              {" from "}
              {tr.toUsername}
            </div>
            {tr.incoming ? (
              <div className="row">
                <Link className="btn secondary" to={`/u/${encodeURIComponent(tr.fromUsername)}`}>Counter on profile</Link>
                <button className="btn" type="button" onClick={() => actTrade(tr.id, "accept")}>Accept</button>
                <button className="btn secondary" type="button" onClick={() => actTrade(tr.id, "reject")}>Reject</button>
              </div>
            ) : (
              <button className="btn secondary" type="button" onClick={() => actTrade(tr.id, "cancel")}>Cancel</button>
            )}
          </div>
        ))}
        {!(trades || []).some((tr) => tr.status === "pending") ? (
          <p className="muted">No pending trades. Open a friend’s profile to offer cards.</p>
        ) : null}
      </div>
    </div>
  );
}
