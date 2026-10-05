const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const strip = s => s.replace(/\nif \(typeof module !== 'undefined'\) module\.exports = \w+;\n?/g, '\n');
const app = ['core.js', 'canvas.js', 'ui.js', 'store.js', 'boot.js'].map(src).join('\n');
const js = `${strip(src('formula.js'))}\n${strip(src('data.js'))}\n(() => {\n'use strict';\n${app}\n})();`;
if (js.includes('</script')) throw new Error('script contains a closing script tag');
const html = src('index.tpl.html').replace('/*__CSS__*/', () => src('style.css')).replace('/*__JS__*/', () => js);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'offgrid-studio.html'), html);
// a standalone copy with a document skeleton for local browser tests
fs.writeFileSync(path.join(__dirname, 'dist', 'local.html'), `<!doctype html><html lang="en"><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}img{max-width:100%}</style></head><body>${html}</body></html>`);
// the same standalone page, where GitHub Pages serves it from (/docs)
fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
fs.copyFileSync(path.join(__dirname, 'dist', 'local.html'), path.join(__dirname, 'docs', 'index.html'));
console.log('built', (html.length / 1024).toFixed(0) + ' KB');
