const User = require("../models/User");
const Migration = require("../models/Migration");

const CYBER_CHAD_ID = "cyber_chad_226";
const MIGRATION_ID = "cyber_chad_grant_v1";
const PERSONAL_GRANT_ID = "alrightninja_kensworth_wickthrop_v1";
const PERSONAL_GRANT_USER = "alrightninja";
const PERSONAL_GRANT_CARDS = ["sir_kensworth_185", "john_wickthrop_221"];
const STRIP_CONSISTENCY_ID = "strip_chad_of_consistency_v1";
const STRIP_CARD_ID = "chad_of_consistency_033";
const CRK_PREFIX = /^Crk/;

async function applyGrantOnce(store) {
  const claimed = await store.claim(MIGRATION_ID);
  if (!claimed) {
    return { ran: false, reason: "already-applied" };
  }

  const users = await store.listUsers();
  let cardsGranted = 0;
  for (const user of users) {
    await store.pushCard(user.id, CYBER_CHAD_ID);
    cardsGranted += 1;
  }

  const crkUsers = users.filter((u) => CRK_PREFIX.test(u.username || ""));
  const crkNames = crkUsers.map((u) => u.username);
  const repsUsers = [];

  await store.addRepsByUsername("alrightninja", 500);
  repsUsers.push("alrightninja");

  let crkGranted = false;
  if (crkUsers.length === 1) {
    await store.addReps(crkUsers[0].id, 500);
    repsUsers.push(crkUsers[0].username);
    crkGranted = true;
  }

  const result = {
    ran: true,
    cardsGranted,
    cardId: CYBER_CHAD_ID,
    repsUsers,
    crkGranted,
    crkMatches: crkNames
  };
  await store.saveResult(MIGRATION_ID, result);
  return result;
}

async function stripRemovedCardsOnce(store) {
  const claimed = await store.claim(STRIP_CONSISTENCY_ID);
  if (!claimed) {
    return { ran: false, reason: "already-applied" };
  }
  const stripped = await store.pullCardEverywhere(STRIP_CARD_ID);
  const result = { ran: true, cardId: STRIP_CARD_ID, usersTouched: stripped };
  await store.saveResult(STRIP_CONSISTENCY_ID, result);
  return result;
}

async function applyPersonalCardsOnce(store) {
  const claimed = await store.claim(PERSONAL_GRANT_ID);
  if (!claimed) {
    return { ran: false, reason: "already-applied" };
  }

  const granted = [];
  for (const cardId of PERSONAL_GRANT_CARDS) {
    const ok = await store.pushCardByUsername(PERSONAL_GRANT_USER, cardId);
    if (ok) granted.push(cardId);
  }

  const result = {
    ran: true,
    username: PERSONAL_GRANT_USER,
    cardIds: PERSONAL_GRANT_CARDS,
    granted
  };
  await store.saveResult(PERSONAL_GRANT_ID, result);
  return result;
}

function mongoStore() {
  return {
    async claim(id) {
      try {
        await Migration.create({ _id: id, appliedAt: new Date() });
        return true;
      } catch (err) {
        if (err && err.code === 11000) return false;
        throw err;
      }
    },
    async listUsers() {
      const rows = await User.find({}, { username: 1 }).lean();
      return rows.map((u) => ({ id: u._id, username: u.username }));
    },
    async pushCard(userId, cardId) {
      await User.updateOne({ _id: userId }, { $push: { collection: cardId } });
    },
    async pushCardByUsername(username, cardId) {
      const res = await User.updateOne({ username }, { $push: { collection: cardId } });
      return res.matchedCount > 0;
    },
    async addReps(userId, amount) {
      await User.updateOne({ _id: userId }, { $inc: { "currency.reps": amount } });
    },
    async addRepsByUsername(username, amount) {
      await User.updateOne({ username }, { $inc: { "currency.reps": amount } });
    },
    async pullCardEverywhere(cardId) {
      const users = await User.find({
        $or: [
          { collection: cardId },
          { "decks.cards": cardId },
          { avatarCardId: cardId }
        ]
      });
      for (const user of users) {
        user.collection = (user.collection || []).filter((id) => id !== cardId);
        for (const deck of user.decks || []) {
          deck.cards = (deck.cards || []).filter((id) => id !== cardId);
        }
        if (user.avatarCardId === cardId) user.avatarCardId = null;
        await user.save();
      }
      return users.length;
    },
    async saveResult(id, result) {
      await Migration.updateOne({ _id: id }, { $set: { result, appliedAt: new Date() } });
    }
  };
}

async function runStartupMigrations() {
  const store = mongoStore();
  const result = await applyGrantOnce(store);
  if (result.ran) {
    console.log(
      `Migration ${MIGRATION_ID}: granted ${result.cardId} to ${result.cardsGranted} users; reps -> ${result.repsUsers.join(", ") || "none"}`
    );
    if (result.crkMatches.length > 1) {
      console.log(
        `Crk prefix matched more than one user; skipped Crk reps: ${result.crkMatches.join(", ")}`
      );
    }
  }
  const personal = await applyPersonalCardsOnce(store);
  if (personal.ran) {
    console.log(
      `Migration ${PERSONAL_GRANT_ID}: granted ${personal.granted.join(", ") || "nothing"} to ${personal.username}`
    );
  }
  const stripped = await stripRemovedCardsOnce(store);
  if (stripped.ran) {
    console.log(
      `Migration ${STRIP_CONSISTENCY_ID}: removed ${stripped.cardId} from ${stripped.usersTouched} users`
    );
  }
  return { cyberChad: result, personal, stripped };
}

module.exports = {
  CYBER_CHAD_ID,
  MIGRATION_ID,
  PERSONAL_GRANT_ID,
  PERSONAL_GRANT_USER,
  PERSONAL_GRANT_CARDS,
  CRK_PREFIX,
  applyGrantOnce,
  applyPersonalCardsOnce,
  stripRemovedCardsOnce,
  STRIP_CONSISTENCY_ID,
  STRIP_CARD_ID,
  runStartupMigrations
};
