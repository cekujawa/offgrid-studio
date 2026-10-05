/* ===== core: helpers, state, evaluation, element renderers ===== */
const { fmtValue } = Data;
const N = Formula.N;
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clone = o => JSON.parse(JSON.stringify(o));
const uid = p => p + Math.random().toString(36).slice(2, 9);
const round = (v, d = 0) => { const k = Math.pow(10, d); return Math.round(v * k) / k; };

function add(parent, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    parent.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return parent;
}
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected' || k === 'textContent') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  return add(el, kids);
}
const NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
  return add(el, kids);
}
const ICONS = {
  kpi: '<rect x="2" y="3" width="12" height="10" rx="2"/><path d="M5 7h3.5M5 10h6"/>',
  bar: '<path d="M2.5 13.5h11M4.5 13V8M8 13V3.5M11.5 13V6"/>',
  hbar: '<path d="M2.5 2.5v11M3 4.5h6M3 8h9.5M3 11.5h4"/>',
  line: '<path d="M2.5 13.5h11M3 10.5l3-3.5 2.5 2L13 4"/>',
  area: '<path d="M2.5 13.5h11M3 11l3-4 2.5 2L13 4.5V11z"/>',
  pie: '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5V8l4 3.7"/>',
  scatter: '<path d="M2.5 2.5v11h11"/><circle cx="6" cy="9.5" r=".9"/><circle cx="8.5" cy="6.5" r=".9"/><circle cx="11.5" cy="8.5" r=".9"/><circle cx="11" cy="4" r=".9"/>',
  table: '<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6.5h12M2 9.8h12M6.5 6.5V13"/>',
  text: '<path d="M3.5 4.5v-1h9v1M8 3.5v9M6.3 12.5h3.4"/>',
  container: '<rect x="2" y="2.5" width="12" height="11" rx="2.5" stroke-dasharray="2.2 1.8"/>',
  image: '<rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.7" cy="6.4" r="1.1"/><path d="M2.5 11.5l3.5-3 2.5 2 2-1.8 3 2.8"/>',
  rect: '<rect x="2.5" y="4" width="11" height="8" rx="1"/>',
  ellipse: '<ellipse cx="8" cy="8" rx="5.5" ry="4.5"/>',
  triangle: '<path d="M8 3l5.5 9.5h-11z"/>',
  diamond: '<path d="M8 2.5L13.5 8 8 13.5 2.5 8z"/>',
  star: '<path d="M8 2.3l1.7 3.6 3.9.5-2.9 2.7.8 3.9L8 11.1 4.5 13l.8-3.9L2.4 6.4l3.9-.5z"/>',
  hexagon: '<path d="M5 3h6l3 5-3 5H5L2 8z"/>',
  ring: '<circle cx="8" cy="8" r="5"/><path d="M8 3a5 5 0 0 1 4.6 7" stroke-width="2.6"/>',
  lineS: '<path d="M3 13L13 3"/>',
  arrow: '<path d="M3 13L13 3M7.5 3H13v5.5"/>',
  filter: '<path d="M2.5 3.5h11L9.5 8.5v4l-3 1v-5z"/>',
  calendar: '<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/>',
  slider: '<path d="M2 8h2.5M9.5 8H14"/><circle cx="7" cy="8" r="2.3"/>',
  undo: '<path d="M5 4L2.5 6.5 5 9M2.5 6.5h6.5a3.5 3.5 0 0 1 0 7H7"/>',
  redo: '<path d="M11 4l2.5 2.5L11 9M13.5 6.5H7a3.5 3.5 0 0 0 0 7h2"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  minus: '<path d="M3 8h10"/>',
  fit: '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>',
  eye: '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
  eyeoff: '<path d="M2.5 2.5l11 11M6.2 4A6.6 6.6 0 0 1 8 3.5c4 0 6.5 4.5 6.5 4.5a11 11 0 0 1-2 2.5M9.9 12.1A6 6 0 0 1 8 12.5C4 12.5 1.5 8 1.5 8a11 11 0 0 1 2.4-2.8"/>',
  lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
  unlock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 4.8-1"/>',
  trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/>',
  copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"/>',
  up: '<path d="M8 12.5v-9M4.5 7L8 3.5 11.5 7"/>',
  down: '<path d="M8 3.5v9M4.5 9L8 12.5 11.5 9"/>',
  top: '<path d="M3 2.5h10M8 13.5V6M5 8.5l3-3 3 3"/>',
  bottom: '<path d="M3 13.5h10M8 2.5V10M5 7.5l3 3 3-3"/>',
  upload: '<path d="M8 10.5v-8M5 5.5l3-3 3 3M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2"/>',
  download: '<path d="M8 2.5v8M5 7.5l3 3 3-3M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2"/>',
  paste: '<rect x="3" y="3.5" width="10" height="10.5" rx="1.5"/><path d="M6 3.5V2.5h4v1M5.5 8h5M5.5 10.5h3.5"/>',
  db: '<ellipse cx="8" cy="4" rx="5" ry="1.8"/><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8"/>',
  play: '<path d="M5 3.5v9l7-4.5z"/>',
  pencil: '<path d="M3 13l.6-2.8 7-7 2.2 2.2-7 7zM9.5 4.3l2.2 2.2"/>',
  dots: '<circle cx="3.5" cy="8" r=".9"/><circle cx="8" cy="8" r=".9"/><circle cx="12.5" cy="8" r=".9"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  warn: '<path d="M8 2.5l6 10.5H2zM8 6.5v3M8 11.3v.2"/>',
  alignL: '<path d="M2.5 2v12M5 5h6M5 9.5h8.5"/>',
  alignC: '<path d="M8 2v12M4.5 5h7M3 9.5h10"/>',
  alignR: '<path d="M13.5 2v12M5 5h6M2.5 9.5H11"/>',
  alignT: '<path d="M2 2.5h12M5 5v6M9.5 5v8.5"/>',
  alignM: '<path d="M2 8h12M5 4.5v7M9.5 3v10"/>',
  alignB: '<path d="M2 13.5h12M5 5v6M9.5 2.5V11"/>',
  distH: '<path d="M2.5 2v12M13.5 2v12"/><rect x="6" y="5" width="4" height="6" rx=".8"/>',
  distV: '<path d="M2 2.5h12M2 13.5h12"/><rect x="5" y="6" width="6" height="4" rx=".8"/>',
  tLeft: '<path d="M2.5 4h11M2.5 8h7M2.5 12h9"/>',
  tCenter: '<path d="M2.5 4h11M4.5 8h7M3.5 12h9"/>',
  tRight: '<path d="M2.5 4h11M6.5 8h7M4.5 12h9"/>',
  book: '<path d="M3 3h4a1.5 1.5 0 0 1 1 .5 1.5 1.5 0 0 1 1-.5h4v9.5H9a1 1 0 0 0-1 .7 1 1 0 0 0-1-.7H3zM8 3.5v9.5"/>',
  layers: '<path d="M8 2.5l6 3-6 3-6-3zM2 8.5l6 3 6-3M2 11l6 3 6-3"/>',
  design: '<path d="M2.5 4.5h6.5M12 4.5h1.5M2.5 11.5h1.5M7 11.5h6.5"/><circle cx="10.5" cy="4.5" r="1.5"/><circle cx="5.5" cy="11.5" r="1.5"/>',
  calc: '<path d="M10.5 3.5c-2-.6-3 .4-3.3 2.2L6 12.5c-.3 1.6-1.300 2-2.500 1.500M4.5 7.500h5"/>',
};
function ic(name) {
  const s = sv('svg', { class: 'ic', viewBox: '0 0 16 16', 'aria-hidden': 'true' });
  s.innerHTML = ICONS[name] || '';
  return s;
}

