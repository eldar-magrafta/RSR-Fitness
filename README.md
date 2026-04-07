# RSR Fitness

A Progressive Web App for tracking workouts, body weight, nutrition, and personal records — all synced to the cloud.

**Live app:** [eldar-magrafta.github.io/RSR-Fitness](https://eldar-magrafta.github.io/RSR-Fitness/)

## Features

- **Exercise Library** — Browse exercises by muscle group with animated GIF demos, tips, and YouTube links
- **Workout Plans** — Create custom plans, drag-to-reorder exercises, and add section titles
- **Exercise Logging** — Log sets, reps, and weight per exercise with a calendar-based history view
- **Personal Records** — Automatic PR tracking with toast notifications when you hit a new best
- **Body Weight Tracking** — Log daily weight with optional progress photos, trend chart, and monthly calendar
- **Nutrition Lab** — Track meals and macros, create custom ingredients, set daily macro goals
- **Activity Summary** — Weekly/monthly overview with workout count, weight trend chart, and top exercises
- **Search** — Global and per-group exercise search for fast navigation
- **Dark/Light Theme** — Toggle from the burger menu
- **Cloud Sync** — Firebase Authentication (Google + email/password) with Firestore backup
- **Offline Support** — Service Worker with network-first caching strategy
- **Installable** — Add to home screen on iOS/Android for a native app experience

## Tech Stack

- Vanilla JavaScript (ES Modules, no build step, no bundler)
- HTML/CSS with CSS custom properties for theming
- Firebase Authentication & Firestore (SDK loaded from CDN)
- Service Worker for offline caching
- GitHub Pages for hosting

## Project Structure

```
RSR-Fitness/
  index.html          # App shell — all views, overlays, modals
  sw.js               # Service Worker (network-first, manual cache versioning)
  manifest.json       # PWA manifest
  css/                # Stylesheets by feature
  js/
    app.js            # Entry point, navigation, window globals
    auth.js           # Auth UI (sign-in, register, verify email)
    cloud.js          # Firebase init, Firestore sync
    store.js          # localStorage read/write with cloud sync
    state.js          # Shared mutable UI state
    exercises.js      # Muscle grid, exercise list, detail modal
    plans.js          # Plan CRUD, exercise picker, drag-to-reorder
    bodyweight.js     # Weight tracking, chart, calendar, photos
    history.js        # Exercise history chart, calendar, entry logging
    nutrition.js      # Meals, ingredient picker, macro tracking
    summary.js        # Activity summary with mini charts
    prs.js            # Personal record tracking
    navigation.js     # View switching, header management
    utils.js          # Shared utilities
    firebase-config.js
  data/
    exercises.js      # Exercise database (all muscle groups)
    ingredients.js    # Ingredient database (macros per 100g)
  assets/
    exercises/        # GIF animations per muscle group
    muscles/          # Muscle group overlay images
    icons/            # PWA icons
```

## Setup

No build step required. To run locally:

```bash
npx serve .
```

Then open `http://localhost:3000`.

For cloud sync, you'll need your own Firebase project with Authentication and Firestore enabled. Update `js/firebase-config.js` with your config.
