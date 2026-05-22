// ── Gemini-powered plan generator ──
// Calls a Cloudflare Worker that proxies the Gemini API. The Gemini
// key lives as a Worker secret, never in this repo. Output is
// constrained to exercises that exist in data/exercises.js so
// generated plans always render with images and link to history.

import { exerciseData } from '../data/exercises.js';

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
  allNames.forEach(n => { lowerToCanonical[n.toLowerCase()] = n; });
  return { byGroup, allNames, lowerToCanonical };
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

async function callGemini(prompt) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
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
  if (!text) throw new Error('AI returned no plan. Please try again.');
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
      const canonical = idx.lowerToCanonical[String(rawName).toLowerCase().trim()];
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
