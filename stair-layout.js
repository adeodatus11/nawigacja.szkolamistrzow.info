// Shared footprints keep the SVG and 3D stair runs inside their stairwell.
export function stairLayout(connector) {
  const xs = connector.polygon.map(([x]) => x);
  const zs = connector.polygon.map(([, z]) => z);
  const x = Math.min(...xs), z = Math.min(...zs);
  const width = Math.max(...xs) - x, depth = Math.max(...zs) - z;
  const margin = 0.12;
  const steps = [];
  if (connector.layout === 'straight') {
    const landing = Math.min(1.1, width * 0.2);
    const tread = (width - margin * 2 - landing) / 9;
    for (let i = 0; i < 9; i++) {
      steps.push({ x: x + margin + i * tread, z: z + margin, width: tread * 0.94, depth: depth - margin * 2, height: 0.05 + i * 0.035 });
    }
    steps.push({ x: x + width - margin - landing, z: z + margin, width: landing, depth: depth - margin * 2, height: 0.365 });
  } else {
    const landing = Math.min(1.1, depth * 0.22);
    const run = (width - margin * 2 - 0.2) / 2;
    const tread = (depth - margin * 2 - landing) / 8;
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 8; i++) {
        steps.push({ x: x + margin + side * (run + 0.2), z: z + margin + i * tread, width: run, depth: tread * 0.93, height: 0.04 + (side === 0 ? i : 16 - i) * 0.027 });
      }
    }
    steps.push({ x: x + margin, z: z + depth - margin - landing, width: width - margin * 2, depth: landing, height: 0.256 });
  }
  return steps;
}
