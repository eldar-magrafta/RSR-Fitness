// ── Gemini-powered plan generator ──
// Calls a Cloudflare Worker that proxies the Gemini API. The Gemini
// key lives as a Worker secret, never in this repo. Output is
// constrained to exercises that exist in data/exercises.js so
// generated plans always render with images and link to history.

import { exerciseData } from '../data/exercises.js';
import { NL_INGREDIENTS } from '../data/ingredients.js';

const ENDPOINT = 'https://rsr-fitness-ai.magraftaeldar.workers.dev/';

// All exercise names available (built-in + user customs), indexed for fast whitelist checks.
function buildExerciseIndex(customExercises = []) {
  const byGroup = {};
  const allNames = [];
  Object.entries(exerciseData).forEach(([groupKey, group]) => {
    byGroup[groupKey] = group.exercises.map(e => e.name);
    group.exercises.forEach(e => allNames.push(e.name));
  });
  customExercises.forEach(c => {
    if (!c || !c.name) return;
    if (!byGroup[c.group]) byGroup[c.group] = [];
    byGroup[c.group].push(c.name);
    allNames.push(c.name);
  });
  const lowerToCanonical = {};
  allNames.forEach(n => { lowerToCanonical[normalizeExName(n)] = n; });
  return { byGroup, allNames, lowerToCanonical };
}

