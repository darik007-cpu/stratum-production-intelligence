import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** A completely local, procedural oilfield. Distances are illustrative, not survey data. */
export function createFieldScene(
  container,
  { wells = [], onSelect = () => {}, onReady = () => {} } = {},
) {
  let disposed = false;
  let frame = 0;
  let selectedId = wells[0]?.id;
  let running = true;
  let pumpSpeed = 1;
  let currentLayer = "surface";
  let cameraMotion = null;
  const cleanups = [];
  const materialCache = new Map();
  const animations = [];
  const wellObjects = new Map();
  const clickTargets = [];
  const particles = [];
  const geologicalPieces = [];
  const clampNumber = (value, min, max, fallback) =>
    Number.isFinite(Number(value))
      ? Math.min(max, Math.max(min, Number(value)))
      : fallback;
  const colors = {
    cyan: 0x68c6c9,
    lime: 0xe8c17c,
    amber: 0xf3b75a,
    red: 0xf18e74,
    dark: 0x293d49,
    steel: 0x91a7af,
    sand: 0x566a72,
  };
  const width = () => Math.max(container.clientWidth, 1);
  const height = () => Math.max(container.clientHeight, 1);
  const suppliedWells = wells.length
    ? wells
    : Array.from({ length: 8 }, (_, i) => ({
        id: `W-${String(i + 1).padStart(2, "0")}`,
        name: `Well ${i + 1}`,
        x: i % 4,
        z: Math.floor(i / 4),
        status: "normal",
      }));
  const statusColor = (status) =>
    /offline|stopped/i.test(status || "")
      ? 0x8b9c9a
      : /critical|alert|danger|high/i.test(status || "")
        ? colors.red
        : /warn|watch|attention|medium|at.risk/i.test(status || "")
          ? colors.amber
          : colors.cyan;
  const hasPositiveOutput = (well) => {
    const rate = Number(well?.oilBpd ?? well?.oilRate ?? 0);
    return (
      Number.isFinite(rate) &&
      rate > 0 &&
      !/offline|stopped/i.test(well?.operatingStatus || "") &&
      !/offline|stopped/i.test(well?.status || "")
    );
  };

  container.style.position = "relative";
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    const fallback = document.createElement("div");
    fallback.style.cssText =
      "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-height:320px;height:100%;color:#b9cac5;font:13px system-ui;padding:24px;text-align:center";
    const heading = document.createElement("strong");
    heading.textContent = "Your 3D field is ready for a WebGL-enabled browser.";
    const description = document.createElement("p");
    description.textContent =
      "You can still select a well and explore its production data.";
    const list = document.createElement("div");
    list.style.cssText =
      "display:flex;flex-wrap:wrap;gap:8px;justify-content:center";
    for (const well of suppliedWells) {
      const button = document.createElement("button");
      button.textContent = well.name || well.id;
      button.style.cssText =
        "padding:8px 12px;border:1px solid #50645e;background:#24322e;border-radius:6px;color:#d9e9df;cursor:pointer";
      button.addEventListener("click", () => onSelect(well.id, well));
      list.appendChild(button);
    }
    fallback.append(heading, description, list);
    container.appendChild(fallback);
    queueMicrotask(() =>
      onReady({ renderer: "fallback", wells: suppliedWells.length }),
    );
    return {
      selectWell: (id) => {
        selectedId = id;
      },
      setLayer() {},
      setView() {},
      setRunning() {},
      setPumpSpeed() {},
      setExplode() {},
      setCameraAngle() {},
      setTimeOfDay() {},
      resize() {},
      getSnapshot: () => null,
      exportScene: async () => {
        throw new Error("3D export requires WebGL support.");
      },
      dispose: () => fallback.remove(),
    };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setSize(width(), height());
  renderer.setClearColor(0x0e202c, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.domElement.style.cssText =
    "display:block;width:100%;height:100%;touch-action:none";
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive three-dimensional oilfield. Drag to orbit, scroll to zoom, or select a well. Use arrow keys to cycle wells.",
  );
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.tabIndex = 0;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x19323e, 0.0038);
  const camera = new THREE.PerspectiveCamera(37, width() / height(), 0.1, 350);
  camera.position.set(63, 48, 67);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 18;
  controls.maxDistance = 140;
  controls.minPolarAngle = 0.17;
  controls.maxPolarAngle = Math.PI / 2.13;
  controls.enablePan = true;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.7;
  controls.addEventListener("start", () => {
    cameraMotion = null;
  });

  const ambient = new THREE.HemisphereLight(0xc8e9e5, 0x48533c, 2.2);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffe2b8, 3.8);
  sun.position.set(-35, 65, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -65,
    right: 65,
    top: 65,
    bottom: -65,
    near: 0.1,
    far: 150,
  });
  sun.shadow.normalBias = 0.06;
  sun.shadow.bias = -0.0003;
  sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x88cdd8, 1.4);
  fill.position.set(30, 18, -30);
  scene.add(fill);

  const field = new THREE.Group();
  scene.add(field);
  const underground = new THREE.Group();
  underground.visible = false;
  field.add(underground);
  const surface = new THREE.Group();
  field.add(surface);
  const flowGroup = new THREE.Group();
  flowGroup.name = "Illustrative flow — positive-output wells only";
  flowGroup.userData = {
    note: "Flow markers indicate positive input production only. Animation speed is illustrative and is not a rate measurement.",
  };
  flowGroup.visible = false;
  field.add(flowGroup);

  function mat(color, options = {}) {
    const key = JSON.stringify([color, options]);
    if (!materialCache.has(key))
      materialCache.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.72,
          metalness: 0.18,
          ...options,
        }),
      );
    return materialCache.get(key);
  }
  function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function box(parent, w, h, d, x, y, z, color, options) {
    return mesh(
      new THREE.BoxGeometry(w, h, d),
      mat(color, options),
      parent,
      x,
      y,
      z,
    );
  }
  function cylinder(
    parent,
    radius,
    h,
    x,
    y,
    z,
    color,
    segments = 24,
    options = {},
  ) {
    return mesh(
      new THREE.CylinderGeometry(radius, radius, h, segments),
      mat(color, options),
      parent,
      x,
      y,
      z,
    );
  }
  function strut(parent, start, end, radius, color) {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const object = cylinder(
      parent,
      radius,
      a.distanceTo(b),
      ...a.clone().add(b).multiplyScalar(0.5).toArray(),
      color,
      8,
    );
    object.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.sub(a).normalize(),
    );
    return object;
  }
  function line(points, color, opacity = 1, parent = field) {
    const object = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        points.map((p) => new THREE.Vector3(...p)),
      ),
      new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
    );
    parent.add(object);
    return object;
  }
  function pipe(points, radius = 0.13, color = colors.steel, parent = surface) {
    const path = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
      false,
      "centripetal",
      0.15,
    );
    const object = mesh(
      new THREE.TubeGeometry(
        path,
        Math.max(12, points.length * 8),
        radius,
        6,
        false,
      ),
      mat(color, { metalness: 0.55, roughness: 0.4 }),
      parent,
    );
    return { object, path };
  }

  // A restrained, physically modelled terrain tile, with service roads and survey marks.
  const terrain = box(surface, 84, 0.7, 61, 0, -0.5, 0, 0x344e5d, {
    roughness: 0.98,
  });
  const terrainTop = box(surface, 83.6, 0.05, 60.6, 0, -0.12, 0, 0x466674, {
    roughness: 1,
  });
  const terrainEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(terrain.geometry),
    new THREE.LineBasicMaterial({
      color: 0x63818e,
      transparent: true,
      opacity: 0.3,
    }),
  );
  terrainEdge.position.copy(terrain.position);
  surface.add(terrainEdge);
  const grid = new THREE.GridHelper(84, 28, 0x7f9ba5, 0x7f9ba5);
  grid.position.y = -0.075;
  grid.scale.z = 61 / 84;
  grid.material.transparent = true;
  grid.material.opacity = 0.12;
  surface.add(grid);
  const roads = new THREE.Group();
  surface.add(roads);
  box(roads, 72, 0.035, 2.8, -1, -0.06, 24, 0x738086);
  box(roads, 2.8, 0.035, 48, 17, -0.06, 0, 0x738086);
  box(roads, 43, 0.035, 2.2, -6, -0.055, -15, 0x738086);
  for (let i = -35; i < 35; i += 5)
    box(roads, 1.5, 0.02, 0.06, i, -0.025, 24, 0xd5b580);

  // Geological strata become visible in the subsurface view.
  const strata = [0x776a56, 0x4d625f, 0x486f6c, 0x2b5353];
  strata.forEach((color, i) => {
    const layer = box(
      underground,
      83.5 - i * 0.8,
      1.65,
      60 - i * 0.6,
      0,
      -1.7 - i * 2,
      0,
      color,
      { transparent: true, opacity: 0.15, depthWrite: false, roughness: 1 },
    );
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(layer.geometry),
      new THREE.LineBasicMaterial({ color, opacity: 0.5, transparent: true }),
    );
    edges.position.copy(layer.position);
    underground.add(edges);
    geologicalPieces.push(
      { object: layer, originalY: layer.position.y },
      { object: edges, originalY: edges.position.y },
    );
  });
  const reservoir = mesh(
    new THREE.SphereGeometry(1, 36, 16),
    mat(0x5dc4ba, {
      transparent: true,
      opacity: 0.2,
      emissive: 0x226e67,
      emissiveIntensity: 0.35,
      depthWrite: false,
    }),
    underground,
    -7,
    -7.6,
    2,
  );
  reservoir.scale.set(26, 1.3, 18);
  const reservoirWire = new THREE.Mesh(
    reservoir.geometry,
    new THREE.MeshBasicMaterial({
      color: colors.cyan,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    }),
  );
  reservoirWire.position.copy(reservoir.position);
  reservoirWire.scale.copy(reservoir.scale);
  underground.add(reservoirWire);
  geologicalPieces.push(
    { object: reservoir, originalY: reservoir.position.y },
    { object: reservoirWire, originalY: reservoirWire.position.y },
  );

  const xs = suppliedWells.map((w) => Number(w.x)).filter(Number.isFinite);
  const zs = suppliedWells.map((w) => Number(w.z)).filter(Number.isFinite);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs);
  const positionFor = (well, i) => {
    const columns = Math.min(4, suppliedWells.length);
    const x =
      Number.isFinite(Number(well.x)) && maxX > minX
        ? -31 + ((Number(well.x) - minX) / (maxX - minX)) * 40
        : -29 + (i % columns) * 11;
    const z =
      Number.isFinite(Number(well.z)) && maxZ > minZ
        ? -10 + ((Number(well.z) - minZ) / (maxZ - minZ)) * 27
        : -8 + Math.floor(i / columns) * 12;
    return [x, z];
  };

  function makePumpjack(parent, index, color) {
    const pump = new THREE.Group();
    parent.add(pump);
    box(pump, 5.5, 0.19, 3.5, -0.5, 0.12, 0, 0x83939a, { roughness: 1 });
    box(pump, 3.4, 0.24, 1.6, -0.5, 0.35, 0, 0x364a43);
    // A-frame supporting the walking beam.
    for (const z of [-0.6, 0.6]) {
      strut(pump, [-1.3, 0.5, z], [0, 3, z], 0.13, colors.steel);
      strut(pump, [1.15, 0.5, z], [0, 3, z], 0.13, colors.steel);
      strut(pump, [-0.85, 1.4, z], [0.75, 1.4, z], 0.08, colors.steel);
    }
    strut(pump, [0, 3, -0.8], [0, 3, 0.8], 0.2, colors.dark);
    const beam = new THREE.Group();
    beam.position.y = 3.05;
    pump.add(beam);
    box(beam, 4.3, 0.24, 0.35, 0.2, 0, 0, colors.steel);
    box(beam, 3.8, 0.08, 0.6, 0.15, 0.16, 0, 0xe3bf78);
    // Curved horsehead is a genuine extruded profile.
    const profile = new THREE.Shape();
    profile.moveTo(0, 0.55);
    profile.lineTo(0.5, 0.55);
    profile.quadraticCurveTo(1.05, -0.15, 0.6, -1.1);
    profile.lineTo(-0.05, -1.1);
    profile.lineTo(0, 0.55);
    const horse = mesh(
      new THREE.ExtrudeGeometry(profile, {
        depth: 0.34,
        bevelEnabled: false,
        curveSegments: 8,
      }),
      mat(color, { metalness: 0.3 }),
      beam,
      1.95,
      -0.05,
      -0.17,
    );
    horse.castShadow = true;
    const motor = cylinder(pump, 0.38, 1.1, -1.7, 0.8, 0, 0x314b45, 12);
    motor.rotation.z = Math.PI / 2;
    const gear = cylinder(pump, 0.6, 0.6, -1.45, 1.3, 0, 0x607d6c, 16);
    gear.rotation.x = Math.PI / 2;
    const crank = new THREE.Group();
    crank.position.set(-1.45, 1.3, 0.45);
    pump.add(crank);
    box(crank, 0.18, 1.15, 0.16, 0, 0.2, 0, 0xd2b47b);
    box(crank, 0.58, 0.4, 0.3, 0, -0.4, 0, colors.dark);
    const rod = cylinder(pump, 0.035, 2.5, 2.55, 1.8, 0, colors.steel, 6);
    cylinder(pump, 0.2, 0.38, 2.55, 0.45, 0, 0x425b4d, 10);
    strut(pump, [2.55, 0.6, -0.48], [2.55, 0.6, 0.48], 0.1, 0x7da193);
    const valve = mesh(
      new THREE.TorusGeometry(0.23, 0.04, 6, 12),
      mat(color),
      pump,
      2.55,
      0.65,
      0.5,
    );
    animations.push({
      beam,
      crank,
      rod,
      index,
      active: hasPositiveOutput(suppliedWells[index]),
    });
    return pump;
  }

  function makeEspWellhead(parent, color) {
    const assembly = new THREE.Group();
    parent.add(assembly);
    box(assembly, 4.3, 0.2, 3, 0.6, 0.12, 0, 0x9ba88b, { roughness: 1 });
    cylinder(assembly, 0.42, 0.6, 1, 0.5, 0, 0x637f70, 16);
    cylinder(assembly, 0.22, 1.75, 1, 1.25, 0, 0x91afa0, 12);
    for (const y of [0.45, 0.8, 1.3, 1.9])
      cylinder(assembly, 0.35, 0.12, 1, y, 0, 0x3e6152, 16);
    box(assembly, 0.58, 0.45, 0.58, 1, 1.35, 0, 0x608574);
    strut(assembly, [0.25, 1.35, 0], [1.7, 1.35, 0], 0.12, 0x83a491);
    for (const [x, z, rotate] of [
      [0.12, 0, Math.PI / 2],
      [1.8, 0, Math.PI / 2],
      [1, 0.65, 0],
    ]) {
      const valve = mesh(
        new THREE.TorusGeometry(0.25, 0.045, 6, 16),
        mat(color),
        assembly,
        x,
        1.35,
        z,
      );
      valve.rotation.y = rotate;
    }
    cylinder(assembly, 0.16, 0.3, 1, 2.17, 0, color, 12);
    pipe(
      [
        [1.65, 1.35, 0],
        [2.15, 1.35, 0],
        [2.4, 0.45, 0],
        [2.6, 0.35, 0],
      ],
      0.12,
      colors.steel,
      assembly,
    );
    box(assembly, 1.25, 2.35, 0.75, -1.05, 1.4, -0.5, 0x93a58c);
    box(assembly, 1.37, 0.14, 0.88, -1.05, 2.65, -0.5, 0x3c5b4a);
    box(assembly, 0.5, 0.32, 0.02, -1.05, 2.05, -0.11, 0x204a43, {
      emissive: 0x4ca895,
      emissiveIntensity: 0.5,
    });
    for (let i = 0; i < 5; i++)
      box(assembly, 0.7, 0.03, 0.025, -1.05, 0.8 + i * 0.12, -0.1, 0x465f4c);
    pipe(
      [
        [-1.05, 0.4, -0.5],
        [-0.7, 0.25, -0.5],
        [0.5, 0.25, -0.5],
        [1, 0.6, 0],
      ],
      0.035,
      0x334e42,
      assembly,
    );
    return assembly;
  }

  suppliedWells.forEach((well, i) => {
    const [x, z] = positionFor(well, i);
    const color = statusColor(well.status);
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    surface.add(group);
    const pump = /ESP/i.test(well.liftType || "")
      ? makeEspWellhead(group, color)
      : makePumpjack(group, i, color);
    pump.rotation.y = -0.17;
    const pad = box(group, 8.2, 0.05, 6.4, 0, -0.015, 0, 0x76806a, {
      roughness: 1,
    });
    pad.receiveShadow = true;
    const ringMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = mesh(
      new THREE.RingGeometry(3.9, 3.96, 64),
      ringMaterial,
      group,
      0,
      0.06,
      0,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.scale.y = 0.81;
    const selection = mesh(
      new THREE.RingGeometry(4.1, 4.25, 64),
      new THREE.MeshBasicMaterial({
        color: colors.lime,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      group,
      0,
      0.08,
      0,
    );
    selection.rotation.x = -Math.PI / 2;
    selection.scale.y = 0.81;
    selection.visible = well.id === selectedId;
    const beacon = cylinder(group, 0.1, 0.12, -2.5, 3.8, -1.8, color, 10, {
      emissive: color,
      emissiveIntensity: 1.5,
    });
    strut(group, [-2.5, 0.25, -1.8], [-2.5, 3.7, -1.8], 0.035, colors.steel);
    const clickVolume = mesh(
      new THREE.BoxGeometry(8.5, 5.3, 6.5),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
      group,
      0,
      2.3,
      0,
    );
    clickVolume.castShadow = false;
    clickVolume.receiveShadow = false;
    clickVolume.userData.wellId = well.id;
    clickTargets.push(clickVolume);
    const connection = pipe(
      [
        [x + 2.5, 0.35, z],
        [x + 5, 0.35, z],
        [x + 5.3, 0.35, z - 3.5],
        [13, 0.35, z - 3.5],
        [14, 0.35, z - 4.5],
        [14, 0.35, -17],
        [21, 0.35, -17],
      ],
      0.105,
      0x93a992,
    );
    const oilRate = Number(well.oilBpd ?? well.oilRate ?? 0);
    const hasFlow = hasPositiveOutput(well);
    if (hasFlow) {
      for (let p = 0; p < 3; p++) {
        const particle = mesh(
          new THREE.SphereGeometry(0.16, 8, 6),
          new THREE.MeshBasicMaterial({ color: colors.lime }),
          flowGroup,
        );
        particle.name = `${well.id} illustrative positive flow ${p + 1}`;
        particle.userData = {
          sourceWellId: well.id,
          inputOilBpd: oilRate,
          measurement: false,
        };
        particles.push({
          object: particle,
          path: connection.path,
          offset: p / 3 + i * 0.034,
        });
      }
    }
    const bore = pipe(
      [
        [x + 2.5, 0, z],
        [x + 2.5, -2.5, z],
        [x + 2.4, -5.5, z],
        [x + 1, -7.3, z - 0.5],
        [x - 2, -7.8, z - 1.1],
      ],
      0.09,
      color,
      underground,
    );
    wellObjects.set(well.id, {
      well,
      group,
      position: new THREE.Vector3(x, 0, z),
      selection,
      ring,
      beacon,
      bore: bore.object,
    });
  });

  // Processing area: tanks, pipework, separators, heat exchangers and service buildings.
  const plant = new THREE.Group();
  plant.position.set(26, 0, -12);
  surface.add(plant);
  box(plant, 19, 0.15, 29, 0, 0, 0, 0x78836d, { roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const tx = i === 2 ? 3.9 : -4.4;
    const tz = i === 2 ? 5 : -7 + i * 8;
    const r = i === 2 ? 3.15 : 3.3;
    cylinder(plant, r + 0.25, 0.3, tx, 0.26, tz, 0x4b6053, 40);
    cylinder(plant, r, 3.5, tx, 2.1, tz, 0xa9b5a0, 48, {
      roughness: 0.48,
      metalness: 0.38,
    });
    cylinder(plant, r + 0.05, 0.13, tx, 3.86, tz, 0xb7c2aa, 48);
    mesh(
      new THREE.ConeGeometry(r, 0.45, 48),
      mat(0xa4bca9),
      plant,
      tx,
      4.12,
      tz,
    );
    for (const yy of [0.7, 3.45]) {
      const trim = mesh(
        new THREE.TorusGeometry(r + 0.015, 0.045, 6, 48),
        mat(0x536e60),
        plant,
        tx,
        yy,
        tz,
      );
      trim.rotation.x = Math.PI / 2;
    }
    for (let rung = 0; rung < 10; rung++)
      strut(
        plant,
        [tx + r + 0.13, 0.6 + rung * 0.34, tz - 0.23],
        [tx + r + 0.13, 0.6 + rung * 0.34, tz + 0.23],
        0.035,
        colors.dark,
      );
    for (const dz of [-0.25, 0.25])
      strut(
        plant,
        [tx + r + 0.13, 0.45, tz + dz],
        [tx + r + 0.13, 4.15, tz + dz],
        0.035,
        colors.dark,
      );
    cylinder(plant, 0.4, 0.25, tx, 4.45, tz, colors.dark, 12);
    pipe(
      [
        [tx, 0.45, tz + r],
        [tx, 0.45, tz + r + 1],
        [-8, 0.45, tz + r + 1],
        [-8, 0.45, -5],
      ],
      0.15,
      colors.steel,
      plant,
    );
  }
  for (let i = 0; i < 2; i++) {
    const sep = cylinder(plant, 0.9, 5, 3.8, 1.5, -8 + i * 3, 0xb5beb0, 24);
    sep.rotation.z = Math.PI / 2;
    for (const x of [2.2, 5.4])
      box(plant, 0.28, 1, 1.4, x, 0.6, -8 + i * 3, 0x4f695c);
    for (const x of [1.2, 6.4]) {
      const cap = mesh(
        new THREE.SphereGeometry(0.9, 16, 8),
        mat(0xb5beb0),
        plant,
        x,
        1.5,
        -8 + i * 3,
      );
      cap.scale.x = 0.3;
    }
  }
  for (let i = 0; i < 4; i++) {
    cylinder(plant, 0.37, 4 + (i % 2), -4 + i * 1.5, 2.4, 10, 0x739a88, 16);
    pipe(
      [
        [-4 + i * 1.5, 4.3, 10],
        [-4 + i * 1.5, 4.6, 10],
        [-4 + i * 1.5, 4.6, 8],
      ],
      0.1,
      colors.steel,
      plant,
    );
  }
  box(surface, 6.8, 2.2, 4.2, 29, 1.15, 14, 0x9ea890);
  box(surface, 7.1, 0.25, 4.5, 29, 2.4, 14, 0x476559);
  for (let i = 0; i < 4; i++)
    box(surface, 0.85, 0.8, 0.06, 26.6 + i * 1.5, 1.5, 16.13, 0x244641, {
      emissive: 0x395d56,
      emissiveIntensity: 0.25,
    });
  box(surface, 1, 1.6, 0.08, 30, 0.92, 16.15, 0x435e50);
  // Flare stack, communications mast, and a local substation.
  cylinder(surface, 0.14, 8.5, 36, 4.3, -25, 0x7b9786, 12);
  for (const dx of [-1.4, 1.4])
    strut(surface, [36 + dx, 0.1, -25], [36, 6.3, -25], 0.045, 0x69846e);
  const flare = mesh(
    new THREE.ConeGeometry(0.32, 0.9, 7),
    new THREE.MeshBasicMaterial({
      color: 0xe3b16d,
      transparent: true,
      opacity: 0.8,
    }),
    surface,
    36,
    8.9,
    -25,
  );
  for (let i = 0; i < 3; i++) {
    box(surface, 1.2, 1.6, 1.8, 23 + i * 2.4, 0.8, 21, 0x7b927e);
    for (let j = 0; j < 4; j++)
      box(surface, 0.08, 1.2, 1.9, 22.5 + i * 2.4 + j * 0.3, 0.8, 21, 0x405e4e);
  }
  // Fences use instanced geometries to keep the scene light.
  const fencePosts = [];
  for (let x = -39; x <= 39; x += 4) {
    fencePosts.push([x, 0.6, -28], [x, 0.6, 28]);
  }
  for (let z = -24; z <= 24; z += 4) {
    fencePosts.push([-39, 0.6, z], [39, 0.6, z]);
  }
  const posts = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.2, 4),
    mat(0x9ca88c),
    fencePosts.length,
  );
  const dummy = new THREE.Object3D();
  fencePosts.forEach((p, i) => {
    dummy.position.set(...p);
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);
  });
  surface.add(posts);
  for (const y of [0.45, 0.95])
    line(
      [
        [-39, y, -28],
        [39, y, -28],
        [39, y, 28],
        [-39, y, 28],
        [-39, y, -28],
      ],
      0x9aaf92,
      0.35,
      surface,
    );

  // Deterministic stones provide texture without any image downloads.
  const stones = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.34, 0),
    mat(0x79836a),
    120,
  );
  for (let i = 0; i < 120; i++) {
    const x = Math.sin(i * 73.19) * 40;
    const z = Math.cos(i * 31.7) * 29;
    dummy.position.set(x, 0.04, z);
    dummy.rotation.set(i, i * 0.3, i * 0.7);
    dummy.scale.set(0.6 + ((i * 17) % 9) / 10, 0.25, 0.7);
    dummy.updateMatrix();
    stones.setMatrixAt(i, dummy.matrix);
  }
  stones.receiveShadow = true;
  surface.add(stones);

  // Quiet billboards are projected from the actual world-space well positions.
  const labels = document.createElement("div");
  labels.style.cssText =
    "position:absolute;inset:0;pointer-events:none;overflow:hidden";
  labels.setAttribute("aria-hidden", "true");
  container.appendChild(labels);
  const labelItems = [];
  for (const [id, item] of wellObjects) {
    const label = document.createElement("div");
    label.style.cssText =
      "position:absolute;top:0;left:0;white-space:nowrap;font:10px ui-monospace,SFMono-Regular,monospace;letter-spacing:.08em;color:#d4e2d4;transform:translate(-50%,-50%);padding:4px 7px;border:1px solid rgba(175,203,174,.17);background:rgba(25,42,34,.82);border-radius:3px;transition:opacity .2s,border-color .2s;";
    label.textContent = id;
    labels.appendChild(label);
    labelItems.push({
      id,
      label,
      position: item.position.clone().add(new THREE.Vector3(0, 5.5, 0)),
    });
  }
  const plantLabel = document.createElement("div");
  plantLabel.textContent = "CENTRAL PROCESSING";
  plantLabel.style.cssText =
    "position:absolute;font:9px ui-monospace,monospace;letter-spacing:.12em;color:#afc1a8;white-space:nowrap;transform:translate(-50%,-50%)";
  labels.appendChild(plantLabel);
  const liveRegion = document.createElement("span");
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.style.cssText =
    "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";
  container.appendChild(liveRegion);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDown = null;
  function hitTest(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(clickTargets, false)[0]?.object.userData
      .wellId;
  }
  const down = (event) => {
    pointerDown = { x: event.clientX, y: event.clientY };
  };
  const up = (event) => {
    if (
      !pointerDown ||
      Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) >
        6
    ) {
      pointerDown = null;
      return;
    }
    pointerDown = null;
    const id = hitTest(event);
    if (id !== undefined) {
      selectWell(id);
      onSelect(id, wellObjects.get(id).well);
    }
  };
  const move = (event) => {
    if (!pointerDown)
      renderer.domElement.style.cursor =
        hitTest(event) !== undefined ? "pointer" : "grab";
  };
  const key = (event) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    const step = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
    const selectedIndex = suppliedWells.findIndex((w) => w.id === selectedId);
    const index = selectedIndex < 0 && step < 0 ? 0 : selectedIndex;
    const well =
      suppliedWells[
        (index + step + suppliedWells.length) % suppliedWells.length
      ];
    selectWell(well.id);
    onSelect(well.id, well);
  };
  for (const [name, handler] of [
    ["pointerdown", down],
    ["pointerup", up],
    ["pointermove", move],
    ["keydown", key],
  ]) {
    renderer.domElement.addEventListener(name, handler);
    cleanups.push(() => renderer.domElement.removeEventListener(name, handler));
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const time = new THREE.Clock();
  const projected = new THREE.Vector3();
  let elapsed = 0;
  let pumpElapsed = 0;

  function selectWell(id) {
    const selected = wellObjects.get(id);
    selectedId = selected ? id : null;
    for (const [key, item] of wellObjects) {
      item.selection.visible = key === selectedId;
      item.ring.material.opacity = key === selectedId ? 0.8 : 0.3;
    }
    liveRegion.textContent = selected
      ? `${selected.well.name || id} selected.`
      : id
        ? `${id} is selected in the workspace but is outside the visible 3D model. No visible well is highlighted.`
        : "No well is selected in the 3D model.";
  }
  function setLayer(layer) {
    currentLayer = String(layer || "surface").toLowerCase();
    const isSubsurface = /subsurface|reservoir|geology|underground/.test(
      currentLayer,
    );
    underground.visible = isSubsurface;
    flowGroup.visible = /flow|production|pipeline/.test(currentLayer);
    for (const ground of [terrain, terrainTop]) {
      ground.material = isSubsurface
        ? mat(0x617a67, { transparent: true, opacity: 0.13, depthWrite: false })
        : mat(ground === terrain ? 0x344e5d : 0x466674, { roughness: 1 });
    }
    roads.visible = !isSubsurface;
    stones.visible = !isSubsurface;
    grid.material.opacity = isSubsurface ? 0.05 : 0.12;
    if (isSubsurface)
      animateCamera(new THREE.Vector3(64, 32, 68), new THREE.Vector3(0, -4, 0));
  }
  function animateCamera(position, target) {
    cameraMotion = {
      from: camera.position.clone(),
      to: position,
      targetFrom: controls.target.clone(),
      targetTo: target,
      progress: 0,
    };
  }
  function setView(view) {
    const mode = String(view || "overview").toLowerCase();
    if (/top|plan/.test(mode))
      animateCamera(
        new THREE.Vector3(0.01, 103, 0.01),
        new THREE.Vector3(0, 0, 0),
      );
    else if (/detail|well|focus/.test(mode) && wellObjects.has(selectedId)) {
      const p = wellObjects.get(selectedId).position;
      animateCamera(
        p.clone().add(new THREE.Vector3(17, 13, 19)),
        p.clone().add(new THREE.Vector3(0, 1, 0)),
      );
    } else if (/front|side/.test(mode))
      animateCamera(new THREE.Vector3(0, 25, 100), new THREE.Vector3(0, 0, 0));
    else
      animateCamera(new THREE.Vector3(63, 48, 67), new THREE.Vector3(0, 0, 0));
  }
  // Visual exploration controls deliberately never modify well production data.
  function setPumpSpeed(multiplier) {
    pumpSpeed = clampNumber(multiplier, 0, 3, 1);
  }
  function setExplode(amount) {
    const separation = clampNumber(amount, 0, 1, 0);
    const depthScale = 1 + separation * 1.6;
    if (separation > 0 && !underground.visible) setLayer("subsurface");
    for (const { object, originalY } of geologicalPieces)
      object.position.y = originalY * depthScale;
    for (const item of wellObjects.values()) item.bore.scale.y = depthScale;
  }
  function setCameraAngle(degrees) {
    const angle = (clampNumber(degrees, 0, 360, 45) * Math.PI) / 180;
    const offset = camera.position.clone().sub(controls.target);
    const radius = Math.max(18, Math.hypot(offset.x, offset.z));
    cameraMotion = null;
    camera.position.x = controls.target.x + Math.sin(angle) * radius;
    camera.position.z = controls.target.z + Math.cos(angle) * radius;
    controls.update();
  }
  function setTimeOfDay(hour) {
    const value = clampNumber(hour, 0, 24, 12);
    const sunAngle = ((value - 6) / 12) * Math.PI;
    const daylight = Math.max(0, Math.sin(sunAngle));
    const dusk = daylight > 0 && daylight < 0.45;
    sun.position.set(
      Math.cos(sunAngle) * 60,
      Math.max(8, Math.sin(sunAngle) * 65),
      20,
    );
    sun.intensity = 0.15 + daylight * 3.65;
    sun.color.set(dusk ? 0xffb67a : daylight > 0 ? 0xffe2b8 : 0x84a9cc);
    ambient.intensity = 0.65 + daylight * 1.55;
    fill.intensity = 0.45 + daylight * 0.95;
    scene.fog.color.copy(
      new THREE.Color(0x15272e).lerp(new THREE.Color(0x19323e), daylight),
    );
  }
  function resize() {
    if (disposed) return;
    camera.aspect = width() / height();
    camera.updateProjectionMatrix();
    renderer.setSize(width(), height());
  }
  function projectLabel(label, position, selected = false) {
    projected.copy(position).project(camera);
    const visible =
      projected.z < 1 &&
      Math.abs(projected.x) < 1.05 &&
      Math.abs(projected.y) < 1.05;
    label.style.display = visible ? "block" : "none";
    if (!visible) return;
    label.style.left = `${(projected.x * 0.5 + 0.5) * width()}px`;
    label.style.top = `${(-projected.y * 0.5 + 0.5) * height()}px`;
    label.style.zIndex = selected ? "3" : "1";
  }
  function render() {
    if (disposed) return;
    frame = requestAnimationFrame(render);
    const dt = Math.min(time.getDelta(), 0.06);
    if (running && !reduceMotion) {
      elapsed += dt;
      pumpElapsed += dt * pumpSpeed;
    }
    if (cameraMotion) {
      cameraMotion.progress = Math.min(1, cameraMotion.progress + dt * 1.4);
      const t = cameraMotion.progress;
      const eased = t * t * (3 - 2 * t);
      camera.position.lerpVectors(cameraMotion.from, cameraMotion.to, eased);
      controls.target.lerpVectors(
        cameraMotion.targetFrom,
        cameraMotion.targetTo,
        eased,
      );
      if (t >= 1) cameraMotion = null;
    }
    for (const item of animations) {
      if (!item.active) continue;
      const phase =
        pumpElapsed * (0.9 + (item.index % 3) * 0.08) + item.index * 1.2;
      item.beam.rotation.z = Math.sin(phase) * 0.16;
      item.crank.rotation.z = phase;
      item.rod.position.y = 1.8 + Math.sin(phase) * 0.37;
    }
    for (const item of particles) {
      if (flowGroup.visible)
        item.object.position.copy(
          item.path.getPointAt((elapsed * 0.035 + item.offset) % 1),
        );
    }
    flare.scale.y = 1 + Math.sin(elapsed * 7) * 0.12;
    controls.update();
    labelItems.forEach(({ id, label, position }) => {
      const selected = id === selectedId;
      projectLabel(label, position, selected);
      label.style.color = selected ? "#deedb7" : "#c2d3c2";
      label.style.borderColor = selected
        ? "rgba(208,232,161,.6)"
        : "rgba(175,203,174,.15)";
      label.style.opacity = selected ? "1" : "0.8";
    });
    projectLabel(plantLabel, new THREE.Vector3(26, 7, -12));
    renderer.render(scene, camera);
  }
  selectWell(selectedId);
  controls.update();
  render();
  queueMicrotask(() => {
    if (!disposed)
      onReady({
        renderer: "WebGL",
        objects: renderer.info.memory.geometries,
        wells: wellObjects.size,
      });
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    cleanups.forEach((cleanup) => cleanup());
    controls.dispose();
    const geometries = new Set();
    const materials = new Set(materialCache.values());
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material)
        (Array.isArray(object.material)
          ? object.material
          : [object.material]
        ).forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    labels.remove();
    liveRegion.remove();
  }
  function getSnapshot({ transparent = false } = {}) {
    if (disposed) return null;
    const previousBackground = scene.background;
    if (!transparent) scene.background = new THREE.Color(0x26392e);
    renderer.render(scene, camera);
    const data = renderer.domElement.toDataURL("image/png");
    scene.background = previousBackground;
    return data;
  }

  async function exportScene({ includeSubsurface = true } = {}) {
    if (disposed) throw new Error("The field scene has been disposed.");
    const { GLTFExporter } =
      await import("three/addons/exporters/GLTFExporter.js");
    const exportRoot = new THREE.Scene();
    exportRoot.name = "STRATUM — Karatau demonstration oilfield";
    exportRoot.userData = {
      disclaimer:
        "Illustrative procedural geometry. Fictional field. Not an engineering survey.",
      units: "illustrative meters",
    };
    const model = field.clone(true);
    model.name = "Karatau procedural oilfield";
    const remove = [];
    model.traverse((object) => {
      if (object.userData.wellId !== undefined) remove.push(object);
    });
    remove.forEach((object) => object.removeFromParent());
    const subsurfaceClone = model.children[0];
    if (subsurfaceClone) subsurfaceClone.visible = includeSubsurface;
    // Surface data exports preserve exactly the currently visible operational layer.
    exportRoot.add(model);
    const keyLight = new THREE.DirectionalLight(0xffe6c4, 3.5);
    keyLight.position.set(-35, 65, 20);
    exportRoot.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xb2d7c9, 2);
    fillLight.position.set(30, 30, -30);
    exportRoot.add(fillLight);
    const output = await new GLTFExporter().parseAsync(exportRoot, {
      binary: true,
      onlyVisible: true,
      trs: false,
    });
    return new Blob([output], { type: "model/gltf-binary" });
  }
  return {
    selectWell,
    setLayer,
    setView,
    setRunning(value) {
      running = Boolean(value);
    },
    setPumpSpeed,
    setExplode,
    setCameraAngle,
    setTimeOfDay,
    resize,
    getSnapshot,
    exportScene,
    dispose,
  };
}
