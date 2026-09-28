import * as THREE from "./node_modules/three/build/three.module.js";
import { MapControls } from "./node_modules/three/examples/jsm/controls/MapControls.js";
import { ProjectedLabels } from "./projected-labels.js";
import { stairLayout } from "./stair-layout.js";
import { createCampusMap } from "./campus-map.js";
import { accessForRoom, findRoom, readNavigation, roomTypeFor, roomTypes } from "./wayfinding.js";
import {
  createIcons,
  createElement,
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
  X,
  GraduationCap,
  BriefcaseBusiness,
  Dumbbell,
  ChevronDown,
  ArrowLeft,
  Hand,
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
import { campusLocations } from "./campus-data.js";

const params = new URL(window.location.href).searchParams;
const state = {
  ...readNavigation(new URL(window.location.href), window.innerWidth <= 900),
  query: "",
  detailsExpanded: false,
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
  roomOnCampus: document.querySelector("#roomOnCampus"),
  returnToRoom: document.querySelector("#returnToRoom"),
  detailsToggle: document.querySelector("#detailsToggle"),
  selectedCategory: document.querySelector("#selectedCategory"),
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
    X,
    GraduationCap,
    BriefcaseBusiness,
    Dumbbell,
    ChevronDown,
    ArrowLeft,
    Hand,
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

  const results = spaces.filter((space) => {
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
  const exact = findRoom(query);
  return exact ? [exact, ...results.filter((space) => space !== exact)] : results;
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

const scenePalette = () => {
  const css = getComputedStyle(document.documentElement);
  const color = (token) => css.getPropertyValue(token).trim();
  return {
    background: color('--map-background'), ground: color('--surface-muted'),
    slab: color('--line'), corridor: color('--surface-strong'),
    room: color('--surface'), roomSide: color('--line'),
    classroom: color('--room-classroom'), classroomSide: color('--room-classroom-line'),
    administration: color('--room-administration'), administrationSide: color('--room-administration-line'),
    gym: color('--room-gym'), gymSide: color('--room-gym-line'),
    edge: color('--muted'), accent: color('--accent'), accentSide: color('--accent-strong'),
    stairs: color('--muted'), step: color('--surface-strong'),
  };
};

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-30, 30, 20, -20, 0.1, 500);
camera.position.set(38, 32, 38);

let renderer = null;
let labelRenderer = null;
let controls = null;
let webglAvailable = params.get("fallback") !== "1";
let homeView = null;
let renderedViewKey = null;
let cameraFrame = 0;
let fallbackHome = '';
const fallbackViews = new Map();
let pointerStart = null;
let mapDragged = false;
const savedViews = new Map();
const viewKey = () => `${state.floorId}:${state.mode}:${els.mapViewport.clientWidth < 700 ? 'portrait' : 'wide'}`;

const floorGroup = new THREE.Group();
scene.add(floorGroup);
let renderElevation = 0;
const isSection = () => state.mode === '2.5d' && state.buildingId === 'main';
const sectionFloors = () => floors.filter((floor) => floor.buildingId === 'main').sort((a, b) => a.level - b.level);
const sectionSpacing = () => els.mapViewport.clientWidth < 700 ? 30 : 21;

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

const renderScene = () => {
  if (!webglAvailable || !renderer || !labelRenderer) return;
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  if (renderedViewKey && controls) savedViews.set(renderedViewKey, {
    position: camera.position.clone(), target: controls.target.clone(), zoom: camera.zoom,
  });
};

const initializeScene = () => {
  if (!webglAvailable) return;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true, alpha: false });
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    labelRenderer = new ProjectedLabels(els.mapViewport);

    controls = new MapControls(camera, labelRenderer.domElement);
    controls.enableRotate = false;
    controls.enableDamping = false;
    controls.screenSpacePanning = true;
    controls.minZoom = 0.7;
    controls.maxZoom = 2.8;
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.touches.ONE = window.innerWidth <= 900 ? null : THREE.TOUCH.PAN;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controls.addEventListener("change", renderScene);
    controls.addEventListener("start", () => cancelAnimationFrame(cameraFrame));
    labelRenderer.domElement.style.touchAction = window.innerWidth <= 900 ? 'pan-y' : 'none';
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
  labelRenderer?.clear();
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

// Flat wayfinding colors do not need expensive lighting or shadow shaders.
const materialFor = (topColor, sideColor) => [
  new THREE.MeshBasicMaterial({ color: topColor }),
  new THREE.MeshBasicMaterial({ color: sideColor }),
];

const addPolygonMesh = ({ polygon, height, y = 0, topColor, sideColor, edgeColor, edgeOpacity = 0.5 }) => {
  const geometry = isSection() ? new THREE.ShapeGeometry(shapeFromPolygon(polygon)).rotateX(-Math.PI / 2) : makeExtrudedGeometry(polygon, height);
  if (isSection()) geometry.addGroup(0, geometry.index.count, 0);
  const mesh = new THREE.Mesh(geometry, materialFor(topColor, sideColor));
  mesh.position.y = y + renderElevation;
  mesh.castShadow = height > 0.12;
  mesh.receiveShadow = true;
  floorGroup.add(mesh);

  if (edgeColor !== undefined) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 24),
      new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: edgeOpacity }),
    );
    edges.position.y = y + renderElevation + 0.003;
    floorGroup.add(edges);
  }
  return mesh;
};

