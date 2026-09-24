import * as THREE from "./node_modules/three/build/three.module.js";
import * as L from "leaflet";
import { MapControls } from "./node_modules/three/examples/jsm/controls/MapControls.js";
import { CSS2DObject, CSS2DRenderer } from "./node_modules/three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  createIcons,
  Search,
  Minus,
  Plus,
  LocateFixed,
  Share2,
  MapPin,
  Building2,
  Copy,
  Check,
  Map as MapIcon,
  ExternalLink,
  DoorOpen,
} from "lucide";
import {
  buildings,
  floors,
  spaces,
  connectors,
  floorById,
  buildingById,
  spacesOnFloor,
  structuralSpacesOnFloor,
  connectorsOnFloor,
  landmarksOnFloor,
  shortRoomLabel,
} from "./map-data.js";
import {
  campusBounds,
  campusLocations,
  campusPitch,
  campusEntrances,
} from "./campus-data.js";

const params = new URL(window.location.href).searchParams;
const requestedRoom = spaces.find((space) => space.id === params.get("room"));
const requestedFloor = floorById(params.get("floor"));
const initialFloor = requestedRoom ? floorById(requestedRoom.floorId) : requestedFloor || floorById("parter");

const state = {
  view: params.get("view") === "campus" ? "campus" : "indoor",
  buildingId: initialFloor.buildingId,
  floorId: initialFloor.id,
  activeRoomId: requestedRoom?.id || null,
  query: "",
  campusLocationId: "main",
};

const els = {
  search: document.querySelector("#roomSearch"),
  searchClear: document.querySelector("#searchClear"),
  buildingButtons: document.querySelector("#buildingButtons"),
  floorButtons: document.querySelector("#floorButtons"),
  buildingSelect: document.querySelector("#buildingSelect"),
  floorSelect: document.querySelector("#floorSelect"),
  floorTitle: document.querySelector("#floorTitle"),
  floorContext: document.querySelector("#floorContext"),
  floorNote: document.querySelector("#floorNote"),
  roomResults: document.querySelector("#roomResults"),
  resultCount: document.querySelector("#resultCount"),
  selectedPanel: document.querySelector("#selectedPanel"),
  selectedTitle: document.querySelector("#selectedTitle"),
  selectedMeta: document.querySelector("#selectedMeta"),
  selectedHint: document.querySelector("#selectedHint"),
  selectedStairs: document.querySelector("#selectedStairs"),
  shareRoom: document.querySelector("#shareRoom"),
  shareText: document.querySelector("#shareText"),
  zoomIn: document.querySelector("#zoomIn"),
  zoomOut: document.querySelector("#zoomOut"),
  resetView: document.querySelector("#resetView"),
  canvas: document.querySelector("#schoolScene"),
  mapViewport: document.querySelector("#mapViewport"),
  mapStatus: document.querySelector("#mapStatus"),
  fallbackMap: document.querySelector("#fallbackMap"),
  mapDescription: document.querySelector("#mapDescription"),
  appShell: document.querySelector("#appShell"),
  indoorView: document.querySelector("#indoorView"),
  campusView: document.querySelector("#campusView"),
  campusPanel: document.querySelector("#campusPanel"),
  campusMap: document.querySelector("#campusMap"),
  campusLocationSwitch: document.querySelector("#campusLocationSwitch"),
  campusDetailTitle: document.querySelector("#campusDetailTitle"),
  campusDetailText: document.querySelector("#campusDetailText"),
  campusOpenIndoor: document.querySelector("#campusOpenIndoor"),
};

createIcons({
  icons: {
    Search,
    Minus,
    Plus,
    LocateFixed,
    Share2,
    MapPin,
    Building2,
    Copy,
    Check,
    Map: MapIcon,
    ExternalLink,
    DoorOpen,
  },
  attrs: { "aria-hidden": "true", width: 18, height: 18 },
});

const normalize = (value) => String(value)
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim();

const currentFloor = () => floorById(state.floorId);
const activeRoom = () => spaces.find((space) => space.id === state.activeRoomId) || null;
const floorsForBuilding = (buildingId) => floors.filter((floor) => floor.buildingId === buildingId);

const searchResults = () => {
  const query = normalize(state.query);
  if (!query) return spacesOnFloor(state.floorId);

  return spaces.filter((space) => {
    const floor = floorById(space.floorId);
    const building = buildingById(floor.buildingId);
    const haystack = normalize([
      space.id,
      space.name,
      ...space.aliases,
      space.hint,
      floor.title,
      building.name,
    ].join(" "));
    return haystack.includes(query);
  });
};

