import { useEffect, useMemo, useState } from "react";
import { LayoutGroup } from "framer-motion";
import { api } from "../api/client";
import { useAudio } from "../audio/AudioProvider";
import CardView from "../components/CardView";
import SetFilterBar, { useSetFilter } from "../components/SetFilterBar";

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
  const [name, setName] = useState("Starter Deck");
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
    setName(deck.name);
    setList((deck.cards || []).map((c) => c.cardId).filter(Boolean));
  }

  async function save() {
    setError("");
    setMessage("");
    try {
      if (list.length !== 40) {
        setError("A legal deck needs exactly 40 cards.");
        return;
      }
      const existing = decks.find((d) => d.name === name);
      if (existing) {
        await api("/api/decks/update", {
          method: "POST",
          body: JSON.stringify({ oldName: name, cards: list })
        });
      } else {
        await api("/api/decks/create", {
          method: "POST",
          body: JSON.stringify({ name, cards: list })
        });
      }
      setMessage("Deck saved.");
      const d = await api("/api/decks");
      setDecks(d.decks || []);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <LayoutGroup>
      <div className="stack">
        <h1>Decks</h1>
        <div className="row">
          {decks.map((d) => (
            <button key={d.name} className="btn secondary" type="button" onClick={() => loadDeck(d)}>
              {d.name}
            </button>
          ))}
        </div>
        <div className="row">
          <label style={{ flex: 1 }}>
            Deck name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn" type="button" onClick={save}>
            Save ({list.length}/40)
          </button>
        </div>
        {error ? <div className="error">{error}</div> : null}
        {message ? <div className="muted">{message}</div> : null}

        <h2>In this deck</h2>
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
