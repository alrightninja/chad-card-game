const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    emailKey: { type: String, unique: true, sparse: true },
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },

    collection: [{ type: String }],
    decks: [
      {
        name: { type: String, required: true },
        cards: [{ type: String }]
      }
    ],

    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    sentRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    currency: {
      reps: { type: Number, default: 0 }
    },

    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    avatarCardId: { type: String, default: null },
    pveFarmDay: { type: String, default: null },
    pveWinsToday: { type: Number, default: 0 },
    lastPveStartAt: { type: Date, default: null },

    passwordResetTokenHash: { type: String, default: null, index: true },
    passwordResetExpires: { type: Date, default: null },

    tutorialCompleted: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    termsAcceptedAt: { type: Date, default: null },
    guardianPermission: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
