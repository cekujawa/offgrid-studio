/* ===== ui: command bar, rails, inspector, formula bar, dialogs ===== */
let pops = [];
function closePops() {
  if (!pops.length) return false;
  for (const p of pops) { p.node.remove(); if (p.anchor) p.anchor.removeAttribute('data-pop'); }
  pops = [];
  return true;
}
function showPop(node, anchor, align) {
  $('#layer').append(node);
  node.style.position = 'fixed';
  const a = anchor.getBoundingClientRect(), w = node.offsetWidth, ht = node.offsetHeight;
  let left = align === 'right' ? a.right - w : a.left, top = a.bottom + 4;
  left = clamp(left, 8, Math.max(8, window.innerWidth - w - 8));
  if (top + ht > window.innerHeight - 8) top = Math.max(8, a.top - ht - 4);
  node.style.left = left + 'px'; node.style.top = top + 'px';
  anchor.setAttribute('data-pop', '');
  pops.push({ node, anchor });
}
function openMenu(anchor, items) {
  if (anchor.hasAttribute('data-pop')) { closePops(); return; }
  closePops();
  const m = h('div', { class: 'menu', role: 'menu' }, items.map(it => (it === '-' ? h('hr') : h('button', { type: 'button', role: 'menuitem', onclick: () => { closePops(); it.run(); } }, it.icon ? ic(it.icon) : null, it.label))));
  showPop(m, anchor, 'right');
}
let toastTimer = null;
function toast(msg, ms = 3600) {
  let t = $('.toast');
  if (!t) { t = h('div', { class: 'toast', role: 'status' }); $('#layer').append(t); }
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}
function openModal({ title, body, actions, wide }) {
  closeModal();
  const dlg = h('div', { class: 'dialog' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', null, h('h2', null, title), h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Close', onclick: closeModal }, ic('close'))),
    h('div', { class: 'body' }, body),
    actions && actions.length ? h('footer', null, actions) : null);
  const m = h('div', { class: 'modal' }, dlg);
  m.addEventListener('pointerdown', e => { if (e.target === m) closeModal(); });
  $('#layer').append(m);
  const f = dlg.querySelector('.body input, .body textarea, .body select');
  if (f) f.focus();
  return dlg;
}
function closeModal() { const m = $('.modal'); if (!m) return false; m.remove(); return true; }
const iconBtn = (icon, title, run, cls = '') => h('button', { type: 'button', class: 'btn icon ' + cls, title, 'aria-label': title, onclick: run }, ic(icon));
function confirmBtn(label, run, cls = 'btn small danger') {
  const b = h('button', { type: 'button', class: cls }, label);
  let armed = null;
  b.addEventListener('click', () => {
    if (armed) { clearTimeout(armed); run(); return; }
    b.textContent = 'Click again to confirm';
    armed = setTimeout(() => { armed = null; b.textContent = label; }, 3000);
  });
  return b;
}

/* ---------- history ---------- */
const snapshot = () => JSON.stringify(S.board);
let commitTimer = null;
function softCommit() {
  clearTimeout(commitTimer); commitTimer = null;
  const now = snapshot();
  if (now === S.lastSnap) return false;
  S.undo.push(S.lastSnap); if (S.undo.length > 150) S.undo.shift();
  S.redo = []; S.lastSnap = now;
  Store.dirtyBoard();
  return true;
}
function queueCommit() { clearTimeout(commitTimer); commitTimer = setTimeout(() => { if (softCommit()) { renderTop(); renderLeft(); renderInspector(); } }, 600); }
function commit() { softCommit(); renderAll(); }
function touch() { renderCanvas(); renderFx(true); queueCommit(); }
function restore(json) {
  S.board = JSON.parse(json);
  if (!S.board.pages.some(p => p.id === S.pageId)) S.pageId = S.board.pages[0].id;
  const ids = new Set(els().map(e => e.id));
  S.sel = new Set([...S.sel].filter(id => ids.has(id)));
  S.struct++; Store.dirtyBoard();
  renderAll();
}
function undo() { softCommit(); if (!S.undo.length) return; S.redo.push(S.lastSnap); S.lastSnap = S.undo.pop(); restore(S.lastSnap); }
function redo() { softCommit(); if (!S.redo.length) return; S.undo.push(S.lastSnap); S.lastSnap = S.redo.pop(); restore(S.lastSnap); }

function renderChrome() { renderTop(); renderLeft(); renderInspector(); renderFx(); }
function renderAll() { applyBoardTheme(); renderCanvas(); renderChrome(); }
function applyBoardTheme() {
  const v = $('#viewport'), t = S.board.theme || 'auto';
  const was = v.dataset.t + '|' + v.dataset.bg;
  v.classList.toggle('d-light', t === 'light'); v.classList.toggle('d-dark', t === 'dark');
  v.style.backgroundColor = S.board.bg || '';
  v.dataset.t = t; v.dataset.bg = S.board.bg || '';
  if (was !== t + '|' + (S.board.bg || '')) S.themeEpoch++;
}
function setMode(mode) {
  if (mode === 'edit' && !S.canWrite) return;
  softCommit();
  if (S.mode === 'edit') S.editView = { ...S.view };
  S.mode = mode;
  $('#app').dataset.mode = mode;
  S.sel.clear(); closeSheet(); closePops();
  S.struct++;
  renderAll();
  if (mode === 'view') requestAnimationFrame(fitView);
  else if (S.editView) { S.view = S.editView; requestAnimationFrame(applyView); }
}

