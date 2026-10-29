const mongoose = require("mongoose");

const MatchSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    opponentType: {
      type: String,
      enum: ["ai", "user"],
      default: "ai"
    },
    opponentUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    deckName: { type: String, required: true },
    opponentDeckName: { type: String, default: null },
    mode: {
      type: String,
      enum: ["live", "correspondence"],
      default: "live"
    },
    hoursPerMove: { type: Number, default: null },
    moveDeadlineAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["active", "finished"],
      default: "active",
      index: true
    },
    winner: {
      type: String,
      default: null
    },
    tutorial: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
    state: { type: mongoose.Schema.Types.Mixed, required: true },
    rewards: {
      reps: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

MatchSchema.index({ playerId: 1, status: 1 });
MatchSchema.index({ opponentUserId: 1, status: 1 });

module.exports = mongoose.model("Match", MatchSchema);