// Strip whitespace, dashes, parens etc. so "Pull-Ups", "pull ups", "pullups" all match.
function normalizeExName(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildPrompt({ daysPerWeek, level, focusGroups, equipment, injuries, notes }, idx) {
  const allowedList = idx.allNames.map(n => `- ${n}`).join('\n');
  const focusLine = focusGroups.length
    ? `Target / emphasized muscle groups: ${focusGroups.join(', ')}.`
    : 'No specific muscle focus — build a balanced full-body program.';
  const eqLabels = (equipment || []).map(k => EQUIPMENT_OPTIONS.find(o => o.key === k)?.label).filter(Boolean);
  const equipmentLine = eqLabels.length
    ? `Available equipment: ${eqLabels.join(', ')}. Do NOT pick exercises that require equipment outside this list.`
    : 'Available equipment: assume a fully-equipped commercial gym.';
  const injuryLabels = (injuries || []).map(k => INJURY_OPTIONS.find(o => o.key === k)?.label).filter(Boolean);
  const injuryLine = injuryLabels.length
    ? `INJURIES / LIMITATIONS (HARD CONSTRAINT): The user has issues with: ${injuryLabels.join(', ')}. Avoid exercises that load these areas heavily or risk aggravating them. When in doubt, omit the exercise.`
    : '';
  const notesLine = notes ? `User notes: ${notes}` : '';
  const levelGuidance = {
    beginner: `LEVEL GUIDANCE — BEGINNER: Bias HEAVILY toward machines, cables, and supported/seated variations. AVOID free-weight moves that demand precise technique under load — specifically: Barbell Deadlift, Barbell Squat, Barbell Romanian Deadlift, Barbell Sumo Deadlift, Barbell Hip Thrust, Barbell Bent-Over Row, Barbell Upright Row, Snatches, Cleans, and Kettlebell Swings. Prefer Leg Press, Leg Extension, Seated Leg Curl, Lat Pulldown, Seated Row Machine, Chest Press machine, Pec Deck, Shoulder Press machine, Cable curls/extensions. A beginner can do dumbbell presses, dumbbell rows, and goblet squats if no leg-friendly machine alternative fits — but never barbell compounds.`,
    intermediate: `LEVEL GUIDANCE — INTERMEDIATE: A balanced mix is ideal. Include core barbell lifts (Bench, Row, RDL, Squat) AND machines/cables for accessory work. Free-weight compounds are appropriate but should not be the entire program. Olympic-derivative moves (cleans, snatches) still skipped unless the user requested them in notes.`,
    advanced: `LEVEL GUIDANCE — ADVANCED: Prefer free-weight compounds as the centerpiece — Barbell Squat, Deadlift variants, Bench, Overhead Press, Barbell Row, Romanian Deadlift, Hip Thrust. Machines are accessory work, not the focus. Include high-skill moves (Kettlebell Swings, weighted pull-ups, Bulgarian split squats) where they fit the split.`,
  }[level] || '';
  return `You are an experienced strength coach. Build a ${daysPerWeek}-day-per-week workout plan for a ${level} lifter.
${focusLine}
${equipmentLine}
${injuryLine}
${levelGuidance}
${notesLine}

CONSTRAINTS (ALL ARE HARD):
1. You MUST only choose exercises from the EXACT list below. Use the names verbatim — no paraphrasing, no prefixes, no suffixes.
2. Respect the equipment limit, any injuries/limitations, AND the level guidance above. These override every other consideration — even at the cost of fewer exercises.
3. Each day should target a coherent set of muscle groups (e.g. push/pull/legs, upper/lower, full body).
4. Each day should have 5–8 exercises, ordered with compound lifts first, then isolation.
5. Do not repeat the same exercise on the same day.
6. The plan name must be concise (≤ 35 chars) and reflect the split.

ALLOWED EXERCISE NAMES:
${allowedList}

Return ONLY valid JSON in this exact shape (no markdown, no commentary):
{
  "name": "<concise plan name>",
  "days": [
    { "title": "Day 1 — <theme>", "exercises": ["<name>", "<name>", ...] },
    ...
  ]
}`;
}

async function callGemini(prompt, extraParts = [], temperature = 0.7) {
  const parts = [{ text: prompt }, ...extraParts];
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Daily AI quota reached. Free-tier limits reset every 24 hours — please try again later.');
    }
    if (res.status === 403) {
      throw new Error('AI key invalid or blocked. The key may need rotating.');
    }
    throw new Error(`AI error (${res.status}). Please try again in a minute.`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('AI returned no response. Please try again.');
  return JSON.parse(text);
}

// Convert Gemini JSON → our plan shape, dropping any names that don't
// match the whitelist (case-insensitive).
function toPlanShape(raw, idx) {
  if (!raw || !Array.isArray(raw.days)) {
    throw new Error('Generated plan was malformed');
  }
  const exercises = [];
  raw.days.forEach((day, i) => {
    const title = String(day.title || `Day ${i + 1}`).slice(0, 80);
    exercises.push({ title });
    (day.exercises || []).forEach(rawName => {
      const canonical = idx.lowerToCanonical[normalizeExName(rawName)];
      if (canonical) exercises.push(canonical);
    });
  });
  return {
    name: String(raw.name || 'AI Plan').slice(0, 35),
    exercises,
  };
}

export async function generatePlan(input) {
  const idx = buildExerciseIndex(input.customExercises);
  const prompt = buildPrompt(input, idx);
  // One retry on JSON parse failure — Gemini occasionally returns code-fenced output.
  let raw;
  try {
    raw = await callGemini(prompt);
  } catch (e) {
    if (e instanceof SyntaxError) raw = await callGemini(prompt + '\n\nReturn pure JSON only.');
    else throw e;
  }
  return toPlanShape(raw, idx);
}

export const EQUIPMENT_OPTIONS = [
  { key: 'full-gym', label: 'Full gym' },
  { key: 'dumbbells', label: 'Dumbbells' },
  { key: 'barbell', label: 'Barbell + rack' },
  { key: 'cables', label: 'Cables' },
  { key: 'machines', label: 'Machines' },
  { key: 'bodyweight', label: 'Bodyweight only' },
];

export const INJURY_OPTIONS = [
  { key: 'none', label: 'None' },
  { key: 'knees', label: 'Knees' },
  { key: 'lower-back', label: 'Lower back' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'wrists', label: 'Wrists' },
  { key: 'elbows', label: 'Elbows' },
  { key: 'neck', label: 'Neck' },
];

// ── Meal from photo ──
// Sends a meal photo to Gemini and asks it to return a list of
// ingredients drawn from data/ingredients.js with rough gram weights.
// The caller wraps the result into a logged meal so the user can edit
// quantities and add/remove items before anything is final.

function buildIngredientIndex() {
  const allNames = NL_INGREDIENTS.map(i => i.name);
  const lowerToCanonical = {};
  NL_INGREDIENTS.forEach(i => { lowerToCanonical[i.name.toLowerCase()] = i; });
  // Group by category for the prompt — easier for Gemini to scan.
  const byCat = {};
  NL_INGREDIENTS.forEach(i => {
    if (!byCat[i.cat]) byCat[i.cat] = [];
    byCat[i.cat].push(i.name);
  });
  return { allNames, lowerToCanonical, byCat };
}

function buildMealVisionPrompt(idx) {
  const catLabel = {
    protein: 'PROTEINS',
    dairy: 'DAIRY & EGGS',
    grains: 'GRAINS & STARCHES',
    fruits: 'FRUITS',
    vegetables: 'VEGETABLES',
    legumes: 'LEGUMES',
    'nuts-and-seeds': 'NUTS & SEEDS',
    'oils-and-condiments': 'OILS, SAUCES & CONDIMENTS',
    drinks: 'DRINKS',
  };
  const catOrder = ['protein', 'dairy', 'grains', 'fruits', 'vegetables', 'legumes', 'nuts-and-seeds', 'oils-and-condiments', 'drinks'];
  const grouped = catOrder
    .filter(c => idx.byCat[c])
    .map(c => `[${catLabel[c] || c.toUpperCase()}]\n${idx.byCat[c].map(n => `- ${n}`).join('\n')}`)
    .join('\n\n');
  return `You are analyzing a photo of a meal. Identify each visible ingredient and estimate its weight in grams as it appears on the plate.

HOW TO READ THE LIST BELOW:
Items are grouped by category. When you see something on the plate, locate the right category first, then pick the closest matching name.

DECOMPOSITION RULE:
If a dish is composite (e.g. burrito, salad bowl, pasta with sauce, sandwich), break it into its visible constituent parts and list each separately. Do NOT return a single "Burrito" or "Salad" entry — return the rice, beans, cheese, tortilla, lettuce, dressing, etc., individually.

COOKING STATE:
Most items in the list say "(cooked)" — these are the cooked-weight values. If the food on the plate is cooked, use the cooked entry. Use raw entries only if the food is visibly raw (e.g. salad greens, fruit, sashimi).

PORTION CALIBRATION (use as anchors):
- Cooked rice / pasta: a fist (closed) ≈ 150g; a typical restaurant serving ≈ 200–250g
- Cooked meat / fish: a deck of cards ≈ 85g; a chicken breast ≈ 120–180g; a salmon fillet ≈ 150g
- Bread: a slice ≈ 30g; a bagel ≈ 100g; a tortilla ≈ 30–50g
- Eggs: medium ≈ 50g, large ≈ 60g
- Oil / butter / sauce visible on plate: 1 tbsp ≈ 14g; a generous drizzle ≈ 10–20g; a sauce pool ≈ 30–60g
- Cheese shred or slice: 1 slice ≈ 20g; a sprinkle ≈ 15–30g
- Vegetables (cooked): half a cup ≈ 80g; a typical side ≈ 100–150g

CONSTRAINTS:
1. For "ingredients", you MUST only use names from the list below. Use the names verbatim — no paraphrasing, no prefixes, no suffixes.
2. If something on the plate genuinely has no analog in the list, put a short plain-language label for it in "skipped" (e.g. "kimchi", "halloumi"). Do NOT skip items that have a reasonable analog — try the categorized list first. Do NOT invent macros for skipped items. Keep skipped labels under 30 characters.
3. Round grams to the nearest 5g. Do not return 0g.
4. Pick a concise meal name (≤ 30 chars) that describes the dish.

ALLOWED INGREDIENT NAMES (grouped by category):

${grouped}

Return ONLY valid JSON in this exact shape (no markdown, no commentary):
{
  "name": "<meal name>",
  "ingredients": [
    { "name": "<exact name from the list>", "grams": <integer> },
    ...
  ],
  "skipped": ["<plain-language label>", ...]
}`;
}

// Strip the data: prefix and return { mimeType, data } for Gemini.
function dataUrlToInlineData(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('Photo could not be processed.');
  return { mimeType: m[1], data: m[2] };
}

export async function identifyMealFromPhoto(dataUrl) {
  const idx = buildIngredientIndex();
  const prompt = buildMealVisionPrompt(idx);
  const inline = dataUrlToInlineData(dataUrl);
  const parts = [{ inlineData: inline }];
  let raw;
  try {
    raw = await callGemini(prompt, parts, 0.25);
  } catch (e) {
    if (e instanceof SyntaxError) raw = await callGemini(prompt + '\n\nReturn pure JSON only.', parts, 0.25);
    else throw e;
  }
  if (!raw || !Array.isArray(raw.ingredients)) {
    throw new Error('Could not read ingredients from the photo. Try a clearer shot.');
  }
  const ingredients = [];
  const droppedByClient = [];
  raw.ingredients.forEach(it => {
    const rawName = String(it.name || '').trim();
    const ing = idx.lowerToCanonical[rawName.toLowerCase()];
    const grams = Math.max(1, Math.min(2000, Math.round(Number(it.grams) || 0)));
    if (!ing || !grams) {
      if (rawName) droppedByClient.push(rawName);
      return;
    }
    ingredients.push({
      name: ing.name,
      grams,
      p: ing.p, c: ing.c, f: ing.f, cal: ing.cal,
      cat: ing.cat,
      img: ing.img,
    });
  });
  const skippedFromModel = Array.isArray(raw.skipped)
    ? raw.skipped.map(s => String(s).trim().slice(0, 30)).filter(Boolean)
    : [];
  // Combine model-flagged skips and client-side drops, dedup case-insensitively.
  const seen = new Set();
  const skipped = [...skippedFromModel, ...droppedByClient].filter(label => {
    const k = label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (!ingredients.length) {
    const tail = skipped.length ? ` AI saw: ${skipped.join(', ')} — none of these are in the database yet.` : '';
    throw new Error('No matching ingredients identified. Try a clearer shot.' + tail);
  }
  return {
    name: String(raw.name || 'Meal').slice(0, 30),
    ingredients,
    skipped,
  };
}

export const MUSCLE_GROUP_OPTIONS = [
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'triceps', label: 'Triceps' },
  { key: 'forearms', label: 'Forearms' },
  { key: 'quads', label: 'Quads' },
  { key: 'hamstrings', label: 'Hamstrings' },
  { key: 'glutes', label: 'Glutes' },
  { key: 'calves', label: 'Calves' },
  { key: 'core', label: 'Core' },
];