const makeTextLabel = (text, className, position) => {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  const face = document.createElement('span');
  face.className = 'label-face';
  face.textContent = text;
  element.append(face);
  element.title = text;
  if (className.includes('is-entrance')) {
    face.textContent = '';
    face.append(createElement(DoorOpen, { width: 17, height: 17, 'aria-hidden': 'true' }));
    const caption = document.createElement('span');
    caption.className = 'sr-only';
    caption.textContent = text;
    element.append(caption);
  }
  if (className.includes('map-landmark-label')) {
    element.setAttribute('aria-label', text);
    const showName = () => {
      roomHoverTooltip.textContent = element.getAttribute('aria-label');
      roomHoverTooltip.hidden = false;
      const bounds = element.getBoundingClientRect();
      const viewport = els.mapViewport.getBoundingClientRect();
      const scale = viewport.width / els.mapViewport.clientWidth;
      roomHoverTooltip.style.left = `${Math.max(8, Math.min((bounds.left - viewport.left) / scale, els.mapViewport.clientWidth - roomHoverTooltip.offsetWidth - 8))}px`;
      roomHoverTooltip.style.top = `${Math.max(8, (bounds.top - viewport.top) / scale - roomHoverTooltip.offsetHeight - 8)}px`;
    };
    element.addEventListener('pointerenter', showName);
    element.addEventListener('focus', showName);
    element.addEventListener('click', showName);
    element.addEventListener('blur', () => { roomHoverTooltip.hidden = true; });
  }
  return labelRenderer.add(element, [position[0], position[1] + renderElevation, position[2]], className.includes('section-floor-label') ? 12 : className.includes('is-selected') ? 10 : className.includes('is-stairs') ? 7 : className.includes('is-entrance') ? 6 : 3);
};

const addRoom = (space, palette) => {
  const selected = space.id === state.activeRoomId;
  const height = 0.08;
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
  mesh.userData.baseColors = mesh.material.map((material) => material.color.clone());
  roomMeshes.set(space.id, mesh);

  const [labelX, labelZ] = space.labelPoint;
  const label = makeTextLabel(
    shortRoomLabel(space),
    `map-room-label${selected ? " is-selected" : ""}`,
    [labelX, height + 0.34, labelZ],
  );
  roomLabels.set(space.id, label.element);
  label.element.dataset.labelRoom = space.id;
  label.element.dataset.labelFloor = space.floorId;
  label.element.setAttribute('aria-label', space.name);
  label.element.setAttribute('aria-pressed', String(selected));
  label.element.title = space.name;
  label.element.addEventListener('click', (event) => {
    event.stopPropagation();
    if (mapDragged) return;
    selectRoom(space.id);
    if (!event.detail) roomLabels.get(space.id)?.focus({ preventScroll: true });
  });
  label.element.addEventListener('pointerenter', (event) => setHoveredRoom(space.id, event));
  label.element.addEventListener('focus', () => {
    const rect = label.element.getBoundingClientRect();
    setHoveredRoom(space.id, { clientX: rect.x, clientY: rect.y });
  });
  label.element.addEventListener('blur', () => setHoveredRoom(null));
};

const addStructuralSpace = (space, palette) => {
  addPolygonMesh({
    polygon: space.polygon,
    height: state.mode === '2d' ? 0.08 : 0.25,
    y: 0.03,
    topColor: palette.room,
    sideColor: palette.roomSide,
    edgeColor: palette.edge,
    edgeOpacity: 0.7,
  });
};

