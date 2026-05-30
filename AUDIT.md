# RSR-Fitness Code Audit

Severity: **P0** (data loss / security) · **P1** (broken feature / serious UX) · **P2** (smell / minor) · **P3** (nice-to-have)

> Each finding is anchored to file:line and has been spot-verified against the current source. A handful of agent-reported items (e.g. macro-slider listener leak, full re-render in `sessionUpdateSet`, missing null check in exercises.js cloud-image swap) were dropped because the code already handles them.

---

## 1. Data correctness — timezone & date handling

### P1 · `new Date().toISOString().slice(0, 10)` is a UTC date, not the user's local date
Used in 18+ places to derive "today":
`js/state.js:31`, `js/app.js:67`, `js/water.js:30`, `js/session.js:452`,
`js/nutrition.js:87,113,475,511,599,614,884,894,1025,1116,1124,1131,1195`, `js/export.js:114`.

For users east of UTC after ~14:00 local time, `toISOString().slice(0,10)` returns *tomorrow's* date; for users west of UTC before ~10:00, it returns *yesterday's*. Meals, water, weight, and session entries can land on the wrong calendar day.

Fix: use the existing `dateToStr()` helper in `js/utils.js:55` (uses local `getFullYear/Month/Date`) everywhere. Add a `todayStr()` convenience export and replace every `new Date().toISOString().slice(0,10)` with it.

### P1 · `migrateOldExLogs` re-introduces the same UTC bug
`js/store.js:81-83` — `parsed.toISOString().slice(0,10)` slices a UTC date off `new Date(old.date)`. Migrated rows can be logged on the wrong day. Fix: format with local `dateToStr(parsed)`.

### P1 · `getLog` parses `YYYY-MM-DD` as UTC midnight then formats with local `toLocaleDateString`
`js/store.js:56-57` — `new Date(ds + 'T00:00:00')` is local midnight (this is fine on its own), but compare against `js/history.js:11` which uses `d.toISOString().slice(0,10)` for the inverse. The two halves of the round-trip use different conventions and can disagree by one day depending on locale and DST. Fix: standardize on local `dateToStr`.

---

## 2. Security / injection

### P1 · Photo-migration reference can be set before the upload succeeds
`js/storage.js:144-152` — for meal photos, `await savePhoto(...)` is awaited before `meal.image = 'cloud:' + meal.id`, so the order is safe **per meal**. But `savePhoto` itself (`js/storage.js:56-59`) caches to IndexedDB *first*, then attempts Firestore. `savePhotoDoc` (`js/cloud.js:149-154`) **swallows Firestore errors silently** (`catch { /* offline */ }`) — meaning offline migration writes only to local IndexedDB, marks the meal as `cloud:`, drops the inline base64 from `trainer_meals`, and then if the user clears site data before coming back online, the photo is gone. **This is a real data-loss path.**

Fix: have `savePhotoDoc` rethrow on failure so `migrateMealPhotosToStorage` can leave the inline base64 in place. Or only set `meal.image = 'cloud:'` when both IDB cache *and* Firestore upload confirm.

### P2 · Onclick string injection assumes IDs are numeric
`js/nutrition.js:147,149,152,1155`, `js/plans.js`, `js/session.js` etc. Pattern: `onclick="nlShowMeal('${m.id}')"`.

Today every meal id is `meal_<Date.now()>`, so quotes and `<>` never appear. But the moment any code path lets a user-derived string become an `id` (import, future feature, AI-generated meal name flowing through `meal_` prefix), this breaks attribute parsing and enables HTML injection. The codebase already has `escHtml` at `utils.js:13` which escapes `'` to `&#39;`, but it's not used on these IDs.

Fix: replace inline `onclick="..."` with event delegation reading `data-meal-id`, or wrap with `escHtml(m.id)`.

### P2 · Firebase API key is shipped in source
`js/firebase-config.js` — this is normal for Firebase web apps (security comes from Firestore rules + auth, not from hiding the key), but **only safe if the Firestore security rules are tight**. Verify `users/{uid}` rules require `request.auth.uid == uid` for read & write. Not visible in this repo.

---

## 3. Storage, sync, and migration

### P1 · `safeSetItem` swallows quota errors silently
`js/store.js:10-20` — on `QuotaExceededError`, the function logs and returns. The caller continues as if the save succeeded, the in-memory state is updated, and the user sees no warning. Next reload, the change is gone.

Fix: surface the failure (return a boolean, or set a flag the UI can show as "⚠ couldn't save locally"). Combined with the meal-base64 inline storage issue below, this is how invisible data loss happens.

### P1 · Inline base64 in `trainer_meals` blows the localStorage quota
`js/store.js:284-291` (`saveNLMeals`) writes the entire meals array as one JSON string. If a meal has an inline `data:image/jpeg;base64,…` (pre-migration or just-uploaded, before the next login migration), 3–4 large meals can push the 5–10 MB localStorage quota. `safeSetItem` then silently fails (see above), and the cloud debounce upload is also skipped because the value is read fresh from localStorage on next render.

