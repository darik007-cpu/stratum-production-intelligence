import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_WELLS,
  getPortfolio,
  detectAnomalies,
  getWellHistory,
  runScenario,
  parseCSV,
  validateWellCSV,
  exportCSV,
  exportWellsCSV,
} from "./domain.js";

test("seeded portfolio has 24 unique assets and separates planned outages", () => {
  assert.equal(DEMO_WELLS.length, 24);
  assert.equal(new Set(DEMO_WELLS.map((well) => well.id)).size, 24);
  const portfolio = getPortfolio();
  assert.equal(
    portfolio.totalOilBpd,
    DEMO_WELLS.reduce((sum, well) => sum + well.oilBpd, 0),
  );
  assert.equal(portfolio.activeWells, 23);
  assert.equal(
    portfolio.plannedOutageShortfallBpd,
    DEMO_WELLS.find((well) => well.status === "offline").baselineBpd,
  );
  assert.equal(
    portfolio.shortfallBpd,
    portfolio.unplannedShortfallBpd + portfolio.plannedOutageShortfallBpd,
  );
});

test("anomalies expose evidence and do not infer outage alerts or failure probabilities", () => {
  const alerts = detectAnomalies();
  assert.equal(alerts.length, 5);
  assert.ok(alerts.every((alert) => alert.evidence.length > 0));
  assert.ok(alerts.every((alert) => alert.wellId !== "KT-019"));
  assert.ok(alerts.every((alert) => !("probability" in alert)));
  assert.equal(detectAnomalies([]).length, 0);
});

test("history is deterministic, independent of selected window, and ends at the snapshot", () => {
  const short = getWellHistory("KT-007", 7);
  const long = getWellHistory("KT-007", 14);
  assert.deepEqual(short, long.slice(-7));
  assert.equal(
    short.at(-1).oilBpd,
    DEMO_WELLS.find((well) => well.id === "KT-007").oilBpd,
  );
  assert.deepEqual(getWellHistory("missing"), []);
  assert.deepEqual(
    getWellHistory({ id: "uploaded", dataMode: "imported" }),
    [],
  );
});

test("scenario conserves barrels and computes the required average reduction", () => {
  const scenario = runScenario({
    productionBpd: 10000,
    exportCapacityBpd: 6000,
    downtimeDays: 5,
    usableStorageBarrels: 12000,
  });
  assert.equal(scenario.valid, true);
  assert.equal(scenario.bufferDays, 3);
  assert.equal(scenario.requiredStorageBarrels, 20000);
  assert.equal(scenario.storageShortfallBarrels, 8000);
  assert.equal(scenario.curtailmentBpd, 1600);
  assert.equal(scenario.scenarioProductionBpd, 8400);
  assert.equal(scenario.plannedEndStorageBarrels, 12000);
  assert.equal(
    scenario.scenarioProductionBpd * scenario.downtimeDays,
    scenario.exportedBarrels + scenario.plannedEndStorageBarrels,
  );
  assert.equal(scenario.curtailedBarrels, 8000);
  assert.equal(scenario.timeline.at(-1).uncoveredBarrels, 8000);
  assert.equal(scenario.options[0].feasible, false);
});

test("scenario handles excess export, no storage, zero production and fractional days", () => {
  const surplus = runScenario({
    productionBpd: 1000,
    exportCapacityBpd: 2000,
    downtimeDays: 7,
    usableStorageBarrels: 500,
  });
  assert.equal(surplus.bufferDays, null);
  assert.equal(surplus.exportedBarrels, 7000);
  assert.equal(surplus.curtailmentBpd, 0);
  const noStorage = runScenario({
    productionBpd: 1000,
    exportCapacityBpd: 200,
    downtimeDays: 2.5,
    usableStorageBarrels: 0,
  });
  assert.equal(noStorage.bufferDays, 0);
  assert.equal(noStorage.scenarioProductionBpd, 200);
  assert.equal(noStorage.timeline.at(-1).day, 2.5);
  assert.equal(noStorage.timeline.at(-1).curtailedBarrels, 2000);
  const noProduction = runScenario({
    productionBpd: 0,
    exportCapacityBpd: 0,
    downtimeDays: 1,
    usableStorageBarrels: 0,
  });
  assert.equal(noProduction.curtailmentPct, 0);
  assert.equal(noProduction.status, "balanced");
});

test("scenario rejects impossible and non-finite inputs", () => {
  for (const input of [
    { downtimeDays: 0 },
    { downtimeDays: 366 },
    { usableStorageBarrels: -1 },
    { exportCapacityBpd: Infinity },
    { productionBpd: NaN },
  ]) {
    assert.equal(runScenario(input).valid, false);
  }
});

test("CSV parser handles quoted commas, escaped quotes, multiline values, BOM and CRLF", () => {
  const csv =
    '\uFEFFid,name,note\r\n1,"Well, West","He said ""ready"""\r\n2,South,"line one\nline two"\r\n';
  const result = parseCSV(csv);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].name, "Well, West");
  assert.equal(result.rows[0].note, 'He said "ready"');
  assert.equal(result.rows[1].note, "line one\nline two");
});

test("CSV rejects malformed quoting, row widths and duplicate headers", () => {
  for (const csv of [
    'a,b\n"broken,b',
    "a,b\n1,2,3",
    "a,a\n1,2",
    'a,b\n"ok"x,2',
  ]) {
    assert.ok(parseCSV(csv).errors.length > 0);
  }
});