const polygonBounds = (polygon) => {
  const xs = polygon.map(([x]) => x);
  const zs = polygon.map(([, z]) => z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
};

const floorOutlines = (floor) => floor.outlines || [floor.outline];
const floorCorridors = (floor) => floor.corridors || [floor.corridor];
const floorBounds = (floor) => polygonBounds(floorOutlines(floor).flat());

const shapeFromPolygon = (polygon) => {
  const shape = new THREE.Shape();
  polygon.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  return shape;
};

const makeExtrudedGeometry = (polygon, height) => {
  const geometry = new THREE.ExtrudeGeometry(shapeFromPolygon(polygon), {
    depth: height,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
};

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

const scenePalette = () => prefersDark.matches
  ? {
      background: 0x191918,
      ground: 0x222220,
      slab: 0x353530,
      corridor: 0x42423a,
      room: 0xeeeae2,
      roomSide: 0xbcb7ac,
      classroom: 0x4f8199,
      classroomSide: 0x31586b,
      administration: 0x9b7a32,
      administrationSide: 0x604a1d,
      gym: 0x5d875f,
      gymSide: 0x38563b,
      edge: 0x858175,
      accent: 0xffab66,
      accentSide: 0xad4700,
      stairs: 0x625e54,
      step: 0xf3efe6,
    }
  : {
      background: 0xf3f2ef,
      ground: 0xeeece7,
      slab: 0xdcd8ce,
      corridor: 0xfbfaf6,
      room: 0xffffff,
      roomSide: 0xd5d1c9,
      classroom: 0xcfe6f1,
      classroomSide: 0x9abecd,
      administration: 0xf2dfaa,
      administrationSide: 0xc7ad62,
      gym: 0xcfe4cb,
      gymSide: 0x94b68e,
      edge: 0x9b9588,
      accent: 0xd35f00,
      accentSide: 0x913b00,
      stairs: 0x4b4942,
      step: 0xf8f6f0,
    };

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-30, 30, 20, -20, 0.1, 500);
camera.position.set(38, 32, 38);

let renderer = null;
let labelRenderer = null;
let controls = null;
let webglAvailable = params.get("fallback") !== "1";
let homeView = null;

const floorGroup = new THREE.Group();
scene.add(floorGroup);

const roomMeshes = new Map();
const roomLabels = new Map();
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let hoveredRoomId = null;

const roomHoverTooltip = document.createElement("div");
roomHoverTooltip.className = "room-hover-tooltip";
roomHoverTooltip.hidden = true;
roomHoverTooltip.setAttribute("aria-hidden", "true");
els.mapViewport.appendChild(roomHoverTooltip);

const ambient = new THREE.HemisphereLight(0xffffff, 0xa7b8b0, 2.2);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 2.1);
sun.position.set(25, 40, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const labelsOverlap = (first, second, padding = 3) => !(
  first.right + padding < second.left
  || first.left - padding > second.right
  || first.bottom + padding < second.top
  || first.top - padding > second.bottom
);

const resolveLabelCollisions = () => {
  if (!labelRenderer) return;
  const labels = [...labelRenderer.domElement.querySelectorAll(".map-room-label, .map-landmark-label")];
  labels.forEach((label) => { label.style.visibility = ""; });

  const protectedLabels = labels.filter((label) => (
    label.classList.contains("map-landmark-label") || label.classList.contains("is-selected")
  ));
  const occupied = protectedLabels.map((label) => label.getBoundingClientRect());

  labels
    .filter((label) => label.classList.contains("map-room-label") && !label.classList.contains("is-selected"))
    .forEach((label) => {
      const bounds = label.getBoundingClientRect();
      if (occupied.some((other) => labelsOverlap(bounds, other))) {
        label.style.visibility = "hidden";
        return;
      }
      occupied.push(bounds);
    });
};

const renderScene = () => {
  if (!webglAvailable || !renderer || !labelRenderer) return;
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  resolveLabelCollisions();
};

const initializeScene = () => {
  if (!webglAvailable) return;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true, alpha: false });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.className = "map-label-layer";
    labelRenderer.domElement.setAttribute("aria-hidden", "true");
    els.mapViewport.appendChild(labelRenderer.domElement);

    controls = new MapControls(camera, labelRenderer.domElement);
    controls.enableRotate = false;
    controls.enableDamping = false;
    controls.screenSpacePanning = true;
    controls.minZoom = 0.7;
    controls.maxZoom = 2.8;
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.touches.ONE = THREE.TOUCH.PAN;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controls.addEventListener("change", renderScene);
  } catch (error) {
    webglAvailable = false;
  }
};

const disposeObject = (object) => {
  object.traverse?.((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose?.());
    else node.material?.dispose?.();
  });
};

const clearFloorGroup = () => {
  roomMeshes.clear();
  roomLabels.clear();
  hoveredRoomId = null;
  roomHoverTooltip.hidden = true;
  while (floorGroup.children.length) {
    const child = floorGroup.children[0];
    floorGroup.remove(child);
    disposeObject(child);
  }
};

const materialFor = (topColor, sideColor, roughness = 0.82) => [
  new THREE.MeshStandardMaterial({ color: sideColor, roughness }),
  new THREE.MeshStandardMaterial({ color: topColor, roughness }),
];

const roomTypeFor = (space) => {
  if (space.category === "administration") return "administration";
  if (space.category === "gym") return "gym";
  if (["classroom", "workshop"].includes(space.category)) return "classroom";
  return "neutral";
};

