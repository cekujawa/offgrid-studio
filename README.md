# Offgrid Studio

A free-form dashboard builder. Place KPIs, charts, tables, shapes and images anywhere on a canvas at any size, and drive them with formulas written in a bar at the top, in the style of Sigma: `Sum([Revenue]) / CountDistinct([Order ID])`.

## Run it

Open `docs/index.html` in a browser. That is the whole app in one file. It needs a network connection the first time to load the chart library and fonts from their CDNs.

To put it online, push this repository to GitHub, then in **Settings → Pages** choose **Deploy from a branch**, branch `main`, folder `/docs`.

## Change it

```
npm install        # only needed for the browser tests
npm run build      # rebuilds docs/index.html and dist/ from src/
npm test           # formula engine tests (plain Node, no browser)
npm run test:browser   # end-to-end tests; needs `npm i -D playwright`
```

| File | What lives there |
| --- | --- |
| `src/formula.js` | The formula language: lexer, parser, compiler, every function and its help text |
| `src/data.js` | CSV / JSON import, type detection, number and date formatting, the sample data set |
| `src/core.js` | State, formula evaluation per element, and how each element type draws itself |
| `src/canvas.js` | Dragging, resizing, rotating, snapping, zoom and pan, keyboard shortcuts |
| `src/ui.js` | Top bar, formula bar, insert / layers / data panels, the design panel, dialogs |
| `src/store.js` | Saving and loading |
| `src/boot.js` | The sample dashboard and start-up |
| `src/style.css` | All styling, light and dark |
| `build.js` | Joins everything into one HTML file |

`dist/offgrid-studio.html` is the build published as a Claude artifact. `docs/index.html` is the same page with a document wrapper, for any ordinary web host.

## Where your work is saved

- **As a plain web page** (GitHub Pages, or the file opened locally): in that browser's storage. Use **⋯ → Save a copy as a file** for a backup you can reopen anywhere with **Open a dashboard file**.
- **Inside Claude**: in the artifact's own database, so it follows you across devices.

## Not built yet

- Live warehouse queries. Data comes in by uploading or pasting CSV / JSON. A page served from GitHub Pages has no server, so a warehouse connection needs either a Claude connector (inside Claude) or a small backend that holds the credentials and runs the SQL.
- Grouping elements, formulas across two data sets, several people editing at once.

## Add a formula function

In `src/formula.js`, add an entry to `SCALAR` (works on single values) or `AGG` (works across rows), then add a line to `DOCS` so it shows up in autocomplete and the function reference. Add a case to `test/formula.test.js`.
