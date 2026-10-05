/* Formula engine: Sigma-style expressions over a row set.
   [Column] refs, @Parameters, aggregates (Sum, CountIf ...) and scalar functions. */
const Formula = (() => {
  class FormulaError extends Error {
    constructor(msg, pos) { super(msg); this.name = 'FormulaError'; this.pos = pos; }
  }
  const isDate = v => v instanceof Date;

  /* ---------- value helpers ---------- */
  function N(v) {
    if (v == null) return null;
    if (typeof v === 'number') return isNaN(v) ? null : v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (isDate(v)) return +v;
    if (typeof v === 'string') {
      const s = v.trim();
      if (s === '') return null;
      const x = Number(s.replace(/[$,]/g, ''));
      return isNaN(x) ? null : x;
    }
    return null;
  }
  function T(v) {
    if (v == null) return '';
    if (isDate(v)) return isoLocal(v, true);
    if (typeof v === 'number') return String(+v.toFixed(10));
    return String(v);
  }
  function truthy(v) {
    if (v == null) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0 && !isNaN(v);
    if (typeof v === 'string') return v !== '' && v.toLowerCase() !== 'false';
    return true;
  }
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  function isoLocal(d, short) {
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const hasTime = d.getHours() || d.getMinutes() || d.getSeconds();
    if (short && !hasTime) return day;
    return `${day}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function parseDate(s) {
    if (s == null) return null;
    if (isDate(s)) return s;
    if (typeof s === 'number') return new Date(s);
    s = String(s).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
    if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[1] - 1, +m[2]); }
    m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    if (!/[a-zA-Z]{3}|\d{4}-\d{2}/.test(s)) return null;
    const t = Date.parse(s);
    return isNaN(t) ? null : new Date(t);
  }
  const toDate = parseDate;

  function cmp(a, b) {
    if (a == null || b == null) return null;
    if (isDate(a) || isDate(b)) {
      const x = toDate(a), y = toDate(b);
      if (!x || !y) return null;
      return +x < +y ? -1 : +x > +y ? 1 : 0;
    }
    if (typeof a === 'number' || typeof b === 'number') {
      const x = N(a), y = N(b);
      if (x == null || y == null) return null;
      return x < y ? -1 : x > y ? 1 : 0;
    }
    if (typeof a === 'boolean' || typeof b === 'boolean') {
      const x = truthy(a), y = truthy(b);
      return x === y ? 0 : x ? 1 : -1;
    }
    const x = String(a), y = String(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  function eq(a, b) {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return cmp(a, b) === 0;
  }

  /* ---------- dates ---------- */
  const UNITS = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second'];
  function unitOf(u) {
    const s = String(u || '').toLowerCase().replace(/s$/, '');
    if (!UNITS.includes(s)) throw new FormulaError(`"${u}" is not a date unit. Use year, quarter, month, week, day or hour.`);
    return s;
  }
  function trunc(unit, d) {
    d = toDate(d); if (!d) return null;
    const y = d.getFullYear(), m = d.getMonth(), dd = d.getDate();
    switch (unitOf(unit)) {
      case 'year': return new Date(y, 0, 1);
      case 'quarter': return new Date(y, Math.floor(m / 3) * 3, 1);
      case 'month': return new Date(y, m, 1);
      case 'week': { const wd = (d.getDay() + 6) % 7; return new Date(y, m, dd - wd); }
      case 'day': return new Date(y, m, dd);
      case 'hour': return new Date(y, m, dd, d.getHours());
      case 'minute': return new Date(y, m, dd, d.getHours(), d.getMinutes());
      default: return new Date(y, m, dd, d.getHours(), d.getMinutes(), d.getSeconds());
    }
  }
  function addMonths(d, n) {
    const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  function dateAdd(unit, n, d) {
    d = toDate(d); n = N(n); if (!d || n == null) return null;
    const r = new Date(d);
    switch (unitOf(unit)) {
      case 'year': addMonths(r, n * 12); break;
      case 'quarter': addMonths(r, n * 3); break;
      case 'month': addMonths(r, n); break;
      case 'week': r.setDate(r.getDate() + n * 7); break;
      case 'day': r.setDate(r.getDate() + n); break;
      case 'hour': r.setHours(r.getHours() + n); break;
      case 'minute': r.setMinutes(r.getMinutes() + n); break;
      default: r.setSeconds(r.getSeconds() + n);
    }
    return r;
  }
  function dateDiff(unit, a, b) {
    a = toDate(a); b = toDate(b); if (!a || !b) return null;
    const u = unitOf(unit);
    const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    const dayMs = 86400000;
    const days = Math.round((trunc('day', b) - trunc('day', a)) / dayMs);
    switch (u) {
      case 'year': return b.getFullYear() - a.getFullYear();
      case 'quarter': return Math.trunc(months / 3);
      case 'month': return months;
      case 'week': return Math.trunc(days / 7);
      case 'day': return days;
      case 'hour': return Math.trunc((b - a) / 3600000);
      case 'minute': return Math.trunc((b - a) / 60000);
      default: return Math.trunc((b - a) / 1000);
    }
  }
  function datePart(unit, d) {
    d = toDate(d); if (!d) return null;
    switch (unitOf(unit)) {
      case 'year': return d.getFullYear();
      case 'quarter': return Math.floor(d.getMonth() / 3) + 1;
      case 'month': return d.getMonth() + 1;
      case 'week': { const s = new Date(d.getFullYear(), 0, 1); return Math.ceil(((trunc('day', d) - s) / 86400000 + s.getDay() + 1) / 7); }
      case 'day': return d.getDate();
      case 'hour': return d.getHours();
      case 'minute': return d.getMinutes();
      default: return d.getSeconds();
    }
  }
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* ---------- lexer (tolerant: never throws, used for highlighting too) ---------- */
  function lex(src) {
    const out = []; let i = 0; const n = src.length;
    const push = (t, v, s, e, extra) => out.push(Object.assign({ t, v, s, e }, extra));
    while (i < n) {
      const c = src[i], s = i;
      if (/\s/.test(c)) { while (i < n && /\s/.test(src[i])) i++; push('ws', src.slice(s, i), s, i); continue; }
      if (c === '[') {
        const j = src.indexOf(']', i);
        if (j < 0) { push('ref', src.slice(i + 1).trim(), s, n, { open: true }); i = n; continue; }
        push('ref', src.slice(i + 1, j).trim(), s, j + 1); i = j + 1; continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1, v = '';
        while (j < n && src[j] !== c) { if (src[j] === '\\' && j + 1 < n) { v += src[j + 1]; j += 2; } else v += src[j++]; }
        if (j >= n) { push('str', v, s, n, { open: true }); i = n; continue; }
        push('str', v, s, j + 1); i = j + 1; continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
        let v = parseFloat(m[0]); i += m[0].length;
        if (src[i] === '%') { v = v / 100; i++; }
        push('num', v, s, i); continue;
      }
      if (c === '@') {
        if (src[i + 1] === '[') {
          const j = src.indexOf(']', i);
          if (j < 0) { push('param', src.slice(i + 2).trim(), s, n, { open: true }); i = n; continue; }
          push('param', src.slice(i + 2, j).trim(), s, j + 1); i = j + 1; continue;
        }
        const m = /^@([A-Za-z_][\w]*)?/.exec(src.slice(i));
        push('param', m[1] || '', s, i + m[0].length); i += m[0].length; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        const m = /^[A-Za-z_][\w]*/.exec(src.slice(i));
        push('id', m[0], s, i + m[0].length); i += m[0].length; continue;
      }
      const two = src.substr(i, 2);
      if (['<=', '>=', '<>', '!=', '==', '&&', '||'].includes(two)) { push('op', two, s, i + 2); i += 2; continue; }
      if ('+-*/^=<>&!'.includes(c)) { push('op', c, s, i + 1); i++; continue; }
      if (c === '(') { push('lp', c, s, i + 1); i++; continue; }
      if (c === ')') { push('rp', c, s, i + 1); i++; continue; }
      if (c === ',') { push('comma', c, s, i + 1); i++; continue; }
      push('err', c, s, i + 1); i++;
    }
    return out;
  }

  /* ---------- parser ---------- */
  const BIN = { or: 1, '||': 1, and: 2, '&&': 2, '=': 4, '==': 4, '!=': 4, '<>': 4, '<': 4, '<=': 4, '>': 4, '>=': 4, '&': 5, '+': 6, '-': 6, '*': 7, '/': 7, '^': 9 };
  function parse(src) {
    const toks = lex(src).filter(t => t.t !== 'ws');
    let p = 0;
    const fail = (msg, tok) => new FormulaError(msg, tok ? tok.s : src.length);
    const opOf = t => {
      if (!t) return null;
      if (t.t === 'op') return t.v;
      if (t.t === 'id') { const l = t.v.toLowerCase(); if (l === 'and' || l === 'or' || l === 'not') return l; }
      return null;
    };
    function primary() {
      const t = toks[p++];
      if (!t) throw fail('The formula ends too early');
      switch (t.t) {
        case 'num': return { k: 'lit', v: t.v };
        case 'str': if (t.open) throw fail('Missing closing quote', t); return { k: 'lit', v: t.v };
        case 'ref': if (t.open) throw fail('Missing ] to close the column name', t); if (!t.v) throw fail('Empty column name', t); return { k: 'ref', name: t.v, pos: t.s };
        case 'param': if (t.open) throw fail('Missing ] to close the parameter name', t); if (!t.v) throw fail('Type a parameter name after @', t); return { k: 'param', name: t.v, pos: t.s };
        case 'lp': { const e = expr(0); const c = toks[p++]; if (!c || c.t !== 'rp') throw fail('Missing closing parenthesis', c); return e; }
        case 'op':
          if (t.v === '-') return { k: 'un', op: '-', a: expr(8) };
          if (t.v === '+') return expr(8);
          if (t.v === '!') return { k: 'un', op: 'not', a: expr(3) };
          throw fail(`Unexpected "${t.v}"`, t);
        case 'id': {
          const l = t.v.toLowerCase();
          if (l === 'not') return { k: 'un', op: 'not', a: expr(3) };
          const nx = toks[p];
          if (nx && nx.t === 'lp') {
            p++;
            const args = [];
            if (toks[p] && toks[p].t === 'rp') { p++; return { k: 'call', name: t.v, args, pos: t.s }; }
            for (;;) {
              args.push(expr(0));
              const d = toks[p++];
              if (!d) throw fail(`Missing closing parenthesis for ${t.v}(`);
              if (d.t === 'rp') break;
              if (d.t !== 'comma') throw fail(`Expected a comma or ) in ${t.v}(…)`, d);
            }
            return { k: 'call', name: t.v, args, pos: t.s };
          }
          if (l === 'true') return { k: 'lit', v: true };
          if (l === 'false') return { k: 'lit', v: false };
          if (l === 'null') return { k: 'lit', v: null };
          throw fail(`"${t.v}" is not known. Put column names in [brackets] and add ( ) after functions.`, t);
        }
        case 'rp': throw fail('Unexpected )', t);
        case 'comma': throw fail('Unexpected comma', t);
        default: throw fail(`Unexpected character "${t.v}"`, t);
      }
    }
    function expr(min) {
      let left = primary();
      for (;;) {
        const t = toks[p], op = opOf(t);
        if (!op || !(op in BIN)) break;
        const prec = BIN[op];
        if (prec < min) break;
        p++;
        const right = expr(op === '^' ? prec : prec + 1);
        left = { k: 'bin', op, a: left, b: right };
      }
      return left;
    }
    if (!toks.length) throw fail('Type a formula');
    const ast = expr(0);
    if (p < toks.length) throw fail(`Unexpected "${toks[p].v}"`, toks[p]);
    return ast;
  }

  /* ---------- functions ---------- */
  const num1 = f => a => { const x = N(a); return x == null ? null : f(x); };
  const str1 = f => a => (a == null ? null : f(T(a)));
  const SCALAR = {
    abs: [1, 1, num1(Math.abs)],
    round: [1, 2, (a, d) => { const x = N(a); if (x == null) return null; const k = Math.pow(10, N(d) || 0); return Math.round((x + Number.EPSILON) * k) / k; }],
    floor: [1, 1, num1(Math.floor)],
    ceiling: [1, 1, num1(Math.ceil)],
    sqrt: [1, 1, num1(x => (x < 0 ? null : Math.sqrt(x)))],
    power: [2, 2, (a, b) => { const x = N(a), y = N(b); return x == null || y == null ? null : Math.pow(x, y); }],
    exp: [1, 1, num1(Math.exp)],
    ln: [1, 1, num1(x => (x <= 0 ? null : Math.log(x)))],
    log: [1, 2, (a, b) => { const x = N(a), y = b == null ? 10 : N(b); return x == null || x <= 0 ? null : Math.log(x) / Math.log(y); }],
    mod: [2, 2, (a, b) => { const x = N(a), y = N(b); return x == null || !y ? null : x % y; }],
    sign: [1, 1, num1(Math.sign)],
    greatest: [1, 99, (...a) => { const v = a.map(N).filter(x => x != null); return v.length ? Math.max(...v) : null; }],
    least: [1, 99, (...a) => { const v = a.map(N).filter(x => x != null); return v.length ? Math.min(...v) : null; }],
    isnull: [1, 1, a => a == null || a === ''],
    isnotnull: [1, 1, a => !(a == null || a === '')],
    number: [1, 1, a => N(a)],
    text: [1, 1, a => (a == null ? null : T(a))],
    concat: [1, 99, (...a) => a.map(T).join('')],
    upper: [1, 1, str1(s => s.toUpperCase())],
    lower: [1, 1, str1(s => s.toLowerCase())],
    trim: [1, 1, str1(s => s.trim())],
    len: [1, 1, str1(s => s.length)],
    left: [2, 2, (a, n) => (a == null ? null : T(a).slice(0, Math.max(0, N(n) || 0)))],
    right: [2, 2, (a, n) => { if (a == null) return null; const k = Math.max(0, N(n) || 0); return k ? T(a).slice(-k) : ''; }],
    mid: [3, 3, (a, s, n) => (a == null ? null : T(a).substr(Math.max(0, (N(s) || 1) - 1), Math.max(0, N(n) || 0)))],
    replace: [3, 3, (a, f, r) => (a == null ? null : T(a).split(T(f)).join(T(r)))],
    contains: [2, 2, (a, b) => (a == null ? false : T(a).toLowerCase().includes(T(b).toLowerCase()))],
    startswith: [2, 2, (a, b) => (a == null ? false : T(a).toLowerCase().startsWith(T(b).toLowerCase()))],
    endswith: [2, 2, (a, b) => (a == null ? false : T(a).toLowerCase().endsWith(T(b).toLowerCase()))],
    in: [2, 99, (a, ...list) => list.some(x => eq(a, x))],
    between: [3, 3, (a, lo, hi) => { const x = cmp(a, lo), y = cmp(a, hi); return x != null && y != null && x >= 0 && y <= 0; }],
    today: [0, 0, () => trunc('day', new Date())],
    now: [0, 0, () => new Date()],
    date: [1, 1, a => toDate(a)],
    makedate: [3, 3, (y, m, d) => { const a = N(y), b = N(m), c = N(d); return a == null || b == null || c == null ? null : new Date(a, b - 1, c); }],
    year: [1, 1, d => datePart('year', d)],
    quarter: [1, 1, d => datePart('quarter', d)],
    month: [1, 1, d => datePart('month', d)],
    day: [1, 1, d => datePart('day', d)],
    hour: [1, 1, d => datePart('hour', d)],
    weekday: [1, 1, d => { d = toDate(d); return d ? d.getDay() + 1 : null; }],
    monthname: [1, 1, d => { d = toDate(d); return d ? MONTHS[d.getMonth()] : null; }],
    weekdayname: [1, 1, d => { d = toDate(d); return d ? DAYS[d.getDay()] : null; }],
    datetrunc: [2, 2, (u, d) => trunc(u, d)],
    datepart: [2, 2, (u, d) => datePart(u, d)],
    dateadd: [3, 3, (u, n, d) => dateAdd(u, n, d)],
    datediff: [3, 3, (u, a, b) => dateDiff(u, a, b)],
  };
  /* lazy functions receive thunks */
  const LAZY = {
    if: [2, 99, (env, a) => {
      let i = 0;
      for (; i + 1 < a.length; i += 2) if (truthy(a[i](env))) return a[i + 1](env);
      return i < a.length ? a[i](env) : null;
    }],
    switch: [3, 99, (env, a) => {
      const v = a[0](env); let i = 1;
      for (; i + 1 < a.length; i += 2) if (eq(v, a[i](env))) return a[i + 1](env);
      return i < a.length ? a[i](env) : null;
    }],
    coalesce: [1, 99, (env, a) => { for (const f of a) { const v = f(env); if (v != null && v !== '') return v; } return null; }],
    zn: [1, 1, (env, a) => { const v = N(a[0](env)); return v == null ? 0 : v; }],
    ifnull: [2, 2, (env, a) => { const v = a[0](env); return v == null || v === '' ? a[1](env) : v; }],
    and: [1, 99, (env, a) => a.every(f => truthy(f(env)))],
    or: [1, 99, (env, a) => a.some(f => truthy(f(env)))],
    not: [1, 1, (env, a) => !truthy(a[0](env))],
  };
  /* aggregates: [minArgs, maxArgs, valueArgIndex|-1, condArgIndex|-1, reducer(values, extraArgValues)] */
  const nums = vals => { const o = []; for (const v of vals) { const x = N(v); if (x != null) o.push(x); } return o; };
  const sum = vals => { let s = 0; for (const v of vals) { const x = N(v); if (x != null) s += x; } return s; };
  const avg = vals => { const a = nums(vals); return a.length ? a.reduce((p, c) => p + c, 0) / a.length : null; };
  const ext = dir => vals => { let best = null; for (const v of vals) { if (v == null || v === '') continue; if (best == null || cmp(v, best) === dir) best = v; } return best; };
  function pct(vals, p) {
    const a = nums(vals).sort((x, y) => x - y); if (!a.length) return null;
    const k = (a.length - 1) * Math.min(1, Math.max(0, p)); const lo = Math.floor(k), hi = Math.ceil(k);
    return a[lo] + (a[hi] - a[lo]) * (k - lo);
  }
  function variance(vals) {
    const a = nums(vals); if (a.length < 2) return null;
    const m = a.reduce((p, c) => p + c, 0) / a.length;
    return a.reduce((p, c) => p + (c - m) * (c - m), 0) / (a.length - 1);
  }
  const distinct = vals => { const s = new Set(); for (const v of vals) if (v != null && v !== '') s.add(isDate(v) ? +v : v); return s.size; };
  const AGG = {
    sum: [1, 1, 0, -1, sum],
    avg: [1, 1, 0, -1, avg],
    min: [1, 1, 0, -1, ext(-1)],
    max: [1, 1, 0, -1, ext(1)],
    count: [0, 1, 0, -1, (vals, x, hasArg) => { if (!hasArg) return vals.length; let c = 0; for (const v of vals) if (v != null && v !== '') c++; return c; }],
    countdistinct: [1, 1, 0, -1, distinct],
    median: [1, 1, 0, -1, v => pct(v, 0.5)],
    percentile: [2, 2, 0, -1, (v, x) => pct(v, N(x[1]) == null ? 0.5 : N(x[1]))],
    stddev: [1, 1, 0, -1, v => { const r = variance(v); return r == null ? null : Math.sqrt(r); }],
    variance: [1, 1, 0, -1, variance],
    first: [1, 1, 0, -1, v => (v.length ? v[0] : null)],
    last: [1, 1, 0, -1, v => (v.length ? v[v.length - 1] : null)],
    countif: [1, 1, -1, 0, v => v.length],
    sumif: [2, 2, 0, 1, sum],
    avgif: [2, 2, 0, 1, avg],
    minif: [2, 2, 0, 1, ext(-1)],
    maxif: [2, 2, 0, 1, ext(1)],
    countdistinctif: [2, 2, 0, 1, distinct],
  };
  AGG.average = AGG.avg; AGG.mean = AGG.avg;

  /* ---------- compiler ---------- */
  function build(n, meta) {
    switch (n.k) {
      case 'lit': { const v = n.v; return () => v; }
      case 'ref': {
        const name = n.name; meta.refs.add(name);
        return env => {
          if (env.row) return env.row[name];
          if (env.keys && name in env.keys) return env.keys[name];
          throw new FormulaError(`[${name}] is a column of many rows. Wrap it in an aggregate, like Sum([${name}]).`, n.pos);
        };
      }
      case 'param': {
        const key = n.name.toLowerCase(); meta.params.add(n.name);
        return env => {
          if (!env.params || !(key in env.params)) throw new FormulaError(`No control provides @${n.name}. Add a slider control and name its parameter "${n.name}".`, n.pos);
          return env.params[key];
        };
      }
      case 'un': {
        const a = build(n.a, meta);
        if (n.op === '-') return env => { const x = N(a(env)); return x == null ? null : -x; };
        return env => !truthy(a(env));
      }
      case 'bin': {
        const a = build(n.a, meta), b = build(n.b, meta), op = n.op;
        switch (op) {
          case 'and': case '&&': return env => truthy(a(env)) && truthy(b(env));
          case 'or': case '||': return env => truthy(a(env)) || truthy(b(env));
          case '&': return env => T(a(env)) + T(b(env));
          case '=': case '==': return env => eq(a(env), b(env));
          case '!=': case '<>': return env => !eq(a(env), b(env));
          case '<': return env => { const c = cmp(a(env), b(env)); return c != null && c < 0; };
          case '<=': return env => { const c = cmp(a(env), b(env)); return c != null && c <= 0; };
          case '>': return env => { const c = cmp(a(env), b(env)); return c != null && c > 0; };
          case '>=': return env => { const c = cmp(a(env), b(env)); return c != null && c >= 0; };
          case '+': return env => {
            const u = a(env), v = b(env);
            if (isDate(u) && !isDate(v)) { const d = N(v); return d == null ? null : dateAdd('day', d, u); }
            const x = N(u), y = N(v); return x == null || y == null ? null : x + y;
          };
          case '-': return env => {
            const u = a(env), v = b(env);
            if (isDate(u) && isDate(v)) return dateDiff('day', v, u);
            if (isDate(u)) { const d = N(v); return d == null ? null : dateAdd('day', -d, u); }
            const x = N(u), y = N(v); return x == null || y == null ? null : x - y;
          };
          case '*': return env => { const x = N(a(env)), y = N(b(env)); return x == null || y == null ? null : x * y; };
          case '/': return env => { const x = N(a(env)), y = N(b(env)); return x == null || y == null || y === 0 ? null : x / y; };
          case '^': return env => { const x = N(a(env)), y = N(b(env)); return x == null || y == null ? null : Math.pow(x, y); };
        }
        throw new FormulaError(`Unknown operator ${op}`);
      }
      case 'call': {
        const key = n.name.toLowerCase();
        const arity = (def, label) => {
          if (n.args.length < def[0] || n.args.length > def[1]) {
            const want = def[0] === def[1] ? `${def[0]}` : def[1] >= 99 ? `at least ${def[0]}` : `${def[0]} to ${def[1]}`;
            throw new FormulaError(`${label} takes ${want} argument${want === '1' ? '' : 's'}, but got ${n.args.length}.`, n.pos);
          }
        };
        if (AGG[key]) {
          const def = AGG[key]; arity(def, n.name); meta.hasAgg = true;
          const args = n.args.map(x => build(x, meta));
          const vi = def[2], ci = def[3], reduce = def[4], id = {};
          return env => {
            const rows = env.rows || [];
            let byRows = env.cache && env.cache.get(id);
            if (env.cache && !byRows) { byRows = new Map(); env.cache.set(id, byRows); }
            if (byRows && byRows.has(rows)) return byRows.get(rows);
            const sub = { rows, row: null, keys: env.keys, params: env.params, cache: env.cache };
            const vals = [];
            const valF = vi >= 0 ? args[vi] : null, condF = ci >= 0 ? args[ci] : null;
            for (let i = 0; i < rows.length; i++) {
              sub.row = rows[i];
              if (condF && !truthy(condF(sub))) continue;
              vals.push(valF ? valF(sub) : true);
            }
            const extra = args.map((f, i) => (i === vi || i === ci ? null : f(env.row ? env : { ...env, row: rows[0] || {} })));
            const out = reduce(vals, extra, args.length > 0);
            if (byRows) byRows.set(rows, out);
            return out;
          };
        }
        if (LAZY[key]) {
          const def = LAZY[key]; arity(def, n.name);
          const args = n.args.map(x => build(x, meta)), f = def[2];
          return env => f(env, args);
        }
        if (SCALAR[key]) {
          const def = SCALAR[key]; arity(def, n.name);
          const args = n.args.map(x => build(x, meta)), f = def[2];
          if (args.length === 0) return () => f();
          if (args.length === 1) { const a0 = args[0]; return env => f(a0(env)); }
          if (args.length === 2) { const a0 = args[0], a1 = args[1]; return env => f(a0(env), a1(env)); }
          return env => f(...args.map(a => a(env)));
        }
        const names = DOCS.map(d => d.name);
        const near = names.find(x => x.toLowerCase().startsWith(key.slice(0, 3)));
        throw new FormulaError(`There is no function called ${n.name}.` + (near ? ` Did you mean ${near}?` : ''), n.pos);
      }
    }
    throw new FormulaError('Could not read this formula');
  }

  const compiled = new Map();
  function compile(src) {
    let c = compiled.get(src);
    if (c) { if (c.error) throw c.error; return c; }
    try {
      const meta = { refs: new Set(), params: new Set(), hasAgg: false };
      const run = build(parse(src), meta);
      c = { src, run, refs: [...meta.refs], params: [...meta.params], hasAgg: meta.hasAgg };
    } catch (e) {
      const error = e instanceof FormulaError ? e : new FormulaError(String(e.message || e));
      compiled.set(src, { error });
      throw error;
    }
    if (compiled.size > 2000) compiled.clear();
    compiled.set(src, c);
    return c;
  }
  function checkRefs(c, cols, dsName) {
    for (const r of c.refs) {
      if (!cols || !cols.has(r)) {
        let hint = '';
        if (cols) { const l = r.toLowerCase(); const m = [...cols].find(x => x.toLowerCase() === l) || [...cols].find(x => x.toLowerCase().includes(l)); if (m) hint = ` Did you mean [${m}]?`; }
        throw new FormulaError(cols ? `There is no column [${r}] in ${dsName || 'this data'}.${hint}` : `Pick a data source before using [${r}].`);
      }
    }
  }
  /* env: {rows, row?, keys?, params, cache, cols:Set, dsName} */
  function evaluate(src, env) {
    const c = compile(src);
    checkRefs(c, env.cols, env.dsName);
    const v = c.run(env);
    return typeof v === 'number' && !isFinite(v) ? null : v;
  }

  const DOCS = [
    ['Aggregate', 'Sum', 'Sum([column])', 'Adds up a column or expression across rows.'],
    ['Aggregate', 'Avg', 'Avg([column])', 'Average of the non-empty values.'],
    ['Aggregate', 'Count', 'Count()', 'Number of rows. Count([column]) counts non-empty values.'],
    ['Aggregate', 'CountDistinct', 'CountDistinct([column])', 'Number of different values.'],
    ['Aggregate', 'Min', 'Min([column])', 'Smallest value. Works on dates and text too.'],
    ['Aggregate', 'Max', 'Max([column])', 'Largest value.'],
    ['Aggregate', 'Median', 'Median([column])', 'Middle value.'],
    ['Aggregate', 'Percentile', 'Percentile([column], 0.9)', 'Value at a percentile between 0 and 1.'],
    ['Aggregate', 'StdDev', 'StdDev([column])', 'Sample standard deviation.'],
    ['Aggregate', 'SumIf', 'SumIf([column], condition)', 'Adds up only the rows where the condition is true.'],
    ['Aggregate', 'CountIf', 'CountIf(condition)', 'Counts the rows where the condition is true.'],
    ['Aggregate', 'AvgIf', 'AvgIf([column], condition)', 'Average over the rows where the condition is true.'],
    ['Aggregate', 'MinIf', 'MinIf([column], condition)', 'Smallest value among matching rows.'],
    ['Aggregate', 'MaxIf', 'MaxIf([column], condition)', 'Largest value among matching rows.'],
    ['Aggregate', 'CountDistinctIf', 'CountDistinctIf([column], condition)', 'Different values among matching rows.'],
    ['Aggregate', 'First', 'First([column])', 'Value from the first row.'],
    ['Aggregate', 'Last', 'Last([column])', 'Value from the last row.'],
    ['Logic', 'If', 'If(condition, then, else)', 'Chooses a value. Add more condition/value pairs for several branches.'],
    ['Logic', 'Switch', 'Switch(value, case1, result1, …, else)', 'Matches a value against cases.'],
    ['Logic', 'Coalesce', 'Coalesce(a, b, …)', 'First value that is not empty.'],
    ['Logic', 'Zn', 'Zn(value)', 'Turns an empty value into 0.'],
    ['Logic', 'IfNull', 'IfNull(value, fallback)', 'Uses the fallback when the value is empty.'],
    ['Logic', 'IsNull', 'IsNull(value)', 'True when the value is empty.'],
    ['Logic', 'IsNotNull', 'IsNotNull(value)', 'True when the value is present.'],
    ['Logic', 'In', 'In(value, a, b, …)', 'True when the value equals any of the options.'],
    ['Logic', 'Between', 'Between(value, low, high)', 'True when the value is inside the range, ends included.'],
    ['Math', 'Round', 'Round(number, digits)', 'Rounds to a number of decimal places.'],
    ['Math', 'Abs', 'Abs(number)', 'Absolute value.'],
    ['Math', 'Floor', 'Floor(number)', 'Rounds down.'],
    ['Math', 'Ceiling', 'Ceiling(number)', 'Rounds up.'],
    ['Math', 'Power', 'Power(base, exponent)', 'Raises to a power. Same as base ^ exponent.'],
    ['Math', 'Sqrt', 'Sqrt(number)', 'Square root.'],
    ['Math', 'Ln', 'Ln(number)', 'Natural logarithm.'],
    ['Math', 'Log', 'Log(number, base)', 'Logarithm, base 10 unless given.'],
    ['Math', 'Exp', 'Exp(number)', 'e raised to the number.'],
    ['Math', 'Mod', 'Mod(a, b)', 'Remainder after division.'],
    ['Math', 'Greatest', 'Greatest(a, b, …)', 'Largest of the arguments.'],
    ['Math', 'Least', 'Least(a, b, …)', 'Smallest of the arguments.'],
    ['Text', 'Concat', 'Concat(a, b, …)', 'Joins text. Same as a & b.'],
    ['Text', 'Upper', 'Upper(text)', 'Upper case.'],
    ['Text', 'Lower', 'Lower(text)', 'Lower case.'],
    ['Text', 'Trim', 'Trim(text)', 'Removes spaces at both ends.'],
    ['Text', 'Len', 'Len(text)', 'Number of characters.'],
    ['Text', 'Left', 'Left(text, n)', 'First n characters.'],
    ['Text', 'Right', 'Right(text, n)', 'Last n characters.'],
    ['Text', 'Mid', 'Mid(text, start, n)', 'n characters from a start position.'],
    ['Text', 'Replace', 'Replace(text, find, with)', 'Swaps every match.'],
    ['Text', 'Contains', 'Contains(text, part)', 'True when the text includes the part. Ignores case.'],
    ['Text', 'StartsWith', 'StartsWith(text, part)', 'True when the text begins with the part.'],
    ['Text', 'EndsWith', 'EndsWith(text, part)', 'True when the text ends with the part.'],
    ['Text', 'Text', 'Text(value)', 'Converts to text.'],
    ['Text', 'Number', 'Number(value)', 'Converts to a number.'],
    ['Date', 'Today', 'Today()', 'Today at midnight.'],
    ['Date', 'Now', 'Now()', 'The current date and time.'],
    ['Date', 'DateTrunc', 'DateTrunc("month", [date])', 'Start of the year, quarter, month, week, day or hour.'],
    ['Date', 'DateAdd', 'DateAdd("day", 7, [date])', 'Moves a date forward or back.'],
    ['Date', 'DateDiff', 'DateDiff("day", [start], [end])', 'Time between two dates in the unit.'],
    ['Date', 'DatePart', 'DatePart("quarter", [date])', 'One part of a date as a number.'],
    ['Date', 'Year', 'Year([date])', 'The year.'],
    ['Date', 'Quarter', 'Quarter([date])', 'Quarter, 1 to 4.'],
    ['Date', 'Month', 'Month([date])', 'Month, 1 to 12.'],
    ['Date', 'Day', 'Day([date])', 'Day of the month.'],
    ['Date', 'Weekday', 'Weekday([date])', 'Day of the week, Sunday is 1.'],
    ['Date', 'MonthName', 'MonthName([date])', 'Month as a word.'],
    ['Date', 'WeekdayName', 'WeekdayName([date])', 'Day of the week as a word.'],
    ['Date', 'MakeDate', 'MakeDate(year, month, day)', 'Builds a date.'],
    ['Date', 'Date', 'Date(value)', 'Converts text to a date.'],
  ].map(([cat, name, sig, d]) => ({ cat, name, sig, d, agg: cat === 'Aggregate' }));

  return { FormulaError, lex, parse, compile, evaluate, parseDate, isoLocal, trunc, dateAdd, N, T, truthy, cmp, eq, DOCS, isAgg: n => !!AGG[String(n).toLowerCase()] };
})();
if (typeof module !== 'undefined') module.exports = Formula;
