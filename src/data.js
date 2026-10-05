/* Data: sample dataset, CSV/JSON parsing, type inference, row encoding, value formatting. */
const Data = (() => {
  const { parseDate, isoLocal } = Formula;

  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- sample: a made-up outdoor retailer, dated relative to today ---------- */
  function sampleOrders() {
    const r = rng(20261005);
    const today = Formula.trunc('day', new Date());
    const weighted = list => { const tot = list.reduce((s, i) => s + i[1], 0); let x = r() * tot; for (const i of list) { x -= i[1]; if (x <= 0) return i[0]; } return list[0][0]; };
    const regions = [['West', 1.25], ['Northeast', 1.05], ['South', 0.9], ['Midwest', 0.8]];
    const channels = [['Online', 0.52], ['Retail', 0.33], ['Wholesale', 0.15]];
    const segments = [['Consumer', 0.62], ['Small business', 0.25], ['Enterprise', 0.13]];
    const products = [
      ['Trail tent 2P', 'Camping', 289, 0.42, 1], ['Down sleeping bag', 'Camping', 199, 0.45, 1.1], ['Camp stove', 'Camping', 79, 0.5, 1.3],
      ['Ridge shell jacket', 'Apparel', 229, 0.55, 1.2], ['Merino base layer', 'Apparel', 85, 0.6, 1.6], ['Trek pants', 'Apparel', 110, 0.58, 1.2],
      ['Summit hiking boot', 'Footwear', 189, 0.48, 1.4], ['Trail runner', 'Footwear', 139, 0.5, 1.5],
      ['Daypack 24L', 'Packs', 99, 0.52, 1.3], ['Expedition pack 65L', 'Packs', 279, 0.46, 0.7],
      ['Headlamp', 'Accessories', 45, 0.62, 1.5], ['Water filter', 'Accessories', 39, 0.6, 1.2], ['Trekking poles', 'Accessories', 89, 0.55, 1],
    ];
    const prodW = products.map((p, i) => [i, p[4]]);
    const rows = []; let id = 10000;
    const span = 545;
    for (let i = span; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const doy = Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 86400000);
      const growth = 1 + ((span - i) / span) * 0.45;
      const season = 1 + 0.22 * Math.sin((2 * Math.PI * (doy - 100)) / 365) + (d.getMonth() >= 10 ? 0.28 : 0);
      const wk = d.getDay() === 0 || d.getDay() === 6 ? 0.8 : 1;
      const n = Math.max(1, Math.round(4.2 * growth * season * wk + (r() - 0.5) * 3));
      for (let k = 0; k < n; k++) {
        const p = products[weighted(prodW)];
        const channel = weighted(channels);
        const wholesale = channel === 'Wholesale';
        const units = wholesale ? 6 + Math.floor(r() * 30) : 1 + Math.floor(r() * r() * 4);
        const discount = wholesale ? 0.25 : [0, 0, 0, 0.05, 0.1, 0.15, 0.2][Math.floor(r() * 7)];
        const revenue = Math.round(units * p[2] * (1 - discount) * 100) / 100;
        const cost = Math.round(units * p[2] * (1 - p[3]) * (0.95 + r() * 0.1) * 100) / 100;
        rows.push({
          'Order ID': 'KO-' + (id++),
          'Order Date': d,
          Region: weighted(regions),
          Channel: channel,
          Segment: wholesale ? weighted(segments.slice(1)) : weighted(segments),
          Category: p[1],
          Product: p[0],
          Units: units,
          Revenue: revenue,
          Cost: cost,
          Discount: discount,
          'Customer ID': 'C' + (1000 + Math.floor(Math.pow(r(), 1.6) * 900)),
          Returned: r() < (p[1] === 'Footwear' ? 0.09 : 0.04),
        });
      }
    }
    return {
      id: 'ds_sample', name: 'Orders (sample)', sample: 'orders', rows,
      columns: [
        { name: 'Order ID', type: 'text' }, { name: 'Order Date', type: 'date' }, { name: 'Region', type: 'text' },
        { name: 'Channel', type: 'text' }, { name: 'Segment', type: 'text' }, { name: 'Category', type: 'text' },
        { name: 'Product', type: 'text' }, { name: 'Units', type: 'number' }, { name: 'Revenue', type: 'number' },
        { name: 'Cost', type: 'number' }, { name: 'Discount', type: 'number' }, { name: 'Customer ID', type: 'text' },
        { name: 'Returned', type: 'boolean' },
      ],
    };
  }

  /* ---------- delimited text ---------- */
  function parseDelimited(text) {
    text = text.replace(/^﻿/, '');
    const head = text.slice(0, 4000).split(/\r?\n/)[0] || '';
    let delim = ',', best = -1;
    for (const d of [',', '\t', ';', '|']) { const c = head.split(d).length - 1; if (c > best) { best = c; delim = d; } }
    const out = []; let row = [], field = '', q = false, i = 0; const n = text.length;
    while (i < n) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
        field += c; i++; continue;
      }
      if (c === '"' && field === '') { q = true; i++; continue; }
      if (c === delim) { row.push(field); field = ''; i++; continue; }
      if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') out.push(row);
        row = []; i++; continue;
      }
      field += c; i++;
    }
    if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') out.push(row); }
    return out;
  }

  const NULLS = new Set(['', 'null', 'na', 'n/a', 'nan', '-', '#n/a', 'none']);
  const isNull = v => v == null || (typeof v === 'string' && NULLS.has(v.trim().toLowerCase()));
  const NUM_RE = /^[-+]?\(?[$€£]?\s?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?([eE][-+]?\d+)?\)?%?$/;
  function toNumber(v) {
    if (typeof v === 'number') return isNaN(v) ? null : v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v instanceof Date) return +v;
    if (isNull(v)) return null;
    let s = String(v).trim();
    if (!NUM_RE.test(s) || !/\d/.test(s)) return null;
    const neg = /^\(.*\)$/.test(s), pct = /%$/.test(s);
    s = s.replace(/[()$€£,%\s]/g, '');
    let x = Number(s); if (isNaN(x)) return null;
    if (neg) x = -x; if (pct) x /= 100;
    return x;
  }
  const BOOL = { true: true, false: false, yes: true, no: false, y: true, n: false, t: true, f: false };
  function toBool(v) {
    if (typeof v === 'boolean') return v;
    if (isNull(v)) return null;
    if (typeof v === 'number') return v !== 0;
    const k = String(v).trim().toLowerCase();
    return k in BOOL ? BOOL[k] : null;
  }
  function toDateStrict(v) {
    if (v instanceof Date) return v;
    if (isNull(v) || typeof v === 'number' || typeof v === 'boolean') return null;
    const s = String(v).trim();
    if (!/[-/]|[a-zA-Z]{3}/.test(s) || /^[-+]?\d+(\.\d+)?$/.test(s)) return null;
    return parseDate(s);
  }
  function coerce(v, type) {
    if (isNull(v)) return null;
    switch (type) {
      case 'number': return toNumber(v);
      case 'date': return v instanceof Date ? v : typeof v === 'number' ? new Date(v) : toDateStrict(v);
      case 'boolean': return toBool(v);
      default: return v instanceof Date ? isoLocal(v, true) : typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
  }
  function inferType(values) {
    let n = 0, num = 0, date = 0, bool = 0;
    for (const v of values) {
      if (isNull(v)) continue; n++;
      if (typeof v === 'number') { num++; continue; }
      if (typeof v === 'boolean') { bool++; continue; }
      if (v instanceof Date) { date++; continue; }
      if (toNumber(v) != null) num++;
      else if (toBool(v) != null) bool++;
      else if (toDateStrict(v)) date++;
      if (n > 4000) break;
    }
    if (!n) return 'text';
    if (num === n) return 'number';
    if (date === n) return 'date';
    if (bool === n) return 'boolean';
    return 'text';
  }
  function uniqueNames(names) {
    const seen = new Map();
    return names.map((raw, i) => {
      let nm = String(raw == null ? '' : raw).replace(/[\[\]]/g, '').trim() || `Column ${i + 1}`;
      const base = nm; let k = 2;
      while (seen.has(nm.toLowerCase())) nm = `${base} ${k++}`;
      seen.set(nm.toLowerCase(), 1);
      return nm;
    });
  }
  function fromTable(name, table) {
    if (!table.length) throw new Error('No rows found.');
    const width = Math.max(...table.slice(0, 200).map(r => r.length));
    const names = uniqueNames(Array.from({ length: width }, (_, i) => table[0][i]));
    const body = table.slice(1);
    if (!body.length) throw new Error('Found a header row but no data rows under it.');
    const columns = names.map((nm, i) => ({ name: nm, type: inferType(body.map(r => r[i])) }));
    const rows = body.map(r => { const o = {}; columns.forEach((c, i) => { o[c.name] = coerce(r[i], c.type); }); return o; });
    return { name, columns, rows };
  }
  function fromObjects(name, list) {
    if (!list.length) throw new Error('No records found.');
    if (Array.isArray(list[0])) return fromTable(name, list.map(r => r.map(v => (v == null ? '' : v))));
    const keys = []; const seen = new Set();
    for (const o of list.slice(0, 500)) if (o && typeof o === 'object') for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); keys.push(k); }
    if (!keys.length) throw new Error('Expected a list of records with named fields.');
    const names = uniqueNames(keys);
    const columns = names.map((nm, i) => ({ name: nm, type: inferType(list.map(o => (o ? o[keys[i]] : null))) }));
    const rows = list.map(o => { const r = {}; columns.forEach((c, i) => { r[c.name] = coerce(o ? o[keys[i]] : null, c.type); }); return r; });
    return { name, columns, rows };
  }
  function parseAny(name, text) {
    const t = text.trim();
    if (!t) throw new Error('Nothing to import yet.');
    if (t[0] === '[' || t[0] === '{') {
      let j;
      try { j = JSON.parse(t); } catch (e) { j = undefined; }
      if (j !== undefined) {
        let list = Array.isArray(j) ? j : null;
        if (!list && j && typeof j === 'object') {
          for (const k of ['data', 'rows', 'records', 'results', 'items']) if (Array.isArray(j[k])) { list = j[k]; break; }
          if (!list) { const k = Object.keys(j).find(x => Array.isArray(j[x])); if (k) list = j[k]; }
        }
        if (!list) throw new Error('This JSON has no list of records. Expected [ {…}, {…} ].');
        return fromObjects(name, list);
      }
    }
    return fromTable(name, parseDelimited(text));
  }

  /* ---------- storage encoding (dates as local ISO text) ---------- */
  const baseCols = ds => ds.columns.filter(c => !c.formula);
  function encodeRow(cols, row) {
    return cols.map(c => { const v = row[c.name]; return v instanceof Date ? isoLocal(v) : v === undefined ? null : v; });
  }
  function decodeRows(columns, arrays) {
    const cols = columns.filter(c => !c.formula);
    return arrays.map(a => { const o = {}; cols.forEach((c, i) => { const v = a[i]; o[c.name] = c.type === 'date' && v != null ? parseDate(v) : v; }); return o; });
  }
  /* split rows into JSON strings under a byte budget */
  function chunkRows(ds, maxBytes = 190000) {
    const cols = baseCols(ds), enc = new TextEncoder();
    const chunks = []; let cur = [], size = 2;
    for (const row of ds.rows) {
      const s = JSON.stringify(encodeRow(cols, row));
      /* the chunk is stored as a string field, so count it the way it is embedded (quotes escaped) */
      const b = enc.encode(JSON.stringify(s)).length;
      if (size + b > maxBytes && cur.length) { chunks.push('[' + cur.join(',') + ']'); cur = []; size = 2; }
      cur.push(s); size += b;
    }
    if (cur.length) chunks.push('[' + cur.join(',') + ']');
    return chunks;
  }

  /* ---------- formatting ---------- */
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(d, style) {
    const hasTime = d.getHours() || d.getMinutes();
    const base = `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    if (style === 'iso') return isoLocal(d, true);
    if (style === 'short') return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
    if (style === 'monthYear') return `${MON[d.getMonth()]} ${d.getFullYear()}`;
    return hasTime ? `${base} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : base;
  }
  const nfCache = new Map();
  function nf(opts) {
    const k = JSON.stringify(opts); let f = nfCache.get(k);
    if (!f) { try { f = new Intl.NumberFormat(undefined, opts); } catch (e) { f = new Intl.NumberFormat(undefined, {}); } nfCache.set(k, f); }
    return f;
  }
  function fmtValue(v, f) {
    f = f || {};
    if (v == null || (typeof v === 'number' && isNaN(v))) return '–';
    if (v instanceof Date) return fmtDate(v, f.date);
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'string') return (f.prefix || '') + v + (f.suffix || '');
    const type = f.type || 'auto', d = f.decimals;
    const has = d != null && d !== '';
    const o = {};
    if (f.compact) { o.notation = 'compact'; o.maximumFractionDigits = has ? +d : 1; if (has) o.minimumFractionDigits = +d; }
    if (type === 'currency') {
      o.style = 'currency'; o.currency = f.currency || 'USD';
      if (!f.compact) { o.minimumFractionDigits = has ? +d : 0; o.maximumFractionDigits = has ? +d : 0; }
    } else if (type === 'percent') {
      o.style = 'percent';
      if (!f.compact) { o.minimumFractionDigits = has ? +d : 1; o.maximumFractionDigits = has ? +d : 1; }
    } else if (!f.compact) {
      if (has) { o.minimumFractionDigits = +d; o.maximumFractionDigits = +d; }
      else o.maximumFractionDigits = type === 'auto' && Math.abs(v) < 100 ? 2 : type === 'auto' ? 0 : 2;
    }
    return (f.prefix || '') + nf(o).format(v) + (f.suffix || '');
  }
  function bucketLabel(d, bucket) {
    if (!(d instanceof Date)) return String(d);
    switch (bucket) {
      case 'year': return String(d.getFullYear());
      case 'quarter': return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
      case 'month': return `${MON[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
      default: return `${MON[d.getMonth()]} ${d.getDate()}`;
    }
  }

  return { sampleOrders, parseAny, parseDelimited, inferType, coerce, baseCols, encodeRow, decodeRows, chunkRows, fmtValue, fmtDate, bucketLabel, uniqueNames };
})();
if (typeof module !== 'undefined') module.exports = Data;
