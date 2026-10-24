# STRATUM verification record

This record separates executable checks, source review, and browser observations. It verifies a local decision-support prototype; it does not validate petroleum engineering models or a production deployment.

## Industrial redesign — 24 October 2026

The former shared ivory/editorial template was replaced by a dark petrol engineering workspace with amber controls, compact technical readouts and a desktop module rail. The overview combines a field model with an adjacent well inspector. Regional geography opens on the Caspian and uses a separate terrain/context console, distinct from banking's city directory.

Root inspected the actual interface at approximately 860 and 1265 pixels wide through CUA. A visual check found a collapsed 3D container after the layout change; explicit container sizing corrected it. A subsequent browser reload rendered the actual field, and the 1.8× pump-motion and 0.6 layer-separation controls worked, selecting the subsurface view. Evidence: `artifacts/stratum-industrial-overview.png` and `artifacts/stratum-industrial-map.png`.

Independent review also identified an imported-history label and suppressed search focus indicators; both were corrected in source. The historical checks below refer to earlier interfaces unless explicitly stated otherwise.

Root then imported an 81-well test snapshot through the actual CSV form. The overview showed `SNAPSHOT ONLY`; selecting QA-081 retained it in the inspector and displayed both the visible and accessible notice that the asset was outside the 80-object scene and no visible well was highlighted. Demonstration data was restored after the check. Two regression tests also exercise the real selection routine without a GPU. The suite now contains 35 passing oil tests after adding the public well-data checks.

## Automated checks

The final integrated sources were checked with the complete package test command:

```sh
npm test
```

**Result: 35 tests passed, 0 failed.**

The final oil application also passed `npm run build` after source formatting. Vite emitted the production bundle successfully; its Three.js chunk is 586.17 kB before gzip, triggering the standard 500 kB chunk advisory. This is a bundle-size warning, not a failed build.

