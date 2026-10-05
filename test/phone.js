const { open } = require('./shot.js'); const path = require('path');
(async () => {
  const { browser, page, errors } = await open({ viewport: { width: 400, height: 800 }, touch: true });
  await page.locator('#dock button', { hasText: 'Insert' }).click(); await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(__dirname, 'p-insert.png') });
  await page.locator('#left .tile', { hasText: /^KPI$/ }).click(); await page.waitForTimeout(200);
  await page.locator('#dock button', { hasText: 'Design' }).click(); await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(__dirname, 'p-design.png') });
  await page.locator('#dock button', { hasText: 'Design' }).click();
  await page.click('#fx-ta'); await page.keyboard.press('Control+A'); await page.keyboard.type('Sum([Rev');
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(__dirname, 'p-fx.png') });
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
  console.log(JSON.stringify(m), errors.filter(e => !e.includes('ERR_FAILED')));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.click('#btn-mode'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'p-view.png') });
  await browser.close();
  // pinned dark dashboard on a light viewer
  const d = await open({});
  await d.page.locator('#right select[aria-label="theme"]').selectOption('dark'); await d.page.waitForTimeout(300);
  await d.page.locator('.el', { hasText: 'Revenue by month' }).first().click();
  await d.page.screenshot({ path: path.join(__dirname, 'd-pinned.png') });
  console.log(d.errors.filter(e => !e.includes('ERR_FAILED')));
  await d.browser.close();
})();
