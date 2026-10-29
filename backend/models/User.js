const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
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

    tutorialCompleted: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    termsAcceptedAt: { type: Date, default: null },
    guardianPermission: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
