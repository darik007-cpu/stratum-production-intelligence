/**
 * STRATUM demonstration domain. Every well and measurement is simulated.
 * No live connection, predictive model, or automatic equipment control exists.
 * Units: stock-tank barrels/day (bpd), barrels, psi, percent, and days.
 */

export const DEMO_FIELD = Object.freeze({
  id: "karatau-demo",
  name: "Karatau Demonstration Field",
  region: "Western Kazakhstan · fictional field",
  operator: "STRATUM Demo Operations",
  timeZone: "Asia/Qyzylorda",
  asOf: "2026-10-23T07:00:00+05:00",
  dataMode: "simulated",
  disclosure:
    "Simulated data · fictional assets · decision-support demonstration",
  units: { oil: "bpd", pressure: "psi", storage: "bbl" },
});

const round = (value, precision = 1) => Number(value.toFixed(precision));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function seededRandom(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let result = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    result =
      (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

const specialWells = {
  3: {
    status: "warning",
    productionFactor: 0.79,
    pumpLoadPct: 84,
    issue: "Production below reference",
  },
  7: {
    status: "critical",
    productionFactor: 0.59,
    pumpLoadPct: 94,
    issue: "High pump load and falling production",
  },
  12: {
    status: "critical",
    productionFactor: 0.68,
    pumpLoadPct: 91,
    issue: "High pump load and falling production",
  },
  15: {
    status: "warning",
    productionFactor: 0.83,
    pumpLoadPct: 79,
    waterCutPct: 63,
    issue: "Elevated water cut",
  },
  19: {
    status: "offline",
    productionFactor: 0,
    pumpLoadPct: 0,
    issue: "Scheduled maintenance",
  },
  22: {
    status: "warning",
    productionFactor: 0.8,
    pumpLoadPct: 82,
    issue: "Production below reference",
  },
};

function buildDemoWells() {
  const random = seededRandom(10232026);
  return Array.from({ length: 24 }, (_, index) => {
    const number = index + 1;
    const special = specialWells[number];
    const baselineBpd = Math.round(350 + random() * 420);
    const referencePressurePsi = Math.round(1180 + random() * 520);
    const x = (index % 6) * 17 - 43 + random() * 5;
    const z = Math.floor(index / 6) * 22 - 33 + random() * 6;
    const status = special?.status ?? "healthy";
    const well = {
      id: `KT-${String(number).padStart(3, "0")}`,
      name: `Well ${String(number).padStart(2, "0")}`,
      number,
      field: DEMO_FIELD.name,
      zone: ["North", "Central", "East", "South"][Math.floor(index / 6)],
      status,
      plannedOutage: number === 19,
      operatingStatus: status === "offline" ? "offline" : "producing",
      liftType: number % 5 === 0 ? "Rod pump" : "ESP",
      x: round(x, 2),
      z: round(z, 2),
      coordinates: {
        x: round(x, 2),
        z: round(z, 2),
        lat: round(46.92 + z * 0.0006, 5),
        lng: round(52.24 + x * 0.0008, 5),
      },
      baselineBpd,
      oilBpd: Math.round(
        baselineBpd * (special?.productionFactor ?? 0.96 + random() * 0.075),
      ),
      pressurePsi: Math.round(
        referencePressurePsi *
          (status === "critical" ? 0.86 : 0.98 + random() * 0.04),
      ),
      referencePressurePsi,
      pumpLoadPct: special?.pumpLoadPct ?? Math.round(59 + random() * 19),
      waterCutPct: special?.waterCutPct ?? Math.round(17 + random() * 27),
      temperatureC: Math.round(52 + random() * 18),
      depthM: Math.round(1800 + random() * 700),
      lastUpdated: DEMO_FIELD.asOf,
      dataMode: "simulated",
      issue: special?.issue ?? "Within demonstration thresholds",
    };
    well.shortfallBpd = Math.max(0, well.baselineBpd - well.oilBpd);
    well.deviationPct = round(
      ((well.oilBpd - well.baselineBpd) / well.baselineBpd) * 100,
    );
    well.events =
      status === "healthy"
        ? [
            {
              id: `${well.id}-review`,
              timestamp: "2026-10-22T09:30:00+05:00",
              type: "inspection",
              title: "Routine review completed",
              detail: "Demonstration event. No field activity occurred.",
            },
          ]
        : [
            {
              id: `${well.id}-event`,
              timestamp: "2026-10-23T06:20:00+05:00",
              type: status === "offline" ? "maintenance" : "alert",
              title: well.issue,
              detail:
                status === "offline"
                  ? "Simulated planned outage. Treat separately from unexplained production loss."
                  : "Demonstration threshold exceeded. Engineering review required.",
            },
            {
              id: `${well.id}-review`,
              timestamp: "2026-10-22T15:00:00+05:00",
              type: "review",
              title: "Trend review recorded",
              detail: "Simulated event included to illustrate an audit trail.",
            },
          ];
    return well;
  });
}

export const DEMO_WELLS = buildDemoWells();

/** Aggregate a supplied well set. Reference shortfall is not a proven recoverable loss. */
export function getPortfolio(wells = DEMO_WELLS) {
  const totalOilBpd = wells.reduce((sum, well) => sum + well.oilBpd, 0);
  const totalBaselineBpd = wells.reduce(
    (sum, well) => sum + well.baselineBpd,
    0,
  );
  const statusCounts = { healthy: 0, warning: 0, critical: 0, offline: 0 };
  wells.forEach((well) => {
    statusCounts[well.status] = (statusCounts[well.status] ?? 0) + 1;
  });
  const shortfallBpd = wells.reduce(
    (sum, well) => sum + Math.max(0, well.baselineBpd - well.oilBpd),
    0,
  );
  const unplannedShortfallBpd = wells
    .filter((well) => well.plannedOutage !== true)
    .reduce(
      (sum, well) => sum + Math.max(0, well.baselineBpd - well.oilBpd),
      0,
    );
  const datedWells = wells.filter(
    (well) =>
      typeof well.lastUpdated === "string" &&
      Number.isFinite(Date.parse(well.lastUpdated)),
  );
  const mostRecentMeasurement = datedWells.reduce(
    (latest, well) =>
      !latest || Date.parse(well.lastUpdated) > Date.parse(latest)
        ? well.lastUpdated
        : latest,
    null,
  );
  const activeWells = wells.filter((well) =>
    well.operatingStatus
      ? well.operatingStatus === "producing"
      : well.status !== "offline" && well.oilBpd > 0,
  ).length;
  return {
    wellCount: wells.length,
    totalWells: wells.length,
    activeWells,
    totalOilBpd,
    productionBpd: totalOilBpd,
    totalBaselineBpd,
    baselineBpd: totalBaselineBpd,
    shortfallBpd,
    unplannedShortfallBpd,
    plannedOutageShortfallBpd: shortfallBpd - unplannedShortfallBpd,
    deviationPct:
      totalBaselineBpd > 0
        ? round((totalOilBpd / totalBaselineBpd - 1) * 100)
        : 0,
    attainmentPct:
      totalBaselineBpd > 0 ? round((totalOilBpd / totalBaselineBpd) * 100) : 0,
    statusCounts,
    healthyCount: statusCounts.healthy,
    warningCount: statusCounts.warning,
    criticalCount: statusCounts.critical,
    offlineCount: wells.length - activeWells,
    operatingStatusCounts: {
      producing: activeWells,
      offline: wells.length - activeWells,
    },
    averageWaterCutPct: wells.length
      ? round(
          wells.reduce((sum, well) => sum + well.waterCutPct, 0) / wells.length,
        )
      : 0,
    dataMode: wells.every((well) => well.dataMode === "simulated")
      ? "simulated"
      : "imported",
    asOf: mostRecentMeasurement,
  };
}

// Shared by import classification and alert creation so map/table state cannot
// diverge from the actual review rules. Operating state is a separate property.
function getReviewSignals(well) {
  const dropPct =
    well.baselineBpd > 0 ? (1 - well.oilBpd / well.baselineBpd) * 100 : 0;
  const highLoad = well.pumpLoadPct >= 88;
  const highWater = well.waterCutPct >= 60;
  const lowProduction = dropPct >= 15;
  const zeroProduction = well.oilBpd === 0;
  const severity =
    well.plannedOutage === true
      ? "healthy"
      : highLoad || zeroProduction
        ? "critical"
        : highWater || lowProduction
          ? "warning"
          : "healthy";
  return {
    dropPct,
    highLoad,
    highWater,
    lowProduction,
    zeroProduction,
    severity,
  };
}

/** Transparent rules, not ML predictions. One review item per affected well. */
export function detectAnomalies(wells = DEMO_WELLS) {
  return wells
    .flatMap((well) => {
      const {
        dropPct,
        highLoad,
        highWater,
        lowProduction,
        zeroProduction,
        severity,
      } = getReviewSignals(well);
      if (severity === "healthy") return [];
      const evidence = [];
      const referenceLabel =
        well.dataMode === "simulated"
          ? "demonstration reference"
          : "supplied reference";
      if (lowProduction)
        evidence.push({
          metric: "Oil production",
          value: well.oilBpd,
          reference: well.baselineBpd,
          unit: "bpd",
          description: `${round(dropPct)}% below the ${referenceLabel}`,
        });
      if (highLoad)
        evidence.push({
          metric: "Pump load",
          value: well.pumpLoadPct,
          reference: 88,
          unit: "%",
          description: "At or above the prototype review threshold of 88%",
        });
      if (highWater)
        evidence.push({
          metric: "Water cut",
          value: well.waterCutPct,
          reference: 60,
          unit: "%",
          description: "At or above the prototype review threshold of 60%",
        });
      if (zeroProduction)
        evidence.push({
          metric: "Recorded oil production",
          value: 0,
          reference: well.baselineBpd,
          unit: "bpd",
          description:
            "No production recorded; no confirmed planned-outage record is available",
        });
      const title = highLoad
        ? lowProduction
          ? "High pump load with production decline"
          : "High pump load"
        : zeroProduction
          ? "No production recorded"
          : highWater
            ? "Elevated water cut"
            : "Production below reference";
      const recommendation = highLoad
        ? "Validate the pump-load sensor and review recent operating changes with an engineer."
        : zeroProduction
          ? "Verify measurement availability and confirm whether the well is shut in, experiencing an outage, or undergoing planned work."
          : highWater
            ? "Confirm the water-cut measurement and compare with recent well-test results."
            : "Validate production measurements, inspect recent events, and review the operating trend.";
      return [
        {
          id: `alert-${well.id}`,
          wellId: well.id,
          wellName: well.name,
          severity,
          priority: severity === "critical" ? 1 : 2,
          category: highLoad
            ? "Pump performance"
            : highWater
              ? "Fluid composition"
              : "Production variance",
          title,
          message: `${well.id}: ${title.toLowerCase()}. Review the supporting measurements.`,
          summary: `${well.id} produces ${well.oilBpd} bpd against a ${well.baselineBpd} bpd reference. Review the supporting measurements before assigning a cause.`,
          shortfallBpd: Math.max(0, well.baselineBpd - well.oilBpd),
          impactBpd: Math.max(0, well.baselineBpd - well.oilBpd),
          oilLossBpd: Math.max(0, well.baselineBpd - well.oilBpd),
          deviationPct: round(-dropPct),
          evidence: evidence.map((item) => ({
            ...item,
            label: item.metric,
            observed: `${item.value} ${item.unit}`,
          })),
          possibleCause: highLoad
            ? "An operating change or pump restriction may explain this pattern; the measurements alone do not establish a cause."
            : highWater
              ? "A change in fluid composition or measurement error may explain this pattern."
              : "An operating change, planned activity, or measurement error may explain this pattern.",
          recommendation,
          recommendedAction: recommendation,
          nextSteps: [
            recommendation,
            "Record the confirmed cause and the approved action.",
            "Compare the measured result with the pre-action reference.",
          ],
          methodology: `Deterministic prototype thresholds using the ${referenceLabel}. No failure probability is estimated.`,
          timestamp: well.lastUpdated,
          status: "open",
          dataMode: well.dataMode ?? "imported",
        },
      ];
    })
    .sort((a, b) => a.priority - b.priority || b.shortfallBpd - a.shortfallBpd);
}

/** Stable daily demo history ending at the demo timestamp. Unknown IDs return []. */
export function getWellHistory(wellId, days = 14) {
  const well =
    typeof wellId === "object" && wellId !== null
      ? wellId
      : DEMO_WELLS.find((item) => item.id === wellId);
  if (!well) return [];
  // Uploaded snapshots cannot establish a historical time series.
  if (well.dataMode !== "simulated") return [];
  const count = clamp(Math.floor(Number(days) || 14), 1, 90);
  const wellSeed =
    [...well.id].reduce((seed, char) => seed * 31 + char.charCodeAt(0), 13) >>>
    0;
  return Array.from({ length: count }, (_, index) => {
    const age = count - index - 1;
    const random = seededRandom((wellSeed + age * 9739) >>> 0);
    const date = new Date("2026-10-23T02:00:00Z");
    date.setUTCDate(date.getUTCDate() - age);
    const incidentProgress = Math.max(0, 1 - age / 5);
    const shortfall = well.baselineBpd - well.oilBpd;
    const oilBpd =
      age === 0
        ? well.oilBpd
        : Math.max(
            0,
            Math.round(
              well.baselineBpd -
                shortfall * incidentProgress +
                (random() - 0.5) * 24,
            ),
          );
    return {
      timestamp: date.toISOString(),
      date: date.toISOString().slice(0, 10),
      label: `${date.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()]}`,
      oilBpd,
      baselineBpd: well.baselineBpd,
      pressurePsi:
        age === 0
          ? well.pressurePsi
          : Math.round(
              well.referencePressurePsi +
                (well.pressurePsi - well.referencePressurePsi) *
                  incidentProgress +
                (random() - 0.5) * 20,
            ),
      pumpLoadPct:
        age === 0
          ? well.pumpLoadPct
          : round(
              68 +
                (well.pumpLoadPct - 68) * incidentProgress +
                (random() - 0.5) * 4,
            ),
      waterCutPct:
        age === 0
          ? well.waterCutPct
          : round(
              well.waterCutPct -
                (well.waterCutPct > 50 ? (1 - incidentProgress) * 13 : 0) +
                (random() - 0.5) * 2,
            ),
      dataMode: "simulated",
    };
  });
}

/**
 * Constant-rate mass balance over an interruption. Capacity means available TOTAL
 * evacuation capacity (all routes), not a real-time KTK or pipeline measurement.
 * Usable storage is FREE working headroom, not gross tank size. Alternative-route
 * capacity is assumed already secured; this model does not claim routing access.
 */
export function runScenario(input = {}) {
  const defaults = getPortfolio(input.wells ?? DEMO_WELLS);
  const productionBpd = Number(input.productionBpd ?? defaults.totalOilBpd);
  const exportCapacityBpd = Number(input.exportCapacityBpd ?? productionBpd);
  const downtimeDays = Number(input.downtimeDays ?? 7);
  const usableStorageBarrels = Number(input.usableStorageBarrels ?? 50000);
  const errors = [];
  for (const [key, value] of Object.entries({
    productionBpd,
    exportCapacityBpd,
    downtimeDays,
    usableStorageBarrels,
  })) {
    if (!Number.isFinite(value)) errors.push(`${key} must be a finite number.`);
    else if (value < 0) errors.push(`${key} cannot be negative.`);
  }
  if (
    Number.isFinite(downtimeDays) &&
    (downtimeDays <= 0 || downtimeDays > 365)
  )
    errors.push("downtimeDays must be greater than 0 and no more than 365.");
  if (errors.length) return { valid: false, errors };
  const exportRateBpd = Math.min(productionBpd, exportCapacityBpd);
  const accumulationBpd = Math.max(0, productionBpd - exportCapacityBpd);
  const requiredStorageBarrels = accumulationBpd * downtimeDays;
  const storageShortfallBarrels = Math.max(
    0,
    requiredStorageBarrels - usableStorageBarrels,
  );
  const bufferDays =
    accumulationBpd > 0 ? usableStorageBarrels / accumulationBpd : null;
  const curtailmentBpd = storageShortfallBarrels / downtimeDays;
  const scenarioProductionBpd = productionBpd - curtailmentBpd;
  const plannedAccumulationBpd = Math.max(
    0,
    scenarioProductionBpd - exportCapacityBpd,
  );
  const exportedBarrels = exportRateBpd * downtimeDays;
  const plannedEndStorageBarrels = plannedAccumulationBpd * downtimeDays;
  const bufferHours = bufferDays === null ? null : bufferDays * 24;
  const curtailmentPct =
    productionBpd > 0 ? (curtailmentBpd / productionBpd) * 100 : 0;
  // Finite inputs can still overflow during multiplication or division.
  if (
    [
      requiredStorageBarrels,
      storageShortfallBarrels,
      curtailmentBpd,
      scenarioProductionBpd,
      plannedAccumulationBpd,
      exportedBarrels,
      plannedEndStorageBarrels,
      curtailmentPct,
      productionBpd * downtimeDays,
      ...(bufferDays === null ? [] : [bufferDays, bufferHours]),
    ].some((value) => !Number.isFinite(value))
  ) {
    return {
      valid: false,
      errors: [
        "The scenario exceeds the supported numeric range. Reduce the rates, volume, or duration.",
      ],
    };
  }
  const status =
    storageShortfallBarrels > 0
      ? "action-required"
      : accumulationBpd > 0
        ? "within-buffer"
        : "balanced";
  const timeline = Array.from(
    { length: Math.ceil(downtimeDays) + 1 },
    (_, index) => {
      const day = Math.min(index, downtimeDays);
      const required = accumulationBpd * day;
      return {
        day,
        requiredStorageBarrels: required,
        occupiedHeadroomBarrels: Math.min(usableStorageBarrels, required),
        uncoveredBarrels: Math.max(0, required - usableStorageBarrels),
        plannedStorageBarrels: plannedAccumulationBpd * day,
        availableHeadroomBarrels: Math.max(
          0,
          usableStorageBarrels - plannedAccumulationBpd * day,
        ),
        curtailedBarrels: curtailmentBpd * day,
      };
    },
  );
  return {
    valid: true,
    errors: [],
    productionBpd,
    exportCapacityBpd,
    exportRateBpd,
    downtimeDays,
    usableStorageBarrels,
    accumulationBpd,
    requiredStorageBarrels,
    storageShortfallBarrels,
    bufferDays,
    bufferHours,
    daysUntilFull: bufferDays,
    curtailmentBpd,
    curtailmentPct,
    curtailedBarrels: storageShortfallBarrels,
    scenarioProductionBpd,
    plannedEndStorageBarrels,
    remainingStorageBarrels: Math.max(
      0,
      usableStorageBarrels - plannedEndStorageBarrels,
    ),
    exportedBarrels,
    status,
    feasibleWithoutCurtailment: storageShortfallBarrels === 0,
    timeline,
    options: [
      {
        id: "hold",
        title: "Maintain current production",
        productionBpd,
        curtailedBarrels: 0,
        requiredStorageBarrels,
        storageShortfallBarrels,
        feasible: storageShortfallBarrels === 0,
      },
      {
        id: "smooth",
        title: "Spread the required reduction across the interruption",
        productionBpd: scenarioProductionBpd,
        curtailmentBpd,
        curtailedBarrels: storageShortfallBarrels,
        requiredStorageBarrels: plannedAccumulationBpd * downtimeDays,
        storageShortfallBarrels: 0,
        feasible: true,
      },
      {
        id: "buffer-first",
        title: "Use the buffer, then match available export capacity",
        productionBeforeBufferBpd: productionBpd,
        productionAfterBufferBpd: exportRateBpd,
        switchAtDay: bufferDays,
        curtailedBarrels: storageShortfallBarrels,
        requiredStorageBarrels: Math.min(
          requiredStorageBarrels,
          usableStorageBarrels,
        ),
        storageShortfallBarrels: 0,
        feasible: true,
      },
    ],
    assumptions: [
      "Production and available export capacity remain constant during the interruption.",
      "Storage input represents free usable headroom; current inventory is already excluded.",
      "All quantities use the same stock-tank oil barrel basis. Water, gas, blending, and transport losses are excluded.",
      "Start/stop limits, minimum stable rates, restart costs, and reservoir constraints require engineering review.",
      "The result is a planning calculation. Approval records do not operate equipment.",
    ],
    methodology:
      "Storage required = max(0, production − export capacity) × days. Required average reduction = max(0, storage required − free storage) ÷ days.",
    dataMode:
      input.wells?.some((well) => well.dataMode !== "simulated") ||
      input.productionBpd !== undefined
        ? "user-scenario"
        : "simulated",
  };
}

/** RFC-4180-style parser with quoted commas/newlines, escaped quotes, BOM and CRLF. */
export function parseCSV(text) {
  if (typeof text !== "string")
    return { headers: [], rows: [], errors: ["CSV input must be text."] };
  const source = text.replace(/^\uFEFF/, "");
  if (!source.trim()) return { headers: [], rows: [], errors: [] };
  const matrix = [];
  const errors = [];
  let row = [];
  let field = "";
  let quoted = false;
  let justClosed = false;
  let line = 1;
  const pushField = () => {
    row.push(field);
    field = "";
    justClosed = false;
  };
  const pushRow = () => {
    pushField();
    if (row.some((value) => value.trim() !== "")) matrix.push(row);
    row = [];
  };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          justClosed = true;
        }
      } else {
        field += char;
        if (char === "\n") line += 1;
      }
      continue;
    }
    if (char === '"') {
      if (field.length === 0 && !justClosed) quoted = true;
      else errors.push(`Unexpected quote near line ${line}.`);
    } else if (char === ",") pushField();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      pushRow();
      line += 1;
    } else if (justClosed) {
      if (!/[ \t]/.test(char))
        errors.push(
          `Unexpected content after a closing quote near line ${line}.`,
        );
    } else field += char;
  }
  if (quoted) errors.push("Unclosed quoted field at end of CSV.");
  if (field.length || row.length || justClosed) pushRow();
  if (!matrix.length) return { headers: [], rows: [], errors };
  const headers = matrix.shift().map((header) => header.trim());
  if (headers.some((header) => !header))
    errors.push("Each CSV column needs a non-empty header.");
  if (
    new Set(headers.map((header) => header.toLowerCase())).size !==
    headers.length
  )
    errors.push("CSV headers must be unique.");
  const rows = matrix.map((values, index) => {
    if (values.length !== headers.length)
      errors.push(
        `Data row ${index + 1} has ${values.length} cells; expected ${headers.length}.`,
      );
    return Object.fromEntries(
      headers.map((header, column) => [header, values[column] ?? ""]),
    );
  });
  return { headers, rows, errors };
}

