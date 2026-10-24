# STRATUM — Production Intelligence

An independent English-language oilfield decision-support prototype. The problem is production shortfall whose cause and appropriate response are hard to establish across disconnected measurements. The workflow is **observe → inspect evidence → compare scenarios → record an action**.

## Run

Requires Node.js 22.12+ or 24 and npm.

```sh
npm install
npm run dev
```

Open the local address printed by Vite. For a static build, run `npm run build` and `npm run preview`. The interface runs locally; it does not require a Figma connection or a cloud account.

## Implemented experience

- Problem and solution introduction in English.
- Portfolio production metrics and an impact-ranked review queue.
- A real Three.js oilfield with ESP wellheads, animated rod pumps, tanks, pipelines, a processing plant and subterranean layers.
- Orbit, zoom, pointer and keyboard well selection, surface/subsurface/flow modes, pump-speed, layer-separation, camera-angle and daylight sliders.
- Downloadable GLB geometry; visual motion does not change production measurements.
- Well diagnostics with explicit rule-based evidence, source data and limitations.
- Export interruption planning using production, available evacuation capacity, free storage and duration. This includes a KTK/CPC-style constraint scenario but does not claim live access to pipeline nominations.
- Local action tracking. No work order is sent to an external service and no field equipment is controlled.
- Validated CSV snapshot import, preview, template and export.
- Local browser persistence for action cards. Imported measurement files are kept in memory for the current session.
- A worldwide OpenStreetMap well-record layer loaded on demand for the visible map area, plus the official BOEM/BSEE source for US federal offshore waters. Markers are selectable and retain source links and raw public metadata. Coverage is incomplete and does not represent live STRATUM assets.

## Data and calculations

Karatau Demonstration Field and its 24 wells are fictional. Simulated measurements are fixed and reproducible. This is not a Weatherford product, a certified digital twin, a calibrated engineering simulator or a validated predictive model.

The scenario engine uses a constant-rate mass balance:

`accumulation = max(0, production − available export capacity)`

`required storage = accumulation × interruption duration`

`required deferred volume = max(0, required storage − free working storage)`

Alternative plans conserve volume; they do not promise that particular well operating limits are safe. Engineering review is required for actual reductions and restarts. Reported reference shortfall is not necessarily recoverable production or permanent economic loss.

Imported snapshots receive no invented time series. Unknown operating context and timestamps remain unknown. Planned maintenance is identified explicitly in the demo dataset.

## Design

[Figma design file](https://www.figma.com/design/iMgsV2pTWxWXvKclLUyTik/STRATUM)

Figma contains editable foundations and four screens: Problem & Solution, Field Overview, Well Diagnostics, and Scenario Lab. The Starter plan tool quota blocked Action Center and Data Workspace. Final prototype navigation, a small copy reconciliation, and real 3D scene transfer also remain unfinished in Figma. Its field viewport currently contains a labeled native vector schematic.

The React application implements all six views and the interactive Three.js scene. The remaining Figma work does not block the local app. Exact node IDs, completed repairs, pending steps, and scripts are preserved in `design/state.json` and `design/README.md`.

## Source map

| File                | Responsibility                                                                  |
| ------------------- | ------------------------------------------------------------------------------- |
| `src/main.jsx`      | App shell, introduction, field overview, search, notifications, and 3D controls |
| `src/pages.jsx`     | Diagnostics, scenarios, review tasks, and CSV workspace                         |
| `src/domain.js`     | Reproducible demo data, thresholds, mass balance, and CSV validation            |
| `src/field3d.js`    | Three.js geometry, rendering, animation, selection, and GLB export              |
| `src/styles.css`    | Shared visual tokens, responsive layout, interaction, and reduced-motion styles |
| `src/Geography.jsx` | Worldwide reference map, public well-record inspector, and source boundaries    |
| `src/wellData.js`   | Bounded Overpass queries, result parsing, provenance, and viewport caching keys |

## Import format

One CSV row represents one well snapshot. Required fields are `id`, `oilBpd`, `baselineBpd`, `pressurePsi`, `pumpLoadPct`, and `waterCutPct`. `name`, `status`, `x`, and `z` are optional. The Data workspace provides a downloadable template and validates the entire file before it can replace the current session's measurements.

```csv
id,name,oilBpd,baselineBpd,pressurePsi,pumpLoadPct,waterCutPct
EX-001,Example well,500,600,1300,80,30
EX-002,Second example,420,450,1450,72,25
```

Rates use stock-tank oil barrels per day, pressure uses psi, and pump load/water cut use percentages from 0 to 100. Missing coordinates use an illustrative grid. Imported values do not receive simulated historical trends or a verified measurement timestamp. No CSV content is uploaded to a server.

## Verification

```sh
npm test
npm run build
```

`npm test` runs the domain suite and every `test/*.test.js` suite, including regression and server-rendered React integration checks. Coverage includes source provenance, zero-production handling, numeric overflow, imported text escaping, and scenario mass balance. Browser checks and their actual status are recorded in `docs/verification.md`.

`test/browser-smoke.mjs` is an optional developer harness with machine-specific Windows Chrome and Playwright paths. It is excluded from `npm test`. It creates and completes demo tasks, imports temporary test measurements, and writes downloads/screenshots to `artifacts/` in an isolated browser context. Adapt those paths before deliberately running it against a disposable local prototype session; its presence is not evidence that browser checks passed.

Source formatting uses the local Prettier development tool:

```sh
npm run format
npm run format:check
```

Formatting does not change scenario formulas or operating thresholds.

## Production work still required

Live historian/SCADA integrations, identity and role permissions, shared server-side storage, access logging, data quality monitoring, calibrated equipment models, reviewed operating envelopes, cybersecurity assessment and operator validation require a real deployment and authorized field data. The local prototype does not impersonate these capabilities.
