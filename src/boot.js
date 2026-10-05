/* ===== boot: starter dashboard, state loading, start-up ===== */
const SAMPLE_MARK = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0d7a68"/><path d="M13 41l19-24 19 24-19-9z" fill="#fff"/><circle cx="32" cy="47" r="3.6" fill="#f2c14e"/></svg>');
const blankBoard = () => ({ v: 1, name: 'Untitled dashboard', theme: 'auto', bg: '', pages: [{ id: uid('pg_'), name: 'Page 1', els: [] }] });

function sampleState() {
  const ds = Data.sampleOrders();
  const D = ds.id;
  const last30 = 'SumIf([Revenue], [Order Date] > DateAdd("day", -30, Today()))';
  let n = 0;
  const E = (type, name, x, y, w, h, props) => ({ id: 'el_s' + (++n), type, name, x, y, w, h, rot: 0, ds: D, style: {}, rules: [], vis: '', ...props });
  const m = (name, f, extra) => ({ id: 'm_s' + (++n), name, f, color: '', ...extra });
  const els = [
    E('shape', 'Target container', 888, 92, 472, 200, { shape: 'rect', container: true, amount: '', label: '', style: { radius: 16 } }),
    E('image', 'Sample logo', 0, 6, 56, 56, { img: 'img_sample_mark', fit: 'contain' }),
    E('text', 'Title', 72, 0, 560, 40, { text: 'Kestrel Outfitters sales pulse', style: { size: 30, weight: '700', font: 'bricolage' } }),
    E('text', 'Subtitle', 72, 42, 560, 24, { text: '{{ Count() }} order lines from {{ Min([Order Date]) }} to {{ Max([Order Date]) }}. Sample data.', style: { size: 13.5, color: 'var(--d-ink2)' } }),
    E('control', 'Region filter', 650, 0, 380, 72, { control: 'filter', label: 'Region', col: 'Region', multi: true, values: [] }),
    E('control', 'Channel filter', 1046, 0, 314, 72, { control: 'filter', label: 'Channel', col: 'Channel', multi: true, values: [] }),
    E('kpi', 'Revenue KPI', 0, 92, 400, 200, {
      label: 'Revenue, last 90 days', f: 'SumIf([Revenue], [Order Date] > DateAdd("day", -90, Today()))', fmt: { type: 'currency', compact: true, decimals: 2 },
      cmp: 'SumIf([Revenue], [Order Date] > DateAdd("day", -180, Today()) and [Order Date] <= DateAdd("day", -90, Today()))', cmpLabel: 'vs the 90 days before', cmpMode: 'pct', upGood: true,
      spark: { col: 'Order Date', bucket: 'month', f: 'Sum([Revenue])' }, style: { pad: 20 } }),
    E('kpi', 'Margin KPI', 416, 92, 230, 92, { label: 'Gross margin', f: '(Sum([Revenue]) - Sum([Cost])) / Sum([Revenue])', fmt: { type: 'percent', decimals: 1 }, cmp: '', spark: { col: '', bucket: 'month', f: '' } }),
    E('kpi', 'Orders KPI', 416, 200, 230, 92, { label: 'Orders', f: 'CountDistinct([Order ID])', fmt: { type: 'number', decimals: 0 }, cmp: '', spark: { col: '', bucket: 'month', f: '' } }),
    E('kpi', 'AOV KPI', 662, 92, 210, 200, { label: 'Average order value', f: 'Sum([Revenue]) / CountDistinct([Order ID])', fmt: { type: 'currency', decimals: 0 }, cmp: '', spark: { col: '', bucket: 'month', f: '' }, style: { align: 'center' } }),
    E('shape', 'Target ring', 906, 110, 164, 164, { shape: 'ring', amount: `${last30} / @Target`, label: `{{ ${last30} / @Target | percent:0 }}`, style: { fill: 'var(--s3)' }, rules: [{ when: `${last30} < 0.8 * @Target`, effect: 'fill', color: 'var(--s2)' }] }),
    E('text', 'Target heading', 1092, 112, 250, 24, { text: 'Last 30 days against target', style: { size: 15, weight: '600' } }),
    E('text', 'Target detail', 1092, 138, 250, 44, { text: `{{ ${last30} | currency compact }} of a {{ @Target | currency compact }} target. Drag the slider to move it.`, style: { size: 12.5, color: 'var(--d-ink2)', lh: 1.35 } }),
    E('control', 'Target slider', 1092, 204, 250, 70, { control: 'slider', label: 'Monthly target', param: 'Target', min: 50000, max: 250000, step: 5000, value: 105000, fmt: { type: 'currency', compact: true }, style: { fill: 'transparent', bw: 0, shadow: false, pad: 0 } }),
    E('shape', 'Target met star', 1322, 102, 26, 26, { shape: 'star', amount: '', label: '', vis: `${last30} >= @Target`, style: { fill: 'var(--s4)' } }),
    E('chart', 'Revenue trend', 0, 308, 700, 320, { chart: 'line', title: 'Revenue by month and channel', cat: { col: 'Order Date', bucket: 'month' }, measures: [m('Revenue', 'Sum([Revenue])')], split: 'Channel', sort: 'auto', limit: 0, stacked: false, smooth: true, legend: true, fmt: { type: 'currency', compact: true } }),
    E('chart', 'Category bars', 716, 308, 330, 320, { chart: 'hbar', title: 'Revenue by category', cat: { col: 'Category', bucket: 'month' }, measures: [m('Revenue', 'Sum([Revenue])')], split: '', sort: 'auto', limit: 0, legend: true, fmt: { type: 'currency', compact: true } }),
    E('chart', 'Region donut', 1062, 308, 298, 320, { chart: 'pie', title: 'Revenue by region', cat: { col: 'Region', bucket: 'month' }, measures: [m('Revenue', 'Sum([Revenue])')], split: '', sort: 'auto', limit: 0, legend: true, fmt: { type: 'currency', compact: true } }),
    E('table', 'Product table', 0, 644, 700, 264, { title: 'Products', mode: 'summary', group: ['Product'], measures: [m('Revenue', 'Sum([Revenue])', { fmt: 'currency' }), m('Units', 'Sum([Units])'), m('Margin', '(Sum([Revenue]) - Sum([Cost])) / Sum([Revenue])', { fmt: 'percent' })], cols: [], sortCol: 'Revenue', sortDir: 'desc', limit: 100, fmt: { type: 'auto' } }),
    E('text', 'Note', 728, 660, 310, 92, { text: 'Nothing here sits on a grid. Drag, resize or rotate any piece, then select it and edit its formula in the bar at the top.', rot: -3, style: { size: 15.5, font: 'fraunces', color: 'var(--d-ink2)', lh: 1.35 } }),
    E('text', 'Return rate label', 728, 776, 310, 24, { text: 'Return rate {{ CountIf([Returned]) / Count() | percent:1 }}', style: { size: 15, weight: '600' } }),
    E('shape', 'Return rate bar', 728, 806, 310, 16, { shape: 'rect', amount: 'CountIf([Returned]) / Count() / 10%', label: '', style: { radius: 8, fill: 'var(--s1)', dir: 'right' }, rules: [{ when: 'CountIf([Returned]) / Count() > 6%', effect: 'fill', color: 'var(--d-bad)' }] }),
    E('text', 'Return rate caption', 728, 832, 310, 54, { text: 'A plain rectangle used as a gauge. Its fill follows a formula, on a scale of 0 to 10%, and a rule turns it red above 6%.', style: { size: 12, color: 'var(--d-muted)', lh: 1.35 } }),
    E('chart', 'Segment columns', 1062, 644, 298, 264, { chart: 'bar', title: 'Units by segment', cat: { col: 'Segment', bucket: 'month' }, measures: [m('Units', 'Sum([Units])')], split: '', sort: 'auto', limit: 0, legend: true, fmt: { type: 'number', compact: true } }),
  ];
  return { board: { v: 1, name: 'Sales pulse (sample)', theme: 'auto', bg: '', pages: [{ id: 'pg_s1', name: 'Overview', els }] }, datasets: [ds], images: { img_sample_mark: SAMPLE_MARK } };
}

