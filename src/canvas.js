/* ===== canvas: placement, selection overlay, pointer and keyboard interaction ===== */
let vp, stage, elsLayer, overlay;
const nodes = new Map();
const HANDLES = [['nw', -1, -1, 0, 0], ['n', 0, -1, 50, 0], ['ne', 1, -1, 100, 0], ['e', 1, 0, 100, 50], ['se', 1, 1, 100, 100], ['s', 0, 1, 50, 100], ['sw', -1, 1, 0, 100], ['w', -1, 0, 0, 50]];
const isLineEl = el => el.type === 'shape' && (el.shape === 'line' || el.shape === 'arrow');

function sigOf(el) {
  const { x, y, w, h: hh, rot, ...rest } = el;
  return JSON.stringify(rest) + (el.type === 'shape' ? `${w}x${hh}` : '') + `|${S.evalEpoch}|${S.themeEpoch}|${S.mode}|` + (el.type === 'image' && S.images.has(el.img) ? 1 : 0);
}
function place(node, el, i) {
  const st = node.style;
  st.width = el.w + 'px'; st.height = el.h + 'px';
  st.transform = `translate(${el.x}px, ${el.y}px)` + (el.rot ? ` rotate(${el.rot}deg)` : '');
  st.zIndex = i + 1;
}
function renderContent(el, node) {
  const body = node.firstChild;
  destroyChart(el.id);
  body.textContent = ''; body.removeAttribute('style');
  const fx = effective(el);
  node.classList.toggle('ghost', fx.hidden && S.mode === 'edit');
  node.hidden = !!el.hidden || (fx.hidden && S.mode === 'view');
  if (node.hidden) return;
  try { RENDER[el.type](el, body, fx); } catch (e) { body.append(errBox(e)); }
  if (fx.err && S.mode === 'edit') body.append(errBox(fx.err));
}
function renderCanvas() {
  if (!S.board || !elsLayer) return;
  getPass();
  const seen = new Set();
  els().forEach((el, i) => {
    seen.add(el.id);
    let node = nodes.get(el.id);
    if (!node) { node = h('div', { class: 'el', 'data-id': el.id }, h('div', { class: 'el-body' })); nodes.set(el.id, node); elsLayer.append(node); }
    place(node, el, i);
    const sig = sigOf(el);
    if (node._sig !== sig && !node._editing) { node._sig = sig; renderContent(el, node); }
  });
  for (const [id, node] of nodes) if (!seen.has(id)) { destroyChart(id); node.remove(); nodes.delete(id); }
  renderOverlay();
}
function keepNode(el) { getPass(); const n = nodes.get(el.id); if (n) n._sig = sigOf(el); }
function placeAll() { els().forEach((el, i) => { const n = nodes.get(el.id); if (n) place(n, el, i); }); renderOverlay(); }

function renderOverlay() {
  overlay.textContent = '';
  const edit = S.mode === 'edit';
  const sel = edit ? selEls() : [];
  const single = sel.length === 1 ? sel[0] : null;
  for (const [id, node] of nodes) node.classList.toggle('live', !!single && single.id === id && ['control', 'chart', 'table'].includes(single.type));
  for (const el of sel) {
    const box = h('div', { class: 'sel' + (el.locked ? ' locked' : '') });
    box.style.width = el.w + 'px'; box.style.height = el.h + 'px';
    box.style.transform = `translate(${el.x}px, ${el.y}px)` + (el.rot ? ` rotate(${el.rot}deg)` : '');
    if (single && !el.locked) {
      const only = isLineEl(el) ? ['e', 'w'] : null;
      const sw = el.w * S.view.z, sh = el.h * S.view.z;
      for (const [name, hx, hy, lx, ly] of HANDLES) {
        if (only && !only.includes(name)) continue;
        /* on small elements, drop the edge handles so the body stays grabbable */
        if (!only && ((hx === 0 && sw < 44) || (hy === 0 && sh < 44) || (sw < 26 && sh < 26 && name !== 'se'))) continue;
        const hd = h('div', { class: 'hd', 'data-h': name });
        hd.style.left = lx + '%'; hd.style.top = ly + '%'; hd.style.cursor = name + '-resize';
        box.append(hd);
      }
      const rot = h('div', { class: 'hd rot', title: 'Rotate' });
      rot.style.left = '50%'; rot.style.top = `calc(-22px / var(--zoom))`;
      box.append(h('div', { class: 'rot-stem' }), rot, h('div', { class: 'size-tag' }, `${round(el.w)} × ${round(el.h)}`));
    }
    overlay.append(box);
  }
  updateHud();
}
function updateHud() {
  const info = $('#hud-info'); if (!info) return;
  const sel = selEls();
  if (sel.length === 1) { const e = sel[0]; info.textContent = `x ${round(e.x)}  y ${round(e.y)}  ·  ${round(e.w)} × ${round(e.h)}${e.rot ? `  ·  ${round(e.rot)}°` : ''}`; }
  else if (sel.length > 1) info.textContent = `${sel.length} selected · drag to move together`;
  else info.textContent = 'Scroll to pan · Ctrl + scroll to zoom · drag on the canvas to select';
}

