import { test, expect } from '@playwright/test';
import { spaces, connectors, landmarks } from '../map-data.js';
import { findRoom } from '../wayfinding.js';
import { stairLayout } from '../stair-layout.js';

test('aktualne funkcje i numery sal pozostają jednoznaczne', () => {
  expect(findRoom('5').id).toBe('5');
  expect(findRoom('05').id).toBe('05');
  expect(findRoom('7').id).toBe('6');
  expect(findRoom('20').name).toContain('biblioteka');
  expect(findRoom('21').name).toContain('czytelnia');
  expect(findRoom('wc-0').polygon).toEqual(findRoom('wc-1').polygon);
  expect(findRoom('8').polygon).toEqual([[33, 0], [48, 0], [48, 7], [33, 7]]);
});

test('wyjścia parteru są na końcu schodów i między salami, nie wewnątrz sal', () => {
  const courtyard = landmarks.find((point) => point.id === 'parter-courtyard');
  const stairs = connectors.find((connector) => connector.id === 'parter-stairs-center');
  expect(courtyard.point).toEqual([stairs.labelPoint[0], Math.max(...stairs.polygon.map(([, z]) => z))]);
  const emergency = landmarks.find((point) => point.id === 'parter-emergency');
  expect(emergency.point[0]).toBeGreaterThan(Math.max(...findRoom('2').polygon.map(([x]) => x)));
  expect(emergency.point[0]).toBeLessThan(Math.min(...findRoom('1').polygon.map(([x]) => x)));
  expect(emergency.point[1]).toBe(18);
});

test('stopnie i spoczniki mieszczą się w każdej klatce bez nakładania', () => {
  for (const connector of connectors) {
    const xs = connector.polygon.map(([x]) => x), zs = connector.polygon.map(([, z]) => z);
    const steps = stairLayout(connector);
    for (const step of steps) {
      expect(step.x).toBeGreaterThanOrEqual(Math.min(...xs));
      expect(step.z).toBeGreaterThanOrEqual(Math.min(...zs));
      expect(step.x + step.width).toBeLessThanOrEqual(Math.max(...xs));
      expect(step.z + step.depth).toBeLessThanOrEqual(Math.max(...zs));
      for (const other of steps) {
        if (step === other) continue;
        const overlapX = Math.min(step.x + step.width, other.x + other.width) - Math.max(step.x, other.x);
        const overlapZ = Math.min(step.z + step.depth, other.z + other.depth) - Math.max(step.z, other.z);
        expect(Math.min(overlapX, overlapZ)).toBeLessThanOrEqual(0.00001);
      }
    }
  }
});

test('sale parteru nie nachodzą na siebie', () => {
  const rooms = spaces.filter((space) => space.floorId === 'parter');
  const bounds = (space) => {
    const xs = space.polygon.map(([x]) => x), zs = space.polygon.map(([, z]) => z);
    return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  };
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
    const a = bounds(rooms[i]), b = bounds(rooms[j]);
    expect(Math.min(Math.min(a[1], b[1]) - Math.max(a[0], b[0]), Math.min(a[3], b[3]) - Math.max(a[2], b[2]))).toBeLessThanOrEqual(0);
  }
});

test('link do 05 pokazuje półpiętro, a link do 7 połączoną pracownię', async ({ page }) => {
  await page.goto('/?room=05');
  await expect(page.locator('#selectedTitle')).toHaveText('Sala 05');
  await expect(page.locator('#selectedMeta')).toContainText('Pół piętra poniżej parteru');
  await page.goto('/?room=7');
  await expect(page.locator('#selectedTitle')).toHaveText('Sale 6–7, pracownia fryzjerska');
});