Fix: never store base64 photos in `trainer_meals`. Upload to Firestore + IndexedDB immediately on capture in `nlUploadMealPhoto`, and only ever store the `cloud:` marker in the meals array.

### P2 · Cloud sync is fire-and-forget; no retry on transient failure
`js/cloud.js:110-119` (`cloudSave`). On Firestore error, sets `_cloudError = true` and updates the indicator, but never retries. If a save fails because the user briefly lost connectivity, that write is lost (local copy persists, but cloud diverges). Next save overwrites the document and the lost write is permanently gone.

Fix: queue failed writes (e.g. a pending-writes array in localStorage) and replay on `_uid` change or `online` event. Or rely on Firebase's offline persistence (`enableIndexedDbPersistence`), which is currently not enabled.

### P2 · Cloud loader unconditionally overwrites local with remote
`js/cloud.js:81-104` (`loadFromCloud`) on login pulls every section and `localStorage.setItem(lsKey, snap.data().value)`, blowing away any pending local changes that hadn't synced yet. With debounced cloud saves (900 ms), a user who closes the tab during the debounce window and reopens later loses those changes after the next login pull.

Fix: compare timestamps, or merge server + local instead of overwriting.

### P2 · `_photoCache` is a bare LRU with `Map.keys().next().value`
`js/cloud.js:138-147` — uses insertion order as recency, but `set()` on an existing key doesn't move it to the end, so a frequently-accessed photo can still be evicted. Minor.

### P2 · Two parallel migration flags
`trainer_photos_migrated` (`storage.js:80`) and `trainer_meal_photos_migrated` (`storage.js:138`) drift independently. A user who reinstalls the PWA but kept localStorage will skip migration even if Firestore docs are missing. Fix: migration should also check for the existence of the cloud doc, not just the local "done" flag.

---

## 4. Performance & rendering

### P2 · Search picker re-fetches cloud thumbnails on every keystroke
`js/exercises.js:90-103` — every time `globalExSearchHandler()` runs (debounced 150 ms in `js/exercises.js`), search results are rebuilt and a new `loadPhotoDoc(...)` call is fired per cloud-marked exercise. `cloud.js`'s `_photoCache` (LRU 100) absorbs *most* of these, but on the first query you do pay one Firestore round-trip per visible custom exercise. Same pattern in `js/nutrition.js:347` (`_resolveCloudImages`).

Fix: the in-module cache `_cloudImgCache` at `nutrition.js:20` already exists for nutrition. Make it module-shared with exercises, or wrap `loadPhotoDoc` so callers always hit the cache first.

### P2 · `renderBWChart` rebuilds the entire SVG on theme/range change
`js/bodyweight.js:98-180` — full `svg.innerHTML = ...` on every `setBWRange()`. For a 365-day weight chart with hundreds of points, this is fine; mentioning for completeness. Acceptable.

### P2 · `_scannerInterval` not cleared if the loop throws before close
`js/nutrition.js:1350-1365` — `setInterval` callback wraps `detector.detect` in `try {} catch {}` (line 1364), so an exception inside the detector won't escape, but if `nlCloseBarcodeScanner` is never called (e.g. user navigates away while the scanner overlay is visible), the interval keeps running with the camera stream attached. The page-level navigation handler doesn't call `nlCloseBarcodeScanner`.

Fix: add a beforeunload / pagehide listener that calls `nlCloseBarcodeScanner`.

### P3 · 200+ globals registered on `window`
`js/app.js:1-595` — every export is reassigned to `window.X = X` so inline `onclick=` strings can find them. This is a deliberate architecture choice (no bundler, no framework), but it makes refactoring harder and means dead-code elimination is impossible. Mentioned for awareness, not as a defect.

---

## 5. Service worker

### P2 · `NO_CACHE_HOST_RE` doesn't exclude `world.openfoodfacts.org`
`sw.js:349`, used at `js/nutrition.js:1402`. Barcode lookups are cached by the network-first handler at `sw.js:368-376`. Stale product data (renamed product, corrected macros) sticks until cache eviction.

Fix: add `world\.openfoodfacts\.org` to the regex, or send the request with `cache: 'no-store'`.

