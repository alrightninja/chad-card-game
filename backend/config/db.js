const mongoose = require("mongoose");

async function connectOnce() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected successfully");
}

function connectDB() {
  connectOnce().catch((err) => {
    console.error("MongoDB connection error:", err.message);
    console.error("Retrying in 8s. Check Atlas IP allowlist and MONGO_URI.");
    setTimeout(connectDB, 8000);
  });
}

module.exports = connectDB;