const addStairs = (connector, palette) => {
  addPolygonMesh({
    polygon: connector.polygon,
    height: 0.1,
    y: 0.025,
    topColor: palette.stairs,
    sideColor: palette.stairs,
    edgeColor: palette.edge,
    edgeOpacity: 0.95,
  });

  const stairMaterial = new THREE.MeshBasicMaterial({ color: palette.step });
  for (const tread of stairLayout(connector)) {
    const height = 0.035;
    const geometry = isSection() ? new THREE.PlaneGeometry(tread.width, tread.depth).rotateX(-Math.PI / 2) : new THREE.BoxGeometry(tread.width, height, tread.depth);
    const step = new THREE.Mesh(geometry, stairMaterial);
    step.position.set(tread.x + tread.width / 2, renderElevation + 0.13 + height / 2, tread.z + tread.depth / 2);
    step.add(new THREE.LineSegments(new THREE.EdgesGeometry(step.geometry), new THREE.LineBasicMaterial({ color: palette.edge })));
    floorGroup.add(step);
  }

  if (isSection() && (connector.floorId !== state.floorId || els.mapViewport.clientWidth < 700)) return;
  const stairLabel = makeTextLabel("Schody", "map-landmark-label is-stairs", [connector.labelPoint[0], 0.9, connector.labelPoint[1]]);
  stairLabel.element.setAttribute('aria-label', `Schody, ${connector.id.includes('left') ? 'lewa klatka' : connector.id.includes('right') ? 'prawa klatka' : 'środkowa klatka'}`);
  if (activeRoom() && accessForRoom(activeRoom()).stairId === connector.id) stairLabel.element.classList.add('is-nearest');
};

const addLandmark = (landmark) => {
  makeTextLabel(landmark.label, "map-landmark-label is-entrance", [landmark.point[0], 0.85, landmark.point[1]]);
};

const rebuildScene = () => {
  cancelAnimationFrame(cameraFrame);
  if (!webglAvailable) {
    renderFallbackMap();
    return;
  }

  clearFloorGroup();
  const palette = scenePalette();
  const floor = currentFloor();
  scene.background = new THREE.Color(palette.background);

  const visibleFloors = isSection() ? sectionFloors() : [floor];
  els.mapViewport.dataset.visibleFloors = visibleFloors.map((item) => item.id).join(',');
  visibleFloors.forEach((floor, index) => {
  renderElevation = isSection() ? index * sectionSpacing() : 0;

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

  structuralSpacesOnFloor(floor.id).forEach((space) => addStructuralSpace(space, palette));
  spacesOnFloor(floor.id).forEach((space) => addRoom(space, palette));
  connectorsOnFloor(floor.id).forEach((connector) => addStairs(connector, palette));
  if (!isSection()) landmarksOnFloor(floor.id).forEach(addLandmark);
  if (isSection()) {
    const label = makeTextLabel(floor.shortTitle, `section-floor-label${floor.id === state.floorId ? ' is-active' : ''}`, [-17, 1, 12]);
    label.element.dataset.sectionFloor = floor.id;
    label.element.setAttribute('aria-label', `${floor.shortTitle}: otwórz rzut`);
    label.element.addEventListener('pointerdown', (event) => event.stopPropagation());
    label.element.addEventListener('click', (event) => {
      event.stopPropagation();
      state.mode = '2d';
      setFloor(floor.id);
    });
  }
  });
  renderElevation = 0;
  if (isSection()) {
    // Alignment guides, not a proposed circulation route or measured structural columns.
    for (const x of [0, 60]) {
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, sectionSpacing() * 4, 0)]);
      const guide = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: palette.edge, dashSize: 0.5, gapSize: 0.5, transparent: true, opacity: 0.4 }));
      guide.computeLineDistances();
      floorGroup.add(guide);
    }
  }

  if (renderedViewKey !== viewKey()) fitCameraToFloor();
  renderScene();
};

