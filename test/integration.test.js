import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEMO_WELLS, validateWellCSV } from "../src/domain.js";

// Render the actual React pages in Node without browser automation.
const sourceURL = new URL("../src/pages.jsx", import.meta.url);
const require = createRequire(sourceURL);
const bundled = await transform(await readFile(sourceURL, "utf8"), {
  loader: "jsx",
  format: "cjs",
});
const loaded = { exports: {} };
new Function("require", "module", "exports", bundled.code)(
  require,
  loaded,
  loaded.exports,
);
const { DiagnosticsPage, ScenarioPage, ActionsPage, DataPage } = loaded.exports;
const render = (Component, props) =>
  renderToStaticMarkup(React.createElement(Component, props));
const headers =
  "id,name,oilBpd,baselineBpd,pressurePsi,pumpLoadPct,waterCutPct";

test("imported diagnostic page escapes HTML names and shows no simulated measurement history", () => {
  const { wells, errors } = validateWellCSV(
    `${headers}\nA-1,<img src=x onerror=alert(1)>,0,600,1300,80,30`,
  );
  assert.deepEqual(errors, []);
  const html = render(DiagnosticsPage, {
    wells,
    selectedId: "A-1",
    onSelect() {},
    onCreateAction() {},
  });
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img\b/);
  assert.match(html, /No historical measurements/);
  assert.match(html, /No production recorded/);
  assert.match(html, /Timestamp not provided/);
  assert.doesNotMatch(html, /14 days of simulated measurements/);
});

test("a known demo maintenance asset is clearly distinguished from an imported zero-rate asset", () => {
  const html = render(DiagnosticsPage, {
    wells: DEMO_WELLS,
    selectedId: "KT-019",
    onSelect() {},
    onCreateAction() {},
  });
  assert.match(html, /Planned maintenance recorded/);
  assert.match(html, /14 days of simulated measurements/);
  assert.doesNotMatch(html, /No historical measurements/);
});

test("scenario renders an empty production snapshot with a finite balanced state", () => {
  const { wells } = validateWellCSV(`${headers}\nA-1,Idle well,0,0,1300,0,0`);
  const html = render(ScenarioPage, { wells, onSaveScenario() {} });
  assert.match(html, /Unlimited/);
  assert.match(html, /Within available headroom/);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.match(html, /From your 1-well imported snapshot/);
});

test("action records escape untrusted imported strings and keep outcome text visible", () => {
  const html = render(ActionsPage, {
    actions: [
      {
        id: "review-1",
        title: "<script>alert(1)</script>",
        description: "<img src=x>",
        wellId: "<strong>A-1</strong>",
        status: "completed",
        priority: "critical",
        createdAt: "2026-10-23T12:00:00Z",
        resultNote: "Checked & confirmed.",
      },
    ],
    onUpdateAction() {},
    onToast() {},
  });
  assert.doesNotMatch(html, /<script>|<img\b|<strong>A-1<\/strong>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Checked &amp; confirmed/);
});

test("data workspace explicitly identifies imported snapshot provenance", () => {
  const { wells } = validateWellCSV(
    `${headers}\nA-1,Imported well,500,600,1300,80,30`,
  );
  const html = render(DataPage, {
    wells,
    isImported: true,
    onImport() {},
    onReset() {},
    onToast() {},
  });
  assert.match(html, /User-supplied well snapshot/);
  assert.match(html, /Unverified/);
  assert.match(html, /Timestamp and source not included in CSV/);
  assert.match(html, /Zero production does not establish a planned outage/);
});
