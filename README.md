# 💧 Water Refill

Tiny office app: anyone reports an empty water can, the refill person sees it live, replaces the can, and taps **Done**.

- **Request** tab: enter location (remembered) → "Request refill". Shows live pending list.
- **Refill staff** tab (also at `/#staff`): optional PIN, live list, sound + vibration + browser notification on new requests, **Done** button.

Stack: Vite + React + Firebase Firestore (frontend only) → deploy on Vercel.

## 1. Firebase setup (5 min)

1. https://console.firebase.google.com → **Add project**.
2. **Build → Firestore Database → Create database** (production mode).
3. **Project settings → Your apps → Web (`</>`)** → register app → copy the config values.
4. Firestore → **Rules** tab → paste contents of `firestore.rules` → **Publish**.

## 2. Run locally

```bash
cp .env.example .env     # fill in the Firebase values (+ optional VITE_STAFF_PIN)
npm install
npm run dev
```

## 3. Deploy to Vercel

1. Push this folder to GitHub.
2. https://vercel.com → **Add New → Project** → import the repo (Vite is auto-detected).
3. Add the same `VITE_*` variables under **Settings → Environment Variables**.
4. Deploy, then share the URL with the office. The refill person bookmarks `<url>/#staff` (or "Add to Home Screen" on phone).

Or via CLI: `npx vercel --prod`.

## Notes

- `VITE_STAFF_PIN` only hides the staff screen in the UI; the Firestore rules are open so anyone with the URL could technically mark requests done. Fine for a small office. For stricter control, add Firebase Auth and tighten `firestore.rules`.
- Browser notifications only fire while the staff page is open in a tab (even in the background). For true push when closed, add Firebase Cloud Messaging.
