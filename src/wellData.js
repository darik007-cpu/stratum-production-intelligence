export const MIN_WELL_ZOOM = 8;
export const MAX_WELL_RESULTS = 500;
export const OVERPASS_ENDPOINT =
  "https://overpass.kumi.systems/api/interpreter";
export const BOEM_ENDPOINT =
  "https://gis.boem.gov/server/rest/services/BOEM_BSEE/GOA_Layers/FeatureServer/1/query";

export const WORLD_WELL_REGIONS = Object.freeze([
  {
    id: "gulf-mexico",
    label: "Gulf of Mexico · US offshore",
    regionTitle: "Gulf of Mexico",
    center: [27.8, -90],
    zoom: 8,
    note: "US federal offshore wells from the official BOEM/BSEE layer, updated by the source daily.",
  },
  {
    id: "permian",
    label: "Permian Basin · United States",
    regionTitle: "Permian Basin",
    center: [31.85, -102.35],
    zoom: 9,
    note: "A regional viewport in west Texas and southeast New Mexico.",
  },
  {
    id: "alberta",
    label: "Alberta · Canada",
    regionTitle: "Western Canada",
    center: [54.25, -114.6],
    zoom: 8,
    note: "A regional viewport in Alberta. Public OSM coverage varies.",
  },
  {
    id: "north-sea",
    label: "North Sea · Europe",
    regionTitle: "North Sea",
    center: [57.25, 1.8],
    zoom: 8,
    note: "An offshore regional viewport between the United Kingdom and Norway.",
  },
  {
    id: "persian-gulf",
    label: "Persian Gulf · Middle East",
    regionTitle: "Persian Gulf",
    center: [27.15, 51.2],
    zoom: 8,
    note: "A regional viewport in the Persian Gulf. Public OSM coverage varies.",
  },
  {
    id: "west-siberia",
    label: "West Siberia · Russia",
    regionTitle: "West Siberia",
    center: [61.2, 72.2],
    zoom: 8,
    note: "A regional viewport in western Siberia. Public OSM coverage varies.",
  },
  {
    id: "niger-delta",
    label: "Niger Delta · Nigeria",
    regionTitle: "Niger Delta",
    center: [5.35, 5.8],
    zoom: 9,
    note: "A regional viewport in the Niger Delta.",
  },
  {
    id: "campos",
    label: "Campos Basin · Brazil",
    regionTitle: "Campos Basin",
    center: [-22.55, -40.55],
    zoom: 8,
    note: "An offshore regional viewport east of Brazil.",
  },
  {
    id: "neuquen",
    label: "Neuquén Basin · Argentina",
    regionTitle: "Neuquén Basin",
    center: [-38.25, -69.25],
    zoom: 9,
    note: "A regional viewport in western Argentina.",
  },
]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, precision = 5) => Number(value.toFixed(precision));

export function normaliseBounds(bounds) {
  const south = clamp(Number(bounds.south), -90, 90);
  const north = clamp(Number(bounds.north), -90, 90);
  const west = clamp(Number(bounds.west), -180, 180);
  const east = clamp(Number(bounds.east), -180, 180);
  if (![south, north, west, east].every(Number.isFinite)) {
    throw new Error("The map bounds are not finite.");
  }
  if (south >= north || west >= east) {
    throw new Error(
      "The current viewport crosses the date line or has no area.",
    );
  }
  return { south, west, north, east };
}

export function wellQuery(bounds, limit = MAX_WELL_RESULTS + 1) {
  const { south, west, north, east } = normaliseBounds(bounds);
  const bbox = [south, west, north, east]
    .map((value) => round(value))
    .join(",");
  return `[out:json][timeout:25];(node["man_made"="petroleum_well"](${bbox});node["man_made"="oil_well"](${bbox});node["man_made"="gas_well"](${bbox}););out meta qt ${limit};`;
}

