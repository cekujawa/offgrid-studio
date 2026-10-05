const { open } = require('./shot.js'); const path = require('path');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open({});
  const tile = async name => { await page.locator('.tabs button', { hasText: 'Insert' }).click(); const all = await page.locator('#left .tile').allTextContents(); await page.locator('#left .tile').nth(all.indexOf(name)).click(); await page.waitForTimeout(60); };
  const errs = async () => page.locator('.el-err').allTextContents();
  const typeFx = async t => { await page.click('#fx-ta'); await page.keyboard.press('Control+A'); await page.keyboard.type(t); const out = await page.textContent('#fx-out'); if (!(await page.locator('#fx-ac').isHidden())) await page.keyboard.press('Escape'); await page.keyboard.press('Enter'); return out; };
  // new page
  await page.click('button[title="Add a page"]'); await page.waitForTimeout(150);
  ok(await page.locator('.el').count() === 0, 'new page starts empty');
  // scatter
  await tile('Scatter'); ok((await errs()).length === 0 && await page.locator('.el canvas').count() === 1, 'scatter chart renders');
  // donut then switch type through the inspector
  await tile('Donut'); await page.locator('#right .seg button[title="Area"]').click(); await page.waitForTimeout(80);
  await page.locator('#right select[aria-label="cat.col"]').selectOption('Order Date'); await page.waitForTimeout(80);
  await page.locator('#right select[aria-label="split"]').selectOption('Region'); await page.waitForTimeout(80);
  await page.locator('#right label.check', { hasText: 'Stack the series' }).click(); await page.waitForTimeout(80);
  ok((await errs()).length === 0, 'area chart by date, split and stacked: ' + JSON.stringify(await errs()));
  // add a second measure with a formula
  await page.locator('#right button', { hasText: 'Add measure' }).click();
  const out = await typeFx('Sum([Revenue]) - Sum([Cost])');
  ok(out.includes('across all rows'), 'second measure formula evaluates: ' + out);
  // table raw rows
  await tile('Table'); await page.locator('#right .seg button', { hasText: 'Raw rows' }).click(); await page.waitForTimeout(80);
  ok(await page.locator('.el .tbl tbody tr').count() === 100 && (await page.locator('.tbl-foot').textContent()).includes('2,857'), 'raw rows table limited with a note: ' + await page.locator('.tbl-foot').textContent());
  // date range control
  await tile('Date range');
  await page.locator('.el.live .ctl select').selectOption('30d'); await page.waitForTimeout(150);
  const foot = await page.locator('.tbl-foot').textContent();
  ok(!foot.includes('2,857'), 'date range filters the table: ' + foot);
  await page.locator('.el.live .ctl select').selectOption('custom'); await page.waitForTimeout(100);
  ok(await page.locator('.el.live .ctl input[type=date]').count() === 2, 'custom range shows two date inputs');
  await page.locator('.el.live .ctl select').selectOption('all');
  // shape as gauge with a rule
  await tile('Ring');
  await page.locator('#right .fxlink[data-key="amount"]').click();
  const o2 = await typeFx('CountIf([Channel] = "Online") / Count()');
  ok(/%/.test(o2), 'shape fill amount formula: ' + o2);
  await page.locator('#right button', { hasText: 'Add rule' }).click();
  const o3 = await typeFx('Count() > 100');
  ok(o3.includes('True'), 'rule condition evaluates: ' + o3);
  ok(await page.locator('.el svg circle').count() >= 2, 'ring draws track and progress');
  // container carries children
  await page.click('button[title="Add a page"]'); await page.waitForTimeout(150);
  await tile('Container'); await tile('Text');
  const cont = page.locator('.el').filter({ has: page.locator('svg rect') }).first();
  const txt = page.locator('.el', { hasText: 'Double-click to edit this text' });
  const t0 = await txt.boundingBox(); const c0 = await cont.boundingBox();
  await page.keyboard.press('Escape');
  await page.mouse.move(c0.x + 12, c0.y + 12); await page.mouse.down(); await page.mouse.move(c0.x + 72, c0.y + 52, { steps: 5 }); await page.mouse.up();
  const t1 = await txt.boundingBox();
  ok(Math.abs(t1.x - t0.x - 60) < 8, 'moving a container carries what sits on it: ' + Math.round(t1.x - t0.x));
  // copy / paste / duplicate / delete
  const n0 = await page.locator('.el').count();
  await txt.click(); await page.keyboard.press('Control+d'); await page.waitForTimeout(60);
  ok(await page.locator('.el').count() === n0 + 1, 'duplicate');
  await page.keyboard.press('Delete'); await page.waitForTimeout(60);
  ok(await page.locator('.el').count() === n0, 'delete');
  // arrows nudge
  await txt.click(); const a0 = await txt.boundingBox(); await page.keyboard.press('Shift+ArrowRight'); const a1 = await txt.boundingBox();
  ok(Math.round((a1.x - a0.x)) > 0, 'arrow keys nudge');
  // layers panel
  await page.locator('.tabs button', { hasText: 'Layers' }).click();
  ok(await page.locator('.layer').count() === n0, 'layers list matches');
  await page.locator('.page-tab', { hasText: 'Page 2' }).click(); await page.waitForTimeout(200);
  await page.locator('.layer button[title="Hide"]').first().click(); await page.waitForTimeout(60);
  ok(await page.locator('.el[hidden]').count() === 1, 'hide from layers');
  // filter on second page does not leak to first: switch page
  await page.locator('.page-tab', { hasText: 'Overview' }).click(); await page.waitForTimeout(250);
  ok((await errs()).length === 0 && await page.locator('.el').count() >= 20, 'switch back to first page');
  // color popover
  await page.locator('.el', { hasText: 'Orders' }).first().click();
  await page.locator('#right .row', { hasText: 'Fill' }).locator('.swatch').click();
  await page.locator('.pop .chip[title="Series 3"]').click(); await page.waitForTimeout(80);
  const bg = await page.locator('.el', { hasText: 'Orders' }).first().locator('.el-body').evaluate(n => n.style.background);
  ok(bg.includes('--s3'), 'theme color applied: ' + bg);
  await page.keyboard.press('Escape');
  // export then import round trip via file input
  await page.waitForTimeout(2600);
  const bundle = await page.evaluate(() => localStorage.getItem('offgrid.studio.v1'));
  await page.click('button[title="More"]');
  await page.locator('.menu button', { hasText: 'Start a blank dashboard' }).click(); await page.waitForTimeout(200);
  ok(await page.locator('.el').count() === 0 && await page.inputValue('#board-name') === 'Untitled dashboard', 'blank dashboard');
  await page.setInputFiles('#pick-board', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(bundle) });
  await page.waitForTimeout(400);
  ok(await page.locator('.el').count() >= 20 && (await errs()).length === 0, 'open a dashboard file restores it');
  ok(await page.locator('.page-tab').count() === 4, 'all pages restored');
  await page.click('button[title="More"]');
  await page.locator('.menu button', { hasText: 'Load the sample dashboard' }).click(); await page.waitForTimeout(300);
  ok(await page.locator('.el').count() === 24, 'sample reloads');
  await page.screenshot({ path: path.join(__dirname, 'i2.png') });
  console.log('console errors:', errors.filter(e => !e.includes('ERR_FAILED')));
  if (errors.filter(e => !e.includes('ERR_FAILED')).length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error('TEST CRASH', String(e).slice(0, 1500)); process.exit(1); });