const addPolygonMesh = ({ polygon, height, y = 0, topColor, sideColor, edgeColor, edgeOpacity = 0.5 }) => {
  const geometry = makeExtrudedGeometry(polygon, height);
  const mesh = new THREE.Mesh(geometry, materialFor(topColor, sideColor));
  mesh.position.y = y;
  mesh.castShadow = height > 0.12;
  mesh.receiveShadow = true;
  floorGroup.add(mesh);

  if (edgeColor !== undefined) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 24),
      new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: edgeOpacity }),
    );
    edges.position.y = y + 0.003;
    floorGroup.add(edges);
  }
  return mesh;
};

const makeTextLabel = (text, className, position) => {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  const object = new CSS2DObject(element);
  object.position.set(position[0], position[1], position[2]);
  floorGroup.add(object);
  return object;
};

const addRoom = (space, palette) => {
  const selected = space.id === state.activeRoomId;
  const height = selected ? 0.92 : 0.42;
  const roomType = roomTypeFor(space);
  const topColor = palette[roomType] || palette.room;
  const sideColor = palette[`${roomType}Side`] || palette.roomSide;
  const mesh = addPolygonMesh({
    polygon: space.polygon,
    height,
    y: 0.03,
    topColor: selected ? palette.accent : topColor,
    sideColor: selected ? palette.accentSide : sideColor,
    edgeColor: selected ? palette.accentSide : palette.edge,
    edgeOpacity: selected ? 0.95 : 0.7,
  });
  mesh.userData.roomId = space.id;
  mesh.userData.selected = selected;
  roomMeshes.set(space.id, mesh);

  const [labelX, labelZ] = space.labelPoint;
  const label = makeTextLabel(
    shortRoomLabel(space),
    `map-room-label${selected ? " is-selected" : ""}`,
    [labelX, height + 0.34, labelZ],
  );
  roomLabels.set(space.id, label.element);
};

const addStructuralSpace = (space, palette) => {
  addPolygonMesh({
    polygon: space.polygon,
    height: 0.42,
    y: 0.03,
    topColor: palette.room,
    sideColor: palette.roomSide,
    edgeColor: palette.edge,
    edgeOpacity: 0.7,
  });
};

const addStairs = (connector, palette) => {
  const bounds = polygonBounds(connector.polygon);
  addPolygonMesh({
    polygon: connector.polygon,
    height: 0.1,
    y: 0.025,
    topColor: palette.stairs,
    sideColor: palette.stairs,
    edgeColor: palette.edge,
    edgeOpacity: 0.95,
  });

  const margin = Math.min(bounds.width, bounds.depth) * 0.1;
  const centerGap = Math.max(0.16, bounds.width * 0.08);
  const runWidth = (bounds.width - margin * 2 - centerGap) / 2;
  const stepDepth = (bounds.depth - margin * 2) / 7;
  const stairMaterial = new THREE.MeshStandardMaterial({ color: palette.step, roughness: 0.72 });
  const railMaterial = new THREE.MeshStandardMaterial({ color: palette.stairs, roughness: 0.62 });

  for (let run = 0; run < 2; run += 1) {
    for (let index = 0; index < 7; index += 1) {
      const riseIndex = run === 0 ? index : 6 - index;
      const stepHeight = 0.08 + riseIndex * 0.055;
      const geometry = new THREE.BoxGeometry(runWidth, stepHeight, stepDepth * 0.9);
      const step = new THREE.Mesh(geometry, stairMaterial);
      step.position.set(
        bounds.minX + margin + runWidth / 2 + run * (runWidth + centerGap),
        0.13 + stepHeight / 2,
        bounds.minZ + margin + stepDepth * (index + 0.5),
      );
      step.castShadow = true;
      step.receiveShadow = true;
      floorGroup.add(step);
    }
  }

  const landing = new THREE.Mesh(
    new THREE.BoxGeometry(bounds.width - margin * 2, 0.1, Math.max(stepDepth * 0.9, 0.24)),
    stairMaterial,
  );
  landing.position.set(bounds.centerX, 0.56, bounds.maxZ - margin - stepDepth * 0.45);
  landing.castShadow = true;
  floorGroup.add(landing);

  [bounds.minX + margin * 0.45, bounds.centerX, bounds.maxX - margin * 0.45].forEach((x) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.08, bounds.width * 0.025), 0.13, bounds.depth - margin * 1.2),
      railMaterial,
    );
    rail.position.set(x, 0.66, bounds.centerZ);
    rail.castShadow = true;
    floorGroup.add(rail);
  });

  makeTextLabel("SCHODY", "map-landmark-label is-stairs", [connector.labelPoint[0], 1.08, connector.labelPoint[1]]);
};

const addLandmark = (landmark) => {
  makeTextLabel(landmark.label, "map-landmark-label is-entrance", [landmark.point[0], 0.85, landmark.point[1]]);
};

