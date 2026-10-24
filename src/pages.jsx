import React, { useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  Download,
  FileSpreadsheet,
  Info,
  ListChecks,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Upload,
  Waves,
} from "lucide-react";
import {
  DEMO_WELLS,
  detectAnomalies,
  exportWellsCSV,
  getPortfolio,
  getWellHistory,
  runScenario,
  validateWellCSV,
} from "./domain.js";

const number = (value, maximumFractionDigits = 0) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value)
    : "—";
const statusLabel = (value) =>
  ({
    healthy: "Normal",
    warning: "Review",
    critical: "Priority",
    offline: "Offline",
  })[value] ?? value;
const statusClass = (value) =>
  ["critical", "warning", "healthy"].includes(value) ? `badge-${value}` : "";
const dateLabel = (value) =>
  value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Qyzylorda",
      }).format(new Date(value))
    : "Timestamp not provided";

function Heading({ eyebrow, title, children, action }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="muted">{children}</p>
      </div>
      {action}
    </div>
  );
}

function Metric({ label, value, unit, detail }) {
  return (
    <div className="metric-item">
      <span className="section-label">{label}</span>
      <div className="stat-number">
        {value}
        <small>{unit}</small>
      </div>
      {detail && <span className="muted">{detail}</span>}
    </div>
  );
}