function normalizeBoard(b) {
  b.v = 1; b.name = b.name || 'Untitled dashboard'; b.theme = b.theme || 'auto';
  if (!Array.isArray(b.pages) || !b.pages.length) b.pages = [{ id: uid('pg_'), name: 'Page 1', els: [] }];
  for (const p of b.pages) {
    p.id = p.id || uid('pg_'); p.name = p.name || 'Page'; p.els = Array.isArray(p.els) ? p.els.filter(e => e && RENDER[e.type]) : [];
    for (const e of p.els) {
      e.id = e.id || uid('el_'); e.style = e.style || {}; e.rules = Array.isArray(e.rules) ? e.rules : [];
      for (const k of ['x', 'y', 'w', 'h']) e[k] = Number.isFinite(+e[k]) ? +e[k] : k === 'w' || k === 'h' ? 100 : 0;
      e.rot = +e.rot || 0;
      if ((e.type === 'chart' || e.type === 'table') && !Array.isArray(e.measures)) e.measures = [];
      if (e.type === 'chart') e.cat = e.cat || { col: '', bucket: 'month' };
      if (e.type === 'kpi') e.spark = e.spark || { col: '', bucket: 'month', f: '' };
    }
  }
}
function loadState(st) {
  normalizeBoard(st.board);
  S.board = st.board;
  S.datasets = new Map();
  for (const ds of st.datasets || []) { S.datasets.set(ds.id, ds); recomputeCalc(ds); }
  S.images = new Map(Object.entries(st.images || {}));
  S.pageId = S.board.pages[0].id;
  S.sel.clear(); S.undo = []; S.redo = []; S.views.clear();
  S.lastSnap = snapshot();
  S.evalEpoch++; S.dataEpoch++; S.struct++;
  pass = null;
}
function replaceState(st, msg) {
  const before = new Map(S.datasets);
  loadState(st);
  for (const id of before.keys()) if (!S.datasets.has(id)) Store.removeDs(id);
  for (const ds of S.datasets.values()) Store.dirtyDs(ds.id, before.get(ds.id) !== ds);
  for (const id of S.images.keys()) Store.dirtyImg(id);
  Store.dirtyBoard();
  renderAll(); fitView();
  if (msg) toast(msg);
}
async function exportBoard() {
  softCommit();
  const name = (S.board.name || 'dashboard').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'dashboard';
  try { await Store.saveFile(name + '.offgrid.json', JSON.stringify(Store.bundle())); toast('Saved a copy of this dashboard.'); }
  catch (e) { if (e && e.code !== 'declined') toast('Could not save the file from this view.'); }
}

