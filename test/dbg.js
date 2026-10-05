const { open } = require('./shot.js'); const path = require('path');
(async () => {
  const { browser, page, errors } = await open({});
  page.on('console', m => console.log('LOG', m.text()));
  await page.evaluate(() => {
    for (const t of ['pointerdown','pointerup','click','mousedown','mouseup']) window.addEventListener(t, e => console.log(t, e.target.id || e.target.className, e.detail), true);
    window.addEventListener('dblclick', e => console.log('dblclick target', e.target.id || e.target.className, 'hits', document.elementsFromPoint(e.clientX, e.clientY).slice(0, 5).map(n => n.id || n.className).join(' > ')), true);
    document.addEventListener('focusout', e => console.log('focusout', e.target.className, '→', e.relatedTarget && (e.relatedTarget.id || e.relatedTarget.className)), true);
    document.addEventListener('focusin', e => console.log('focusin', e.target.id || e.target.className), true);
  });
  const title = page.locator('.el', { hasText: 'Kestrel Outfitters sales pulse' }).first();
  await title.dblclick(); await page.waitForTimeout(100);
  console.log('editable:', await page.evaluate(() => { const t = document.querySelector('.txt[contenteditable]'); return t ? [t.textContent, document.activeElement === t] : null; }));
  await browser.close();
})();
