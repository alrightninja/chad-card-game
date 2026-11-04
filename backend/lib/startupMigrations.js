const User = require("../models/User");
const Migration = require("../models/Migration");

const CYBER_CHAD_ID = "cyber_chad_226";
const MIGRATION_ID = "cyber_chad_grant_v1";
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
    async addReps(userId, amount) {
      await User.updateOne({ _id: userId }, { $inc: { "currency.reps": amount } });
    },
    async addRepsByUsername(username, amount) {
      await User.updateOne({ username }, { $inc: { "currency.reps": amount } });
    },
    async saveResult(id, result) {
      await Migration.updateOne({ _id: id }, { $set: { result, appliedAt: new Date() } });
    }
  };
}

async function runStartupMigrations() {
  const result = await applyGrantOnce(mongoStore());
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
  return result;
}

module.exports = {
  CYBER_CHAD_ID,
  MIGRATION_ID,
  CRK_PREFIX,
  applyGrantOnce,
  runStartupMigrations
};
