# STRATUM Figma build scripts

These scripts create an original English oilfield decision-support design. They are prepared for `use_figma`, so top-level `await` and `return` are intentional. Do not execute them as ordinary browser scripts.

The working React app is the complete interactive deliverable. Figma remains a partial editable companion because its Starter plan tool quota was exhausted. The app and its real Three.js scene work independently of Figma; completing the companion file is optional future work.

## Invocation

1. Complete Figma discovery in the chosen file. The parent agent has confirmed an empty file, Inter availability, and no compatible STRATUM component/token library.
2. For a new file only, submit the exact body of `01-foundations.js` through `use_figma`, with `skillNames: "figma-use,figma-generate-library"`. Save its JSON result under `foundations` in the local state ledger. For the existing file, reuse `design/state.json`; do not recreate its foundations.
3. Read `02-screens.js`. Replace the exact string `/*__FOUNDATIONS__*/ null` with the JSON object returned by step 2. Replace `/*__SCREENS__*/ null` with `["00"]`. Submit using `skillNames: "figma-use,figma-generate-design,figma-generate-library"`.
4. Repeat sequentially for `01`, `02`, `03`, `04`, `05`. Save every result outside Figma. Bounded calls keep ID ledgers small. Each call switches its page once.
5. Run `03-prototype.js` once all screens exist. It wires every sidebar item and supported primary navigation action.
6. Inspect all six final frames using screenshots. Check text bounds, intersections, and visual contrast. Apply targeted fixes in place and screenshot the changed composition once more.

For the current file, only screens `04` and `05` still need construction. `04-reconcile.js` applies the known copy changes to existing screens. Final prototype wiring and real 3D transfer have not been performed. Running a build script locally does not modify Figma; it must be submitted through an authorized `use_figma` session when tool access is available.

The scripts use deterministic names and skip existing complete screen wrappers. A failed partially constructed screen requires a targeted read and repair or removal of its exact returned frame ID; blindly rerunning will intentionally preserve the partial wrapper.

## Output

The foundation result contains `components`, `variables`, `styles`, `fonts`, collection IDs, and affected node IDs. Each screen result includes `frames`, bounds, `createdNodeIds`, editable text/instance counts, and `viewportSlots`.

| Key | Screen             | Purpose                                                                             |
| --- | ------------------ | ----------------------------------------------------------------------------------- |
| 00  | Problem & Solution | Editorial brief, product boundary, workflow, validation measures                    |
| 01  | Field Overview     | Metrics, large field surface, attention rail, production trend                      |
| 02  | Well Diagnostics   | SK-012 signals, evidence quality, bounded recommendation, review checks             |
| 03  | Scenario Lab       | Explicit capacity/duration/storage inputs, transparent inventory model, comparisons |
| 04  | Action Center      | Evidence-linked decisions, owners, statuses, decision history                       |
| 05  | Data Workspace     | CSV mapping concept, quality status, typed table preview, assumptions               |

All product screens are 1440 × 1000, on `STRATUM — Product`. The editable library and its specimen are on `STRATUM — Foundations`. Main components sit outside the foundations review frame.

| Current Figma asset | Exact ID | Status                                                                                  |
| ------------------- | -------- | --------------------------------------------------------------------------------------- |
| Foundations         | `3:2`    | Created; specimen screenshot pending                                                    |
| Problem & Solution  | `4:3`    | Created and visually inspected; old field/date copy awaits reconciliation               |
| Field Overview      | `6:247`  | Created and visually inspected; scene is a schematic                                    |
| Well Diagnostics    | `6:462`  | Created; chart corrected after its screenshot, so post-fix visual check remains pending |
| Scenario Lab        | `7:119`  | Created and visually inspected; one assumption sentence awaits reconciliation           |
| Action Center       | —        | Script prepared; not created in Figma                                                   |
| Data Workspace      | —        | Script prepared; not created in Figma                                                   |

The current Figma navigation includes only a few links created as screens became available. It is not a complete clickable prototype. All six routes are implemented in the local app.

## Real 3D scene integration

The Overview result returns a `viewportSlots` entry with a content frame ID, its native vector schematic ID, and dimensions **808 × 324**. This is a discrete content asset, surrounded by editable semantic UI.

The native isometric illustration is labeled **SCHEMATIC FIELD VIEW**. If a genuine render of the working Three.js scene is transferred into Figma, replace only the schematic child inside `3D content zone`, and update the viewport header accordingly. Preserve the editable navigation, labels, status rail, and chart. Do not flatten the complete interface into an image.

## Design system

- Inter typography: Display 52/58, Headline 28/36, Title 18/26, Body 14/22, Label 13/18, Caption 11/16, Metric 32/38, Small Metric 22/28.
- Hidden primitive palette; semantic aliases with property scopes and CSS syntax.
- Dark canvas `#081215`, panels `#102025`, border `#24373B`, text `#EDF5F0`, muted `#8FA4A6`, lime `#D5F87A`, cyan `#67D8E5`, amber `#F2BF75`.
- Reusable Button, Badge, Navigation and Input variant sets. Metric and editable SVG icon components. Text properties and navigation icon instance swaps remain editable.
- Auto-layout establishes related UI structure. The field schematic and chart plots are native SVG/vector content.

## Content honesty

Sarykum Field, wells, telemetry, people, and event data are fictional. Every screen carries the demo dataset label. No live control, established anomaly cause, platform superiority, or prediction accuracy is claimed.

The Scenario Lab now uses the working application's mass-balance example: production 11,905 bpd; export 8,500 bpd; event 7 days; free usable storage 20,000 bbl. Continuing production requires 23,835 bbl, exceeding the free buffer by 3,835 bbl. Spreading this reduction across seven days requires an average 547.86 bpd reduction (4.6%). Buffer-first switches to export capacity after 5.87 days. This is a planning calculation with constant rates, without a well-level optimizer or restart model.

Well Diagnostics uses the actual simulated `getWellHistory('KT-012')` series, normalized to the 431 bpd production reference and 1,616 psi pressure reference. The latest values are 293 bpd, 1,390 psi, and 91% pump load. Data Workspace uses the actual snapshot CSV schema, without claiming uploaded snapshots contain historical time series.

## Validation status

Figma foundations and screens 00–03 exist in file `iMgsV2pTWxWXvKclLUyTik`. Screens 00, 01, 02, and 03 were inspected at 1440 px. The diagnostic plot was then corrected to match domain history; its post-fix screenshot remains pending. A text-engine issue was corrected: `TextNode.resize()` resets `textAutoResize` to `NONE`, so helpers now reapply `HEIGHT` after sizing.

The Figma Starter plan tool limit blocked creation of screen 04. Screens 04–05, final prototype wiring, the copy alignment patch in `04-reconcile.js`, and real 3D content integration remain pending. `design/state.json` holds exact created IDs, repair ledgers, the blocker, and pending work. Do not recreate foundations or screen wrappers.
