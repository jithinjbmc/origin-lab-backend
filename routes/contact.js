const express = require("express");

const router = express.Router();

// Very simple in-memory rate limiter: max 5 submissions per IP per hour
const submissions = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const entry = submissions.get(ip) || [];
  const recent = entry.filter((t) => now - t < windowMs);
  recent.push(now);
  submissions.set(ip, recent);
  return recent.length > 5;
}

router.post("/", async (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    if (isRateLimited(ip)) {
      return res.status(429).json({ error: "Too many submissions. Please try again later." });
    }

    const { name, email, institution, subject, message, inquiryType, website } = req.body;

    // Honeypot field: real users never fill this in. Bots often do.
    if (website) {
      return res.status(200).json({ success: true }); // silently drop, pretend success
    }

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email, and message are required." });
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    const toAddress = process.env.CONTACT_TO_EMAIL;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ORIGIN Lab Website <onboarding@resend.dev>",
        to: [toAddress],
        reply_to: email,
        subject: `[ORIGIN Lab Contact] ${subject || inquiryType || "New inquiry"} — from ${name}`,
        text: `Name: ${name}
Email: ${email}
Institution: ${institution || "—"}
Inquiry type: ${inquiryType || "—"}
Subject: ${subject || "—"}

Message:
${message}`,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, errText);
      return res.status(502).json({ error: "Email service rejected the message. Please try again later." });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Contact form error:", err);
    res.status(500).json({ error: "Something went wrong sending your message. Please try again." });
  }
});

module.exports = router;