function SeriesChart({
  data,
  series,
  unit = "bpd",
  title = "Production trend",
  floorZero = false,
}) {
  if (!data?.length)
    return (
      <div className="empty-state chart-empty">
        <Database size={30} />
        <h3>No historical measurements</h3>
        <p>
          This upload contains a snapshot. Connect or import a validated time
          series to display a trend.
        </p>
      </div>
    );
  const values = data
    .flatMap((row) => series.map((item) => row[item.key]))
    .filter(Number.isFinite);
  if (!values.length)
    return (
      <div className="empty-state">
        <p>No numeric trend values available.</p>
      </div>
    );
  const min = floorZero ? 0 : Math.max(0, Math.min(...values) * 0.88);
  const max = Math.max(min + 1, Math.max(...values) * 1.08);
  const w = 700,
    h = 254,
    left = 55,
    right = 17,
    top = 18,
    bottom = 33;
  const innerW = w - left - right,
    innerH = h - top - bottom;
  const px = (index) => left + (index / Math.max(1, data.length - 1)) * innerW;
  const py = (value) => top + ((max - value) / (max - min)) * innerH;
  const ticks = Array.from(
    { length: 4 },
    (_, index) => min + ((max - min) * index) / 3,
  );
  const labelIndices = [
    ...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]),
  ];
  return (
    <div className="chart">
      <div className="trend-legend">
        {series.map((item) => (
          <span key={item.key}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        <span className="muted chart-unit">{unit}</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={title}
        style={{ width: "100%", display: "block", overflow: "visible" }}
      >
        {ticks.map((value, index) => (
          <g key={index}>
            <line
              x1={left}
              y1={py(value)}
              x2={w - right}
              y2={py(value)}
              stroke="currentColor"
              opacity=".09"
            />
            <text
              x={left - 9}
              y={py(value) + 4}
              textAnchor="end"
              fontSize="10"
              fill="currentColor"
              opacity=".55"
            >
              {number(value)}
            </text>
          </g>
        ))}
        {series.map((item) => {
          const points = data
            .map((row, index) => `${px(index)},${py(row[item.key])}`)
            .join(" ");
          return (
            <g key={item.key}>
              {item.fill && (
                <polygon
                  points={`${left},${h - bottom} ${points} ${w - right},${h - bottom}`}
                  fill={item.color}
                  opacity=".07"
                />
              )}
              <polyline
                fill="none"
                stroke={item.color}
                strokeWidth={item.dashed ? 1.5 : 2.5}
                strokeDasharray={item.dashed ? "5 5" : undefined}
                points={points}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {data.map((row, index) => (
                <circle
                  key={index}
                  cx={px(index)}
                  cy={py(row[item.key])}
                  r={index === data.length - 1 ? 3.5 : 2}
                  fill={item.color}
                >
                  <title>{`${row.label ?? `Day ${row.day}`}: ${item.label} ${number(row[item.key], 1)} ${unit}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {labelIndices.map((index) => (
          <text
            key={index}
            x={px(index)}
            y={h - 7}
            textAnchor={
              index === 0
                ? "start"
                : index === data.length - 1
                  ? "end"
                  : "middle"
            }
            fontSize="11"
            fill="currentColor"
            opacity=".55"
          >
            {data[index].label ?? `Day ${number(data[index].day, 1)}`}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function DiagnosticsPage({
  wells,
  selectedId,
  onSelect,
  onCreateAction,
}) {
  const [query, setQuery] = useState("");
  const [metric, setMetric] = useState("production");
  const [createdFor, setCreatedFor] = useState([]);
  const selected = wells.find((well) => well.id === selectedId) ?? wells[0];
  const alerts = useMemo(() => detectAnomalies(wells), [wells]);
  const alert = alerts.find((item) => item.wellId === selected?.id);
  const visibleWells = wells.filter((well) =>
    `${well.id} ${well.name} ${well.zone}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const history = useMemo(
    () => (selected ? getWellHistory(selected, 14) : []),
    [selected],
  );
  const chartConfig = {
    production: {
      unit: "bpd",
      title: "Oil production and reference over fourteen days",
      series: [
        {
          key: "oilBpd",
          label: "Recorded production",
          color: "#65C6CD",
          fill: true,
        },
        {
          key: "baselineBpd",
          label: "Reference",
          color: "#8FA4A6",
          dashed: true,
        },
      ],
    },
    pressure: {
      unit: "psi",
      title: "Pressure over fourteen days",
      series: [
        { key: "pressurePsi", label: "Pressure", color: "#65C6CD", fill: true },
      ],
    },
    load: {
      unit: "%",
      title: "Pump load over fourteen days",
      series: [
        {
          key: "pumpLoadPct",
          label: "Pump load",
          color: "#F2BF75",
          fill: true,
        },
      ],
    },
  }[metric];
  if (!selected)
    return (
      <div className="empty-state">
        <Database />
        <h2>No wells available</h2>
        <p>Import a valid well snapshot from the Data workspace.</p>
      </div>
    );
  function createReview() {
    onCreateAction({
      title: alert
        ? `${selected.id} · ${alert.title}`
        : `${selected.id} · Review operating measurements`,
      description:
        alert?.recommendedAction ??
        "Review the available operating measurements and record verified findings.",
      wellId: selected.id,
      priority: alert?.severity ?? "normal",
      source: "diagnostics",
      status: "review",
      baselineBpd: selected.baselineBpd,
      oilBpd: selected.oilBpd,
    });
    setCreatedFor((previous) => [...previous, selected.id]);
  }
  return (
    <>
      <Heading
        eyebrow="WELL SURVEILLANCE / MEASUREMENTS"
        title="Well diagnostics"
        action={
          <span className="tag">
            <Activity size={14} />
            {alerts.length} {alerts.length === 1 ? "well needs" : "wells need"}{" "}
            review
          </span>
        }
      >
        Follow the evidence from a production change to the next engineering
        review.
      </Heading>
      <div className="diagnostic-layout">
        <aside className="panel well-selector">
          <div className="panel-header">
            <h3>Well portfolio</h3>
            <span className="tag">{wells.length}</span>
          </div>
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Search wells in diagnostics"
              placeholder="Search a well…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="well-selector-list">
            {visibleWells.map((well) => (
              <button
                key={well.id}
                className={`well-option ${selected.id === well.id ? "selected" : ""}`}
                onClick={() => onSelect(well.id)}
                aria-pressed={selected.id === well.id}
              >
                <span className={`status-dot status-${well.status}`} />
                <span>
                  <strong>{well.id}</strong>
                  <small>
                    {well.zone} · {well.liftType}
                  </small>
                </span>
                <span className="well-option-rate">
                  {number(well.oilBpd)}
                  <small>bpd</small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
            {!visibleWells.length && (
              <div className="empty-state">
                <p>No wells match “{query}”.</p>
              </div>
            )}
          </div>
        </aside>
        <div className="diagnostic-detail">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">
                  {selected.zone} sector · {selected.liftType}
                </div>
                <h2>
                  {selected.id} <span className="muted">/ {selected.name}</span>
                </h2>
              </div>
              <span className={`badge ${statusClass(selected.status)}`}>
                {statusLabel(selected.status)}
              </span>
            </div>
            <div className="metric-strip">
              <Metric
                label="Oil production"
                value={number(selected.oilBpd)}
                unit="bpd"
                detail={`${number(selected.baselineBpd)} bpd reference`}
              />
              <Metric
                label="Pressure"
                value={number(selected.pressurePsi)}
                unit="psi"
              />
              <Metric
                label="Pump load"
                value={number(selected.pumpLoadPct, 1)}
                unit="%"
              />
              <Metric
                label="Water cut"
                value={number(selected.waterCutPct, 1)}
                unit="%"
              />
            </div>
            <div className="panel-header chart-heading">
              <h3>Operating trend</h3>
              <div
                className="segmented"
                role="group"
                aria-label="Trend measurement"
              >
                {[
                  ["production", "Production"],
                  ["pressure", "Pressure"],
                  ["load", "Pump load"],
                ].map(([id, label]) => (
                  <button
                    className={metric === id ? "active" : ""}
                    aria-pressed={metric === id}
                    onClick={() => setMetric(id)}
                    key={id}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <SeriesChart data={history} {...chartConfig} />
            <div className="chart-footnote muted">
              {selected.dataMode === "simulated"
                ? "14 days of simulated measurements. Demonstration reference; not a production forecast."
                : "Imported snapshot. Measurement time and historical trends were not provided."}
            </div>
          </section>
          <div className="grid-two">
            <section className="panel evidence-panel">
              <div className="panel-header">
                <h3>What the evidence says</h3>
                <ListChecks size={18} />
              </div>
              {alert ? (
                <>
                  <span className={`badge ${statusClass(alert.severity)}`}>
                    {alert.category}
                  </span>
                  <h3>{alert.title}</h3>
                  <p className="muted">{alert.summary}</p>
                  <div className="evidence-list">
                    {alert.evidence.map((evidence, index) => (
                      <div
                        className="evidence-row"
                        key={`${evidence.metric}-${index}`}
                      >
                        <CircleDot size={14} />
                        <div>
                          <strong>
                            {evidence.label}
                            <span>{evidence.observed}</span>
                          </strong>
                          <p>{evidence.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="callout">
                    <Info size={15} />
                    <p>{alert.possibleCause}</p>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">
                  <ShieldCheck size={28} />
                  <h3>
                    {selected.plannedOutage
                      ? "Planned maintenance recorded"
                      : "No rule-based flags"}
                  </h3>
                  <p>
                    {selected.plannedOutage
                      ? "The demonstration includes a planned-outage record for this well. Its reference shortfall is reported separately."
                      : "Available measurements do not exceed the prototype review thresholds. This is not a guarantee of equipment health."}
                  </p>
                </div>
              )}
            </section>
            <section className="panel recommendation-panel">
              <div className="panel-header">
                <h3>Next useful action</h3>
                <ArrowRight size={18} />
              </div>
              <div className="recommendation-icon">
                <ListChecks size={25} />
              </div>
              <h3>
                {alert
                  ? "Validate, then investigate."
                  : "Keep the review traceable."}
              </h3>
              <p className="muted">
                {alert?.recommendedAction ??
                  "Review the measurements, confirm the operating context and record any findings for the next shift."}
              </p>
              <ol className="next-steps">
                <li>Check measurement quality and operating context.</li>
                <li>Record the verified cause and proposed response.</li>
                <li>Compare the measured outcome with the reference.</li>
              </ol>
              <button
                className="btn btn-primary"
                onClick={createReview}
                disabled={createdFor.includes(selected.id)}
              >
                {createdFor.includes(selected.id) ? (
                  <Check size={16} />
                ) : (
                  <Plus size={16} />
                )}
                {createdFor.includes(selected.id)
                  ? "Added to the review queue"
                  : "Create review task"}
              </button>
              <p className="muted small">
                Creates a local review record. No equipment command is sent.
              </p>
            </section>
          </div>
          <section className="panel">
            <div className="panel-header">
              <h3>Recent activity</h3>
              <span className="muted">{dateLabel(selected.lastUpdated)}</span>
            </div>
            {selected.events?.length ? (
              <div className="event-list">
                {selected.events.map((event) => (
                  <div className="event-row" key={event.id}>
                    <Clock3 size={15} />
                    <div>
                      <strong>{event.title}</strong>
                      <p className="muted">{event.detail}</p>
                    </div>
                    <time>{dateLabel(event.timestamp)}</time>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">
                No event history was included in this imported snapshot.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function ScenarioControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  help,
}) {
  return (
    <label className="range-field">
      <span className="section-label">{label}</span>
      <div className="range-value">
        <input
          aria-label={label}
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span>{unit}</span>
      </div>
      <input
        aria-label={`${label} slider`}
        type="range"
        min={min}
        max={Math.max(max, value)}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="muted small">{help}</span>
    </label>
  );
}

export function ScenarioPage({ wells, onSaveScenario }) {
  const portfolio = useMemo(() => getPortfolio(wells), [wells]);
  const [capacity, setCapacity] = useState(
    Math.round((portfolio.totalOilBpd * 0.5) / 100) * 100,
  );
  const [duration, setDuration] = useState(7);
  const [storage, setStorage] = useState(25000);
  const [optionId, setOptionId] = useState("smooth");
  const [saved, setSaved] = useState(false);
  const scenario = useMemo(
    () =>
      runScenario({
        wells,
        exportCapacityBpd: capacity,
        downtimeDays: duration,
        usableStorageBarrels: storage,
      }),
    [wells, capacity, duration, storage],
  );
  const inputChange = (setter) => (value) => {
    setter(value);
    setSaved(false);
  };
  const selectedOption = scenario.valid
    ? scenario.options.find((option) => option.id === optionId)
    : null;
  function savePlan() {
    if (!scenario.valid || !selectedOption?.feasible) return;
    onSaveScenario({
      title: `Export contingency · ${number(duration, 1)}-day plan`,
      description: `${selectedOption.title}. Available export: ${number(capacity)} bpd; free storage: ${number(storage)} bbl. Modeled curtailed volume: ${number(selectedOption.curtailedBarrels)} bbl. Engineering review is required before any operational use.`,
      source: "scenario",
      status: "review",
      priority: scenario.curtailmentBpd > 0 ? "warning" : "normal",
      optionId,
      scenario,
    });
    setSaved(true);
  }
  return (
    <>
      <Heading
        eyebrow="EVACUATION / STORAGE BALANCE"
        title="Export planning"
        action={
          <span className="tag">
            <Waves size={14} />
            Export & storage planning
          </span>
        }
      >
        See how an export interruption changes storage needs and production
        planning.
      </Heading>
      <div className="scenario-layout">
        <section className="panel scenario-inputs">
          <div className="panel-header">
            <h3>Define the interruption</h3>
            <span className="tag">Scenario</span>
          </div>
          <div className="scenario-production">
            <span className="section-label">Current portfolio production</span>
            <div className="stat-number">
              {number(portfolio.totalOilBpd)}
              <small>bpd</small>
            </div>
            <p className="muted small">
              {portfolio.dataMode === "simulated"
                ? `From the simulated ${wells.length}-well portfolio.`
                : `From your ${wells.length}-well imported snapshot.`}
            </p>
          </div>
          <ScenarioControl
            label="Available export capacity"
            value={capacity}
            min={0}
            max={Math.max(20000, portfolio.totalOilBpd)}
            step={100}
            unit="bpd"
            onChange={inputChange(setCapacity)}
            help="Total available oil evacuation across all routes."
          />
          <ScenarioControl
            label="Interruption duration"
            value={duration}
            min={0.5}
            max={30}
            step={0.5}
            unit="days"
            onChange={inputChange(setDuration)}
            help="Constant rates are assumed over this period; maximum 365 days."
          />
          <ScenarioControl
            label="Free usable storage"
            value={storage}
            min={0}
            max={100000}
            step={500}
            unit="bbl"
            onChange={inputChange(setStorage)}
            help="Available working headroom, after current inventory is excluded."
          />
          <button
            className="btn btn-ghost"
            onClick={() => {
              setCapacity(
                Math.round((portfolio.totalOilBpd * 0.5) / 100) * 100,
              );
              setDuration(7);
              setStorage(25000);
              setSaved(false);
            }}
          >
            <RotateCcw size={15} />
            Reset scenario
          </button>
        </section>
        <div className="scenario-results">
          {!scenario.valid ? (
            <section className="panel">
              <div className="callout">
                <AlertTriangle size={20} />
                <div>
                  <h3>Check the scenario inputs</h3>
                  {scenario.errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <>
              <div className="grid-three scenario-metrics">
                <section className="panel">
                  <Metric
                    label="Storage buffer"
                    value={
                      scenario.bufferDays === null
                        ? "Unlimited"
                        : number(scenario.bufferDays, 1)
                    }
                    unit={scenario.bufferDays === null ? "" : "days"}
                    detail={
                      scenario.bufferDays === null
                        ? "No daily accumulation"
                        : "At the current production rate"
                    }
                  />
                </section>
                <section className="panel">
                  <Metric
                    label="Uncovered volume"
                    value={number(scenario.storageShortfallBarrels)}
                    unit="bbl"
                    detail="Storage needed beyond free headroom"
                  />
                </section>
                <section className="panel">
                  <Metric
                    label="Average reduction needed"
                    value={number(scenario.curtailmentBpd)}
                    unit="bpd"
                    detail={`${number(scenario.curtailmentPct, 1)}% of current production`}
                  />
                </section>
              </div>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h3>The storage outlook</h3>
                    <p className="muted">
                      Required headroom across {number(duration, 1)} days
                    </p>
                  </div>
                  <span
                    className={`badge ${scenario.feasibleWithoutCurtailment ? "badge-healthy" : "badge-warning"}`}
                  >
                    {scenario.feasibleWithoutCurtailment
                      ? "Within available headroom"
                      : "A planning response is needed"}
                  </span>
                </div>
                <SeriesChart
                  data={scenario.timeline.map((row) => ({
                    ...row,
                    capacityBarrels: storage,
                  }))}
                  floorZero
                  unit="bbl"
                  title="Storage required without reduction and under the smooth-reduction option, compared with available headroom"
                  series={[
                    {
                      key: "requiredStorageBarrels",
                      label: "Current production",
                      color: "#F2BF75",
                    },
                    {
                      key: "plannedStorageBarrels",
                      label: "Smooth reduction",
                      color: "#65C6CD",
                      fill: true,
                    },
                    {
                      key: "capacityBarrels",
                      label: "Free headroom",
                      color: "#8FA4A6",
                      dashed: true,
                    },
                  ]}
                />
                <div className="callout">
                  <Info size={15} />
                  <p>
                    {scenario.feasibleWithoutCurtailment
                      ? "The available headroom covers this constant-rate scenario. Confirm actual capacity and operating constraints before relying on the result."
                      : `Current production would need ${number(scenario.storageShortfallBarrels)} bbl more than the available headroom. This is a planning deficit, not a forecast of a physical overflow.`}
                  </p>
                </div>
              </section>
              <section className="panel">
                <div className="panel-header">
                  <h3>Compare a response</h3>
                  <span className="muted">Select a plan for review</span>
                </div>
                <div className="scenario-options">
                  {scenario.options.map((option) => (
                    <label
                      className={`option-card ${optionId === option.id ? "selected" : ""}`}
                      key={option.id}
                    >
                      <div className="option-select">
                        <input
                          type="radio"
                          name="scenario-option"
                          value={option.id}
                          checked={optionId === option.id}
                          onChange={() => {
                            setOptionId(option.id);
                            setSaved(false);
                          }}
                        />
                        <span
                          className={`badge ${option.feasible ? "badge-healthy" : "badge-warning"}`}
                        >
                          {option.feasible
                            ? "Fits mass balance"
                            : "Insufficient storage"}
                        </span>
                      </div>
                      <h3>
                        {option.id === "hold"
                          ? "Maintain production"
                          : option.id === "smooth"
                            ? "Smooth the reduction"
                            : "Use the buffer first"}
                      </h3>
                      <p className="muted">
                        {option.id === "hold"
                          ? `Keep the current ${number(portfolio.totalOilBpd)} bpd throughout.`
                          : option.id === "smooth"
                            ? `Plan an average ${number(scenario.scenarioProductionBpd)} bpd throughout.`
                            : scenario.bufferDays === null
                              ? "No buffer draw is needed under these inputs."
                              : scenario.bufferDays >= duration
                                ? `The buffer covers this ${number(duration, 1)}-day interruption without reduction.`
                                : `Use the buffer for up to ${number(scenario.bufferDays, 1)} days, then match ${number(scenario.exportRateBpd)} bpd export capacity.`}
                      </p>
                      <div className="option-volume">
                        <strong>{number(option.curtailedBarrels)}</strong>
                        <span className="muted">
                          bbl curtailed over the period
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="scenario-save">
                  <p className="muted small">
                    Well-specific limits and restart constraints require
                    engineering review.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={savePlan}
                    disabled={!selectedOption?.feasible || saved}
                  >
                    {saved ? <Check size={16} /> : <Plus size={16} />}
                    {saved ? "Plan added to review" : "Save plan for review"}
                  </button>
                </div>
              </section>
              <details className="panel assumptions">
                <summary>
                  <Info size={15} />
                  Calculation & assumptions
                </summary>
                <p>{scenario.methodology}</p>
                <div className="conservation-check">
                  <CheckCircle2 size={15} />
                  <span>
                    Baseline potential volume:{" "}
                    {number(portfolio.totalOilBpd * duration)} bbl ={" "}
                    {number(scenario.exportedBarrels)} exported +{" "}
                    {number(scenario.plannedEndStorageBarrels)} stored +{" "}
                    {number(scenario.curtailedBarrels)} curtailed under the
                    smooth-reduction plan.
                  </span>
                </div>
                <ul>
                  {scenario.assumptions.map((assumption) => (
                    <li key={assumption}>{assumption}</li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const columns = [
  {
    id: "review",
    title: "Ready for review",
    subtitle: "Understand and confirm",
    icon: ListChecks,
  },
  {
    id: "in-progress",
    title: "In progress",
    subtitle: "Document the investigation",
    icon: Activity,
  },
  {
    id: "completed",
    title: "Completed",
    subtitle: "Keep an accountable record",
    icon: CheckCircle2,
  },
];

function ActionCard({ action, onUpdateAction, onToast }) {
  const [note, setNote] = useState(action.resultNote ?? "");
  const [expanded, setExpanded] = useState(false);
  function update(status) {
    if (status === "completed" && !note.trim()) {
      setExpanded(true);
      onToast?.("Add an outcome note before completing the task.");
      return;
    }
    onUpdateAction(action.id, {
      status,
      resultNote: note.trim(),
      ...(status === "completed"
        ? { completedAt: new Date().toISOString() }
        : {}),
    });
  }
  return (
    <article className="action-card">
      <div className="action-card-top">
        <span className={`badge ${statusClass(action.priority)}`}>
          {action.source === "scenario"
            ? "Scenario plan"
            : (action.wellId ?? "Engineering review")}
        </span>
        {action.priority === "critical" && (
          <span className="action-priority">
            <AlertTriangle size={13} />
            Priority
          </span>
        )}
      </div>
      <h3>{action.title}</h3>
      <p className="muted">
        {action.description ??
          action.summary ??
          "Review the supporting evidence and document your decision."}
      </p>
      <div className="action-meta">
        <Clock3 size={12} />
        <span>{dateLabel(action.createdAt)}</span>
      </div>
      {action.resultNote && action.status === "completed" && (
        <div className="action-outcome">
          <span className="section-label">Recorded outcome</span>
          <p>{action.resultNote}</p>
        </div>
      )}
      {action.status !== "completed" && (
        <>
          <button
            className="btn btn-ghost small"
            onClick={() => setExpanded((previous) => !previous)}
            aria-expanded={expanded}
          >
            {expanded ? "Hide outcome note" : "Add an outcome note"}
          </button>
          {expanded && (
            <label className="field">
              <span>Findings / outcome</span>
              <textarea
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What was checked, what was found, and what happened?"
              />
            </label>
          )}
        </>
      )}
      <div className="action-controls">
        {action.status === "review" && (
          <button
            className="btn btn-primary"
            onClick={() => update("in-progress")}
          >
            Start review
            <ArrowRight size={14} />
          </button>
        )}
        {action.status === "in-progress" && (
          <>
            <button
              className="btn btn-primary"
              onClick={() => update("completed")}
            >
              <Check size={14} />
              Complete task
            </button>
            <button
              className="btn btn-ghost"
              aria-label={`Return ${action.title} to review`}
              onClick={() => update("review")}
            >
              <RotateCcw size={14} />
            </button>
          </>
        )}
        {action.status === "completed" && (
          <button className="btn btn-ghost" onClick={() => update("review")}>
            <RotateCcw size={14} />
            Reopen review
          </button>
        )}
      </div>
    </article>
  );
}

export function ActionsPage({ actions = [], onUpdateAction, onToast }) {
  const completed = actions.filter(
    (action) => action.status === "completed",
  ).length;
  return (
    <>
      <Heading
        eyebrow="ENGINEERING / REVIEW REGISTER"
        title="Review actions"
        action={
          <span className="tag">
            <CheckCircle2 size={14} />
            {completed} of {actions.length} completed
          </span>
        }
      >
        A shared sequence for review, investigation and a recorded outcome.
      </Heading>
      <div className="callout workflow-notice">
        <Info size={16} />
        <p>
          This queue uses browser storage when available. Status changes record
          review activity; they do not dispatch crews, issue approvals to an
          external system, or control equipment.
        </p>
      </div>
      <div className="kanban">
        {columns.map((column) => {
          const Icon = column.icon;
          const items = actions.filter(
            (action) => (action.status ?? "review") === column.id,
          );
          return (
            <section
              className="kanban-column"
              key={column.id}
              aria-label={column.title}
            >
              <div className="panel-header">
                <div>
                  <h3>
                    <Icon size={16} />
                    {column.title}
                    <span className="tag">{items.length}</span>
                  </h3>
                  <p className="muted small">{column.subtitle}</p>
                </div>
              </div>
              {items.length ? (
                items.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    onUpdateAction={onUpdateAction}
                    onToast={onToast}
                  />
                ))
              ) : (
                <div className="empty-state">
                  <Icon size={25} />
                  <h3>
                    {column.id === "review"
                      ? "A clear queue."
                      : "Nothing here yet."}
                  </h3>
                  <p>
                    {column.id === "review"
                      ? "Create a review from Diagnostics or save a plan from Scenarios."
                      : column.id === "in-progress"
                        ? "Start a task after reviewing its evidence."
                        : "Completed tasks and recorded outcomes appear here."}
                  </p>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function downloadCSV(csv, fileName) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataPage({ wells, isImported, onImport, onReset, onToast }) {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [applied, setApplied] = useState(false);
  const fileInput = useRef(null);
  const portfolio = useMemo(() => getPortfolio(wells), [wells]);
  async function readFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setResult({
        wells: [],
        errors: ["Choose a CSV no larger than 5 MB."],
        warnings: [],
      });
      return;
    }
    setReading(true);
    setApplied(false);
    try {
      const text = await file.text();
      setCsv(text);
      setFileName(file.name);
      setResult(validateWellCSV(text));
    } catch {
      setResult({
        wells: [],
        errors: [
          "The file could not be read. Choose a plain-text CSV or paste its content.",
        ],
        warnings: [],
      });
    } finally {
      setReading(false);
    }
  }
  function importData() {
    if (!result?.wells.length || result.errors.length) return;
    onImport(result.wells);
    setApplied(true);
    onToast?.(`Imported ${result.wells.length} validated well snapshots.`);
  }
  return (
    <>
      <Heading
        eyebrow="MEASUREMENTS / DATA INTAKE"
        title="Field data"
        action={
          <button
            className="btn btn-ghost"
            onClick={() => {
              downloadCSV(exportWellsCSV(wells), "stratum-well-snapshot.csv");
              onToast?.("Current well snapshot downloaded.");
            }}
          >
            <Download size={15} />
            Export current data
          </button>
        }
      >
        Bring a well snapshot into the workspace, inspect it, then apply it.
      </Heading>
      <div className="grid-three data-metrics">
        <section className="panel">
          <Metric
            label="Active data source"
            value={isImported ? "Imported" : "Demo"}
            detail={
              isImported
                ? "User-supplied well snapshot"
                : "Fictional western Kazakhstan field"
            }
          />
        </section>
        <section className="panel">
          <Metric
            label="Wells in the workspace"
            value={number(wells.length)}
            detail={`${number(portfolio.totalOilBpd)} bpd recorded production`}
          />
        </section>
        <section className="panel">
          <Metric
            label="Measurement provenance"
            value={isImported ? "Unverified" : "Simulated"}
            detail={
              isImported
                ? "Timestamp and source not included in CSV"
                : "No connection to live equipment"
            }
          />
        </section>
      </div>
      <div className="grid-two data-layout">
        <section className="panel">
          <div className="panel-header">
            <h3>Import a well snapshot</h3>
            <FileSpreadsheet size={18} />
          </div>
          <button
            type="button"
            className="dropzone"
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              readFile(event.dataTransfer.files[0]);
            }}
            disabled={reading}
          >
            <Upload size={27} />
            <strong>
              {reading
                ? "Reading your file…"
                : fileName || "Drop a CSV here, or browse"}
            </strong>
            <span className="muted">
              Plain-text CSV · up to 5 MB · 5,000 wells
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => readFile(event.target.files[0])}
            aria-label="Upload well CSV"
          />
          <label className="field">
            <span>Or paste CSV content</span>
            <textarea
              className="csv-input"
              rows={9}
              spellCheck={false}
              value={csv}
              onChange={(event) => {
                setCsv(event.target.value);
                setResult(null);
                setApplied(false);
                setFileName("");
              }}
              placeholder={
                "id,name,oilBpd,baselineBpd,pressurePsi,pumpLoadPct,waterCutPct\nW-001,Example well,500,600,1300,80,30"
              }
            />
          </label>
          <div className="form-row">
            <button
              className="btn btn-primary"
              onClick={() => {
                setResult(validateWellCSV(csv));
                setApplied(false);
              }}
              disabled={!csv.trim() || reading}
            >
              <ShieldCheck size={15} />
              Validate snapshot
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                downloadCSV(
                  exportWellsCSV(DEMO_WELLS.slice(0, 3)),
                  "stratum-import-template.csv",
                );
                onToast?.(
                  "CSV template with three simulated example wells downloaded.",
                );
              }}
            >
              <Download size={15} />
              Get template
            </button>
          </div>
          {result && (
            <div className="validation-result" role="status" aria-live="polite">
              {result.errors.length ? (
                <>
                  <div className="callout">
                    <AlertTriangle size={17} />
                    <div>
                      <strong>Import needs attention</strong>
                      <p>No records have been applied.</p>
                    </div>
                  </div>
                  <ul className="validation-list">
                    {result.errors.slice(0, 12).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                  {result.errors.length > 12 && (
                    <p className="muted">
                      {result.errors.length - 12} more validation issues. Fix
                      these values and validate again.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="callout success">
                    <CheckCircle2 size={18} />
                    <div>
                      <strong>
                        {result.wells.length} well snapshots validated
                      </strong>
                      <p>Review the preview before applying the data.</p>
                    </div>
                  </div>
                  {result.warnings.length > 0 && (
                    <ul className="validation-list muted">
                      {result.warnings.slice(0, 8).map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={importData}
                    disabled={applied}
                  >
                    {applied ? <Check size={15} /> : <ArrowRight size={15} />}
                    {applied
                      ? "Snapshot applied"
                      : `Apply ${result.wells.length} wells to workspace`}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
        <div className="data-guidance">
          <section className="panel">
            <div className="panel-header">
              <h3>A predictable schema</h3>
              <Database size={18} />
            </div>
            <p className="muted">
              One row per well. Units and definitions stay consistent across the
              workspace.
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Meaning</th>
                    <th>Required</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["id", "Unique well identifier", "Yes"],
                    ["oilBpd", "Recorded oil, barrels/day", "Yes"],
                    ["baselineBpd", "Reference oil, barrels/day", "Yes"],
                    ["pressurePsi", "Pressure in psi", "Yes"],
                    ["pumpLoadPct", "Pump load, 0–100%", "Yes"],
                    ["waterCutPct", "Water cut, 0–100%", "Yes"],
                    ["name / status", "Name / source status label", "Optional"],
                    ["x / z", "Illustrative map coordinates", "Optional"],
                  ].map((row) => (
                    <tr key={row[0]}>
                      <td>
                        <code>{row[0]}</code>
                      </td>
                      <td>{row[1]}</td>
                      <td>{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">
              Valid source status values: healthy, warning, critical, offline.
              Displayed review status is recalculated from measurements;
              operating state is tracked separately from the oil rate. Zero
              production does not establish a planned outage.
            </p>
          </section>
          <section className="panel">
            <div className="panel-header">
              <h3>Know what the data can tell you</h3>
              <Info size={18} />
            </div>
            <div className="callout">
              <Info size={16} />
              <p>
                A snapshot supports comparison and transparent alerts. It cannot
                establish a historical trend, confirm a cause, or prove
                equipment health.
              </p>
            </div>
            <p className="muted">
              Missing map coordinates use an illustrative grid. All imported
              positions remain unverified. Demonstration histories are never
              attached to imported measurements.
            </p>
            <button
              className="btn btn-ghost"
              onClick={() => {
                onReset();
                setApplied(false);
                onToast?.("The simulated demonstration portfolio is restored.");
              }}
              disabled={!isImported}
            >
              <RotateCcw size={15} />
              Restore demonstration data
            </button>
          </section>
        </div>
      </div>
      {result?.wells.length > 0 && !result.errors.length && (
        <section className="panel csv-preview">
          <div className="panel-header">
            <h3>Validated preview</h3>
            <span className="muted">
              First {Math.min(result.wells.length, 8)} of {result.wells.length}{" "}
              wells
            </span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Well</th>
                  <th>Status</th>
                  <th>Oil · bpd</th>
                  <th>Reference · bpd</th>
                  <th>Pressure · psi</th>
                  <th>Pump load</th>
                  <th>Water cut</th>
                </tr>
              </thead>
              <tbody>
                {result.wells.slice(0, 8).map((well) => (
                  <tr key={well.id}>
                    <td>
                      <strong>{well.id}</strong>
                    </td>
                    <td>
                      <span className={`badge ${statusClass(well.status)}`}>
                        {statusLabel(well.status)}
                      </span>
                    </td>
                    <td>{number(well.oilBpd)}</td>
                    <td>{number(well.baselineBpd)}</td>
                    <td>{number(well.pressurePsi)}</td>
                    <td>{number(well.pumpLoadPct, 1)}%</td>
                    <td>{number(well.waterCutPct, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
