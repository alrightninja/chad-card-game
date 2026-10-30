const Match = require("../models/Match");
const Challenge = require("../models/Challenge");
const Message = require("../models/Message");

const FINISHED_KEEP_MS = 60 * 60 * 1000;
const SWEEP_MS = 15 * 60 * 1000;
const MAX_MESSAGES_PER_THREAD = 50;

async function sweep() {
  const cutoff = new Date(Date.now() - FINISHED_KEEP_MS);
  try {
    const matches = await Match.deleteMany({
      status: "finished",
      updatedAt: { $lte: cutoff }
    });
    const challenges = await Challenge.deleteMany({
      status: { $in: ["accepted", "declined", "cancelled"] }
    });
    if (matches.deletedCount || challenges.deletedCount) {
      console.log(
        `Retention: removed ${matches.deletedCount} finished matches, ${challenges.deletedCount} old challenges`
      );
    }
  } catch (err) {
    console.error("Retention sweep failed:", err.message);
  }
}

async function trimMessageThread(userA, userB) {
  const extras = await Message.find({
    $or: [
      { from: userA, to: userB },
      { from: userB, to: userA }
    ]
  })
    .sort({ createdAt: -1 })
    .skip(MAX_MESSAGES_PER_THREAD)
    .select("_id");
  if (!extras.length) return;
  await Message.deleteMany({ _id: { $in: extras.map((d) => d._id) } });
}

function start() {
  sweep();
  setInterval(sweep, SWEEP_MS).unref();
}

module.exports = { start, sweep, trimMessageThread };