/* ---------- command bar ---------- */
function buildTop() {
  const name = h('input', { class: 'board-name', id: 'board-name', type: 'text', 'aria-label': 'Dashboard name', maxlength: '80', spellcheck: 'false' });
  name.addEventListener('input', () => { S.board.name = name.value; queueCommit(); });
  name.addEventListener('keydown', e => { if (e.key === 'Enter') name.blur(); });
  const more = iconBtn('dots', 'More', () => openMenu(more, [
    S.canExport ? { icon: 'download', label: 'Save a copy as a file', run: exportBoard } : null,
    { icon: 'upload', label: 'Open a dashboard file', run: () => { const i = $('#pick-board'); i.value = ''; i.click(); } },
    '-',
    { icon: 'play', label: 'Load the sample dashboard', run: () => replaceState(sampleState(), 'Sample dashboard loaded. Undo is not available for this.') },
    { icon: 'plus', label: 'Start a blank dashboard', run: () => replaceState({ board: blankBoard(), datasets: [...S.datasets.values()], images: {} }, 'Blank dashboard. Your data sets are still in the Data tab.') },
  ].filter(Boolean)), 'only-edit');
  $('#top').append(
    h('div', { class: 'mark' }, h('i'), h('span', { class: 'hide-narrow' }, 'Offgrid')),
    name,
    h('div', { class: 'pages', id: 'pages' }),
    h('div', { class: 'top-tools' },
      h('div', { class: 'status', id: 'status' }, h('span')),
      h('button', { type: 'button', class: 'btn icon only-edit', id: 'btn-undo', title: 'Undo (Ctrl+Z)', 'aria-label': 'Undo', onclick: undo }, ic('undo')),
      h('button', { type: 'button', class: 'btn icon only-edit', id: 'btn-redo', title: 'Redo (Ctrl+Shift+Z)', 'aria-label': 'Redo', onclick: redo }, ic('redo')),
      more,
      h('button', { type: 'button', class: 'btn primary', id: 'btn-mode', onclick: () => setMode(S.mode === 'edit' ? 'view' : 'edit') })));
  $('#pick-board').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { replaceState(Store.unbundle(JSON.parse(await f.text())), `Opened ${f.name}`); } catch (err) { toast('That file is not an Offgrid dashboard file.'); }
  });
  $('#hud-zoom').append(
    iconBtn('minus', 'Zoom out', () => zoomStep(-1)),
    h('button', { type: 'button', class: 'btn zv', id: 'zoom-val', title: 'Reset to 100%', onclick: () => { const r = vp.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1); } }, '100%'),
    iconBtn('plus', 'Zoom in', () => zoomStep(1)),
    iconBtn('fit', 'Fit everything on screen', fitView));
  const dock = $('#dock');
  for (const [k, icon, label] of [['insert', 'plus', 'Insert'], ['layers', 'layers', 'Layers'], ['data', 'db', 'Data'], ['design', 'design', 'Design']]) {
    dock.append(h('button', { type: 'button', 'data-sheet': k, onclick: () => { S.sheet = S.sheet === k ? null : k; if (k !== 'design' && S.sheet) S.leftTab = k; applySheet(); } }, ic(icon), label));
  }
}
function applySheet() {
  $('#left').classList.toggle('open', ['insert', 'layers', 'data'].includes(S.sheet));
  $('#right').classList.toggle('open', S.sheet === 'design');
  for (const b of $('#dock').children) b.classList.toggle('on', b.dataset.sheet === S.sheet);
  renderLeft();
}
function closeSheet() { if (S.sheet) { S.sheet = null; applySheet(); } }
function renderStatus() {
  const st = $('#status'); if (!st) return;
  st.dataset.s = S.save.state;
  st.firstChild.textContent = S.save.msg || '';
  st.title = S.save.tip || '';
  st.hidden = !S.save.msg;
}
function renderTop() {
  const name = $('#board-name');
  if (document.activeElement !== name) name.value = S.board.name || '';
  $('#btn-undo').disabled = !S.undo.length;
  $('#btn-redo').disabled = !S.redo.length;
  const mode = $('#btn-mode');
  mode.textContent = '';
  mode.append(ic(S.mode === 'edit' ? 'play' : 'pencil'), S.mode === 'edit' ? 'View' : 'Edit');
  mode.hidden = S.mode === 'view' && !S.canWrite;
  mode.title = S.mode === 'edit' ? 'See the dashboard as viewers do' : 'Back to editing';
  renderStatus();
  const box = $('#pages'); box.textContent = '';
  const edit = S.mode === 'edit';
  for (const p of S.board.pages) {
    const on = p.id === S.pageId;
    const tab = h('button', { type: 'button', class: 'page-tab' + (on ? ' on' : ''), title: edit && on ? 'Double-click to rename' : null }, h('span', null, p.name));
    tab.addEventListener('click', () => { if (!on) switchPage(p.id); });
    if (edit && on) {
      tab.addEventListener('dblclick', () => {
        const input = h('input', { type: 'text', value: p.name, 'aria-label': 'Page name', maxlength: '40' });
        tab.textContent = ''; tab.append(input); input.focus(); input.select();
        const done = () => { p.name = input.value.trim() || p.name; commit(); };
        input.addEventListener('blur', done);
        input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') input.blur(); });
      });
      if (S.board.pages.length > 1) {
        const x = h('span', { class: 'x', role: 'button', title: 'Delete this page', 'aria-label': 'Delete this page' }, ic('close'));
        x.addEventListener('click', ev => {
          ev.stopPropagation();
          S.board.pages = S.board.pages.filter(q => q !== p);
          S.pageId = S.board.pages[0].id; S.sel.clear(); S.struct++;
          commit(); fitView();
          toast(`Deleted “${p.name}”. Undo brings it back.`);
        });
        tab.append(x);
      }
    }
    box.append(tab);
  }
  if (edit) box.append(h('button', { type: 'button', class: 'page-tab', title: 'Add a page', 'aria-label': 'Add a page', onclick: () => {
    const p = { id: uid('pg_'), name: `Page ${S.board.pages.length + 1}`, els: [] };
    S.board.pages.push(p); commit(); switchPage(p.id);
  } }, ic('plus')));
}
function switchPage(id) {
  softCommit();
  S.views.set(S.pageId, { ...S.view });
  S.pageId = id; S.sel.clear(); S.struct++;
  renderAll();
  const v = S.views.get(id);
  if (v && S.mode === 'edit') { S.view = { ...v }; applyView(); } else fitView();
}