const fitCameraToFloor = (reset = false) => {
  if (!webglAvailable || !controls) return;
  const nextKey = viewKey();
  const previous = reset ? null : savedViews.get(nextKey);
  renderedViewKey = null;
  const floor = currentFloor();
  const bounds = floorBounds(floor);
  const width = Math.max(els.mapViewport.clientWidth, 1);
  const height = Math.max(els.mapViewport.clientHeight, 1);
  const aspect = width / height;
  const isPortrait = width < 700;
  camera.up.set(...(isSection() ? [0, 1, 0] : isPortrait ? [1, 0, 0] : [0, 0, -1]));
  controls.target.set(bounds.centerX, 0, bounds.centerZ);
  if (isSection()) {
    const topClearance = isPortrait ? 5 : 0;
    controls.target.set(21, sectionSpacing() * 2 + 1 + topClearance, 10);
    camera.position.set(29, sectionSpacing() * 2 + 87 + topClearance, 120);
  }
  else if (state.mode === '2d') camera.position.set(bounds.centerX, 80, bounds.centerZ + 0.001);
  else if (isPortrait) camera.position.set(bounds.centerX + 8, 80, bounds.centerZ + 32);
  else camera.position.set(bounds.centerX + 12, 80, bounds.centerZ + 38);
  camera.lookAt(controls.target);
  camera.updateMatrixWorld(true);
  const worldPoints = isSection()
    ? sectionFloors().flatMap((item, index) => [...floorOutlines(item).flat(), [-23, 12], [64, 12]].flatMap(([x, z]) => [new THREE.Vector3(x, index * sectionSpacing(), z), new THREE.Vector3(x, index * sectionSpacing() + 3, z)]))
    : floorOutlines(floor).flat().map(([x, z]) => new THREE.Vector3(x, 0, z));
  const points = worldPoints.map((point) => point.applyMatrix4(camera.matrixWorldInverse));
  const projectedWidth = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
  const projectedHeight = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
  const frustum = Math.max(projectedHeight / 2, projectedWidth / aspect / 2) * (isSection() && isPortrait ? 1.4 : 1.22);

  camera.left = -frustum * aspect;
  camera.right = frustum * aspect;
  camera.top = frustum;
  camera.bottom = -frustum;
  camera.near = 0.1;
  camera.far = 500;
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  controls.update();

  homeView = {
    position: camera.position.clone(),
    target: controls.target.clone(),
    zoom: camera.zoom,
  };
  if (previous) {
    camera.position.copy(previous.position);
    controls.target.copy(previous.target);
    camera.zoom = previous.zoom;
    camera.updateProjectionMatrix();
    controls.update();
  }
  renderedViewKey = nextKey;
};

const focusSelectedRoom = () => {
  const room = activeRoom();
  if (!webglAvailable || !controls || !room || isSection()) return;
  const stair = connectors.find((item) => item.id === accessForRoom(room).stairId);
  const points = stair ? [...room.polygon, ...stair.polygon] : room.polygon;
  const bounds = polygonBounds(points);
  const target = new THREE.Vector3(bounds.centerX, 0, bounds.centerZ);
  const initialTarget = controls.target.clone();
  const initialPosition = camera.position.clone();
  const delta = target.clone().sub(initialTarget);
  const initialZoom = camera.zoom;
  const finalZoom = Math.max(initialZoom, 1.25);
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
  const start = performance.now();
  cancelAnimationFrame(cameraFrame);
  const frame = (now) => {
    const progress = duration ? Math.min(1, (now - start) / duration) : 1;
    const eased = 1 - (1 - progress) ** 3;
    controls.target.copy(initialTarget).addScaledVector(delta, eased);
    camera.position.copy(initialPosition).addScaledVector(delta, eased);
    camera.zoom = initialZoom + (finalZoom - initialZoom) * eased;
    camera.updateProjectionMatrix();
    controls.update();
    renderScene();
    if (progress < 1) cameraFrame = requestAnimationFrame(frame);
  };
  cameraFrame = requestAnimationFrame(frame);
};

const resizeRenderer = () => {
  if (state.view !== 'indoor') return;
  if (!webglAvailable) { renderFallbackMap(); return; }
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
  const access = accessForRoom(space);
  if (access.stairName) return `Dojście: ${access.stairName} klatka schodowa.`;
  if (space.id === '37') return 'Dojście środkową lub prawą klatką schodową.';
  if (access.campusLocationId === 'hairdressing') return 'Wejście od uliczki między budynkami. Bez przejścia do gastronomii.';
  if (access.campusLocationId === 'gastronomy') return 'Wejście od strony boiska. Bez przejścia do fryzjerstwa.';
  return 'Sprawdź oznaczenia schodów na planie.';
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
  const title = isSection() ? 'Przekrój budynku głównego' : floor.title;
  if (els.floorTitle.textContent !== title) els.floorTitle.textContent = title;
  if (els.floorContext.textContent !== building.name) els.floorContext.textContent = building.name;
  if (els.floorNote.textContent !== floor.note) els.floorNote.textContent = floor.note;
  els.mapDescription.textContent = isSection() ? 'Schematyczny przekrój: piwnica, parter oraz trzy piętra. Odstępy między kondygnacjami powiększone dla czytelności. Wybierz kondygnację, aby otworzyć jej rzut.' : `${building.name}, ${floor.title}. ${floor.note}`;
};

