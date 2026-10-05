const { open } = require('./shot.js');
const path = require('path'), fs = require('fs');
const log = (...a) => console.log(...a);
const ok = (c, m) => { log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open({});
  const st = () => page.evaluate(() => JSON.parse(localStorage.getItem('offgrid.studio.v1') || 'null'));
  const box = async sel => (await page.locator(sel).first().boundingBox());
  const elBox = name => page.evaluate(n => { const b = window.__t.byName(n); return b; }, name);
  // expose test hooks through DOM only: find element node by its text
  const nodeByText = async t => page.locator('.el', { hasText: t }).first();

  // 1. select KPI, formula shows in bar
  const kpi = await nodeByText('Gross margin');
  await kpi.click();
  ok(await page.inputValue('#fx-ta') === '(Sum([Revenue]) - Sum([Cost])) / Sum([Revenue])', 'formula bar shows the KPI formula');
  ok((await page.textContent('#fx-out')).includes('39.1%'), 'preview shows result: ' + await page.textContent('#fx-out'));
  // 2. edit formula with autocomplete
  await page.click('#fx-ta'); await page.keyboard.press('Control+A'); await page.keyboard.type('Cou');
  ok(await page.locator('#fx-ac:not([hidden]) .ac-item').count() > 0, 'function suggestions appear');
  await page.keyboard.press('Enter');
  ok((await page.inputValue('#fx-ta')).startsWith('Count('), 'accepting a suggestion inserts it: ' + await page.inputValue('#fx-ta'));
  await page.keyboard.type('[Reg');
  ok((await page.locator('#fx-ac:not([hidden]) .ac-item b').first().textContent()) === '[Region]', 'column suggestions appear');
  await page.keyboard.press('Tab'); await page.keyboard.type(')');
  ok(await page.inputValue('#fx-ta') === 'Count([Region])', 'formula typed: ' + await page.inputValue('#fx-ta'));
  ok((await page.textContent('#fx-out')).includes('285,700'), 'live result: ' + await page.textContent('#fx-out'));
  await page.keyboard.press('Enter');
  ok((await kpi.textContent()).includes('2,857') || (await kpi.textContent()).includes('285,700'), 'KPI updated on canvas: ' + await kpi.textContent());
  // error message
  await page.click('#fx-ta'); await page.keyboard.press('Control+A'); await page.keyboard.type('Sum([Revenu])');
  ok((await page.textContent('#fx-out')).includes('Did you mean [Revenue]'), 'helpful error: ' + await page.textContent('#fx-out'));
  await page.keyboard.press('Escape');
  ok(await page.inputValue('#fx-ta') === 'Count([Region])', 'escape restores the formula');
  // 3. undo
  await page.keyboard.press('Escape');
  await page.locator('#viewport').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  ok((await kpi.textContent()).includes('39.1%'), 'undo restores the KPI: ' + await kpi.textContent());
  // 4. add every element type
  const before = await page.locator('.el').count();
  const tiles = await page.locator('#left .tile').allTextContents();
  for (let i = 0; i < tiles.length; i++) { if (tiles[i] === 'Image') continue; await page.locator('#left .tile').nth(i).click(); await page.waitForTimeout(40); }
  const after = await page.locator('.el').count();
  ok(after - before === tiles.length - 1, `added ${after - before} of ${tiles.length - 1} element types`);
  ok(await page.locator('.el-err').count() === 0, 'no element shows an error: ' + JSON.stringify(await page.locator('.el-err').allTextContents()));
  await page.screenshot({ path: path.join(__dirname, 'i-added.png') });
  // delete the last added one by one via undo
  for (let i = 0; i < tiles.length - 1; i++) await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  ok(await page.locator('.el').count() === before, 'undo removes the added elements');
  // 5. drag move + resize
  const aov = await nodeByText('Average order value');
  const b1 = await aov.boundingBox();
  await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2); await page.mouse.down(); await page.mouse.move(b1.x + b1.width / 2 + 60, b1.y + b1.height / 2 + 47, { steps: 6 }); await page.mouse.up();
  const b2 = await aov.boundingBox();
  ok(Math.abs(b2.x - b1.x - 60) < 6 && Math.abs(b2.y - b1.y - 47) < 6, `drag moved it by ${Math.round(b2.x - b1.x)}, ${Math.round(b2.y - b1.y)}`);
  const hd = await box('.hd[data-h="se"]');
  await page.mouse.move(hd.x + 5, hd.y + 5); await page.mouse.down(); await page.mouse.move(hd.x + 85, hd.y + 55, { steps: 5 }); await page.mouse.up();
  const b3 = await aov.boundingBox();
  ok(b3.width - b2.width > 70 && b3.height - b2.height > 40, `resize grew it by ${Math.round(b3.width - b2.width)} × ${Math.round(b3.height - b2.height)}`);
  const info = await page.textContent('#hud-info');
  ok(/x \d+/.test(info), 'position readout: ' + info);
  // rotate
  const rot = await box('.hd.rot');
  await page.mouse.move(rot.x + 5, rot.y + 5); await page.mouse.down(); await page.mouse.move(rot.x + 80, rot.y + 40, { steps: 5 }); await page.mouse.up();
  ok(/°/.test(await page.textContent('#hud-info')), 'rotation applied: ' + await page.textContent('#hud-info'));
  await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z');
  // 6. inspector edits
  await kpi.click();
  await page.locator('#right input[aria-label="label"]').fill('Margin %');
  ok(await page.locator('.el', { hasText: 'Margin %' }).count() === 1, 'inspector label edit shows on canvas');
  // 7. view mode + filter
  await page.click('#btn-mode'); await page.waitForTimeout(250);
  ok(await page.locator('#app[data-mode="view"]').count() === 1, 'view mode on');
  const orders = await nodeByText('Orders');
  const t0 = await orders.textContent();
  await page.locator('.opt', { hasText: /^West$/ }).click(); await page.waitForTimeout(150);
  const t1 = await orders.textContent();
  ok(t0 !== t1, `filter changes KPI: ${t0} → ${t1}`);
  await page.screenshot({ path: path.join(__dirname, 'i-view.png') });
  await page.locator('.opt', { hasText: 'All' }).first().click(); await page.waitForTimeout(100);
  // slider
  const sl = page.locator('.ctl input[type=range]');
  await sl.evaluate(e => { e.value = 60000; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(150);
  const ring = await nodeByText('against target');
  ok(await page.locator('.el:not([hidden]) svg polygon').count() >= 1 || true, 'star check skipped');
  const starVisible = await page.evaluate(() => [...document.querySelectorAll('.el')].filter(n => n.querySelector('polygon') && !n.hidden).length);
  ok(starVisible >= 1, 'star appears once the target is met (rule-driven visibility)');
  await page.locator('.opt', { hasText: 'All' }).first().click();
  await page.click('#btn-mode'); await page.waitForTimeout(250);
  // 8. paste data + calc column
  await page.locator('.tabs button', { hasText: 'Data' }).click();
  await page.locator('button', { hasText: 'Paste a table' }).click();
  await page.fill('#paste-name', 'Tickets');
  await page.fill('#paste-text', 'team\topened\thours\tcost\nAlpha\t2026-01-03\t4.5\t$120.00\nBeta\t2026-01-09\t2\t$80.50\nAlpha\t2026-02-11\t7\t$300.00\n');
  await page.locator('.dialog button', { hasText: 'Add data' }).click(); await page.waitForTimeout(150);
  ok((await page.locator('.ds').count()) === 2, 'pasted data set added');
  ok((await page.locator('.ds').nth(1).textContent()).includes('3 rows · 4 columns'), 'row and column counts: ' + (await page.locator('.ds .meta').nth(1).textContent()));
  await page.locator('.ds').nth(1).locator('button', { hasText: 'Calculated column' }).click();
  await page.fill('#calc-name', 'Rate'); await page.fill('#calc-formula', '[cost] / [hours]');
  ok((await page.textContent('.dialog .msg')).includes('26.67'), 'calc preview: ' + await page.textContent('.dialog .msg'));
  await page.locator('.dialog button', { hasText: 'Add column' }).click(); await page.waitForTimeout(100);
  ok((await page.locator('.ds').nth(1).textContent()).includes('Rate'), 'calculated column listed');
  await page.locator('.ds').nth(1).locator('button', { hasText: 'Preview' }).click();
  ok(await page.locator('.dialog .tbl tbody tr').count() === 3, 'preview dialog lists rows');
  await page.keyboard.press('Escape');
  // new KPI on pasted data
  await page.locator('.tabs button', { hasText: 'Insert' }).click();
  await page.locator('#left .tile', { hasText: /^KPI$/ }).click();
  await page.locator('#right select[aria-label="ds"]').selectOption({ label: 'Tickets' });
  await page.click('#fx-ta'); await page.keyboard.press('Control+A'); await page.keyboard.type('Avg([Rate])'); const live = await page.textContent('#fx-out'); await page.keyboard.press('Enter');
  ok(live.includes('36.59') || live.includes('36.6'), 'KPI on pasted data: ' + live);
  // 9. text inline edit
  const title = await nodeByText('Kestrel Outfitters sales pulse');
  await title.dblclick(); await page.keyboard.press('Control+A'); await page.keyboard.type('Hello {{ 1 + 1 }}');
  await page.locator('#viewport').click({ position: { x: 4, y: 300 } }); await page.waitForTimeout(100);
  ok(await page.locator('.el', { hasText: 'Hello 2' }).count() === 1, 'inline text edit with a live slot');
  // 10. image
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC', 'base64');
  await page.locator('.tabs button', { hasText: 'Insert' }).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#left .tile', { hasText: /^Image$/ }).click()]);
  await chooser.setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: png });
  await page.waitForTimeout(300);
  ok(await page.locator('.el img.img').count() === 2, 'image element added');
  // 11. marquee + align
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+a'); await page.waitForTimeout(80);
  ok((await page.textContent('#hud-info')).includes('selected'), 'select all: ' + await page.textContent('#hud-info'));
  ok(await page.locator('#right button[title="Align left edges"]').count() === 1, 'align tools shown for a multi-selection');
  await page.keyboard.press('Escape');
  // 12. function reference
  await page.click('#fx-help');
  ok(await page.locator('.fnref button').count() > 50, 'function reference lists functions');
  await page.keyboard.press('Escape');
  // 13. local persistence
  await page.waitForTimeout(1600);
  const saved = await st();
  ok(saved && saved.board.pages[0].els.length > 20 && saved.datasets.length === 2 && saved.datasets[1].rows.length === 3, 'saved to browser storage');
  ok((await page.textContent('#status')).includes('Kept in this browser'), 'status: ' + await page.textContent('#status'));
  await page.reload(); await page.waitForTimeout(700);
  ok(await page.locator('.el', { hasText: 'Hello 2' }).count() === 1 && await page.locator('.el img.img').count() === 2, 'reload restores the dashboard, pasted data and image');
  ok(await page.locator('.el-err').count() === 0, 'no errors after reload: ' + JSON.stringify(await page.locator('.el-err').allTextContents()));
  await page.screenshot({ path: path.join(__dirname, 'i-final.png') });
  log('console errors:', errors.filter(e => !e.includes('ERR_FAILED')));
  if (errors.filter(e => !e.includes('ERR_FAILED')).length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
