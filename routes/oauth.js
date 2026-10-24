// Hardened GitHub OAuth provider for Decap CMS.
// Fixes: scope narrowed to public_repo, origin validation, no OAuth state needed for Decap popup flow.

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// Only deliver the OAuth token back to these origins
const ALLOWED_ORIGINS = [
  "https://theoriginlab.in",
  "https://www.theoriginlab.in",
];

router.get("/", (req, res) => {
  // Generate a random state to protect against CSRF
  const state = crypto.randomBytes(16).toString("hex");
  // Store state in a short-lived, HttpOnly, Secure cookie
  res.cookie("oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 10 * 60 * 1000, // 10 minutes
  });

  const redirectUri = `https://${req.get("host")}/auth/callback`;
  // public_repo is sufficient for a public static site CMS
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=public_repo&state=${state}`;
  res.redirect(githubAuthUrl);
});

router.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  // Validate CSRF state
  const savedState = req.cookies?.oauth_state;
  if (!state || !savedState || state !== savedState) {
    return res.status(403).send("Invalid OAuth state. Possible CSRF attempt.");
  }
  // Clear the state cookie immediately
  res.clearCookie("oauth_state");

  try {
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code },
      { headers: { Accept: "application/json" } }
    );

    const token = tokenResponse.data.access_token;
    if (!token) {
      return res.status(400).send("Authorization failed: no token returned by GitHub.");
    }

    // Only send the token to known-safe origins
    const allowedOriginsJson = JSON.stringify(ALLOWED_ORIGINS);
    const payload = JSON.stringify({ token, provider: "github" });

    // CSP: lock down what this response page can do
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store");

    const script = `<!DOCTYPE html>
<html><body><script>
(function() {
  var ALLOWED = ${allowedOriginsJson};
  function receiveMessage(e) {
    if (ALLOWED.indexOf(e.origin) === -1) return;
    window.opener.postMessage(
      "authorization:github:success:" + JSON.stringify(${payload}),
      e.origin
    );
    window.removeEventListener("message", receiveMessage, false);
  }
  window.addEventListener("message", receiveMessage, false);
  // Notify opener that we're ready — only to allowed origins
  ALLOWED.forEach(function(origin) {
    try { window.opener.postMessage("authorizing:github", origin); } catch(e) {}
  });
})();
<\/script></body></html>`;
    res.send(script);
  } catch (err) {
    console.error("OAuth callback error:", err.response ? err.response.data : err.message);
    res.status(500).send("Authorization failed.");
  }
});

module.exports = router;