const rebuildScene = () => {
  if (!webglAvailable) {
    renderFallbackMap();
    return;
  }

  clearFloorGroup();
  const palette = scenePalette();
  const floor = currentFloor();
  scene.background = new THREE.Color(palette.background);

  floorOutlines(floor).forEach((outline) => addPolygonMesh({
    polygon: outline,
    height: 0.24,
    y: -0.25,
    topColor: palette.slab,
    sideColor: palette.ground,
    edgeColor: palette.edge,
    edgeOpacity: 0.8,
  }));

  floorCorridors(floor).forEach((corridor) => addPolygonMesh({
    polygon: corridor,
    height: 0.06,
    y: 0,
    topColor: palette.corridor,
    sideColor: palette.corridor,
    edgeColor: palette.edge,
    edgeOpacity: 0.3,
  }));

  structuralSpacesOnFloor(state.floorId).forEach((space) => addStructuralSpace(space, palette));
  spacesOnFloor(state.floorId).forEach((space) => addRoom(space, palette));
  connectorsOnFloor(state.floorId).forEach((connector) => addStairs(connector, palette));
  landmarksOnFloor(state.floorId).forEach(addLandmark);

  fitCameraToFloor();
  renderScene();
};

const fitCameraToFloor = () => {
  if (!webglAvailable || !controls) return;
  const floor = currentFloor();
  const bounds = floorBounds(floor);
  const width = Math.max(els.mapViewport.clientWidth, 1);
  const height = Math.max(els.mapViewport.clientHeight, 1);
  const aspect = width / height;
  const isPortrait = width < 700;
  const footprint = isPortrait
    ? Math.max(bounds.width * 0.58, (bounds.depth / Math.max(aspect, 0.6)) * 0.62)
    : Math.max(bounds.depth * 1.8, bounds.width / Math.max(aspect, 0.5)) * 0.68;
  const frustum = Math.max(footprint, isPortrait ? 19 : 24);

  camera.left = -frustum * aspect;
  camera.right = frustum * aspect;
  camera.top = frustum;
  camera.bottom = -frustum;
  camera.near = 0.1;
  camera.far = 500;
  camera.zoom = isPortrait ? 1 : 1.18;
  if (isPortrait) camera.position.set(bounds.centerX + 42, 34, bounds.centerZ + 7);
  else camera.position.set(bounds.centerX + 35, 31, bounds.centerZ + 34);
  controls.target.set(bounds.centerX, 0, bounds.centerZ);
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
  controls.update();

  homeView = {
    position: camera.position.clone(),
    target: controls.target.clone(),
    zoom: camera.zoom,
  };
};

const resizeRenderer = () => {
  if (!webglAvailable || !renderer || !labelRenderer) return;
  const width = Math.max(els.mapViewport.clientWidth, 1);
  const height = Math.max(els.mapViewport.clientHeight, 1);
  const pixelRatioCap = width < 700 ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
  renderer.setSize(width, height, false);
  labelRenderer.setSize(width, height);
  fitCameraToFloor();
  renderScene();
};

const nearestStairName = (space) => {
  const floorConnectors = connectorsOnFloor(space.floorId);
  if (!floorConnectors.length) return "Na tej kondygnacji nie oznaczono klatki schodowej.";
  const [x, z] = space.labelPoint;
  const nearest = [...floorConnectors].sort((a, b) => {
    const da = Math.hypot(a.labelPoint[0] - x, a.labelPoint[1] - z);
    const db = Math.hypot(b.labelPoint[0] - x, b.labelPoint[1] - z);
    return da - db;
  })[0];
  const all = floorConnectors;
  const position = all.length > 1
    ? all.indexOf(nearest) === 0 ? "lewa" : all.indexOf(nearest) === all.length - 1 ? "prawa" : "środkowa"
    : "główna";
  return `Najbliższa klatka schodowa: ${position}.`;
};

const renderBuildingControls = () => {
  els.buildingButtons.innerHTML = buildings.map((building) => `
    <button
      class="building-button"
      type="button"
      data-building="${building.id}"
      aria-pressed="${building.id === state.buildingId}"
    >${building.shortName}</button>
  `).join("");

  els.buildingSelect.innerHTML = buildings.map((building) => `
    <option value="${building.id}"${building.id === state.buildingId ? " selected" : ""}>${building.shortName}</option>
  `).join("");
};

const renderFloorControls = () => {
  const available = floorsForBuilding(state.buildingId);
  els.floorButtons.innerHTML = available.map((floor) => `
    <button
      class="floor-button"
      type="button"
      data-floor="${floor.id}"
      aria-pressed="${floor.id === state.floorId}"
    >${floor.shortTitle}</button>
  `).join("");

  els.floorSelect.innerHTML = available.map((floor) => `
    <option value="${floor.id}"${floor.id === state.floorId ? " selected" : ""}>${floor.shortTitle}</option>
  `).join("");
};