/* ---------- left rail ---------- */
const TILES = [
  ['Numbers and charts', [['kpi', 'KPI', () => addEl('kpi')], ['bar', 'Columns', () => addEl('chart', 'bar')], ['hbar', 'Bars', () => addEl('chart', 'hbar')], ['line', 'Line', () => addEl('chart', 'line')], ['area', 'Area', () => addEl('chart', 'area')], ['pie', 'Donut', () => addEl('chart', 'pie')], ['scatter', 'Scatter', () => addEl('chart', 'scatter')], ['table', 'Table', () => addEl('table')]]],
  ['Layout', [['text', 'Text', () => addEl('text')], ['container', 'Container', () => addEl('shape', 'container')], ['image', 'Image', () => pickImage()]]],
  ['Shapes', [['rect', 'Rectangle', () => addEl('shape', 'rect')], ['ellipse', 'Ellipse', () => addEl('shape', 'ellipse')], ['ring', 'Ring', () => addEl('shape', 'ring')], ['triangle', 'Triangle', () => addEl('shape', 'triangle')], ['diamond', 'Diamond', () => addEl('shape', 'diamond')], ['star', 'Star', () => addEl('shape', 'star')], ['hexagon', 'Hexagon', () => addEl('shape', 'hexagon')], ['lineS', 'Line', () => addEl('shape', 'line')], ['arrow', 'Arrow', () => addEl('shape', 'arrow')]]],
  ['Controls', [['filter', 'Filter', () => addEl('control', 'filter')], ['calendar', 'Date range', () => addEl('control', 'daterange')], ['slider', 'Slider', () => addEl('control', 'slider')]]],
];
const TYPE_ICON = el => (el.type === 'chart' ? el.chart : el.type === 'shape' ? (el.container ? 'container' : el.shape === 'line' ? 'lineS' : el.shape) : el.type === 'control' ? { filter: 'filter', daterange: 'calendar', slider: 'slider' }[el.control] : el.type);
function renderLeft() {
  const left = $('#left');
  const tab = S.leftTab;
  const key = tab + '|' + (tab === 'layers' ? S.pageId + JSON.stringify(els().map(e => [e.id, e.name, e.locked, e.hidden])) + [...S.sel].join() : tab === 'data' ? S.dataEpoch + '|' + S.datasets.size : '');
  if (left._key === key) return;
  left._key = key;
  const scroll = left.scrollTop;
  left.textContent = '';
  left.append(h('div', { class: 'tabs', role: 'tablist' }, [['insert', 'Insert'], ['layers', 'Layers'], ['data', 'Data']].map(([k, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === k), class: tab === k ? 'on' : '', onclick: () => { S.leftTab = k; renderLeft(); } }, l))));
  const pane = h('div', { class: 'pane' });
  left.append(pane);
  if (tab === 'insert') {
    for (const [title, tiles] of TILES) pane.append(sec(title, h('div', { class: 'tiles' }, tiles.map(([icon, label, run]) => h('button', { type: 'button', class: 'tile', onclick: run }, ic(icon), label)))));
    pane.append(h('p', { class: 'hint' }, 'Everything lands in the middle of your view. Drag it anywhere and pull a handle to any size. You can also drop or paste images straight onto the canvas.'));
  } else if (tab === 'layers') {
    const list = [...els()].reverse();
    if (!list.length) pane.append(h('p', { class: 'hint' }, 'This page is empty. Add something from the Insert tab.'));
    pane.append(h('div', null, list.map(el => {
      const rowEl = h('div', { class: 'layer' + (S.sel.has(el.id) ? ' on' : '') }, ic(TYPE_ICON(el) || 'rect'), h('span', { class: 'nm' + (el.hidden ? ' dim' : '') }, el.name || TYPE_NAMES[el.type]),
        h('button', { type: 'button', title: el.hidden ? 'Show' : 'Hide', 'aria-label': el.hidden ? 'Show' : 'Hide', onclick: ev => { ev.stopPropagation(); el.hidden = !el.hidden; if (el.hidden) S.sel.delete(el.id); S.struct++; commit(); } }, ic(el.hidden ? 'eyeoff' : 'eye')),
        h('button', { type: 'button', title: el.locked ? 'Unlock' : 'Lock', 'aria-label': el.locked ? 'Unlock' : 'Lock', onclick: ev => { ev.stopPropagation(); el.locked = !el.locked; S.struct++; commit(); } }, ic(el.locked ? 'lock' : 'unlock')));
      rowEl.addEventListener('click', ev => { if (el.hidden) return; if (ev.shiftKey) { if (S.sel.has(el.id)) S.sel.delete(el.id); else S.sel.add(el.id); } else S.sel = new Set([el.id]); selectionChanged(); });
      return rowEl;
    })));
  } else {
    if (!S.datasets.size) pane.append(h('p', { class: 'hint' }, 'No data yet. Add a file or paste a table to start.'));
    for (const ds of S.datasets.values()) pane.append(dsCard(ds));
    pane.append(sec('Add data', h('div', { class: 'stack' },
      h('button', { type: 'button', class: 'btn', onclick: () => { const i = $('#pick-data'); i.value = ''; i.click(); } }, ic('upload'), 'Upload CSV or JSON'),
      h('button', { type: 'button', class: 'btn', onclick: pasteDialog }, ic('paste'), 'Paste a table'),
      h('button', { type: 'button', class: 'btn', onclick: warehouseDialog }, ic('db'), 'Connect a warehouse'))));
  }
  left.scrollTop = scroll;
}
const TYPE_GLYPH = { number: '#', text: 'A', date: 'D', boolean: '✓' };
function dsCard(ds) {
  return h('div', { class: 'ds' },
    h('div', { class: 'ds-head' },
      h('div', { class: 'nm' }, h('span', null, ds.name), ds.sample ? h('span', { class: 'badge' }, 'Sample') : null),
      h('div', { class: 'meta' }, `${ds.rows.length.toLocaleString()} rows · ${ds.columns.length} columns`),
      h('div', { class: 'ds-actions' },
        h('button', { type: 'button', class: 'btn small', onclick: () => previewDialog(ds) }, 'Preview'),
        h('button', { type: 'button', class: 'btn small', onclick: () => calcDialog(ds) }, ic('plus'), 'Calculated column'),
        confirmBtn('Remove', () => { S.datasets.delete(ds.id); Store.removeDs(ds.id); S.evalEpoch++; S.dataEpoch++; S.struct++; renderAll(); toast(`Removed “${ds.name}”.`); }))),
    h('div', { class: 'cols' }, ds.columns.map(c => {
      const b = h('button', { type: 'button', class: 'col', title: c.error ? c.error : c.formula ? `= ${c.formula}` : `Add [${c.name}] to the formula` },
        h('span', { class: 'ty' }, c.formula ? 'ƒ' : TYPE_GLYPH[c.type] || 'A'), h('span', { class: 'nm' }, c.name),
        c.error ? ic('warn') : null,
        c.formula ? h('span', { class: 'rm', role: 'button', title: 'Remove calculated column', 'aria-label': 'Remove calculated column', onclick: ev => { ev.stopPropagation(); ds.columns = ds.columns.filter(x => x !== c); for (const r of ds.rows) delete r[c.name]; recomputeCalc(ds); touchDs(ds); Store.dirtyDs(ds.id, false); S.struct++; renderAll(); } }, ic('close')) : null);
      b.addEventListener('pointerdown', e => e.preventDefault());
      b.addEventListener('click', () => {
        if (!fx.field) { toast('Select a KPI, chart, shape or text first. Then click a column to add it to the formula.'); return; }
        if (fx.el.ds !== ds.id) { toast(`This element uses a different data source. Switch it to “${ds.name}” in the panel on the right.`); return; }
        insertFx(`[${c.name}]`);
      });
      return b;
    })));
}
function addDataset(parsed) {
  const ds = { id: uid('ds_'), ...parsed };
  let name = ds.name || 'Data', k = 2;
  while ([...S.datasets.values()].some(d => d.name === name)) name = `${ds.name} ${k++}`;
  ds.name = name;
  S.datasets.set(ds.id, ds);
  recomputeCalc(ds); touchDs(ds);
  Store.dirtyDs(ds.id, true);
  S.leftTab = 'data'; S.struct++;
  renderAll();
  toast(`Added “${ds.name}”: ${ds.rows.length.toLocaleString()} rows, ${ds.columns.length} columns.`);
  return ds;
}
async function importDataFile(file) {
  if (file.size > 60e6) { toast(`${file.name} is over 60 MB. Aggregate it in your warehouse first, then import the result.`); return; }
  try { addDataset(Data.parseAny(file.name.replace(/\.[^.]+$/, ''), await file.text())); }
  catch (e) { toast(`Could not read ${file.name}. ${e.message}`, 6000); }
}
function pasteDialog() {
  const name = h('input', { class: 'in', type: 'text', value: 'Pasted data', 'aria-label': 'Name', id: 'paste-name' });
  const ta = h('textarea', { class: 'in', placeholder: 'Paste rows copied from a spreadsheet, a CSV export, or JSON. The first row is used as column names.', 'aria-label': 'Data', id: 'paste-text', spellcheck: 'false' });
  const msg = h('div', { class: 'msg' });
  openModal({ title: 'Paste a table', body: [row('Name', name), ta, msg], actions: [
    h('button', { type: 'button', class: 'btn', onclick: closeModal }, 'Cancel'),
    h('button', { type: 'button', class: 'btn primary', onclick: () => { try { const d = Data.parseAny(name.value.trim() || 'Pasted data', ta.value); closeModal(); addDataset(d); } catch (e) { msg.className = 'msg bad'; msg.textContent = e.message; } } }, 'Add data')] });
}
function warehouseDialog() {
  openModal({ title: 'Connect a data warehouse', body: [
    h('p', null, 'Live warehouse queries are the next piece to wire up. A published page cannot hold database credentials, so the connection runs through a Claude connector that signs in as you.'),
    h('ol', { class: 'steps' },
      h('li', null, 'Connect your warehouse in Claude. BigQuery, Snowflake and Databricks connectors are available.'),
      h('li', null, 'Tell Claude which one you connected and which tables or SQL you want in this builder.'),
      h('li', null, 'Claude adds a query panel here that runs your SQL through the connector and refreshes each data set.')),
    h('p', null, 'Until then, export any query result as CSV and drop it on the canvas. Formulas, filters and charts work the same way on imported data.')],
    actions: [h('button', { type: 'button', class: 'btn', onclick: closeModal }, 'Close'), h('button', { type: 'button', class: 'btn primary', onclick: () => { closeModal(); const i = $('#pick-data'); i.value = ''; i.click(); } }, 'Upload a CSV now')] });
}
function previewDialog(ds) {
  const types = [['text', 'Text'], ['number', 'Number'], ['date', 'Date'], ['boolean', 'Yes / No']];
  const head = h('tr', null, ds.columns.map(c => {
    const sel = c.formula ? h('span', { class: 't-dim' }, ' ƒ') : h('select', { 'aria-label': `Type of ${c.name}`, style: { marginLeft: '6px', font: 'inherit', fontWeight: '400' } }, types.map(([v, l]) => h('option', { value: v, selected: c.type === v }, l)));
    if (!c.formula) sel.addEventListener('change', () => {
      c.type = sel.value;
      for (const r of ds.rows) r[c.name] = Data.coerce(r[c.name], c.type);
      recomputeCalc(ds); touchDs(ds); Store.dirtyDs(ds.id, true); renderAll(); previewDialog(ds);
    });
    return h('th', null, c.name, sel);
  }));
  const body = ds.rows.slice(0, 200).map(r => h('tr', null, ds.columns.map(c => h('td', { class: c.type === 'number' ? 'num' : '' }, r[c.name] == null ? '' : fmtValue(r[c.name], c.type === 'number' ? { type: 'number', decimals: Number.isInteger(r[c.name]) ? 0 : 2 } : null)))));
  openModal({ title: ds.name, wide: true, body: [
    h('p', null, `Showing the first ${Math.min(200, ds.rows.length).toLocaleString()} of ${ds.rows.length.toLocaleString()} rows. Change a column's type from its header if it was read wrong.`),
    h('div', { style: { overflow: 'auto', minHeight: '0' } }, h('table', { class: 'tbl', style: { '--tbl-head': 'var(--panel)' } }, h('thead', null, head), h('tbody', null, body)))] });
}
function calcDialog(ds) {
  const name = h('input', { class: 'in', type: 'text', placeholder: 'Margin', 'aria-label': 'Column name', id: 'calc-name' });
  const ta = h('textarea', { class: 'in', placeholder: '[Revenue] - [Cost]', 'aria-label': 'Formula', id: 'calc-formula', spellcheck: 'false' });
  ta.style.minHeight = '74px';
  const msg = h('div', { class: 'msg' }, 'Runs once per row. Aggregates such as Sum([Revenue]) cover the whole data set, so [Revenue] / Sum([Revenue]) gives each row its share.');
  const check = () => {
    if (!ta.value.trim()) return null;
    try {
      const env = { rows: ds.rows, row: null, params: {}, cache: new Map(), cols: colSet(ds), dsName: `"${ds.name}"` };
      const out = ds.rows.slice(0, 3).map(r => { env.row = r; return fmtValue(Formula.evaluate(ta.value, env)); });
      msg.className = 'msg'; msg.textContent = out.length ? `First rows: ${out.join(' · ')}` : 'Formula is valid.';
      return true;
    } catch (e) { msg.className = 'msg bad'; msg.textContent = e.message; return false; }
  };
  ta.addEventListener('input', check);
  openModal({ title: `Add a calculated column to ${ds.name}`, body: [row('Name', name), ta, msg], actions: [
    h('button', { type: 'button', class: 'btn', onclick: closeModal }, 'Cancel'),
    h('button', { type: 'button', class: 'btn primary', onclick: () => {
      const nm = name.value.replace(/[\[\]]/g, '').trim();
      if (!nm) { msg.className = 'msg bad'; msg.textContent = 'Give the column a name.'; return; }
      if (colSet(ds).has(nm)) { msg.className = 'msg bad'; msg.textContent = `There is already a column called ${nm}.`; return; }
      if (!check()) { if (!ta.value.trim()) { msg.className = 'msg bad'; msg.textContent = 'Write a formula for the column.'; } return; }
      ds.columns.push({ name: nm, type: 'number', formula: ta.value.trim() });
      recomputeCalc(ds); touchDs(ds); Store.dirtyDs(ds.id, false); S.struct++;
      closeModal(); renderAll(); toast(`Added [${nm}] to “${ds.name}”.`);
    } }, 'Add column')] });
}

