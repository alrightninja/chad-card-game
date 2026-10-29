const mongoose = require("mongoose");
const Card = require("./models/Card");
const cards = require("./cards.json");
require("dotenv").config(); // Make sure .env is loaded

async function seed() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected!");

    // 1. Clear old cards
    console.log("Removing old cards...");
    await Card.deleteMany({});

    // 2. Insert new cards
    console.log("Inserting new cards...");
    await Card.insertMany(cards, { ordered: false });

    console.log("Cards inserted successfully!");
  } catch (err) {
    console.error("Error during seeding:", err);
  } finally {
    await mongoose.connection.close();
    console.log("Done. Connection closed.");
  }
}

seed();
