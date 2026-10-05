const { open } = require('./shot.js'); const path = require('path');
(async () => {
  const { browser, page, errors } = await open({});
  await page.click('#btn-mode'); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, 'v-view.png') });
  console.log(await page.evaluate(() => { const r = document.querySelector('#viewport').getBoundingClientRect(); return JSON.stringify({ vp: [r.x, r.y, r.width, r.height], stage: document.querySelector('#stage').style.transform }); }));
  console.log(errors);
  await browser.close();
})();