const renderFloorHeader = () => {
  const floor = currentFloor();
  const building = buildingById(floor.buildingId);
  if (els.floorTitle.textContent !== floor.title) els.floorTitle.textContent = floor.title;
  if (els.floorContext.textContent !== building.name) els.floorContext.textContent = building.name;
  if (els.floorNote.textContent !== floor.note) els.floorNote.textContent = floor.note;
  els.mapDescription.textContent = `${building.name}, ${floor.title}. ${floor.note}`;
};

const renderSelected = () => {
  const selected = activeRoom();
  if (!selected) {
    const floor = currentFloor();
    els.selectedPanel.classList.add("is-empty");
    els.selectedTitle.textContent = "Wybierz salę";
    els.selectedMeta.textContent = `${buildingById(floor.buildingId).name}, ${floor.title}`;
    els.selectedHint.textContent = "Kliknij salę na planie albo wybierz ją z listy wyników.";
    els.selectedStairs.textContent = "Schody są oznaczone bezpośrednio na mapie.";
    els.shareRoom.hidden = true;
    els.mapStatus.textContent = "Wybierz salę, aby zobaczyć jej położenie.";
    return;
  }

  const floor = floorById(selected.floorId);
  const building = buildingById(floor.buildingId);
  els.selectedPanel.classList.remove("is-empty");
  els.selectedTitle.textContent = selected.name;
  els.selectedMeta.textContent = `${building.name}, ${floor.title}`;
  els.selectedHint.textContent = selected.hint;
  els.selectedStairs.textContent = nearestStairName(selected);
  els.shareRoom.hidden = false;
  els.shareText.textContent = "Udostępnij salę";
  els.shareRoom.dataset.icon = "share";
  els.mapStatus.textContent = `${selected.name}. ${floor.title}. ${selected.hint}`;
};

const renderResults = () => {
  const results = searchResults();
  els.resultCount.textContent = results.length;
  els.searchClear.hidden = !state.query;

  if (!results.length) {
    els.roomResults.innerHTML = `
      <p class="empty-state">Nie znaleziono takiego miejsca. Spróbuj wpisać sam numer sali albo krótszą nazwę.</p>
    `;
    return;
  }

  els.roomResults.innerHTML = results.map((space) => {
    const floor = floorById(space.floorId);
    const building = buildingById(floor.buildingId);
    const selected = space.id === state.activeRoomId;
    return `
      <button
        class="room-result room-type-${roomTypeFor(space)}${selected ? " is-selected" : ""}"
        type="button"
        data-room="${space.id}"
        aria-pressed="${selected}"
      >
        <span class="room-number">${shortRoomLabel(space)}</span>
        <span class="room-result-copy">
          <strong>${space.name}</strong>
          <small>${building.shortName}, ${floor.shortTitle}</small>
        </span>
        <span class="room-result-arrow" aria-hidden="true">›</span>
      </button>
    `;
  }).join("");
};

const renderFallbackMap = () => {
  const floor = currentFloor();
  const bounds = floorBounds(floor);
  const padding = 3;
  const polygonPoints = (polygon) => polygon.map(([x, z]) => `${x},${z}`).join(" ");
  const selectedId = state.activeRoomId;

  els.fallbackMap.innerHTML = `
    <svg
      viewBox="${bounds.minX - padding} ${bounds.minZ - padding} ${bounds.width + padding * 2} ${bounds.depth + padding * 2}"
      role="img"
      aria-labelledby="fallbackTitle fallbackDesc"
      preserveAspectRatio="xMidYMid meet"
    >
      <title id="fallbackTitle">Plan: ${floor.title}</title>
      <desc id="fallbackDesc">${floor.note}</desc>
      ${floorOutlines(floor).map((outline) => `
        <polygon class="svg-floor" points="${polygonPoints(outline)}" />
      `).join("")}
      ${floorCorridors(floor).map((corridor) => `
        <polygon class="svg-corridor" points="${polygonPoints(corridor)}" />
      `).join("")}
      ${structuralSpacesOnFloor(floor.id).map((space) => `
        <polygon class="svg-structure" points="${polygonPoints(space.polygon)}" />
      `).join("")}
      ${spacesOnFloor(floor.id).map((space) => `
        <g class="svg-room room-type-${roomTypeFor(space)}${space.id === selectedId ? " is-selected" : ""}" data-svg-room="${space.id}">
          <title>${space.name}</title>
          <polygon points="${polygonPoints(space.polygon)}" />
          <text x="${space.labelPoint[0]}" y="${space.labelPoint[1]}" text-anchor="middle" dominant-baseline="middle">${shortRoomLabel(space)}</text>
        </g>
      `).join("")}
      ${connectorsOnFloor(floor.id).map((connector) => `
        <g class="svg-stairs">
          <polygon points="${polygonPoints(connector.polygon)}" />
          ${Array.from({ length: 6 }, (_, index) => {
            const stairBounds = polygonBounds(connector.polygon);
            const z = stairBounds.minZ + ((index + 1) / 7) * stairBounds.depth;
            return `<line x1="${stairBounds.minX + stairBounds.width * 0.12}" y1="${z}" x2="${stairBounds.maxX - stairBounds.width * 0.12}" y2="${z}" />`;
          }).join("")}
          <text x="${connector.labelPoint[0]}" y="${connector.labelPoint[1]}" text-anchor="middle">Schody</text>
        </g>
      `).join("")}
    </svg>
  `;
};

