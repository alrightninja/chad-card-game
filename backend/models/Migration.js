const mongoose = require("mongoose");

const MigrationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    appliedAt: { type: Date, default: Date.now },
    result: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Migration", MigrationSchema);