const renderSelected = () => {
  const selected = activeRoom();
  els.selectedPanel.hidden = !selected;
  els.roomOnCampus.hidden = !selected;
  els.selectedPanel.classList.toggle('is-expanded', state.detailsExpanded);
  els.detailsToggle.setAttribute('aria-expanded', String(state.detailsExpanded));
  els.detailsToggle.querySelector('span').textContent = state.detailsExpanded ? 'Zwiń szczegóły' : 'Szczegóły dojścia';
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
  els.selectedCategory.textContent = roomTypes[roomTypeFor(selected)];
  els.selectedPanel.dataset.roomType = roomTypeFor(selected);
  els.selectedMeta.textContent = `${building.name}, ${selected.levelLabel || floor.title}`;
  els.selectedHint.textContent = selected.hint;
  els.selectedStairs.textContent = nearestStairName(selected);
  els.shareRoom.hidden = false;
  els.shareText.textContent = "Udostępnij salę";
  els.shareRoom.dataset.icon = "share";
  els.mapStatus.textContent = `${selected.name}. ${floor.title}.`;
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
      role="group"
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
        <g class="svg-room room-type-${roomTypeFor(space)}${space.id === selectedId ? " is-selected" : ""}" data-svg-room="${space.id}" role="button" tabindex="0" aria-label="${space.name}" aria-pressed="${space.id === selectedId}">
          <title>${space.name}</title>
          <polygon points="${polygonPoints(space.polygon)}" />
          <text x="${space.labelPoint[0]}" y="${space.labelPoint[1]}" text-anchor="middle" dominant-baseline="middle">${shortRoomLabel(space)}</text>
        </g>
      `).join("")}
      ${connectorsOnFloor(floor.id).map((connector) => `
        <g class="svg-stairs">
          <polygon points="${polygonPoints(connector.polygon)}" />
          ${stairLayout(connector).map((step) => `<rect x="${step.x}" y="${step.z}" width="${step.width}" height="${step.depth}" fill="none" stroke="currentColor" stroke-width="0.06" />`).join("")}
          <text x="${connector.labelPoint[0]}" y="${connector.labelPoint[1]}" text-anchor="middle">Schody</text>
        </g>
      `).join("")}
      ${landmarksOnFloor(floor.id).map((landmark) => `<g class="svg-entrance"><title>${landmark.label}</title><circle cx="${landmark.point[0]}" cy="${landmark.point[1]}" r="0.65"/><text x="${landmark.point[0]}" y="${landmark.point[1] - 1.2}" text-anchor="middle">${landmark.label}</text></g>`).join('')}
    </svg>
  `;
  fallbackHome = `${bounds.minX - padding} ${bounds.minZ - padding} ${bounds.width + padding * 2} ${bounds.depth + padding * 2}`;
  const svg = els.fallbackMap.querySelector('svg');
  if (els.mapViewport.clientWidth < 700) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('transform', 'rotate(-90)');
    group.append(...svg.children);
    svg.append(group);
    group.querySelectorAll('text').forEach((text) => {
      text.setAttribute('transform', `rotate(90 ${text.getAttribute('x')} ${text.getAttribute('y')})`);
    });
    fallbackHome = `${bounds.minZ - padding} ${-bounds.maxX - padding} ${bounds.depth + padding * 2} ${bounds.width + padding * 2}`;
  }
  svg.setAttribute('viewBox', fallbackViews.get(viewKey()) || fallbackHome);
  resizeFallbackText();
};

const resizeFallbackText = () => {
  const svg = els.fallbackMap.querySelector('svg');
  if (!svg) return;
  const [, , width, height] = svg.getAttribute('viewBox').split(' ').map(Number);
  const scale = Math.max(width / Math.max(svg.clientWidth, 1), height / Math.max(svg.clientHeight, 1));
  svg.querySelectorAll('.svg-room text').forEach((text) => { text.style.fontSize = `${12 * scale}px`; });
  svg.querySelectorAll('.svg-stairs text').forEach((text) => { text.style.fontSize = `${9 * scale}px`; });
};

let campusMap = null;
const campusDetails = {
  main: 'Parter, trzy piętra i piwnica. Sekretariat uczniowski: sala 1 na parterze.',
  gym: 'Sala gimnastyczna i jej zaplecze, w tym część budynku oznaczona numerem 7.',
  gastronomy: 'Wejście od strony boiska. Oddzielna część budynku, bez przejścia do fryzjerstwa.',
  hairdressing: 'Wejście od uliczki między budynkami. Sale prF2 i prF3; bez przejścia do gastronomii.',
};

