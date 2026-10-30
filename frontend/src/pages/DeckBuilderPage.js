import { useEffect, useMemo, useState } from "react";
import { LayoutGroup } from "framer-motion";
import { api } from "../api/client";
import { useAudio } from "../audio/AudioProvider";
import CardView from "../components/CardView";
import SetFilterBar, { useSetFilter } from "../components/SetFilterBar";

const MAX_DECKS = 5;

function nextDeckName(decks) {
  const used = new Set((decks || []).map((d) => d.name));
  if (!used.has("New Deck")) return "New Deck";
  for (let i = 2; i <= MAX_DECKS + 4; i += 1) {
    const name = `Deck ${i}`;
    if (!used.has(name)) return name;
  }
  return "New Deck";
}

function PoolGrid({ cards, copiesInDeck, add }) {
  if (!cards.length) {
    return <p className="muted">No cards in this pack yet.</p>;
  }
  return (
    <div className="card-grid">
      {cards.map((card) => (
        <div key={card.cardId}>
          <CardView
            layoutKey={`pool-${card.cardId}`}
            card={card}
            onClick={() => add(card)}
          />
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            {copiesInDeck(card.cardId)} / {card.quantity} in deck
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DeckBuilderPage() {
  const audio = useAudio();
  const [collection, setCollection] = useState([]);
  const [decks, setDecks] = useState([]);
  const [savedName, setSavedName] = useState(null);
  const [name, setName] = useState("New Deck");
  const [list, setList] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    audio?.setTrack("menu");
    Promise.all([api("/api/collection"), api("/api/decks")])
      .then(([c, d]) => {
        setCollection(c.collection || []);
        const deckList = d.decks || [];
        setDecks(deckList);
        const current = deckList[0];
        if (current) {
          setSavedName(current.name);
          setName(current.name);
          setList((current.cards || []).map((card) => card.cardId).filter(Boolean));
        }
      })
      .catch((err) => setError(err.message));
  }, [audio]);

  const owned = useMemo(() => {
    const map = {};
    collection.forEach((c) => {
      map[c.cardId] = c;
    });
    return map;
  }, [collection]);

  const { layout, setLayout, setId, setSetId, filtered, groups } = useSetFilter(collection);

  function copiesInDeck(cardId) {
    return list.filter((id) => id === cardId).length;
  }

  function add(card) {
    if (list.length >= 40) {
      setError("Deck is full (40).");
      return;
    }
    if (copiesInDeck(card.cardId) >= 3) {
      setError("Max 3 copies of a card.");
      return;
    }
    if (copiesInDeck(card.cardId) >= (card.quantity || 0)) {
      setError("You don’t own another copy.");
      return;
    }
    setError("");
    audio?.playSfx("select");
    setList((ids) => [...ids, card.cardId]);
  }

  function removeAt(index) {
    audio?.playSfx("select");
    setList((ids) => ids.filter((_, i) => i !== index));
  }

  function loadDeck(deck) {
    setError("");
    setMessage("");
    setSavedName(deck.name);
    setName(deck.name);
    setList((deck.cards || []).map((c) => c.cardId).filter(Boolean));
  }

  function startNewDeck() {
    if (decks.length >= MAX_DECKS) {
      setError(`You can keep ${MAX_DECKS} decks. Delete one first.`);
      return;
    }
    audio?.playSfx("select");
    setError("");
    setMessage("");
    setSavedName(null);
    setName(nextDeckName(decks));
    setList([]);
  }

  async function save() {
    setError("");
    setMessage("");
    const trimmed = name.trim();
    try {
      if (!trimmed) {
        setError("Give this deck a name.");
        return;
      }
      if (list.length !== 40) {
        setError("A legal deck needs exactly 40 cards.");
        return;
      }
      if (savedName) {
        await api("/api/decks/update", {
          method: "POST",
          body: JSON.stringify({ oldName: savedName, newName: trimmed, cards: list })
        });
      } else {
        if (decks.length >= MAX_DECKS) {
          setError(`You can keep ${MAX_DECKS} decks. Delete one first.`);
          return;
        }
        await api("/api/decks/create", {
          method: "POST",
          body: JSON.stringify({ name: trimmed, cards: list })
        });
      }
      setMessage("Deck saved.");
      setSavedName(trimmed);
      setName(trimmed);
      const d = await api("/api/decks");
      setDecks(d.decks || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeDeck() {
    setError("");
    setMessage("");
    if (!savedName) {
      if (decks[0]) loadDeck(decks[0]);
      else {
        setName(nextDeckName([]));
        setList([]);
      }
      return;
    }
    if (!window.confirm(`Delete “${savedName}”? This cannot be undone.`)) return;
    try {
      await api("/api/decks/delete", {
        method: "POST",
        body: JSON.stringify({ name: savedName })
      });
      const d = await api("/api/decks");
      const next = d.decks || [];
      setDecks(next);
      if (next[0]) loadDeck(next[0]);
      else {
        setSavedName(null);
        setName("New Deck");
        setList([]);
      }
      setMessage("Deck deleted.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <LayoutGroup>
      <div className="stack">
        <h1>Decks</h1>
        <p className="muted">
          {decks.length}/{MAX_DECKS} saved
          {savedName ? "" : " · unsaved draft"}
        </p>
        <div className="row">
          {decks.map((d) => (
            <button
              key={d.name}
              className={`btn ${savedName === d.name ? "" : "secondary"}`}
              type="button"
              onClick={() => loadDeck(d)}
            >
              {d.name}
            </button>
          ))}
          <button
            className="btn secondary"
            type="button"
            onClick={startNewDeck}
            disabled={decks.length >= MAX_DECKS}
          >
            New deck
          </button>
        </div>
        <div className="row">
          <label style={{ flex: 1 }}>
            Deck name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn" type="button" onClick={save}>
            Save ({list.length}/40)
          </button>
          <button className="btn secondary" type="button" onClick={removeDeck}>
            {savedName ? "Delete" : "Discard"}
          </button>
        </div>
        {error ? <div className="error">{error}</div> : null}
        {message ? <div className="muted">{message}</div> : null}

        <h2>In this deck</h2>
        {list.length ? (
          <div className="card-grid">
            {list.map((id, index) => (
              <CardView
                key={`${id}-${index}`}
                layoutKey={`deck-${id}-${index}`}
                card={owned[id] || { cardId: id, name: id, power: 0, trait: "" }}
                onClick={() => removeAt(index)}
              />
            ))}
          </div>
        ) : (
          <p className="muted">Empty — click cards below to add (40 to save).</p>
        )}

        <h2>Collection — click to add</h2>
        <SetFilterBar
          cards={collection}
          layout={layout}
          setLayout={setLayout}
          setId={setId}
          setSetId={setSetId}
        />
        {layout === "grouped" ? (
          groups.map((group) => (
            <section key={group.id} className="set-section">
              <h2 className="set-heading">
                {group.name}
                <span className="muted"> · {group.cards.length}</span>
              </h2>
              <PoolGrid cards={group.cards} copiesInDeck={copiesInDeck} add={add} />
            </section>
          ))
        ) : (
          <PoolGrid cards={filtered} copiesInDeck={copiesInDeck} add={add} />
        )}
      </div>
    </LayoutGroup>
  );
}
