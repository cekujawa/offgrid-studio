/* ===== store: keeps the dashboard, its data sets and images.
   Uses the artifact database when the page runs inside Claude, this browser's storage otherwise. ===== */
const Store = (() => {
  let db = null, user = null, downloads = null, mode = 'pending';
  const dirty = { board: false, ds: new Map(), dsDel: new Set(), img: new Set() };
  let timer = null, busy = false, firstDirty = 0, standalone = false;
  const savedImgs = new Set(), savedChunks = new Map(), tooBig = new Set();
  const LS = 'offgrid.studio.v1', FLAG = 'offgrid.studio.cloud', MAX_CHUNKS = 60;
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function retry(fn) {
    try { return await fn(); }
    catch (e) { if (e && e.code === 'unavailable') { await wait(400 + Math.random() * 500); return fn(); } throw e; }
  }
  const chunkPath = (id, i) => `datasets/${id}/chunks/c${String(i).padStart(4, '0')}`;
  function status(state, msg, tip) { S.save = { state, msg, tip }; renderStatus(); }
  function usedImages(board) {
    const s = new Set();
    for (const p of (board || S.board).pages) for (const e of p.els || []) if (e.type === 'image' && e.img) s.add(e.img);
    return s;
  }
  const colMeta = ds => ds.columns.map(c => (c.formula ? { name: c.name, type: c.type, formula: c.formula } : { name: c.name, type: c.type }));

  function bundle() {
    const used = usedImages();
    return {
      app: 'offgrid-studio', v: 1, board: clone(S.board),
      datasets: [...S.datasets.values()].map(ds => ({ id: ds.id, name: ds.name, sample: ds.sample || null, columns: colMeta(ds), rows: ds.sample ? null : ds.rows.map(r => Data.encodeRow(Data.baseCols(ds), r)) })),
      images: Object.fromEntries([...S.images].filter(([id]) => used.has(id))),
    };
  }
  function reviveDs(d) {
    if (d.sample) {
      const ds = Data.sampleOrders();
      ds.id = d.id; ds.name = d.name || ds.name;
      for (const c of d.columns || []) if (c.formula && !ds.columns.some(x => x.name === c.name)) ds.columns.push({ name: c.name, type: c.type, formula: c.formula });
      return ds;
    }
    return { id: d.id, name: d.name || 'Data', columns: d.columns || [], rows: Data.decodeRows(d.columns || [], d.rows || []) };
  }
  function unbundle(j) {
    if (!j || !j.board || !Array.isArray(j.board.pages) || !j.board.pages.length) throw new Error('Not a dashboard file');
    return { board: j.board, datasets: (j.datasets || []).map(reviveDs), images: j.images || {} };
  }

  /* ---------- load ---------- */
  async function init() {
    if (!(window.claude && typeof window.claude.use === 'function')) { mode = 'local'; standalone = true; S.canExport = true; return loadLocal(); }
    try { [db, user, downloads] = await Promise.all([window.claude.use('db'), window.claude.use('user'), window.claude.use('downloads')]); }
    catch (e) { db = null; }
    S.canExport = !!downloads;
    if (!db) { mode = 'local'; return loadLocal(); }
    mode = 'db';
    try { if (user && (await user.can('data.write')) === false) S.canWrite = false; } catch (e) { /* unknown: a refused write decides */ }
    return loadDb();
  }
  function loadLocal() {
    const raw = lsGet(LS);
    if (!raw) return null;
    try { return unbundle(JSON.parse(raw)); } catch (e) { return null; }
  }
  async function loadDb() {
    const snap = await retry(() => db.doc('boards/main').get());
    if (!snap.exists) { lsSet(FLAG, '0'); return null; }
    lsSet(FLAG, '1');
    const body = clone(snap.data());
    if (!body.board || !Array.isArray(body.board.pages) || !body.board.pages.length) return null;
    const metas = await retry(() => db.collection('datasets').get());
    const datasets = [];
    for (const d of metas.docs) {
      const m = clone(d.data()); m.id = d.id;
      savedChunks.set(d.id, m.chunks || 0);
      if (m.sample) { datasets.push(reviveDs(m)); continue; }
      const arrays = [], n = m.chunks || 0;
      for (let i = 0; i < n; i += 4) {
        const part = await Promise.all([0, 1, 2, 3].filter(k => i + k < n).map(k => retry(() => db.doc(chunkPath(d.id, i + k)).get())));
        for (const p of part) if (p.exists) for (const r of JSON.parse(p.data().data)) arrays.push(r);
      }
      datasets.push({ id: d.id, name: m.name || 'Data', columns: m.columns || [], rows: Data.decodeRows(m.columns || [], arrays) });
    }
    const order = body.dataOrder || [];
    const rank = id => { const i = order.indexOf(id); return i < 0 ? order.length : i; };
    datasets.sort((a, b) => rank(a.id) - rank(b.id));
    const images = {}, used = usedImages(body.board);
    await Promise.all([...used].map(async id => {
      try { const s = await retry(() => db.doc('images/' + id).get()); if (s.exists) { images[id] = s.data().data; savedImgs.add(id); } } catch (e) { /* shows as a missing image */ }
    }));
    if (S.canWrite) for (const id of body.imgs || []) if (!used.has(id)) db.doc('images/' + id).delete().catch(() => {});
    return { board: body.board, datasets, images };
  }

  /* ---------- save ---------- */
  function announce() {
    if (!S.canWrite) return status('idle', 'View only', 'You can explore this dashboard. Changes you make here are not saved.');
    if (mode === 'local') return status('idle', 'Kept in this browser', standalone ? 'Saved in this browser. Use "Save a copy as a file" from the menu for a backup.' : 'This view cannot reach the shared store, so the dashboard is kept in this browser only.');
    status('saved', 'Saved', 'Changes save automatically.');
  }
  function schedule() {
    if (!S.ready || !S.canWrite || mode === 'pending') return;
    status('saving', 'Saving…');
    clearTimeout(timer);
    /* wait for a pause in editing, but never hold changes back longer than a few seconds */
    if (!firstDirty) firstDirty = Date.now();
    timer = setTimeout(flush, Date.now() - firstDirty > 5000 ? 0 : 1200);
  }
  const dirtyBoard = () => { dirty.board = true; schedule(); };
  const dirtyDs = (id, rows) => { dirty.ds.set(id, !!rows || !!dirty.ds.get(id)); dirty.dsDel.delete(id); tooBig.delete(id); if (!savedChunks.has(id)) dirty.board = true; schedule(); };
  const removeDs = id => { dirty.ds.delete(id); dirty.dsDel.add(id); dirty.board = true; schedule(); };
  const dirtyImg = id => { dirty.img.add(id); schedule(); };
  const pending = () => dirty.board || dirty.ds.size || dirty.dsDel.size || dirty.img.size;

  async function saveDs(ds, withRows) {
    let n = savedChunks.get(ds.id);
    if (!ds.sample && (withRows || n == null)) {
      const chunks = Data.chunkRows(ds);
      if (chunks.length > MAX_CHUNKS) {
        tooBig.add(ds.id);
        throw { code: 'too_big', message: `“${ds.name}” is too large to save (about ${Math.round(chunks.length * 0.19)} MB, limit ${Math.round(MAX_CHUNKS * 0.19)} MB). It stays for this session only.` };
      }
      for (let i = 0; i < chunks.length; i++) await retry(() => db.doc(chunkPath(ds.id, i)).set({ data: chunks[i] }));
      for (let i = chunks.length; i < (n || 0); i++) await db.doc(chunkPath(ds.id, i)).delete();
      n = chunks.length;
    }
    const meta = { name: ds.name, sample: ds.sample || null, rowCount: ds.rows.length, columns: colMeta(ds), chunks: ds.sample ? 0 : n || 0 };
    await retry(() => db.doc('datasets/' + ds.id).set(meta));
    savedChunks.set(ds.id, meta.chunks);
  }
  async function flushDb() {
    /* a saved board must never point at data or images that were not stored */
    for (const ds of S.datasets.values()) if (!savedChunks.has(ds.id) && !dirty.ds.has(ds.id) && !tooBig.has(ds.id)) dirty.ds.set(ds.id, true);
    for (const id of usedImages()) if (!savedImgs.has(id) && S.images.has(id)) dirty.img.add(id);
    for (const id of [...dirty.img]) {
      dirty.img.delete(id);
      const data = S.images.get(id);
      if (!data) continue;
      try { await retry(() => db.doc('images/' + id).set({ data })); savedImgs.add(id); } catch (e) { dirty.img.add(id); throw e; }
    }
    for (const [id, rows] of [...dirty.ds]) {
      dirty.ds.delete(id);
      const ds = S.datasets.get(id);
      if (!ds) continue;
      try { await saveDs(ds, rows); } catch (e) { if (e.code !== 'too_big') dirty.ds.set(id, rows); throw e; }
    }
    for (const id of [...dirty.dsDel]) {
      dirty.dsDel.delete(id);
      try {
        const n = savedChunks.get(id) || 0;
        for (let i = 0; i < n; i++) await db.doc(chunkPath(id, i)).delete();
        await db.doc('datasets/' + id).delete();
        savedChunks.delete(id);
      } catch (e) { dirty.dsDel.add(id); throw e; }
    }
    if (dirty.board) {
      dirty.board = false;
      const body = { board: clone(S.board), imgs: [...savedImgs], dataOrder: [...S.datasets.keys()], savedAt: new Date().toISOString() };
      if (new TextEncoder().encode(JSON.stringify(body)).length > 250000) throw { code: 'too_big', message: 'This dashboard has too many elements to save in one piece. Split it across fewer pages or remove some elements.' };
      try { await retry(() => db.doc('boards/main').set(body)); lsSet(FLAG, '1'); } catch (e) { dirty.board = true; throw e; }
    }
  }
  function flushLocal() {
    dirty.board = false; dirty.ds.clear(); dirty.dsDel.clear(); dirty.img.clear();
    if (!lsSet(LS, JSON.stringify(bundle()))) throw { code: 'too_big', message: 'Too large to keep in this browser. Open it inside Claude to save it.' };
  }
  async function flush() {
    clearTimeout(timer); timer = null;
    if (busy) { timer = setTimeout(flush, 600); return; }
    busy = true; firstDirty = 0;
    let failed = null;
    try { if (mode === 'db') await flushDb(); else if (mode === 'local') flushLocal(); }
    catch (e) { failed = e || {}; }
    busy = false;
    if (failed) {
      const c = failed.code;
      const msg = c === 'too_big' ? failed.message
        : c === 'quota_exceeded' ? 'Storage for this dashboard is full. Remove a data set or some images.'
        : c === 'invalid_argument' || c === 'revoked' || c === 'not_granted' ? 'Changes are not being saved. You may only have view access.'
        : 'Could not save just now. It will try again after your next change.';
      status('error', 'Not saved', msg);
      toast(msg, 7000);
      if (c === 'too_big' && pending()) timer = setTimeout(flush, 800);
      return;
    }
    if (pending()) { timer = setTimeout(flush, 800); return; }
    if (mode === 'local') status('saved', 'Kept in this browser', 'This view cannot reach the shared store, so the dashboard is kept in this browser only.');
    else status('saved', 'Saved', 'Changes save automatically.');
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && timer && !busy) flush(); });

  async function saveFile(filename, data) {
    if (downloads) return downloads.save({ filename, data });
    if (!standalone) throw { code: 'unavailable' };
    /* opened as a plain web page (not inside Claude): an ordinary browser download */
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = h('a', { href: url, download: filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { status: 'saved' };
  }
  return { init, announce, bundle, unbundle, dirtyBoard, dirtyDs, removeDs, dirtyImg, saveFile, expectCloud: () => lsGet(FLAG) === '1' };
})();