/* ---------- state ---------- */
const S = {
  board: null, pageId: null, sel: new Set(), mode: 'edit',
  view: { x: 40, y: 40, z: 1 }, views: new Map(),
  datasets: new Map(), images: new Map(),
  canWrite: true, ready: false, undo: [], redo: [], lastSnap: '',
  leftTab: 'insert', fxKey: null, struct: 0, evalEpoch: 0, themeEpoch: 0, dataEpoch: 0,
  save: { state: 'idle', msg: '' }, clip: null, sheet: null, canExport: false,
};
const page = () => S.board.pages.find(p => p.id === S.pageId) || S.board.pages[0];
const els = () => page().els;
const elById = id => els().find(e => e.id === id);
const selEls = () => els().filter(e => S.sel.has(e.id));
const one = () => (S.sel.size === 1 ? elById([...S.sel][0]) : null);
const dsOf = el => S.datasets.get(el.ds) || null;
const firstDs = () => S.datasets.values().next().value || null;
function colSet(ds) { if (!ds._cols) ds._cols = new Set(ds.columns.map(c => c.name)); return ds._cols; }
const colType = (ds, name) => { const c = ds && ds.columns.find(x => x.name === name); return c ? c.type : null; };
const keyOf = v => (v == null || v === '' ? '(blank)' : v instanceof Date ? Formula.isoLocal(v, true) : String(v));
const FONTS = {
  '': 'var(--f-ui)',
  bricolage: '"Bricolage Grotesque", var(--f-ui)',
  fraunces: '"Fraunces", Georgia, serif',
  condensed: '"Barlow Condensed", "Arial Narrow", sans-serif',
  mono: 'var(--f-mono)',
};

/* ---------- datasets ---------- */
function touchDs(ds) { ds._cols = null; ds._distinct = null; S.evalEpoch++; S.dataEpoch++; }
function recomputeCalc(ds) {
  ds._cols = null; ds._distinct = null;
  const calc = ds.columns.filter(c => c.formula);
  if (!calc.length) return;
  const known = new Set(ds.columns.filter(c => !c.formula).map(c => c.name));
  for (const c of calc) {
    c.error = null;
    const cache = new Map();
    try {
      const env = { rows: ds.rows, row: null, params: {}, cache, cols: known, dsName: `"${ds.name}"` };
      const out = new Array(ds.rows.length);
      for (let i = 0; i < ds.rows.length; i++) { env.row = ds.rows[i]; out[i] = Formula.evaluate(c.formula, env); }
      for (let i = 0; i < ds.rows.length; i++) ds.rows[i][c.name] = out[i];
      c.type = Data.inferType(out.slice(0, 500));
    } catch (e) {
      c.error = e.message;
      for (const r of ds.rows) r[c.name] = null;
    }
    known.add(c.name);
  }
}
function distinct(ds, col) {
  if (!ds._distinct) ds._distinct = {};
  if (!ds._distinct[col]) {
    const m = new Map();
    for (const r of ds.rows) { const k = keyOf(r[col]); if (!m.has(k)) m.set(k, r[col]); }
    const type = colType(ds, col);
    const keys = [...m.keys()].sort((a, b) => (type === 'number' ? (m.get(a) ?? 0) - (m.get(b) ?? 0) : a.localeCompare(b, undefined, { numeric: true })));
    ds._distinct[col] = { keys, index: new Map(keys.map((k, i) => [k, i])) };
  }
  return ds._distinct[col];
}

