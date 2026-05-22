// ── Gemini-powered plan generator ──
// Calls a Cloudflare Worker that proxies the Gemini API. The Gemini
// key lives as a Worker secret, never in this repo. Output is
// constrained to exercises that exist in data/exercises.js so
// generated plans always render with images and link to history.

import { exerciseData } from '../data/exercises.js';

const ENDPOINT = 'https://rsr-fitness-ai.magraftaeldar.workers.dev/';

// All exercise names available, indexed for fast whitelist checks.
function buildExerciseIndex() {
  const byGroup = {};
  const allNames = [];
  Object.entries(exerciseData).forEach(([groupKey, group]) => {
    byGroup[groupKey] = group.exercises.map(e => e.name);
    group.exercises.forEach(e => allNames.push(e.name));
  });
  const lowerToCanonical = {};
  allNames.forEach(n => { lowerToCanonical[n.toLowerCase()] = n; });
  return { byGroup, allNames, lowerToCanonical };
}

function buildPrompt({ daysPerWeek, level, focusGroups, notes }, idx) {
  const allowedList = idx.allNames.map(n => `- ${n}`).join('\n');
  const focusLine = focusGroups.length
    ? `Target / emphasized muscle groups: ${focusGroups.join(', ')}.`
    : 'No specific muscle focus — build a balanced full-body program.';
  const notesLine = notes ? `User notes: ${notes}` : '';
  return `You are a strength coach. Build a ${daysPerWeek}-day-per-week workout plan for a ${level} lifter.
${focusLine}
${notesLine}

CONSTRAINTS:
1. You MUST only choose exercises from the EXACT list below. Use the names verbatim — no paraphrasing, no prefixes, no suffixes.
2. Each day should target a coherent set of muscle groups (e.g. push/pull/legs, upper/lower, full body).
3. Each day should have 5–8 exercises, ordered with compound lifts first.
4. Do not repeat the same exercise on the same day.
5. The plan name must be concise (≤ 35 chars) and reflect the split.

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
  const idx = buildExerciseIndex();
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