const renderCampusSelection = () => {
  const selected = campusLocations.find((location) => location.id === state.campusLocationId) || campusLocations[0];
  els.campusLocationSwitch.querySelectorAll('[data-campus-location]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.campusLocation === selected.id));
  });
  document.querySelectorAll('[data-campus-mode]').forEach((button) => {
    if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.campusMode === state.campusMode));
  });
  els.campusDetailTitle.textContent = selected.name;
  els.campusDetailText.textContent = campusDetails[selected.id];
  els.returnToRoom.hidden = !state.activeRoomId;
  els.returnToRoom.querySelector('span').textContent = activeRoom() ? `Wróć: ${shortRoomLabel(activeRoom())}` : 'Wróć do sali';
  campusMap?.show({ locationId: selected.id, mode: state.campusMode });
};

const selectCampusLocation = (locationId) => {
  if (!campusLocations.some((location) => location.id === locationId)) return;
  state.campusLocationId = locationId;
  syncUrl();
  renderCampusSelection();
  campusMap?.select(locationId, { focus: true });
};

const initializeCampusMap = () => {
  if (!campusMap) campusMap = createCampusMap({ container: els.campusMap, onSelect: selectCampusLocation });
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
      campusMap.resize();
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
  document.querySelectorAll('[data-map-mode]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.mapMode === state.mode));
    if (button.dataset.mapMode === '2.5d') button.hidden = state.buildingId !== 'main';
  });
  els.mapViewport.dataset.mode = state.mode;
  if (rebuild) rebuildScene();
};

const syncUrl = (replace = false) => {
  const url = new URL(window.location.href);
  url.searchParams.set("floor", state.floorId);
  if (state.activeRoomId) url.searchParams.set("room", state.activeRoomId);
  else url.searchParams.delete("room");
  if (state.view === "campus") url.searchParams.set("view", "campus");
  else url.searchParams.delete("view");
  url.searchParams.set("mode", state.mode);
  if (state.view === 'campus') {
    url.searchParams.set('location', state.campusLocationId);
    if (state.campusMode === 'surroundings') url.searchParams.set('context', 'surroundings');
    else url.searchParams.delete('context');
  } else {
    url.searchParams.delete('location');
    url.searchParams.delete('context');
  }
  const method = replace ? "replaceState" : "pushState";
  if (replace || url.href !== window.location.href) history[method]({}, "", url);
};

const setView = (view, sync = true) => {
  if (view !== "indoor" && view !== "campus") return;
  cancelAnimationFrame(cameraFrame);
  state.view = view;
  if (sync) syncUrl();
  render({ rebuild: view === "indoor" });
};

const setBuilding = (buildingId, sync = true) => {
  const available = floorsForBuilding(buildingId);
  const firstFloor = available.find((floor) => floor.level === 0) || available[0];
  if (!firstFloor) return;
  state.buildingId = buildingId;
  if (buildingId !== 'main') state.mode = '2d';
  state.floorId = firstFloor.id;
  state.activeRoomId = null;
  if (sync) syncUrl();
  render();
};

const setFloor = (floorId, sync = true) => {
  const floor = floorById(floorId);
  if (!floor) return;
  state.buildingId = floor.buildingId;
  if (floor.buildingId !== 'main') state.mode = '2d';
  state.floorId = floor.id;
  state.activeRoomId = null;
  if (sync) syncUrl();
  render();
};

