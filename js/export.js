// ── Data Export Module ──

import { getBWData, bwGetWeight, getNLMeals, getExHist } from './store.js';
import { exerciseData } from '../data/exercises.js';

export function exportData() {
  if (typeof XLSX === 'undefined') {
    alert('Export library not loaded. Please check your internet connection and try again.');
    return;
  }

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Body Weight ──
  const bwData = getBWData();
  const bwRows = Object.entries(bwData)
    .map(([date, val]) => ({ date, w: bwGetWeight(val) }))
    .filter(e => e.w > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => [e.date, e.w]);

  const bwSheet = XLSX.utils.aoa_to_sheet([['Date', 'Weight (kg)'], ...bwRows]);
  bwSheet['!cols'] = [{ wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, bwSheet, 'Body Weight');

  // ── Sheet 2: Exercise History ──
  const exRows = [];
  Object.values(exerciseData).forEach(group => {
    group.exercises.forEach(ex => {
      const hist = getExHist(ex.name);
      Object.entries(hist).forEach(([date, entry]) => {
        let sets = [];
        if (entry.sets && entry.sets.length) sets = entry.sets;
        else if (entry.w) sets = [{ w: entry.w, r: entry.r }];
        const notes = entry.n || '';
        if (sets.length === 0) {
          exRows.push({ date, name: ex.name, set: 1, reps: '', weight: '', notes });
        } else {
          sets.forEach((s, i) => {
            exRows.push({
              date, name: ex.name,
              set: i + 1,
              reps: s.r || '',
              weight: s.w || '',
              notes: i === 0 ? notes : ''
            });
          });
        }
      });
    });
  });
  exRows.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || a.set - b.set);

  const exData = exRows.map((r, i, arr) => {
    const prev = i > 0 ? arr[i - 1] : null;
    const sameGroup = prev && prev.date === r.date && prev.name === r.name;
    return [
      sameGroup ? '' : r.date,
      sameGroup ? '' : r.name,
      r.set, r.reps, r.weight, r.notes
    ];
  });

  const exSheet = XLSX.utils.aoa_to_sheet([
    ['Date', 'Exercise', 'Set', 'Reps', 'Weight (kg)', 'Notes'],
    ...exData
  ]);
  exSheet['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 5 }, { wch: 5 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, exSheet, 'Exercise History');

  // ── Sheet 3: Meal Logs ──
  const meals = getNLMeals().filter(m => (m.type || 'logged') === 'logged');
  const mealRows = [];
  meals.forEach(m => {
    const ings = m.ingredients || [];
    if (ings.length === 0) {
      mealRows.push({ date: m.createdAt || '', meal: m.name, ing: '', grams: 0, p: 0, c: 0, f: 0, cal: 0 });
    } else {
      ings.forEach(ing => {
        const mult = (ing.grams || 0) / 100;
        mealRows.push({
          date: m.createdAt || '',
          meal: m.name,
          ing: ing.name,
          grams: ing.grams || 0,
          p: Math.round(((ing.p || 0) * mult) * 10) / 10,
          c: Math.round(((ing.c || 0) * mult) * 10) / 10,
          f: Math.round(((ing.f || 0) * mult) * 10) / 10,
          cal: Math.round((ing.cal || 0) * mult)
        });
      });
    }
  });
  mealRows.sort((a, b) => a.date.localeCompare(b.date) || a.meal.localeCompare(b.meal));

  const mlData = mealRows.map((r, i, arr) => {
    const prev = i > 0 ? arr[i - 1] : null;
    const sameMeal = prev && prev.date === r.date && prev.meal === r.meal;
    return [
      sameMeal ? '' : r.date,
      sameMeal ? '' : r.meal,
      r.ing, r.grams, r.p, r.c, r.f, r.cal
    ];
  });

  const mlSheet = XLSX.utils.aoa_to_sheet([
    ['Date', 'Meal', 'Ingredient', 'Grams', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Calories'],
    ...mlData
  ]);
  mlSheet['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 7 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 9 }];
  XLSX.utils.book_append_sheet(wb, mlSheet, 'Meal Logs');

  // ── Download ──
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `RSR-Fitness-Export-${today}.xlsx`);
}
