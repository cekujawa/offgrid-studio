const { open } = require('./shot.js');
(async () => {
  const { browser, page, errors } = await open({});
  await page.click('button[title="More"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.menu button', { hasText: 'Save a copy' }).click()]);
  const p = await dl.path(); const j = JSON.parse(require('fs').readFileSync(p, 'utf8'));
  console.log('download', dl.suggestedFilename(), 'pages', j.board.pages.length, 'elements', j.board.pages[0].els.length, 'errors', errors.filter(e => !e.includes('ERR_FAILED')));
  await browser.close();
})().catch(e => { console.error('CRASH', String(e).slice(0, 400)); process.exit(1); });
