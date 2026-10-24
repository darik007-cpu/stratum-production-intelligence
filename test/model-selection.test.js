import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Exercise the actual scene selection routine without constructing a GPU renderer.
// The objects below are the small part of Three.js state touched by this routine.
const source = await readFile(
  new URL("../src/field3d.js", import.meta.url),
  "utf8",
);
const selectionRoutine = source.match(
  /  function selectWell\(id\) \{[\s\S]*?(?=\n  function setLayer\()/,
)?.[0];
assert.ok(selectionRoutine, "The scene selection routine must be available");

function selectionHarness() {
  const wells = new Map(
    ["KT-001", "KT-002"].map((id) => [
      id,
      {
        well: { name: id },
        selection: { visible: false },
        ring: { material: { opacity: 0.3 } },
      },
    ]),
  );
  const liveRegion = { textContent: "" };
  const createSelection = new Function(
    "wellObjects",
    "liveRegion",
    `let selectedId = null;\n${selectionRoutine}\nreturn { selectWell, selectedId: () => selectedId };`,
  );
  return { wells, liveRegion, ...createSelection(wells, liveRegion) };
}

test("selecting an asset outside the visible model clears every former highlight", () => {
  const scene = selectionHarness();
  scene.selectWell("KT-001");
  assert.equal(scene.wells.get("KT-001").selection.visible, true);
  assert.equal(scene.wells.get("KT-001").ring.material.opacity, 0.8);

  scene.selectWell("IMPORT-081");
  assert.equal(scene.selectedId(), null);
  for (const well of scene.wells.values()) {
    assert.equal(well.selection.visible, false);
    assert.equal(well.ring.material.opacity, 0.3);
  }
  assert.match(
    scene.liveRegion.textContent,
    /IMPORT-081.*outside the visible 3D model/,
  );
  assert.match(scene.liveRegion.textContent, /No visible well is highlighted/);

  scene.selectWell("KT-002");
  assert.equal(scene.selectedId(), "KT-002");
  assert.equal(scene.wells.get("KT-001").selection.visible, false);
  assert.equal(scene.wells.get("KT-002").selection.visible, true);
  assert.equal(scene.liveRegion.textContent, "KT-002 selected.");
});

test("clearing a scene selection does not announce a nonexistent asset", () => {
  const scene = selectionHarness();
  scene.selectWell("KT-002");
  scene.selectWell(null);
  assert.equal(scene.selectedId(), null);
  assert.equal(scene.wells.get("KT-002").selection.visible, false);
  assert.equal(
    scene.liveRegion.textContent,
    "No well is selected in the 3D model.",
  );
});
