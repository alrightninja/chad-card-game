# Gigachad TCG — project status

Last updated: 29 October 2026 (rules v4.2).  
Workspace: `C:\Users\coleb\OneDrive\Documents\Projects\Apps\chad-card-game`

Use this file if a chat runs out of context. The game is **playable locally** vs AI. It is **not deployed**. Do **not** commit `.env`.

**Living rules:** `RULEBOOK.md` (what the engine runs). Constants: `backend/engine/rules.js`. Older `OFFICIAL RULEBOOK.docx` is historical.

---

## What this is

Turn-based multiplayer TCG. Current engine (`RULEBOOK.md` v4.2):

- 40-card decks, 5-card opening hand, **hand limit 7**
- Active **3** / Bench **3** (hand is not 5 slots)
- First player skips the turn-1 draw; second player draws on their first Start Phase
- Main Phase (play/swap/Guard) then Battle; **no plays after you attack**
- Lead (full Power) + Assists (half); Assists are Tired next turn; Guard forces the target
- Survivors lose **20%** power (decay)
- Trait wheel **Lead only, +12 / −12** (defender +8 Armor on a bad matchup): Mind → Muscle → Mystic → Machina → Mayhem → Mind
- Lose if you have nothing in Active, Bench, and hand

---

## Architecture

Two apps, JSON REST + JWT + Socket.IO (mobile-friendly later).

```
React CRA (port 3000)
  REST  →  Express 5 + Socket.IO (0.0.0.0:$PORT, local 4000)
              ├─ engine/*          rules authority (in-memory match state)
              ├─ cards.json        card catalog (NOT Mongo)
              ├─ services/matchService.js
              └─ MongoDB Atlas     users, matches, social
```

- **Catalog lives in** `backend/cards.json`, loaded by `backend/engine/cardRegistry.js`. Mongo only stores **which card IDs a user owns**.
- **Match engine** is the rules authority. Client sends actions; server applies them and returns public state.
- `publicMatchState` hides the opponent’s hand and deck.
- Mixed `Match.state` must be saved with `match.set("state", serialized)` **and** `match.markModified("state")`.
- PvE: after the human `endTurn`, `aiTakeFullTurn` runs. `onStep` snapshots are returned as `replay` so the client can animate the AI.
- Perspective for public state is the acting seat (`player` | `opponent`).
- Art is static files under `frontend/public/cards/`. Source portraits: `assets/character-card-images/`. Copy with `node backend/scripts/copyCardArt.js`.
- `frontend/public/data/cards.json` is a stale copy; the live catalog is the API + `backend/cards.json`.
- Mongoose warns that `collection` is a reserved schema path on User. Harmless for now.

### Local run

1. Atlas IP allowlisted for this machine.
2. `backend/.env` with `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL=http://localhost:3000`.
3. `cd backend && npm start` → `0.0.0.0:4000`
4. `cd frontend && npm start` → CRA `3000` (`REACT_APP_API_URL` optional; default `http://localhost:4000`)

Node does **not** hot-reload `cards.json` or `server.js`. Restart the backend after catalog/pack changes.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Create React App, React 19, react-router-dom 7, framer-motion, socket.io-client |
| Backend | Node ≥18, Express 5, Socket.IO 4, JWT, bcryptjs, dotenv |
| DB | MongoDB Atlas via Mongoose 9 |
| Fonts | DM Sans (Google Fonts) |
| SFX / music | Web Audio SFX plus a looping 6-track playlist in `frontend/public/audio/` |

Frontend env: `REACT_APP_API_URL`, `REACT_APP_WS_URL` (defaults to API URL).

Backend env (see `backend/.env.example`):

- `PORT` (default 4000)
- `MONGO_URI`
- `JWT_SECRET`
- `FRONTEND_URL` (comma-separated CORS origins)
- `DEV_TOOLS=true` enables `POST /api/dev/grant-reps`
- `ADMIN_SECRET` for verify/admin routes
- `ULTRA_NIGHTMARE_RELEASE_AT` optional ISO UTC override
- `TO_THE_HILT_RELEASE_AT` optional ISO UTC override
- `CHAOS_RELEASE_AT` optional ISO UTC override

---

## Deployment plan (not done)

Intended: **frontend on Vercel**, **backend on Render**, Mongo stays Atlas.

There is **no** `render.yaml` or `vercel.json` in the repo yet. Git exists locally; **no GitHub remote / push** as of this writing.

Render constraints (must keep):

- Bind HTTP to `0.0.0.0:$PORT` (already true in `server.js`)
- Ephemeral disk — do not persist matches or art writes on the server
- Free web services sleep after ~15 minutes; free Postgres is irrelevant (we use Atlas)
- Linux is case-sensitive for `public/cards/` filenames
- One app per Render service

When deploying:

