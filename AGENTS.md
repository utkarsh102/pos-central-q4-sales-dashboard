# Repository Guidelines

## Project Structure & Data Source

This repository contains the static POS Central Q4 dashboard. `web/index.html` defines the page, `web/style.css` contains its design, `web/app.js` renders the views, and `web/data.mjs` reads the public Google Sheet. Logos and fonts are in `web/assets/`. `start.ps1` serves the site locally. The original Excel workbook is kept outside this repository and is not the live data source.

The parser reads October–December rows 12–14 (ANZ), 32–34 (Australia), and 50–52 (New Zealand). Columns F–I hold Ankit's target, actual, payment, and refund; J–M hold Tripti's values. Preserve `Actual = Payment − Refund` and the sheet's existing regional totals.

## Build, Test & Development Commands

From this folder in PowerShell, run `./start.ps1`, then open `http://127.0.0.1:8000`. Python 3 is required to serve files locally. The site needs no package installation or build step. `vercel.json` serves `web/` directly on Vercel.

## Coding Style & Naming

Use two-space indentation in HTML, CSS, and JavaScript. Name JavaScript functions and variables in `camelCase`; use descriptive uppercase names for constants when helpful. Keep sheet parsing and validation in `data.mjs`, and DOM updates and animations in `app.js`. No formatter or linter is configured; match nearby code and avoid unrelated formatting changes.

## Testing Guidelines

There is no automated test framework or coverage target. After data changes, verify all three regions and both salesperson views against the Google Sheet. Check targets, payments, refunds, and net actual. Check that each eye reveals only its selected figures and resets after switching region or salesperson. Verify the error state if the sheet is unavailable and check mobile width for overflow.

## Commits, Pull Requests & Public Data

No Git history exists yet, so no commit convention is established. Use short imperative commit messages. Pull requests should describe the change, list checks performed, explain any data-mapping change, and include screenshots for visual changes. The Google Sheet is public to viewers; restrict edit access and never commit credentials or the original Excel workbook.
