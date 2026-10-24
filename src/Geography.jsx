import React, { useEffect, useId, useRef, useState } from "react";
import L from "leaflet";
import {
  ArrowUpRight,
  Globe2,
  Info,
  MapPin,
  Maximize2,
  Navigation,
  RotateCcw,
  Satellite,
  X,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./geography.css";
import {
  fetchOpenWells,
  MAX_WELL_RESULTS,
  MIN_WELL_ZOOM,
  wellCacheKey,
  WORLD_WELL_REGIONS,
} from "./wellData.js";

// Reference viewports do not represent STRATUM customer or operating assets.
const KAZAKHSTAN_PRESETS = [
  {
    id: "kazakhstan",
    label: "Kazakhstan",
    regionTitle: "Kazakhstan",
    center: [48, 67],
    zoom: 5,
    note: "A country-scale reference view.",
  },
  {
    id: "atyrau",
    label: "Atyrau · city vicinity",
    regionTitle: "Atyrau",
    center: [47.106, 51.921],
    zoom: 10,
    note: "City vicinity, centered near a public riverside promenade. Not an oilfield location.",
    source: "https://kazakhstan.travel/en/attractions/133",
    sourceLabel: "Kazakhstan Travel",
  },
  {
    id: "caspian",
    label: "Western Kazakhstan · Caspian",
    regionTitle: "Caspian region",
    center: [46, 51],
    zoom: 6,
    note: "A broad regional viewport. Zoom in to request public well records.",
  },
];
const PRESETS = [...KAZAKHSTAN_PRESETS, ...WORLD_WELL_REGIONS];
const INITIAL = { lat: 46, lng: 51, zoom: 6 };
const COUNTRY_VIEW_BOUNDS = [
  [40.6, 46.5],
  [55.4, 87.4],
];
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const WELL_CACHE = new Map();

function googleView(view, satellite = false) {
  const params = new URLSearchParams({
    api: "1",
    map_action: "map",
    center: `${view.lat.toFixed(5)},${view.lng.toFixed(5)}`,
    zoom: String(Math.round(view.zoom)),
  });
  if (satellite) params.set("basemap", "satellite");
  return `https://www.google.com/maps/@?${params}`;
}

function placeSearch(name) {
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `${name} oil field Kazakhstan` })}`;
}

function safeHttpUrl(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function readableDate(value) {
  if (!value) return "Not stated";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      });
}

function ExternalLink({ href, children, className = "" }) {
  return (
    <a
      className={`geo-link ${className}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={15} aria-hidden="true" />
      <span className="geo-sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function WellFact({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "Not stated by source"}</dd>
    </div>
  );
}