/* ---------- inspector fields ---------- */
const getP = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function setP(o, path, v) {
  const ks = path.split('.'); let a = o;
  for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null || typeof a[ks[i]] !== 'object') a[ks[i]] = {}; a = a[ks[i]]; }
  const k = ks[ks.length - 1];
  if (v === undefined) delete a[k]; else a[k] = v;
}
const row = (label, ctl) => h('div', { class: 'row' }, h('span', { class: 'lb' }, label), ctl);
const sec = (title, ...kids) => h('div', { class: 'sec' }, title ? h('h3', null, title) : null, kids);
function fText(o, path, opt = {}) {
  const i = h(opt.area ? 'textarea' : 'input', { class: 'in', value: getP(o, path) ?? '', placeholder: opt.ph || null, 'aria-label': opt.label || path, rows: opt.area ? '3' : null, type: opt.area ? null : 'text' });
  i.addEventListener('input', () => { setP(o, path, i.value); touch(); });
  i.addEventListener('change', () => { if (opt.rebuild) S.struct++; commit(); });
  return i;
}
function fNum(o, path, opt = {}) {
  const k = opt.scale || 1, cur = getP(o, path);
  const shown = cur == null ? (opt.def == null ? '' : opt.def * k) : round(cur * k, 2);
  const i = h('input', { type: 'number', value: shown, placeholder: opt.ph || null, step: opt.step || '1', min: opt.min, max: opt.max, 'aria-label': opt.label || opt.tag || path });
  i.addEventListener('input', () => {
    if (i.value === '') { if (opt.req) return; setP(o, path, undefined); }
    else { let v = +i.value; if (isNaN(v)) return; if (opt.min != null) v = Math.max(+opt.min, v); if (opt.max != null) v = Math.min(+opt.max, v); setP(o, path, v / k); }
    touch();
  });
  i.addEventListener('change', () => commit());
  return h('div', { class: 'numf' }, opt.tag ? h('span', null, opt.tag) : null, i);
}
function fSelect(o, path, options, opt = {}) {
  const cur = getP(o, path) ?? opt.def ?? '';
  if (!options.some(([v]) => String(v) === String(cur))) options = [[cur, cur === '' ? 'Choose…' : `${cur} (missing)`], ...options];
  const s = h('select', { class: 'in', 'aria-label': opt.label || path }, options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(cur) }, l)));
  s.addEventListener('change', () => { setP(o, path, s.value); if (opt.after) opt.after(s.value); S.struct++; commit(); });
  return s;
}
function fCheck(o, path, label, opt = {}) {
  const c = h('input', { type: 'checkbox', checked: !!(getP(o, path) ?? opt.def ?? false) });
  c.addEventListener('change', () => { setP(o, path, c.checked); S.struct++; commit(); });
  return h('label', { class: 'check' }, c, label);
}
function fSeg(o, path, options, opt = {}) {
  const cur = getP(o, path) ?? opt.def;
  return h('div', { class: 'seg' + (opt.wrap ? ' wrap' : '') }, options.map(([v, label, title]) => h('button', { type: 'button', class: cur === v ? 'on' : '', title: title || null, 'aria-label': title || null, 'aria-pressed': String(cur === v), onclick: () => { setP(o, path, v); if (opt.after) opt.after(v); S.struct++; commit(); } }, label)));
}
const TOKENS = [['var(--d-surface)', 'Surface'], ['var(--d-page)', 'Page'], ['var(--d-ink)', 'Ink'], ['var(--d-ink2)', 'Soft ink'], ['var(--d-muted)', 'Muted'], ['var(--d-good)', 'Good'], ['var(--d-bad)', 'Bad'],
  ...[1, 2, 3, 4, 5, 6, 7].map(i => [`var(--s${i})`, `Series ${i}`])];
