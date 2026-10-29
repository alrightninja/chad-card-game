const mongoose = require("mongoose");

const ChallengeSchema = new mongoose.Schema(
  {
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fromDeckName: { type: String, required: true },
    toDeckName: { type: String, default: null },
    mode: { type: String, enum: ["live", "correspondence"], default: "correspondence" },
    hoursPerMove: { type: Number, default: 24 },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled"],
      default: "pending",
      index: true
    },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match", default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Challenge", ChallengeSchema);