/* ---------- view ---------- */
let dprTimer = null;
function applyView() {
  const v = S.view;
  stage.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
  stage.style.setProperty('--zoom', v.z);
  let step = 24 * v.z; while (step < 12) step *= 4;
  vp.style.backgroundSize = `${step}px ${step}px`;
  vp.style.backgroundPosition = `${v.x}px ${v.y}px`;
  const zv = $('#zoom-val'); if (zv) zv.textContent = Math.round(v.z * 100) + '%';
  if (applyView.z !== v.z) { applyView.z = v.z; if (S.board) renderOverlay(); }
  clearTimeout(dprTimer);
  dprTimer = setTimeout(() => { const d = chartDpr(); for (const c of charts.values()) if (c.options.devicePixelRatio !== d) { c.options.devicePixelRatio = d; c.resize(); } }, 220);
}
function toCanvas(cx, cy) { const r = vp.getBoundingClientRect(); return { x: (cx - r.left - S.view.x) / S.view.z, y: (cy - r.top - S.view.y) / S.view.z }; }
function viewCenter() { const r = vp.getBoundingClientRect(); return toCanvas(r.left + r.width / 2, r.top + r.height / 2); }
function zoomAt(cx, cy, z) {
  z = clamp(z, 0.08, 6);
  const r = vp.getBoundingClientRect(), px = cx - r.left, py = cy - r.top, v = S.view;
  v.x = px - ((px - v.x) / v.z) * z; v.y = py - ((py - v.y) / v.z) * z; v.z = z;
  applyView();
}
function zoomStep(dir) { const r = vp.getBoundingClientRect(); const stops = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6]; const z = S.view.z; const next = dir > 0 ? stops.find(s => s > z + 0.001) : [...stops].reverse().find(s => s < z - 0.001); zoomAt(r.left + r.width / 2, r.top + r.height / 2, next || z); }
function bounds(list) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const e of list) { x1 = Math.min(x1, e.x); y1 = Math.min(y1, e.y); x2 = Math.max(x2, e.x + e.w); y2 = Math.max(y2, e.y + e.h); }
  return { x: x1, y: y1, w: Math.max(1, x2 - x1), h: Math.max(1, y2 - y1) };
}
function fitView() {
  const list = els().filter(e => !e.hidden), r = vp.getBoundingClientRect();
  if (!list.length || !r.width) { S.view = { x: 40, y: 40, z: 1 }; applyView(); return; }
  const b = bounds(list), view = S.mode === 'view', pad = r.width < 600 ? 16 : view ? 28 : 56;
  const zw = (r.width - pad * 2) / b.w, zh = (r.height - pad * 2) / b.h;
  const z = clamp(zh >= zw * 0.72 ? Math.min(zw, zh) : zw, 0.08, view ? 1.25 : 1);
  S.view = { z, x: (r.width - b.w * z) / 2 - b.x * z, y: Math.max(pad, (r.height - b.h * z) / 2) - b.y * z };
  applyView();
}

/* ---------- pointer interaction ---------- */
const pointers = new Map();
let drag = null, pinch = null, spaceDown = false;
const capture = e => { try { vp.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ } };

function selectionChanged() { renderOverlay(); renderChrome(); }
function movingSet() {
  const sel = selEls().filter(x => !x.locked), set = new Set(sel), list = els();
  for (const c of sel) if (c.type === 'shape' && c.container) {
    const ci = list.indexOf(c);
    list.forEach((o, i) => { if (i > ci && !o.locked && !set.has(o) && o.x >= c.x && o.y >= c.y && o.x + o.w <= c.x + c.w && o.y + o.h <= c.y + c.h) set.add(o); });
  }
  return [...set];
}
function startPan(e) { drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y }; vp.classList.add('panning'); capture(e); }
function onDown(e) {
  closePops();
  if (e.target.closest('.hud') || S.loading) return;
  if (S.sheet) closeSheet();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    drag = null;
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, v: { ...S.view } };
    return;
  }
  if (pointers.size > 2) return;
  const edit = S.mode === 'edit';
  const hd = edit && e.target.closest('.hd');
  const node = e.target.closest('.el');
  const el = node ? elById(node.dataset.id) : null;
  const interactive = e.target.closest('button, input, select, textarea, label, a, th, [contenteditable]');
  const scroller = e.pointerType === 'touch' && e.target.closest('.tbl-wrap, .ctl-opts, .ctl-list');
  if (e.button === 1 || spaceDown) { e.preventDefault(); return startPan(e); }
  if (e.button !== 0) return;
  if (hd) { e.preventDefault(); return startHandle(e, hd); }
  if (el && (interactive || scroller) && (!edit || node.classList.contains('live') || (interactive && interactive.matches('[contenteditable]')))) return;
  if (!edit) return startPan(e);
  const act = document.activeElement;
  if (act && act !== document.body && !vp.contains(act)) act.blur();
  if (el) {
    if (e.shiftKey) { if (S.sel.has(el.id)) S.sel.delete(el.id); else S.sel.add(el.id); selectionChanged(); }
    else if (!S.sel.has(el.id)) { S.sel = new Set([el.id]); selectionChanged(); }
    if (S.sel.has(el.id)) {
      drag = { type: 'move', sx: e.clientX, sy: e.clientY, started: false, clicked: el, shift: e.shiftKey, multi: S.sel.size > 1, items: movingSet().map(m => ({ el: m, x: m.x, y: m.y })) };
      capture(e);
    }
    return;
  }
  if (e.pointerType === 'touch') { if (S.sel.size) { S.sel.clear(); selectionChanged(); } return startPan(e); }
  const a = toCanvas(e.clientX, e.clientY);
  drag = { type: 'marquee', a, base: e.shiftKey ? new Set(S.sel) : new Set() };
  if (!e.shiftKey && S.sel.size) { S.sel.clear(); selectionChanged(); }
  capture(e);
}
function startHandle(e, hd) {
  const el = one(); if (!el) return;
  if (hd.classList.contains('rot')) drag = { type: 'rotate', el };
  else {
    const def = HANDLES.find(x => x[0] === hd.dataset.h);
    drag = { type: 'resize', el, hx: def[1], hy: def[2], sx: e.clientX, sy: e.clientY, o: { x: el.x, y: el.y, w: el.w, h: el.h }, rot: ((el.rot || 0) * Math.PI) / 180 };
  }
  capture(e);
}
function snapTargets(skip) {
  const xs = [], ys = [];
  for (const o of els()) {
    if (skip.has(o.id) || o.hidden) continue;
    for (const x of [o.x, o.x + o.w / 2, o.x + o.w]) xs.push({ v: x, a: o.y, b: o.y + o.h });
    for (const y of [o.y, o.y + o.h / 2, o.y + o.h]) ys.push({ v: y, a: o.x, b: o.x + o.w });
  }
  return { xs, ys };
}
function snapMove(d, dx, dy, guides) {
  const thr = 6 / S.view.z, b = d.box;
  const pick = (targets, edges) => { let best = null; for (const t of targets) for (const e of edges) { const off = t.v - e; if (Math.abs(off) <= thr && (!best || Math.abs(off) < Math.abs(best.off))) best = { off, t }; } return best; };
  const sx = pick(d.targets.xs, [b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w]);
  if (sx) dx += sx.off;
  const sy = pick(d.targets.ys, [b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h]);
  if (sy) dy += sy.off;
  if (sx) guides.push({ x: sx.t.v, a: Math.min(sx.t.a, b.y + dy), b: Math.max(sx.t.b, b.y + dy + b.h) });
  if (sy) guides.push({ y: sy.t.v, a: Math.min(sy.t.a, b.x + dx), b: Math.max(sy.t.b, b.x + dx + b.w) });
  return { dx, dy };
}
function drawGuides(guides) {
  const t = 1 / S.view.z;
  for (const g of guides) {
    const n = h('div', { class: 'guide' });
    if (g.x != null) Object.assign(n.style, { left: g.x - t / 2 + 'px', top: g.a + 'px', width: t + 'px', height: g.b - g.a + 'px' });
    else Object.assign(n.style, { top: g.y - t / 2 + 'px', left: g.a + 'px', height: t + 'px', width: g.b - g.a + 'px' });
    overlay.append(n);
  }
}
function onMove(e) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const r = vp.getBoundingClientRect(), v0 = pinch.v, z = clamp(v0.z * (d / pinch.d), 0.08, 6);
    const px = pinch.mx - r.left, py = pinch.my - r.top;
    S.view = { z, x: mx - r.left - ((px - v0.x) / v0.z) * z, y: my - r.top - ((py - v0.y) / v0.z) * z };
    applyView();
    return;
  }
  if (!drag) return;
  const dxs = e.clientX - drag.sx, dys = e.clientY - drag.sy, z = S.view.z;
  switch (drag.type) {
    case 'pan': S.view.x = drag.vx + dxs; S.view.y = drag.vy + dys; applyView(); break;
    case 'move': {
      if (!drag.items.length) return;
      if (!drag.started) {
        if (Math.hypot(dxs, dys) < 4) return;
        drag.started = true;
        drag.box = bounds(drag.items.map(i => ({ x: i.x, y: i.y, w: i.el.w, h: i.el.h })));
        drag.targets = snapTargets(new Set(drag.items.map(i => i.el.id)));
      }
      let dx = dxs / z, dy = dys / z;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const guides = [];
      if (!e.altKey) ({ dx, dy } = snapMove(drag, dx, dy, guides));
      for (const it of drag.items) { it.el.x = round(it.x + dx); it.el.y = round(it.y + dy); }
      placeAll(); drawGuides(guides);
      break;
    }
    case 'resize': {
      const { el, hx, hy, o, rot } = drag, cos = Math.cos(rot), sin = Math.sin(rot);
      const dx = dxs / z, dy = dys / z;
      const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
      let w = Math.max(8, o.w + hx * lx), hh = Math.max(isLineEl(el) ? 2 : 8, o.h + hy * ly);
      if (((el.type === 'image') !== e.shiftKey) && hx && hy) { const k = Math.max(w / o.w, hh / o.h); w = o.w * k; hh = o.h * k; }
      w = round(w); hh = round(hh);
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      const ax = (-hx * o.w) / 2, ay = (-hy * o.h) / 2;
      const Ax = cx + ax * cos - ay * sin, Ay = cy + ax * sin + ay * cos;
      const nx = (hx * w) / 2, ny = (hy * hh) / 2;
      const ncx = Ax + nx * cos - ny * sin, ncy = Ay + nx * sin + ny * cos;
      const p = rot ? 1 : 0;
      el.w = w; el.h = hh; el.x = round(ncx - w / 2, p); el.y = round(ncy - hh / 2, p);
      renderCanvas();
      break;
    }
    case 'rotate': {
      const el = drag.el, p = toCanvas(e.clientX, e.clientY);
      let a = (Math.atan2(p.y - (el.y + el.h / 2), p.x - (el.x + el.w / 2)) * 180) / Math.PI + 90;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      else { const near = Math.round(a / 45) * 45; if (Math.abs(a - near) < 3) a = near; }
      a = ((a + 180) % 360 + 360) % 360 - 180;
      el.rot = Math.round(a) || 0;
      placeAll();
      break;
    }
    case 'marquee': {
      const b = toCanvas(e.clientX, e.clientY), a = drag.a;
      const r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
      const hit = els().filter(o => !o.hidden && !o.locked && o.x < r.x + r.w && o.x + o.w > r.x && o.y < r.y + r.h && o.y + o.h > r.y).map(o => o.id);
      S.sel = new Set([...drag.base, ...hit]);
      renderOverlay();
      const m = h('div', { class: 'marquee' });
      Object.assign(m.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      overlay.append(m);
      break;
    }
  }
}
function onUp(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (!drag) return;
  const d = drag; drag = null;
  vp.classList.remove('panning');
  try { vp.releasePointerCapture(e.pointerId); } catch (err) { /* not captured */ }
  if (d.type === 'move') {
    if (d.started) { S.struct++; commit(); }
    else if (!d.shift && d.multi) { S.sel = new Set([d.clicked.id]); selectionChanged(); }
  } else if (d.type === 'resize' || d.type === 'rotate') { S.struct++; commit(); }
  else if (d.type === 'marquee') selectionChanged();
}
function onWheel(e) {
  if (S.loading) return;
  const sc = e.target.closest('.tbl-wrap, .ctl-opts, .ctl-list');
  if (sc && !(e.ctrlKey || e.metaKey) && sc.scrollHeight > sc.clientHeight + 1 && getComputedStyle(sc).pointerEvents !== 'none') return;
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, S.view.z * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0022)));
  else { const k = e.deltaMode ? 24 : 1; S.view.x -= (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k; S.view.y -= (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k; applyView(); }
}

/* ---------- element operations ---------- */
const TYPE_NAMES = { kpi: 'KPI', chart: 'Chart', table: 'Table', text: 'Text', shape: 'Shape', image: 'Image', control: 'Control' };
function makeEl(type, sub, ds) {
  const el = { id: uid('el_'), type, name: '', x: 0, y: 0, w: 260, h: 140, rot: 0, ds: ds ? ds.id : null, style: {}, rules: [], vis: '' };
  const cols = ds ? ds.columns : [];
  const numCol = (cols.find(c => c.type === 'number') || {}).name;
  const textCol = (cols.find(c => c.type === 'text' && distinct(ds, c.name).keys.length <= 40) || cols.find(c => c.type === 'text') || {}).name;
  const dateCol = (cols.find(c => c.type === 'date') || {}).name;
  const measure = () => ({ id: uid('m_'), name: numCol ? `Total ${numCol.toLowerCase()}` : 'Rows', f: numCol ? `Sum([${numCol}])` : 'Count()', color: '' });
  if (type === 'kpi') Object.assign(el, { w: 260, h: 140, label: numCol ? `Total ${numCol.toLowerCase()}` : 'Rows', f: numCol ? `Sum([${numCol}])` : ds ? 'Count()' : '', fmt: { type: 'auto', compact: true }, cmp: '', cmpLabel: 'vs prior period', cmpMode: 'pct', upGood: true, spark: { col: '', bucket: 'month', f: '' } });
  else if (type === 'chart') {
    const timeish = sub === 'line' || sub === 'area';
    Object.assign(el, { w: 460, h: 300, chart: sub || 'bar', title: '', cat: { col: (timeish ? dateCol || textCol : textCol || dateCol) || '', bucket: 'month' }, measures: [measure()], split: '', sort: 'auto', limit: 0, stacked: false, smooth: false, legend: true, fmt: { type: 'auto' } });
    if (sub === 'scatter') { const second = (cols.filter(c => c.type === 'number')[1] || {}).name; el.measures.push({ id: uid('m_'), name: second ? `Total ${second.toLowerCase()}` : 'Rows', f: second ? `Sum([${second}])` : 'Count()', color: '' }); }
    el.title = el.cat.col ? `${el.measures[0].name} by ${el.cat.col.toLowerCase()}` : 'New chart';
  } else if (type === 'table') Object.assign(el, { w: 460, h: 280, title: '', mode: 'summary', group: textCol ? [textCol] : [], measures: [measure()], cols: [], sortCol: '', sortDir: 'desc', limit: 100, fmt: { type: 'auto' } });
  else if (type === 'text') Object.assign(el, { w: 320, h: 48, text: 'Double-click to edit this text', style: { size: 20, weight: 600 } });
  else if (type === 'image') Object.assign(el, { w: 220, h: 160, img: null, fit: 'contain' });
  else if (type === 'control') {
    Object.assign(el, { w: 240, h: 84, control: sub || 'filter', label: '', col: sub === 'daterange' ? dateCol || '' : textCol || '', multi: true, values: [], preset: 'all', from: '', to: '', param: 'Target', min: 0, max: 100, step: 1, value: 50, fmt: { type: 'auto' } });
    if (sub === 'slider') { el.label = 'Target'; el.h = 72; el.param = uniqueParam('Target'); }
    else el.label = el.col || (sub === 'daterange' ? 'Date range' : 'Filter');
    if (sub === 'daterange') el.h = 76;
  } else if (type === 'shape') {
    Object.assign(el, { w: 160, h: 160, shape: sub || 'rect', amount: '', label: '' });
    if (sub === 'container') Object.assign(el, { shape: 'rect', container: true, w: 420, h: 260, style: { radius: 16 } });
    if (sub === 'rect') { el.w = 200; el.h = 120; el.style.radius = 10; }
    if (sub === 'line' || sub === 'arrow') { el.w = 220; el.h = 20; }
  }
  const base = type === 'chart' ? { bar: 'Bar chart', hbar: 'Bar chart', line: 'Line chart', area: 'Area chart', pie: 'Donut chart', scatter: 'Scatter plot' }[el.chart] : type === 'shape' ? (el.container ? 'Container' : el.shape[0].toUpperCase() + el.shape.slice(1)) : type === 'control' ? { filter: 'Filter', daterange: 'Date range', slider: 'Slider' }[el.control] : TYPE_NAMES[type];
  const n = els().filter(o => (o.name || '').startsWith(base)).length;
  el.name = n ? `${base} ${n + 1}` : base;
  return el;
}
function uniqueParam(base) {
  const used = new Set(els().filter(e => e.type === 'control' && e.control === 'slider').map(e => (e.param || '').toLowerCase()));
  let name = base, k = 2;
  while (used.has(name.toLowerCase())) name = base + k++;
  return name;
}
function addEl(type, sub, opts = {}) {
  const el = makeEl(type, sub, firstDs());
  Object.assign(el, opts.props || {});
  const c = opts.at || viewCenter();
  el.x = round(c.x - el.w / 2); el.y = round(c.y - el.h / 2);
  while (els().some(o => o.x === el.x && o.y === el.y)) { el.x += 16; el.y += 16; }
  if (el.container) els().unshift(el); else els().push(el);
  S.sel = new Set([el.id]); S.struct++;
  closeSheet();
  commit();
  return el;
}
function removeSel() {
  const ids = new Set(selEls().filter(e => !e.locked).map(e => e.id));
  if (!ids.size) return;
  page().els = els().filter(e => !ids.has(e.id));
  S.sel.clear(); S.struct++; commit();
}
function pasteEls(list, dx = 16) {
  const copies = clone(list).map(c => { c.id = uid('el_'); c.x += dx; c.y += dx; if (c.type === 'control' && c.control === 'slider') c.param = uniqueParam(c.param || 'Target'); return c; });
  els().push(...copies);
  S.sel = new Set(copies.map(c => c.id)); S.struct++; commit();
}
const duplicateSel = () => { const s = selEls(); if (s.length) pasteEls(s); };
function reorder(dir) {
  const list = els(), sel = selEls(); if (!sel.length) return;
  const rest = list.filter(e => !S.sel.has(e.id));
  if (dir === 'front') page().els = [...rest, ...sel];
  else if (dir === 'back') page().els = [...sel, ...rest];
  else {
    const order = dir === 'up' ? [...sel].reverse() : sel;
    for (const e of order) {
      const i = list.indexOf(e), j = dir === 'up' ? i + 1 : i - 1;
      if (j < 0 || j >= list.length || S.sel.has(list[j].id)) continue;
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  S.struct++; commit();
}
function alignSel(kind) {
  const sel = selEls().filter(e => !e.locked); if (sel.length < 2) return;
  const b = bounds(sel);
  for (const e of sel) {
    if (kind === 'l') e.x = b.x; else if (kind === 'c') e.x = round(b.x + b.w / 2 - e.w / 2); else if (kind === 'r') e.x = round(b.x + b.w - e.w);
    else if (kind === 't') e.y = b.y; else if (kind === 'm') e.y = round(b.y + b.h / 2 - e.h / 2); else if (kind === 'b') e.y = round(b.y + b.h - e.h);
  }
  S.struct++; commit();
}
function distributeSel(axis) {
  const sel = selEls().filter(e => !e.locked); if (sel.length < 3) return;
  const pos = axis === 'h' ? 'x' : 'y', size = axis === 'h' ? 'w' : 'h';
  sel.sort((a, b) => a[pos] - b[pos]);
  const first = sel[0], last = sel[sel.length - 1];
  const total = sel.reduce((s, e) => s + e[size], 0);
  const gap = (last[pos] + last[size] - first[pos] - total) / (sel.length - 1);
  let cur = first[pos];
  for (const e of sel) { e[pos] = round(cur); cur += e[size] + gap; }
  S.struct++; commit();
}

/* ---------- images ---------- */
function readFile(file, as) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); if (as === 'url') r.readAsDataURL(file); else r.readAsText(file); }); }
async function shrinkImage(file) {
  const LIMIT = 235000;
  const url = await readFile(file, 'url');
  if (file.type === 'image/svg+xml' && url.length < LIMIT) { const d = await imgDims(url); return { url, w: d.w || 200, h: d.h || 200 }; }
  const d = await imgDims(url);
  if (!d.w) throw new Error('This file is not an image the browser can open.');
  if (url.length < LIMIT && file.type !== 'image/svg+xml') return { url, w: d.w, h: d.h };
  let side = Math.min(1600, Math.max(d.w, d.h));
  for (let i = 0; i < 9; i++) {
    const k = side / Math.max(d.w, d.h), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(d.w * k)); c.height = Math.max(1, Math.round(d.h * k));
    c.getContext('2d').drawImage(d.img, 0, 0, c.width, c.height);
    for (const q of [0.86, 0.7]) {
      const out = c.toDataURL('image/webp', q);
      if (out.startsWith('data:image/webp') && out.length < LIMIT) return { url: out, w: d.w, h: d.h };
    }
    const png = c.toDataURL('image/png');
    if (png.length < LIMIT) return { url: png, w: d.w, h: d.h };
    side = Math.round(side * 0.72);
  }
  throw new Error('This image could not be made small enough to store.');
}
function imgDims(url) { return new Promise(res => { const img = new Image(); img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight, img }); img.onerror = () => res({ w: 0, h: 0 }); img.src = url; }); }
async function addImageFiles(files, at, replaceEl) {
  for (const file of files) {
    try {
      const r = await shrinkImage(file);
      const id = uid('img_');
      S.images.set(id, r.url); Store.dirtyImg(id);
      if (replaceEl) { replaceEl.img = id; S.struct++; commit(); return; }
      const k = Math.min(1, 360 / Math.max(r.w, r.h));
      addEl('image', null, { at, props: { img: id, w: Math.max(24, Math.round(r.w * k)), h: Math.max(24, Math.round(r.h * k)), name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Image' } });
    } catch (e) { toast(e.message || 'Could not add that image.'); }
  }
}
function pickImage(replaceEl) {
  const input = $('#pick-image');
  input.value = '';
  input.onchange = () => { if (input.files.length) addImageFiles([...input.files], null, replaceEl); };
  input.click();
}

/* ---------- inline text editing ---------- */
function editText(el) {
  const node = nodes.get(el.id); const t = node && node.querySelector('.txt');
  if (!t) return;
  node._editing = true;
  t.textContent = el.text || '';
  t.setAttribute('contenteditable', 'plaintext-only');
  if (t.contentEditable !== 'plaintext-only') t.setAttribute('contenteditable', 'true');
  t.focus();
  const range = document.createRange(); range.selectNodeContents(t);
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(range);
  const done = () => {
    t.removeEventListener('blur', done);
    node._editing = false; node._sig = null;
    el.text = t.innerText.replace(/\n$/, '');
    S.struct++; commit();
  };
  t.addEventListener('blur', done);
  t.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Escape') t.blur(); });
  t.addEventListener('paste', ev => { if (t.contentEditable === 'plaintext-only') return; ev.preventDefault(); document.execCommand('insertText', false, (ev.clipboardData || window.clipboardData).getData('text')); });
}

/* ---------- wiring ---------- */
function initCanvas() {
  vp = $('#viewport'); stage = $('#stage'); elsLayer = $('#els'); overlay = $('#overlay');
  vp.addEventListener('pointerdown', onDown);
  vp.addEventListener('pointermove', onMove);
  vp.addEventListener('pointerup', onUp);
  vp.addEventListener('pointercancel', onUp);
  vp.addEventListener('wheel', onWheel, { passive: false });
  vp.addEventListener('dblclick', e => {
    if (S.mode !== 'edit') return;
    const hit = document.elementsFromPoint(e.clientX, e.clientY).map(n => n.closest && n.closest('.el')).find(Boolean);
    const el = hit && elById(hit.dataset.id);
    if (!el || el.locked) return;
    if (el.type === 'text') editText(el);
    else if (el.type === 'image') pickImage(el);
    else if (el.type === 'shape') focusFx(filled(el.amount) ? 'amount' : 'label');
    else if (fxFields(el).length) focusFx(fxFields(el)[0].key);
  });
  let dragDepth = 0, hint = null;
  const showHint = on => { if (on && !hint) { hint = h('div', { class: 'drop-hint' }, 'Drop images or CSV / JSON data here'); vp.append(hint); } else if (!on && hint) { hint.remove(); hint = null; } };
  vp.addEventListener('dragenter', e => { if (S.mode !== 'edit' || !e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return; e.preventDefault(); dragDepth++; showHint(true); });
  vp.addEventListener('dragover', e => { if (S.mode === 'edit' && e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  vp.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) showHint(false); });
  vp.addEventListener('drop', e => {
    dragDepth = 0; showHint(false);
    if (S.mode !== 'edit' || !e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    const files = [...e.dataTransfer.files], at = toCanvas(e.clientX, e.clientY);
    const imgs = files.filter(f => f.type.startsWith('image/'));
    if (imgs.length) addImageFiles(imgs, at);
    files.filter(f => !f.type.startsWith('image/')).forEach(importDataFile);
  });
  document.addEventListener('paste', e => {
    if (S.mode !== 'edit' || (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]'))) return;
    const files = e.clipboardData ? [...e.clipboardData.files].filter(f => f.type.startsWith('image/')) : [];
    if (files.length) { e.preventDefault(); addImageFiles(files); }
    else if (S.clip && S.clip.page === S.pageId) { e.preventDefault(); pasteEls(S.clip.els); S.clip.els = clone(selEls()); }
    else if (S.clip) { e.preventDefault(); pasteEls(S.clip.els, 0); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && (closePops() || closeModal())) return;
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    if (typing || $('.modal')) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (S.mode !== 'edit') { if (e.key === 'Escape' && S.canWrite) setMode('edit'); return; }
    if (e.code === 'Space') { spaceDown = true; vp.classList.add('pan'); e.preventDefault(); return; }
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 'd') { e.preventDefault(); duplicateSel(); return; }
    if (mod && k === 'c') { const s = selEls(); if (s.length) S.clip = { page: S.pageId, els: clone(s) }; return; }
    if (mod && k === 'x') { const s = selEls(); if (s.length) { S.clip = { page: null, els: clone(s) }; removeSel(); } return; }
    if (mod && k === 'a') { e.preventDefault(); S.sel = new Set(els().filter(o => !o.locked && !o.hidden).map(o => o.id)); selectionChanged(); return; }
    if (mod) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); return; }
    if (e.key === 'Escape') { if (S.sel.size) { S.sel.clear(); selectionChanged(); } return; }
    if (e.key === ']') return reorder(e.shiftKey ? 'front' : 'up');
    if (e.key === '[') return reorder(e.shiftKey ? 'back' : 'down');
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (arrows && S.sel.size) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      for (const o of movingSet()) { o.x += arrows[0] * step; o.y += arrows[1] * step; }
      S.struct++; placeAll(); queueCommit();
    }
  });
  document.addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; vp.classList.remove('pan'); } });
  window.addEventListener('blur', () => { spaceDown = false; vp.classList.remove('pan'); });
  let lastW = 0;
  new ResizeObserver(() => { const w = vp.clientWidth; if (S.mode === 'view' && Math.abs(w - lastW) > 40) fitView(); lastW = w; }).observe(vp);
}
