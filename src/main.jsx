import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Bell,
  Box,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Database,
  Download,
  Expand,
  FlaskConical,
  Focus,
  Layers3,
  MapPinned,
  Menu,
  Pause,
  Play,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TriangleAlert,
  Waves,
  X,
} from "lucide-react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./styles.css";
import {
  DEMO_FIELD,
  DEMO_WELLS,
  getPortfolio,
  detectAnomalies,
  getWellHistory,
} from "./domain.js";
import { createFieldScene } from "./field3d.js";
import Geography from "./Geography.jsx";
import {
  DiagnosticsPage,
  ScenarioPage,
  ActionsPage,
  DataPage,
} from "./pages.jsx";

const number = (n, digits = 0) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: digits })
    : "—";
const nav = [
  { id: "overview", label: "Field overview", icon: Layers3 },
  { id: "diagnostics", label: "Well diagnostics", icon: Activity },
  { id: "scenarios", label: "Export planning", icon: FlaskConical },
  { id: "actions", label: "Review actions", icon: ClipboardCheck },
  { id: "data", label: "Data", icon: Database },
  { id: "geography", label: "Regional map", icon: MapPinned },
];
function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
function Badge({ status, children }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className="status-dot" />
      {children || status}
    </span>
  );
}

function Trend({ wells, compact = false }) {
  const series = useMemo(() => {
    if (wells.some((w) => w.dataMode !== "simulated")) return [];
    const histories = wells.map((w) => getWellHistory(w.id, 14));
    return Array.from({ length: 14 }, (_, i) => ({
      label: histories[0]?.[i]?.date?.slice(5) || String(i + 1),
      value: histories.reduce((s, h) => s + (h[i]?.oilBpd || 0), 0),
    }));
  }, [wells]);
  if (!series.length)
    return (
      <div className="empty-state">
        <Activity size={24} />
        <p>Historical trend unavailable</p>
        <span>Import contains a single snapshot.</span>
      </div>
    );
  const max = Math.max(...series.map((d) => d.value)) * 1.08,
    min = Math.min(...series.map((d) => d.value)) * 0.92,
    w = 640,
    h = compact ? 90 : 160;
  const pts = series.map(
    (d, i) =>
      `${42 + (i * (w - 60)) / (series.length - 1)},${14 + (h - 42) * (1 - (d.value - min) / (max - min))}`,
  );
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Simulated 14-day production trend. Latest ${number(series.at(-1).value)} barrels per day.`}
    >
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F3B75A" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#F3B75A" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="42"
              x2="625"
              y1={14 + t * (h - 42)}
              y2={14 + t * (h - 42)}
              stroke="#2C3C43"
              strokeDasharray="3 6"
            />
            <text x="0" y={18 + t * (h - 42)} fill="#91A3AA" fontSize="9">
              {number(max - (max - min) * t)}
            </text>
          </g>
        ))}
        <path
          d={`M${pts.join(" L")} L625,${h - 26} L42,${h - 26}Z`}
          fill="url(#chart-fill)"
        />
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke="#F3B75A"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {series
          .filter((_, i) => i % 3 === 0 || i === 13)
          .map((d) => (
            <text
              key={d.label}
              x={42 + (series.indexOf(d) * (w - 60)) / 13}
              y={h - 4}
              fill="#91A3AA"
              fontSize="9"
              textAnchor="middle"
            >
              {d.label}
            </text>
          ))}
      </svg>
      <span className="chart-unit">Oil production · bpd</span>
    </div>
  );
}

function FieldModel({ wells, selectedId, onSelect, onToast, hero = false }) {
  const ref = useRef(null),
    api = useRef(null);
  const selectedOutsideModel =
    Boolean(selectedId) &&
    !wells.slice(0, 80).some((well) => well.id === selectedId);
  const [layer, setLayer] = useState("surface"),
    [running, setRunning] = useState(true),
    [controls, setControls] = useState(false),
    [speed, setSpeed] = useState(1),
    [explode, setExplode] = useState(0),
    [angle, setAngle] = useState(40),
    [daylight, setDaylight] = useState(14),
    [ready, setReady] = useState(false),
    [exporting, setExporting] = useState(false);
  useEffect(() => {
    const model = createFieldScene(ref.current, {
      wells: wells.slice(0, 80),
      onSelect: (id) => onSelect?.(id),
      onReady: () => setReady(true),
    });
    api.current = model;
    window.stratumField = model;
    return () => {
      model.dispose();
      api.current = null;
      if (window.stratumField === model) delete window.stratumField;
    };
  }, [wells]);
  useEffect(() => {
    api.current?.selectWell(selectedId);
  }, [selectedId, wells]);
  const updateLayer = (value) => {
    setLayer(value);
    api.current?.setLayer(value);
  };
  const exportModel = async () => {
    try {
      setExporting(true);
      const blob = await api.current?.exportScene({ includeSubsurface: true });
      if (blob) download(blob, "stratum-karatau-demo.glb");
      onToast?.("3D model exported as GLB. Geometry is illustrative.");
    } catch (e) {
      onToast?.(`Export unavailable: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className={`field-panel ${hero ? "hero-model" : ""}`}>
      {!hero && (
        <div className="scene-toolbar">
          <div className="segmented">
            {[
              ["surface", "Surface"],
              ["subsurface", "Subsurface"],
              ["flow", "Flow"],
            ].map(([id, label]) => (
              <button
                className={layer === id ? "active" : ""}
                key={id}
                onClick={() => updateLayer(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="toolbar">
            <button
              className="icon-button"
              aria-label="Reset camera"
              title="Reset camera"
              onClick={() => api.current?.setView("isometric")}
            >
              <Focus size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Top view"
              title="Top view"
              onClick={() => api.current?.setView("top")}
            >
              <Expand size={16} />
            </button>
            <button
              className={`icon-button ${controls ? "active" : ""}`}
              aria-label="Open 3D motion controls"
              title="3D motion controls"
              onClick={() => setControls(!controls)}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
        </div>
      )}
      <div
        className="scene-container"
        ref={ref}
        aria-label="Interactive 3D oilfield. Drag to orbit, scroll to zoom, select a well."
      />
      <div className="scene-overlay">
        <span className="scene-status">
          <span className="status-dot" />{" "}
          {hero
            ? "KARATAU / DEMONSTRATION FIELD"
            : `${wells.length > 80 ? "80 visible / " : ""}${wells.length} assets · illustrative geometry`}
        </span>
        <span className="scene-hint">Drag to orbit · Scroll to zoom</span>
      </div>
      {!hero && selectedOutsideModel && (
        <div className="scene-selection-notice" role="status">
          {selectedId} is outside the visible 3D model. The inspector shows the
          selected asset; no visible well is highlighted.
        </div>
      )}
      {!hero && (
        <div className="scene-bottom">
          <div className="legend">
            <span>
              <i className="dot healthy" />
              Normal
            </span>
            <span>
              <i className="dot warning" />
              Review
            </span>
            <span>
              <i className="dot critical" />
              Priority
            </span>
            <span>
              <i className="dot offline" />
              Offline
            </span>
          </div>
          <div className="toolbar">
            <button
              className="icon-button"
              aria-label={
                running ? "Pause model animation" : "Play model animation"
              }
              onClick={() => {
                setRunning(!running);
                api.current?.setRunning(!running);
              }}
            >
              {running ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              className="btn btn-ghost small"
              onClick={exportModel}
              disabled={exporting}
            >
              <Download size={14} />
              {exporting ? "Exporting…" : "GLB"}
            </button>
          </div>
        </div>
      )}
      {!hero && controls && (
        <div className="scene-controls">
          <div className="panel-header">
            <strong>Explore the model</strong>
            <span className="muted">
              Visual controls · production data unchanged
            </span>
          </div>
          <div className="grid-two">
            {[
              {
                label: "Pump motion",
                value: speed,
                min: 0,
                max: 3,
                step: 0.1,
                unit: "×",
                set: (v) => {
                  setSpeed(v);
                  api.current?.setPumpSpeed(v);
                },
              },
              {
                label: "Separate layers",
                value: explode,
                min: 0,
                max: 1,
                step: 0.01,
                unit: "",
                set: (v) => {
                  setExplode(v);
                  setLayer("subsurface");
                  api.current?.setLayer("subsurface");
                  api.current?.setExplode(v);
                },
              },
              {
                label: "Camera orbit",
                value: angle,
                min: 0,
                max: 360,
                step: 1,
                unit: "°",
                set: (v) => {
                  setAngle(v);
                  api.current?.setCameraAngle(v);
                },
              },
              {
                label: "Daylight",
                value: daylight,
                min: 0,
                max: 24,
                step: 0.5,
                unit: "h",
                set: (v) => {
                  setDaylight(v);
                  api.current?.setTimeOfDay(v);
                },
              },
            ].map((c) => (
              <label className="range-field" key={c.label}>
                <span>
                  {c.label}
                  <b>
                    {c.value}
                    {c.unit}
                  </b>
                </span>
                <input
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={c.value}
                  onChange={(e) => c.set(Number(e.target.value))}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Brief({ onLaunch, onNavigate, wells, onToast }) {
  const portfolio = getPortfolio(wells),
    alerts = detectAnomalies(wells);
  const modules = [
    {
      id: "overview",
      title: "Field surveillance",
      icon: Layers3,
      detail: "Inspect production, equipment status and the 3D field.",
    },
    {
      id: "diagnostics",
      title: "Well diagnostics",
      icon: Activity,
      detail: "Trace rate changes to pressure, pump load and water cut.",
    },
    {
      id: "scenarios",
      title: "Export contingency",
      icon: Waves,
      detail: "Balance export capacity, free storage and production.",
    },
    {
      id: "actions",
      title: "Engineering review",
      icon: ClipboardCheck,
      detail: "Assign a review and record the measured outcome.",
    },
  ];
  return (
    <div className="operations-intro">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            OPERATIONS BRIEF / KZ · WESTERN REGION
          </span>
          <h1>Production & export workbench</h1>
          <p className="muted">
            A connected engineering review from the wellhead to available export
            capacity.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onLaunch}>
          Open field overview <ArrowRight size={16} />
        </button>
      </div>
      <div className="brief-workbench">
        <section className="brief-stage">
          <div className="module-header">
            <span>
              <Box size={15} /> FIELD MODEL / KT
            </span>
            <span>ILLUSTRATIVE GEOMETRY</span>
          </div>
          <FieldModel wells={wells} hero onToast={onToast} />
          <div className="brief-instruments">
            <div>
              <span>SIMULATED OIL RATE</span>
              <strong>
                {number(portfolio.totalOilBpd)} <small>bpd</small>
              </strong>
            </div>
            <div>
              <span>WELL INVENTORY</span>
              <strong>
                {portfolio.wellCount.toString().padStart(2, "0")}{" "}
                <small>assets</small>
              </strong>
            </div>
            <div>
              <span>REVIEW FLAGS</span>
              <strong>
                {alerts.length.toString().padStart(2, "0")} <small>wells</small>
              </strong>
            </div>
          </div>
        </section>
        <aside className="operating-brief panel">
          <span className="eyebrow">THE OPERATING PROBLEM</span>
          <h2>
            Production shortfalls.
            <br />
            Export constraints.
          </h2>
          <p>
            Oil rate, pump load and operating events arrive as separate signals.
            When export capacity falls, storage headroom becomes another
            constraint.
          </p>
          <div className="process-chain">
            <span>WELLHEAD</span>
            <ArrowRight size={14} />
            <span>STORAGE</span>
            <ArrowRight size={14} />
            <span>EXPORT</span>
          </div>
          <h3>One traceable engineering workflow</h3>
          <ol className="brief-procedure">
            <li>Locate the shortfall and inspect measured evidence.</li>
            <li>Compare available evacuation and storage headroom.</li>
            <li>Record the proposed review and its measured outcome.</li>
          </ol>
          <div className="callout">
            <CircleHelp size={17} />
            <p>
              Simulated field and transparent review rules. Engineering
              validation is required before operational use.
            </p>
          </div>
        </aside>
      </div>
      <div className="module-launchers">
        {modules.map((item, index) => (
          <button key={item.id} onClick={() => onNavigate?.(item.id)}>
            <span className="launcher-number">0{index + 1}</span>
            <item.icon size={20} />
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}
function Overview({ wells, selectedId, onSelect, onNavigate, onToast }) {
  const p = getPortfolio(wells),
    alerts = detectAnomalies(wells),
    selected = wells.find((well) => well.id === selectedId) || wells[0];
  return (
    <>
      <div className="page-heading overview-heading">
        <div>
          <span className="eyebrow">FIELD SURVEILLANCE / PRODUCTION</span>
          <h1>Field overview</h1>
          <p className="muted">
            {wells[0]?.dataMode === "simulated"
              ? "Karatau demonstration field · Western Kazakhstan"
              : "Imported portfolio · Snapshot analysis"}
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => onNavigate("scenarios")}
        >
          <Waves size={16} /> Export planning <ArrowRight size={16} />
        </button>
      </div>
      <div className="instrument-strip">
        {[
          {
            label: "Current oil production",
            value: number(p.totalOilBpd),
            unit: "bpd",
            detail: number(p.attainmentPct, 1) + "% of portfolio reference",
          },
          {
            label: "Reference shortfall",
            value: number(p.shortfallBpd),
            unit: "bpd",
            detail: "Not proven recoverable loss",
          },
          {
            label: "Operating wells",
            value: p.activeWells,
            unit: "/ " + p.wellCount,
            detail:
              p.offlineCount +
              " offline · " +
              p.healthyCount +
              " within thresholds",
          },
          {
            label: "Review flags",
            value: alerts.length,
            unit: "wells",
            detail:
              alerts.filter((a) => a.severity === "critical").length +
              " priority · ordered by impact",
          },
        ].map((item) => (
          <div className="instrument" key={item.label}>
            <span className="section-label">{item.label}</span>
            <div>
              {item.value}
              <small>{item.unit}</small>
            </div>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
      <div className="field-workbench">
        <section className="overview-stage" aria-label="Field explorer">
          <div className="module-header">
            <span>
              <Layers3 size={15} /> FIELD EXPLORER
            </span>
            <span>MODEL / 3D</span>
          </div>
          <FieldModel
            wells={wells}
            selectedId={selectedId}
            onSelect={onSelect}
            onToast={onToast}
          />
        </section>
        <aside className="selected-asset panel">
          <span className="eyebrow">ASSET INSPECTOR</span>
          <div className="selected-asset-title">
            <h2>{selected?.id || "No asset"}</h2>
            <Badge status={selected?.status || "offline"} />
          </div>
          <div className="selected-summary">
            {[
              { label: "Oil production", value: selected?.oilBpd, unit: "bpd" },
              { label: "Pressure", value: selected?.pressurePsi, unit: "psi" },
              { label: "Pump load", value: selected?.pumpLoadPct, unit: "%" },
              { label: "Water cut", value: selected?.waterCutPct, unit: "%" },
            ].map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>
                  {number(item.value)}
                  <small>{item.unit}</small>
                </strong>
              </div>
            ))}
          </div>
          <p>
            {selected?.issue ||
              "Imported asset · verify measurements and operating context."}
          </p>
          <button
            className="btn btn-primary full"
            onClick={() => onNavigate("diagnostics")}
          >
            Inspect measurements <ArrowRight size={16} />
          </button>
          <span className="inspector-note">
            Select a well in the model or review register.
          </span>
        </aside>
      </div>
      <div className="review-workbench">
        <section className="review-table-section panel">
          <div className="panel-header">
            <h2>Exception register</h2>
            <span className="tag">{alerts.length} review items</span>
          </div>
          {alerts.length ? (
            <div className="table-wrap">
              <table className="review-table">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Well / observed signal</th>
                    <th>Shortfall</th>
                    <th aria-label="Open asset" />
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert, index) => (
                    <tr
                      key={alert.id}
                      className={selectedId === alert.wellId ? "selected" : ""}
                    >
                      <td>
                        <span className="review-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <Badge status={alert.severity}>
                          {alert.severity === "critical"
                            ? "Priority"
                            : "Review"}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="asset-text-button"
                          onClick={() => onSelect(alert.wellId)}
                        >
                          <strong>{alert.wellId}</strong>
                          <span>{alert.title}</span>
                        </button>
                      </td>
                      <td>
                        <strong>{number(alert.oilLossBpd)}</strong>
                        <small> bpd</small>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={"Inspect " + alert.wellId}
                          onClick={() => {
                            onSelect(alert.wellId);
                            onNavigate("diagnostics");
                          }}
                        >
                          <ArrowRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <ShieldCheck size={28} />
              <h3>No threshold alerts</h3>
              <p>
                Review measurement quality and reference values before drawing
                conclusions.
              </p>
            </div>
          )}
          <button
            className="text-link"
            onClick={() => onNavigate("diagnostics")}
          >
            Review all wells <ArrowRight size={15} />
          </button>
        </section>
        <section className="overview-trend panel">
          <div className="panel-header">
            <h2>Production history</h2>
            <span className="tag">
              {wells[0]?.dataMode === "simulated" ? "14 DAYS" : "SNAPSHOT ONLY"}
            </span>
          </div>
          <Trend wells={wells} />
          <p className="chart-footnote muted">
            {wells[0]?.dataMode === "simulated"
              ? "Simulated daily measurements. Reference is not a production forecast."
              : "Snapshot only. Historical measurements were not supplied."}
          </p>
          <div className="trend-next-step">
            <Waves size={21} />
            <div>
              <h3>Evaluate export headroom</h3>
              <p className="muted">
                Compare evacuation limits with production and free storage.
              </p>
            </div>
            <button
              className="icon-button"
              aria-label="Open export planning"
              onClick={() => onNavigate("scenarios")}
            >
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

function SearchDialog({ wells, onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const input = useRef(null),
    dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    input.current?.focus();
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const items = [
        ...dialog.current.querySelectorAll(
          'button,input,[href],[tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => !el.disabled);
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus?.();
    };
  }, []);
  const results = wells
    .filter((w) =>
      `${w.id} ${w.name} ${w.zone || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 12);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialog}
        className="modal command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search wells"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="command-input">
          <Search size={21} />
          <input
            ref={input}
            aria-label="Search wells"
            placeholder="Search wells by ID, name or zone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close search"
          >
            <X size={18} />
          </button>
        </div>
        <span className="section-label">ASSETS / {results.length} RESULTS</span>
        <div className="command-results">
          {results.map((w) => (
            <button key={w.id} onClick={() => onSelect(w.id)}>
              <span className={`dot ${w.status}`} />
              <div>
                <strong>{w.id}</strong>
                <small>
                  {w.name} · {w.zone || "Imported"}
                </small>
              </div>
              <span>{number(w.oilBpd)} bpd</span>
              <ArrowRight size={16} />
            </button>
          ))}
          {!results.length && (
            <p className="empty-state">No matching assets.</p>
          )}
        </div>
        <footer>
          Choose an asset to open diagnostics. <kbd>Esc</kbd> to close
        </footer>
      </div>
    </div>
  );
}

function App() {
  const initialHash = location.hash.slice(1);
  const [page, setPage] = useState(
    ["brief", ...nav.map((n) => n.id)].includes(initialHash)
      ? initialHash
      : "brief",
  );
  const [wells, setWells] = useState(DEMO_WELLS),
    [selectedId, setSelectedId] = useState("KT-012"),
    [search, setSearch] = useState(false),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState(""),
    [notifications, setNotifications] = useState(false);
  const [actions, setActions] = useState(() => {
    const stored = readStored("stratum-actions", []);
    return Array.isArray(stored)
      ? stored.filter(
          (a) =>
            a &&
            typeof a.id === "string" &&
            typeof a.title === "string" &&
            ["review", "in-progress", "completed"].includes(a.status),
        )
      : [];
  });
  const [sessionOnly, setSessionOnly] = useState(false);
  const toastTimer = useRef(null);
  const onToast = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  };
  const navigate = (id) => {
    setPage(id);
    location.hash = id;
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const change = () => {
      const id = location.hash.slice(1);
      if (["brief", ...nav.map((n) => n.id)].includes(id)) setPage(id);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
      if (e.key === "Escape") {
        setSearch(false);
        setMobile(false);
        setNotifications(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      clearTimeout(toastTimer.current);
    };
  }, []);
  const saveActions = (next) => {
    setActions(next);
    const persisted = persist("stratum-actions", next);
    setSessionOnly(!persisted);
    return persisted;
  };
  const createAction = (action) => {
    const duplicate = actions.find(
      (a) => a.wellId && a.wellId === action.wellId && a.status !== "completed",
    );
    if (duplicate) {
      onToast("An open review already exists for this well.");
      navigate("actions");
      return;
    }
    const persisted = saveActions([
      {
        ...action,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      },
      ...actions,
    ]);
    onToast(
      persisted
        ? "Review saved to this browser. No field command was sent."
        : "Review added for this session only. Browser storage is unavailable.",
    );
    return persisted;
  };
  const updateAction = (id, patch) => {
    const persisted = saveActions(
      actions.map((a) =>
        a.id === id
          ? { ...a, ...patch, updatedAt: new Date().toISOString() }
          : a,
      ),
    );
    onToast(
      persisted
        ? "Task update saved to this browser."
        : "Task updated for this session only. Browser storage is unavailable.",
    );
    return persisted;
  };
  const alerts = detectAnomalies(wells),
    isImported = wells.some((w) => w.dataMode !== "simulated"),
    pageLabel =
      page === "brief"
        ? "Operations brief"
        : nav.find((n) => n.id === page)?.label;
  return (
    <div className="shell">
      <aside className="module-rail">
        <button
          className="wordmark"
          onClick={() => navigate("brief")}
          aria-label="STRATUM problem and solution"
        >
          <span className="brand-mark">
            <Layers3 size={21} />
          </span>
          <span>
            STRATUM<small>FIELD OPERATIONS</small>
          </span>
        </button>
        <div className="rail-identity">
          <span>WORKSPACE / KZ</span>
          <strong>Production engineering</strong>
        </div>
        <nav className="module-navigation" aria-label="Main navigation">
          <button
            className={page === "brief" ? "active" : ""}
            onClick={() => navigate("brief")}
            aria-current={page === "brief" ? "page" : undefined}
          >
            <CircleHelp size={18} />
            <span>Operations brief</span>
            <small>00</small>
          </button>
          {nav.map((item, index) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              aria-current={page === item.id ? "page" : undefined}
              aria-label={item.label}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === "actions" &&
              actions.some((action) => action.status !== "completed") ? (
                <b>
                  {
                    actions.filter((action) => action.status !== "completed")
                      .length
                  }
                </b>
              ) : (
                <small>{"0" + (index + 1)}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="rail-foot">
          <div>
            <span className="status-dot" /> INDEPENDENT PROTOTYPE
          </div>
          <p>
            Engineering decision support
            <br />
            No equipment control
          </p>
          <span className="rail-version">STRATUM / 01.0</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="workbench-header">
          <div className="workspace-path">
            <span>OPERATIONS</span>
            <ChevronRight size={13} />
            <strong>{pageLabel}</strong>
          </div>
          <div className="workbench-tools">
            <span className="source-indicator">
              <i />
              {page === "geography"
                ? "Geographic context"
                : page !== "brief" && isImported
                  ? "Imported snapshot"
                  : "Demonstration data"}
            </span>
            <button
              className="masthead-search"
              onClick={() => setSearch(true)}
              aria-label="Find an asset"
            >
              <Search size={16} />
              <span>Find well</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button
              className="icon-button notification-button"
              aria-label={"Open " + alerts.length + " alerts"}
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={17} />
              {alerts.length > 0 && <i />}
            </button>
          </div>
        </header>
        <main className={"main main-" + page}>
          {sessionOnly && (
            <div className="callout storage-notice" role="alert">
              <TriangleAlert size={18} />
              <div>
                <strong>
                  Task changes are available for this session only
                </strong>
                <p>
                  Browser storage is unavailable. Reloading may discard your
                  latest task changes.
                </p>
              </div>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              className="page-content"
              key={page}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {page === "brief" && (
                <Brief
                  onNavigate={navigate}
                  onLaunch={() => navigate("overview")}
                  wells={DEMO_WELLS}
                  onToast={onToast}
                />
              )}
              {page === "overview" && (
                <Overview
                  wells={wells}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onNavigate={navigate}
                  onToast={onToast}
                />
              )}
              {page === "diagnostics" && (
                <DiagnosticsPage
                  wells={wells}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onCreateAction={createAction}
                />
              )}
              {page === "scenarios" && (
                <ScenarioPage
                  wells={wells}
                  onSaveScenario={(action) => {
                    createAction(action);
                    navigate("actions");
                  }}
                />
              )}
              {page === "actions" && (
                <ActionsPage
                  actions={actions}
                  onUpdateAction={updateAction}
                  onToast={onToast}
                />
              )}
              {page === "geography" && <Geography kind="oil" />}
              {page === "data" && (
                <DataPage
                  wells={wells}
                  isImported={isImported}
                  onImport={(imported) => {
                    setWells(imported);
                    setSelectedId(imported[0]?.id);
                    onToast(
                      `${imported.length} validated wells loaded for this session.`,
                    );
                  }}
                  onReset={() => {
                    setWells(DEMO_WELLS);
                    setSelectedId("KT-012");
                    onToast("Demonstration dataset restored.");
                  }}
                  onToast={onToast}
                />
              )}
            </motion.div>
          </AnimatePresence>
          <footer className="app-footer">
            <span>STRATUM / Production engineering workspace.</span>
            <a
              href="https://www.figma.com/design/iMgsV2pTWxWXvKclLUyTik/STRATUM"
              target="_blank"
              rel="noreferrer"
            >
              Design workspace ↗
            </a>
            <span>
              {page === "geography"
                ? "Public OSM map + mapped well records · demo assets remain unlocated"
                : page !== "brief" && isImported
                  ? "Imported snapshot · source accuracy unverified"
                  : "Simulated data · fictional assets"}{" "}
              <span className="muted">/</span> No live control
            </span>
          </footer>
        </main>
      </div>
      {search && (
        <SearchDialog
          wells={wells}
          onClose={() => setSearch(false)}
          onSelect={(id) => {
            setSelectedId(id);
            setSearch(false);
            navigate("diagnostics");
          }}
        />
      )}
      {notifications && (
        <div className="notification-popover">
          <div className="panel-header">
            <h3>Review queue</h3>
            <button
              className="icon-button"
              onClick={() => setNotifications(false)}
              aria-label="Close alerts"
            >
              <X size={16} />
            </button>
          </div>
          {alerts.length ? (
            alerts.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setSelectedId(a.wellId);
                  setNotifications(false);
                  navigate("diagnostics");
                }}
              >
                <TriangleAlert size={16} />
                <div>
                  <strong>{a.wellId}</strong>
                  <p>{a.title}</p>
                </div>
                <ChevronRight size={14} />
              </button>
            ))
          ) : (
            <p className="muted">No active threshold alerts.</p>
          )}
        </div>
      )}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <ShieldCheck size={18} />
            {toast}
            <button
              onClick={() => setToast("")}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

createRoot(document.getElementById("app")).render(<App />);
