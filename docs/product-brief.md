# STRATUM — Production decisions, made clear

## The problem

A production engineer needs to find which wells deserve attention, establish what the available measurements actually show, compare possible responses, and record the result. Measurements spread across tables and charts can make this slow. A fall in production is observable; a confirmed cause or a recoverable volume requires further evidence. Export constraints can introduce a separate planning problem when available storage fills faster than oil can leave the field.

STRATUM is an independent decision-support prototype designed around that workflow. It does not claim that a named competitor lacks these capabilities. The first target is an engineer reviewing a small or medium portfolio of oil wells. The prototype uses a fictional western Kazakhstan field with 24 simulated wells. The name, positions, measurements, events and thresholds are demonstrative and do not describe an actual operating asset.

## The product promise

Make the next useful engineering review understandable: show the affected asset, measured deviation, supporting evidence, available next steps and an accountable decision record. Keep data provenance visible. Make spatial orientation useful through an interactive 3D field view while retaining readable tables and charts.

## Observe → explain → compare → review → record

1. **Observe.** Review oil production against a stated reference, distinguish scheduled outages from unexplained deviations, and locate a well in the 3D field. Filter the portfolio and open an asset without losing context.
2. **Explain.** Show deterministic alert rules and measurements behind each flag. Present possible explanations as hypotheses. Separate missing data from normal readings. The prototype estimates no failure probabilities.
3. **Compare.** Change export capacity, interruption duration and free usable oil storage to compare mass-balance scenarios. Display when storage headroom is exhausted and the average production reduction needed to remain within it. This does not allocate reductions safely to individual wells.
4. **Review.** Create a local task and move it through review, in-progress and completed states. Attach an outcome note before completion. The prototype has no authenticated reviewer identity or external approval chain, and its records do not operate field equipment.
5. **Record.** Keep the confirmed findings and observed outcome in the task note. The prototype does not automatically attribute a production improvement to that task. Imported snapshots cannot establish historical improvements; demonstration histories remain explicitly simulated.

## First-version feature boundary

- English interface, independently designed visual language and interactive 3D well/field models.
- Searchable 24-well portfolio with linked asset detail, sensor trends and events.
- Evidence-based review queue using transparent demonstration thresholds.
- Storage/export scenario calculator with consistent units and reproducible calculations.
- CSV snapshot import with validation and safe CSV export.
- Review/action states stored locally in the browser where implemented by the application.
- Visible data-source and simulation status throughout the interface.

## Quantitative method

All oil quantities use one common stock-tank barrel basis. Production and total available export capacity are constant during the chosen interruption. Storage means **free usable working headroom**, not tank nameplate volume or current inventory.

- Accumulation per day = max(0, production − available export capacity).
- Required headroom = accumulation per day × interruption days.
- Buffer duration = free usable headroom ÷ accumulation per day, or unlimited when there is no accumulation.
- Uncovered volume = max(0, required headroom − free usable headroom).
- Average production reduction over the interruption = uncovered volume ÷ interruption days.

Uncovered volume is a planning deficit; the UI must not imply the site physically allows tanks to overflow. The smooth reduction and buffer-first alternatives have the same total curtailed volume under these simplified assumptions. Neither is automatically the operationally preferred plan.

## What is required before production use

Validated measurement provenance and freshness; operator-specific thresholds; well-test reconciliation; pressure and fluid models; minimum stable rates; start/stop and restart limits; reservoir constraints; confirmed route availability and contracts; independently checked storage inventories; multi-phase handling; secure integrations with historian and operations systems; authenticated roles and an immutable audit trail; evaluated false-alert rates; operator review of all recommendations. This prototype has no real-time Weatherford, KTK, SCADA or field connection and performs no automatic control.

## Evidence to evaluate a pilot

Use historical data and engineer-labeled events to measure time to locate the relevant evidence, time to choose the next review step, useful-alert proportion, missed material events and correctness of scenario calculations. Measure adoption and usability with engineers on representative tasks. Production gains should only be attributed after accounting for operating changes, outages and reference uncertainty.

## Data API

`src/domain.js` exports `DEMO_FIELD`, `DEMO_WELLS`, `getPortfolio(wells)`, `detectAnomalies(wells)`, `getWellHistory(wellId, days)`, `runScenario(inputs)`, `parseCSV(text)`, `validateWellCSV(text)`, `exportCSV(rows, columns)` and `exportWellsCSV(wells)`.

CSV required columns: `id`, `oilBpd`, `baselineBpd`, `pressurePsi`, `pumpLoadPct`, `waterCutPct`. Optional: `name`, `status`, `x`, `z`. Status values: `healthy`, `warning`, `critical`, `offline`. Missing spatial coordinates use a labelled illustrative grid. A CSV is a snapshot; it does not supply sensor history or a verified measurement timestamp.
