module.exports = (opts) => `
(() => {
  const KEY = '__mockdb';
  const load = () => JSON.parse(localStorage.getItem(KEY) || '{}');
  const save = d => localStorage.setItem(KEY, JSON.stringify(d));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const freeze = o => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
  window.__writes = [];
  const snap = (id, v) => ({ id, exists: v !== undefined, data: () => (v === undefined ? undefined : freeze(JSON.parse(JSON.stringify(v)))), metadata: { fromCache: false, hasPendingWrites: false } });
  const check = p => { const n = p.split('/'); if (n.some(s => !/^[A-Za-z0-9_\\-.~:@+]{1,200}$/.test(s))) throw new TypeError('bad path ' + p); return n; };
  const doc = path => { if (check(path).length % 2) throw new TypeError('doc path needs even segments: ' + path); return {
    id: path.split('/').pop(), path,
    get: async () => { await wait(15); return snap(path.split('/').pop(), load()[path]); },
    set: async data => { await wait(15); if (${opts.readonly ? 'true' : 'false'}) throw { code: 'invalid_argument', message: 'denied' }; if (!data || typeof data !== 'object' || Array.isArray(data)) throw { code: 'invalid_argument', message: 'body' }; const bytes = new TextEncoder().encode(JSON.stringify(data)).length; if (bytes > 262144) throw { code: 'invalid_argument', message: 'too large ' + bytes }; const d = load(); d[path] = JSON.parse(JSON.stringify(data)); save(d); window.__writes.push(['set', path, bytes]); },
    delete: async () => { await wait(10); const d = load(); delete d[path]; save(d); window.__writes.push(['delete', path]); },
    collection: sub => collection(path + '/' + sub),
  }; };
  const collection = path => { if (check(path).length % 2 === 0) throw new TypeError('collection path needs odd segments: ' + path); return {
    path, doc: id => doc(path + '/' + id),
    get: async () => { await wait(15); const d = load(); const depth = path.split('/').length + 1; const docs = Object.keys(d).filter(k => k.startsWith(path + '/') && k.split('/').length === depth).sort().map(k => snap(k.split('/').pop(), d[k])); return { docs, size: docs.length, empty: !docs.length }; },
  }; };
  const caps = {
    db: Object.freeze({ doc, collection }),
    user: Object.freeze({ can: async n => ${opts.readonly ? 'false' : 'true'}, isOwner: async () => true, canEdit: async () => true }),
    downloads: Object.freeze({ save: async r => { window.__saved = { filename: r.filename, len: r.data.length }; return { status: 'saved' }; } }),
  };
  window.claude = { use: async name => { await wait(${opts.delay || 60}); return caps[name] || null; } };
})();`;
