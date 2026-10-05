const { open } = require('./shot.js'); const mock = require('./mock.js'); const path = require('path');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open({ init: mock({}) });
  const dbKeys = () => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('__mockdb') || '{}')).sort());
  ok((await page.textContent('#status')).includes('Saved'), 'status on first open: ' + await page.textContent('#status'));
  ok((await dbKeys()).length === 0, 'nothing is written before the first edit');
  // edit a label
  await page.locator('.el', { hasText: 'Gross margin' }).first().click();
  await page.locator('#right input[aria-label="label"]').fill('GM');
  // paste a larger data set (forces several chunks)
  let csv = 'id,when,team,amount,note\n';
  for (let i = 0; i < 9000; i++) csv += `${i},2026-0${1 + (i % 9)}-1${i % 9},Team ${i % 7},${(i * 7.31 % 500).toFixed(2)},"note number ${i} with some padding text, and a comma"\n`;
  await page.locator('.tabs button', { hasText: 'Data' }).click();
  await page.locator('button', { hasText: 'Paste a table' }).click();
  await page.fill('#paste-name', 'Big'); await page.evaluate(v => { document.querySelector('#paste-text').value = v; }, csv);
  await page.locator('.dialog button', { hasText: 'Add data' }).click();
  // image
  await page.locator('.tabs button', { hasText: 'Insert' }).click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC', 'base64');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#left .tile', { hasText: /^Image$/ }).click()]);
  await chooser.setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: png });
  await page.waitForTimeout(3500);
  let keys = await dbKeys();
  console.log(keys.join('\n'));
  ok(keys.includes('boards/main'), 'board document written');
  ok(keys.includes('datasets/ds_sample'), 'sample data set saved as a reference, not rows');
  ok(keys.filter(k => /^datasets\/ds_\w+\/chunks\/c\d{4}$/.test(k)).length >= 3, 'pasted rows written in chunks');
  ok(keys.some(k => k.startsWith('images/img_')), 'images stored');
  ok((await page.textContent('#status')).trim() === 'Saved', 'status after saving: ' + await page.textContent('#status'));
  const sizes = await page.evaluate(() => window.__writes.filter(w => w[0] === 'set').map(w => w[2]));
  ok(Math.max(...sizes) < 262144, 'largest document ' + Math.max(...sizes) + ' bytes, under the 256 KiB cap');
  const writes = await page.evaluate(() => window.__writes.length);
  // reload
  await page.reload(); await page.waitForTimeout(1200);
  ok(await page.locator('.veil').count() === 0, 'veil cleared after load');
  ok(await page.locator('.el', { hasText: 'GM' }).count() >= 1, 'label edit restored from the database');
  ok(await page.locator('.el img.img').count() === 2, 'image restored');
  await page.locator('.tabs button', { hasText: 'Data' }).click();
  ok((await page.locator('.ds').nth(1).textContent()).includes('9,000 rows · 5 columns') && (await page.locator('.ds').nth(0).textContent()).includes('Orders (sample)'), 'data set restored in order: ' + await page.locator('.ds .meta').nth(1).textContent());
  await page.waitForTimeout(1800);
  ok(await page.evaluate(() => window.__writes.length) === 0, 'loading writes nothing');
  ok(await page.locator('.el-err').count() === 0, 'no element errors');
  // remove the data set
  const rm = page.locator('.ds').nth(1).locator('.ds-actions button').nth(2);
  await rm.click(); await rm.click(); await page.waitForTimeout(3000);
  keys = await dbKeys();
  ok(!keys.some(k => k.includes('/chunks/')) && keys.filter(k => k.startsWith('datasets/')).length === 1, 'removed data set is deleted from storage: ' + keys.join(', '));
  // export
  await page.click('button[title="More"]');
  await page.locator('.menu button', { hasText: 'Save a copy' }).click(); await page.waitForTimeout(300);
  const saved = await page.evaluate(() => window.__saved);
  ok(saved && saved.filename.endsWith('.offgrid.json') && saved.len > 1000, 'export hands over a file: ' + JSON.stringify(saved));
  console.log('errors', errors.filter(e => !e.includes('ERR_FAILED')));
  await browser.close();
  // read-only viewer
  const ro = await open({ init: mock({ readonly: true }) });
  ok(await ro.page.locator('#app[data-mode="view"]').count() === 1, 'a viewer without write access opens in view mode');
  ok(!(await ro.page.locator('#btn-mode').isVisible()), 'edit button hidden for read-only viewers');
  ok((await ro.page.textContent('#status')).includes('View only'), 'read-only status: ' + await ro.page.textContent('#status'));
  await ro.page.locator('.opt', { hasText: /^South$/ }).click(); await ro.page.waitForTimeout(1600);
  ok(await ro.page.evaluate(() => window.__writes.length) === 0, 'read-only viewer never writes');
  await ro.page.screenshot({ path: path.join(__dirname, 'db-readonly.png') });
  console.log('errors', ro.errors.filter(e => !e.includes('ERR_FAILED')));
  await ro.browser.close();
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
