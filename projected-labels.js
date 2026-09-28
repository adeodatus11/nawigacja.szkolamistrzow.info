import { Vector3 } from 'three';

const overlaps = (a, b) => a.x < b.x + b.w + 4 && a.x + a.w + 4 > b.x && a.y < b.y + b.h + 4 && a.y + a.h + 4 > b.y;

// CSS pixel coordinates, independent of canvas resolution and device pixel ratio.
export class ProjectedLabels {
  constructor(container) {
    this.domElement = document.createElement('div');
    this.domElement.className = 'map-label-layer';
    container.append(this.domElement);
    this.container = container;
    this.labels = [];
  }

  add(element, point, priority = 1) {
    const leader = document.createElement('span');
    leader.className = 'label-leader';
    leader.setAttribute('aria-hidden', 'true');
    const label = { element, leader, position: new Vector3(...point), priority };
    this.labels.push(label);
    this.domElement.append(leader, element);
    return label;
  }

  clear() {
    this.labels = [];
    this.domElement.replaceChildren();
  }

  setSize() {}

  render(scene, camera) {
    const origin = this.container.getBoundingClientRect();
    const viewport = { width: this.container.clientWidth, height: this.container.clientHeight };
    if (!viewport.width || !viewport.height) return;
    const scaleX = origin.width / viewport.width;
    const scaleY = origin.height / viewport.height;
    const occupied = [...this.container.querySelectorAll('.map-controls, .map-mode-switch, .map-status:not(.sr-only)')]
      .filter((el) => el.getClientRects().length)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return { x: (rect.left - origin.left) / scaleX, y: (rect.top - origin.top) / scaleY, w: rect.width / scaleX, h: rect.height / scaleY };
      });
    const focused = document.activeElement;
    const labels = [...this.labels].sort((a, b) => (b.element === focused ? 100 : b.priority) - (a.element === focused ? 100 : a.priority));
    const candidates = [];
    const place = (label, box) => {
      const { element, leader, x, y, w, h } = label;
      element.style.visibility = 'visible';
      element.style.left = `${box.x}px`;
      element.style.top = `${box.y}px`;
      const dx = box.x + w / 2 - x;
      const dy = box.y + h / 2 - y;
      const length = Math.hypot(dx, dy);
      element.dataset.offset = String(length > 8);
      if (length > 8) {
        leader.hidden = false;
        Object.assign(leader.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, length - 14)}px`, transform: `rotate(${Math.atan2(dy, dx)}rad)` });
      }
      occupied.push(box);
    };
    const fits = (box) => box.x >= 4 && box.y >= 4 && box.x + box.w <= viewport.width - 4
      && box.y + box.h <= viewport.height - 4 && !occupied.some((other) => overlaps(box, other));
    // Reserve true anchors first; an offset label must not steal another room's anchor.
    for (const label of labels) {
      const { element, leader, position } = label;
      leader.hidden = true;
      element.style.visibility = 'hidden';
      const point = position.clone().project(camera);
      if (point.z < -1 || point.z > 1) continue;
      const x = (point.x + 1) * viewport.width / 2;
      const y = (1 - point.y) * viewport.height / 2;
      const w = element.offsetWidth;
      const h = element.offsetHeight;
      const entry = { ...label, x, y, w, h };
      const box = { x: x - w / 2, y: y - h / 2, w, h };
      if (fits(box)) place(entry, box);
      else candidates.push(entry);
    }
    for (const label of candidates) {
      const { x, y, w, h, element, priority } = label;
      const offsets = [[-w - 6, 0], [w + 6, 0], [-w * 2 - 12, 0], [w * 2 + 12, 0], [0, -h - 6], [0, h + 6]];
      let box = offsets.map(([dx, dy]) => ({ x: x - w / 2 + dx, y: y - h / 2 + dy, w, h })).find(fits);
      if (!box && (priority >= 10 || element === focused)) {
        for (let top = 62; top < viewport.height - h; top += h + 6) {
          const candidate = { x: 8, y: top, w, h };
          if (fits(candidate)) { box = candidate; break; }
        }
      }
      if (box) place(label, box);
    }
  }

  dispose() { this.clear(); this.domElement.remove(); }
}
