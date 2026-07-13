# Roots Recruitment Dashboard — Setup Guide

## 1. Install Dependencies

```bash
cd recruitment-dashboard
npm install
```

---

## 2. Create Firebase Project (free, ~5 min)

### a) Create Project
1. Go to [firebase.google.com](https://firebase.google.com) → **Get started**
2. Click **Add project** → name it (e.g., `roots-recruitment`) → Continue
3. Disable Google Analytics (not needed) → **Create project**

### b) Create Realtime Database
1. In the left sidebar → **Build** → **Realtime Database**
2. Click **Create Database**
3. Choose your region (e.g., `us-central1`)
4. Choose **Start in test mode** (allows read/write for 30 days — good for internal tools)
5. Click **Enable**

> **Security note:** For a private internal tool, test mode is fine. After 30 days you can extend access via the Rules tab.

### c) Get Config Keys
1. Click the **gear icon** (Project Settings) → **General** tab
2. Scroll to **Your apps** → Click **</>** (Web) → Register app → name it `dashboard`
3. You'll see a `firebaseConfig` object — **copy all the values**

---

## 3. Create Resend Account (free, ~2 min)

1. Go to [resend.com](https://resend.com) → **Sign up**
2. In the dashboard → **API Keys** → **Create API Key**
3. Name it `recruitment-dashboard` → **Full access** → **Add**
4. Copy the key (starts with `re_`)

> **Sending domain:** For testing, emails come from `onboarding@resend.dev` (Resend's test address). For production, verify your own domain at Resend → **Domains** and update `FROM_EMAIL` in your `.env`.

---

## 4. Configure Environment Variables

1. Copy the template:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and paste your values:

   ```env
   # From Firebase Project Settings → Your Apps → SDK setup
   REACT_APP_FIREBASE_API_KEY=AIzaSy...
   REACT_APP_FIREBASE_AUTH_DOMAIN=roots-recruitment.firebaseapp.com
   REACT_APP_FIREBASE_DATABASE_URL=https://roots-recruitment-default-rtdb.firebaseio.com
   REACT_APP_FIREBASE_PROJECT_ID=roots-recruitment
   REACT_APP_FIREBASE_STORAGE_BUCKET=roots-recruitment.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
   REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123

   # From Resend dashboard → API Keys
   RESEND_API_KEY=re_yourKeyHere
   ```

   > Find `REACT_APP_FIREBASE_DATABASE_URL` in the Realtime Database page — it looks like `https://your-project-default-rtdb.firebaseio.com`

---

## 5. Run the App

```bash
npm start
```

This launches both:
- **React app** at http://localhost:3000 (opens automatically)
- **Email server** at http://localhost:3001

---

## 6. Share with Your Team

While running locally, share via [ngrok](https://ngrok.com):
```bash
ngrok http 3000
```
Everyone with the link sees the same data (Firebase syncs in real-time).

---

## 7. Deploy to Firebase Hosting (Optional, Free)

```bash
npm install -g firebase-tools
firebase login
npm run build
firebase init hosting     # set public dir to "build", SPA: yes
firebase deploy
```

You'll get a `https://your-project.web.app` URL to share permanently.

> **Important:** Add your production URL to Firebase's authorized domains (Project Settings → Authentication → Authorized domains) if you add auth later.

---

## CSV Format

Download the template from the **Upload Apps** tab. Expected columns:

| Column | Required | Notes |
|--------|----------|-------|
| Name | Yes | Matched to coffee chats by name |
| Email | Yes | Used for email sending |
| Grade | No | e.g., Freshman, Sophomore, Junior, Senior |
| First Choice | No | Team name |
| Second Choice | No | Team name |
| Third Choice | No | Team name |
| Fourth Choice | No | Team name |
| *Any other column* | No | Treated as a free response answer |
| Resume | No | URL or file path |

---

## Keyboard Shortcuts (Review Mode)

| Key | Action |
|-----|--------|
| `←` or `↑` | Previous applicant |
| `→` or `↓` | Next applicant |
| `1` | Mark Interview |
| `2` | Mark Revisit |
| `3` | Mark Reject |