function colorName(v, auto) { if (!v) return auto || 'Auto'; if (v === 'transparent') return 'None'; const t = TOKENS.find(x => x[0] === v); return t ? t[1] : v; }
function fColor(o, path, opt = {}) {
  const b = h('button', { type: 'button', class: 'swatch', 'aria-label': opt.label || 'Color' });
  const paint = () => { const v = getP(o, path) || ''; b.textContent = ''; const sw = h('i', null, h('b')); sw.firstChild.style.background = v || 'transparent'; b.append(sw, h('span', null, colorName(v, opt.auto))); };
  paint();
  b.addEventListener('click', () => {
    if (b.hasAttribute('data-pop')) { closePops(); return; }
    closePops();
    const cur = getP(o, path) || '';
    const pick = v => { setP(o, path, v || undefined); paint(); touch(); };
    const vcl = $('#viewport').classList;
    const pop = h('div', { class: 'pop' + (vcl.contains('d-dark') ? ' d-dark' : vcl.contains('d-light') ? ' d-light' : '') });
    const custom = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#2a78d6', 'aria-label': 'Custom color' });
    const hex = h('input', { class: 'in', type: 'text', value: /^#/.test(cur) ? cur : '', placeholder: '#1f6feb', 'aria-label': 'Hex color', maxlength: '9' });
    custom.addEventListener('input', () => { hex.value = custom.value; pick(custom.value); });
    hex.addEventListener('input', () => { const v = hex.value.trim(); if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) pick(v); });
    pop.append(
      h('div', { class: 'icon-row' }, h('button', { type: 'button', class: 'btn small', onclick: () => pick('') }, opt.auto || 'Auto'), opt.noNone ? null : h('button', { type: 'button', class: 'btn small', onclick: () => pick('transparent') }, 'None')),
      h('div', { class: 'lbl' }, 'Theme colors'),
      h('div', { class: 'chips' }, TOKENS.map(([v, title]) => { const c = h('button', { type: 'button', class: 'chip', title, 'aria-label': title, onclick: () => pick(v) }); c.style.background = v; return c; })),
      h('p', { class: 'hint' }, 'Theme colors switch with light and dark.'),
      h('div', { class: 'lbl' }, 'Custom'),
      h('div', { style: { display: 'flex', gap: '6px' } }, custom, hex));
    showPop(pop, b);
  });
  return b;
}
function fFx(el, key, ph) {
  const f = fxFields(el).find(x => x.key === key);
  const v = f ? f.get() || '' : '';
  return h('button', { type: 'button', class: 'fxlink', 'data-key': key, 'data-ph': ph || 'Add a formula', title: 'Edit in the formula bar', onclick: () => focusFx(key) }, h('i', null, 'fx'), h('code', { class: v ? '' : 'empty' }, v || ph || 'Add a formula'));
}
function syncFxLinks() {
  if (!fx.el) return;
  const fields = fxFields(fx.el);
  for (const b of document.querySelectorAll('#right .fxlink')) {
    const f = fields.find(x => x.key === b.dataset.key); if (!f) continue;
    const v = f.get() || '', code = b.querySelector('code');
    code.textContent = v || b.dataset.ph; code.className = v ? '' : 'empty';
  }
}
const condSig = el => (el ? [filled(el.cmp), filled(el.amount), filled(el.label), filled(el.split)].join() : '');
function fCol(el, path, opt = {}) {
  const ds = dsOf(el);
  const cols = ds ? ds.columns.filter(c => !opt.types || opt.types.includes(c.type)) : [];
  return fSelect(el, path, [...(opt.none ? [['', opt.none]] : []), ...cols.map(c => [c.name, c.name])], opt);
}
function fColList(el, path, opt = {}) {
  const ds = dsOf(el); if (!ds) return h('p', { class: 'hint' }, 'Pick a data source first.');
  const cur = new Set(getP(el, path) || []);
  return h('div', { class: 'checks' }, ds.columns.map(c => {
    const cb = h('input', { type: 'checkbox', checked: cur.has(c.name) });
    cb.addEventListener('change', () => { const list = (getP(el, path) || []).filter(n => n !== c.name); if (cb.checked) list.push(c.name); setP(el, path, list); S.struct++; commit(); });
    return h('label', { class: 'check' }, cb, c.name);
  }));
}
const BUCKETS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year']];
function fmtFields(o, path = 'fmt') {
  const f = getP(o, path) || {};
  return [
    row('Format', fSelect(o, path + '.type', [['auto', 'Automatic'], ['number', 'Number'], ['currency', 'Currency'], ['percent', 'Percent']], { def: 'auto' })),
    f.type === 'currency' ? row('Currency', fSelect(o, path + '.currency', ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'MXN', 'BRL', 'CHF'].map(c => [c, c]), { def: 'USD' })) : null,
    row('Decimals', h('div', { class: 'grid4' }, fNum(o, path + '.decimals', { min: 0, max: 6, ph: 'Auto', label: 'Decimals' }), fCheck(o, path + '.compact', 'Short (1.2M)'))),
    row('Before / after', h('div', { class: 'grid4' }, fText(o, path + '.prefix', { ph: 'Prefix', label: 'Prefix' }), fText(o, path + '.suffix', { ph: 'Suffix', label: 'Suffix' }))),
  ];
}
function secStyle(el, o = {}) {
  const d = BOX[el.type] || PLAIN;
  return sec('Look',
    o.text ? row('Font', fSelect(el, 'style.font', [['', 'Hanken Grotesk'], ['bricolage', 'Bricolage Grotesque'], ['fraunces', 'Fraunces (serif)'], ['condensed', 'Barlow Condensed'], ['mono', 'JetBrains Mono']], { def: '' })) : null,
    o.size ? row(o.size, h('div', { class: 'grid4' }, fNum(el, 'style.size', { min: 6, max: 600, ph: o.sizePh || 'Auto', label: o.size }), o.weight ? fSelect(el, 'style.weight', [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']], { def: String(o.weight), label: 'Weight' }) : null)) : null,
    o.align ? row('Align', fSeg(el, 'style.align', [['left', ic('tLeft'), 'Left'], ['center', ic('tCenter'), 'Center'], ['right', ic('tRight'), 'Right']], { def: 'left' })) : null,
    o.valign ? row('Vertical', fSeg(el, 'style.valign', [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']], { def: 'top' })) : null,
    o.text ? row('Text color', fColor(el, 'style.color', { noNone: true })) : null,
    row('Fill', fColor(el, 'style.fill', { auto: d.fill === 'transparent' ? 'None' : 'Auto' })),
    row('Border', h('div', { class: 'grid4' }, fColor(el, 'style.border', { noNone: true }), fNum(el, 'style.bw', { min: 0, max: 20, def: d.bw, tag: 'px', label: 'Border width' }))),
    row('Corners', h('div', { class: 'grid4' }, fNum(el, 'style.radius', { min: 0, max: 400, def: d.radius, tag: 'r', label: 'Corner radius' }), fNum(el, 'style.pad', { min: 0, max: 120, def: d.pad, tag: 'pad', label: 'Padding' }))),
    fCheck(el, 'style.shadow', 'Soft shadow', { def: d.shadow }));
}
function secArrange(el) {
  return sec('Position and size',
    h('div', { class: 'grid4' }, fNum(el, 'x', { tag: 'X', req: true }), fNum(el, 'y', { tag: 'Y', req: true }), fNum(el, 'w', { tag: 'W', min: 8, req: true }), fNum(el, 'h', { tag: 'H', min: 2, req: true }),
      fNum(el, 'rot', { tag: '°', min: -180, max: 180, req: true, label: 'Rotation' }), fNum(el, 'style.opacity', { tag: '%', min: 0, max: 100, scale: 100, def: 1, label: 'Opacity' })),
    h('div', { class: 'icon-row' },
      iconBtn('top', 'Bring to front', () => reorder('front')), iconBtn('up', 'Bring forward', () => reorder('up')), iconBtn('down', 'Send backward', () => reorder('down')), iconBtn('bottom', 'Send to back', () => reorder('back')),
      iconBtn(el.locked ? 'lock' : 'unlock', el.locked ? 'Unlock' : 'Lock in place', () => { el.locked = !el.locked; S.struct++; commit(); }),
      iconBtn('copy', 'Duplicate (Ctrl+D)', duplicateSel), iconBtn('trash', 'Delete', removeSel, 'danger')));
}
function secSource(el, note) {
  const list = [...S.datasets.values()].map(d => [d.id, d.name]);
  return sec('Data source', row('Data', fSelect(el, 'ds', list.length ? list : [['', 'No data yet']], { def: '' })), el.type === 'control' ? null : fCheck(el, 'ignoreFilters', 'Ignore filter controls'), note ? h('p', { class: 'hint' }, note) : null);
}
function measuresEditor(el, opt = {}) {
  const list = el.measures || [];
  return [list.map((m, i) => h('div', { class: 'card' },
    h('div', { class: 'card-top' }, fText(m, 'name', { ph: 'Name', label: 'Measure name' }), opt.color ? h('div', { style: { width: '74px', flex: 'none' } }, fColor(m, 'color', { noNone: true })) : null,
      list.length > 1 ? iconBtn('trash', 'Remove measure', () => { list.splice(i, 1); S.struct++; commit(); }, 'ghost') : null),
    fFx(el, 'm:' + m.id, 'Sum([Revenue])'),
    opt.fmt ? fSelect(m, 'fmt', [['', 'Automatic'], ['number', 'Number'], ['currency', 'Currency'], ['percent', 'Percent']], { def: '', label: 'Measure format' }) : null)),
  h('button', { type: 'button', class: 'btn small', onclick: () => { const m = { id: uid('m_'), name: `Measure ${list.length + 1}`, f: '', color: '' }; (el.measures = list).push(m); S.struct++; commit(); focusFx('m:' + m.id); } }, ic('plus'), 'Add measure')];
}
function secRules(el) {
  const list = el.rules || [];
  return sec('Rules',
    row('Visible when', fFx(el, 'vis', 'Always visible')),
    list.map((r, i) => h('div', { class: 'card' },
      h('div', { class: 'card-top' }, h('span', { class: 'lb', style: { flex: '1' } }, 'When this is true'), iconBtn('trash', 'Remove rule', () => { list.splice(i, 1); S.struct++; commit(); }, 'ghost')),
      fFx(el, 'r:' + i, 'Sum([Revenue]) < @Target'),
      h('div', { class: 'grid4' }, fSelect(r, 'effect', [['fill', 'Change fill'], ['color', 'Change text'], ['border', 'Change border'], ['hide', 'Hide it']], { def: 'fill', label: 'Effect' }), r.effect === 'hide' ? null : fColor(r, 'color', { auto: 'Pick color', noNone: true })))),
    h('button', { type: 'button', class: 'btn small', onclick: () => { (el.rules = list).push({ when: '', effect: 'fill', color: 'var(--d-good)' }); S.struct++; commit(); focusFx('r:' + (list.length - 1)); } }, ic('plus'), 'Add rule'),
    h('p', { class: 'hint' }, 'Rules recolor or hide this element when a formula is true.'));
}
const INSPECT = {
  kpi: el => [
    sec('Value', row('Label', fText(el, 'label', { ph: 'Label' })), row('Formula', fFx(el, 'f')), fmtFields(el)),
    sec('Comparison', row('Compare to', fFx(el, 'cmp', 'Optional formula')),
      filled(el.cmp) ? [row('Show as', fSeg(el, 'cmpMode', [['pct', 'Percent'], ['abs', 'Amount']], { def: 'pct' })), row('Caption', fText(el, 'cmpLabel', { ph: 'vs prior period' })), fCheck(el, 'upGood', 'Going up is good', { def: true })] : h('p', { class: 'hint' }, 'Add a second formula to show the change against it.')),
    sec('Trend line', row('Date column', fCol(el, 'spark.col', { types: ['date'], none: 'None' })),
      el.spark && el.spark.col ? [row('Group by', fSelect(el, 'spark.bucket', BUCKETS, { def: 'month' })), row('Formula', fFx(el, 'spark', 'Same as the value')), row('Line color', fColor(el, 'style.accent', { noNone: true }))] : null),
    secSource(el), secStyle(el, { text: true, size: 'Value size', weight: 600, align: true }),
  ],
  chart: el => {
    const ds = dsOf(el), kind = el.chart, isDate = ds && colType(ds, el.cat && el.cat.col) === 'date';
    return [
      sec('Chart', fSeg(el, 'chart', [['bar', ic('bar'), 'Columns'], ['hbar', ic('hbar'), 'Bars'], ['line', ic('line'), 'Line'], ['area', ic('area'), 'Area'], ['pie', ic('pie'), 'Donut'], ['scatter', ic('scatter'), 'Scatter']]), row('Title', fText(el, 'title', { ph: 'Chart title' }))),
      secSource(el),
      sec(kind === 'scatter' ? 'One dot per' : 'Category', row('Column', fCol(el, 'cat.col')), isDate ? row('Group by', fSelect(el, 'cat.bucket', BUCKETS, { def: 'month' })) : null,
        !isDate ? row('Sort', fSelect(el, 'sort', [['auto', 'Largest first'], ['valueAsc', 'Smallest first'], ['label', 'By name']], { def: 'auto' })) : null,
        !isDate ? row('Show top', fNum(el, 'limit', { min: 1, max: 500, ph: kind === 'pie' ? '7' : 'All', label: 'Show top' })) : null),
      sec(kind === 'scatter' ? 'Measures (X, then Y)' : 'Measures', measuresEditor(el, { color: kind !== 'pie' && kind !== 'scatter' })),
      kind !== 'pie' && kind !== 'scatter' ? sec('Break down', row('Split by', fCol(el, 'split', { none: 'None' })), filled(el.split) ? h('p', { class: 'hint' }, 'Splitting uses the first measure, one series per value.') : null) : null,
      sec('Options',
        kind === 'bar' || kind === 'hbar' || kind === 'area' ? fCheck(el, 'stacked', 'Stack the series') : null,
        kind === 'line' || kind === 'area' ? fCheck(el, 'smooth', 'Smooth the line') : null,
        kind === 'pie' ? fCheck(el, 'donut', 'Donut hole', { def: true }) : null,
        kind !== 'scatter' ? fCheck(el, 'legend', 'Show the legend', { def: true }) : null),
      sec('Number format', fmtFields(el)),
      secStyle(el, { text: true }),
    ];
  },
  table: el => [
    sec('Table', row('Title', fText(el, 'title', { ph: 'Table title' })), fSeg(el, 'mode', [['summary', 'Summary'], ['rows', 'Raw rows']], { def: 'summary' })),
    secSource(el),
    (el.mode || 'summary') === 'summary'
      ? [sec('Group by', fColList(el, 'group')), sec('Measures', measuresEditor(el, { fmt: true }))]
      : sec('Columns', fColList(el, 'cols'), h('p', { class: 'hint' }, 'Leave everything unticked to show all columns.')),
    sec('Rows', row('Row limit', fNum(el, 'limit', { min: 1, max: 2000, def: 100, label: 'Row limit' })), h('p', { class: 'hint' }, 'Click a column heading on the canvas to sort.')),
    secStyle(el, { text: true }),
  ],
  text: el => [
    sec('Text', row('Content', fFx(el, 'text', 'Type here')), h('p', { class: 'hint' }, 'Double-click the text on the canvas to type. Put live numbers inside double braces, like {{ Sum([Revenue]) | currency compact }}.')),
    secSource(el),
    secStyle(el, { text: true, size: 'Size', sizePh: '16', weight: 400, align: true, valign: true }),
  ],
  shape: el => {
    const line = isLineEl(el), ring = el.shape === 'ring';
    return [
      sec('Shape', fSeg(el, 'shape', [['rect', ic('rect'), 'Rectangle'], ['ellipse', ic('ellipse'), 'Ellipse'], ['ring', ic('ring'), 'Ring'], ['triangle', ic('triangle'), 'Triangle'], ['diamond', ic('diamond'), 'Diamond'], ['star', ic('star'), 'Star'], ['hexagon', ic('hexagon'), 'Hexagon'], ['lineS', ic('lineS'), 'Line'], ['arrow', ic('arrow'), 'Arrow']].map(o => (o[0] === 'lineS' ? ['line', o[1], o[2]] : o)), { wrap: true }),
        row(line ? 'Color' : 'Fill', fColor(el, line ? 'style.stroke' : 'style.fill', { noNone: line })),
        line ? null : ring ? row('Thickness', fNum(el, 'style.thick', { min: 1, max: 400, ph: 'Auto', label: 'Ring thickness' })) : row('Outline', h('div', { class: 'grid4' }, fColor(el, 'style.stroke', {}), fNum(el, 'style.sw', { min: 0, max: 60, def: el.container ? 1 : 0, tag: 'px', label: 'Outline width' }))),
        line ? row('Weight', h('div', { class: 'grid4' }, fNum(el, 'style.sw', { min: 1, max: 60, def: 2, tag: 'px', label: 'Line weight' }), fCheck(el, 'style.dash', 'Dashed'))) : null,
        el.shape === 'rect' ? row('Corners', fNum(el, 'style.radius', { min: 0, max: 400, def: 0, tag: 'r', label: 'Corner radius' })) : null,
        line ? null : fCheck(el, 'style.shadow', 'Soft shadow', { def: !!el.container }),
        el.shape === 'rect' ? fCheck(el, 'container', 'Container: carries whatever sits on it') : null),
      sec('Data-driven fill', row('Fill amount', fFx(el, 'amount', '0 to 1, e.g. Sum([Revenue]) / @Target')),
        filled(el.amount) && !ring && !line ? row('Fills', fSeg(el, 'style.dir', [['up', 'Upward'], ['right', 'Left to right']], { def: 'up' })) : null,
        h('p', { class: 'hint' }, 'Any shape can act as a gauge. The formula result sets how much of it is filled.')),
      sec('Label', row('Text', fFx(el, 'label', 'Optional label')), filled(el.label) ? [row('Size', fNum(el, 'style.size', { min: 6, max: 400, ph: 'Auto', label: 'Label size' })), row('Color', fColor(el, 'style.color', { noNone: true })), row('Font', fSelect(el, 'style.font', [['', 'Hanken Grotesk'], ['bricolage', 'Bricolage Grotesque'], ['fraunces', 'Fraunces (serif)'], ['condensed', 'Barlow Condensed'], ['mono', 'JetBrains Mono']], { def: '' }))] : null),
      secSource(el),
    ];
  },
  image: el => [
    sec('Image', h('button', { type: 'button', class: 'btn', onclick: () => pickImage(el) }, ic('upload'), 'Replace image'), row('Fit', fSeg(el, 'fit', [['contain', 'Show all'], ['cover', 'Fill frame'], ['fill', 'Stretch']], { def: 'contain' }))),
    secStyle(el, {}),
    secSource(el, 'Only needed if a rule on this image uses a formula.'),
  ],
  control: el => {
    const kind = el.control;
    return [
      sec('Control', fSeg(el, 'control', [['filter', 'Filter'], ['daterange', 'Dates'], ['slider', 'Slider']], { after: v => { if (v === 'slider' && !el.param) el.param = uniqueParam('Target'); if (v !== 'slider') { el.col = ''; el.values = []; } } }), row('Label', fText(el, 'label', { ph: 'Label' }))),
      kind === 'slider'
        ? sec('Parameter', row('Name', fText(el, 'param', { ph: 'Target' })), h('p', { class: 'hint' }, `Use it in any formula as @${(el.param || 'Target').includes(' ') ? `[${el.param}]` : el.param || 'Target'}.`),
          h('div', { class: 'grid4' }, fNum(el, 'min', { tag: 'min', req: true, step: 'any' }), fNum(el, 'max', { tag: 'max', req: true, step: 'any' }), fNum(el, 'step', { tag: 'step', req: true, min: 0, step: 'any' }), fNum(el, 'value', { tag: 'now', req: true, step: 'any' })), fmtFields(el))
        : [secSource(el, 'Filters every element on this page that uses the same data source.'),
          sec('Filter on', row('Column', fCol(el, 'col', kind === 'daterange' ? { types: ['date'], after: () => { el.values = []; } } : { after: () => { el.values = []; } })),
            kind === 'filter' ? fCheck(el, 'multi', 'Allow several values at once', { def: true }) : null)],
      secStyle(el, { text: true }),
    ];
  },
};
function renderInspector() {
  const right = $('#right');
  const key = S.mode + '|' + [...S.sel].join() + '|' + S.struct + '|' + S.pageId;
  if (right._key === key) return;
  right._key = key;
  const scroll = right._sel === [...S.sel].join() ? right.scrollTop : 0;
  right._sel = [...S.sel].join();
  right.textContent = '';
  if (S.mode !== 'edit') return;
  const pane = h('div', { class: 'pane' });
  right.append(pane);
  const sel = selEls();
  if (!sel.length) {
    pane.append(
      sec('Dashboard', row('Theme', fSelect(S.board, 'theme', [['auto', 'Match the viewer'], ['light', 'Always light'], ['dark', 'Always dark']], { def: 'auto' })), row('Background', fColor(S.board, 'bg', { noNone: true }))),
      sec('How it works',
        h('p', { class: 'hint' }, 'Nothing here snaps to a grid. Place and size every element freely; pink guides appear when edges line up. Hold Alt to ignore them.'),
        h('p', { class: 'hint' }, 'Select an element and write its formula in the bar at the top, with columns in [brackets], for example Sum([Revenue]) / CountDistinct([Order ID]).'),
        h('p', { class: 'hint' }, 'Shapes, images and text can react to data too: give them a fill amount, a rule, or a "visible when" formula.')));
  } else if (sel.length > 1) {
    pane.append(sec(`${sel.length} elements selected`,
      h('div', { class: 'icon-row' }, iconBtn('alignL', 'Align left edges', () => alignSel('l')), iconBtn('alignC', 'Align centers', () => alignSel('c')), iconBtn('alignR', 'Align right edges', () => alignSel('r')), iconBtn('alignT', 'Align top edges', () => alignSel('t')), iconBtn('alignM', 'Align middles', () => alignSel('m')), iconBtn('alignB', 'Align bottom edges', () => alignSel('b'))),
      h('div', { class: 'icon-row' }, iconBtn('distH', 'Space out evenly, left to right', () => distributeSel('h')), iconBtn('distV', 'Space out evenly, top to bottom', () => distributeSel('v')), iconBtn('copy', 'Duplicate', duplicateSel), iconBtn('trash', 'Delete', removeSel, 'danger')),
      h('p', { class: 'hint' }, 'Drag any selected element to move them together.')));
  } else {
    const el = sel[0];
    pane.append(sec(null, row('Name', fText(el, 'name', { ph: TYPE_NAMES[el.type] }))), secArrange(el));
    add(pane, [INSPECT[el.type](el)]);
    if (el.type !== 'control') pane.append(secRules(el));
  }
  right.scrollTop = scroll;
}

/* ---------- formula bar ---------- */
const fx = { el: null, field: null, items: [], idx: 0, ctx: null, orig: '' };
function fxFields(el) {
  const F = [];
  const f = (key, label, kind, get, set, show) => F.push({ key, label, kind, get, set, show });
  const val = v => fmtValue(v, el.fmt);
  if (el.type === 'kpi') {
    f('f', 'Value', 'agg', () => el.f, v => { el.f = v; }, val);
    f('cmp', 'Compare to', 'agg', () => el.cmp, v => { el.cmp = v; }, val);
    if (el.spark && el.spark.col) f('spark', 'Trend line', 'agg', () => el.spark.f, v => { el.spark.f = v; }, val);
  }
  if (el.type === 'chart' || el.type === 'table') (el.measures || []).forEach((m, i) => f('m:' + m.id, m.name || `Measure ${i + 1}`, 'agg', () => m.f, v => { m.f = v; }, v => `${fmtValue(v, m.fmt ? { type: m.fmt } : el.fmt)} across all rows`));
  if (el.type === 'shape') {
    f('amount', 'Fill amount', 'agg', () => el.amount, v => { el.amount = v; }, v => `${fmtValue(N(v), { type: 'percent', decimals: 1 })} filled`);
    f('label', 'Label', 'text', () => el.label, v => { el.label = v; });
  }
  if (el.type === 'text') f('text', 'Text', 'text', () => el.text, v => { el.text = v; });
  if (el.type !== 'control') {
    const yes = v => (Formula.truthy(v) ? 'True' : 'False');
    f('vis', 'Visible when', 'bool', () => el.vis, v => { el.vis = v; }, yes);
    (el.rules || []).forEach((r, i) => f('r:' + i, `Rule ${i + 1}`, 'bool', () => r.when, v => { r.when = v; }, yes));
  }
  return F;
}
function hlFormula(src, into) {
  const toks = Formula.lex(src);
  toks.forEach((t, i) => {
    const raw = src.slice(t.s, t.e);
    let cls = '';
    if (t.t === 'ref') cls = 't-ref'; else if (t.t === 'str') cls = 't-str'; else if (t.t === 'num') cls = 't-num'; else if (t.t === 'param') cls = 't-param'; else if (t.t === 'err') cls = 't-err';
    else if (t.t === 'id') {
      const nx = toks.slice(i + 1).find(x => x.t !== 'ws');
      const l = t.v.toLowerCase();
      if (nx && nx.t === 'lp') cls = Formula.DOCS.some(d => d.name.toLowerCase() === l) || ['average', 'mean', 'and', 'or', 'not'].includes(l) ? 't-fn' : 't-fn t-err';
      else cls = ['and', 'or', 'not', 'true', 'false', 'null'].includes(l) ? 't-fn' : 't-err';
    }
    into.append(cls ? h('span', { class: cls }, raw) : raw);
  });
}
function paintFx() {
  const ta = $('#fx-ta'), pre = $('#fx-hl'), out = $('#fx-out'), edit = $('#fx-edit');
  const src = ta.value;
  pre.textContent = '';
  out.className = 'fx-out'; out.textContent = ''; edit.classList.remove('bad');
  if (fx.field) {
    if (fx.field.kind === 'text') {
      let last = 0; const re = /\{\{([\s\S]*?)\}\}/g; let m;
      while ((m = re.exec(src))) { pre.append(src.slice(last, m.index), h('span', { class: 't-dim' }, '{{')); hlFormula(m[1], pre); pre.append(h('span', { class: 't-dim' }, '}}')); last = m.index + m[0].length; }
      pre.append(src.slice(last));
      const bad = template(fx.el, src).find(p => typeof p !== 'string');
      if (bad) { out.textContent = bad.err; out.classList.add('bad'); edit.classList.add('bad'); }
      else if (src.includes('{{')) out.textContent = '= ' + templateText(fx.el, src).replace(/\s+/g, ' ').slice(0, 90);
    } else {
      hlFormula(src, pre);
      if (src.trim()) {
        try { out.textContent = '= ' + fx.field.show(evalF(fx.el, src)); }
        catch (e) { out.textContent = e.message; out.classList.add('bad'); edit.classList.add('bad'); }
      }
    }
  }
  pre.append('\n');
  ta.style.height = '32px';
  ta.style.height = Math.min(132, Math.max(32, ta.scrollHeight)) + 'px';
  pre.scrollTop = ta.scrollTop;
}
function renderFx(soft) {
  const ta = $('#fx-ta'), sel = $('#fx-field'), bar = $('#fx');
  const el = S.mode === 'edit' ? one() : null;
  const fields = el ? fxFields(el) : [];
  if (!fields.length) {
    fx.el = null; fx.field = null;
    bar.classList.add('off'); ta.disabled = true; ta.value = ''; sel.hidden = true; sel._key = '';
    ta.placeholder = el ? 'This element is set up in the panel on the right' : S.sel.size > 1 ? 'Select a single element to edit its formula' : 'Select a KPI, chart, shape or text, then write its formula here';
    hideAc(); paintFx();
    return;
  }
  const field = fields.find(f => f.key === S.fxKey) || fields[0];
  const changed = fx.el !== el || !fx.field || fx.field.key !== field.key;
  S.fxKey = field.key; fx.el = el; fx.field = field;
  bar.classList.remove('off'); ta.disabled = false; sel.hidden = false;
  const key = el.id + fields.map(f => f.key + f.label).join('|');
  if (sel._key !== key) { sel._key = key; sel.textContent = ''; for (const f of fields) sel.append(h('option', { value: f.key }, f.label)); }
  sel.value = field.key;
  ta.placeholder = field.kind === 'text' ? 'Type text. Use {{ Sum([Revenue]) | currency }} for live numbers' : field.kind === 'bool' ? 'A condition, e.g. Sum([Revenue]) >= @Target' : 'A formula, e.g. Sum([Revenue]) / CountDistinct([Order ID])';
  if (changed || !(soft && document.activeElement === ta)) { if (ta.value !== (field.get() || '')) ta.value = field.get() || ''; }
  if (changed) hideAc();
  paintFx();
}
function focusFx(key) {
  if (key) S.fxKey = key;
  closeSheet();
  renderFx();
  const ta = $('#fx-ta');
  if (ta.disabled) return;
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}
function fxChanged() {
  if (!fx.field) return;
  fx.field.set($('#fx-ta').value);
  paintFx();
  renderCanvas();
  queueCommit();
}
function insertFx(text) {
  const ta = $('#fx-ta'); if (ta.disabled) return;
  const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
  ta.value = ta.value.slice(0, a) + text + ta.value.slice(b);
  ta.focus();
  const pos = a + text.length - (text.endsWith('()') ? 0 : 0);
  ta.setSelectionRange(pos, pos);
  fxChanged();
}
function hideAc() { const ac = $('#fx-ac'); if (ac) ac.hidden = true; fx.items = []; }
function acContext() {
  const ta = $('#fx-ta'), pos = ta.selectionStart;
  if (pos !== ta.selectionEnd) return null;
  let before = ta.value.slice(0, pos), base = 0;
  if (fx.field.kind === 'text') {
    const o = before.lastIndexOf('{{');
    if (o < 0 || before.lastIndexOf('}}') > o) return null;
    base = o + 2; before = before.slice(base);
  }
  let m;
  if ((m = /@\[?([\w ]*)$/.exec(before))) return { type: 'param', q: m[1], start: base + before.length - m[0].length, pos };
  if ((m = /\[([^\[\]]*)$/.exec(before))) return { type: 'col', q: m[1], start: base + before.length - m[0].length, pos };
  if (((before.match(/"/g) || []).length) % 2) return null;
  if ((m = /([A-Za-z_]\w*)$/.exec(before))) return { type: 'fn', q: m[1], start: base + before.length - m[0].length, pos };
  return null;
}
function showAc() {
  const ac = $('#fx-ac');
  const ctx = fx.field ? acContext() : null;
  if (!ctx) return hideAc();
  const q = ctx.q.toLowerCase();
  const rank = (name) => { const l = name.toLowerCase(); return l.startsWith(q) ? 0 : l.includes(q) ? 1 : -1; };
  let items = [];
  if (ctx.type === 'col') {
    const ds = dsOf(fx.el);
    items = (ds ? ds.columns : []).map(c => ({ r: rank(c.name), label: `[${c.name}]`, detail: c.formula ? 'calculated' : c.type, insert: `[${c.name}]`, tag: 'column' }));
  } else if (ctx.type === 'param') {
    items = els().filter(e => e.type === 'control' && e.control === 'slider' && e.param).map(e => ({ r: rank(e.param), label: '@' + e.param, detail: `slider, now ${fmtValue(N(e.value), e.fmt)}`, insert: /^\w+$/.test(e.param) ? '@' + e.param : `@[${e.param}]`, tag: 'control' }));
  } else {
    items = Formula.DOCS.map(d => ({ r: rank(d.name), label: d.sig, detail: d.d, insert: d.name + (d.name === 'Today' || d.name === 'Now' ? '()' : '('), tag: d.agg ? 'aggregate' : null }));
    if (q.length < 1) items = [];
  }
  items = items.filter(i => i.r >= 0).sort((a, b) => a.r - b.r).slice(0, 12);
  if (!items.length || (items.length === 1 && ctx.type === 'fn' && items[0].insert.replace(/[()]/g, '').toLowerCase() === q && false)) return hideAc();
  fx.items = items; fx.idx = 0; fx.ctx = ctx;
  ac.textContent = '';
  items.forEach((it, i) => {
    const n = h('div', { class: 'ac-item' + (i === 0 ? ' on' : ''), role: 'option' }, h('b', null, it.label), h('span', null, it.detail), it.tag ? h('i', { class: 'ac-tag' }, it.tag) : null);
    n.addEventListener('pointerdown', e => { e.preventDefault(); acceptAc(i); });
    ac.append(n);
  });
  ac.style.left = $('#fx-edit').offsetLeft + 'px';
  ac.hidden = false;
}
function acceptAc(i) {
  const it = fx.items[i], ctx = fx.ctx, ta = $('#fx-ta');
  if (!it) return;
  let end = ctx.pos;
  if (ctx.type !== 'fn' && ta.value[end] === ']') end++;
  if (ctx.type === 'fn' && ta.value[end] === '(' && it.insert.endsWith('(')) end++;
  ta.value = ta.value.slice(0, ctx.start) + it.insert + ta.value.slice(end);
  const pos = ctx.start + it.insert.length;
  ta.focus(); ta.setSelectionRange(pos, pos);
  hideAc();
  fxChanged();
}
function toggleFnRef(anchor) {
  if (anchor.hasAttribute('data-pop')) { closePops(); return; }
  closePops();
  const search = h('input', { type: 'search', placeholder: 'Search functions', 'aria-label': 'Search functions', id: 'fn-search' });
  const list = h('div', { class: 'fnref-list' });
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    list.textContent = '';
    let cat = '';
    for (const d of Formula.DOCS) {
      if (q && !(d.name.toLowerCase().includes(q) || d.d.toLowerCase().includes(q))) continue;
      if (d.cat !== cat) { cat = d.cat; list.append(h('h4', null, cat)); }
      const b = h('button', { type: 'button' }, h('code', null, d.sig), h('small', null, d.d));
      b.addEventListener('pointerdown', e => e.preventDefault());
      b.addEventListener('click', () => { if (!fx.field) { toast('Select an element first, then pick a function to add it to the formula.'); return; } insertFx(d.name + (d.name === 'Today' || d.name === 'Now' ? '()' : '(')); });
      list.append(b);
    }
    if (!list.children.length) list.append(h('p', { class: 'hint', style: { padding: '8px' } }, 'No function matches that search.'));
  };
  search.addEventListener('input', draw);
  draw();
  const pop = h('div', { class: 'fnref' }, search, list,
    h('p', { class: 'hint', style: { padding: '8px 12px', borderTop: '1px solid var(--line)' } }, 'Operators: + − * / ^ & (join text) = <> < <= > >= and or not. Write 25% for 0.25. Slider controls are @Name.'));
  $('#fx').append(pop);
  anchor.setAttribute('data-pop', '');
  pops.push({ node: pop, anchor });
}
function initFx() {
  const ta = $('#fx-ta'), sel = $('#fx-field'), help = $('#fx-help');
  help.append(ic('book'), h('span', { class: 'hide-narrow' }, 'Functions'));
  help.addEventListener('click', () => toggleFnRef(help));
  ta.addEventListener('input', () => { fxChanged(); showAc(); });
  ta.addEventListener('scroll', () => { $('#fx-hl').scrollTop = ta.scrollTop; });
  ta.addEventListener('click', () => { if (!$('#fx-ac').hidden) showAc(); });
  ta.addEventListener('focus', () => { fx.orig = ta.value; fx.cond = condSig(fx.el); });
  ta.addEventListener('blur', e => {
    hideAc();
    if (!fx.field) return;
    syncFxLinks();
    const intoPanel = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('#right');
    if (condSig(fx.el) !== fx.cond && !intoPanel) S.struct++;
    commit();
  });
  ta.addEventListener('keydown', e => {
    e.stopPropagation();
    const open = !$('#fx-ac').hidden && fx.items.length;
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      fx.idx = (fx.idx + (e.key === 'ArrowDown' ? 1 : -1) + fx.items.length) % fx.items.length;
      [...$('#fx-ac').children].forEach((n, i) => { n.classList.toggle('on', i === fx.idx); if (i === fx.idx) n.scrollIntoView({ block: 'nearest' }); });
    } else if (open && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); acceptAc(fx.idx); }
    else if (e.key === 'Escape') { if (open) hideAc(); else { ta.value = fx.orig; fxChanged(); ta.blur(); } }
    else if (e.key === 'Enter' && !e.shiftKey && fx.field && fx.field.kind !== 'text') { e.preventDefault(); ta.blur(); }
  });
  sel.addEventListener('change', () => { S.fxKey = sel.value; renderFx(); $('#fx-ta').focus(); });
  document.addEventListener('pointerdown', e => {
    if (pops.length && !e.target.closest('.pop, .menu, .fnref') && !e.target.closest('[data-pop]') && !e.target.closest('#viewport')) closePops();
  }, true);
}