const campusMapState = {
  map: null,
  locationLayers: new Map(),
  locationLabels: new Map(),
};

const campusColors = () => {
  const styles = getComputedStyle(document.documentElement);
  return {
    accent: styles.getPropertyValue("--accent").trim(),
    accentStrong: styles.getPropertyValue("--accent-strong").trim(),
    line: styles.getPropertyValue("--line").trim(),
    surface: styles.getPropertyValue("--surface-strong").trim(),
    ink: styles.getPropertyValue("--ink").trim(),
  };
};

const locationStyle = (locationId) => {
  const colors = campusColors();
  const selected = locationId === state.campusLocationId;
  return {
    color: selected ? colors.accentStrong : colors.ink,
    weight: selected ? 4 : 2,
    fillColor: selected ? colors.accent : colors.surface,
    fillOpacity: selected ? 0.72 : 0.52,
  };
};

const updateCampusLayerStyles = () => {
  campusMapState.locationLayers.forEach((layer, locationId) => {
    layer.setStyle(locationStyle(locationId));
  });
  campusMapState.locationLabels.forEach((label, locationId) => {
    label.getElement()?.classList.toggle("is-selected", locationId === state.campusLocationId);
  });
};

const renderCampusSelection = () => {
  const selected = campusLocations.find((location) => location.id === state.campusLocationId) || campusLocations[0];
  els.campusLocationSwitch.querySelectorAll("[data-campus-location]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.campusLocation === selected.id));
  });
  els.campusDetailTitle.textContent = selected.name;
  els.campusDetailText.textContent = selected.detail;
  updateCampusLayerStyles();
};

const selectCampusLocation = (locationId, focusMap = true) => {
  const location = campusLocations.find((item) => item.id === locationId);
  if (!location) return;
  state.campusLocationId = location.id;
  renderCampusSelection();
  const layer = campusMapState.locationLayers.get(location.id);
  if (focusMap && layer && campusMapState.map) {
    campusMapState.map.flyToBounds(layer.getBounds(), {
      padding: [70, 70],
      maxZoom: 20,
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  }
};

const initializeCampusMap = () => {
  if (campusMapState.map) return;
  const map = L.map(els.campusMap, {
    zoomControl: true,
    attributionControl: true,
    minZoom: 17,
    maxZoom: 21,
  });
  campusMapState.map = map;

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 19,
    maxZoom: 21,
  }).addTo(map);
  map.fitBounds(campusBounds, { padding: [20, 20] });

  L.geoJSON(campusPitch, {
    interactive: false,
    style: {
      color: "#39734f",
      weight: 2,
      fillColor: "#63b77a",
      fillOpacity: 0.35,
    },
  }).addTo(map).bindTooltip("Zielone boisko", {
    permanent: true,
    direction: "center",
    className: "campus-label campus-pitch-label",
  });

  campusLocations.forEach((location) => {
    const layer = L.geoJSON({
      type: "Feature",
      properties: { id: location.id, name: location.name },
      geometry: location.geometry,
    }, {
      style: locationStyle(location.id),
    }).addTo(map);
    layer.on("click", () => selectCampusLocation(location.id, false));
    campusMapState.locationLayers.set(location.id, layer);
    const label = L.tooltip({
      permanent: true,
      direction: "center",
      className: `campus-label${["gastronomy", "hairdressing"].includes(location.id) ? " campus-workshop-label" : ""}`,
    })
      .setLatLng(layer.getBounds().getCenter())
      .setContent(location.mapLabel)
      .addTo(map);
    campusMapState.locationLabels.set(location.id, label);
  });

  campusEntrances.forEach((entrance) => {
    const marker = L.circleMarker(entrance.coordinates, {
      radius: 7,
      color: "#7a3218",
      weight: 3,
      fillColor: "#f6a45f",
      fillOpacity: 1,
    }).addTo(map);
    marker.bindTooltip(entrance.name, {
      direction: "right",
      offset: [8, 0],
      className: "campus-entrance-label",
    });
    marker.on("click", () => selectCampusLocation(entrance.locationId, false));
  });

  renderCampusSelection();
};

const renderView = () => {
  const campusActive = state.view === "campus";
  els.appShell.classList.toggle("is-campus", campusActive);
  els.indoorView.setAttribute("aria-pressed", String(!campusActive));
  els.campusView.setAttribute("aria-pressed", String(campusActive));
  els.campusPanel.hidden = !campusActive;
  if (campusActive) {
    window.requestAnimationFrame(() => {
      initializeCampusMap();
      campusMapState.map.invalidateSize(false);
      campusMapState.map.fitBounds(campusBounds, { padding: [20, 20], animate: false });
    });
  }
};

