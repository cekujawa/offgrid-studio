let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const fs = require('fs'), path = require('path');
const chartSrc = fs.readFileSync(path.join(__dirname, '../node_modules/chart.js/dist/chart.umd.js'), 'utf8');
module.exports.open = async function open(opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, colorScheme: opts.dark ? 'dark' : 'light', deviceScaleFactor: 1, hasTouch: !!opts.touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (u.includes('chart.umd.js')) return r.fulfill({ contentType: 'application/javascript', body: chartSrc });
    return r.abort();
  });
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto('file://' + path.join(__dirname, '../dist/local.html'));
  await page.waitForTimeout(opts.wait || 700);
  return { browser, page, errors };
};
if (require.main === module) (async () => {
  const out = process.argv[2] || 'shot';
  for (const [name, o] of [['desk-light', {}], ['desk-dark', { dark: true }], ['phone', { viewport: { width: 400, height: 800 }, touch: true }]]) {
    const { browser, page, errors } = await module.exports.open(o);
    await page.screenshot({ path: path.join(__dirname, `${out}-${name}.png`) });
    console.log(name, 'errors:', errors.length ? errors : 'none');
    const over = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, els: document.querySelectorAll('.el').length, errs: [...document.querySelectorAll('.el-err')].map(e => e.textContent) }));
    console.log(name, JSON.stringify(over));
    await browser.close();
  }
})();
