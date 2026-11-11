import { useEffect, useMemo, useState } from "react";
import { LayoutGroup } from "framer-motion";
import { api } from "../api/client";
import { useAudio } from "../audio/AudioProvider";
import CardView from "../components/CardView";
import SetFilterBar, { useSetFilter } from "../components/SetFilterBar";
import { rarityBucket, rarityLabel } from "../lib/rarity";

const MAX_DECKS = 5;
const DECK_SIZE = 20;
const DEFAULT_LIMITS = { size: 20, copies: 2, uncommons: 8, rares: 6, legendaries: 2, mythics: 1 };

function nextDeckName(decks) {
  const used = new Set((decks || []).map((d) => d.name));
  if (!used.has("New Deck")) return "New Deck";
  for (let i = 2; i <= MAX_DECKS + 4; i += 1) {
    const name = `Deck ${i}`;
    if (!used.has(name)) return name;
  }
  return "New Deck";
}

function PoolGrid({ cards, copiesInDeck, capReason, add }) {
  if (!cards.length) {
    return <p className="muted">No cards in this pack yet.</p>;
  }
  return (
    <div className="card-grid">
      {cards.map((card) => {
        const capped = capReason(card);
        return (
          <div key={card.cardId} className={`card-slot ${capped ? "is-capped" : ""}`}>
            <CardView
              layoutKey={`pool-${card.cardId}`}
              card={card}
              onClick={() => add(card)}
            />
            <div className={`muted card-slot-meta`}>
              {rarityLabel(card.rarity) || "Unknown"}
              {" · "}
              {capped || `${copiesInDeck(card.cardId)} / ${card.quantity} in deck`}
            </div>
          </div>
        );
      })}
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
  const [limits, setLimits] = useState(DEFAULT_LIMITS);

  useEffect(() => {
    audio?.setTrack("menu");
    Promise.all([api("/api/collection"), api("/api/decks")])
      .then(([c, d]) => {
        setCollection(c.collection || []);
        const deckList = d.decks || [];
        if (d.limits) setLimits({ ...DEFAULT_LIMITS, ...d.limits });
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

  function rarityCount(bucket) {
    return list.filter((id) => rarityBucket(owned[id]?.rarity) === bucket).length;
  }

  function capReason(card) {
    if (copiesInDeck(card.cardId) >= limits.copies) {
      return `Max ${limits.copies} copies`;
    }
    if (copiesInDeck(card.cardId) >= (card.quantity || 0)) {
      return "No extra copies owned";
    }
    const bucket = rarityBucket(card.rarity);
    if (bucket === "M" && rarityCount("M") >= (limits.mythics || 1)) {
      return "Mythic cap reached";
    }
    if (bucket === "M" && rarityCount("L") > 0) {
      return "Mythic or Legendaries, not both";
    }
    if (bucket === "L" && rarityCount("M") > 0) {
      return "Mythic or Legendaries, not both";
    }
    if (bucket === "L" && rarityCount("L") >= limits.legendaries) {
      return "Legendary cap reached";
    }
    if (bucket === "R" && rarityCount("R") >= limits.rares) {
      return "Rare cap reached";
    }
    if (bucket === "U" && rarityCount("U") >= (limits.uncommons || 8)) {
      return "Uncommon cap reached";
    }
    if (list.length >= limits.size) return "Deck is full";
    return "";
  }

  function add(card) {
    const blocked = capReason(card);
    if (blocked) {
      setError(blocked);
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
      if (list.length !== DECK_SIZE) {
        setError(`A legal deck needs exactly ${DECK_SIZE} cards.`);
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
          {" · "}max {limits.copies} copies
          {" · "}Uncommons {rarityCount("U")}/{limits.uncommons || 8}
          {" · "}Rares {rarityCount("R")}/{limits.rares}
          {" · "}Legendaries {rarityCount("L")}/{limits.legendaries}
          {" · "}Mythics {rarityCount("M")}/{limits.mythics || 1}
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
            Save ({list.length}/{DECK_SIZE})
          </button>
          <button className="btn secondary" type="button" onClick={removeDeck}>
            {savedName ? "Delete" : "Discard"}
          </button>
        </div>
        {list.length !== DECK_SIZE ? (
          <p className="muted">
            Legal decks are {DECK_SIZE} cards, max {limits.copies} copies, {limits.uncommons || 8}{" "}
            uncommons, {limits.rares} rares, and either {limits.mythics || 1} Mythic or{" "}
            {limits.legendaries} Legendaries. Older lists stay until you save a legal deck — nothing
            is removed from your collection.
          </p>
        ) : null}
        {error ? <div className="error">{error}</div> : null}
        {message ? <div className="muted">{message}</div> : null}

        <h2>In this deck</h2>
        {list.length ? (
          <div className="card-grid">
            {list.map((id, index) => {
              const card = owned[id] || { cardId: id, name: id, power: 0, trait: "" };
              return (
                <div key={`${id}-${index}`}>
                  <CardView
                    layoutKey={`deck-${id}-${index}`}
                    card={card}
                    onClick={() => removeAt(index)}
                  />
                  <div className="muted card-slot-meta">
                    {rarityLabel(card.rarity) || "Unknown"}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">Empty — click cards below to add ({DECK_SIZE} to save).</p>
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
              <PoolGrid cards={group.cards} copiesInDeck={copiesInDeck} capReason={capReason} add={add} />
            </section>
          ))
        ) : (
          <PoolGrid cards={filtered} copiesInDeck={copiesInDeck} capReason={capReason} add={add} />
        )}
      </div>
    </LayoutGroup>
  );
}
