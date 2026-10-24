require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const contactRoute = require("./routes/contact");
const oauthRoute = require("./routes/oauth");

const app = express();

// Remove fingerprinting header
app.disable("x-powered-by");

// Strict CORS allowlist
const ALLOWED_ORIGINS = [
  process.env.ALLOWED_ORIGIN || "https://theoriginlab.in",
  "https://theoriginlab.in",
  "https://www.theoriginlab.in",
  "http://localhost:8000",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl) only in dev
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// Request size limit — prevents large payload abuse
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));

// Cookie parser needed for OAuth state cookie
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("ORIGIN Lab backend is running.");
});

app.use("/api/contact", contactRoute);
app.use("/auth", oauthRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ORIGIN Lab backend listening on port ${PORT}`);
});
