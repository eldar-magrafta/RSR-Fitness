# RSR Fitness

A Progressive Web App for tracking workouts, body weight, nutrition, hydration, and personal records — built with no bundler and no framework, synced to the cloud via Firebase.

**Live app:** [eldar-magrafta.github.io/RSR-Fitness](https://eldar-magrafta.github.io/RSR-Fitness/)

---

## Features

### Exercises
- Browse exercises organized by muscle group, each with an animated GIF demo, technique tips, and a YouTube link
- Per-exercise notes with an optional attached photo (auto-saved, synced to cloud)
- Global search across all exercises and per-group search within a muscle group
- **Custom exercises** — add your own exercise with a name, muscle group, and image; it appears in the library alongside the built-ins and works everywhere (plans, logging, history, PRs)

### Workout Plans
- Create named plans and add exercises from the full library
- Add section titles to organize a plan into blocks (e.g. "Warm-up", "Main")
- Drag-to-reorder exercises within a plan
- Long-press a plan to delete it; swipe-up sheet to remove individual exercises
- **AI plan generator** — describe what you want (days per week, experience level, focus muscle groups, available equipment, injuries to work around, freetext notes) and Gemini builds the plan. Output is constrained to exercises that actually exist in the library (including your custom ones), so every generated exercise renders with an image and links to real history. Preview, remove items, or regenerate before saving.

### Active Workout Session
- Start a session from any plan and walk it top-to-bottom
- Check off sets as you go; add, edit, or delete sets mid-session
- **Drop sets** — add multiple stages under a single set, each with its own weight/reps
- Rest timer between sets with adjust / pause / skip, auto-started based on your preference
- Screen Wake Lock keeps the phone awake during a session
- Session state is persisted, so a reload or app switch resumes exactly where you left off
- Live PR preview — the app flags a set that *would* be a new record before you save
- On Finish, everything is committed through the normal exercise-history pipeline

### Exercise Logging & History
- Log multiple sets (weight + reps) per exercise session
- Calendar-based history view — tap any past date to review or edit its entry
- Chart showing weight progression over time (30 / 90 / 180 / 365-day range)
- Delete a single entry or clear the full history for any exercise
- **Global Exercise Log** — one calendar across *all* exercises; tap a date to see everything trained that day

### Personal Records
- Automatic PR detection on every save — a toast fires if a new best weight is hit
- PR cache rebuilt from full history at startup so it's always accurate
- Per-exercise PR badge in the exercise detail modal
- Dedicated PRs view listing every record

### Body Weight Tracking
- Daily weight log with multiple optional progress photos per entry
- Trend chart (30 / 60 / 90-day range) with min/avg/max stats
- Monthly calendar with colour-coded dots per logged day
- **Weight goal** — set a target weight and track against it
- **BMI** — enter your height once and the app derives BMI from your latest weight
- Progress photos stored as individual Firestore documents (stays within the free tier); cached locally in IndexedDB for offline access

### Progress Photos
- **Gallery** — reverse-chronological timeline of every progress photo, with date and weight
- **Timelapse** — stitches all progress photos into a video (oldest → newest) using a canvas + `MediaRecorder` pipeline, with optional date/weight captions and slow / normal / fast speeds. Outputs MP4 where supported, WebM otherwise, and offers a direct download. No external libraries.

### Nutrition Lab
- **Diary view** — log meals for a specific date via a calendar picker, grouped under meal-time slots (breakfast / lunch / dinner / snack) with per-slot macro totals
- **Saved meals view** — browse, favourite, rename, duplicate, and re-use saved meal templates
- Add ingredients by weight (grams) from a built-in database of 100+ foods
- Create custom ingredients with full macro profiles and an optional photo
- **Barcode scanner** — scan a product barcode with the live camera or an uploaded photo (`BarcodeDetector`, with a WASM ponyfill fallback), look it up on OpenFoodFacts, and save it as a custom ingredient
- **AI meal from photo** — photograph a plate and Gemini identifies the ingredients and estimates portions, matched against the ingredient database
- SVG macro pie chart (protein / carbs / fat) per meal
- Daily macro goals with per-date overrides that inherit forward (set once, applies to future dates until changed)
- **Macro wizard** — derives calorie and macro targets from sex, age, weight, height, activity level, and goal
- Sort meals by date, name, or calories; filter to favourites only; copy a meal summary to the clipboard
- Meal photos stored and synced the same way as body weight photos

### Water Tracker
- Daily intake against a configurable litre target, with a configurable bottle size for one-tap logging
- Quick-add amounts, undo, and reset for the day
- Rolling 7-day history
- Stored locally only — this is the one feature that does not sync to the cloud

### Activity Summary
- Weekly and monthly overview: workout count, unique exercises, total sets
- Consistency heatmap anchored at your registration date, with a current-streak counter
- Body weight trend mini-chart for the period
- Average daily nutrition: calorie ring plus per-macro goal bars
- Top most-trained exercises by set count

### Muscle Group Balance
- Set counts per muscle group over the last week or month, so you can spot what you are under-training

### Data Export
- One-click export to a multi-sheet `.xlsx` workbook (body weight, meals, exercise history) via SheetJS

### App-wide
- Dark / Light theme toggle (synced across devices)
- Cloud sync status indicator in the header (green dot = synced, red = error)
- Preferences: default rest-timer length, auto-start rest timer
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
| AI | Google Gemini, proxied through a Cloudflare Worker |
| Food lookup | OpenFoodFacts API + `BarcodeDetector` (WASM ponyfill fallback) |
| Video | Canvas + `MediaRecorder` (no library) |
| Spreadsheet export | SheetJS (`xlsx.mini.min.js`, CDN) |
| Hosting | GitHub Pages |
| Build tooling | None — no bundler, no transpiler |

All third-party code is loaded from a CDN at runtime; there is no `package.json` and nothing to install.

---

## Architecture & Data Flow

```
User Action
    │
    ▼
Module (exercises.js / nutrition.js / session.js / etc.)
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

- `store.js` is the single data access layer. Modules do not read `localStorage` directly — everything goes through `store.js` exports. (`water.js` is the deliberate exception: it is local-only and owns its own keys.)
- `cloud.js` registers itself with `store.js` via `setCloudSaver()` to avoid a circular import. `store.js` knows nothing about Firebase.
- Rapid writes (notes, ingredient gram adjustments) are debounced at 900 ms before hitting Firestore to avoid write storms.
- Photos are stored as individual Firestore documents rather than embedded in the main document. This keeps the main documents small and stays within Firestore free-tier limits.
- IndexedDB caches every photo locally so the app renders photos instantly on repeat visits without a Firestore read.
- The Gemini API key never appears in this repo. It lives as a secret on a Cloudflare Worker, which is the only endpoint the client calls.
- AI output is whitelisted against the exercise / ingredient databases before it reaches the UI, so a hallucinated name can never produce a broken card.

---

## Firestore Data Model

All user data lives under `users/{uid}/`:

```
users/{uid}/
  sections/
    plans                → { value: JSON }   # workout plans array
    bodyweight           → { value: JSON }   # weight entries map (date → {w, p[]})
    meals                → { value: JSON }   # meals array
    prs                  → { value: JSON }   # personal records map
    macrogoalsmap        → { value: JSON }   # date-keyed macro goals
    customings           → { value: JSON }   # custom ingredients array
    customexercises      → { value: JSON }   # user-defined exercises
    weightgoal           → { value: JSON }   # target body weight
    userheight           → { value: JSON }   # height in cm (for BMI)
    userprofile          → { value: JSON }   # profile used by the macro wizard
    usertheme            → { value: JSON }   # dark / light
    prefs                → { value: JSON }   # rest timer defaults, auto-start
    deleteddefaultmeals  → { value: JSON }   # built-in meals the user removed
  exhist/
    {exerciseName}       → { value: JSON }   # date-keyed log for one exercise
  notes/
    {exerciseName}       → { value: string } # freetext notes for one exercise
  notephotos/
    {exerciseName}       → { value: base64 } # photo attached to exercise notes
  bw-photos/
    {date}_{i}           → { value: base64 } # one doc per progress photo
  meal-photos/
    {mealId}             → { value: base64 } # one doc per meal photo
```

Exercise names are `encodeURIComponent`-escaped before use as document IDs. An empty string value is a tombstone — it marks the document deleted so other devices clear their local copy on next load.

The active workout session is kept in `localStorage` only (`trainer_active_session`) — it is device-local by design, so an in-progress session on your phone does not appear on your laptop.

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
│   ├── session.css         # Active session: set rows, drop sets, rest timer chip
│   ├── modals.css          # Shared modal and bottom-sheet styles
│   ├── bodyweight.css      # Weight chart, calendar, entry sheet, photo viewer
│   ├── exerciselog.css     # Global exercise log calendar
│   ├── nutrition.css       # Meal list, ingredient picker, macro goals, pie chart
│   ├── musclebalance.css   # Muscle group balance bars
│   ├── summary.css         # Activity summary overlay and charts
│   ├── water.css           # Water tracker view
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
│   ├── exercises.js        # Muscle grid, exercise list, detail modal, notes, custom exercises
│   ├── plans.js            # Plan CRUD, exercise picker, drag-to-reorder, AI plan UI
│   ├── ai.js               # Gemini calls via Cloudflare Worker: plan generation, meal vision
│   ├── session.js          # Active workout session, rest timer, drop sets, wake lock
│   ├── history.js          # Per-exercise history chart, calendar, entry log sheet
│   ├── exerciselog.js      # Global exercise log calendar across all exercises
│   ├── prs.js              # PR detection, cache rebuild, PR badge, PRs view
│   ├── bodyweight.js       # Weight chart, calendar, entry sheet, goal, BMI, photo viewer
│   ├── gallery.js          # Progress photo timeline
│   ├── timelapse.js        # Progress photo → video (canvas + MediaRecorder)
│   ├── nutrition.js        # Meals, ingredient picker, custom foods, macro goals, wizard
│   ├── nutrition-shared.js # Shared nutrition helpers and image cache
│   ├── nutrition-barcode.js# Barcode scanning + OpenFoodFacts lookup
│   ├── water.js            # Water intake tracker (local-only)
│   ├── summary.js          # Weekly/monthly summary, consistency heatmap, streak
│   ├── musclebalance.js    # Set counts per muscle group over a period
│   ├── export.js           # Multi-sheet xlsx export via SheetJS
│   ├── toast.js            # Transient toast notifications
│   ├── utils.js            # Shared helpers (dates, macro calc, HTML escaping, sheets)
│   └── firebase-config.js  # Firebase project config (API key, project ID, etc.)
│
└── data/
    ├── exercises.js        # Full exercise database keyed by muscle group
    └── ingredients.js      # Ingredient database (100+ foods, macros per 100 g)
```

---

## Local Development

No build step required. Serve from any static file server:

```bash
npx serve .
```

Or:

```bash
python -m http.server 8080
```

Then open the URL the server reports.

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

## AI Setup

The AI features (plan generation and meal-from-photo) call a Cloudflare Worker, which holds the Gemini API key as a Worker secret and forwards the request to the Gemini API. The client never sees the key.

The endpoint is configured at the top of `js/ai.js`:

```js
const ENDPOINT = 'https://rsr-fitness-ai.magraftaeldar.workers.dev/';
```

If you fork this, deploy your own Worker that accepts the request body `ai.js` sends and proxies it to Gemini with your key, then point `ENDPOINT` at it. Without a reachable endpoint, everything else in the app still works — only the two AI entry points fail.

---

## PWA & Offline

The Service Worker (`sw.js`) pre-caches the app shell on install and uses a **network-first** strategy at runtime:

- On every request it tries the network first and updates the cache with the fresh response
- If the network fails it falls back to the cached version
- Firebase, Cloudflare Worker, and OpenFoodFacts hosts are excluded from caching entirely, so API responses are never served stale
- The cache is versioned (`trainer-v141`). Bumping this string on deploy busts the old cache and forces clients to download fresh assets

Two lists drive the cache: `CORE` (HTML, CSS, JS, fonts, data — cached on install) and `ASSETS` (icons and muscle images — cached lazily).

> **When adding a new module, add it to `CORE` in `sw.js`.** A file missing from that list will not be available offline.

To install the app: open it in Chrome or Safari on mobile and choose **Add to Home Screen**. The app launches in standalone mode with no browser chrome.

---

## Data Migrations

One-time migrations run automatically at startup to handle schema evolution:

| Function | Location | What it does |
|---|---|---|
| `migrateOldExLogs()` | `store.js` | Converts single-entry exercise logs (`trainer_ex_*`) to date-keyed history (`trainer_exhist_*`) |
| `migrateMacroGoalsToMap()` | `store.js` | Converts old flat macro goals + skip-log into the new date-keyed goals map |
| `migratePhotosToStorage()` | `storage.js` | Extracts base64 photos embedded in the body weight document into individual Firestore photo documents |
| `migrateMealPhotosToStorage()` | `storage.js` | Same, for photos embedded in meal objects |

Each migration guards itself with a localStorage flag so it runs only once per device. The photo migrations run in the background after first paint.

---

## Known Limitations

Honest list of what the app does not do yet:

- **Metric units only.** Weights are kg and heights cm throughout; there is no unit toggle.
- **No derived training load.** Sets record weight and reps, but nothing computes tonnage, estimated 1RM, or weekly volume per muscle group — charts plot raw weight.
- **No RPE / RIR**, and no time- or distance-based set type, so planks and cardio cannot be logged faithfully.
- **No previous-session reference during a session.** The active session shows PR status but not what you lifted last time for that exercise.
- **Plans are not scheduled.** Nothing maps a plan to a weekday or rotation, so there is no "today's workout".
- **No notifications.** The rest timer stops updating when the screen locks or the app is backgrounded, and there are no reminders.
- **Export is one-way.** There is an xlsx export but no import or restore path.
- **No automated tests.**

---

## Credits

Built by **Eldar Magrafta**. © 2026 Eldar Magrafta. All rights reserved.
