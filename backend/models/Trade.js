const mongoose = require("mongoose");

const TradeSchema = new mongoose.Schema(
  {
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fromUsername: { type: String, required: true },
    toUsername: { type: String, required: true },
    give: { type: [String], required: true },
    want: { type: [String], required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled", "countered"],
      default: "pending",
      index: true
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Trade", default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Trade", TradeSchema);