const selectRoom = (roomId, sync = true) => {
  const selected = findRoom(roomId);
  if (!selected) return;
  const floor = floorById(selected.floorId);
  state.activeRoomId = selected.id;
  if (floor.buildingId !== 'main') state.mode = '2d';
  state.floorId = floor.id;
  state.buildingId = floor.buildingId;
  state.view = 'indoor';
  state.detailsExpanded = false;
  if (sync) syncUrl();
  render();
  focusSelectedRoom();
  if (window.innerWidth <= 900) {
    const rect = els.mapViewport.getBoundingClientRect();
    if (rect.bottom < 120 || rect.top > window.innerHeight - 80) {
      els.mapViewport.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  }
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
  cancelAnimationFrame(cameraFrame);
  if (!webglAvailable) {
    fallbackViews.delete(viewKey());
    renderFallbackMap();
    return;
  }
  if (!homeView || !controls) return;
  fitCameraToFloor(true);
  renderScene();
};

const handleMapPointer = (event, select) => {
  if (!webglAvailable || !renderer) return;
  if (event.target.closest('[data-label-room], .map-landmark-label')) return;
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
    previousMesh?.material?.forEach((material, index) => {
      material.color.copy(previousMesh.userData.baseColors[index]);
    });
    roomLabels.get(hoveredRoomId)?.classList.remove("is-hovered");

    hoveredRoomId = roomId;
    const nextMesh = roomMeshes.get(roomId);
    if (nextMesh && !nextMesh.userData.selected) {
      nextMesh.material.forEach((material) => {
        material.color.lerp(new THREE.Color(scenePalette().accent), 0.16);
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
  const scale = viewportRect.width / els.mapViewport.clientWidth;
  const pointerX = (event.clientX - viewportRect.left) / scale;
  const pointerY = (event.clientY - viewportRect.top) / scale;
  const tooltipWidth = roomHoverTooltip.offsetWidth;
  const tooltipHeight = roomHoverTooltip.offsetHeight;
  const left = Math.min(
    Math.max(pointerX + 14, margin),
    els.mapViewport.clientWidth - tooltipWidth - margin,
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
  url.searchParams.delete('view');
  url.searchParams.delete('location');
  url.searchParams.delete('context');
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
els.campusView.addEventListener("click", () => {
  if (activeRoom()) state.campusLocationId = accessForRoom(activeRoom()).campusLocationId;
  setView("campus");
});
els.roomOnCampus.addEventListener('click', () => {
  if (!activeRoom()) return;
  state.campusLocationId = accessForRoom(activeRoom()).campusLocationId;
  setView('campus');
});
els.returnToRoom.addEventListener('click', () => setView('indoor'));
els.detailsToggle.addEventListener('click', () => { state.detailsExpanded = !state.detailsExpanded; renderSelected(); });
document.querySelectorAll('[data-quick-room]').forEach((button) => button.addEventListener('click', () => selectRoom(button.dataset.quickRoom)));
document.querySelectorAll('[data-map-mode]').forEach((button) => button.addEventListener('click', () => {
  state.mode = button.dataset.mapMode;
  syncUrl();
  render();
}));
document.querySelectorAll('button[data-campus-mode]').forEach((button) => button.addEventListener('click', () => {
  state.campusMode = button.dataset.campusMode;
  syncUrl();
  renderCampusSelection();
}));
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

const zoomMap = (factor) => {
  cancelAnimationFrame(cameraFrame);
  if (!webglAvailable) {
    const svg = els.fallbackMap.querySelector('svg');
    if (!svg) return;
    const [x, y, width, height] = svg.getAttribute('viewBox').split(' ').map(Number);
    const homeWidth = Number(fallbackHome.split(' ')[2]);
    const nextWidth = Math.max(homeWidth / 3, Math.min(homeWidth * 1.4, width / factor));
    const nextHeight = height * nextWidth / width;
    const viewBox = `${x + (width - nextWidth) / 2} ${y + (height - nextHeight) / 2} ${nextWidth} ${nextHeight}`;
    svg.setAttribute('viewBox', viewBox);
    fallbackViews.set(viewKey(), viewBox);
    resizeFallbackText();
    return;
  }
  camera.zoom = Math.max(controls.minZoom, Math.min(camera.zoom * factor, controls.maxZoom));
  camera.updateProjectionMatrix();
  renderScene();
};
els.zoomIn.addEventListener('click', () => zoomMap(1.18));
els.zoomOut.addEventListener('click', () => zoomMap(1 / 1.18));

document.querySelector('#panMap').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const enabled = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(enabled));
  if (controls) {
    controls.touches.ONE = enabled ? THREE.TOUCH.PAN : null;
    labelRenderer.domElement.style.touchAction = enabled ? 'none' : 'pan-y';
  }
  els.fallbackMap.style.touchAction = enabled ? 'none' : 'pan-y';
});

els.resetView.addEventListener("click", resetHomeView);
els.shareRoom.addEventListener("click", shareSelectedRoom);
els.mapViewport.addEventListener("pointermove", (event) => handleMapPointer(event, false));
els.mapViewport.addEventListener("pointerleave", () => {
  els.mapViewport.classList.remove("is-pointing");
  setHoveredRoom(null);
});
els.mapViewport.addEventListener('pointerdown', (event) => {
  pointerStart = [event.clientX, event.clientY];
  mapDragged = false;
  setHoveredRoom(null);
});
els.mapViewport.addEventListener('pointermove', (event) => {
  if (pointerStart && event.buttons && Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 5) mapDragged = true;
});
els.mapViewport.addEventListener('click', (event) => { if (!mapDragged) handleMapPointer(event, true); pointerStart = null; });
els.mapViewport.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { setHoveredRoom(null); return; }
  if (event.target !== els.mapViewport) return;
  if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomMap(1.18); }
  if (event.key === '-') { event.preventDefault(); zoomMap(1 / 1.18); }
  if (event.key === 'Home') { event.preventDefault(); resetHomeView(); }
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  if (!directions[event.key]) return;
  event.preventDefault();
  const [x, y] = directions[event.key];
  if (webglAvailable) {
    const distance = (camera.right - camera.left) / camera.zoom / 12;
    const delta = new THREE.Vector3(x * distance, y * distance, 0).applyQuaternion(camera.quaternion);
    camera.position.add(delta); controls.target.add(delta); controls.update(); renderScene();
  } else {
    const svg = els.fallbackMap.querySelector('svg');
    const view = svg.getAttribute('viewBox').split(' ').map(Number);
    view[0] += x * view[2] / 12; view[1] -= y * view[3] / 12;
    svg.setAttribute('viewBox', view.join(' ')); fallbackViews.set(viewKey(), view.join(' '));
  }
});

