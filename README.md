# ORIGIN Lab Backend

Handles two things GitHub Pages can't do on its own:

1. **Contact form** — receives submissions from theoriginlab.in and emails them to you.
2. **Decap CMS login** — lets you log into `/admin` on your site and edit content without touching HTML.

## Deploy to Render (one-time setup)

1. Push this folder to a **new** GitHub repo, e.g. `origin-lab-backend` (same process as before: `git init`, `git add .`, `git commit`, `git remote add origin ...`, `git push`).
2. On [render.com](https://render.com), click **New > Web Service**, connect this repo.
3. Settings:
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: Free
4. Add environment variables (Render dashboard > Environment) — copy the names from `.env.example`, fill in real values:
   - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — from a GitHub OAuth App you create at https://github.com/settings/developers
     - Homepage URL: `https://www.theoriginlab.in`
     - Callback URL: `https://YOUR-RENDER-URL.onrender.com/auth/callback`
   - `EMAIL_USER`, `EMAIL_PASS` — a Gmail address + App Password (not your normal password): https://myaccount.google.com/apppasswords
   - `CONTACT_TO_EMAIL` — where contact form submissions should land
   - `ALLOWED_ORIGIN` — `https://www.theoriginlab.in`
5. Deploy. Render gives you a URL like `https://origin-lab-backend.onrender.com`.
6. Go back to your **frontend** repo (`origin-lab-website`) and update every place that currently says
   `https://origin-lab-backend.onrender.com` (in `assets/js/main.js` and `admin/config.yml`)
   to match your **actual** Render URL, if it differs from this placeholder.

## Note on the free tier

This sleeps after 15 minutes of no traffic. The first contact-form submission or admin login after a quiet period takes 30–60 seconds to respond while it wakes up — normal, not a bug.
