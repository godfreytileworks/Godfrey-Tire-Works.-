// Godfrey's Tile Works — backend
// Handles: (1) quote form -> text + email to owner, (2) AI website chat,
// (3) AI phone answering (Twilio Voice), (4) AI text answering (Twilio SMS)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Twilio posts form-encoded data
app.use(express.static(path.join(__dirname, 'public')));

// ---------- CONFIG ----------
const {
  OWNER_PHONE,          // where lead texts get sent, e.g. +15595671460
  OWNER_EMAIL,          // where lead emails get sent
  GMAIL_USER,           // the Gmail address sending notifications
  GMAIL_APP_PASSWORD,   // Gmail "App Password" (not your normal password)
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,  // the business Twilio number, e.g. +15595671460
  ANTHROPIC_API_KEY,
  PORT = 3000,
} = process.env;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const twilioClient = (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN)
  ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

// ---------- BUSINESS BRAIN (shared by chat, phone, and text) ----------
const BUSINESS_CONTEXT = `
You are the assistant for Godfrey's Tile Works, a pool tile & fountain cleaning business.
Owner's business phone: (559) 567-1460.

WHAT WE DO: pool tile cleaning, spa tile cleaning, fountain/water feature cleaning,
calcium and scale removal, using abrasive media blasting (NOT acid — this matters, say it
when relevant, because acid can damage tile/grout and our method doesn't).

WHAT WE DO NOT DO: we do not repair grout, and we do not install or replace tile. If asked,
say so plainly and offer to have the owner recommend someone for that specific part.

PRICING: we never quote a specific price. Every job gets a free in-person walkthrough and a
straight quote before any work starts, because price depends on pool size, tile type, and how
bad the buildup is. Never make up a number.

TONE: warm, plain-spoken, honest, no hard selling. This is a small local family business, not
a franchise. It's locally owned, guarantees its work, and cares more about doing right by the
customer than about growing fast.

SERVICE AREA: the local Central Valley community around the business's (559) area code.

GOAL OF EVERY CONVERSATION: get the person's name, phone number, address/city, and what they
need cleaned, so the owner can follow up and schedule a free walkthrough. Ask for these
naturally, one or two at a time, don't interrogate. Once you have a name and phone number,
tell them the owner will follow up shortly.

Keep replies short. On phone calls, replies must sound natural when spoken out loud — no lists,
no markdown, no asterisks. On text messages, keep replies to 1-3 sentences.
`.trim();

async function askClaude(systemExtra, history, userMessage) {
  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: BUSINESS_CONTEXT + '\n\n' + systemExtra,
    messages: [...history, { role: 'user', content: userMessage }],
  });
  const textBlock = resp.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : "Sorry, could you say that again?";
}

// ---------- LEAD NOTIFICATIONS (text + email to the owner) ----------
async function notifyOwner({ source, summary }) {
  const body = `[${source}] ${summary}`;

  if (twilioClient && OWNER_PHONE && TWILIO_PHONE_NUMBER) {
    try {
      await twilioClient.messages.create({
        from: TWILIO_PHONE_NUMBER,
        to: OWNER_PHONE,
        body: body.slice(0, 1500),
      });
    } catch (e) { console.error('Owner SMS notify failed:', e.message); }
  }

  if (GMAIL_USER && GMAIL_APP_PASSWORD && OWNER_EMAIL) {
    try {
      await mailer.sendMail({
        from: GMAIL_USER,
        to: OWNER_EMAIL,
        subject: `New lead — ${source} — Godfrey's Tile Works`,
        text: summary,
      });
    } catch (e) { console.error('Owner email notify failed:', e.message); }
  }
}

// ---------- 1) QUOTE / BOOKING FORM ----------
app.post('/api/quote', async (req, res) => {
  const { name, phone, address, service, day, window, message } = req.body;
  if (!name || !phone) return res.status(400).json({ ok: false, error: 'Name and phone are required.' });

  const summary =
`New quote request from the website:
Name: ${name}
Phone: ${phone}
Address: ${address || '-'}
Service: ${service || '-'}
Requested day/window: ${day || '-'} / ${window || '-'}
Notes: ${message || '-'}`;

  await notifyOwner({ source: 'Website form', summary });
  res.json({ ok: true });
});

