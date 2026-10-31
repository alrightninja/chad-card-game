/* One-off QA: friends + live challenge + mixed-trait PvP. */
const BASE = process.env.API_URL || "http://localhost:4000";

const PASS = "QaTest-Pass-28";
const A = { email: "qa.alpha@example.test", username: "qa_alpha" };
const B = { email: "qa.bravo@example.test", username: "qa_bravo" };

async function req(path, { token, method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `${method} ${path} ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function loginOrRegister(account) {
  try {
    const data = await req("/api/register", {
      method: "POST",
      body: {
        ...account,
        emailConfirm: account.email,
        password: PASS,
        termsAccepted: true,
        guardianPermission: true
      }
    });
    return data;
  } catch (err) {
    if (!/already/i.test(err.message)) throw err;
    return req("/api/login", {
      method: "POST",
      body: { email: account.email, password: PASS }
    });
  }
}

async function ensureDeck(token) {
  const me = await req("/api/me", { token });
  if (me.user?.tutorialCompleted && me.user?.decks?.length) return me.user;
  try {
    await req("/api/complete-tutorial", { token, method: "POST", body: {} });
  } catch (err) {
    if (!/already/i.test(err.message)) throw err;
  }
  const again = await req("/api/me", { token });
  return again.user;
}

function pickPlays(hand, activeCount, benchCount) {
  const plays = [];
  for (const card of hand) {
    if (activeCount < 3) {
      plays.push({ card, zone: "active" });
      activeCount += 1;
    } else if (benchCount < 3) {
      plays.push({ card, zone: "bench" });
      benchCount += 1;
    } else break;
  }
  return plays;
}

function traitAdv(atk, def) {
  const advantage = {
    Mind: "Muscle",
    Muscle: "Mystic",
    Mystic: "Machina",
    Machina: "Mayhem",
    Mayhem: "Mind"
  };
  if (advantage[atk] === def) return 1;
  if (advantage[def] === atk) return -1;
  return 0;
}

function chooseAttack(you, foe) {
  if (!you.active?.length || !foe.active?.length) return null;
  let best = { score: -999, attackers: [0], defender: 0 };
  for (let d = 0; d < foe.active.length; d++) {
    const def = foe.active[d];
    const attackers = you.active.map((_, i) => i);
    const score = you.active.reduce((sum, a) => {
      return sum + (a.power || 0) + 20 * traitAdv(a.trait, def.trait);
    }, 0) - (def.power || 0);
    if (score > best.score) best = { score, attackers, defender: d };
  }
  return best;
}

async function takeTurn(token, matchId, seat) {
  let data = await req(`/api/matches/${matchId}`, { token });
  let match = data.match;
  if (match.status !== "active") return match;
  if (match.yourSeat !== match.state.turnPlayer) return match;

  const you = match.state.you;
  const foe = match.state.opponent;
  const plays = pickPlays(you.hand || [], you.active.length, you.bench.length);
  const used = new Set();
  for (const play of plays) {
    if (used.has(play.card.instanceId)) continue;
    used.add(play.card.instanceId);
    try {
      const res = await req(`/api/matches/${matchId}/actions`, {
        token,
        method: "POST",
        body: { type: "play", instanceId: play.card.instanceId, zone: play.zone }
      });
      match = res.match;
      if (match.status !== "active") return match;
    } catch (err) {
      break;
    }
  }

  data = await req(`/api/matches/${matchId}`, { token });
  match = data.match;
  const attack = chooseAttack(match.state.you, match.state.opponent);
  if (attack && match.state.turnPlayer === seat) {
    try {
      const res = await req(`/api/matches/${matchId}/actions`, {
        token,
        method: "POST",
        body: {
          type: "attack",
          attackerIndices: attack.attackers,
          defenderIndex: attack.defender
        }
      });
      match = res.match;
    } catch (err) {
      /* no legal attack */
    }
  }

  if (match.status === "active" && match.state.turnPlayer === seat) {
    const res = await req(`/api/matches/${matchId}/actions`, {
      token,
      method: "POST",
      body: { type: "endTurn" }
    });
    match = res.match;
  }
  return match;
}

async function main() {
  const notes = [];
  const aAuth = await loginOrRegister(A);
  const bAuth = await loginOrRegister(B);
  const aTok = aAuth.token;
  const bTok = bAuth.token;
  await ensureDeck(aTok);
  await ensureDeck(bTok);

  try {
    await req("/api/friends/request", {
      token: aTok,
      method: "POST",
      body: { username: B.username }
    });
    notes.push("friend request sent");
  } catch (err) {
    notes.push(`friend request: ${err.message}`);
  }

  const bFriends = await req("/api/friends", { token: bTok });
  const incoming = (bFriends.incoming || []).find((u) => u.username === A.username);
  if (incoming) {
    await req("/api/friends/respond", {
      token: bTok,
      method: "POST",
      body: { userId: incoming.id, accept: true }
    });
    notes.push("friend request accepted");
  } else {
    notes.push("already friends or no incoming");
  }

  try {
    await req("/api/challenges", {
      token: aTok,
      method: "POST",
      body: {
        username: "nobody_named_this",
        deckName: "Starter Deck",
        mode: "live"
      }
    });
    notes.push("ERROR: non-friend challenge should fail");
  } catch (err) {
    notes.push(`non-friend blocked: ${err.message}`);
  }

  const ch = await req("/api/challenges", {
    token: aTok,
    method: "POST",
    body: { username: B.username, deckName: "Starter Deck", mode: "live" }
  });
  notes.push(`live challenge id ${ch.id}`);

  const bCh = await req("/api/challenges", { token: bTok });
  const incomingCh = (bCh.challenges || []).find((c) => c.incoming);
  if (!incomingCh) throw new Error("Bravo did not see incoming challenge");

  const accepted = await req(`/api/challenges/${incomingCh.id}/respond`, {
    token: bTok,
    method: "POST",
    body: { accept: true, deckName: "Starter Deck" }
  });
  const matchId = accepted.match?.id;
  if (!matchId) throw new Error("Accept did not return match id");
  notes.push(`match started ${matchId}`);

  const aActive = await req("/api/matches/active", { token: aTok });
  if (!aActive.match || String(aActive.match.id) !== String(matchId)) {
    throw new Error("Challenger did not see active PvP match");
  }
  notes.push(`challenger seat ${aActive.match.yourSeat}, turn ${aActive.match.state.turnPlayer}`);

  const traits = new Set();
  let match = aActive.match;
  let guard = 0;
  while (match.status === "active" && guard < 80) {
    guard += 1;
    const actorTok = match.state.turnPlayer === "player" ? aTok : bTok;
    const actorSeat = match.state.turnPlayer;
    for (const c of match.state.you.active || []) traits.add(c.trait);
    for (const c of match.state.opponent.active || []) if (c.trait) traits.add(c.trait);
    match = await takeTurn(actorTok, matchId, actorSeat);
    const peekTok = match.state.turnPlayer === "player" ? aTok : bTok;
    const peek = await req(`/api/matches/${matchId}`, { token: peekTok });
    match = peek.match;
  }

  console.log(JSON.stringify({
    notes,
    turns: guard,
    status: match.status,
    winner: match.winner,
    traits: [...traits].filter(Boolean),
    lastLog: (match.state?.log || []).slice(-12)
  }, null, 2));
}

main().catch((err) => {
  console.error("QA FAILED", err.message);
  process.exit(1);
});
