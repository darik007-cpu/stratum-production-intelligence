import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_WELL_RESULTS,
  parseBoemWells,
  parseOverpassWells,
  wellCacheKey,
  wellQuery,
} from "../src/wellData.js";

test("well query requests point well records only inside the viewport", () => {
  const query = wellQuery({ south: 30, west: -103, north: 32, east: -101 });
  assert.match(query, /man_made.*petroleum_well/);
  assert.match(query, /man_made.*oil_well/);
  assert.match(query, /man_made.*gas_well/);
  assert.match(query, /30,-103,32,-101/);
  assert.match(query, new RegExp(String(MAX_WELL_RESULTS + 1)));
  assert.doesNotMatch(query, /water_well|pumpjack|nwr/);
});

test("well response preserves provenance and never invents missing fields", () => {
  const result = parseOverpassWells({
    osm3s: { timestamp_osm_base: "2026-10-24T00:00:00Z" },
    elements: [
      {
        type: "node",
        id: 42,
        lat: 31.25,
        lon: -102.5,
        timestamp: "2025-07-01T10:00:00Z",
        tags: {
          man_made: "petroleum_well",
          ref: "API-42",
          substance: "oil",
          operator: "Example operator",
          status: "active",
          source: "public survey",
        },
      },
      {
        type: "way",
        id: 84,
        center: { lat: 31.5, lon: -102.1 },
        tags: { man_made: "petroleum_well" },
      },
    ],
  });
  const named = result.wells.find((well) => well.osmId === 42);
  assert.equal(named.name, "API-42");
  assert.equal(named.operator, "Example operator");
  assert.equal(named.osmUrl, "https://www.openstreetmap.org/node/42");
  assert.equal(
    result.wells.some((well) => well.osmId === 84),
    false,
  );
  assert.equal(result.sourceTimestamp, "2026-10-24T00:00:00Z");
});

test("well cache key groups a repeated rounded viewport", () => {
  const first = wellCacheKey(
    { south: 30.111, west: -103.111, north: 31.999, east: -101.001 },
    9.4,
  );
  const second = wellCacheKey(
    { south: 30.112, west: -103.112, north: 32.001, east: -101.002 },
    9.9,
  );
  assert.equal(first, second);
});

test("invalid or date-line-crossing bounds are rejected", () => {
  assert.throws(
    () => wellQuery({ south: 10, west: 170, north: 20, east: -170 }),
    /date line|no area/,
  );
  assert.throws(
    () => wellQuery({ south: Number.NaN, west: 0, north: 1, east: 2 }),
    /not finite/,
  );
});

test("Overpass runtime remarks cannot become a false empty result", () => {
  assert.throws(
    () =>
      parseOverpassWells({
        elements: [],
        remark: "runtime error: Query timed out",
      }),
    /did not complete.*timed out/,
  );
});

test("BOEM records retain identifiers, status and source fields", () => {
  const result = parseBoemWells({
    type: "FeatureCollection",
    features: [
      {
        id: 7,
        geometry: { type: "Point", coordinates: [-89.95, 28.01] },
        properties: {
          OBJECTID: 7,
          API_NUMBER: "608104006000",
          OPERATOR: "00250",
          WELL_NAME: "  001 ",
          SPUD_DATE: "1/16/1988",
          TYPE_CODE_DESC: "Exploratory",
          STATUS_DESCRIPTION: "Permanently Abandoned",
          DEPTH: "1773",
        },
      },
    ],
    properties: { exceededTransferLimit: true },
  });
  assert.equal(result.wells[0].name, "001");
  assert.equal(result.wells[0].ref, "608104006000");
  assert.equal(result.wells[0].operator, "Operator code 00250");
  assert.equal(result.wells[0].status, "Permanently Abandoned");
  assert.equal(result.wells[0].wellClass, "Exploratory");
  assert.equal(result.wells[0].sourceName, "BOEM / BSEE");
  assert.equal(result.truncated, true);
});
