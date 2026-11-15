/* 测验：看图识种 / 名称→科 / 名称→拉丁 / 特征辨种 / 别名辨种 / 功效辨种 */
import { S, plantById } from '../data.js';
import { quizStats, wrongBook, progress, favs } from '../store.js';
import { escapeHtml, shuffle, sample, icons, toast } from '../util.js';

const TYPES = [
  { id: 'image', label: '看图识种' },
  { id: 'family', label: '名称 → 科' },
  { id: 'latin', label: '名称 → 拉丁名' },
  { id: 'feature', label: '特征辨种' },
  { id: 'alias', label: '别名辨种' },
  { id: 'efficacy', label: '功效辨种' },
];

const SCOPE = [
  { id: 'all', label: '全部植物' },
  { id: 'fav', label: '我的收藏' },
  { id: 'unmastered', label: '未掌握' },
  { id: 'family', label: '指定科' },
];

const cfg = {
  types: ['image', 'family', 'feature'],
  scope: 'all',
  family: '',
  count: 10,
};

let session = null;
let rootEl = null;
let tab = 'start';

export function renderQuiz(root) {
  rootEl = root;
  root.innerHTML = `<div class="quiz-wrap">
    <div class="seg" id="quiz-tabs" style="margin-bottom:14px">
      <button data-tab="start" aria-pressed="${tab === 'start'}">开始测验</button>
      <button data-tab="wrong" aria-pressed="${tab === 'wrong'}">错题本 · ${wrongBook.size()}</button>
    </div>
    <div id="quiz-main"></div>
  </div>`;
  root.querySelector('#quiz-tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    root.querySelectorAll('#quiz-tabs button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.tab === tab)));
    paint();
  });
  paint();
}

function paint() {
  const main = rootEl.querySelector('#quiz-main');
  if (tab === 'wrong') { main.innerHTML = wrongHtml(); bindWrong(); return; }
  if (session?.finished) { main.innerHTML = resultHtml(); bindResult(); return; }
  if (session) { main.innerHTML = questionHtml(); bindQuestion(); return; }
  main.innerHTML = setupHtml();
  bindSetup();
}

