# Gigachad TCG — Living Rulebook (v4.8)

This is the rules the **engine actually runs** (v4.8). If it disagrees with `OFFICIAL RULEBOOK.docx`, this file wins until we merge them.

Numbers live in `backend/engine/rules.js`.

---

## 1. Goal

Knock out the other player’s units. **First to 5 KOs wins** (friend matches may set 3–10). You also **lose** when you have:

- no Active units, **and**
- no Bench units.

A hand full of cards does not keep you in the game once the board is empty (opening setup is exempt until a unit has been discarded or turn 2 begins).

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

- Advantage: Lead **+6** Power
- Disadvantage: Lead **−6** Power, and the defender gains **+8 Armor** for that fight
- Same trait or two steps apart: even (0)

Reverse Weakness flips the bonus. Each type has a colored glow on the card (Muscle red, Mind blue, Mystic teal, Machina gold, Mayhem purple).

---

## 4. Zones

| Zone | Size | Notes |
| --- | --- | --- |
| Deck | 20 to start | Face down. You lose draws if it is empty; you do not lose yet. |
| Hand | Opening **5**. Limit **7** at end of turn | Only you see your own. Opponent sees a count. |
| Active | **3** | These fight. Center of the table. |
| Bench | **3** | Backup. Cannot attack until moved to Active. |
| Discard | Unlimited | KO’d units and extra hand cards. |

There are **not** 5 hand slots. Hand is a pile that grows and shrinks.

You do **not** dump your opening hand onto the board before turn 1. You play from hand during Main Phase, like a Pokémon-style game.

---

## 5. Setup

1. Shuffle a 20-card deck (max **2** copies of a card, max **6** Rares, max **2** Legendaries).
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
- Promote a Bench unit into an empty Active slot, or swap an Active unit with a Bench unit (Rooted units cannot leave Active) — **one** of these Bench-to-Active moves per turn
- Set **Guard** on one Active unit (the opponent must attack that unit)

Click-then-slot and drag-and-drop both work.

**You cannot play, promote, swap, or set Guard after you attack.**

### Battle

- Choose **your** Active units that are not Tired or Stunned. Bench units cannot attack or Assist.
- The **first** unit you choose is the **Lead** (full Power). You may add **one Assist** (half Power).
- Rares and Legendaries cannot Assist and cannot receive an Assist. Commons and Uncommons can do both.
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
4. **Lead:** Power + temp + trait bonus (**±6**, Lead only).
5. **One Assist:** add **half** of that unit’s Power + temp, rounded down. Assists do **not** add type. Rares/Legendaries cannot Assist or be Assisted.
6. Defender Armor: printed Armor, plus **+8 Armor** if their type beats the Lead.
7. Each unit has **HP equal to twice its printed Power**. Damage = attack total minus Armor (minimum 0).
8. A Power Shield on the defender absorbs that hit (no HP lost) and is then spent.
9. If the defender’s HP hits 0, it is KO’d. Attackers are not KO’d for attacking a tougher card.

**Tired:** every unit that attacked (Lead and Assists) becomes **Tired** and cannot attack on its controller’s **next** turn.

**Guard:** in Main Phase, mark one Active unit. The opponent must target that unit. Guard ends at the start of your next turn, or if the unit leaves Active.

**KO:** the unit goes to discard. Defeat abilities fire. A Bench unit is promoted automatically **only if Active is empty** after the KO.

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

**Live turn timer:** each player has **3 minutes** to finish their turn. The clock **restarts at the start of every turn** for both players. If time runs out, the turn passes. If the same player times out **twice in a row**, they forfeit. Completing a turn clears that streak.

---

## 10. Winning

**First to 5 KOs wins** (vs AI always 5). Friend live or correspondence challenges may set the goal anywhere from **3 to 10**.

You also lose when Active and Bench are empty, or your health hits 0.

**Reps:** win 50 / draw 30 / loss 20. A loss pays **0** if the match ended before turn **5**. A forfeit pays **0** to the player who quit (vs AI, nobody is paid).

---

## 11. What changed in v4.8

- Standard win is **first to 5 KOs**
- Friend matches can set the KO goal from **3 to 10**
- Empty board is still a loss

## 12. What changed in v4.7

- At most **one Assist**, and only Commons/Uncommons can Assist or receive an Assist
- Bench units cannot Assist
- **One** Bench-to-Active move (promote or swap) per turn
- KO auto-promotes from Bench only if Active is empty

## 13. What changed in v4.4

- Decks are **20** cards
- Empty Active + Bench is a loss even with cards in hand
- Active is hard-capped at **3** (including KO promotions)
- You may have **1 live** and **1 correspondence** match at once
- Forfeiting vs AI awards **0** reps
- Starter decks only use **released** sets
- Cyber Chad (Rare, Ultra Nightmare Mode)

## 13. What changed in v4.3

- Trait bonus is **+12 / −12**, and **only the Lead’s type** is counted
- A defender that beats the Lead’s type gains **+8 Armor** for that fight
- Combat ability numbers (Power Up/Down, Spike, Heal, and similar) were raised so they can flip a close fight
- Battle UI: colored type glow, type bar, ability chip on Active, and a type line when you pick a Lead

## 14. What changed in v4.2

- Team attacks are **Lead (full Power) + Assists (half Power)**
- Assists become **Tired** next turn
- **Guard** forces the opponent’s attack target

## 15. What changed in v4.1

- Bench is **3** (was 5), so backup slots are a real choice

## 16. What changed in v4.0

- Trait bonus **+5 / −5** (was ±20)
- Second player’s start-of-turn draw is the first-player compensation
- Main Phase, then Battle; no playing after you attack
- Hand limit **7**
- Opening is played from hand over turns (not a pre-game dump onto the board)
- Catalog ability keywords are wired in the engine instead of no-op logging
