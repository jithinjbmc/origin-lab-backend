// Minimal GitHub OAuth provider for Decap CMS (github backend).
// Flow: /auth -> redirects to GitHub -> GitHub redirects back to /auth/callback
// -> exchanges code for token -> posts it back to the CMS popup window via postMessage.

const express = require("express");
const axios = require("axios");

const router = express.Router();

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

router.get("/", (req, res) => {
  // Always use https — Render terminates SSL at a proxy, so req.protocol
  // can incorrectly report "http" even though the public URL is https.
  const redirectUri = `https://${req.get("host")}/auth/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=repo,user`;
  res.redirect(githubAuthUrl);
});

router.get("/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } }
    );

    const token = tokenResponse.data.access_token;

    if (!token) {
      return res.status(400).send("Authorization failed: no token returned by GitHub.");
    }

    // Decap CMS expects a postMessage back to the popup window that opened this flow.
    const payload = JSON.stringify({ token, provider: "github" });
    const script = `
      <script>
        (function() {
          function receiveMessage(e) {
            window.opener.postMessage(
              "authorization:github:success:" + JSON.stringify(${payload}),
              e.origin
            );
            window.removeEventListener("message", receiveMessage, false);
          }
          window.addEventListener("message", receiveMessage, false);
          window.opener.postMessage("authorizing:github", "*");
        })();
      </script>
    `;
    res.send(script);
  } catch (err) {
    console.error("OAuth callback error:", err.response ? err.response.data : err.message);
    res.status(500).send("Authorization failed. Check server logs.");
  }
});

module.exports = router;
