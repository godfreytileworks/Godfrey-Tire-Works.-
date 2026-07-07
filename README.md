# Godfrey's Tile Works — Getting Fully Live

This folder is a complete, working backend + website. Once you create a few
accounts below and drop the keys into one file, everything on the site
becomes real: the quote form texts + emails you, the chat widget is a real
AI, and your phone number can be answered by AI for both calls and texts.

I can't create these accounts for you — they need your name, billing info,
and phone number to sign up. Everything below is in the order to do it in.
None of it requires you to write code; you're just creating accounts and
copy-pasting keys into one file (`.env`).

---

## 1. Accounts you need to create

| # | Service | What it's for | Rough cost |
|---|---------|---------------|------------|
| 1 | [console.anthropic.com](https://console.anthropic.com) | Powers the AI (chat, phone, text) | Pay-as-you-go, a few cents per conversation — a few dollars a month for a small business |
| 2 | [twilio.com](https://twilio.com) | Gives you a phone number the AI can answer calls & texts on | ~$1.15/mo for the number + ~1¢/min for calls, ~1¢/text |
| 3 | A Gmail account (can be your existing one) | Sends you email notifications | Free |
| 4 | [render.com](https://render.com) | Hosts this backend so it's live 24/7 | Free tier works to start; ~$7/mo for always-on (recommended once you're using it for real) |
| 5 | A domain registrar (Namecheap, Google Domains, GoDaddy, etc.) | So the site is at `godfreystileworks.com` instead of a Render URL | ~$12/yr |

Do them in that order — each one below tells you exactly what to copy into `.env`.

---

## 2. Anthropic (the AI)

1. Go to console.anthropic.com → sign up → add a payment method under **Billing**.
2. Go to **API Keys** → **Create Key**. Copy it.
3. Paste it into `.env` as `ANTHROPIC_API_KEY`.

## 3. Twilio (phone number for calls + texts)

1. Go to twilio.com → sign up → verify your identity.
2. Buy a phone number: **Phone Numbers → Buy a Number**. Search `559` to get
   a local Fresno-area number (or keep your existing (559) 567-1460 if it's
   already a cell number — see the note at the bottom about porting it in).
3. From the Twilio Console home page, copy your **Account SID** and
   **Auth Token** into `.env` as `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
4. Put the number you bought into `.env` as `TWILIO_PHONE_NUMBER`
   (format: `+15595671460`).
5. **You'll come back here after deploying (step 6)** to point the number at
   your live backend.

## 4. Gmail notifications

1. On the Gmail account you want notifications sent *from*, turn on
   2-Step Verification (Google Account → Security).
2. Go to **Google Account → Security → App Passwords**, create one for "Mail".
3. Put that Gmail address into `.env` as `GMAIL_USER`, and the app password
   (16 characters, no spaces) as `GMAIL_APP_PASSWORD`.
4. Put the address you actually want to *receive* leads at into
   `OWNER_EMAIL` (can be the same address or different).
5. Put your cell number into `OWNER_PHONE` — this is where lead texts land.

## 5. Fill in `.env`

Copy `.env.example` to a new file named `.env` in this same folder, and fill
in every value using what you collected above.

## 6. Deploy to Render (makes it live 24/7)

1. Put this whole folder in a GitHub repository (Render deploys from GitHub).
   If you don't use GitHub yet, Render has a guided "create repo" flow, or
   ask a technical friend for 10 minutes of help with this one step.
2. On render.com: **New → Web Service** → connect your GitHub repo.
3. Settings: **Build command:** `npm install` — **Start command:** `npm start`
4. Under **Environment**, add every variable from your `.env` file
   (Render does not read the `.env` file itself — you paste each value in).
5. Deploy. Render gives you a live URL like `https://gtw-backend.onrender.com`.

## 7. Point Twilio at your live backend

Back in Twilio: **Phone Numbers → your number → Configure**:
- **A call comes in:** Webhook → `https://YOUR-RENDER-URL/voice` → HTTP POST
- **Call status changes:** `https://YOUR-RENDER-URL/voice/status` → HTTP POST
- **A message comes in:** Webhook → `https://YOUR-RENDER-URL/sms` → HTTP POST

Save. Call the Twilio number from your own phone to test the AI answering.
Text it to test the AI texting back.

## 8. Connect your domain

1. Buy the domain (e.g. `godfreystileworks.com`) at any registrar.
2. In Render, go to your service → **Settings → Custom Domain** → add it.
3. Render gives you a DNS record to add at your registrar. Add it there.
4. Give DNS a few hours to update, then the domain points at your live site.

---

## About your existing number, (559) 567-1460

If that's your personal cell and you want to keep answering it yourself
sometimes, you don't have to hand it to Twilio. Two options:
- **Easiest:** buy a *second*, new Twilio number just for AI-answered calls/
  texts, and advertise that one for after-hours / overflow, while you keep
  using your cell as normal.
- **Full automation:** "port" your existing number into Twilio (Twilio has a
  guided porting flow) so all calls/texts to it go through the AI, with the
  option to forward straight to your cell during business hours if you want
  a human to pick up first.

Start with a second number while you get comfortable with how the AI
handles real calls — you can always port your main number in later once
you trust it.

## Testing checklist once deployed

- [ ] Submit the quote form on the live site → you get a text AND an email
- [ ] Open the chat widget → ask "how much does this cost" → get a real AI answer
- [ ] Call the Twilio number → AI answers and has a natural conversation
- [ ] Text the Twilio number → AI texts back
- [ ] Give the AI a fake name + phone number on a call or text → you get notified
- [ ] Visit the live site on your phone → an "Install App" button appears in the nav (Android/Chrome) or use Safari's "Add to Home Screen" (iPhone) → the site opens full-screen with its own icon, like a real app

## About the "app"

This site is a Progressive Web App (PWA): the same website, but once it's
live at a real URL, phones can install it to the home screen with its own
icon, and it opens full-screen without browser address bars, like a normal
app. It also keeps working (browsing only, not the form/chat/AI) if the
connection drops. This only works once the site is actually hosted online —
a PWA can't install from a file sitting on a computer; installability
requires being served over HTTPS, which Render gives you automatically.

There's no separate iOS/Android app-store app here — that's a much bigger,
separate project (Apple/Google developer accounts, app review, etc.). A PWA
gets you 90% of the "app" feeling with none of that overhead, and is the
right move unless you specifically want to be listed in the App Store.