- Vercel: `REACT_APP_API_URL` / `REACT_APP_WS_URL` = Render URL
- Render: `FRONTEND_URL` = Vercel origin(s), `MONGO_URI`, `JWT_SECRET`, pack release env vars
- Atlas Network Access must include Render outbound IPs (or `0.0.0.0/0` if acceptable)
- Do not upload `.env`

---

## MongoDB structure

Database: Atlas cluster, app DB typically `gigachad`.

### `users`

| Field | Notes |
| --- | --- |
| email, username, passwordHash | unique email/username |
| collection | `[cardId]` strings (duplicates = extra copies) |
| decks[] | `{ name, cards: [cardId] }` — legal deck is **exactly 40**, max **3** copies |
| friends, friendRequests, sentRequests | ObjectId refs |
| currency.reps | pack currency |
| tutorialCompleted, verified, verifiedAt | |
| termsAcceptedAt, guardianPermission | EULA / kid-safe |
| timestamps | |

### `matches`

| Field | Notes |
| --- | --- |
| playerId, opponentUserId | opponentUserId null for AI |
| opponentType | `ai` \| `user` |
| deckName, opponentDeckName | |
| mode | `live` \| `correspondence` |
| hoursPerMove, moveDeadlineAt | correspondence |
| status | `active` \| `finished` |
| winner | `player` \| `opponent` \| `draw` \| null |
| tutorial | bool |
| version | increment on each action |
| state | Mixed — full engine blob (hands, board, log, powers) |
| rewards.reps | |

Engine seats are always `player` and `opponent`, independent of who is logged in. `yourSeat` in the client payload maps the user onto a seat.

### `challenges`

Friend match invites: from/to user, decks, `live`/`correspondence`, hoursPerMove, status, matchId.

### `messages`

Friend DMs: from, to, body (max 500), moderated in `backend/utils/moderation.js`.

### `cards` collection (legacy)

`models/Card.js` + `seedCards.js` can mirror `cards.json` into Mongo. **Runtime catalog does not read this.** Seeding is optional.

---

## Card packs / sets

Packs are defined in `backend/server.js`. Shop `GET /api/shop/packs` only returns packs that `packOnSale()` says are live. Odds per slot: C 70% / U 20% / R 9% / L 1% (`backend/utils/openPack.js`). Each pack is **5 cards, 100 reps**.

| Pack | Set | Shop | Release |
| --- | --- | --- | --- |
| **Ordo Chadorum** `ordo_chadorum` | 1 (30 cards) | Live | now |
| **To the Hilt** `to_the_hilt` | 3 (44 cards) | Hidden until date | **1 Nov 2026, midnight Eastern** (`2026-11-01T04:00:00.000Z`) |
| **Ultra Nightmare Mode** `ultra_nightmare_mode` | 2 (21 cards) | Hidden until date | **1 Dec 2026, midnight Eastern** (`2026-12-01T05:00:00.000Z`) |
| **Chaos** `chaos` | 4 (130 cards) | Hidden until date | **1 Dec 2026, midnight Eastern** (`2026-12-01T05:00:00.000Z`) |

Old shop id `starter_pump` still maps to Ordo Chadorum on buy.

**Set 1 (Ordo):** Aviator Chad, Baller Chad, Chad Numero Uno, Chad of Pizzazz, Chadministrative Pastor, Dictator Chad, Donut Chad, E Dog, E Money, E Unit, Fashion Chad, Father Chad, Fresh Chad, Hungry Hippo Chad, J Snizzle, Joey Mac, Manager Chad, Ninja Chad, Pastor Chadenbach, Pastor Chadrigo (Jorge art), Pastor Studson, Samurai Chad, Samwise Chadenbach, Sir Kensworth, Sleeper Chad, Stereotypical Chadette, Supreme Leader Chadenbach, The Chadministrator (L 60, strongest), Thimple Chad, Yapper Chad.

**Set 2 (Ultra Nightmare):** Apple, Blitzkrueger, Bobby J, Brodito, Chad Kroeger, Chad Vader, Cheyennomaly, Filius Automobilius, Ice Knight, J Walker, Janitor Chad, Jerome, Joc Boc, K-Pop, Leahnidas, Leif Erikson, Meemow (L 50), Micycle, Saint Chad of Mercia, Sassy Chad, Skibidi Chad.

**Set 3 (To the Hilt):** Anime Chad, Archon Strivemax, Astro Samurai, Bat Jeong-Eun, Bear-Sized Goose, Beowulf, Bigback Tony, Bradford Pitt, Branos, Brawn Weasley, Brick Thunderbulk, Brodir Doomgrip, Brofessor Rumbledore, Chad, Chad Danforth, Chad Knight, Chad Lee, Chad Marine, Chad Pitt, Chadiator, Chadly Squatter, Chadvald the Shredded, Coach Rumble, Cowboy Chad, Dwayne, Filch McNoreps, Flexecutioner, Gigachad, Goose-Sized Bear, Grilled Cheese Sandwich, Groaning Girdle, Hermione Gainger, Jack Steele, Marlene, Mr. Sniffles, Mrs. NoRizz, Orange Dragon Dude, Peregrine Vale, Professor Gainsworth, Robot Overlord, Sharawrrk, Super Case-Oh, Taco, Tom Diddle.

