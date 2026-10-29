const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema({
  cardId: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true },
  trait: { type: String, required: true },
  power: { type: Number, required: true },
  rarity: { type: String, required: true },

  abilityCategory: { type: String, required: true },
  abilityKeyword: { type: String, required: true },
  abilityValue: { type: Number, required: true },
  abilityText: { type: String, required: true },

  flavorLine: { type: String, required: true },
  art: { type: String, required: true },

  set: { type: Number, default: 1 },
  version: { type: Number, required: true }
});

module.exports = mongoose.model("Card", cardSchema);
