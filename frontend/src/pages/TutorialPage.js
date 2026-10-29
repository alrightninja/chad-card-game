import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const STEPS = [
  {
    title: "What you are trying to do",
    body: "Knock out the other player’s units. You win when they have nothing left in Active, on the Bench, or in their hand.\n\nDecks are 40 cards. Every card is a unit with Power and a Trait: Muscle, Mind, Mayhem, Mystic, or Machina."
  },
  {
    title: "The board",
    body: "Deck — you draw from here. Both players start with 5 cards. The first player does not draw on turn 1; the second player draws at the start of their first turn.\n\nHand — cards you can play. Only you see your hand. Max 7 at the end of your turn; extra cards (oldest first) go to discard.\n\nActive — up to 3 units that fight. Center of the table.\n\nBench — up to 3 backups. They cannot attack until you move them to Active."
  },
  {
    title: "How to play a card",
    body: "Do this in Main Phase — before you attack.\n\nClick a card in your hand, then an empty Active or Bench slot. Or hold and drag it there.\n\nFill Active first when you can. Only Active units fight.\n\nAfter you attack, you cannot play or swap until next turn."
  },
  {
    title: "How to attack",
    body: "1. Click YOUR Active unit first — that is the Lead and uses full Power.\n2. Optionally click more of your Active units — they Assist and add half their Power, then become Tired (they cannot attack next turn).\n3. Click one enemy Active unit. The fight happens immediately.\n\nIf the enemy has a Guard (blue badge), you must attack that unit.\n\nHigher total wins. The loser is knocked out. Survivors lose 20% Power (Decay).\n\nTrait advantage is +5 Power, disadvantage −5:\nMind beats Muscle → Muscle beats Mystic → Mystic beats Machina → Machina beats Mayhem → Mayhem beats Mind.\n\nYou get one battle per turn (unless a card says it may attack twice)."
  },
  {
    title: "Guard",
    body: "In Main Phase, press Guard then click one of your Active units. That unit must be the opponent’s attack target this round.\n\nUse it to protect a weaker unit, or to force a bad fight onto a tank. Guard ends at the start of your next turn, or if that unit leaves Active."
  },
  {
    title: "Bench, swaps, and ending your turn",
    body: "Still in Main Phase: click a Bench unit, then an empty Active slot to promote, or an Active unit to swap. Drag works too.\n\nWhen an Active unit is KO’d, a Bench unit is promoted automatically if you have one.\n\nEnd turn when you are done. If your hand is over 7, extras discard automatically.\n\nYou lose if you have no Active, no Bench, and no hand."
  }
];

export default function TutorialPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const last = step === STEPS.length - 1;

  async function startPractice() {
    setBusy(true);
    setError("");
    try {
      if (!user?.tutorialCompleted) {
        await api("/api/complete-tutorial", {
          method: "POST",
          body: JSON.stringify({})
        });
        await refresh();
      }
      const decks = await api("/api/decks");
      const starter = decks.decks?.find((d) => d.name === "Starter Deck") || decks.decks?.[0];
      if (!starter) {
        throw new Error("No deck found. Try Home again.");
      }
      const data = await api("/api/matches", {
        method: "POST",
        body: JSON.stringify({ deckName: starter.name, tutorial: true })
      });
      navigate(`/battle/${data.match.id}`);
    } catch (err) {
      if (err.status === 409) {
        setError("Finish or forfeit your current match first (Home or Play).");
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const current = STEPS[step];

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <p className="muted">Lesson {step + 1} of {STEPS.length}</p>
      <h1 style={{ margin: 0 }}>{current.title}</h1>
      <div className="panel" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
        {current.body}
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="row">
        <button className="btn secondary" type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </button>
        {!last ? (
          <button className="btn" type="button" onClick={() => setStep((s) => s + 1)}>
            Next
          </button>
        ) : (
          <button className="btn" type="button" disabled={busy} onClick={startPractice}>
            {user?.tutorialCompleted ? "Practice battle with coach" : "Get starter deck and practice"}
          </button>
        )}
      </div>
    </div>
  );
}