### P2 · Cache version `trainer-v114` must be hand-bumped
`sw.js:1`. If a deploy ships new HTML/JS but forgets to bump, returning users keep the old cached assets indefinitely (network-first eventually heals, but only when they're online). Fix: derive from a build timestamp or git SHA.

### P2 · Network-first for HTML offline-fallback may serve a stale app shell
`sw.js:368-376` — fine. Just ensure the manifest's start_url is also covered. Low risk.

---

## 6. Error handling

### P2 · Empty catches discard useful diagnostics
`js/storage.js:34,43,51,97,117,123,129`, `js/cloud.js:153,165,172,185`, `js/nutrition.js:1364,1391`. Each is a deliberate "degrade silently" choice, but when something does go wrong, debugging requires a code change. Consider sending these to a single `_diag(err, where)` function that stashes the last few errors in memory for an admin-only debug view.

### P2 · `_fetchProductData` re-throws but caller may not handle all variants
`js/nutrition.js:1396-1425` — `AbortError` and other exceptions are both rethrown; `nlSearchBarcode` (line 1429) needs to handle each, and depending on flow may show stale UI. Verify the unhappy path.

### P2 · `parseFloat` validation accepts `"0"` and friends inconsistently
`js/bodyweight.js:37-42` (height), `js/store.js:59,62` (`w` and `r`). `parseFloat('') === NaN` and `NaN > 0 === false` so the immediate guards work, but downstream `set.w = ''` flows into rendering and toFixed without re-parsing, producing `NaN.toFixed(1)`. Spot-check with empty strings.

---

## 7. Antipatterns / code smells

### P2 · `state.js` is a mutable global object
`js/state.js` exports a single `state` object that every module mutates directly. Combined with the function-on-window pattern (#4), this makes data flow nearly impossible to follow without grep. Acceptable for a small app, but a refactor cost is accumulating.

### P2 · `SECTION_MAP` and storage keys are duplicated
`js/cloud.js:15-28` maps section names to localStorage keys. The localStorage keys are also hard-coded in every getter/setter in `js/store.js`. Adding a section means editing both files in lockstep. Fix: have `store.js` export a single `STORAGE_KEYS` constant that `cloud.js` imports.

### P2 · `'cloud:'` and `'cloud'` magic-string photo markers
`js/storage.js:88,94,100`, `js/bodyweight.js` photo render. The marker is parsed via `slice(6)` and `startsWith` in many places. Fix: tiny helper module (`isCloudMarker(s)`, `cloudKey(col, id)`, `parseCloudKey(s)`).

### P3 · Magic numbers
`utils.js:67` (`720000` byte cap on resized images), `nutrition.js:1365` (`400 ms` scan interval), `store.js:24` (`900 ms` debounce), `cloud.js:139` (`100` photo cache size). Pull to a `const CONFIG = { ... }` block at the top of each file.

### P3 · Dead/legacy code paths
- `js/storage.js:74-107` (`migratePhotosToStorage`) and `:132-156` (`migrateMealPhotosToStorage`) — once every user has migrated, this code is pure overhead on every login. Add a short-circuit if a global `trainer_all_migrations_v2` flag is set, and plan to delete these flows in a future release.
- `data/exercises.js` and `data/ingredients.js` are large static seeds — verify they're tree-shaken or at least cached aggressively. They're imported eagerly today (`import { NL_INGREDIENTS } from '../data/ingredients.js'` in `nutrition.js:4`).

---

## 8. Accessibility

### P2 · Icon-only buttons lack `aria-label`
Many `<button><i class="bi bi-..."/></button>` patterns across `index.html` and dynamically-generated HTML in `nutrition.js`, `bodyweight.js`, `session.js`. Screen readers announce them as unlabeled buttons.

Fix: add `aria-label="Delete"`, `aria-label="Save set"`, etc.

### P2 · Modal focus is not trapped or restored
`js/bodyweight.js:30,291` and similar modal openers focus an input via `setTimeout`, but tabbing past the last input escapes the modal, and on close, focus is lost rather than returned to the triggering element.

### P3 · Color-only signaling
`js/summary.js:225-230` (deficit/surplus colored green/red without text affordance). `js/session.js` set "filled" / "done" classes are color-only.

---

## 9. UX nits caught during audit

### P3 · Future days in nutrition week strip have `cursor` left as default
`js/nutrition.js:1265-1273` and `css/nutrition.css` `.nl-week-day.is-future { opacity: 0.55; }` — they're still clickable. If the design intent is to allow logging future-dated meals, ignore. Otherwise, set `pointer-events: none`.

### P3 · `bw-input-row` width fix assumes 80 px thumb constants
`css/bodyweight.css:199-204` — width is hard-coded to `260px = 3*80 + 2*10`. If thumb size changes in the photo CSS (line 248), the input row stops aligning. Fix: CSS custom property `--bw-thumb: 80px;` shared between rules.

---

## Suggested fix order

| # | Effort | Impact | Item |
|---|--------|--------|------|
| 1 | small | high | Replace every `new Date().toISOString().slice(0,10)` with local `dateToStr(new Date())`. |
| 2 | small | high | Make `safeSetItem` surface quota failures (return `false`, show toast). |
| 3 | small | high | Stop storing base64 photos inside `trainer_meals` — go straight to cloud + IDB. |
| 4 | small | high | Have `savePhotoDoc` rethrow so migration doesn't drop inline data on offline. |
| 5 | medium | medium | Queue failed `cloudSave` calls and replay on `online`. Or enable Firestore offline persistence. |
| 6 | medium | medium | Compare timestamps in `loadFromCloud` instead of unconditional overwrite. |
| 7 | small | low | Add openfoodfacts to `NO_CACHE_HOST_RE`. |
| 8 | small | low | aria-labels on icon buttons. |
| 9 | small | low | Trap & restore focus in modals. |
