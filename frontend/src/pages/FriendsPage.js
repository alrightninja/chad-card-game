import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAudio } from "../audio/AudioProvider";
import { useSocialInbox } from "../context/SocialInbox";
import VerifiedBadge from "../components/VerifiedBadge";

export default function FriendsPage() {
  const audio = useAudio();
  const { ping } = useSocialInbox();
  const [friends, setFriends] = useState({ friends: [], incoming: [], outgoing: [] });
  const [challenges, setChallenges] = useState([]);
  const [decks, setDecks] = useState([]);
  const [username, setUsername] = useState("");
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [challenge, setChallenge] = useState({
    username: "",
    deckName: "",
    mode: "correspondence",
    hoursPerMove: 24
  });
  const [acceptDeck, setAcceptDeck] = useState("");
  const [active, setActive] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    const [f, c, d, m] = await Promise.all([
      api("/api/friends"),
      api("/api/challenges"),
      api("/api/decks"),
      api("/api/matches/active")
    ]);
    setFriends(f);
    setChallenges(c.challenges || []);
    setDecks(d.decks || []);
    setActive(m.match || null);
    if (d.decks?.[0] && !challenge.deckName) {
      setChallenge((ch) => ({ ...ch, deckName: d.decks[0].name }));
      setAcceptDeck(d.decks[0].name);
    }
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

  async function sendChallenge(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/challenges", {
        method: "POST",
        body: JSON.stringify(challenge)
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function answerChallenge(id, accept) {
    setError("");
    try {
      const data = await api(`/api/challenges/${id}/respond`, {
        method: "POST",
        body: JSON.stringify({ accept, deckName: acceptDeck })
      });
      await load();
      if (data.match?.id) window.location.assign(`/battle/${data.match.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <h1>Friends</h1>
      {error ? <div className="error">{error}</div> : null}
      {active ? (
        <div className="panel">
          Active {active.mode} match —{" "}
          <Link to={`/battle/${active.id}`}>Join now</Link>
        </div>
      ) : null}

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
              {u.username}
              <VerifiedBadge verified={u.verified} />
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
          <div key={u.id} style={{ marginTop: 8 }}>{u.username}</div>
        ))}
        {!friends.outgoing?.length ? <p className="muted">None</p> : null}
      </div>

      <div className="panel">
        <strong>Friends</strong>
        {(friends.friends || []).map((u) => (
          <div className="row" key={u.id} style={{ marginTop: 8 }}>
            <span>
              {u.username}
              <VerifiedBadge verified={u.verified} />
            </span>
            <button className="btn secondary" type="button" onClick={() => openChat(u)}>Message</button>
            <button
              className="btn"
              type="button"
              onClick={() => setChallenge((ch) => ({ ...ch, username: u.username }))}
            >
              Challenge
            </button>
          </div>
        ))}
        {!friends.friends?.length ? <p className="muted">Add someone by username to challenge them.</p> : null}
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

      <div className="panel stack">
        <strong>Challenge a friend</strong>
        <form className="stack" onSubmit={sendChallenge}>
          <label>
            Friend username
            <input
              value={challenge.username}
              onChange={(e) => setChallenge({ ...challenge, username: e.target.value })}
            />
          </label>
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
          <button className="btn" type="submit">Send challenge</button>
        </form>
      </div>

      <div className="panel">
        <strong>Open challenges</strong>
        {challenges.map((c) => (
          <div key={c.id} className="stack" style={{ marginTop: 12 }}>
            <div>
              {c.from.username} → {c.to.username} · {c.mode}
              {c.mode === "correspondence" ? ` · ${c.hoursPerMove}h/move` : ""}
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
      </div>
    </div>
  );
}
