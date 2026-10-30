import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGroup } from "framer-motion";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { api, getToken } from "../api/client";
import { WS_URL } from "../api/config";
import { useAudio } from "../audio/AudioProvider";
import { useAuth } from "../context/AuthContext";
import CardView from "../components/CardView";
import { matchupPhrase } from "../lib/traits";
import "../battle-mobile.css";

const ACTIVE_SLOTS = 3;
const BENCH_SLOTS = 3;
const HAND_SLOTS = 7;
const DRAG_PX = 8;

function pad(list, size) {
  const next = [...(list || [])];
  while (next.length < size) next.push(null);
  return next;
}

function CardBack() {
  return <div className="card-back" aria-hidden="true" />;
}

function EmptySlot({ hot, onClick, label, size = "bench", dropKind }) {
  return (
    <button
      type="button"
      className={`slot slot-${size} ${hot ? "slot-hot" : ""}`}
      onClick={onClick}
      data-drop={dropKind}
    >
      <span className="slot-empty">{label}</span>
    </button>
  );
}

function DeckPile({ count, label }) {
  return (
    <div className="deck-pile" title={`${count} cards in ${label}`}>
      <div className="card-back deck-face" />
      <div className="deck-count">{label}<br />{count}</div>
    </div>
  );
}

function deadlineLabel(iso) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return "Time expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h left`;
  }
  return h ? `${h}h ${m}m left` : `${m}m left`;
}

function sfxForAction(type) {
  if (type === "play" || type === "promote" || type === "swap") return "play";
  if (type === "guard") return "select";
  if (type === "attack") return "attack";
  if (type === "endTurn") return "endTurn";
  return null;
}

function bannerText(battle) {
  if (!battle) return "";
  const parts = [`LEAD ${battle.leadName} ${battle.leadPower}`];
  (battle.assists || []).forEach((a) => {
    parts.push(`ASSIST ${a.name} +${a.added}`);
  });
  parts.push(`= ${battle.atkTotal} vs ${battle.defTotal}`);
  if (battle.traitBonus > 0) parts.push(`TYPE +${battle.traitBonus}`);
  if (battle.traitBonus < 0) parts.push(`TYPE ${battle.traitBonus}`);
  if (battle.traitArmor) parts.push(`+${battle.traitArmor} type Armor`);
  if (battle.result === "ko") parts.push(`— ${battle.defenderName} is KO'd`);
  else if (battle.result === "wipe") parts.push("— attackers are KO'd");
  else if (battle.result === "tie") parts.push("— tie, both Decay");
  return parts.join("   ");
}

function powerOf(card) {
  if (!card) return 0;
  return Math.max(0, (card.power || 0) + (card.tempPower || 0));
}

function findById(list, id) {
  return (list || []).find((c) => c && c.instanceId === id) || null;
}

function arrivingIds(prev, next) {
  if (!next?.opponent) return [];
  const ids = [];
  for (const zone of ["active", "bench"]) {
    const before = new Set((prev?.opponent?.[zone] || []).map((c) => c?.instanceId).filter(Boolean));
    for (const card of next.opponent[zone] || []) {
      if (card?.instanceId && !before.has(card.instanceId)) ids.push(card.instanceId);
    }
  }
  return ids;
}

function battleFloats(prev, next, attackerIndices, defenderIndex, from) {
  if (!prev || !next) return [];
  const prevAtkSide = from === "you" ? prev.you : prev.opponent;
  const prevDefSide = from === "you" ? prev.opponent : prev.you;
  const nextAtkSide = from === "you" ? next.you : next.opponent;
  const nextDefSide = from === "you" ? next.opponent : next.you;
  const floats = [];

  const defSide = from === "you" ? "foe" : "you";
  const def = prevDefSide?.active?.[defenderIndex];
  if (def) {
    const after = findById(nextDefSide?.active, def.instanceId);
    if (!after) {
      floats.push({ side: defSide, index: defenderIndex, text: "KO", kind: "ko" });
    } else {
      const drop = powerOf(def) - powerOf(after);
      if (drop > 0) floats.push({ side: defSide, index: defenderIndex, text: `-${drop}`, kind: "hit" });
    }
  }

  const atkSide = from === "you" ? "you" : "foe";
  (attackerIndices || []).forEach((i) => {
    const atk = prevAtkSide?.active?.[i];
    if (!atk) return;
    const after = findById(nextAtkSide?.active, atk.instanceId);
    if (!after) {
      floats.push({ side: atkSide, index: i, text: "KO", kind: "ko" });
    } else {
      const drop = powerOf(atk) - powerOf(after);
      if (drop > 0) floats.push({ side: atkSide, index: i, text: `-${drop}`, kind: "hit" });
    }
  });

  return floats;
}

function dropFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  const zone = el?.closest("[data-drop]");
  if (!zone) return null;
  const kind = zone.getAttribute("data-drop");
  const index = zone.getAttribute("data-index");
  return { kind, index: index == null ? null : Number(index) };
}

export default function BattlePage() {
  const { matchId } = useParams();
  const audio = useAudio();
  const { refresh } = useAuth();
  const [match, setMatch] = useState(null);
  const [error, setError] = useState("");
  const [selectedHand, setSelectedHand] = useState(null);
  const [selectedBench, setSelectedBench] = useState(null);
  const [attackers, setAttackers] = useState([]);
  const [coachOpen, setCoachOpen] = useState(false);
  const [slash, setSlash] = useState(false);
  const [lunge, setLunge] = useState({ attackers: [], dir: 0, from: "you" });
  const [floats, setFloats] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  const [inspect, setInspect] = useState(null);
  const [entering, setEntering] = useState([]);
  const [guardMode, setGuardMode] = useState(false);
  const [banner, setBanner] = useState(null);
  const [ghost, setGhost] = useState(null);
  const lastLog = useRef([]);
  const busy = useRef(false);
  const pendingUpdate = useRef(null);
  const appliedVersion = useRef(-1);
  const dragRef = useRef(null);
  const skipClick = useRef(false);
  const pendingClick = useRef(null);
  const matchRef = useRef(null);
  matchRef.current = match;
  const enteringSet = useMemo(() => new Set(entering), [entering]);
  const tableRef = useRef(null);

  const yourTurn = match?.state?.turnPlayer === match?.yourSeat && match?.status === "active";
  const you = match?.state?.you;
  const foe = match?.state?.opponent;
  const attackerSet = useMemo(() => new Set(attackers), [attackers]);
  const dragId = ghost?.instanceId;

  useEffect(() => {
    audio?.setTrack("battle");
  }, [audio]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setInspect(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function applyMatch(next, { animateArrivals = false } = {}) {
    if (!next) return;
    if (
      next.version != null &&
      appliedVersion.current >= 0 &&
      next.version <= appliedVersion.current
    ) {
      return;
    }
    if (next.version != null) appliedVersion.current = next.version;
    const prev = lastLog.current;
    const log = next?.state?.log || [];
    const added = log.slice(prev.length);
    lastLog.current = log;
    if (added.some((line) => /draws a card/i.test(line))) audio?.playSfx("draw");
    if (added.some((line) => /KO'd/i.test(line))) audio?.playSfx("ko");
    if (animateArrivals) {
      const arrived = arrivingIds(matchRef.current?.state, next.state);
      if (arrived.length) {
        setEntering(arrived);
        window.setTimeout(() => {
          setEntering((cur) => cur.filter((id) => !arrived.includes(id)));
        }, 900);
      }
      const fight = next.state?.lastBattle;
      if (fight) {
        setBanner({ text: bannerText(fight), kind: fight.result || "" });
        window.setTimeout(() => setBanner(null), 1800);
      }
    }
    setMatch(next);
  }

  useEffect(() => {
    let socket;
    let cancelled = false;

    api(`/api/matches/${matchId}`)
      .then((data) => {
        if (!cancelled) {
          lastLog.current = data.match?.state?.log || [];
          if (data.match?.version != null) appliedVersion.current = data.match.version;
          setMatch(data.match);
        }
      })
      .catch((err) => setError(err.message));

    socket = io(WS_URL, { auth: { token: getToken() } });
    socket.emit("join_match", matchId);
    socket.on("match_update", (payload) => {
      if (busy.current) {
        pendingUpdate.current = payload;
        return;
      }
      applyMatch(payload, { animateArrivals: true });
    });
    socket.on("match_error", (payload) => setError(payload.error || "Match error"));

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [matchId]);

  const resolveDropRef = useRef(null);
  resolveDropRef.current = (drag, drop) => {
    if (!drop?.kind) return;
    if (drag.from === "hand") {
      if (drop.kind === "active-empty") {
        send({ type: "play", instanceId: drag.instanceId, zone: "active" });
        return;
      }
      if (drop.kind === "bench-empty") {
        send({ type: "play", instanceId: drag.instanceId, zone: "bench" });
      }
      return;
    }
    if (drag.from === "bench") {
      if (drop.kind === "active-empty") {
        send({ type: "promote", benchIndex: drag.benchIndex });
        return;
      }
      if (drop.kind === "active") {
        send({ type: "swap", activeIndex: drop.index, benchIndex: drag.benchIndex });
      }
      return;
    }
    if (drag.from === "active" && drop.kind === "bench") {
      send({ type: "swap", activeIndex: drag.activeIndex, benchIndex: drop.index });
    }
  };

  useEffect(() => {
    function onMove(e) {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (!drag.live && dx * dx + dy * dy >= DRAG_PX * DRAG_PX) {
        drag.live = true;
        setGhost({
          card: drag.card,
          from: drag.from,
          instanceId: drag.instanceId,
          benchIndex: drag.benchIndex,
          activeIndex: drag.activeIndex,
          x: e.clientX,
          y: e.clientY
        });
      } else if (drag.live) {
        setGhost((prev) => prev && ({ ...prev, x: e.clientX, y: e.clientY }));
      }
    }

    function onUp(e) {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;
      if (drag.live) {
        skipClick.current = true;
        resolveDropRef.current(drag, dropFromPoint(e.clientX, e.clientY));
      }
      setGhost(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  function beginDrag(e, payload) {
    if (!yourTurn || e.button) return;
    if ((phase === "end" || phase === "battle") && (payload.from === "hand" || payload.from === "bench")) return;
    dragRef.current = {
      ...payload,
      x0: e.clientX,
      y0: e.clientY,
      live: false
    };
  }

  function clickSafe(fn) {
    return () => {
      if (skipClick.current) {
        skipClick.current = false;
        return;
      }
      fn();
    };
  }

  function inspectCard(card) {
    if (!card) return;
    if (pendingClick.current) {
      clearTimeout(pendingClick.current);
      pendingClick.current = null;
    }
    setInspect(card);
    audio?.playSfx("select");
  }

  function armClick(fn) {
    return clickSafe(() => {
      if (pendingClick.current) {
        clearTimeout(pendingClick.current);
        pendingClick.current = null;
        return;
      }
      pendingClick.current = setTimeout(() => {
        pendingClick.current = null;
        fn();
      }, 220);
    });
  }

  function combatBadges(card, index, side) {
    if (!card) return [];
    const list = [];
    if (card.tired || card.tiredTurns > 0) list.push({ kind: "tired", text: "Tired" });
    if (card.guarding) list.push({ kind: "guard", text: "Guard" });
    const picks = side === "opp" && lunge.from === "opp" ? lunge.attackers : side === "you" ? attackers : [];
    if (picks.length) {
      if (picks[0] === index) list.push({ kind: "lead", text: "Lead" });
      else if (picks.includes(index)) list.push({ kind: "assist", text: "Assist" });
    }
    return list;
  }

  function faceExtras(card, index, side) {
    if (!card) return {};
    return {
      entering: enteringSet.has(card.instanceId),
      badges: combatBadges(card, index, side),
      onDoubleClick: (e) => {
        e.preventDefault();
        inspectCard(card);
      }
    };
  }

  async function send(action) {
    if (busy.current) return;
    setError("");
    const sound = sfxForAction(action.type);
    if (sound && action.type !== "attack") audio?.playSfx(sound);
    try {
      busy.current = true;
      let prevState = matchRef.current?.state;
      const data = await api(`/api/matches/${matchId}/actions`, {
        method: "POST",
        body: JSON.stringify(action)
      });
      const replay = data.match?.replay || [];
      if (replay.length) {
        for (const step of replay) {
          if (step.kind === "attack") {
            const from = step.from || "opp";
            audio?.playSfx("attack");
            setLunge({
              attackers: step.attackerIndices || [],
              dir: from === "opp" ? 28 : -28,
              from
            });
            setSlash(true);
            await new Promise((r) => setTimeout(r, 900));
            if (step.battle) {
              setBanner({ text: bannerText(step.battle), kind: step.battle.result || "" });
              await new Promise((r) => setTimeout(r, 1600));
            }
            setSlash(false);
            setLunge({ attackers: [], dir: 0, from: "you" });
            const pops = battleFloats(
              prevState,
              step.state,
              step.attackerIndices || [],
              step.defenderIndex,
              from
            );
            if (pops.length) {
              setFloats(pops);
              await new Promise((r) => setTimeout(r, 1200));
              setFloats([]);
            }
            setBanner(null);
            setMatch({ ...data.match, state: step.state });
            prevState = step.state;
            continue;
          }
          const arrived = (step.kind === "play" || step.kind === "promote" || step.kind === "swap")
            ? arrivingIds(prevState, step.state)
            : [];
          if (arrived.length) {
            setEntering(arrived);
            if (step.kind === "play" || step.kind === "promote") audio?.playSfx("play");
          } else if (step.kind === "turnStart") {
            audio?.playSfx("draw");
          }
          setMatch({ ...data.match, state: step.state });
          prevState = step.state;
          const wait = arrived.length ? 950 : step.kind === "turnStart" ? 550 : step.kind === "guard" ? 700 : 0;
          if (wait) await new Promise((r) => setTimeout(r, wait));
          if (arrived.length) setEntering([]);
        }
        lastLog.current = data.match.state?.log || lastLog.current;
      }
      applyMatch(data.match);
      setSelectedHand(null);
      setSelectedBench(null);
      setAttackers([]);
    } catch (err) {
      audio?.playSfx("error");
      setError(err.message);
    } finally {
      busy.current = false;
      const pending = pendingUpdate.current;
      pendingUpdate.current = null;
      if (pending) applyMatch(pending, { animateArrivals: true });
    }
  }

  async function forfeit() {
    if (!window.confirm("Forfeit this match? You will take the loss.")) return;
    try {
      busy.current = true;
      const data = await api(`/api/matches/${matchId}/forfeit`, {
        method: "POST",
        body: JSON.stringify({})
      });
      applyMatch(data.match);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      busy.current = false;
      const pending = pendingUpdate.current;
      pendingUpdate.current = null;
      if (pending) applyMatch(pending);
    }
  }

  async function attack(defenderIndex) {
    if (busy.current || !attackers.length) return;
    await send({ type: "attack", attackerIndices: [...attackers], defenderIndex });
  }

  const phase = match?.state?.phase;

  function hint() {
    if (!match) return "";
    if (match.status !== "active") {
      return match.winner === match.yourSeat ? "You won." : match.winner === "draw" ? "Draw." : "Defeat.";
    }
    if (!yourTurn) return "Opponent’s turn.";
    if (phase === "end") return "You already attacked. End turn (hand limit 7).";
    if (phase === "battle" && attackers.length) return "You may attack again, or End turn.";
    if (guardMode) return "Click YOUR Active unit to make it Guard. The opponent must attack that unit.";
    if (ghost) return "Drop on Active or Bench.";
    if (selectedHand) return "Click or drop on an Active slot, or a Bench slot.";
    if (selectedBench != null) return "Click an empty Active slot to move up, or an Active unit to swap.";
    if (attackers.length) {
      return attackers.length === 1
        ? "That unit is the Lead (full Power + its type). Click more Active units to Assist (half Power, no type), then click the enemy."
        : "Lead + Assists ready. Click the enemy Active (must be their Guard if they have one). Watch the type line.";
    }
    return "Main Phase: play, swap, or Guard. Then click your Lead to attack. Type glow shows the wheel. Double-click to inspect abilities.";
  }

  function matchupHint() {
    const lead = you?.active?.[attackers[0]];
    if (!lead) return "Pick an enemy Active unit.";
    const foes = (foe?.active || []).filter(Boolean);
    if (!foes.length) return `${lead.name} is Lead.`;
    return `${lead.name}: ${foes.map((u) => matchupPhrase(lead, u)).join(" · ")}`;
  }

  function onYourActive(i, card) {
    if (!yourTurn) return;
    if (guardMode) {
      if (!card) return;
      if (phase !== "main") {
        setError("Set Guard during Main Phase, before you attack.");
        setGuardMode(false);
        return;
      }
      send({ type: "guard", activeIndex: i });
      setGuardMode(false);
      return;
    }
    if ((phase === "end" || phase === "battle") && (selectedHand || selectedBench != null) && !card) {
      setError("Play and swaps only before you attack.");
      return;
    }
    if (!card) {
      if (selectedHand) {
        send({ type: "play", instanceId: selectedHand, zone: "active" });
        return;
      }
      if (selectedBench != null) send({ type: "promote", benchIndex: selectedBench });
      return;
    }
    if (selectedHand) return;
    if (selectedBench != null) {
      send({ type: "swap", activeIndex: i, benchIndex: selectedBench });
      return;
    }
    if ((card.tired || card.tiredTurns > 0) && !attackers.includes(i)) {
      audio?.playSfx("error");
      setError(`${card.name} is Tired and cannot attack this turn.`);
      return;
    }
    setSelectedHand(null);
    setSelectedBench(null);
    setAttackers((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
    audio?.playSfx("select");
  }

  function onYourBench(i, card) {
    if (!yourTurn) return;
    if (phase === "end" || phase === "battle") {
      if (selectedHand) {
        setError("Play and swaps only before you attack.");
        return;
      }
    }
    if (selectedHand) {
      send({ type: "play", instanceId: selectedHand, zone: "bench" });
      return;
    }
    if (!card) return;
    setAttackers([]);
    setSelectedBench((prev) => (prev === i ? null : i));
    audio?.playSfx("select");
  }

  function onEnemyActive(i, card) {
    if (!yourTurn || !card) return;
    if (!attackers.length) {
      audio?.playSfx("error");
      setError("Click YOUR Active card first as the Lead, then click theirs.");
      return;
    }
    if (foe?.guardInstanceId && card.instanceId !== foe.guardInstanceId) {
      audio?.playSfx("error");
      setError("You must attack the Guard (blue badge).");
      return;
    }
    attack(i);
  }

  function dropHot(kind) {
    if (!ghost) return false;
    if (ghost.from === "hand") return kind === "active-empty" || kind === "bench-empty";
    if (ghost.from === "bench") return kind === "active-empty" || kind === "active";
    if (ghost.from === "active") return kind === "bench";
    return false;
  }

  if (!match) return <p>Loading match…</p>;

  const showCoach = match.tutorial && coachOpen && match.status === "active";
  const pickingPlay = yourTurn && (!!selectedHand || selectedBench != null);
  const logLines = match.state?.log || [];

  function popAt(side, index) {
    return floats.find((f) => f.side === side && f.index === index);
  }

  function withPop(side, index, node) {
    const pop = popAt(side, index);
    return (
      <div className="card-pop-wrap" key={`${side}-${index}`}>
        {node}
        {pop ? <div className={`dmg-pop ${pop.kind}`}>{pop.text}</div> : null}
      </div>
    );
  }

  return (
    <LayoutGroup>
      <div className="battlefield">
        <div className="hintbar">
          <div>
            <strong>{yourTurn ? "Your turn" : "Waiting"}</strong>
            <span className="hint-text"> — {hint()}</span>
            {attackers.length ? (
              <span className="hint-text"> Attacking with {attackers.length}.</span>
            ) : null}
          </div>
          <div className="row">
            {match.mode === "correspondence" && match.status === "active" && match.moveDeadlineAt ? (
              <span className="muted">{deadlineLabel(match.moveDeadlineAt)}</span>
            ) : null}
            {match.tutorial && coachOpen ? (
              <button className="btn secondary" type="button" onClick={() => setCoachOpen(false)}>Hide tip</button>
            ) : match.tutorial ? (
              <button className="btn secondary" type="button" onClick={() => setCoachOpen(true)}>Show tip</button>
            ) : null}
            {logLines.length ? (
              <button className="btn secondary" type="button" onClick={() => setLogOpen((o) => !o)}>
                {logOpen ? "Hide log" : "Log"}
              </button>
            ) : null}
            {match.status === "active" && yourTurn && phase === "main" ? (
              <button
                className={`btn secondary ${guardMode ? "active-guard" : ""}`}
                type="button"
                onClick={() => {
                  setGuardMode((g) => !g);
                  setAttackers([]);
                  setSelectedHand(null);
                  setSelectedBench(null);
                }}
              >
                {guardMode ? "Cancel Guard" : "Guard"}
              </button>
            ) : null}
            {match.status === "active" ? (
              <button className="btn secondary" type="button" onClick={forfeit}>Forfeit</button>
            ) : null}
            <button className="btn" type="button" disabled={!yourTurn} onClick={() => send({ type: "endTurn" })}>
              End turn
            </button>
          </div>
        </div>
        {error ? <div className="error">{error}</div> : null}
        {banner ? <div className={`battle-banner ${banner.kind}`}>{banner.text}</div> : null}
        {match.status === "active" && attackers.length ? (
          <div className="type-hint">{matchupHint()}</div>
        ) : null}
        {logOpen && logLines.length ? (
          <div className="combat-log" aria-label="Battle log">
            {logLines.slice(-12).map((line, i) => (
              <div key={`${i}-${line}`}>{line}</div>
            ))}
          </div>
        ) : null}
        {showCoach ? (
          <div className="coach coach-compact">
            <strong>Coach</strong>
            <ol>
              <li>Main Phase: play to Active (3) or Bench (3), swap, or press Guard then click an Active unit.</li>
              <li>Attack: first click is the Lead (full Power). Extra clicks Assist (half Power) but those units are Tired next turn.</li>
              <li>If they have a Guard (blue), you must attack that unit. After the fight you cannot play more cards.</li>
              <li>Only the Lead’s type counts: +12 if it beats the defender, −12 if it loses. A defender that beats your Lead also gets +8 Armor. Assists add half Power with no type.</li>
              <li>You go first and skip a draw. Hand limit 7. You lose if Active, Bench, and hand are all empty.</li>
            </ol>
          </div>
        ) : null}

        <div className="table" ref={tableRef}>
          <div className="rail rail-left">
            <DeckPile count={foe?.deckCount || 0} label="Opp" />
          </div>

          <div className="table-main">
            <div className="hand-backs">
              {Array.from({ length: Math.min(foe?.handCount || 0, 8) }).map((_, i) => (
                <CardBack key={i} />
              ))}
            </div>
            <div className="lane bench-row">
              {pad(foe?.bench, BENCH_SLOTS).map((card, i) => (
                card ? (
                  <CardView key={card.instanceId} card={card} size="bench" showAbility={false} {...faceExtras(card, i, "opp")} />
                ) : (
                  <EmptySlot key={`ob-${i}`} label="Bench" />
                )
              ))}
            </div>

            <div className={`field ${slash ? "field-slash" : ""}`}>
              {slash ? <div className="slash" /> : null}
              <div className="lane field-row">
                {pad(foe?.active, ACTIVE_SLOTS).map((card, i) => (
                  withPop("foe", i, card ? (
                    <CardView
                      key={card.instanceId}
                      card={card}
                      size="active"
                      selected={attackers.length > 0}
                      showAbility={false}
                      lunge={lunge.from === "opp" && lunge.attackers.includes(i) ? lunge.dir : 0}
                      onClick={armClick(() => onEnemyActive(i, card))}
                      {...faceExtras(card, i, "opp")}
                    />
                  ) : (
                    <EmptySlot key={`oe-${i}`} label="Enemy" size="active" />
                  ))
                ))}
              </div>
              <div className="field-vs">VS</div>
              <div className="lane field-row">
                {pad(you?.active, ACTIVE_SLOTS).map((card, i) => (
                  withPop("you", i, card ? (
                    <CardView
                      key={card.instanceId}
                      card={card}
                      size="active"
                      selected={attackerSet.has(i)}
                      hot={dropHot("active")}
                      showAbility={false}
                      dragging={dragId === card.instanceId}
                      dropKind="active"
                      dropIndex={i}
                      lunge={lunge.from !== "opp" && lunge.attackers.includes(i) ? lunge.dir : 0}
                      onPointerDown={(e) => beginDrag(e, {
                        from: "active",
                        card,
                        instanceId: card.instanceId,
                        activeIndex: i
                      })}
                      onClick={armClick(() => onYourActive(i, card))}
                      {...faceExtras(card, i, "you")}
                    />
                  ) : (
                    <EmptySlot
                      key={`ya-${i}`}
                      label="Active"
                      size="active"
                      dropKind="active-empty"
                      hot={pickingPlay || dropHot("active-empty")}
                      onClick={clickSafe(() => onYourActive(i, null))}
                    />
                  ))
                ))}
              </div>
            </div>

            <div className="you-dock">
              <div>
                <div className="zone-title">Bench</div>
                <div className="lane bench-row">
                  {pad(you?.bench, BENCH_SLOTS).map((card, i) => (
                    card ? (
                      <CardView
                        key={card.instanceId}
                        card={card}
                        size="bench"
                        selected={selectedBench === i}
                        hot={dropHot("bench")}
                        showAbility={false}
                        dragging={dragId === card.instanceId}
                        dropKind="bench"
                        dropIndex={i}
                        onPointerDown={(e) => beginDrag(e, {
                          from: "bench",
                          card,
                          instanceId: card.instanceId,
                          benchIndex: i
                        })}
                        onClick={armClick(() => onYourBench(i, card))}
                        {...faceExtras(card, i, "you")}
                      />
                    ) : (
                      <EmptySlot
                        key={`yb-${i}`}
                        label="Bench"
                        dropKind="bench-empty"
                        hot={(yourTurn && !!selectedHand) || dropHot("bench-empty")}
                        onClick={clickSafe(() => onYourBench(i, null))}
                      />
                    )
                  ))}
                </div>
              </div>
              <div>
                <div className="zone-title">Hand</div>
                <div className="lane hand-row">
                  {pad(you?.hand, HAND_SLOTS).map((card, i) => (
                    card ? (
                      <CardView
                        key={card.instanceId}
                        card={card}
                        size="hand"
                        selected={selectedHand === card.instanceId}
                        showAbility={false}
                        dragging={dragId === card.instanceId}
                        onPointerDown={(e) => beginDrag(e, {
                          from: "hand",
                          card,
                          instanceId: card.instanceId
                        })}
                        onClick={armClick(() => {
                          if (!yourTurn) return;
                          setSelectedBench(null);
                          setAttackers([]);
                          setSelectedHand((id) => (id === card.instanceId ? null : card.instanceId));
                          audio?.playSfx("select");
                        })}
                        {...faceExtras(card, i, "you")}
                      />
                    ) : (
                      <EmptySlot key={`yh-${i}`} label="Hand" size="hand" />
                    )
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rail rail-right">
            <DeckPile count={you?.deckCount || 0} label="Deck" />
          </div>
        </div>
        {ghost ? (
          <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>
            <CardView card={ghost.card} size={ghost.from === "active" ? "active" : "hand"} animate={false} showAbility={false} />
          </div>
        ) : null}
        {inspect ? (
          <div className="inspect-scrim" onClick={() => setInspect(null)} role="presentation">
            <div className="inspect-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={inspect.name}>
              <CardView card={inspect} size="inspect" animate={false} />
              <div className="inspect-copy">
                <h2>{inspect.name}</h2>
                <p>
                  Power {Math.max(0, (inspect.power || 0) + (inspect.tempPower || 0))}
                  {inspect.printedPower != null && inspect.power < inspect.printedPower ? ` (was ${inspect.printedPower})` : ""}
                  {" · "}{inspect.trait}
                  {inspect.rarity ? ` · ${inspect.rarity}` : ""}
                </p>
                {inspect.abilityText ? <p>{inspect.abilityText}</p> : null}
                {inspect.tired || inspect.tiredTurns > 0 ? <p>Tired — cannot attack this turn.</p> : null}
                {inspect.guarding ? <p>Guard — must be the attack target.</p> : null}
                {inspect.flavorLine ? <p className="muted inspect-flavor">{inspect.flavorLine}</p> : null}
                <p className="muted">Double-click a card to inspect. Click outside or press Esc to close.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </LayoutGroup>
  );
}
