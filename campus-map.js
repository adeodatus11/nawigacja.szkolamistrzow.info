import * as L from 'leaflet';
import { createElement, LocateFixed, DoorOpen, ArrowUp, Hand } from 'lucide';
import { campusBounds, campusLocations, campusPitch, campusEntrances, campusStreet } from './campus-data.js';

const anchors = {
  main: [51.09407, 17.03804], gym: [51.09430, 17.03876],
  gastronomy: [51.093826, 17.038475], hairdressing: [51.09373, 17.03830],
};

export function createCampusMap({ container, onSelect }) {
  const map = L.map(container, { minZoom: 16, maxZoom: 21, zoomSnap: 0.25, scrollWheelZoom: false });
  map.fitBounds(campusBounds, { padding: [30, 34], animate: false });
  const layers = new Map();
  const labels = new Map();
  const views = new Map();
  let locationId = 'main';
  let mode = 'scheme';
  let initialized = false;
  let tiles = null;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');
  L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 100 }).addTo(map);
  const tileStatus = document.createElement('p');
  tileStatus.className = 'campus-tile-status';
  tileStatus.setAttribute('role', 'status');
  tileStatus.hidden = true;
  container.append(tileStatus);

  L.polyline(campusStreet.points, { interactive: false, color: token('--line'), weight: 26, opacity: 1 }).addTo(map);
  L.polyline(campusStreet.points, { interactive: false, color: token('--muted'), weight: 1.5, dashArray: '7 9', opacity: 0.8 }).addTo(map);
  L.tooltip({ permanent: true, direction: 'center', className: 'campus-label campus-street-label' })
    .setLatLng(campusStreet.labelPoint).setContent(campusStreet.name).addTo(map);

  const style = (id) => ({
    color: id === locationId ? token('--accent-strong') : token('--muted'),
    weight: id === locationId ? 3 : 1.5,
    fillColor: id === locationId ? token('--accent-soft') : id === 'gym' ? token('--room-gym') : token('--surface-muted'),
    fillOpacity: mode === 'scheme' ? 1 : 0.75,
  });

  L.geoJSON(campusPitch, { interactive: false, style: { color: '#45815a', weight: 1.5, fillColor: '#bdd9c3', fillOpacity: 1 } })
    .addTo(map).bindTooltip('Boisko', { permanent: true, direction: 'center', className: 'campus-label campus-pitch-label' });

  const updateLabels = () => {
    const occupied = [];
    const bounds = container.getBoundingClientRect();
    const entries = [...labels].sort(([a], [b]) => Number(b === locationId) - Number(a === locationId));
    for (const [id, label] of entries) {
      const element = label.getElement();
      if (!element) continue;
      element.classList.toggle('is-selected', id === locationId);
      element.style.visibility = '';
      const rect = element.getBoundingClientRect();
      const clash = occupied.some((other) => rect.left < other.right + 4 && rect.right + 4 > other.left && rect.top < other.bottom + 4 && rect.bottom + 4 > other.top);
      const outside = rect.right > bounds.right - 2 || rect.left < bounds.left + 2;
      if ((clash || outside) && id !== locationId) element.style.visibility = 'hidden';
      else occupied.push(rect);
    }
  };

  campusLocations.forEach((location) => {
    const layer = L.geoJSON({ type: 'Feature', properties: {}, geometry: location.geometry }, { style: style(location.id) }).addTo(map);
    layer.on('click', () => onSelect(location.id));
    layer.eachLayer((child) => {
      const path = child.getElement();
      path.setAttribute('tabindex', '0');
      path.setAttribute('role', 'button');
      path.setAttribute('aria-label', location.name);
      path.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(location.id); }
      });
    });
    const label = L.tooltip({ permanent: true, direction: 'center', className: `campus-label campus-building-label is-${location.id}` })
      .setLatLng(anchors[location.id]).setContent(location.mapLabel).addTo(map);
    layers.set(location.id, layer);
    labels.set(location.id, label);
  });

  campusEntrances.forEach((entrance) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'campus-entry-button';
    button.title = entrance.name;
    button.setAttribute('aria-label', entrance.name);
    button.append(createElement(DoorOpen, { width: 18, height: 18, 'aria-hidden': 'true' }));
    const marker = L.marker(entrance.coordinates, {
      icon: L.divIcon({ html: button, className: 'campus-entry', iconSize: [44, 44], iconAnchor: [22, 22] }),
      keyboard: false,
    }).addTo(map);
    marker.bindTooltip(entrance.name, { direction: 'top', className: 'campus-entrance-label' });
    button.addEventListener('click', () => onSelect(entrance.locationId));
    button.addEventListener('focus', () => marker.openTooltip());
    button.addEventListener('blur', () => marker.closeTooltip());
  });

  const reset = () => map.fitBounds(campusBounds, { padding: [30, 34], animate: false });
  const resetControl = L.control({ position: 'topleft' });
  resetControl.onAdd = () => {
    const button = L.DomUtil.create('button', 'campus-reset');
    button.type = 'button';
    button.title = 'Pokaż cały teren';
    button.setAttribute('aria-label', button.title);
    button.append(createElement(LocateFixed, { width: 18, height: 18, 'aria-hidden': 'true' }));
    L.DomEvent.disableClickPropagation(button);
    button.addEventListener('click', reset);
    return button;
  };
  resetControl.addTo(map);
  const touchDevice = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;
  if (touchDevice) {
    map.dragging.disable();
    container.style.touchAction = 'pan-y';
    const panControl = L.control({ position: 'topleft' });
    panControl.onAdd = () => {
      const button = L.DomUtil.create('button', 'campus-reset campus-pan');
      button.type = 'button';
      button.title = 'Przesuwaj mapę terenu';
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', 'false');
      button.append(createElement(Hand, { width: 18, height: 18, 'aria-hidden': 'true' }));
      L.DomEvent.disableClickPropagation(button);
      button.addEventListener('click', () => {
        const enabled = button.getAttribute('aria-pressed') !== 'true';
        button.setAttribute('aria-pressed', String(enabled));
        map.dragging[enabled ? 'enable' : 'disable']();
        container.style.touchAction = enabled ? 'none' : 'pan-y';
      });
      return button;
    };
    panControl.addTo(map);
  }
  const north = L.control({ position: 'topright' });
  north.onAdd = () => {
    const element = L.DomUtil.create('div', 'campus-north');
    element.setAttribute('aria-label', 'Północ');
    element.append(createElement(ArrowUp, { width: 20, height: 20, 'aria-hidden': 'true' }), 'N');
    return element;
  };
  north.addTo(map);
  map.on('zoomend moveend resize', updateLabels);

  const setMode = (next) => {
    if (next === mode && initialized) return;
    if (initialized) views.set(mode, { center: map.getCenter(), zoom: map.getZoom() });
    mode = next === 'surroundings' ? 'surroundings' : 'scheme';
    container.dataset.campusMode = mode;
    tileStatus.hidden = true;
    if (mode === 'surroundings') {
      if (!tiles) {
        tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, maxZoom: 21 });
        tiles.on('tileerror', () => {
          if (mode !== 'surroundings') return;
          tileStatus.textContent = 'Nie można wczytać mapy ulic. Schemat szkoły jest nadal dostępny.';
          tileStatus.hidden = false;
        });
      }
      tiles.addTo(map);
    } else if (tiles) map.removeLayer(tiles);
    const view = views.get(mode);
    if (view) map.setView(view.center, view.zoom, { animate: false });
    else reset();
    initialized = true;
    layers.forEach((layer, id) => layer.setStyle(style(id)));
  };

  return {
    show({ locationId: selected, mode: next }) {
      map.invalidateSize(false);
      setMode(next);
      this.select(selected);
    },
    select(selected, { focus = false } = {}) {
      if (!layers.has(selected)) return;
      locationId = selected;
      layers.forEach((layer, id) => {
        layer.setStyle(style(id));
        layer.eachLayer((child) => child.getElement().setAttribute('aria-pressed', String(id === selected)));
      });
      if (focus) map.panTo(anchors[selected], { animate: !reducedMotion(), duration: 0.22 });
      updateLabels();
    },
    setMode,
    resize() { map.invalidateSize(false); updateLabels(); },
    destroy() { map.remove(); tileStatus.remove(); },
  };
}
