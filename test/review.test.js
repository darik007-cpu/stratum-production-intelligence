import test from "node:test";
import assert from "node:assert/strict";
import {
  validateWellCSV,
  detectAnomalies,
  getPortfolio,
  runScenario,
} from "../src/domain.js";

const headers = "id,oilBpd,baselineBpd,pressurePsi,pumpLoadPct,waterCutPct";

test("an imported zero-production snapshot is not evidence of a planned outage", () => {
  const { wells, errors } = validateWellCSV(`${headers}\nZ-1,0,600,1300,80,30`);
  assert.deepEqual(errors, []);
  assert.equal(getPortfolio(wells).plannedOutageShortfallBpd, 0);
  assert.equal(getPortfolio(wells).unplannedShortfallBpd, 600);
  assert.ok(detectAnomalies(wells).some((alert) => alert.wellId === "Z-1"));
});

test("high pump load above the production reference does not claim a production decline", () => {
  const { wells } = validateWellCSV(`${headers}\nL-1,700,600,1300,95,30`);
  const [alert] = detectAnomalies(wells);
  assert.ok(alert);
  assert.ok(!/decline|falling|below/i.test(alert.title));
  assert.equal(alert.shortfallBpd, 0);
});

test("imported snapshots have no asserted measurement timestamp", () => {
  const { wells } = validateWellCSV(`${headers}\nL-1,700,600,1300,95,30`);
  assert.equal(getPortfolio(wells).asOf, null);
});

test("scenario rejects finite inputs when their calculated volumes overflow", () => {
  const scenario = runScenario({
    productionBpd: 1e308,
    exportCapacityBpd: 0,
    downtimeDays: 365,
  });
  assert.equal(scenario.valid, false);
  assert.ok(scenario.errors.length > 0);
});

test("an import must not produce nonfinite portfolio totals from finite rows", () => {
  const result = validateWellCSV(
    `${headers}\nB-1,1e308,1e308,1300,80,30\nB-2,1e308,1e308,1300,80,30`,
  );
  assert.ok(result.errors.length > 0);
  assert.deepEqual(result.wells, []);
});

test("constant-rate scenario conserves volume across a range of rates and fractional durations", () => {
  for (const productionBpd of [0, 1, 500.5, 12345]) {
    for (const exportCapacityBpd of [0, 100, 10000, 50000]) {
      for (const downtimeDays of [0.5, 1, 2.5, 31]) {
        for (const usableStorageBarrels of [0, 1, 10000]) {
          const s = runScenario({
            productionBpd,
            exportCapacityBpd,
            downtimeDays,
            usableStorageBarrels,
          });
          assert.equal(s.valid, true);
          assert.ok(s.scenarioProductionBpd >= -1e-8);
          assert.ok(s.plannedEndStorageBarrels <= usableStorageBarrels + 1e-8);
          const initialVolume = productionBpd * downtimeDays;
          const accountedVolume =
            s.exportedBarrels + s.plannedEndStorageBarrels + s.curtailedBarrels;
          assert.ok(Math.abs(initialVolume - accountedVolume) < 1e-7);
        }
      }
    }
  }
});