test("demo export roundtrips without losing numeric values", () => {
  const result = validateWellCSV(exportWellsCSV());
  assert.deepEqual(result.errors, []);
  assert.equal(result.wells.length, 24);
  assert.equal(result.wells[6].oilBpd, DEMO_WELLS[6].oilBpd);
  assert.equal(result.wells[6].dataMode, "imported");
  assert.equal(
    getPortfolio(result.wells).totalOilBpd,
    getPortfolio().totalOilBpd,
  );
});

test("import rejects an entire invalid dataset and supports readable header aliases", () => {
  const header =
    "Well ID,Oil Bpd,Baseline Bpd,Pressure Psi,Pump Load Pct,Water Cut Pct";
  const valid = validateWellCSV(`${header}\nW-1,500,600,1300,80,30`);
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.wells[0].status, "warning");
  assert.ok(
    validateWellCSV(`${header}\nW-1,500,600,1300,101,30`).errors.length,
  );
  assert.equal(
    validateWellCSV(`${header}\nW-1,500,600,1300,80,30\nW-1,500,600,1300,80,30`)
      .wells.length,
    0,
  );
  assert.ok(
    validateWellCSV("id,oilBpd\nA,10").errors.some((error) =>
      error.includes("Missing required"),
    ),
  );
});

test("CSV exports quote values and prevent spreadsheet formula execution", () => {
  const result = parseCSV(
    exportCSV([{ name: '=HYPERLINK("x")', note: "a,b", delta: -2 }]),
  );
  assert.equal(result.rows[0].name, '\'=HYPERLINK("x")');
  assert.equal(result.rows[0].note, "a,b");
  assert.equal(result.rows[0].delta, "-2");
});

test("an explicit offline status still needs planning evidence to suppress a zero-production review", () => {
  const result = validateWellCSV(
    "id,status,oilBpd,baselineBpd,pressurePsi,pumpLoadPct,waterCutPct\nZERO,offline,0,0,0,0,0",
  );
  assert.deepEqual(result.errors, []);
  const [alert] = detectAnomalies(result.wells);
  assert.equal(alert.title, "No production recorded");
  assert.ok(
    alert.evidence.some((item) =>
      item.description.includes("no confirmed planned-outage"),
    ),
  );
  assert.equal(result.wells[0].plannedOutage, false);
  assert.equal(DEMO_WELLS.filter((well) => well.plannedOutage).length, 1);
});

test("portfolio timestamps reflect supplied measurements and not demonstration defaults", () => {
  assert.equal(getPortfolio([]).asOf, null);
  assert.equal(
    getPortfolio([{ ...DEMO_WELLS[0], lastUpdated: "2025-06-01T12:00:00Z" }])
      .asOf,
    "2025-06-01T12:00:00Z",
  );
});

test("derived overflow is rejected even when no storage accumulation occurs", () => {
  assert.equal(
    runScenario({
      productionBpd: 1e308,
      exportCapacityBpd: 1e308,
      downtimeDays: 365,
    }).valid,
    false,
  );
  assert.equal(
    runScenario({
      productionBpd: 1e-308,
      exportCapacityBpd: 0,
      usableStorageBarrels: 1e308,
    }).valid,
    false,
  );
  assert.ok(
    validateWellCSV(
      "id,oilBpd,baselineBpd,pressurePsi,pumpLoadPct,waterCutPct\nHUGE,1e308,1e-308,1000,50,10",
    ).errors.length > 0,
  );
});

test("import derives display severity from the same rules as anomaly detection", () => {
  const header =
    "id,status,oilBpd,baselineBpd,pressurePsi,pumpLoadPct,waterCutPct";
  const { wells, errors, warnings } = validateWellCSV(
    `${header}\nA-1,healthy,200,600,1300,95,30\nA-2,healthy,600,600,1300,60,65\nA-3,critical,600,600,1300,60,30\nA-4,offline,0,600,1300,0,30`,
  );
  assert.deepEqual(errors, []);
  assert.equal(wells[0].status, "critical");
  assert.equal(wells[0].sourceStatus, "healthy");
  assert.equal(wells[1].status, "warning");
  assert.equal(wells[2].status, "healthy");
  assert.equal(wells[3].status, "critical");
  assert.equal(wells[3].operatingStatus, "offline");
  assert.ok(
    warnings.some((warning) => warning.includes('supplied status "healthy"')),
  );
  const alerts = detectAnomalies(wells);
  for (const well of wells) {
    const alert = alerts.find((item) => item.wellId === well.id);
    assert.equal(well.status, alert?.severity ?? "healthy");
  }
  assert.equal(getPortfolio(wells).healthyCount, 1);
  assert.equal(getPortfolio(wells).criticalCount, 2);
  assert.equal(getPortfolio(wells).activeWells, 3);
  assert.equal(getPortfolio(wells).offlineCount, 1);
});

test("imported anomaly evidence identifies the supplied reference", () => {
  const { wells } = validateWellCSV(
    "id,oilBpd,baselineBpd,pressurePsi,pumpLoadPct,waterCutPct\nQA01,0,600,1300,80,30",
  );
  const [alert] = detectAnomalies(wells);
  assert.ok(
    alert.evidence.some(
      (item) => item.description === "100% below the supplied reference",
    ),
  );
  assert.ok(
    alert.evidence.every(
      (item) => !item.description.includes("demonstration reference"),
    ),
  );
  assert.match(alert.methodology, /supplied reference/);
});