/* ---------- evaluation pass ---------- */
let pass = null;
function presetRange(c) {
  const today = Formula.trunc('day', new Date());
  const end = Formula.dateAdd('day', 1, today);
  const p = c.preset || 'all';
  if (p === 'custom') return [c.from ? Formula.parseDate(c.from) : null, c.to ? Formula.dateAdd('day', 1, Formula.parseDate(c.to)) : null];
  if (/^\d+d$/.test(p)) return [Formula.dateAdd('day', -parseInt(p, 10) + 1, today), end];
  if (p === 'mtd') return [Formula.trunc('month', today), end];
  if (p === 'qtd') return [Formula.trunc('quarter', today), end];
  if (p === 'ytd') return [Formula.trunc('year', today), end];
  return [null, null];
}
function getPass() {
  const pg = page();
  const ctrls = pg.els.filter(e => e.type === 'control');
  const sig = pg.id + JSON.stringify(ctrls.map(c => [c.control, c.ds, c.col, c.values, c.preset, c.from, c.to, c.param, c.value]));
  if (!pass || pass.epoch !== S.evalEpoch || pass.sig !== sig) {
    if (pass && pass.sig !== sig && pass.epoch === S.evalEpoch) S.evalEpoch++;
    const params = {};
    const preds = new Map();
    const addPred = (ds, f) => { if (!preds.has(ds)) preds.set(ds, []); preds.get(ds).push(f); };
    for (const c of ctrls) {
      if (c.control === 'slider') { if (c.param) params[c.param.trim().toLowerCase()] = N(c.value) ?? 0; continue; }
      if (!c.ds || !c.col) continue;
      if (c.control === 'filter' && c.values && c.values.length) {
        const set = new Set(c.values), col = c.col;
        addPred(c.ds, r => set.has(keyOf(r[col])));
      } else if (c.control === 'daterange') {
        const [from, to] = presetRange(c), col = c.col;
        if (from || to) addPred(c.ds, r => { const d = r[col]; return d instanceof Date && (!from || d >= from) && (!to || d < to); });
      }
    }
    pass = { epoch: S.evalEpoch, sig, params, preds, filtered: new Map(), cache: new Map() };
  }
  return pass;
}
function rowsFor(el) {
  const ds = dsOf(el); if (!ds) return [];
  if (el.ignoreFilters || el.type === 'control') return ds.rows;
  const P = getPass();
  let r = P.filtered.get(ds.id);
  if (!r) {
    const preds = P.preds.get(ds.id);
    r = preds ? ds.rows.filter(row => preds.every(p => p(row))) : ds.rows;
    P.filtered.set(ds.id, r);
  }
  return r;
}
function envFor(el, rows, keys) {
  const ds = dsOf(el), P = getPass();
  return { rows: rows || rowsFor(el), keys, params: P.params, cache: P.cache, cols: ds ? colSet(ds) : null, dsName: ds ? `"${ds.name}"` : '' };
}
const evalF = (el, src, rows, keys) => Formula.evaluate(src, envFor(el, rows, keys));
const filled = s => typeof s === 'string' && s.trim() !== '';

function effective(el) {
  const out = { hidden: false, fill: null, color: null, border: null, err: null };
  try {
    if (filled(el.vis) && !Formula.truthy(evalF(el, el.vis))) out.hidden = true;
    for (const r of el.rules || []) {
      if (!filled(r.when)) continue;
      if (Formula.truthy(evalF(el, r.when))) { if (r.effect === 'hide') out.hidden = true; else out[r.effect || 'fill'] = r.color || null; }
    }
  } catch (e) { out.err = e; }
  return out;
}

/* text with {{ formula | format }} slots */
const PIPE = /^([\s\S]*[^|])\|(?!\|)\s*([a-z0-9: ]+)$/i;
function pipeFmt(spec) {
  const f = {};
  for (const tok of spec.trim().toLowerCase().split(/\s+/)) {
    const [name, d] = tok.split(':');
    if (name === 'compact') f.compact = true;
    else if (['currency', 'percent', 'number'].includes(name)) f.type = name;
    else if (['iso', 'short', 'monthyear'].includes(name)) f.date = name === 'monthyear' ? 'monthYear' : name;
    if (d != null && d !== '') f.decimals = +d;
  }
  return f;
}
function template(el, text) {
  const parts = []; let last = 0; const re = /\{\{([\s\S]*?)\}\}/g; let m;
  while ((m = re.exec(text || ''))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    let src = m[1], f = null;
    const p = PIPE.exec(src);
    if (p) { src = p[1]; f = pipeFmt(p[2]); }
    try { parts.push(fmtValue(evalF(el, src), f)); } catch (e) { parts.push({ err: e.message }); }
    last = m.index + m[0].length;
  }
  if (last < (text || '').length) parts.push(text.slice(last));
  return parts;
}
function templateInto(node, el, text) {
  for (const p of template(el, text)) node.append(typeof p === 'string' ? p : h('span', { class: 'tpl-err', title: p.err }, `⚠ ${p.err}`));
}
const templateText = (el, text) => template(el, text).map(p => (typeof p === 'string' ? p : '⚠')).join('');