**Set 4 (Chaos):** everything else (~130). No legendaries in this leftover pool.

Rarities used by packs: **C / U / R / L**. Odd rarities `J`/`M` were remapped (J Snizzle → C, Sir Kensworth & Meemow → L) so they can drop.

New accounts get a random 40-card **starter deck** from commons/uncommons/rares across the **whole catalog** (not pack-gated), plus some reps. Packs are how you get more copies.

---

## Frontend surfaces

Routes (auth-gated except login): Home, How to play, Play, Collection, Decks, Shop, Friends, Battle `/:matchId`.

- **Battle:** compact one-screen table, two-click play/attack, AI replay with lunge/SFX, live power + “was X” after decay.
- **Cards:** fixed-size Pokémon-like layout; art `object-fit: cover`, square art corners; name/ability **shrink to fit** (`FitText` in `CardView.js`).
- **Shop:** lists on-sale packs only.
- **Decks:** click collection to add, click deck list to remove, save at 40.

Play: PvE vs AI. Friend challenges (live / correspondence) on Friends. Open matchmaking **not** built.

---

## Important engine / API notes

- Actions: `play` (zone `active`|`bench`), `promote`, `swap`, `attack` `{ attackerIndices, defenderIndex }`, `endTurn`.
- Client: `POST /api/matches/:id/actions` → `{ match }` where match may include `replay[]` of `{ kind, attackerIndices, defenderIndex, state }`.
- Persist fix: without `markModified("state")`, bench/hand looked like they reset.
- `printedPower` is stamped on units; hydrate backfills from catalog if missing.
- Catalog ability keywords are handled in `engine/abilities.js`. Unknown keywords still log `No handler`.
- HTTP match actions broadcast on Socket.IO so live PvP boards stay in sync.

---

## Remaining tasks

**Must / soon**

- [x] GitHub remote, first real commit policy as user requests
- [x] `render.yaml` + Vercel SPA rewrites; deploy backend Render / frontend Vercel
- [ ] Atlas IP / env for production (user must set secrets on Render/Vercel)
- [x] Missing card art generated and copied to `frontend/public/cards` + `assets/character-card-images`
- [x] Card-back image + home logo

**Product / UX**

- [ ] Open matchmaking
- [x] Soundtrack playlist loops for the whole session (`frontend/public/audio/`)
- [ ] Decorative table/menu art (user asked for solids for now)
- [x] Ability keywords wired (v4.0)
- [ ] Grant new cards to existing users if needed (they only appear via packs/starter RNG)
- [x] Deleted stale `frontend/public/data/cards.json`
- [ ] Rename User.collection field to silence Mongoose warning (breaking if not migrated)

**Known nits**

- Free Render sleep + ephemeral FS: live matches die on spin-down; correspondence needs to survive via Mongo (state is in Mongo — OK if the dyno sleeps between moves).
- CRA + OneDrive + many `public/cards` can compile slowly.
- Pack 4 has no legendaries unless new L cards are added to set 4.

Fixed (Oct 2026): shop pack art; unreleased packs hidden; home logo; card backs; forfeit; no silent AI auto-forfeit; correspondence deadline; Peek/Scry private; on-table combat log; challenge/DM sockets + poll; live `match_update` no longer dropped while busy.

---

## Current completion

**About 72%** toward a free, playable public TCG.

| Area | % | Notes |
| --- | --- | --- |
| Core rules / engine | 90 | v4.0: trait +5, phases, hand 7, ability handlers |
| Auth / accounts / EULA | 85 | JWT, guardian flag, verify via admin secret |
| PvE battle UX | 80 | Playable, AI animated, compact board |
| Collection / decks / shop | 75 | Packs + schedule; 11 missing arts |
| PvP / social | 60 | Friends, DMs, challenges; no open queue |
| Content / sets | 85 | 225 cards, 4 named products |
| Deploy / prod | 15 | Local only; no Render/Vercel files yet |
| Juice (SFX/music/art chrome) | 40 | Web Audio placeholders; no card-back image |

---

## Conventions for the next agent

- Prefer editing `backend/cards.json` + restart backend over Mongo card docs.
- After set/pack/art changes: `node backend/scripts/copyCardArt.js` if files moved, then restart `npm start` in `backend`.
- Aliases for misnamed art files live in `backend/scripts/copyCardArt.js`.
- Never commit secrets. `.gitignore` already ignores `.env`.
- User is on Windows PowerShell; `head` is not available.
- Keep UI minimal: solid backgrounds, DM Sans, no decorative table images until asked.
- Pack shop visibility is time-based; unreleased packs are omitted from `GET /api/shop/packs` so wrapper art is not leaked. Do not delete `availableFrom` unless asked.
)