// ---------- 2) WEBSITE AI CHAT ----------
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ ok: false, error: 'Missing message.' });

    const reply = await askClaude(
      'You are replying in a website chat widget.',
      history.slice(-10),
      message
    );

    // Simple lead trigger: if a phone number shows up anywhere in the conversation, notify the owner.
    const phoneMatch = (message + JSON.stringify(history)).match(/(\+?1?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
    if (phoneMatch) {
      await notifyOwner({
        source: 'Website chat',
        summary: `A website visitor shared a phone number in chat: ${phoneMatch[0]}\nLast message: "${message}"`,
      });
    }

    res.json({ ok: true, reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Something went wrong.' });
  }
});

// ---------- 3) AI PHONE ANSWERING (Twilio Voice) ----------
const callMemory = new Map(); // CallSid -> [{role, content}]

app.post('/voice', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const gather = twiml.gather({
    input: 'speech',
    action: '/voice/respond',
    method: 'POST',
    speechTimeout: 'auto',
  });
  gather.say(
    { voice: 'Polly.Joanna' },
    "Thanks for calling Godfrey's Tile Works, your local grime fighter. What can I help you with?"
  );
  twiml.say({ voice: 'Polly.Joanna' }, "Sorry, I didn't catch that.");
  twiml.redirect('/voice');
  res.type('text/xml').send(twiml.toString());
});

app.post('/voice/respond', async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = req.body.CallSid;
  const speech = req.body.SpeechResult || '';
  const history = callMemory.get(callSid) || [];

  try {
    const reply = await askClaude(
      'You are speaking on a live phone call. Keep it short and natural.',
      history,
      speech || '(caller was silent)'
    );

    history.push({ role: 'user', content: speech || '(silent)' });
    history.push({ role: 'assistant', content: reply });
    callMemory.set(callSid, history.slice(-12));

    // Lead capture: notify owner if a phone number is mentioned on the call
    const phoneMatch = speech.match(/(\+?1?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
    if (phoneMatch) {
      await notifyOwner({ source: 'Phone call', summary: `Caller shared a phone number on a call: ${phoneMatch[0]}\nThey said: "${speech}"` });
    }

    const gather = twiml.gather({
      input: 'speech',
      action: '/voice/respond',
      method: 'POST',
      speechTimeout: 'auto',
    });
    gather.say({ voice: 'Polly.Joanna' }, reply);
    twiml.say({ voice: 'Polly.Joanna' }, "Thanks for calling — we'll follow up soon. Goodbye!");
  } catch (e) {
    console.error(e);
    twiml.say({ voice: 'Polly.Joanna' }, "Sorry, we're having trouble right now. Please call back or text this number.");
  }

  res.type('text/xml').send(twiml.toString());
});

app.post('/voice/status', (req, res) => {
  if (req.body.CallSid) callMemory.delete(req.body.CallSid);
  res.sendStatus(200);
});

// ---------- 4) AI TEXT ANSWERING (Twilio SMS) ----------
const smsMemory = new Map(); // phone number -> [{role, content}]

app.post('/sms', async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body || '';
  const history = smsMemory.get(from) || [];

  const twiml = new twilio.twiml.MessagingResponse();
  try {
    const reply = await askClaude(
      'You are replying by text message. Keep it to 1-3 short sentences.',
      history,
      body
    );
    history.push({ role: 'user', content: body });
    history.push({ role: 'assistant', content: reply });
    smsMemory.set(from, history.slice(-12));

    twiml.message(reply);

    await notifyOwner({
      source: 'Text message',
      summary: `From: ${from}\nThey texted: "${body}"\nAI replied: "${reply}"`,
    });
  } catch (e) {
    console.error(e);
    twiml.message("Sorry, we're having trouble right now — call (559) 567-1460 directly.");
  }

  res.type('text/xml').send(twiml.toString());
});

app.listen(PORT, () => console.log(`Godfrey's Tile Works backend running on port ${PORT}`));