/* ---------- colours ---------- */
const cssVar = name => getComputedStyle($('#viewport')).getPropertyValue(name).trim();
function resolveColor(c) {
  if (!c) return c;
  const m = /^var\((--[\w-]+)\)$/.exec(c);
  return m ? cssVar(m[1]) : c;
}
function alpha(c, a) {
  c = resolveColor(c) || '#888888';
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) c = '#' + m[1].split('').map(x => x + x).join('');
  m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) { const n = parseInt(m[1], 16); return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; }
  return `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;
}
const seriesColor = i => cssVar('--s' + ((i % 8) + 1));

/* ---------- box styling ---------- */
const CARD = { fill: 'var(--d-surface)', border: 'var(--d-border)', bw: 1, radius: 14, shadow: true, pad: 16 };
const PLAIN = { fill: 'transparent', border: 'var(--d-border)', bw: 0, radius: 0, shadow: false, pad: 4 };
const BOX = { kpi: CARD, chart: CARD, table: CARD, control: { ...CARD, pad: 12, radius: 12 }, text: PLAIN, image: { ...PLAIN, pad: 0 } };
function boxStyle(el, body, fx) {
  const s = el.style || {}, d = BOX[el.type] || PLAIN;
  const st = body.style;
  st.background = fx.fill || s.fill || d.fill;
  const bw = s.bw ?? d.bw;
  st.border = bw ? `${bw}px solid ${fx.border || s.border || d.border}` : (fx.border ? `2px solid ${fx.border}` : 'none');
  st.borderRadius = (s.radius ?? d.radius) + 'px';
  st.boxShadow = (s.shadow ?? d.shadow) ? 'var(--d-shadow)' : 'none';
  st.padding = (s.pad ?? d.pad) + 'px';
  st.opacity = s.opacity ?? 1;
  st.color = fx.color || s.color || 'var(--d-ink)';
  if (s.font) st.fontFamily = FONTS[s.font] || '';
}
function errBox(e) {
  const msg = e && e.message ? e.message : String(e);
  return h('div', { class: 'el-err' }, ic('warn'), h('span', null, msg));
}
const emptyBox = msg => h('div', { class: 'el-empty' }, msg);

/* ---------- renderers ---------- */
const charts = new Map();
function destroyChart(id) { const c = charts.get(id); if (c) { try { c.destroy(); } catch (e) { /* already gone */ } charts.delete(id); } }

function bucketRows(el, col, bucket, rows) {
  const groups = new Map();
  for (const r of rows) {
    const d = r[col]; if (!(d instanceof Date)) continue;
    const t = +Formula.trunc(bucket || 'month', d);
    let g = groups.get(t); if (!g) groups.set(t, g = []); g.push(r);
  }
  return [...groups.keys()].sort((a, b) => a - b).map(t => ({ t, rows: groups.get(t) }));
}

const RENDER = {};
RENDER.kpi = (el, body, fx) => {
  boxStyle(el, body, fx);
  const s = el.style || {};
  const hasSpark = !!(el.spark && el.spark.col);
  const align = s.align || 'left';
  const wrap = h('div', { class: 'kpi' });
  wrap.style.alignItems = hasSpark ? 'stretch' : { left: 'flex-start', center: 'center', right: 'flex-end' }[align];
  wrap.style.textAlign = align;
  wrap.style.justifyContent = hasSpark ? 'flex-start' : 'center';
  body.append(wrap);
  if (el.label) wrap.append(h('div', { class: 'kpi-label' }, el.label));
  if (!filled(el.f)) { wrap.append(emptyBox('Select this KPI and write its formula in the bar above.')); return; }
  let val;
  try { val = evalF(el, el.f); } catch (e) { wrap.append(errBox(e)); return; }
  const text = fmtValue(val, el.fmt);
  const v = h('div', { class: 'kpi-value' }, text);
  const perChar = (100 / (Math.max(text.length, 3) * 0.6)).toFixed(1);
  v.style.fontSize = s.size ? s.size + 'px' : `clamp(14px, min(${hasSpark ? 30 : 40}cqh, ${perChar}cqw), 640px)`;
  if (s.weight) v.style.fontWeight = s.weight;
  wrap.append(v);
  if (filled(el.cmp)) {
    try {
      const cur = N(val), base = N(evalF(el, el.cmp));
      if (cur != null && base != null) {
        const diff = cur - base;
        const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
        const good = dir === 'flat' ? '' : (dir === 'up') === (el.upGood !== false) ? 'good' : 'bad';
        const amount = el.cmpMode === 'abs' ? fmtValue(Math.abs(diff), el.fmt) : base === 0 ? '–' : fmtValue(Math.abs(diff / base), { type: 'percent', decimals: 1 });
        const arrow = sv('svg', { viewBox: '0 0 10 10', 'aria-hidden': 'true' }, sv('path', { d: dir === 'up' ? 'M5 1l4.5 8h-9z' : dir === 'down' ? 'M5 9L.5 1h9z' : 'M1 4h8v2H1z' }));
        const d = h('div', { class: 'kpi-delta' }, h('b', { class: good }, arrow, `${dir === 'down' ? 'Down ' : dir === 'up' ? 'Up ' : ''}${amount}`), el.cmpLabel ? h('span', null, el.cmpLabel) : null);
        d.style.justifyContent = { left: 'flex-start', center: 'center', right: 'flex-end' }[align];
        wrap.append(d);
      }
    } catch (e) { wrap.append(errBox(e)); }
  }
  if (hasSpark) {
    try {
      const src = filled(el.spark.f) ? el.spark.f : el.f;
      const pts = bucketRows(el, el.spark.col, el.spark.bucket, rowsFor(el)).map(g => N(evalF(el, src, g.rows)) ?? 0);
      if (pts.length > 1) {
        const lo = Math.min(...pts, 0), hi = Math.max(...pts), span = hi - lo || 1;
        const xy = pts.map((p, i) => [(i / (pts.length - 1)) * 100, 96 - ((p - lo) / span) * 92]);
        const line = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ');
        const color = s.accent || 'var(--s1)';
        const svg = sv('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none' },
          sv('path', { d: `${line} L100 100 L0 100 Z`, fill: color, 'fill-opacity': '.12', stroke: 'none' }),
          sv('path', { d: line, fill: 'none', stroke: color, 'stroke-width': '2', 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
        const dot = h('i'); dot.style.top = xy[xy.length - 1][1] + '%'; dot.style.background = color;
        wrap.append(h('div', { class: 'spark' }, svg, dot));
      }
    } catch (e) { wrap.append(errBox(e)); }
  }
};

function chartData(el) {
  const ds = dsOf(el);
  if (!ds) return { empty: 'Pick a data source for this chart in the panel on the right.' };
  const measures = (el.measures || []).filter(m => filled(m.f));
  if (!measures.length) return { empty: 'Add a measure, like Sum([Revenue]).' };
  const col = el.cat && el.cat.col;
  if (!col || !colSet(ds).has(col)) return { empty: 'Pick a category column for this chart.' };
  const rows = rowsFor(el);
  const type = colType(ds, col), isDate = type === 'date', bucket = (el.cat && el.cat.bucket) || 'month';
  const groups = new Map();
  for (const r of rows) {
    let v = r[col], k;
    if (isDate) { if (!(v instanceof Date)) continue; v = Formula.trunc(bucket, v); k = +v; } else k = keyOf(v);
    let g = groups.get(k); if (!g) groups.set(k, g = { k, v, rows: [] }); g.rows.push(r);
  }
  let list = [...groups.values()];
  if (!list.length) return { empty: 'No rows match the current filters.' };
  const keysFor = g => ({ [col]: g.v });
  const first = g => { if (g._m == null) g._m = N(evalF(el, measures[0].f, g.rows, keysFor(g))) ?? 0; return g._m; };
  const sort = el.sort || 'auto';
  if (isDate || (type === 'number' && sort === 'auto') ) list.sort((a, b) => (a.k < b.k ? -1 : 1));
  else if (sort === 'label') list.sort((a, b) => String(a.k).localeCompare(String(b.k), undefined, { numeric: true }));
  else if (sort === 'valueAsc') list.sort((a, b) => first(a) - first(b));
  else list.sort((a, b) => first(b) - first(a));
  const limit = +el.limit || (el.chart === 'pie' ? 7 : 0);
  if (limit && !isDate && list.length > limit) {
    const rest = list.slice(limit);
    list = list.slice(0, limit);
    if (el.chart !== 'scatter') list.push({ k: 'Other', v: 'Other', rows: rest.flatMap(g => g.rows), other: true });
  }
  const labels = list.map(g => (isDate ? Data.bucketLabel(g.v, bucket) : String(g.k)));
  const out = { labels, list, col, ds, isDate };
  if (el.chart === 'scatter') {
    if (measures.length < 2) return { empty: 'A scatter plot needs two measures: one for each axis.' };
    out.points = list.map((g, i) => ({ x: N(evalF(el, measures[0].f, g.rows, keysFor(g))), y: N(evalF(el, measures[1].f, g.rows, keysFor(g))), label: labels[i] })).filter(p => p.x != null && p.y != null);
    out.axes = [measures[0].name, measures[1].name];
    return out;
  }
  if (el.chart === 'pie') {
    const di = isDate ? null : distinct(ds, col);
    out.series = [{ name: measures[0].name || 'Value', data: list.map(g => N(evalF(el, measures[0].f, g.rows, keysFor(g)))) }];
    out.colors = list.map((g, i) => (g.other ? cssVar('--d-muted') : seriesColor(di ? di.index.get(g.k) ?? i : i)));
    return out;
  }
  if (filled(el.split) && colSet(ds).has(el.split)) {
    const sc = el.split, m = measures[0], di = distinct(ds, sc);
    const totals = new Map();
    for (const g of list) {
      g.parts = new Map();
      for (const r of g.rows) { const k = keyOf(r[sc]); let p = g.parts.get(k); if (!p) g.parts.set(k, p = []); p.push(r); }
      for (const [k, p] of g.parts) totals.set(k, (totals.get(k) || 0) + p.length);
    }
    let keys = [...totals.keys()].sort((a, b) => di.index.get(a) - di.index.get(b));
    let folded = null;
    if (keys.length > 7) {
      const keep = new Set([...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(e => e[0]));
      folded = keys.filter(k => !keep.has(k)); keys = keys.filter(k => keep.has(k));
    }
    out.series = keys.map(k => ({ name: k, color: seriesColor(di.index.get(k)), data: list.map(g => (g.parts.has(k) ? N(evalF(el, m.f, g.parts.get(k), { ...keysFor(g), [sc]: k })) : null)) }));
    if (folded) out.series.push({ name: 'Other', color: cssVar('--d-muted'), data: list.map(g => { const rs = folded.flatMap(k => g.parts.get(k) || []); return rs.length ? N(evalF(el, m.f, rs, keysFor(g))) : null; }) });
    return out;
  }
  out.series = measures.map((m, i) => ({ name: m.name || `Measure ${i + 1}`, color: resolveColor(m.color) || seriesColor(i), data: list.map(g => N(evalF(el, m.f, g.rows, keysFor(g)))) }));
  return out;
}

RENDER.chart = (el, body, fx) => {
  boxStyle(el, body, fx);
  if (el.title) body.append(h('div', { class: 'ttl' }, el.title));
  const wrap = h('div', { class: 'chart-wrap' }); body.append(wrap);
  if (!window.Chart) { wrap.append(emptyBox('The chart library did not load. Check the connection and reload.')); return; }
  let d;
  try { d = chartData(el); } catch (e) { wrap.append(errBox(e)); return; }
  if (d.empty) { wrap.append(emptyBox(d.empty)); return; }
  const canvas = h('canvas', { role: 'img', 'aria-label': el.title || el.name || 'Chart' }); wrap.append(canvas);
  const ink = cssVar('--d-ink'), ink2 = cssVar('--d-ink2'), muted = cssVar('--d-muted'), grid = cssVar('--d-grid');
  const surface = resolveColor((el.style && el.style.fill) || 'var(--d-surface)');
  const font = { family: getComputedStyle(body).fontFamily, size: 11.5 };
  const f = el.fmt || {};
  const tick = v => fmtValue(v, f.type === 'percent' ? { ...f, decimals: f.decimals ?? 0 } : { ...f, compact: true, decimals: undefined });
  const full = v => fmtValue(v, f);
  const kind = el.chart || 'bar', horiz = kind === 'hbar';
  const multi = d.series && d.series.length > 1;
  const legend = { display: el.legend !== false && (multi || kind === 'pie'), position: 'bottom', labels: { color: ink2, font, usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 12 } };
  const tooltip = { backgroundColor: ink, titleColor: surface, bodyColor: surface, titleFont: { ...font, weight: '600' }, bodyFont: font, padding: 9, cornerRadius: 7, boxPadding: 4, usePointStyle: true };
  const cat = { grid: { display: false }, border: { color: grid }, ticks: d.isDate || d.labels.length > 14 ? { color: muted, font, maxRotation: 0, autoSkipPadding: 12 } : { color: muted, font, autoSkip: false, maxRotation: 40 } };
  const val = { grid: { color: grid }, border: { display: false }, beginAtZero: true, ticks: { color: muted, font, callback: tick, maxTicksLimit: 6 } };
  let cfg;
  const base = { responsive: true, maintainAspectRatio: false, animation: false, devicePixelRatio: chartDpr(), layout: { padding: { top: 4, right: 4 } } };
  if (kind === 'scatter') {
    cfg = { type: 'scatter', data: { datasets: [{ label: d.col, data: d.points, backgroundColor: alpha(seriesColor(0), 0.85), borderColor: surface, borderWidth: 2, pointRadius: 5, pointHoverRadius: 7 }] },
      options: { ...base, plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { title: i => i[0].raw.label, label: c => [`${d.axes[0]}: ${full(c.raw.x)}`, `${d.axes[1]}: ${full(c.raw.y)}`] } } },
        scales: { x: { ...val, beginAtZero: false, title: { display: true, text: d.axes[0], color: muted, font } }, y: { ...val, beginAtZero: false, title: { display: true, text: d.axes[1], color: muted, font } } } } };
  } else if (kind === 'pie') {
    const total = d.series[0].data.reduce((a, b) => a + (b || 0), 0);
    cfg = { type: 'doughnut', data: { labels: d.labels, datasets: [{ data: d.series[0].data, backgroundColor: d.colors, borderColor: surface, borderWidth: 2, hoverOffset: 4 }] },
      options: { ...base, cutout: el.donut === false ? 0 : '58%', plugins: { legend: { ...legend, position: 'right' }, tooltip: { ...tooltip, callbacks: { label: c => ` ${c.label}: ${full(c.raw)}${total ? ` (${fmtValue(c.raw / total, { type: 'percent', decimals: 1 })})` : ''}` } } } } };
  } else {
    const isLine = kind === 'line' || kind === 'area';
    const stacked = !!el.stacked && multi;
    const datasets = d.series.map(s => (isLine
      ? { label: s.name, data: s.data, borderColor: s.color, backgroundColor: kind === 'area' ? alpha(s.color, stacked ? 0.55 : 0.12) : s.color, fill: kind === 'area' ? (stacked ? 'stack' : 'origin') : false, borderWidth: 2, tension: el.smooth ? 0.35 : 0, pointRadius: d.labels.length > 40 ? 0 : 2.5, pointHoverRadius: 5, pointBackgroundColor: s.color, pointBorderColor: surface, pointBorderWidth: 1.5, spanGaps: true }
      : { label: s.name, data: s.data, backgroundColor: s.color, borderRadius: 4, maxBarThickness: 28, borderColor: surface, borderWidth: stacked ? (horiz ? { right: 2 } : { top: 2 }) : 0 }));
    const sx = { ...cat, stacked }, sy = { ...val, stacked };
    cfg = { type: isLine ? 'line' : 'bar', data: { labels: d.labels, datasets },
      options: { ...base, indexAxis: horiz ? 'y' : 'x', interaction: { mode: 'index', intersect: false, axis: horiz ? 'y' : 'x' },
        plugins: { legend, tooltip: { ...tooltip, callbacks: { label: c => ` ${c.dataset.label}: ${full(c.raw)}` } } },
        scales: horiz ? { x: sy, y: { ...sx, ticks: { ...cat.ticks, autoSkip: false } } } : { x: sx, y: sy } } };
  }
  charts.set(el.id, new window.Chart(canvas, cfg));
};
function chartDpr() { return (window.devicePixelRatio || 1) * clamp(S.view.z, 1, 3); }

function tableData(el) {
  const ds = dsOf(el);
  if (!ds) return { empty: 'Pick a data source for this table in the panel on the right.' };
  const rows = rowsFor(el);
  let cols, data;
  if ((el.mode || 'summary') === 'summary') {
    const group = (el.group || []).filter(c => colSet(ds).has(c));
    const measures = (el.measures || []).filter(m => filled(m.f));
    if (!group.length && !measures.length) return { empty: 'Choose columns to group by and add a measure.' };
    const groups = new Map();
    for (const r of rows) {
      const k = group.map(c => keyOf(r[c])).join('\u0001');
      let g = groups.get(k); if (!g) groups.set(k, g = { vals: group.map(c => r[c]), rows: [] }); g.rows.push(r);
    }
    cols = [...group.map(c => ({ name: c, type: colType(ds, c) })), ...measures.map(m => ({ name: m.name || 'Measure', type: 'number', fmt: m.fmt ? { type: m.fmt } : el.fmt }))];
    data = [...groups.values()].map(g => {
      const keys = {}; group.forEach((c, i) => { keys[c] = g.vals[i]; });
      return [...g.vals, ...measures.map(m => evalF(el, m.f, g.rows, keys))];
    });
  } else {
    const names = (el.cols && el.cols.length ? el.cols : ds.columns.map(c => c.name)).filter(c => colSet(ds).has(c));
    cols = names.map(c => ({ name: c, type: colType(ds, c) }));
    data = rows.map(r => names.map(c => r[c]));
  }
  const si = el.sortCol ? cols.findIndex(c => c.name === el.sortCol) : -1;
  if (si >= 0) {
    const dir = el.sortDir === 'asc' ? 1 : -1;
    data = data.slice().sort((a, b) => { const c = Formula.cmp(a[si], b[si]); return (c == null ? (a[si] == null ? 1 : -1) * dir : c) * dir; });
  }
  return { cols, data, total: data.length };
}
RENDER.table = (el, body, fx) => {
  boxStyle(el, body, fx);
  if (el.title) body.append(h('div', { class: 'ttl' }, el.title));
  let d;
  try { d = tableData(el); } catch (e) { body.append(errBox(e)); return; }
  if (d.empty) { body.append(emptyBox(d.empty)); return; }
  const limit = +el.limit || 100;
  const head = h('tr', null, d.cols.map(c => {
    const on = el.sortCol === c.name;
    return h('th', { class: c.type === 'number' ? 'num' : '', onclick: () => { el.sortDir = on && el.sortDir !== 'asc' ? 'asc' : 'desc'; el.sortCol = c.name; S.struct++; commit(); } }, c.name + (on ? (el.sortDir === 'asc' ? ' ↑' : ' ↓') : ''));
  }));
  const tb = h('tbody', null, d.data.slice(0, limit).map(r => h('tr', null, r.map((v, i) => h('td', { class: d.cols[i].type === 'number' ? 'num' : '' }, v == null ? '' : fmtValue(v, d.cols[i].fmt || (d.cols[i].type === 'number' ? { type: 'auto' } : null)))))));
  const wrap = h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, head), tb));
  wrap.style.setProperty('--tbl-head', (el.style && el.style.fill) || 'var(--d-surface)');
  body.append(wrap);
  if (d.total > limit) body.append(h('div', { class: 'tbl-foot' }, `Showing ${limit.toLocaleString()} of ${d.total.toLocaleString()} rows`));
};

RENDER.text = (el, body, fx) => {
  boxStyle(el, body, fx);
  const s = el.style || {};
  body.style.justifyContent = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[s.valign || 'top'];
  if (!s.fill || s.fill === 'transparent') body.style.overflow = 'visible';
  const t = h('div', { class: 'txt' });
  t.style.fontSize = (s.size || 16) + 'px';
  t.style.fontWeight = s.weight || 400;
  t.style.textAlign = s.align || 'left';
  t.style.lineHeight = s.lh || 1.25;
  if ((s.size || 16) >= 24) t.style.letterSpacing = '-0.015em';
  templateInto(t, el, el.text || '');
  body.append(t);
};

function shapeGeom(kind, w, ht, i, s) {
  const pts = a => a.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
  const W = Math.max(0.1, w - 2 * i), H = Math.max(0.1, ht - 2 * i);
  switch (kind) {
    case 'ellipse': return sv('ellipse', { cx: w / 2, cy: ht / 2, rx: W / 2, ry: H / 2 });
    case 'triangle': return sv('polygon', { points: pts([[w / 2, i], [w - i, ht - i], [i, ht - i]]) });
    case 'diamond': return sv('polygon', { points: pts([[w / 2, i], [w - i, ht / 2], [w / 2, ht - i], [i, ht / 2]]) });
    case 'hexagon': return sv('polygon', { points: pts([[i + W * 0.25, i], [i + W * 0.75, i], [w - i, ht / 2], [i + W * 0.75, ht - i], [i + W * 0.25, ht - i], [i, ht / 2]]) });
    case 'star': {
      const p = [];
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 0.42 : 1; p.push([w / 2 + Math.cos(a) * (W / 2) * r, ht / 2 + Math.sin(a) * (H / 2) * r]); }
      return sv('polygon', { points: pts(p) });
    }
    default: return sv('rect', { x: i, y: i, width: W, height: H, rx: Math.min(s.radius ?? 0, W / 2, H / 2) });
  }
}
RENDER.shape = (el, body, fx) => {
  const s = el.style || {}, w = el.w, ht = el.h, kind = el.shape || 'rect';
  body.style.overflow = 'visible';
  body.style.opacity = s.opacity ?? 1;
  const isLine = kind === 'line' || kind === 'arrow';
  const fill = fx.fill || s.fill || (el.container ? 'var(--d-surface)' : 'var(--s1)');
  const stroke = fx.border || s.stroke || (isLine ? 'var(--d-ink2)' : el.container ? 'var(--d-border)' : 'none');
  const sw = s.sw ?? (isLine ? 2 : el.container ? 1 : 0);
  let amt = null;
  if (filled(el.amount)) { const v = N(evalF(el, el.amount)); amt = v == null ? 0 : clamp(v, 0, 1); }
  const svg = sv('svg', { class: 'shape-svg', viewBox: `0 0 ${w} ${ht}`, preserveAspectRatio: 'none' });
  if (s.shadow ?? !!el.container) svg.style.filter = 'drop-shadow(0 3px 8px rgba(0,0,0,.10))';
  if (isLine) {
    const col = fx.fill || s.stroke || s.fill || 'var(--d-ink2)', y = ht / 2, head = kind === 'arrow' ? Math.max(9, sw * 4.5) : 0;
    const end = amt == null ? w : w * amt;
    svg.append(sv('line', { x1: sw / 2, y1: y, x2: Math.max(sw / 2, end - head * 0.8), y2: y, stroke: col, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-dasharray': s.dash ? `${sw * 3} ${sw * 2.5}` : null }));
    if (head) svg.append(sv('polygon', { points: `${end},${y} ${end - head},${y - head * 0.55} ${end - head},${y + head * 0.55}`, fill: col }));
  } else if (kind === 'ring') {
    const thick = s.thick || Math.max(4, Math.min(w, ht) * 0.13), r = Math.max(1, Math.min(w, ht) / 2 - thick / 2), cx = w / 2, cy = ht / 2, C = 2 * Math.PI * r;
    svg.append(sv('circle', { cx, cy, r, fill: 'none', stroke: fill, 'stroke-width': thick, 'stroke-opacity': amt == null ? 1 : 0.16 }));
    if (amt != null && amt > 0) svg.append(sv('circle', { cx, cy, r, fill: 'none', stroke: fill, 'stroke-width': thick, 'stroke-linecap': 'round', 'stroke-dasharray': `${(C * amt).toFixed(2)} ${C.toFixed(2)}`, transform: `rotate(-90 ${cx} ${cy})` }));
  } else {
    const inset = sw / 2;
    const g = shapeGeom(kind, w, ht, inset, s);
    g.setAttribute('fill', fill); g.setAttribute('stroke', stroke); g.setAttribute('stroke-width', sw);
    if (amt == null) svg.append(g);
    else {
      g.setAttribute('fill-opacity', '.16');
      const id = 'clip_' + el.id;
      const right = s.dir === 'right';
      const clip = sv('clipPath', { id }, sv('rect', right ? { x: 0, y: 0, width: w * amt, height: ht } : { x: 0, y: ht * (1 - amt), width: w, height: ht * amt }));
      const top = shapeGeom(kind, w, ht, inset, s);
      top.setAttribute('fill', fill); top.setAttribute('clip-path', `url(#${id})`);
      svg.append(sv('defs', null, clip), g, top);
    }
  }
  body.append(svg);
  if (filled(el.label)) {
    const solid = !isLine && kind !== 'ring' && amt == null && !el.container && fill !== 'transparent' && fill !== 'var(--d-surface)' && fill !== 'var(--d-page)';
    const lb = h('div', { class: 'shape-label' });
    lb.style.color = fx.color || s.color || (solid ? '#fff' : 'var(--d-ink)');
    lb.style.fontSize = s.size ? s.size + 'px' : 'clamp(10px, min(20cqh, 11cqw), 220px)';
    if (s.font) lb.style.fontFamily = FONTS[s.font] || '';
    if (kind === 'ring') lb.style.padding = '22%';
    templateInto(lb, el, el.label);
    body.append(lb);
  }
};

