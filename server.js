require("dotenv").config();
const express = require("express");
const cors = require("cors");

const contactRoute = require("./routes/contact");
const oauthRoute = require("./routes/oauth");

const app = express();

// Only allow requests from your actual site (and localhost, for testing)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://www.theoriginlab.in";
app.use(
  cors({
    origin: [ALLOWED_ORIGIN, "https://theoriginlab.in", "http://localhost:8000"],
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("ORIGIN Lab backend is running.");
});

app.use("/api/contact", contactRoute);
app.use("/auth", oauthRoute); // Decap CMS GitHub OAuth: /auth and /auth/callback

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ORIGIN Lab backend listening on port ${PORT}`);
});
