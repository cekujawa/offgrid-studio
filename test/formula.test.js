const F = require('../src/formula.js');
const assert = require('assert');
const rows = [
  { Region: 'West', Revenue: 100, Cost: 60, Units: 2, Date: new Date(2026, 0, 15), Returned: false },
  { Region: 'West', Revenue: 250, Cost: 100, Units: 5, Date: new Date(2026, 1, 3), Returned: true },
  { Region: 'East', Revenue: 50, Cost: 45, Units: 1, Date: new Date(2026, 1, 20), Returned: false },
  { Region: 'East', Revenue: null, Cost: 10, Units: 1, Date: new Date(2026, 2, 1), Returned: false },
];
const cols = new Set(Object.keys(rows[0]));
const env = (extra = {}) => ({ rows, cols, params: { target: 500 }, cache: new Map(), dsName: 'Orders', ...extra });
const ev = (s, e) => F.evaluate(s, e || env());
const t = (s, want) => { const got = ev(s); assert.deepStrictEqual(got instanceof Date ? +got : got, want instanceof Date ? +want : want, `${s} → ${got}, want ${want}`); };

t('Sum([Revenue])', 400);
t('Sum([Revenue] - [Cost])', 195);
t('Avg([Revenue])', 400 / 3);
t('Count()', 4);
t('Count([Revenue])', 3);
t('CountDistinct([Region])', 2);
t('CountIf([Region] = "West")', 2);
t('SumIf([Revenue], [Region] = "West" and [Units] > 2)', 250);
t('(Sum([Revenue]) - Sum([Cost])) / Sum([Revenue])', (400 - 215) / 400);
t('Sum([Revenue]) / @Target', 0.8);
t('Sum([Revenue]) / @[target]', 0.8);
t('If(Sum([Revenue]) > 300, "over", "under")', 'over');
t('If(Sum([Revenue]) > 900, "a", Sum([Revenue]) > 300, "b", "c")', 'b');
t('Max([Date])', new Date(2026, 2, 1));
t('Min([Region])', 'East');
t('SumIf([Revenue], [Date] >= "2026-02-01")', 300);
t('SumIf([Revenue], Month([Date]) = 2)', 300);
t('Median([Units])', 1.5);
t('Percentile([Units], 1)', 5);
t('2 + 3 * 4 ^ 2', 50);
t('-2 ^ 2', -4);
t('10 / 0', null);
t('50% * 200', 100);
t('"a" & "b" & 1', 'ab1');
t('Upper(Left("hello", 2))', 'HE');
t('Round(3.14159, 2)', 3.14);
t('not (1 > 2) and true', true);
t('1 <> 2 or false', true);
t('Coalesce(null, "", 5)', 5);
t('DateDiff("day", MakeDate(2026,1,1), MakeDate(2026,3,1))', 59);
t('DateTrunc("month", MakeDate(2026,5,17))', new Date(2026, 4, 1));
t('DateAdd("month", -1, MakeDate(2026,3,31))', new Date(2026, 1, 28));
t('Year(Max([Date]))', 2026);
t('CountIf([Returned])', 1);
t('In("b", "a", "b")', true);
t('Sum([Revenue] / Sum([Revenue]))', 1);
t('Zn(Sum([Revenue]) - 400)', 0);
t('sum([Revenue])', 400);
// row context
assert.strictEqual(ev('[Revenue] - [Cost]', env({ row: rows[0] })), 40);
assert.strictEqual(ev('[Revenue] / Sum([Revenue])', env({ row: rows[0] })), 0.25);
assert.strictEqual(ev('If([Revenue] > 80, "big", "small")', env({ row: rows[2] })), 'small');
// group keys
assert.strictEqual(ev('[Region] & ": " & Sum([Revenue])', env({ rows: rows.slice(0, 2), keys: { Region: 'West' } })), 'West: 350');
// errors
const bad = (s, re) => { try { ev(s); assert.fail('no throw: ' + s); } catch (e) { assert(e instanceof F.FormulaError, s + ' threw ' + e); assert(re.test(e.message), `${s}: ${e.message}`); } };
bad('Sum([Revenu])', /Did you mean \[Revenue\]/);
bad('[Revenue]', /Wrap it in an aggregate/);
bad('Sum([Revenue]', /closing parenthesis/);
bad('Sum([Revenue', /Missing \]/);
bad('Summ([Revenue])', /no function called Summ/);
bad('Revenue', /not known/);
bad('Sum()', /takes 1 argument/);
bad('1 +', /ends too early/);
bad('@Nope + 1', /No control provides @Nope/);
bad('', /Type a formula/);
bad('"abc', /closing quote/);
// lexer never throws
F.lex('Sum([Rev # $ "x');
// perf
const big = []; for (let i = 0; i < 200000; i++) big.push({ Revenue: i % 97, Cost: i % 13, Region: 'R' + (i % 5) });
const c0 = Date.now();
const r = F.evaluate('SumIf([Revenue] - [Cost], [Region] = "R1" or [Region] = "R3")', { rows: big, cols: new Set(['Revenue', 'Cost', 'Region']), params: {}, cache: new Map() });
console.log('200k rows:', Date.now() - c0, 'ms →', r);
console.log('formula tests passed');