const WELL_COLUMNS = [
  "id",
  "name",
  "status",
  "oilBpd",
  "baselineBpd",
  "pressurePsi",
  "pumpLoadPct",
  "waterCutPct",
  "x",
  "z",
];
const normaliseHeader = (header) =>
  header.toLowerCase().replace(/[^a-z0-9]/g, "");
const HEADER_ALIASES = {
  wellid: "id",
  wellname: "name",
  productionbpd: "oilBpd",
  oilratebpd: "oilBpd",
  referencebpd: "baselineBpd",
};

/** Validate/import a well snapshot. Invalid uploads return no partial dataset. */
export function validateWellCSV(text) {
  const parsed = parseCSV(text);
  const errors = [...parsed.errors];
  const warnings = [];
  if (!parsed.headers.length)
    return { wells: [], errors: ["The CSV is empty."], warnings };
  const canonicalMap = Object.fromEntries(
    WELL_COLUMNS.map((column) => [normaliseHeader(column), column]),
  );
  const mappedHeaders = parsed.headers.map(
    (header) =>
      HEADER_ALIASES[normaliseHeader(header)] ??
      canonicalMap[normaliseHeader(header)] ??
      header,
  );
  if (new Set(mappedHeaders).size !== mappedHeaders.length)
    errors.push("Two columns refer to the same well field.");
  for (const required of [
    "id",
    "oilBpd",
    "baselineBpd",
    "pressurePsi",
    "pumpLoadPct",
    "waterCutPct",
  ]) {
    if (!mappedHeaders.includes(required))
      errors.push(`Missing required column: ${required}.`);
  }
  if (!parsed.rows.length) errors.push("The CSV contains no well rows.");
  if (parsed.rows.length > 5000)
    errors.push("Import supports up to 5,000 wells.");
  if (errors.length) return { wells: [], errors, warnings };
  const ids = new Set();
  const wells = parsed.rows.map((raw, index) => {
    const record = Object.fromEntries(
      parsed.headers.map((header, column) => [
        mappedHeaders[column],
        raw[header].trim(),
      ]),
    );
    const id = record.id;
    if (!id) errors.push(`Row ${index + 1}: id is required.`);
    if (ids.has(id))
      errors.push(`Row ${index + 1}: duplicate well id "${id}".`);
    ids.add(id);
    const numeric = {};
    for (const key of [
      "oilBpd",
      "baselineBpd",
      "pressurePsi",
      "pumpLoadPct",
      "waterCutPct",
    ]) {
      const value = record[key] === "" ? NaN : Number(record[key]);
      numeric[key] = value;
      if (!Number.isFinite(value) || value < 0)
        errors.push(`Row ${index + 1}: ${key} must be a non-negative number.`);
      else if (["pumpLoadPct", "waterCutPct"].includes(key) && value > 100)
        errors.push(`Row ${index + 1}: ${key} must be between 0 and 100.`);
    }
    if (numeric.baselineBpd === 0 && numeric.oilBpd > 0)
      warnings.push(
        `Row ${index + 1}: zero reference prevents a percentage comparison.`,
      );
    if (
      numeric.baselineBpd > 0 &&
      !Number.isFinite((numeric.oilBpd / numeric.baselineBpd - 1) * 100)
    )
      errors.push(
        `Row ${index + 1}: production values exceed the supported numeric range for a reference comparison.`,
      );
    const sourceStatus = record.status?.toLowerCase() || null;
    if (
      sourceStatus &&
      !["healthy", "warning", "critical", "offline"].includes(sourceStatus)
    )
      errors.push(
        `Row ${index + 1}: status must be healthy, warning, critical, or offline.`,
      );
    if (sourceStatus === "offline" && numeric.oilBpd > 0)
      errors.push(`Row ${index + 1}: an offline well must have zero oilBpd.`);
    const { severity: status } = getReviewSignals({
      ...numeric,
      plannedOutage: false,
    });
    if (sourceStatus && sourceStatus !== status)
      warnings.push(
        `Row ${index + 1}: supplied status "${sourceStatus}" is preserved as sourceStatus; the measurements require the "${status}" review state. Operating state is tracked separately.`,
      );
    const coordinates = {};
    for (const [key, fallback] of [
      ["x", (index % 6) * 17 - 43],
      ["z", Math.floor(index / 6) * 22 - 33],
    ]) {
      coordinates[key] =
        record[key] === undefined || record[key] === ""
          ? fallback
          : Number(record[key]);
      if (!Number.isFinite(coordinates[key]))
        errors.push(`Row ${index + 1}: ${key} must be a finite number.`);
    }
    return {
      id,
      name: record.name || id,
      status,
      sourceStatus,
      reviewSeverity: status,
      operatingStatus: numeric.oilBpd === 0 ? "offline" : "producing",
      plannedOutage: false,
      ...numeric,
      ...coordinates,
      number: index + 1,
      field: "Imported well snapshot",
      zone: "Imported",
      liftType: "Not provided",
      coordinates,
      lastUpdated: null,
      dataMode: "imported",
      shortfallBpd: Math.max(0, numeric.baselineBpd - numeric.oilBpd),
      deviationPct:
        numeric.baselineBpd > 0
          ? round((numeric.oilBpd / numeric.baselineBpd - 1) * 100)
          : 0,
      issue: "Imported snapshot. Verify data source and measurement time.",
      events: [],
    };
  });
  if (!errors.length) {
    for (const key of ["oilBpd", "baselineBpd", "shortfallBpd"]) {
      if (!Number.isFinite(wells.reduce((sum, well) => sum + well[key], 0)))
        errors.push(`The combined ${key} exceeds the supported numeric range.`);
    }
  }
  warnings.push(
    "Imported snapshots do not contain historical trends or verified sensor timestamps.",
  );
  if (!mappedHeaders.includes("x") || !mappedHeaders.includes("z"))
    warnings.push(
      "Missing map coordinates use an illustrative grid, not surveyed well positions.",
    );
  return { wells: errors.length ? [] : wells, errors, warnings };
}

/** CSV encoding. String cells that could execute spreadsheet formulas are escaped. */
export function exportCSV(rows, columns) {
  const headers = columns ?? [
    ...new Set(rows.flatMap((row) => Object.keys(row))),
  ];
  const encode = (value) => {
    let str = value === undefined || value === null ? "" : String(value);
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(str)) str = `'${str}`;
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [
    headers.map(encode).join(","),
    ...rows.map((row) =>
      headers.map((header) => encode(row[header])).join(","),
    ),
  ].join("\r\n");
}

export function exportWellsCSV(wells = DEMO_WELLS) {
  return exportCSV(wells, WELL_COLUMNS);
}

// Convenience aliases for data consumers.
export const FIELD = DEMO_FIELD;
export const WELLS = DEMO_WELLS;