/* ---------------- 设置 ---------------- */
function setupHtml() {
  const stats = quizStats.get();
  const acc = stats.answered ? Math.round(stats.correct / stats.answered * 100) : 0;
  return `<div class="panel">
    <h2>认植物 · 小测验</h2>
    <p class="sub">题目由物种数据自动生成，共 ${S.plants.length} 种可出题；答错自动进入错题本。</p>

    <div class="field">
      <label>题型（可多选）</label>
      <div class="seg" id="type-seg">
        ${TYPES.map(t => `<button data-type="${t.id}" aria-pressed="${cfg.types.includes(t.id)}">${t.label}</button>`).join('')}
      </div>
    </div>

    <div class="field">
      <label>范围</label>
      <div class="seg" id="scope-seg">
        ${SCOPE.map(s => `<button data-scope="${s.id}" aria-pressed="${cfg.scope === s.id}">${s.label}</button>`).join('')}
      </div>
      <div id="family-slot" style="margin-top:8px;${cfg.scope === 'family' ? '' : 'display:none'}">
        <select class="select-full" id="family-select">
          <option value="">选择科…</option>
          ${S.site.families.map(f => `<option value="${escapeHtml(f)}" ${cfg.family === f ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="field">
      <label>题数</label>
      <div class="seg" id="count-seg">
        ${[10, 20, 30].map(n => `<button data-count="${n}" aria-pressed="${cfg.count === n}">${n} 题</button>`).join('')}
      </div>
    </div>

    <div class="detail-actions">
      <button class="btn primary grow" id="start-quiz">开始测验</button>
    </div>

    <div style="display:flex;gap:18px;margin-top:18px;padding-top:14px;border-top:1px solid var(--line)">
      <div style="flex:1"><div style="font-size:11px;color:var(--muted)">累计答题</div><b style="font-family:var(--font-serif);font-size:18px">${stats.answered}</b></div>
      <div style="flex:1"><div style="font-size:11px;color:var(--muted)">正确率</div><b style="font-family:var(--font-serif);font-size:18px">${acc}%</b></div>
      <div style="flex:1"><div style="font-size:11px;color:var(--muted)">最高分</div><b style="font-family:var(--font-serif);font-size:18px">${stats.best}%</b></div>
      <div style="flex:1"><div style="font-size:11px;color:var(--muted)">已掌握</div><b style="font-family:var(--font-serif);font-size:18px">${progress.masteredCount()}</b></div>
    </div>
  </div>`;
}

function bindSetup() {
  const main = rootEl.querySelector('#quiz-main');
  main.querySelector('#type-seg').addEventListener('click', e => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    const id = b.dataset.type;
    if (cfg.types.includes(id)) {
      if (cfg.types.length === 1) { toast('至少保留一种题型'); return; }
      cfg.types = cfg.types.filter(t => t !== id);
    } else cfg.types.push(id);
    b.setAttribute('aria-pressed', String(cfg.types.includes(id)));
  });
  main.querySelector('#scope-seg').addEventListener('click', e => {
    const b = e.target.closest('[data-scope]');
    if (!b) return;
    cfg.scope = b.dataset.scope;
    main.querySelectorAll('[data-scope]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.scope === cfg.scope)));
    main.querySelector('#family-slot').style.display = cfg.scope === 'family' ? '' : 'none';
  });
  main.querySelector('#family-select')?.addEventListener('change', e => { cfg.family = e.target.value; });
  main.querySelector('#count-seg').addEventListener('click', e => {
    const b = e.target.closest('[data-count]');
    if (!b) return;
    cfg.count = Number(b.dataset.count);
    main.querySelectorAll('[data-count]').forEach(x => x.setAttribute('aria-pressed', String(Number(x.dataset.count) === cfg.count)));
  });
  main.querySelector('#start-quiz').addEventListener('click', () => startQuiz());
}

/* ---------------- 出题 ---------------- */
function pool() {
  let list = S.plants.slice();
  if (cfg.scope === 'fav') list = list.filter(p => favs.has(p.id));
  if (cfg.scope === 'unmastered') list = list.filter(p => !progress.isMastered(p.id));
  if (cfg.scope === 'family' && cfg.family) list = list.filter(p => p.family === cfg.family);
  return list;
}

function nameOptions(correctPlant, excludeKey = 'name') {
  const same = S.plants.filter(p => p.id !== correctPlant.id && p.family === correctPlant.family);
  const others = S.plants.filter(p => p.id !== correctPlant.id);
  const picked = [];
  const seen = new Set([correctPlant[excludeKey]]);
  for (const src of [same, others]) {
    for (const p of shuffle(src)) {
      if (picked.length >= 3) break;
      const key = p[excludeKey];
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(p);
    }
  }
  return shuffle([{ text: correctPlant[excludeKey], correct: true },
    ...picked.map(p => ({ text: p[excludeKey], correct: false }))]);
}

function familyOptions(correctPlant) {
  const fams = shuffle(S.site.families.filter(f => f !== correctPlant.family)).slice(0, 3);
  return shuffle([{ text: correctPlant.family, correct: true }, ...fams.map(f => ({ text: f, correct: false }))]);
}

function latinOptions(correctPlant) {
  const others = shuffle(S.plants.filter(p => p.id !== correctPlant.id && p.latin)).slice(0, 3);
  return shuffle([{ text: correctPlant.latin, correct: true }, ...others.map(p => ({ text: p.latin, correct: false }))]);
}

function makeQuestion(type, plant) {
  const firstImg = plant.images[0];
  switch (type) {
    case 'image':
      if (!firstImg) return null;
      return {
        type, plantId: plant.id,
        prompt: '照片里的是哪种植物？',
        media: firstImg,
        options: nameOptions(plant),
        explain: `${plant.name}（${plant.latin}），${plant.family}${plant.genus ? ' · ' + plant.genus : ''}。`,
        quote: (plant.morphology || '').slice(0, 90),
      };
    case 'family':
      return {
        type, plantId: plant.id,
        prompt: `「${plant.name}」属于哪个科？`,
        options: familyOptions(plant),
        explain: `${plant.name} 属于 ${plant.family}。`,
        quote: (plant.morphology || '').slice(0, 90),
      };
    case 'latin':
      return {
        type, plantId: plant.id,
        prompt: `「${plant.name}」的拉丁学名是？`,
        options: latinOptions(plant),
        explain: `${plant.name}：${plant.latin}`,
        quote: (plant.morphology || '').slice(0, 90),
      };
    case 'feature': {
      const text = (plant.morphology || '').trim();
      if (text.length < 20) return null;
      return {
        type, plantId: plant.id,
        prompt: '根据下面的形态描述，判断是哪种植物：',
        quote: text.slice(0, 96) + (text.length > 96 ? '…' : ''),
        options: nameOptions(plant),
        explain: `这是 ${plant.name}（${plant.latin}）。`,
      };
    }
    case 'alias': {
      const aliases = (plant.alias || []).filter(a => a && a !== plant.name && a.length >= 2);
      if (!aliases.length) return null;
      const alias = aliases[Math.floor(Math.random() * aliases.length)];
      return {
        type, plantId: plant.id,
        prompt: `别名「${alias}」指的是哪种植物？`,
        options: nameOptions(plant),
        explain: `${alias} 是 ${plant.name} 的别名。`,
        quote: `别名：${(plant.alias || []).slice(0, 6).join('、')}`,
      };
    }
    case 'efficacy': {
      const eff = (plant.efficacy || [])[0];
      if (!eff) return null;
      return {
        type, plantId: plant.id,
        prompt: `原文记载有「${eff}」功效的是哪种植物？`,
        options: nameOptions(plant),
        explain: `${plant.name} 的原文记载包含「${eff}」。`,
        quote: (plant.derived?.efficacy?.[eff] || (plant.value || '').slice(0, 80)),
      };
    }
    default: return null;
  }
}

function startQuiz(overridePlants = null, overrideTypes = null) {
  const list = overridePlants || pool();
  if (list.length < 4) {
    toast(cfg.scope === 'fav' ? '收藏的植物太少，至少需要 4 种' : '可出题的植物不足 4 种');
    return;
  }
  const types = overrideTypes || cfg.types;
  const questions = [];
  const used = new Set();
  const targets = shuffle(list).slice(0, cfg.count);
  for (const plant of targets) {
    const t = types[Math.floor(Math.random() * types.length)];
    let q = makeQuestion(t, plant);
    if (!q) {
      for (const alt of types) { q = makeQuestion(alt, plant); if (q) break; }
    }
    if (q) { questions.push(q); used.add(plant.id); }
  }
  if (questions.length < 4) { toast('可用题目不足，换一种题型试试'); return; }
  session = {
    questions: questions.slice(0, cfg.count),
    index: 0,
    answered: 0,
    correct: 0,
    byType: {},
    picks: [],
    finished: false,
  };
  tab = 'start';
  rootEl.querySelector('#quiz-tabs button[data-tab="start"]')?.setAttribute('aria-pressed', 'true');
  paint();
}

/* ---------------- 答题 ---------------- */
function questionHtml() {
  const q = session.questions[session.index];
  const plant = plantById(q.plantId);
  const pct = Math.round(session.index / session.questions.length * 100);
  return `<div class="panel">
    <div class="quiz-progress">
      <span>${session.index + 1} / ${session.questions.length}</span>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <span>✓ ${session.correct}</span>
    </div>
    ${q.media ? `<div class="q-media"><img src="${q.media.thumb}" alt="待识别的植物照片">
      <span class="q-tag">看图识种</span></div>` : ''}
    <div class="q-text">${escapeHtml(q.prompt)}
      ${q.quote ? `<span class="quote">${escapeHtml(q.quote)}</span>` : ''}
    </div>
    <div class="options" id="q-options">
      ${q.options.map((o, i) => `<button class="opt" data-i="${i}">
        <span class="k">${'ABCD'[i]}</span><span>${escapeHtml(o.text)}</span></button>`).join('')}
    </div>
    <div id="q-feedback"></div>
    <div class="detail-actions" id="q-foot" style="display:none">
      <a class="btn" href="#/plant/${q.plantId}" style="flex:1">查看 ${escapeHtml(plant?.name || '')}</a>
      <button class="btn primary" style="flex:1" id="q-next">${session.index === session.questions.length - 1 ? '看结果' : '下一题'}</button>
    </div>
  </div>`;
}

function bindQuestion() {
  const main = rootEl.querySelector('#quiz-main');
  const q = session.questions[session.index];
  let locked = false;

  main.querySelector('#q-options').addEventListener('click', e => {
    const b = e.target.closest('.opt');
    if (!b || locked) return;
    locked = true;
    const pick = Number(b.dataset.i);
    const right = q.options.findIndex(o => o.correct);
    const ok = q.options[pick].correct;

    main.querySelectorAll('.opt').forEach((el, i) => {
      el.setAttribute('disabled', '');
      if (i === right) el.classList.add('correct');
      if (i === pick && !ok) el.classList.add('wrong');
    });

    session.answered += 1;
    session.byType[q.type] = session.byType[q.type] || { answered: 0, correct: 0 };
    session.byType[q.type].answered += 1;
    if (ok) { session.correct += 1; session.byType[q.type].correct += 1; }
    else wrongBook.add(q.plantId, q.type);
    session.picks.push({ plantId: q.plantId, type: q.type, ok });

    const fb = main.querySelector('#q-feedback');
    fb.className = 'feedback ' + (ok ? 'ok' : 'no');
    fb.innerHTML = ok
      ? `<b>答对了。</b>${escapeHtml(q.explain)}`
      : `<b>正确答案：${escapeHtml(q.options[right].text)}。</b>${escapeHtml(q.explain)} 已加入错题本。`;
    main.querySelector('#q-foot').style.display = '';
    main.querySelector('#q-next').addEventListener('click', nextQuestion, { once: true });
  });
}

function nextQuestion() {
  session.index += 1;
  if (session.index >= session.questions.length) {
    session.finished = true;
    quizStats.record({
      answered: session.answered,
      correct: session.correct,
      byType: session.byType,
    });
    paint();
    return;
  }
  paint();
}

function resultHtml() {
  const total = session.questions.length;
  const acc = total ? Math.round(session.correct / session.answered * 100) : 0;
  const wrong = session.picks.filter(p => !p.ok);
  return `<div class="panel">
    <div class="result-hero">
      <div class="score">${acc}<small>%</small></div>
      <p>答对 ${session.correct} / ${session.answered} 题 · 共 ${total} 题</p>
    </div>
    <div class="bar"><i style="width:${acc}%"></i></div>
    ${wrong.length ? `<h3 style="font-size:14px;margin-top:20px">需要复习（${wrong.length}）</h3>
      <div class="wrong-list">${wrong.map(w => {
        const p = plantById(w.plantId);
        return `<div class="wrong-item"><a href="#/plant/${w.plantId}" style="font-family:var(--font-serif)">${escapeHtml(p?.name || '')}</a>
          <span style="color:var(--muted);font-size:11.5px">${escapeHtml(TYPES.find(t => t.id === w.type)?.label || '')}</span></div>`;
      }).join('')}</div>` : '<p style="text-align:center;color:var(--brand-2);font-size:13px;margin-top:14px">全部答对，状态不错。</p>'}
    <div class="detail-actions">
      <button class="btn grow" id="again">再来一轮</button>
      <button class="btn primary grow" id="review-wrong" ${wrong.length ? '' : 'disabled'}>重练错题</button>
    </div>
  </div>`;
}

function bindResult() {
  const main = rootEl.querySelector('#quiz-main');
  main.querySelector('#again').addEventListener('click', () => { session = null; paint(); });
  main.querySelector('#review-wrong')?.addEventListener('click', () => {
    const ids = [...new Set(session.picks.filter(p => !p.ok).map(p => p.plantId))];
    const plants = ids.map(plantById).filter(Boolean);
    session = null;
    startQuiz(plants, cfg.types);
  });
}

/* ---------------- 错题本 ---------------- */
function wrongHtml() {
  const items = wrongBook.list();
  if (!items.length) {
    return `<div class="panel"><h2>错题本</h2><p class="sub">还没有错题。做完一轮测验后，答错的物种会自动出现在这里。</p>
      <div class="detail-actions"><button class="btn primary grow" data-go-start>去测验</button></div></div>`;
  }
  return `<div class="panel">
    <h2>错题本</h2>
    <p class="sub">按错误次数排序，共 ${items.length} 条。</p>
    <div class="wrong-list">
      ${items.map(it => {
        const p = plantById(it.plantId);
        if (!p) return '';
        return `<div class="wrong-item">
          <a href="#/plant/${p.id}" style="font-family:var(--font-serif)">${escapeHtml(p.name)}</a>
          <span style="color:var(--muted);font-size:11.5px">${escapeHtml(TYPES.find(t => t.id === it.type)?.label || '')}</span>
          <span class="k">错 ${it.times} 次</span>
          <button class="icon-btn" data-forget="${it.type}:${it.plantId}" aria-label="移出错题本">${icons.trash}</button>
        </div>`;
      }).join('')}
    </div>
    <div class="detail-actions">
      <button class="btn grow" data-clear-wrong>清空</button>
      <button class="btn primary grow" data-retry>重练全部</button>
    </div>
    <p style="font-size:11px;color:var(--muted);margin-top:12px">错题本只记录「题型 + 物种」，不保存作答图片。</p>
  </div>`;
}

function bindWrong() {
  const main = rootEl.querySelector('#quiz-main');
  main.querySelector('[data-go-start]')?.addEventListener('click', () => { tab = 'start'; paint(); });
  main.querySelector('[data-clear-wrong]')?.addEventListener('click', () => {
    wrongBook.clear();
    toast('错题本已清空');
    paint();
  });
  main.querySelector('[data-retry]')?.addEventListener('click', () => {
    const plants = [...new Set(wrongBook.list().map(x => x.plantId))].map(plantById).filter(Boolean);
    if (plants.length < 4) { toast('错题不足 4 种，先做一轮测验吧'); return; }
    tab = 'start';
    startQuiz(plants, cfg.types);
  });
  main.querySelectorAll('[data-forget]').forEach(b => b.addEventListener('click', () => {
    const [type, id] = b.dataset.forget.split(':');
    wrongBook.remove(Number(id), type);
    paint();
  }));
}