RENDER.image = (el, body, fx) => {
  boxStyle(el, body, fx);
  const src = S.images.get(el.img);
  if (!src) { body.append(emptyBox('Image not found. Replace it from the panel on the right.')); return; }
  const im = h('img', { class: 'img', src, alt: el.name || 'Image', draggable: 'false' });
  im.style.objectFit = el.fit || 'contain';
  body.append(im);
};

RENDER.control = (el, body, fx) => {
  boxStyle(el, body, fx);
  const wrap = h('div', { class: 'ctl' }); body.append(wrap);
  const changed = keep => { if (keep) keepNode(el); renderCanvas(); queueCommit(); };
  if (el.control === 'slider') {
    const read = h('b', null, fmtValue(N(el.value) ?? 0, el.fmt));
    const input = h('input', { type: 'range', min: el.min ?? 0, max: el.max ?? 100, step: el.step || 1, value: el.value ?? 0, 'aria-label': el.label || el.param || 'Slider' });
    input.addEventListener('input', () => { el.value = +input.value; read.textContent = fmtValue(el.value, el.fmt); changed(true); });
    wrap.append(h('div', { class: 'ctl-label' }, h('span', null, el.label || el.param || 'Parameter'), read), input);
    wrap.style.justifyContent = 'center';
    return;
  }
  const ds = dsOf(el);
  wrap.append(h('div', { class: 'ctl-label' }, h('span', null, el.label || el.col || 'Filter')));
  if (!ds || !el.col || !colSet(ds).has(el.col)) { wrap.append(emptyBox('Pick a column for this control.')); return; }
  if (el.control === 'daterange') {
    const presets = [['all', 'All time'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['90d', 'Last 90 days'], ['365d', 'Last 12 months'], ['mtd', 'This month'], ['qtd', 'This quarter'], ['ytd', 'This year'], ['custom', 'Custom range']];
    const sel = h('select', { 'aria-label': 'Date range' }, presets.map(([v, l]) => h('option', { value: v, selected: (el.preset || 'all') === v }, l)));
    sel.addEventListener('change', () => { el.preset = sel.value; changed(); });
    wrap.append(sel);
    if (el.preset === 'custom') {
      const a = h('input', { type: 'date', value: el.from || '', 'aria-label': 'From' }), b = h('input', { type: 'date', value: el.to || '', 'aria-label': 'To' });
      a.addEventListener('change', () => { el.from = a.value; changed(true); });
      b.addEventListener('change', () => { el.to = b.value; changed(true); });
      wrap.append(h('div', { class: 'ctl-dates' }, a, b));
    }
    return;
  }
  const keys = distinct(ds, el.col).keys;
  const cur = new Set(el.values || []);
  const toggle = k => {
    if (k == null) el.values = [];
    else if (el.multi === false) el.values = cur.has(k) ? [] : [k];
    else { if (cur.has(k)) cur.delete(k); else cur.add(k); el.values = [...cur]; }
    changed();
  };
  if (keys.length <= 14) {
    wrap.append(h('div', { class: 'ctl-opts' },
      h('button', { type: 'button', class: 'opt' + (cur.size ? '' : ' on'), 'aria-pressed': String(!cur.size), onclick: () => toggle(null) }, 'All'),
      keys.map(k => h('button', { type: 'button', class: 'opt' + (cur.has(k) ? ' on' : ''), 'aria-pressed': String(cur.has(k)), onclick: () => toggle(k) }, k))));
  } else {
    const list = h('div', { class: 'ctl-list' });
    const draw = q => {
      list.textContent = '';
      const shown = keys.filter(k => !q || k.toLowerCase().includes(q)).slice(0, 200);
      for (const k of shown) {
        const cb = h('input', { type: 'checkbox', checked: cur.has(k) });
        cb.addEventListener('change', () => { if (cb.checked) cur.add(k); else cur.delete(k); el.values = el.multi === false ? (cb.checked ? [k] : []) : [...cur]; changed(el.multi !== false); });
        list.append(h('label', null, cb, k));
      }
    };
    const search = h('input', { type: 'search', placeholder: `Search ${keys.length.toLocaleString()} values`, 'aria-label': 'Search values' });
    search.addEventListener('input', () => draw(search.value.trim().toLowerCase()));
    draw('');
    wrap.append(search, list);
  }
};
