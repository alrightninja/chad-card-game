# Gigachad TCG — Living Rulebook (v4.3)

This is the rules the **engine actually runs**. If it disagrees with `OFFICIAL RULEBOOK.docx`, this file wins until we merge them.

Numbers live in `backend/engine/rules.js`.

---

## 1. Goal

Knock out the other player’s units. You **lose** when you have:

- no Active units, **and**
- no Bench units, **and**
- no cards in hand.

A scenario or effect can also end the game (for example Unblockable damage reducing health to 0).

---

## 2. Cards

Every card is a **Unit**. Printed on each card:

- Name
- Trait (Muscle, Mind, Mayhem, Mystic, or Machina)
- Power
- Ability (timing + keyword + value)
- Flavor
- Rarity (C / U / R / L)

---

## 3. Traits

**Wheel, only the Lead’s type vs the defender (Assists ignore type):**

Mind → Muscle → Mystic → Machina → Mayhem → Mind

- Advantage: Lead **+12** Power
- Disadvantage: Lead **−12** Power, and the defender gains **+8 Armor** for that fight
- Same trait or two steps apart: even (0)

Reverse Weakness flips the bonus. Each type has a colored glow on the card (Muscle red, Mind blue, Mystic teal, Machina gold, Mayhem purple).

---

## 4. Zones

| Zone | Size | Notes |
| --- | --- | --- |
| Deck | 40 to start | Face down. You lose draws if it is empty; you do not lose yet. |
| Hand | Opening **5**. Limit **7** at end of turn | Only you see your own. Opponent sees a count. |
| Active | **3** | These fight. Center of the table. |
| Bench | **3** | Backup. Cannot attack until moved to Active. |
| Discard | Unlimited | KO’d units and extra hand cards. |

There are **not** 5 hand slots. Hand is a pile that grows and shrinks.

You do **not** dump your opening hand onto the board before turn 1. You play from hand during Main Phase, like a Pokémon-style game.

---

## 5. Setup

1. Shuffle a 40-card deck (max 3 copies of a card).
2. Both players draw **5**.
3. **First player** takes the first turn and **does not draw**.
4. **Second player** draws 1 at the start of their first turn.

---

## 6. Turn structure

Each turn has four phases, in order.

### Start

- Draw 1 if your deck has cards.
- Clear last turn’s temporary Power on your units.
- Tick down Silence on you.

### Main

You may, in any order:

- Play units from hand into empty Active (max 3) or Bench (max 3)
- Promote a Bench unit into an empty Active slot
- Swap an Active unit with a Bench unit (Rooted units cannot leave Active)
- Set **Guard** on one Active unit (the opponent must attack that unit)

Click-then-slot and drag-and-drop both work.

**You cannot play, promote, swap, or set Guard after you attack.**

### Battle

- Choose 1–3 of **your** Active units that are not Tired or Stunned.
- The **first** unit you choose is the **Lead** (full Power). Extra units are **Assists** (half Power).
- Choose **one** enemy Active unit. If they have a Guard, you must choose it.
- Resolve immediately.
- One battle per turn, unless a unit has Multi-Attack and attacked **alone**.

If you skip Battle, nothing fights.

### End

- End-of-turn passives
- If you have more than **7** cards, discard oldest extras until you have 7
- Pass the turn

---

## 7. Battle

1. Attack abilities fire (Stun, Spike, Chaos Swing, and so on).
2. If a Cancel Battle effect is waiting, the fight fizzles.
3. Unblockable attacks skip the defender and hit remaining health instead.
4. **Lead:** Power + temp + trait bonus (**±12**, Lead only).
5. **Each Assist:** add **half** of that unit’s Power + temp, rounded down. Assists do **not** add type.
6. Defender: Power + temp + printed Armor, plus **+8 Armor** if their type beats the Lead.
7. **Attack total > defender** — defender is KO’d. Attackers survive and suffer Decay.
8. **Attack total < defender** — all attackers are KO’d. Defender survives and suffer Decay.
9. **Tie** — both sides survive; both suffer Decay.

**Assist / Tired:** every Assist becomes **Tired** and cannot attack (Lead or Assist) on its controller’s **next** turn. The Lead does not become Tired.

**Guard:** in Main Phase, mark one Active unit. The opponent must target that unit. Guard ends at the start of your next turn, or if the unit leaves Active.

**Decay:** surviving units that fought lose **20%** of current Power, rounded down. A Power Shield prevents that unit’s next Decay.

**KO:** the unit goes to discard. Defeat abilities fire. If it was Active, the next Bench unit is promoted automatically.

**Stun:** a stunned unit cannot be chosen as an attacker on its controller’s next turn.

---

## 8. Abilities

Timing windows:

- **Play** — when the unit enters Active or Bench
- **Attack** — when it is part of a declared attack
- **Defeat** — when it is KO’d
- **Passive** — applied when it enters play (Armor, Shielded, Rooted, Multi-Attack, and similar)

Keywords the engine implements include Power Up/Down, Draw, Spike, Stun, Peek, Scry, Chaos Swing, Heal, Recycle, Force Swap, Cancel Battle, Tutor, Reveal, Revenge, KO Threshold, and the rest of the catalog list. If a keyword is missing, the log says so and the card still has its Power and Trait.

---

## 9. How to physically play (UI)

- **Play:** click a hand card, then a slot — or drag it.
- **Promote / swap:** click Bench, then Active (empty = promote, occupied = swap) — or drag.
- **Attack:** click your Lead, then any Assists, then one enemy Active unit.
- **Guard:** the Guard button, then click your Active unit.
- **End turn:** the button in the hint bar.

Live friend matches update both players over the match socket. Challenge a friend from the Friends page (you must already be friends).

**Live turn timer:** each player has **3 minutes** to finish their turn. If time runs out, the turn passes. If the same player times out **twice in a row**, they forfeit. The clock resets after you complete a turn.

---

## 10. Winning

You lose when Active, Bench, and hand are all empty, or your health hits 0.

---

## 11. What changed in v4.3

- Trait bonus is **+12 / −12**, and **only the Lead’s type** is counted
- A defender that beats the Lead’s type gains **+8 Armor** for that fight
- Combat ability numbers (Power Up/Down, Spike, Heal, and similar) were raised so they can flip a close fight
- Battle UI: colored type glow, type bar, ability chip on Active, and a type line when you pick a Lead

## 12. What changed in v4.2

- Team attacks are **Lead (full Power) + Assists (half Power)**
- Assists become **Tired** next turn
- **Guard** forces the opponent’s attack target

## 13. What changed in v4.1

- Bench is **3** (was 5), so backup slots are a real choice

## 14. What changed in v4.0

- Trait bonus **+5 / −5** (was ±20)
- Second player’s start-of-turn draw is the first-player compensation
- Main Phase, then Battle; no playing after you attack
- Hand limit **7**
- Opening is played from hand over turns (not a pre-game dump onto the board)
- Catalog ability keywords are wired in the engine instead of no-op logging