async function boot() {
  initCanvas(); buildTop(); initFx();
  $('#pick-data').addEventListener('change', e => { [...e.target.files].forEach(importDataFile); });
  loadState(sampleState());
  let veil = null;
  if (Store.expectCloud()) { veil = h('div', { class: 'veil' }, 'Opening your dashboard…'); $('#viewport').append(veil); S.loading = true; }
  renderAll(); fitView();
  const bump = () => { S.themeEpoch++; renderCanvas(); };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', bump);
  new MutationObserver(bump).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(bump);
  if (!window.Chart) {
    const alt = h('script', { src: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js' });
    alt.addEventListener('load', bump);
    document.head.append(alt);
  }
  let loaded = null;
  try { loaded = await Store.init(); }
  catch (e) { toast('Could not open the saved dashboard, so this is the sample.', 6000); }
  if (loaded) { try { loadState(loaded); } catch (e) { loadState(sampleState()); toast('The saved dashboard could not be read, so this is the sample.', 6000); } }
  S.loading = false; if (veil) veil.remove();
  const editedEarly = !loaded && S.undo.length > 0;
  S.ready = true;
  if (!S.canWrite) { S.mode = 'view'; $('#app').dataset.mode = 'view'; S.sel.clear(); }
  S.struct++;
  renderAll();
  if (loaded || !S.canWrite) fitView();
  Store.announce();
  if (editedEarly) Store.dirtyBoard();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
