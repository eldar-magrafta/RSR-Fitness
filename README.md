# RSR Fitness

A Progressive Web App for tracking workouts, body weight, nutrition, and personal records — built with zero dependencies and synced to the cloud via Firebase.

**Live app:** [eldar-magrafta.github.io/RSR-Fitness](https://eldar-magrafta.github.io/RSR-Fitness/)

---

## Features

### Exercises
- Browse exercises organized by muscle group, each with an animated GIF demo, technique tips, and a YouTube link
- Per-exercise notes (auto-saved, synced to cloud)
- Global search across all exercises and per-group search within a muscle group

### Workout Plans
- Create named plans and add exercises from the full library
- Add section titles to organize a plan into blocks (e.g. "Warm-up", "Main")
- Drag-to-reorder exercises within a plan
- Long-press a plan to delete it; swipe-up sheet to remove individual exercises

### Exercise Logging & History
- Log multiple sets (weight + reps) per exercise session
- Calendar-based history view — tap any past date to review or edit its entry
- Chart showing weight progression over time (30 / 90 / 180 / 365-day range)
- Delete a single entry or clear the full history for any exercise

### Personal Records
- Automatic PR detection on every save — a toast fires if a new best weight is hit
- PR cache rebuilt from full history at startup so it's always accurate
- Per-exercise PR displayed in the exercise detail modal

### Body Weight Tracking
- Daily weight log with optional progress photo per entry
- Trend chart (30 / 60 / 90-day range) with min/avg/max stats
- Monthly calendar with colour-coded dots per logged day
- Progress photos stored as individual Firestore documents (stays within the free tier); cached locally in IndexedDB for offline access

### Nutrition Lab
- **Today view** — log meals for a specific date using a calendar picker
- **Saved meals view** — browse, favourite, duplicate, and re-use saved meal templates
- Add ingredients by weight (grams) from a built-in database of 100+ foods
- Create custom ingredients with full macro profiles and an optional photo
- SVG macro pie chart (protein / carbs / fat) per meal
- Daily macro goals with per-date overrides that inherit forward (set once, applies to future dates until changed)
- Sort meals by date, name, or calories; filter to favourites only
- Meal photos stored and synced the same way as body weight photos

### Activity Summary
- Weekly and monthly overview: workout count, unique exercises, total sets
- Body weight trend chart for the period
- Top 5 most-trained exercises by set count
- Daily macro progress for each day in the period

### App-wide
- Dark / Light theme toggle (persisted in localStorage)
- Cloud sync status indicator in the header (green dot = synced, red = error)
- Sign out confirmation sheet

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Vanilla JavaScript (ES Modules) |
| Markup / Styling | HTML5, CSS3 with custom properties |
| Auth | Firebase Authentication (Google OAuth + email/password) |
| Database | Cloud Firestore |
| Offline | Service Worker (network-first strategy) |
| Local persistence | localStorage + IndexedDB (photos) |
| Hosting | GitHub Pages |
| Build tooling | None — no bundler, no transpiler |

---

## Architecture & Data Flow

```
User Action
    │
    ▼
Module (exercises.js / nutrition.js / etc.)
    │  reads/writes via
    ▼
store.js  ──────────────────────────────────► localStorage
    │  every write also calls _cloudSave()
    ▼
cloud.js  ──────────────────────────────────► Firestore
    │  photos go through storage.js first
    ▼
storage.js  ────────► IndexedDB cache  ──────► Firestore (one doc per photo)
```

**Key design decisions:**

- `store.js` is the single data access layer. No module reads `localStorage` directly — everything goes through `store.js` exports.
- `cloud.js` registers itself with `store.js` via `setCloudSaver()` to avoid a circular import. `store.js` knows nothing about Firebase.
- Rapid writes (notes, ingredient gram adjustments) are debounced at 900 ms before hitting Firestore to avoid write storms.
- Photos are stored as individual Firestore documents (one per date) rather than embedded in the main body weight document. This keeps the main document small and stays within Firestore free-tier limits.
- IndexedDB caches every photo locally so the app renders photos instantly on repeat visits without a Firestore read.

---

## Firestore Data Model

All user data lives under `users/{uid}/`:

```
users/{uid}/
  sections/
    plans           → { value: JSON }   # workout plans array
    bodyweight      → { value: JSON }   # weight entries map (date → {w, p})
    meals           → { value: JSON }   # meals array
    prs             → { value: JSON }   # personal records map
    macrogoalsmap   → { value: JSON }   # date-keyed macro goals
    customings      → { value: JSON }   # custom ingredients array
  exhist/
    {exerciseName}  → { value: JSON }   # date-keyed log for one exercise
  notes/
    {exerciseName}  → { value: string } # freetext notes for one exercise
  bw-photos/
    {date}          → { value: base64 } # one doc per progress photo
  meal-photos/
    {mealId}        → { value: base64 } # one doc per meal photo
```

---

## Project Structure

```
RSR-Fitness/
├── index.html              # Single-page app shell — all views, sheets, modals
├── manifest.json           # PWA manifest (name, icons, display mode)
├── sw.js                   # Service Worker — network-first, manual cache versioning
├── .nojekyll               # Prevents GitHub Pages from running Jekyll
│
├── css/
│   ├── base.css            # Reset, CSS variables, layout, tabs, header, FAB, theme
│   ├── exercises.css       # Muscle grid, exercise list, exercise detail modal
│   ├── plans.css           # Plan list, plan detail, exercise picker, drag handles
│   ├── modals.css          # Shared modal and bottom-sheet styles
│   ├── bodyweight.css      # Weight chart, calendar, entry sheet, photo viewer
│   ├── nutrition.css       # Meal list, ingredient picker, macro goals, pie chart
│   ├── summary.css         # Activity summary overlay and charts
│   └── auth.css            # Sign-in / register / forgot-password screens
│
├── js/
│   ├── app.js              # Entry point: imports all modules, tab switching, window globals
│   ├── state.js            # Single shared mutable UI state object
│   ├── store.js            # All localStorage read/write; triggers cloud sync on every save
│   ├── cloud.js            # Firebase init, Auth, Firestore read/write, sync indicator
│   ├── storage.js          # Photo storage: IndexedDB cache + Firestore doc-per-photo
│   ├── navigation.js       # View switching, back-button logic, header management
│   ├── auth.js             # Auth screens, sign-in/register/forgot-password handlers
│   ├── exercises.js        # Muscle grid, exercise list, detail modal, logging, search
│   ├── plans.js            # Plan CRUD, exercise picker, drag-to-reorder, section titles
│   ├── history.js          # Exercise history chart, calendar, entry log sheet
│   ├── bodyweight.js       # Weight chart, calendar, entry sheet, photo viewer
│   ├── nutrition.js        # Meals, ingredient picker, custom foods, macro goals, calendar
│   ├── prs.js              # PR detection, cache rebuild, PR display in exercise modal
│   ├── summary.js          # Weekly/monthly activity summary overlay
│   ├── utils.js            # Shared helpers (date formatting, macro calc, HTML escaping)
│   └── firebase-config.js  # Firebase project config (API key, project ID, etc.)
│
└── data/
    ├── exercises.js        # Full exercise database keyed by muscle group
    └── ingredients.js      # Ingredient database (~100+ foods, macros per 100 g)
```

---

## Local Development

No build step required. Serve from any static file server:

```bash
npx serve .
# or
python -m http.server 8080
```

Then open `http://localhost:3000` (or whichever port the server reports).

> A local server is required because ES Modules are blocked by browsers on `file://` URLs.

---

## Firebase Setup

The app ships with the project's own Firebase config (`js/firebase-config.js`). If you are forking this for your own use, you will need to replace it:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → Sign-in providers: Google and Email/Password
3. Enable **Firestore Database** in production mode
4. Add your domain (e.g. `yourusername.github.io`) to **Authentication → Authorized domains**
5. Replace the contents of `js/firebase-config.js` with your project's web app config:

```js
export const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

**Recommended Firestore security rules:**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## PWA & Offline

The Service Worker (`sw.js`) pre-caches all app shell files on install and uses a **network-first** strategy at runtime:

- On every request it tries the network first and updates the cache with the fresh response
- If the network fails it falls back to the cached version
- The cache is versioned (`trainer-v24`). Bumping this string on deploy busts the old cache and forces clients to download fresh assets

To install the app: open it in Chrome or Safari on mobile and choose **Add to Home Screen**. The app will launch in standalone mode (no browser chrome).

---

## Data Migrations

Several one-time migrations run automatically at startup to handle schema evolution:

| Function | What it does |
|---|---|
| `migrateOldExLogs()` | Converts single-entry exercise logs (`trainer_ex_*`) to date-keyed history (`trainer_exhist_*`) |
| `migrateMacroGoalsToMap()` | Converts old flat macro goals + skip-log into the new date-keyed goals map |
| `migratePhotosToStorage()` | Extracts base64 photos embedded in the body weight document into individual Firestore photo documents |

Each migration guards itself with a localStorage flag so it runs only once per device.

---

## Credits

Built by **Eldar Magrafta**. © 2026 Eldar Magrafta. All rights reserved.
