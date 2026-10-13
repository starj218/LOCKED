
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve index.html, style.css, and game.js from this folder.
app.use(express.static(__dirname));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", game: "LOCKED" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LOCKED is running on port ${PORT}`);
});
