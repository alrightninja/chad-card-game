require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const User = require("./models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const requireAuth = require("./middleware/requireAuth");

const generateStarterDeck = require("./utils/generateStarterDeck");
const openPack = require("./utils/openPack");
const registry = require("./engine/cardRegistry");
const matchService = require("./services/matchService");
const { attachMatchSockets, broadcastMatch } = require("./sockets/matchSocket");
const socialRoutes = require("./routes/social");
const adminRoutes = require("./routes/admin");
const { assertCleanUsername } = require("./utils/moderation");
const { safeMe, publicProfile } = require("./lib/publicUser");
const { uniqueOwnedIds } = require("./lib/inventory");
const { normalizeEmail, emailsMatch, emailQuery } = require("./lib/email");
const retention = require("./lib/retention");
const { PACKS, packOnSale, packSaleState } = require("./lib/packs");
const tradeRoutes = require("./routes/trades");
const { isLegalDeckList, deckIllegalReason, deckLimits, DECK_SIZE } = require("./lib/deck");

const app = express();
const PORT = process.env.PORT || 4000;
const frontendOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: frontendOrigins,
    credentials: true
  })
);
app.use(express.json());

connectDB();

const ioHolder = { io: null };

function expandCardIds(ids) {
  return (ids || []).map((id) => registry.getById(id)).filter(Boolean);
}

app.get("/health", (req, res) => {
  const mongoState = require("mongoose").connection.readyState;
  res.json({
    ok: true,
    mongo: mongoState === 1 ? "connected" : "pending"
  });
});

app.get("/", (req, res) => {
  res.json({ name: "Gigachad TCG API", health: "/health" });
});

/* ============================================================
   PUBLIC CARD / CATALOG (served from memory, not Mongo)
   ============================================================ */

app.get("/api/catalog", (req, res) => {
  res.set("Cache-Control", "public, max-age=3600");
  res.json({
    version: registry.CATALOG_VERSION,
    count: registry.getAll().length,
    cards: registry.getAll()
  });
});

app.get("/api/cards", (req, res) => {
  res.set("Cache-Control", "public, max-age=3600");
  res.json(registry.getAll());
});

app.get("/api/cards/:name", (req, res) => {
  const card = registry.getByName(req.params.name);
  if (!card) return res.status(404).json({ error: "Card not found" });
  res.json(card);
});

app.get("/api/random", (req, res) => {
  const all = registry.getAll();
  res.json(all[Math.floor(Math.random() * all.length)]);
});

app.get("/api/rarity/:rarity", (req, res) => {
  const rarity = req.params.rarity;
  res.json(registry.getAll().filter((c) => c.rarity === rarity));
});

app.get("/api/trait/:trait", (req, res) => {
  const trait =
    req.params.trait.charAt(0).toUpperCase() +
    req.params.trait.slice(1).toLowerCase();
  res.json(registry.getAll().filter((c) => c.trait === trait));
});

/* ============================================================
   AUTH
   ============================================================ */

