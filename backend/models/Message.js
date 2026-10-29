const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, maxlength: 500 }
  },
  { timestamps: true }
);

MessageSchema.index({ from: 1, to: 1, createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema);