els.fallbackMap.addEventListener("click", (event) => {
  const roomElement = event.target.closest("[data-svg-room]");
  if (roomElement && !mapDragged) selectRoom(roomElement.dataset.svgRoom);
});
els.fallbackMap.addEventListener('keydown', (event) => {
  const roomElement = event.target.closest('[data-svg-room]');
  if (roomElement && ['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    const id = roomElement.dataset.svgRoom;
    selectRoom(id);
    els.fallbackMap.querySelector(`[data-svg-room="${id}"]`)?.focus({ preventScroll: true });
  }
});
els.fallbackMap.addEventListener('focusin', (event) => {
  const roomElement = event.target.closest('[data-svg-room]');
  if (!roomElement) return;
  const rect = roomElement.getBoundingClientRect();
  setHoveredRoom(roomElement.dataset.svgRoom, { clientX: rect.x, clientY: rect.y });
});
els.fallbackMap.addEventListener('focusout', () => setHoveredRoom(null));
let fallbackDrag = null;
els.fallbackMap.addEventListener('pointerdown', (event) => {
  if (document.querySelector('#panMap').getAttribute('aria-pressed') !== 'true') return;
  const svg = els.fallbackMap.querySelector('svg');
  const matrix = svg?.getScreenCTM();
  if (!matrix) return;
  const inverse = matrix.inverse();
  fallbackDrag = { point: new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse), inverse, svg, view: svg.getAttribute('viewBox').split(' ').map(Number) };
  els.fallbackMap.setPointerCapture(event.pointerId);
});
els.fallbackMap.addEventListener('pointermove', (event) => {
  if (!fallbackDrag) return;
  const { point, inverse, view, svg } = fallbackDrag;
  const next = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
  const value = [view[0] - (next.x - point.x), view[1] - (next.y - point.y), view[2], view[3]].join(' ');
  svg.setAttribute('viewBox', value);
  fallbackViews.set(viewKey(), value);
});
els.fallbackMap.addEventListener('pointerup', () => { fallbackDrag = null; });
els.fallbackMap.addEventListener('pointercancel', () => { fallbackDrag = null; });
els.fallbackMap.addEventListener("pointermove", (event) => {
  const roomElement = event.target.closest("[data-svg-room]");
  setHoveredRoom(roomElement?.dataset.svgRoom || null, event);
});
els.fallbackMap.addEventListener("pointerleave", () => setHoveredRoom(null));

window.addEventListener("popstate", () => {
  Object.assign(state, readNavigation(new URL(window.location.href), window.innerWidth <= 900));
  if (!webglAvailable) state.mode = '2d';
  render();
});

prefersDark.addEventListener("change", () => render());

initializeScene();
els.mapViewport.classList.toggle("has-fallback", !webglAvailable);
els.canvas.hidden = !webglAvailable;
els.fallbackMap.hidden = webglAvailable;
if (!webglAvailable) {
  state.mode = '2d';
  const perspectiveButton = document.querySelector('[data-map-mode="2.5d"]');
  perspectiveButton.disabled = true;
  perspectiveButton.title = 'Widok 2.5D wymaga WebGL';
}

const resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(els.mapViewport);

render({ rebuild: true });
syncUrl(true);
resizeRenderer();
document.fonts.ready.then(() => { renderScene(); campusMap?.resize(); });

window.addEventListener('pagehide', (event) => {
  cancelAnimationFrame(cameraFrame);
  if (event.persisted) return;
  resizeObserver.disconnect();
  controls?.dispose();
  labelRenderer?.dispose();
  clearFloorGroup();
  renderer?.dispose();
  campusMap?.destroy();
});