app.post("/api/register", async (req, res) => {
  try {
    const { email, emailConfirm, username, password, passwordConfirm, termsAccepted } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (password !== passwordConfirm) {
      return res.status(400).json({ error: "Passwords do not match" });
    }
    if (!emailsMatch(email, emailConfirm)) {
      return res.status(400).json({ error: "Email addresses do not match" });
    }
    if (!termsAccepted) {
      return res.status(400).json({ error: "You must accept the terms to create an account" });
    }

    assertCleanUsername(username);

    const emailNorm = normalizeEmail(email);
    if (await User.findOne(emailQuery(emailNorm))) {
      return res.status(400).json({ error: "Email already in use" });
    }
    if (await User.findOne({ username })) {
      return res.status(400).json({ error: "Username already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email: emailNorm,
      username,
      passwordHash,
      currency: { reps: 0 },
      tutorialCompleted: false,
      collection: [],
      decks: [],
      friends: [],
      friendRequests: [],
      sentRequests: [],
      termsAcceptedAt: new Date()
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    res.json({
      message: "User registered successfully",
      token,
      user: safeMe(user)
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const user = await User.findOne(emailQuery(email));
    if (!user) return res.status(400).json({ error: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    res.json({
      message: "Login successful",
      token,
      user: safeMe(user)
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/protected-test", requireAuth, (req, res) => {
  res.json({
    message: "You accessed a protected route!",
    user: req.user
  });
});

app.post("/api/complete-tutorial", requireAuth, async (req, res) => {
  try {
    const user = req.user;

    if (user.tutorialCompleted) {
      return res.status(400).json({ error: "Tutorial already completed" });
    }

    user.tutorialCompleted = true;
    const starterDeck = generateStarterDeck();
    user.currency.reps = (user.currency.reps || 0) + 200;
    user.collection.push(...starterDeck);
    user.decks.push({
      name: "Starter Deck",
      cards: starterDeck
    });

    await user.save();

    res.json({
      message: "Tutorial completed. Starter deck assigned.",
      starterDeck
    });
  } catch (err) {
    console.error("Error completing tutorial:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: safeMe(req.user) });
});

app.patch("/api/me", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const avatarCardId = req.body.avatarCardId;
    if (avatarCardId != null && avatarCardId !== "") {
      if (!registry.getById(avatarCardId)) {
        return res.status(400).json({ error: "Unknown card" });
      }
      if (!(user.collection || []).includes(avatarCardId)) {
        return res.status(400).json({ error: "You can only use a card you own as your picture" });
      }
      user.avatarCardId = avatarCardId;
    } else if (avatarCardId === "" || avatarCardId === null) {
      user.avatarCardId = null;
    }
    await user.save();
    res.json({ user: safeMe(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/me/password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, newPasswordConfirm } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }
    if (newPassword !== newPasswordConfirm) {
      return res.status(400).json({ error: "New passwords do not match" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }
    const user = await User.findById(req.user._id);
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ error: "Current password is incorrect" });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Password updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/users/:username", requireAuth, async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found" });
    const mine = String(user._id) === String(req.user._id);
    const friend = (req.user.friends || []).some((id) => String(id) === String(user._id));
    const payload = publicProfile(user);
    payload.mine = mine;
    payload.friend = friend || mine;
    if (mine || friend) {
      const counts = {};
      for (const id of user.collection || []) counts[id] = (counts[id] || 0) + 1;
      payload.collection = Object.keys(counts)
        .map((id) => {
          const card = registry.getById(id);
          if (!card) return null;
          return { ...card, quantity: counts[id] };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    if (mine) {
      payload.ownedAvatars = uniqueOwnedIds(user.collection).map((id) => {
        const card = registry.getById(id);
        return { cardId: id, name: card.name, art: card.art };
      });
    }
    res.json({ user: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.use("/api", socialRoutes);
app.use("/api", tradeRoutes);
app.use("/api/admin", adminRoutes);

/* ============================================================
   COLLECTION / DECKS
   ============================================================ */

app.get("/api/collection", requireAuth, async (req, res) => {
  try {
    const cardIds = req.user.collection;
    const counts = {};
    for (const id of cardIds) {
      counts[id] = (counts[id] || 0) + 1;
    }

    const uniqueIds = Object.keys(counts);
    const unique = uniqueIds
      .map((id) => {
        const card = registry.getById(id);
        if (!card) return null;
        return { ...card, quantity: counts[id] };
      })
      .filter(Boolean);

    const rarityOrder = { C: 1, U: 2, R: 3, SR: 4, UR: 5, L: 6 };
    unique.sort((a, b) => {
      if (rarityOrder[a.rarity] !== rarityOrder[b.rarity]) {
        return rarityOrder[a.rarity] - rarityOrder[b.rarity];
      }
      if (a.trait !== b.trait) return a.trait.localeCompare(b.trait);
      return a.name.localeCompare(b.name);
    });

    res.json({ collection: unique });
  } catch (err) {
    console.error("Error fetching collection:", err);
    res.status(500).json({ error: "Server error" });
  }
});

const MAX_DECKS = 5;

function deckNameTaken(user, name, except) {
  const n = String(name || "").trim();
  return user.decks.some((d) => d.name === n && d.name !== except);
}

app.get("/api/decks", requireAuth, async (req, res) => {
  try {
    const allDecks = req.user.decks.map((deck) => ({
      name: deck.name,
      cards: expandCardIds(deck.cards),
      legal: isLegalDeckList(deck.cards),
      needsRebuild: !isLegalDeckList(deck.cards)
    }));
    res.json({ decks: allDecks, limits: deckLimits() });
  } catch (err) {
    console.error("Error fetching decks:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/decks/create", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { cards } = req.body;
    const name = String(req.body.name || "").trim();

    if (!name || !cards) {
      return res.status(400).json({ error: "Deck name and cards are required" });
    }
    if (user.decks.length >= MAX_DECKS) {
      return res.status(400).json({ error: `You can keep up to ${MAX_DECKS} decks` });
    }
    if (deckNameTaken(user, name)) {
      return res.status(400).json({ error: "That deck name is already in use" });
    }
    if (!Array.isArray(cards)) {
      return res.status(400).json({ error: "Cards must be an array" });
    }
    const illegal = deckIllegalReason(cards, DECK_SIZE);
    if (illegal) {
      return res.status(400).json({ error: illegal });
    }

    const userCollection = [...user.collection];
    for (const id of cards) {
      const index = userCollection.indexOf(id);
      if (index === -1) {
        return res.status(400).json({ error: `User does not own card: ${id}` });
      }
      userCollection.splice(index, 1);
    }

    user.decks.push({ name, cards });
    await user.save();

    res.json({
      message: "Deck created successfully",
      deck: { name, cards }
    });
  } catch (err) {
    console.error("Error creating deck:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/decks/update", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { oldName, newName, cards } = req.body;

    if (!oldName) {
      return res.status(400).json({ error: "oldName is required" });
    }

    const deck = user.decks.find((d) => d.name === oldName);
    if (!deck) return res.status(404).json({ error: "Deck not found" });

    if (newName) {
      const trimmed = String(newName).trim();
      if (!trimmed) {
        return res.status(400).json({ error: "Deck name is required" });
      }
      if (deckNameTaken(user, trimmed, oldName)) {
        return res.status(400).json({ error: "That deck name is already in use" });
      }
      deck.name = trimmed;
    }

    if (cards) {
      if (!Array.isArray(cards)) {
        return res.status(400).json({ error: "Cards must be an array" });
      }
      const illegal = deckIllegalReason(cards, DECK_SIZE);
      if (illegal) {
        return res.status(400).json({ error: illegal });
      }

      const userCollection = [...user.collection];
      for (const id of cards) {
        const index = userCollection.indexOf(id);
        if (index === -1) {
          return res.status(400).json({ error: `User does not own card: ${id}` });
        }
        userCollection.splice(index, 1);
      }

      deck.cards = cards;
    }

    await user.save();
    res.json({ message: "Deck updated successfully", deck });
  } catch (err) {
    console.error("Error updating deck:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/decks/delete", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Deck name is required" });
    }

    const index = user.decks.findIndex((d) => d.name === name);
    if (index === -1) return res.status(404).json({ error: "Deck not found" });

    user.decks.splice(index, 1);
    await user.save();

    res.json({ message: "Deck deleted successfully", deletedDeck: name });
  } catch (err) {
    console.error("Error deleting deck:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ============================================================
   MATCHES (engine-backed, persisted)
   ============================================================ */

app.post("/api/matches", requireAuth, async (req, res) => {
  try {
    const { deckName, tutorial } = req.body;
    if (!deckName) {
      return res.status(400).json({ error: "Deck name is required" });
    }
    const match = await matchService.startPveMatch(req.user, deckName, {
      tutorial: !!tutorial
    });
    res.json({ message: "Match started", match });
  } catch (err) {
    console.error("Error starting match:", err);
    res.status(err.status || 500).json({
      error: err.message || "Server error",
      ...(err.payload || {})
    });
  }
});

app.get("/api/matches/active", requireAuth, async (req, res) => {
  try {
    const active = await matchService.listActiveMatches(req.user._id);
    const liveDoc = active.find((m) => (m.mode || "live") === "live") || null;
    const corrDoc = active.find((m) => m.mode === "correspondence") || null;
    const live = liveDoc ? matchService.toClient(liveDoc, req.user._id) : null;
    const correspondence = corrDoc ? matchService.toClient(corrDoc, req.user._id) : null;
    res.json({
      match: live || correspondence || null,
      live,
      correspondence
    });
  } catch (err) {
    console.error("Error fetching match:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/matches/:id", requireAuth, async (req, res) => {
  try {
    const match = await matchService.getMatchForUser(req.user._id, req.params.id);
    if (req.query.sync && ioHolder.io) {
      await broadcastMatch(ioHolder.io, req.params.id);
    }
    res.json({ match: matchService.toClient(match, req.user._id) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
});

app.post("/api/matches/:id/forfeit", requireAuth, async (req, res) => {
  try {
    const match = await matchService.forfeitMatch(req.user, req.params.id);
    if (ioHolder.io) {
      await broadcastMatch(ioHolder.io, req.params.id);
    }
    res.json({ message: "Match forfeited", match });
  } catch (err) {
    console.error("Error forfeiting match:", err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({ error: err.message || "Server error" });
    }
  }
});

app.post("/api/matches/:id/actions", requireAuth, async (req, res) => {
  try {
    const { payload } = await matchService.applyMatchAction(
      req.user,
      req.params.id,
      req.body
    );
    if (ioHolder.io) {
      await broadcastMatch(ioHolder.io, req.params.id);
    }
    res.json({ message: "Action processed", match: payload });
  } catch (err) {
    console.error("Error processing action:", err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({ error: err.message || "Server error" });
    }
  }
});

// Legacy aliases so older clients keep working
app.post("/api/battle/start", requireAuth, async (req, res) => {
  try {
    const { deckName } = req.body;
    if (!deckName) {
      return res.status(400).json({ error: "Deck name is required" });
    }
    const match = await matchService.startPveMatch(req.user, deckName);
    res.json({
      message: "Battle started successfully",
      deckUsed: deckName,
      match,
      battleState: match.state
    });
  } catch (err) {
    console.error("Error starting battle:", err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
});

app.post("/api/battle/action", requireAuth, async (req, res) => {
  try {
    const { matchId, ...action } = req.body;
    let id = matchId;
    if (!id) {
      const active = await matchService.getActiveMatch(req.user._id);
      if (!active) {
        return res.status(400).json({ error: "No active battle found." });
      }
      id = active._id;
    }
    const { payload } = await matchService.applyMatchAction(
      req.user,
      id,
      action
    );
    res.json({
      message: payload.status === "finished" ? "Battle ended" : "Action processed",
      winner: payload.winner,
      match: payload,
      battleState: payload.state
    });
  } catch (err) {
    console.error("Error processing battle action:", err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
});

/* ============================================================
   SHOP
   ============================================================ */

const packs = PACKS;

app.post("/api/shop/buy-pack", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { packType } = req.body;
    const packId = packType === "starter_pump" ? "ordo_chadorum" : packType;

    const pack = packs.find((p) => p.id === packId);
    if (!pack) {
      return res.status(400).json({ error: "Invalid pack type" });
    }
    if (!packOnSale(pack)) {
      const ended = pack.availableUntil && new Date() >= new Date(pack.availableUntil);
      return res.status(400).json({
        error: ended ? "This pack is no longer for sale" : "This pack is not available yet"
      });
    }

    if (user.currency.reps < pack.cost) {
      return res.status(400).json({ error: "Not enough Reps to buy this pack" });
    }

    user.currency.reps -= pack.cost;
    const pulledCardIds = openPack(pack.set);
    user.collection.push(...pulledCardIds);
    await user.save();

    res.json({
      message: "Pack purchased and opened!",
      cost: pack.cost,
      remainingReps: user.currency.reps,
      cards: expandCardIds(pulledCardIds)
    });
  } catch (err) {
    console.error("Error buying pack:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/shop/packs", requireAuth, (req, res) => {
  res.json({
    packs: packs.map((pack) => packSaleState(pack))
  });
});

app.post("/api/dev/grant-reps", requireAuth, async (req, res) => {
  try {
    if (process.env.DEV_TOOLS !== "true") {
      return res.status(404).json({ error: "Not found" });
    }

    const user = req.user;
    const { amount } = req.body;
    user.currency.reps += Number(amount) || 0;
    await user.save();

    res.json({
      message: `Granted ${amount} Reps`,
      reps: user.currency.reps
    });
  } catch (err) {
    console.error("Error granting reps:", err);
    res.status(500).json({ error: "Server error" });
  }
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: frontendOrigins,
    credentials: true
  }
});

attachMatchSockets(io);
ioHolder.io = io;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Gigachad TCG API listening on 0.0.0.0:${PORT}`);
  retention.start();
});