export default function Geography() {
  const host = useRef(null);
  const map = useRef(null);
  const tileLayer = useRef(null);
  const wellLayer = useRef(null);
  const wellCard = useRef(null);
  const loadedBoundsRef = useRef(null);
  const abortRequest = useRef(null);
  const requestSequence = useRef(0);
  const helpId = useId();
  const [view, setView] = useState(INITIAL);
  const [selected, setSelected] = useState("caspian");
  const [loading, setLoading] = useState(true);
  const [tileIssue, setTileIssue] = useState(false);
  const [mapIssue, setMapIssue] = useState(false);
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine === false,
  );
  const [wells, setWells] = useState([]);
  const [selectedWell, setSelectedWell] = useState(null);
  const [wellState, setWellState] = useState("idle");
  const [wellError, setWellError] = useState("");
  const [wellTruncated, setWellTruncated] = useState(false);
  const [wellTimestamp, setWellTimestamp] = useState(null);
  const [wellSourceName, setWellSourceName] = useState(null);
  const [wellRetrievedAt, setWellRetrievedAt] = useState(null);
  const [sourceMode, setSourceMode] = useState("osm");
  const [wellStale, setWellStale] = useState(false);
  const [loadedArea, setLoadedArea] = useState(null);
  const preset = PRESETS.find((item) => item.id === selected);
  const osmLink = `https://www.openstreetmap.org/#map=${Math.round(view.zoom)}/${view.lat.toFixed(5)}/${view.lng.toFixed(5)}`;
  const canLoadWells =
    !mapIssue && !offline && Math.floor(view.zoom) >= MIN_WELL_ZOOM;
  const preferredSource =
    sourceMode === "boem" ? "BOEM / BSEE" : "OpenStreetMap";

  useEffect(() => {
    let observer;
    let instance;
    let disposed = false;
    const failed = new Set();
    const tileKey = (event) =>
      `${event.coords.z}/${event.coords.x}/${event.coords.y}`;
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    try {
      instance = L.map(host.current, {
        center: [INITIAL.lat, INITIAL.lng],
        zoom: INITIAL.zoom,
        minZoom: 2,
        maxZoom: 19,
        zoomControl: false,
        scrollWheelZoom: false,
        worldCopyJump: true,
      });
      map.current = instance;
      L.control.zoom({ position: "topright" }).addTo(instance);
      L.control
        .scale({ position: "bottomleft", imperial: false, maxWidth: 120 })
        .addTo(instance);
      instance.attributionControl.setPrefix(
        '<a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet</a>',
      );
      const tiles = L.tileLayer(TILE_URL, {
        maxZoom: 19,
        keepBuffer: 1,
        updateWhenIdle: true,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      });
      tileLayer.current = tiles;
      tiles.on("loading", () => {
        if (!disposed) setLoading(true);
      });
      tiles.on("tileerror", (event) => {
        failed.add(tileKey(event));
        if (!disposed) setTileIssue(true);
      });
      tiles.on("tileload", (event) => {
        failed.delete(tileKey(event));
        if (!disposed) setTileIssue(failed.size > 0);
      });
      tiles.on("tileunload", (event) => {
        failed.delete(tileKey(event));
        if (!disposed) setTileIssue(failed.size > 0);
      });
      tiles.on("load", () => {
        if (!disposed) {
          setLoading(false);
          setTileIssue(failed.size > 0);
        }
      });
      tiles.addTo(instance);
      instance.createPane("publicWells");
      instance.getPane("publicWells").style.zIndex = "460";
      wellLayer.current = L.layerGroup().addTo(instance);
      instance.on("moveend", () => {
        if (disposed) return;
        const center = instance.getCenter().wrap();
        const zoom = instance.getZoom();
        setView({ lat: center.lat, lng: center.lng, zoom });
        if (loadedBoundsRef.current) setWellStale(true);
        const match = PRESETS.find(
          (item) =>
            Math.abs(item.center[0] - center.lat) < 0.001 &&
            Math.abs(item.center[1] - center.lng) < 0.001 &&
            item.zoom === zoom,
        );
        setSelected(match?.id || "custom");
      });
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() =>
          instance.invalidateSize({ pan: false }),
        );
        observer.observe(host.current);
      }
      instance.invalidateSize({ pan: false });
    } catch {
      setMapIssue(true);
      setLoading(false);
    }

    return () => {
      disposed = true;
      abortRequest.current?.abort();
      observer?.disconnect();
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      instance?.remove();
      map.current = null;
      tileLayer.current = null;
      wellLayer.current = null;
    };
  }, []);

  useEffect(() => {
    const points = wellLayer.current;
    if (!points) return;
    points.clearLayers();
    for (const well of wells) {
      const active = selectedWell?.key === well.key;
      const marker = L.circleMarker([well.lat, well.lng], {
        pane: "publicWells",
        radius: active ? 8 : 5,
        weight: active ? 3 : 1.5,
        color: active ? "#fff4ce" : "#1b292b",
        fillColor: active ? "#ffcf71" : "#efb85e",
        fillOpacity: 0.94,
        bubblingMouseEvents: false,
      });
      const tooltip = document.createElement("span");
      tooltip.textContent = well.name;
      marker.bindTooltip(tooltip, {
        direction: "top",
        offset: [0, -5],
        opacity: 0.95,
      });
      marker.on("click", () => setSelectedWell(well));
      marker.addTo(points);
    }
  }, [wells, selectedWell]);

  useEffect(() => {
    if (!selectedWell || !wellCard.current) return;
    wellCard.current.focus({ preventScroll: true });
    wellCard.current.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [selectedWell]);

  function clearWells() {
    abortRequest.current?.abort();
    requestSequence.current += 1;
    setWells([]);
    setSelectedWell(null);
    setWellState("idle");
    setWellError("");
    setWellTruncated(false);
    setWellTimestamp(null);
    setWellSourceName(null);
    setWellRetrievedAt(null);
    setWellStale(false);
    loadedBoundsRef.current = null;
    setLoadedArea(null);
    wellLayer.current?.clearLayers();
  }

  function chooseView(id) {
    const next = PRESETS.find((item) => item.id === id);
    if (!next || !map.current) return;
    clearWells();
    setSourceMode(id === "gulf-mexico" ? "boem" : "osm");
    setSelected(next.id);
    map.current.setView(next.center, next.zoom, { animate: false });
  }

  function fitCountry() {
    clearWells();
    setSourceMode("osm");
    map.current?.fitBounds(COUNTRY_VIEW_BOUNDS, {
      padding: [24, 24],
      animate: false,
    });
  }

  function retryTiles() {
    setTileIssue(false);
    setLoading(true);
    tileLayer.current?.redraw();
  }

  function changeSource(event) {
    clearWells();
    setSourceMode(event.target.value);
  }

  async function loadWells() {
    if (!map.current || !canLoadWells) return;
    const leafletBounds = map.current.getBounds();
    const bounds = {
      south: leafletBounds.getSouth(),
      west: leafletBounds.getWest(),
      north: leafletBounds.getNorth(),
      east: leafletBounds.getEast(),
    };
    const areaLabel = `${bounds.south.toFixed(2)}, ${bounds.west.toFixed(2)} → ${bounds.north.toFixed(2)}, ${bounds.east.toFixed(2)}`;
    let cacheKey;
    try {
      cacheKey = wellCacheKey(bounds, map.current.getZoom());
    } catch (error) {
      setWellState("error");
      setWellError(error.message);
      return;
    }

    cacheKey = `${sourceMode}:${cacheKey}`;
    const cached = WELL_CACHE.get(cacheKey);
    if (cached) {
      setWells(cached.wells);
      setWellTruncated(cached.truncated);
      setWellTimestamp(cached.sourceTimestamp);
      setWellSourceName(cached.sourceName);
      setWellRetrievedAt(cached.fetchedAt);
      setWellStale(false);
      loadedBoundsRef.current = cacheKey;
      setLoadedArea(areaLabel);
      setSelectedWell(null);
      setWellState("loaded");
      setWellError("");
      return;
    }

    abortRequest.current?.abort();
    const controller = new AbortController();
    abortRequest.current = controller;
    const sequence = ++requestSequence.current;
    setWellState("loading");
    setWellError("");
    setSelectedWell(null);
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const result = await fetchOpenWells(bounds, {
        signal: controller.signal,
        source: sourceMode,
      });
      if (sequence !== requestSequence.current) return;
      const fetchedAt = new Date().toISOString();
      WELL_CACHE.set(cacheKey, { ...result, fetchedAt });
      if (WELL_CACHE.size > 20)
        WELL_CACHE.delete(WELL_CACHE.keys().next().value);
      setWells(result.wells);
      setWellTruncated(result.truncated);
      setWellTimestamp(result.sourceTimestamp);
      setWellSourceName(result.sourceName);
      setWellRetrievedAt(fetchedAt);
      setWellStale(false);
      loadedBoundsRef.current = cacheKey;
      setLoadedArea(areaLabel);
      setWellState("loaded");
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setWellState("error");
      setWellError(
        error.name === "AbortError"
          ? "The public well request timed out. Zoom in and retry."
          : error.message,
      );
    } finally {
      window.clearTimeout(timeout);
      if (sequence === requestSequence.current) abortRequest.current = null;
    }
  }

  function inspectWell(well) {
    setSelectedWell(well);
    map.current?.setView(
      [well.lat, well.lng],
      Math.max(map.current.getZoom(), 12),
      { animate: false },
    );
  }

  return (
    <section className="geo-page geo-oil">
      <header className="geo-heading">
        <div>
          <span className="geo-eyebrow">STRATUM / GLOBAL WELL ATLAS</span>
          <h1>
            Energy geography<span>.</span>
          </h1>
        </div>
        <div className="geo-mode">
          <span />
          PUBLIC MAP + WELL RECORDS
        </div>
      </header>
      <div className="geo-oil-console">
        <div className="geo-oil-map-column">
          <div className="geo-toolbar">
            <label>
              GLOBAL REGION
              <select
                value={selected}
                onChange={(event) => chooseView(event.target.value)}
                disabled={mapIssue}
              >
                {selected === "custom" && (
                  <option value="custom">Custom viewport</option>
                )}
                <optgroup label="Kazakhstan context">
                  {KAZAKHSTAN_PRESETS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Worldwide producing regions">
                  {WORLD_WELL_REGIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <button type="button" onClick={fitCountry} disabled={mapIssue}>
              <Maximize2 size={14} />
              Kazakhstan extent
            </button>
          </div>

          <div className="geo-map-shell">
            <div
              ref={host}
              className="geo-map"
              role="region"
              aria-label="Interactive world map with public petroleum well records"
              aria-describedby={helpId}
            />
            {mapIssue && (
              <div className="geo-map-fallback">
                <Globe2 size={32} />
                <h2>Map unavailable</h2>
                <p>Use the external map links to open this reference view.</p>
              </div>
            )}
            <div className="geo-map-stamp" aria-hidden="true">
              <Navigation size={14} />
              <span>
                {wellSourceName || "GLOBAL"} /{" "}
                {wells.length ? `${wells.length} PUBLIC WELLS` : "GLOBAL VIEW"}
              </span>
            </div>
            {wells.length > 0 && (
              <div className="geo-well-legend">
                <span /> Public oil / gas well record
              </div>
            )}
          </div>
          <div className="geo-readout">
            <span>
              {mapIssue
                ? "Map unavailable"
                : offline
                  ? "Offline"
                  : tileIssue
                    ? "Some tiles unavailable"
                    : loading
                      ? "Loading basemap…"
                      : "OpenStreetMap basemap"}
            </span>
            <span>
              LAT {view.lat.toFixed(4)}° / LON {view.lng.toFixed(4)}°
            </span>
            <span>Z {Math.round(view.zoom)}</span>
          </div>
        </div>
        <aside className="geo-oil-rail" aria-label="Global well atlas console">
          <div className="geo-rail-title">
            <span className="geo-eyebrow">PUBLIC DATA CONSOLE</span>
            <h2>{preset?.regionTitle || "Custom viewport"}</h2>
            <p>Inspect mapped well records in any visible area of the world.</p>
          </div>

          <div className="geo-rail-block geo-well-loader">
            <span className="geo-eyebrow">01 / WELL RECORDS</span>
            <p>
              OpenStreetMap provides global community records. Gulf of Mexico
              views use the official US BOEM/BSEE offshore layer. Coverage and
              field detail vary by source.
            </p>
            <label className="geo-source-picker">
              DATA SOURCE
              <select value={sourceMode} onChange={changeSource}>
                <option value="osm">OpenStreetMap · worldwide</option>
                <option value="boem">BOEM/BSEE · US federal offshore</option>
              </select>
            </label>
            {sourceMode === "boem" && (
              <p className="geo-well-hint">
                BOEM/BSEE covers US federal Outer Continental Shelf waters only.
              </p>
            )}
            <button
              type="button"
              className="geo-load-wells"
              onClick={loadWells}
              disabled={!canLoadWells || wellState === "loading"}
            >
              <MapPin size={15} />
              {wellState === "loading"
                ? "Loading public records…"
                : wells.length
                  ? "Update wells in view"
                  : "Load wells in view"}
            </button>
            {!canLoadWells && !mapIssue && !offline && (
              <p className="geo-well-hint">
                Zoom to level {MIN_WELL_ZOOM} or closer to request records.
              </p>
            )}
            <div className="geo-well-status" aria-live="polite">
              {wellState === "loaded" && wells.length > 0 && (
                <p>
                  <strong>{wells.length}</strong> mapped records loaded from{" "}
                  {wellSourceName}
                  {wellTruncated
                    ? `; limited to ${MAX_WELL_RESULTS}. Zoom in for more.`
                    : "."}
                </p>
              )}
              {wellState === "loaded" && wells.length === 0 && (
                <p>No mapped records were returned for this view.</p>
              )}
              {wellState === "error" && (
                <p className="geo-well-error">{wellError}</p>
              )}
              {wellStale && wells.length > 0 && (
                <p className="geo-well-stale">
                  The map moved since this request. Update wells for the current
                  view.
                </p>
              )}
            </div>
            {loadedArea && (
              <p className="geo-query-meta">
                Source: {wellSourceName || preferredSource}
                <br />
                Last requested bounds: {loadedArea}
                {wellTimestamp && (
                  <>
                    <br />
                    Source database snapshot: {readableDate(wellTimestamp)} UTC
                  </>
                )}
                {wellRetrievedAt && (
                  <>
                    <br />
                    Retrieved: {readableDate(wellRetrievedAt)} UTC
                  </>
                )}
              </p>
            )}
          </div>

          {selectedWell && (
            <article
              ref={wellCard}
              className="geo-well-card"
              aria-label="Selected public well record"
              tabIndex={-1}
            >
              <button
                type="button"
                className="geo-card-close"
                onClick={() => setSelectedWell(null)}
                aria-label="Close selected well details"
              >
                <X size={15} />
              </button>
              <span className="geo-eyebrow">SELECTED PUBLIC RECORD</span>
              <h3>{selectedWell.name}</h3>
              <span className="geo-record-id">
                {selectedWell.sourceName} · {selectedWell.sourceId}
              </span>
              <dl>
                <WellFact label="Reference" value={selectedWell.ref} />
                <WellFact label="Substance" value={selectedWell.substance} />
                <WellFact label="Operator" value={selectedWell.operator} />
                <WellFact label="Field" value={selectedWell.field} />
                <WellFact label="Status tag" value={selectedWell.status} />
                <WellFact label="Well class" value={selectedWell.wellClass} />
                <WellFact
                  label="Depth (source units)"
                  value={selectedWell.depth}
                />
                <WellFact label="Start date" value={selectedWell.startDate} />
                <WellFact label="Source tag" value={selectedWell.source} />
                <WellFact
                  label="Coordinates"
                  value={`${selectedWell.lat.toFixed(5)}, ${selectedWell.lng.toFixed(5)}`}
                />
                <WellFact
                  label="Source edit timestamp"
                  value={readableDate(selectedWell.timestamp)}
                />
              </dl>
              <ExternalLink
                href={selectedWell.recordUrl}
                className="geo-primary"
              >
                Open source record
              </ExternalLink>
              {safeHttpUrl(selectedWell.website) && (
                <ExternalLink href={safeHttpUrl(selectedWell.website)}>
                  Record website
                </ExternalLink>
              )}
              {selectedWell.wikidata && (
                <ExternalLink
                  href={`https://www.wikidata.org/wiki/${encodeURIComponent(selectedWell.wikidata)}`}
                >
                  Wikidata
                </ExternalLink>
              )}
            </article>
          )}

          {wells.length > 0 && (
            <div className="geo-rail-block geo-well-results">
              <span className="geo-eyebrow">02 / LOADED RECORDS</span>
              <div className="geo-well-list">
                {wells.map((well) => (
                  <button
                    type="button"
                    key={well.key}
                    className={selectedWell?.key === well.key ? "selected" : ""}
                    onClick={() => inspectWell(well)}
                    aria-pressed={selectedWell?.key === well.key}
                  >
                    <span>
                      <strong>{well.name}</strong>
                      <small>
                        {well.substance || "petroleum"} · {well.lat.toFixed(3)},{" "}
                        {well.lng.toFixed(3)}
                      </small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="geo-rail-block">
            <span className="geo-eyebrow">
              {wells.length ? "03" : "02"} / CURRENT VIEW
            </span>
            <p>
              {preset?.note ||
                "A custom viewport. Coordinates describe the map center only."}
            </p>
            {preset?.source && (
              <ExternalLink href={preset.source}>
                {preset.sourceLabel}
              </ExternalLink>
            )}
          </div>
          <div className="geo-rail-block">
            <span className="geo-eyebrow">TERRAIN + SOURCE MAPS</span>
            <ExternalLink href={googleView(view, true)} className="geo-primary">
              <Satellite size={15} />
              Satellite view
            </ExternalLink>
            <div className="geo-inline-links">
              <ExternalLink href={googleView(view)}>Google Maps</ExternalLink>
              <ExternalLink href={osmLink}>OpenStreetMap</ExternalLink>
            </div>
          </div>
          <div className="geo-rail-block">
            <span className="geo-eyebrow">FIELD DIRECTORY</span>
            <ExternalLink href={placeSearch("Tengiz")}>
              Tengiz field search
            </ExternalLink>
            <ExternalLink href={placeSearch("Kashagan")}>
              Kashagan field search
            </ExternalLink>
            <p>Public searches open in Google Maps.</p>
          </div>
          <div className="geo-data-boundary">
            <Info size={16} />
            <p>
              Public map markers are source records, not STRATUM assets or live
              telemetry. Demo wells and pipelines remain fictional and are not
              geolocated.
            </p>
          </div>
        </aside>
      </div>

      {(tileIssue || offline) && !mapIssue && (
        <div className="geo-notice" role="status">
          <Info size={18} />
          <p>
            {offline
              ? "Internet access is required for map tiles and public well records."
              : "Some map tiles could not be loaded. Retry or open an external map."}
          </p>
          <button type="button" onClick={retryTiles} disabled={offline}>
            <RotateCcw size={14} /> Retry
          </button>
        </div>
      )}
      <div className="geo-controls-note" id={helpId}>
        PAN: DRAG <span>ZOOM: + / − OR PINCH</span>
        <span>WELLS: LOAD VIEW, THEN SELECT A MARKER</span>
      </div>
      <footer className="geo-source">
        <span>
          Basemap and OSM well records ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenStreetMap contributors
          </a>{" "}
          · ODbL · Gulf offshore records{" "}
          <a
            href="https://www.boem.gov/oil-gas-energy/mapping-and-data"
            target="_blank"
            rel="noopener noreferrer"
          >
            BOEM / BSEE
          </a>
        </span>
        <ExternalLink href="https://www.openstreetmap.org/fixthemap">
          Report a map issue
        </ExternalLink>
      </footer>
    </section>
  );
}
