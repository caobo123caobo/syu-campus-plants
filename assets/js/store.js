/* 本地状态：收藏、浏览、掌握度、测验、设置、打卡；观察记录用 IndexedDB 存照片 */
import { readJSON, writeJSON, todayKey } from './util.js';

const K = {
  favs: 'syu.favs.v1',
  viewed: 'syu.viewed.v1',
  mastered: 'syu.mastered.v1',
  quiz: 'syu.quiz.v1',
  settings: 'syu.settings.v1',
  days: 'syu.days.v1',
  wrong: 'syu.wrong.v1',
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

/* ---------------- 设置 ---------------- */
export const settings = Object.assign(
  { theme: 'auto', grid: 'comfortable', lastTab: 'home' },
  readJSON(K.settings, {}),
);
export function setSetting(key, value) {
  settings[key] = value;
  writeJSON(K.settings, settings);
  emit();
}

/* ---------------- 收藏 ---------------- */
const favSet = new Set(readJSON(K.favs, []));
export const favs = {
  has: id => favSet.has(Number(id)),
  toggle(id) {
    id = Number(id);
    favSet.has(id) ? favSet.delete(id) : favSet.add(id);
    writeJSON(K.favs, [...favSet]);
    emit();
    return favSet.has(id);
  },
  list: () => [...favSet],
  size: () => favSet.size,
  clear() { favSet.clear(); writeJSON(K.favs, []); emit(); },
};

/* ---------------- 浏览 / 掌握 ---------------- */
const viewedSet = new Set(readJSON(K.viewed, []));
const masteredSet = new Set(readJSON(K.mastered, []));
export const progress = {
  markViewed(id) {
    id = Number(id);
    if (viewedSet.has(id)) return;
    viewedSet.add(id);
    writeJSON(K.viewed, [...viewedSet]);
    const d = readJSON(K.days, {});
    d[todayKey()] = (d[todayKey()] || 0) + 1;
    writeJSON(K.days, d);
    emit();
  },
  isViewed: id => viewedSet.has(Number(id)),
  viewedCount: () => viewedSet.size,
  viewedList: () => [...viewedSet],
  isMastered: id => masteredSet.has(Number(id)),
  setMastered(id, on = true) {
    id = Number(id);
    on ? masteredSet.add(id) : masteredSet.delete(id);
    writeJSON(K.mastered, [...masteredSet]);
    emit();
    return on;
  },
  masteredCount: () => masteredSet.size,
  masteredList: () => [...masteredSet],
  days: () => readJSON(K.days, {}),
  streak() {
    const d = readJSON(K.days, {});
    let n = 0;
    const cur = new Date();
    for (;;) {
      const key = todayKey(cur);
      if (d[key]) { n++; cur.setDate(cur.getDate() - 1); } else break;
    }
    return n;
  },
  reset() {
    viewedSet.clear();
    masteredSet.clear();
    writeJSON(K.viewed, []);
    writeJSON(K.mastered, []);
    writeJSON(K.days, {});
    emit();
  },
};

/* ---------------- 测验 ---------------- */
const quizData = Object.assign(
  { rounds: 0, answered: 0, correct: 0, best: 0, byType: {} },
  readJSON(K.quiz, {}),
);
export const quizStats = {
  get: () => quizData,
  record(round) {
    quizData.rounds += 1;
    quizData.answered += round.answered;
    quizData.correct += round.correct;
    quizData.best = Math.max(quizData.best, round.answered ? Math.round(round.correct / round.answered * 100) : 0);
    for (const [type, v] of Object.entries(round.byType || {})) {
      quizData.byType[type] = quizData.byType[type] || { answered: 0, correct: 0 };
      quizData.byType[type].answered += v.answered;
      quizData.byType[type].correct += v.correct;
    }
    writeJSON(K.quiz, quizData);
    emit();
  },
  reset() {
    Object.assign(quizData, { rounds: 0, answered: 0, correct: 0, best: 0, byType: {} });
    writeJSON(K.quiz, quizData);
    emit();
  },
};

const wrongMap = Object.assign({}, readJSON(K.wrong, {}));
export const wrongBook = {
  add(plantId, type) {
    const key = `${type}:${plantId}`;
    wrongMap[key] = (wrongMap[key] || 0) + 1;
    writeJSON(K.wrong, wrongMap);
    emit();
  },
  remove(plantId, type) {
    delete wrongMap[`${type}:${plantId}`];
    writeJSON(K.wrong, wrongMap);
    emit();
  },
  list: () => Object.entries(wrongMap).map(([key, n]) => {
    const [type, id] = key.split(':');
    return { type, plantId: Number(id), times: n };
  }).sort((a, b) => b.times - a.times),
  size: () => Object.keys(wrongMap).length,
  clear() {
    for (const k of Object.keys(wrongMap)) delete wrongMap[k];
    writeJSON(K.wrong, wrongMap);
    emit();
  },
};

/* ---------------- 观察记录（IndexedDB） ---------------- */
const DB_NAME = 'syu-notes';
const STORE = 'notes';
let dbPromise;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('浏览器不支持 IndexedDB')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    let req;
    try { req = fn(store); } catch (e) { reject(e); return; }
    if (req && 'onsuccess' in req) req.onsuccess = () => { result = req.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('事务中止'));
  }));
}

export const notes = {
  async add(note) {
    const rec = {
      id: note.id || `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      plantId: note.plantId ? Number(note.plantId) : null,
      plantName: note.plantName || '',
      place: note.place || '',
      text: note.text || '',
      photo: note.photo instanceof Blob ? note.photo : null,
      createdAt: note.createdAt || new Date().toISOString(),
    };
    await tx('readwrite', store => store.put(rec));
    return rec;
  },
  async all() {
    const list = await tx('readonly', store => store.getAll());
    return (list || []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
  async remove(id) { await tx('readwrite', store => store.delete(id)); },
  async clear() { await tx('readwrite', store => store.clear()); },
};

/* ---------------- 一次性清理 ---------------- */
export function clearAll() {
  favs.clear();
  progress.reset();
  quizStats.reset();
  wrongBook.clear();
  writeJSON(K.settings, { theme: settings.theme, grid: settings.grid, lastTab: 'home' });
  notes.clear();
  emit();
}