const render = ({ rebuild = true } = {}) => {
  renderView();
  if (state.view === "campus") {
    renderCampusSelection();
    return;
  }
  renderBuildingControls();
  renderFloorControls();
  renderFloorHeader();
  renderSelected();
  renderResults();
  if (rebuild) rebuildScene();
};

const syncUrl = (replace = false) => {
  const url = new URL(window.location.href);
  url.searchParams.set("floor", state.floorId);
  if (state.activeRoomId) url.searchParams.set("room", state.activeRoomId);
  else url.searchParams.delete("room");
  if (state.view === "campus") url.searchParams.set("view", "campus");
  else url.searchParams.delete("view");
  url.searchParams.delete("fallback");
  const method = replace ? "replaceState" : "pushState";
  history[method]({}, "", url);
};

const setView = (view, sync = true) => {
  if (view !== "indoor" && view !== "campus") return;
  state.view = view;
  if (sync) syncUrl();
  render({ rebuild: view === "indoor" });
};

const setBuilding = (buildingId, sync = true) => {
  const firstFloor = floorsForBuilding(buildingId)[0];
  if (!firstFloor) return;
  state.buildingId = buildingId;
  state.floorId = firstFloor.id;
  state.activeRoomId = null;
  if (sync) syncUrl();
  render();
};

const setFloor = (floorId, sync = true) => {
  const floor = floorById(floorId);
  if (!floor) return;
  state.buildingId = floor.buildingId;
  state.floorId = floor.id;
  state.activeRoomId = null;
  if (sync) syncUrl();
  render();
};

const selectRoom = (roomId, sync = true) => {
  const selected = spaces.find((space) => space.id === roomId);
  if (!selected) return;
  const floor = floorById(selected.floorId);
  state.activeRoomId = selected.id;
  state.floorId = floor.id;
  state.buildingId = floor.buildingId;
  if (sync) syncUrl();
  render();
};

const openCampusLocationIndoor = () => {
  const location = campusLocations.find((item) => item.id === state.campusLocationId);
  if (!location) return;
  state.view = "indoor";

  if (location.targetRoomId) {
    const room = spaces.find((space) => space.id === location.targetRoomId);
    if (room) {
      const floor = floorById(room.floorId);
      state.activeRoomId = room.id;
      state.floorId = floor.id;
      state.buildingId = floor.buildingId;
    }
  } else if (location.targetFloorId) {
    const floor = floorById(location.targetFloorId);
    if (floor) {
      state.activeRoomId = null;
      state.floorId = floor.id;
      state.buildingId = floor.buildingId;
    }
  }

  syncUrl();
  render();
};

const resetHomeView = () => {
  if (!homeView || !controls) return;
  camera.position.copy(homeView.position);
  controls.target.copy(homeView.target);
  camera.zoom = homeView.zoom;
  camera.updateProjectionMatrix();
  controls.update();
  renderScene();
};

const handleMapPointer = (event, select) => {
  if (!webglAvailable || !renderer) return;
  if (event.target.closest("button, .map-status") || (!select && event.buttons)) {
    setHoveredRoom(null);
    return;
  }
  const rect = els.canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([...roomMeshes.values()], false);
  const roomId = hits[0]?.object.userData.roomId || null;
  els.mapViewport.classList.toggle("is-pointing", Boolean(roomId));
  if (!select) setHoveredRoom(roomId, event);
  if (select && hits.length) selectRoom(hits[0].object.userData.roomId);
};

const setHoveredRoom = (roomId, event = null) => {
  if (hoveredRoomId !== roomId) {
    const previousMesh = roomMeshes.get(hoveredRoomId);
    previousMesh?.material?.forEach((material) => {
      material.emissiveIntensity = 0;
    });
    roomLabels.get(hoveredRoomId)?.classList.remove("is-hovered");

    hoveredRoomId = roomId;
    const nextMesh = roomMeshes.get(roomId);
    if (nextMesh && !nextMesh.userData.selected) {
      nextMesh.material.forEach((material) => {
        material.emissive.set(scenePalette().accent);
        material.emissiveIntensity = 0.12;
      });
    }
    roomLabels.get(roomId)?.classList.add("is-hovered");
    renderScene();
  }

  const space = spaces.find((item) => item.id === roomId);
  if (!space || !event) {
    roomHoverTooltip.hidden = true;
    return;
  }

  roomHoverTooltip.textContent = space.name;
  roomHoverTooltip.hidden = false;
  const viewportRect = els.mapViewport.getBoundingClientRect();
  const margin = 10;
  const pointerX = event.clientX - viewportRect.left;
  const pointerY = event.clientY - viewportRect.top;
  const tooltipWidth = roomHoverTooltip.offsetWidth;
  const tooltipHeight = roomHoverTooltip.offsetHeight;
  const left = Math.min(
    Math.max(pointerX + 14, margin),
    viewportRect.width - tooltipWidth - margin,
  );
  const top = Math.max(margin, pointerY - tooltipHeight - 14);
  roomHoverTooltip.style.left = `${left}px`;
  roomHoverTooltip.style.top = `${top}px`;
};

const copyText = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
};