function firstValue(tags, keys) {
  for (const key of keys) {
    const value = tags?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function wellStatus(tags) {
  const explicit = firstValue(tags, [
    "status",
    "operational_status",
    "production_status",
  ]);
  if (explicit) return explicit;
  if (tags?.disused === "yes") return "disused";
  if (tags?.abandoned === "yes") return "abandoned";
  return null;
}

function coordinates(element) {
  const lat = Number(element.lat ?? element.center?.lat);
  const lng = Number(element.lon ?? element.center?.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function parseOverpassWells(payload, max = MAX_WELL_RESULTS) {
  if (!payload || !Array.isArray(payload.elements)) {
    throw new Error("The well service returned an unexpected response.");
  }
  if (typeof payload.remark === "string" && payload.remark.trim()) {
    throw new Error(
      `The OpenStreetMap query did not complete: ${payload.remark.trim().slice(0, 240)}`,
    );
  }
  const wells = [];
  for (const element of payload.elements) {
    const point = coordinates(element);
    if (!point || !element.id || element.type !== "node") continue;
    const tags = element.tags ?? {};
    const ref = firstValue(tags, ["ref", "ref:api", "ref:well"]);
    const name = firstValue(tags, ["name", "official_name"]);
    const substance = firstValue(tags, ["substance", "product"]);
    wells.push({
      key: `${element.type}/${element.id}`,
      osmType: element.type,
      osmId: element.id,
      lat: point.lat,
      lng: point.lng,
      name: name || ref || `Petroleum well ${element.id}`,
      ref,
      substance,
      operator: firstValue(tags, ["operator", "operator:name"]),
      field: firstValue(tags, ["field", "oil_field", "gas_field"]),
      status: wellStatus(tags),
      startDate: firstValue(tags, ["start_date", "opening_date"]),
      source: firstValue(tags, [
        "source",
        "source:geometry",
        "source:position",
      ]),
      website: firstValue(tags, ["website", "contact:website"]),
      wikidata: firstValue(tags, ["wikidata"]),
      timestamp:
        typeof element.timestamp === "string" ? element.timestamp : null,
      tags,
      osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      sourceName: "OpenStreetMap",
      sourceId: `${element.type}/${element.id}`,
      recordUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      depth: null,
      wellClass: null,
    });
  }
  wells.sort((a, b) => a.name.localeCompare(b.name, "en"));
  return {
    wells: wells.slice(0, max),
    truncated: wells.length > max || payload.elements.length > max,
    sourceTimestamp: payload.osm3s?.timestamp_osm_base ?? null,
    sourceName: "OpenStreetMap",
  };
}

export function parseBoemWells(payload, max = MAX_WELL_RESULTS) {
  if (!payload || !Array.isArray(payload.features)) {
    throw new Error("The BOEM well service returned an unexpected response.");
  }
  const wells = [];
  for (const feature of payload.features) {
    const [lng, lat] = feature.geometry?.coordinates ?? [];
    const tags = feature.properties ?? {};
    const id = tags.OBJECTID ?? feature.id;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || id == null) continue;
    const ref = String(tags.API_NUMBER ?? "").trim() || null;
    const name =
      String(tags.WELL_NAME ?? "").trim() || ref || `BOEM well ${id}`;
    const operatorCode = String(tags.OPERATOR ?? "").trim() || null;
    wells.push({
      key: `boem/${id}`,
      osmType: null,
      osmId: null,
      lat,
      lng,
      name,
      ref,
      substance: null,
      operator: operatorCode ? `Operator code ${operatorCode}` : null,
      field: null,
      status:
        String(tags.STATUS_DESCRIPTION ?? "").trim() ||
        String(tags.STATUS ?? "").trim() ||
        null,
      startDate: String(tags.SPUD_DATE ?? "").trim() || null,
      source: "BOEM / BSEE",
      website: null,
      wikidata: null,
      timestamp: null,
      tags,
      osmUrl: null,
      sourceName: "BOEM / BSEE",
      sourceId: String(id),
      recordUrl: `${BOEM_ENDPOINT}?${new URLSearchParams({
        objectIds: String(id),
        outFields: "*",
        returnGeometry: "true",
        f: "pjson",
      })}`,
      depth: String(tags.DEPTH ?? "").trim() || null,
      wellClass: String(tags.TYPE_CODE_DESC ?? "").trim() || null,
    });
  }
  wells.sort((a, b) => a.name.localeCompare(b.name, "en"));
  return {
    wells: wells.slice(0, max),
    truncated:
      payload.exceededTransferLimit === true ||
      payload.properties?.exceededTransferLimit === true ||
      wells.length > max,
    sourceTimestamp: null,
    sourceName: "BOEM / BSEE",
  };
}

export function wellCacheKey(bounds, zoom) {
  const box = normaliseBounds(bounds);
  return [
    Math.floor(Number(zoom)),
    round(box.south, 2),
    round(box.west, 2),
    round(box.north, 2),
    round(box.east, 2),
  ].join(":");
}

export async function fetchOpenWells(bounds, { signal, source = "osm" } = {}) {
  if (source === "boem") return fetchBoemWells(bounds, { signal });
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: new URLSearchParams({ data: wellQuery(bounds) }),
    signal,
  });
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "The public well service is rate limited. Try again later.",
      );
    }
    if (response.status === 504) {
      throw new Error("The public well query timed out. Zoom in and retry.");
    }
    throw new Error(
      `The public well service returned HTTP ${response.status}.`,
    );
  }
  return parseOverpassWells(await response.json());
}

export async function fetchBoemWells(bounds, { signal } = {}) {
  const { south, west, north, east } = normaliseBounds(bounds);
  const params = new URLSearchParams({
    where: "1=1",
    geometry: `${west},${south},${east},${north}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields:
      "OBJECTID,API_NUMBER,OPERATOR,WELL_NAME,SPUD_DATE,TYPE_CODE_DESC,STATUS,DEPTH,STATUS_DESCRIPTION",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: String(MAX_WELL_RESULTS + 1),
    f: "geojson",
  });
  const response = await fetch(`${BOEM_ENDPOINT}?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`The BOEM well service returned HTTP ${response.status}.`);
  }
  return parseBoemWells(await response.json());
}