| Suite                          | Tests | Evidence covered                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain.test.js`           |    16 | Seeded portfolio, explicit planned outages, evidence-based alerts, deterministic demo history, scenario arithmetic and edge cases, malformed/quoted CSV, import validation, formula escaping, source timestamps, overflow rejection, consistent imported review classification, and correct reference provenance in imported anomaly evidence. |
| `test/review.test.js`          |     6 | Independent regressions for unknown zero production, unsupported decline claims, invented timestamps, nonfinite derived results, overflowing aggregates, and a 192-case constant-rate mass-balance sweep.                                                                                                                                      |
| `test/integration.test.js`     |     5 | Actual React server rendering of imported diagnostics, maintenance distinction, zero-production scenarios, action records, and data provenance. Includes escaping HTML-like asset names and task text.                                                                                                                                         |
| `test/model-selection.test.js` |     2 | Executes the actual scene selection routine to verify clearing stale highlights for absent assets, selecting a later visible asset, and clearing selection without announcing a nonexistent asset.                                                                                                                                             |
| `test/well-data.test.js`       |     6 | Bounded point queries, source provenance, missing-field handling, viewport caching, invalid bounds, BOEM coverage selection, and official record parsing.                                                                                                                                                                                      |

The React tests execute the real page components. They do not exercise DOM events, WebGL, focus behavior, responsive layout, file downloads, or browser persistence.

## Earlier editorial interface

The earlier interface replaced the permanent sidebar with a centered masthead and visible horizontal chapter navigation. The opening page and overview used full-width interactive 3D stages; the overview continued with an instrument strip and ranked review table. This design has been superseded by the industrial interface described above.

The root agent inspected the redesigned opening page through CUA at approximately 860 pixels wide after its transition completed and confirmed that the full-width model, navigation and text rendered legibly. This observation covers that view, not every screen or interaction after the redesign. The 27 domain and React rendering tests passed after the layout changes. The build passed with `npm run build -- --configLoader native`; the native config loader avoided an environment-specific access failure in config bundling.

The redesigned scenario inputs were subsequently exercised in CUA: 8,500 bpd export capacity, 7 days and 20,000 bbl free storage produced the expected 3,835 bbl deficit, 548 bpd rounded average reduction and 5.9-day buffer. The opening-page screenshot is `artifacts/stratum-redesign.png`.

## Real geographic map

The root agent verified actual OpenStreetMap tiles in the redesigned Geography page, both at country scale and at the Atyrau city vicinity preset (47.106, 51.921; zoom 10). The map rendered city roads, the river and coast with visible OpenStreetMap attribution. Google Maps, Google satellite and OpenStreetMap links reflected the selected coordinates and zoom. The page reloaded successfully. Screenshot: `artifacts/stratum-real-map.png`.

An independent source review found no material issue in map lifecycle cleanup, keyboard focus, attribution or provider URL construction. The map now has an independent, manually requested OpenStreetMap layer for mapped petroleum-well point records in the visible viewport. Gulf of Mexico views use the official BOEM/BSEE federal offshore layer. Selecting a marker opens its source ID, available fields, coordinates and source link. Coverage is incomplete and source dependent; an empty response means no mapped records were returned. These public records are not connected to demonstration wells, customer locations, pipelines, operating boundaries or live telemetry.

Root loaded a Gulf of Mexico viewport in the actual browser at zoom 10. The BOEM/BSEE request returned 46 mapped records. Selecting the first result centered its map marker and opened API `608104006000`, status `Permanently Abandoned`, class `Exploratory`, source depth `1773`, coordinates and official layer link. Browser QA also found a global `svg { max-width: 100% }` rule collapsing Leaflet's custom SVG pane; the geography stylesheet now overrides that rule and the selected amber marker is visibly rendered. Wider OpenStreetMap Overpass requests reached the explicit 30-second error state in this environment, confirming failure isolation but not a successful live OSM response.

## Browser observations from the previous interface

The root agent performed these checks through the Codex in-app browser using `cua_repl` before the complete interface redesign. Observed viewport was approximately **860 × 662**. These remain a historical record of the preserved feature logic, not a claim that every redesigned control has been rechecked. They are recorded interactive observations, not a completed automated browser suite.

| Flow                        | Observed result                                                                                                                                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem and solution        | English introduction and an actual 3D field rendered.                                                                                                                                                                                                                   |
| Field overview              | 11,905 bpd current production; 1,421 bpd reference shortfall; 23 of 24 operating wells; 5 review alerts.                                                                                                                                                                |
| 3D controls                 | Pump motion 1.8×, layer separation 0.7, orbit 130°, and daylight 18 h were reflected by the controls; the cutaway was visibly rendered.                                                                                                                                 |
| KT-012 diagnostics          | 293 bpd against a 431 bpd reference; pressure 1,390 psi; pump load 91%; water cut 21%; simulated history and rule evidence displayed.                                                                                                                                   |
| Review workflow             | Task created and started. Completion was blocked without an outcome. Entering an outcome allowed completion. A complete browser reload retained both saved tasks and the completed outcome note.                                                                        |
| Search focus and navigation | Shift+Tab from the search input moved to the last result. Tab remained within the dialog, and Escape closed it and restored focus to the search trigger.                                                                                                                |
| Scenario calculation        | Export capacity 8,500 bpd, duration 7 days, free storage 20,000 bbl produced a 3,835 bbl planning deficit, approximately 548 bpd average reduction, and approximately 5.9 days of storage buffer.                                                                       |
| Scenario action             | Saving the scenario created an action containing the selected scenario values.                                                                                                                                                                                          |
| CSV validation              | Negative input was rejected; a valid two-well snapshot was previewed and applied.                                                                                                                                                                                       |
| Imported zero production    | QA-01 received a critical review state despite a supplied `healthy` status.                                                                                                                                                                                             |
| Imported provenance         | No historical measurements were shown; the UI stated that the measurement timestamp was not provided.                                                                                                                                                                   |
| GLB export                  | Clicking the export control in the UI produced `stratum-karatau-demo.glb`. The file has `glTF` magic, format version 2, and a declared length of 3,751,516 bytes matching the actual file length. Both root and independent reviewers checked the header.               |
| Browser diagnostics         | Later inspection of accumulated logs showed GLB material/light export warnings and a transient stylesheet reload failure during editing. These are not evidence of a clean console across the entire session. The final build passed and the map reloaded successfully. |

Earlier screenshots include `artifacts/stratum-overview.png` and `artifacts/review-brief.png`; these depict the previous interface. The exported model is `artifacts/stratum-karatau-demo.glb`. Screenshots provide visual evidence of their specific pages, not proof that every interaction passed.

The CUA download-event wait did not return successfully, but a direct UI export click completed and the downloaded file was subsequently verified. This is evidence of the export result, not a claim that the event-wait mechanism passed.

### Not claimed as tested

- A mobile viewport or physical touch device.
- Operating-system reduced-motion behavior.
- Screen-reader behavior or a complete accessibility audit.
- Browser storage denial/quota exhaustion.
- Performance of the full 5,000-row import limit. The 3D view displays a labelled subset of at most 80 wells.
- GLB roundtrip through a separate 3D editor, rendering engine, or full glTF conformance validator. Only export completion and the binary container header/length were verified.
- Live sensor, Weatherford, pipeline, identity, or external work-order integrations.

The old prepared browser script was archived outside executable tests as `docs/archive/browser-smoke-legacy.mjs.txt`. It contains selectors and paths for the previous interface. Its run stopped after the introductory-page check when UI automation moved to CUA. **The complete script never passed and is not included in the automated test result.** Use the actual CUA observation record above; the archived script is historical source material, not current browser verification.

## Issues addressed during independent review

- Unknown zero-production snapshots are no longer treated as proven planned outages.
- High pump load alone no longer asserts a production decline.
- Imported snapshots no longer inherit the demonstration measurement timestamp or simulated history.
- Scenario calculations and imported aggregate totals reject nonfinite derived results.
- Imported display severity and anomaly severity share the same rules; original supplied status is retained separately.
- Zero-output wells no longer emit animated flow particles.
- The problem explanation retains the fictional demonstration field after another dataset is imported.
- Layer-separation changes explicitly select the matching subsurface view.
- Search keyboard focus containment and restoration were verified in the browser.
- The redesign uses visible scrollable chapter navigation on mobile instead of a hidden sidebar. Keyboard focus styles and the search focus trap remain in place; no physical mobile device or screen-reader validation is claimed.
- Chart point titles are single text strings, and the conservation equation labels curtailed volume as part of baseline potential volume.
- Storage write failures retain in-memory tasks, show a persistent session-only notice, and avoid a contradictory success toast. This failure path was reviewed in source; browser storage denial remains untested.

## Scope and remaining deployment work

All asset geometry and demonstration measurements are illustrative. The rule engine does not establish a confirmed cause or a failure probability. The scenario engine conserves a common oil-barrel basis under constant rates; it excludes reservoir constraints, minimum stable rates, restart limits, fluids other than oil, transport losses, and contract/route availability. An engineer must validate any operational interpretation.

Action records use browser storage and imported snapshots remain in memory for the session. Shared authenticated storage, immutable audit history, secure integration credentials, operator-specific thresholds, production monitoring, and independent engineering validation remain deployment work.
