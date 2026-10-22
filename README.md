# POS Central Q4 Sales Arena

A static dashboard for Ankit Arora and Tripti Mandal. It reads the first tab (`gid=0`) of the [Google Sheet](https://docs.google.com/spreadsheets/d/1_zbz4DhExyHoXwX-1BzoJm-gKR-3P7wll64p-DxHhyw/edit?gid=0) that you update manually. The browser requests the sheet's public, read-only CSV export every 30 seconds. No Microsoft 365 app, server credential, or local Excel file is required.

## Run locally

From this folder in PowerShell:

```powershell
./start.ps1
```

Open <http://127.0.0.1:8000>. Python 3 is the only local requirement. Keep the terminal open while viewing the page. A network connection is required to load the Google Sheet.

## Data mapping

- Rows 12–14: combined ANZ figures in AUD.
- Rows 32–34: Australia figures in AUD.
- Rows 50–52: New Zealand figures in NZD.
- Columns F–I: Ankit's target, actual, payment, and refund.
- Columns J–M: Tripti's matching figures.

The page adds the October, November, and December values for each Q4 total. It checks that each displayed `Actual` equals `Payment − Refund` within two cents. If the Google Sheet becomes unavailable or its layout changes, the page shows an error and retains the last successfully loaded figures until the next check. The last table is not used.

The two Q4 net achieved amounts and each month's table figures start masked. Click an eye beside a card amount or month name to reveal or hide that selection. The month bars remain visible. Switching region or salesperson masks the figures again. These eyes only change the display; the public Google Sheet and other dashboard summaries remain viewable.

## Deploy as a static site

For Vercel, create a GitHub repository from this `sales-dashboard` folder and import it with the repository root as the project root. `vercel.json` selects the **Other** framework and serves the `web` directory without a build command. Each push to the connected production branch can deploy a new version. Other static hosts can serve the same `web` folder.

The shared Google Sheet is public to viewers, including all data in its shared tabs. The dashboard interface shows only Ankit and Tripti. Keep editing permission limited to the people who maintain the sheet. If the sheet ID, tab ID, row positions, or columns change, update `web/data.mjs`.