const shareSelectedRoom = async () => {
  const selected = activeRoom();
  if (!selected) return;
  const url = new URL(window.location.href);
  url.searchParams.set("floor", selected.floorId);
  url.searchParams.set("room", selected.id);
  url.searchParams.delete("fallback");
  const floor = floorById(selected.floorId);
  const shareData = {
    title: selected.name,
    text: `${selected.name}, ${floor.title}. ${selected.hint}`,
    url: url.toString(),
  };

  try {
    if (navigator.share && window.isSecureContext) await navigator.share(shareData);
    else await copyText(shareData.url);
    els.shareText.textContent = navigator.share && window.isSecureContext ? "Udostępniono" : "Link skopiowany";
    els.shareRoom.dataset.icon = "check";
    window.setTimeout(() => {
      els.shareText.textContent = "Udostępnij salę";
      els.shareRoom.dataset.icon = "share";
    }, 1800);
  } catch (error) {
    if (error?.name !== "AbortError") els.shareText.textContent = "Nie udało się skopiować";
  }
};

els.buildingButtons.addEventListener("click", (event) => {
  const button = event.target.closest("[data-building]");
  if (button) setBuilding(button.dataset.building);
});

els.indoorView.addEventListener("click", () => setView("indoor"));
els.campusView.addEventListener("click", () => setView("campus"));
els.campusLocationSwitch.addEventListener("click", (event) => {
  const button = event.target.closest("[data-campus-location]");
  if (button) selectCampusLocation(button.dataset.campusLocation);
});
els.campusOpenIndoor.addEventListener("click", openCampusLocationIndoor);

els.floorButtons.addEventListener("click", (event) => {
  const button = event.target.closest("[data-floor]");
  if (button) setFloor(button.dataset.floor);
});

els.buildingSelect.addEventListener("change", (event) => setBuilding(event.target.value));
els.floorSelect.addEventListener("change", (event) => setFloor(event.target.value));

els.roomResults.addEventListener("click", (event) => {
  const button = event.target.closest("[data-room]");
  if (button) selectRoom(button.dataset.room);
});

els.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderResults();
});

els.search.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const first = searchResults()[0];
  if (first) selectRoom(first.id);
});

els.searchClear.addEventListener("click", () => {
  state.query = "";
  els.search.value = "";
  els.search.focus();
  renderResults();
});

els.zoomIn.addEventListener("click", () => {
  camera.zoom = Math.min(camera.zoom * 1.18, controls?.maxZoom || 2.8);
  camera.updateProjectionMatrix();
  renderScene();
});

els.zoomOut.addEventListener("click", () => {
  camera.zoom = Math.max(camera.zoom / 1.18, controls?.minZoom || 0.7);
  camera.updateProjectionMatrix();
  renderScene();
});

els.resetView.addEventListener("click", resetHomeView);
els.shareRoom.addEventListener("click", shareSelectedRoom);
els.mapViewport.addEventListener("pointermove", (event) => handleMapPointer(event, false));
els.mapViewport.addEventListener("pointerleave", () => {
  els.mapViewport.classList.remove("is-pointing");
  setHoveredRoom(null);
});
els.mapViewport.addEventListener("pointerdown", () => setHoveredRoom(null));
els.mapViewport.addEventListener("click", (event) => handleMapPointer(event, true));

els.fallbackMap.addEventListener("click", (event) => {
  const roomElement = event.target.closest("[data-svg-room]");
  if (roomElement) selectRoom(roomElement.dataset.svgRoom);
});
els.fallbackMap.addEventListener("pointermove", (event) => {
  const roomElement = event.target.closest("[data-svg-room]");
  setHoveredRoom(roomElement?.dataset.svgRoom || null, event);
});
els.fallbackMap.addEventListener("pointerleave", () => setHoveredRoom(null));

window.addEventListener("popstate", () => {
  const url = new URL(window.location.href);
  state.view = url.searchParams.get("view") === "campus" ? "campus" : "indoor";
  const roomFromUrl = spaces.find((space) => space.id === url.searchParams.get("room"));
  const floorFromUrl = floorById(url.searchParams.get("floor"));
  if (roomFromUrl) {
    const floor = floorById(roomFromUrl.floorId);
    state.activeRoomId = roomFromUrl.id;
    state.floorId = floor.id;
    state.buildingId = floor.buildingId;
  } else if (floorFromUrl) {
    state.activeRoomId = null;
    state.floorId = floorFromUrl.id;
    state.buildingId = floorFromUrl.buildingId;
  }
  render();
});

prefersDark.addEventListener("change", () => render());

initializeScene();
els.mapViewport.classList.toggle("has-fallback", !webglAvailable);
els.canvas.hidden = !webglAvailable;
els.fallbackMap.hidden = webglAvailable;
if (!webglAvailable) {
  els.zoomIn.hidden = true;
  els.zoomOut.hidden = true;
  els.resetView.hidden = true;
}

const resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(els.mapViewport);

render({ rebuild: true });
syncUrl(true);
resizeRenderer();
