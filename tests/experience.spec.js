import { test, expect } from '@playwright/test';
import { spaces, floors, connectors } from '../map-data.js';
import { accessForRoom, roomTypeFor, readNavigation } from '../wayfinding.js';

test('kategorie, aliasy i powiązania nie tworzą niepotwierdzonych schodów', () => {
  for (const id of ['37', '38']) expect(roomTypeFor(spaces.find((room) => room.id === id))).toBe('classroom');
  expect(readNavigation(new URL('https://example.org/?room=05')).activeRoomId).toBe('05');
  expect(readNavigation(new URL('https://example.org/?room=37&floor=parter')).floorId).toBe('pietro-3');
  expect(accessForRoom(spaces.find((room) => room.id === '37')).stairId).toBeNull();
  for (const room of spaces) {
    const { stairId } = accessForRoom(room);
    if (stairId) expect(connectors.find((stair) => stair.id === stairId)?.floorId).toBe(room.floorId);
  }
});

test('schemat nie pobiera kafelków, okolica obsługuje ich awarię', async ({ page }) => {
  let tileRequests = 0;
  await page.route('https://tile.openstreetmap.org/**', (route) => { tileRequests++; return route.abort(); });
  await page.goto('/?view=campus&location=hairdressing');
  await expect(page.locator('#campusDetailTitle')).toContainText('fryzjerska');
  await expect(page.locator('#campusMap')).toHaveAttribute('data-campus-mode', 'scheme');
  expect(tileRequests).toBe(0);
  await page.locator('button[data-campus-mode=surroundings]').click();
  await expect(page.locator('.campus-tile-status')).toBeVisible();
  expect(tileRequests).toBeGreaterThan(0);
  await page.locator('button[data-campus-mode=scheme]').click();
  await expect(page.locator('.campus-tile-status')).toBeHidden();
});

test('sala, teren i perspektywa zachowują stan po odświeżeniu i Wstecz', async ({ page }) => {
  await page.goto('/?room=37&mode=2d');
  await page.locator('#roomOnCampus').click();
  await expect(page).toHaveURL(/view=campus/);
  await page.locator('[data-campus-location=gym]').click();
  await expect(page).toHaveURL(/location=gym/);
  await page.reload();
  await expect(page.locator('#campusDetailTitle')).toHaveText('Sala gimnastyczna');
  await page.locator('#returnToRoom').click();
  await expect(page.locator('#selectedTitle')).toContainText('37');
  await expect(page.locator('[data-map-mode="2d"]')).toHaveAttribute('aria-pressed', 'true');
  await page.goBack();
  await expect(page.locator('#campusPanel')).toBeVisible();
});

test('kamera zachowuje przybliżenie między piętrami i przy zmianie okna', async ({ page }) => {
  await page.goto('/?floor=parter&mode=2d');
  const label = page.locator('[data-label-room="6"]');
  const base = await label.boundingBox();
  await page.locator('#zoomIn').click();
  const zoomed = await label.boundingBox();
  expect(Math.abs(base.x - zoomed.x) + Math.abs(base.y - zoomed.y)).toBeGreaterThan(2);
  await page.locator('[data-floor="pietro-1"]').click();
  await page.locator('[data-floor="parter"]').click();
  const restored = await label.boundingBox();
  expect(restored.x).toBeCloseTo(zoomed.x, 0);
  expect(restored.y).toBeCloseTo(zoomed.y, 0);
});

test('fallback SVG ma działający zoom, reset i wybór klawiaturą', async ({ page }) => {
  await page.goto('/?fallback=1&floor=pietro-3');
  const svg = page.locator('#fallbackMap svg');
  const home = await svg.getAttribute('viewBox');
  await page.locator('#zoomIn').click();
  expect(await svg.getAttribute('viewBox')).not.toBe(home);
  await page.locator('#resetView').click();
  expect(await svg.getAttribute('viewBox')).toBe(home);
  await page.locator('[data-svg-room="37"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#selectedTitle')).toContainText('37');
});

test('wszystkie piętra mają dokładnie własny zestaw etykiet', async ({ page }) => {
  for (const floor of floors) {
    await page.goto(`/?floor=${floor.id}`);
    const actual = await page.locator('[data-label-room]').evaluateAll((labels) => labels.map((label) => label.dataset.labelRoom).sort());
    expect(actual).toEqual(spaces.filter((room) => room.floorId === floor.id).map((room) => room.id).sort());
  }
});

for (const [width, height] of [[1440, 900], [1024, 768], [430, 932], [390, 844], [320, 568]]) {
  test(`układ i render ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?floor=parter');
    await expect(page.locator('[data-label-room="6"]')).toBeAttached();
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      mapTop: document.querySelector('#mapViewport').getBoundingClientRect().top,
      mapHeight: document.querySelector('#mapViewport').getBoundingClientRect().height,
    }));
    expect(metrics.width).toBe(width);
    if (width <= 900) {
      expect(metrics.mapTop).toBeLessThan(260);
      expect(metrics.mapHeight).toBeGreaterThanOrEqual(height * .54);
      await expect(page.locator('[data-map-mode="2d"]')).toHaveAttribute('aria-pressed', 'true');
    }
    await page.screenshot({ path: testInfo.outputPath(`indoor-${width}.png`), fullPage: true });
    const png = await page.locator('#mapViewport').screenshot();
    const diversePixels = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, image.width, image.height).data;
      let colored = 0;
      for (let i = 0; i < data.length; i += 4) if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 20) colored++;
      return colored / (image.width * image.height);
    }, png.toString('base64'));
    expect(diversePixels).toBeGreaterThan(.035);
    await page.locator('#campusView').click();
    await expect(page.locator('#campusMap .leaflet-interactive').first()).toBeVisible();
    const street = page.locator('.campus-street-label');
    await expect(street).toHaveText('ul. Jana Władysława Dawida');
    await expect(street).toBeVisible();
    const streetBox = await street.boundingBox();
    const campusBox = await page.locator('#campusMap').boundingBox();
    expect(streetBox.x).toBeGreaterThanOrEqual(campusBox.x);
    expect(streetBox.x + streetBox.width).toBeLessThanOrEqual(campusBox.x + campusBox.width);
    expect(streetBox.y).toBeGreaterThanOrEqual(campusBox.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: testInfo.outputPath(`campus-${width}.png`), fullPage: true });
  });
}

test('ciemny motyw, ograniczony ruch i powiększenie 200%', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/?room=37');
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expect(page.locator('.map-room-label.is-selected')).toBeVisible();
  await expect(page.locator('#selectedTitle')).toContainText('37');
  await page.locator('#mapViewport').scrollIntoViewIfNeeded();
  await expect(page.locator('.map-room-label.is-selected')).toBeInViewport();
  await page.locator('#mapViewport').screenshot({ path: testInfo.outputPath('dark-zoom.png') });
});

test('mobilne schody i wejścia pozostają widoczne, wybór z listy wraca do mapy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?floor=parter');
  await expect(page.locator('.map-landmark-label.is-stairs:visible')).toHaveCount(3);
  await expect(page.locator('.map-landmark-label.is-entrance:visible')).toHaveCount(3);
  await page.locator('[data-room="2"]').click();
  await expect.poll(() => page.locator('#mapViewport').evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(-1);
  await expect(page.locator('#selectedTitle')).toContainText('Sala 2');
});

test('przyciski zoomu terenu mają 44 px, kliknięcie obiektu przywraca go do widoku', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?view=campus');
  const button = page.locator('.leaflet-control-zoom-in');
  await expect(button).toBeVisible();
  const bounds = await button.boundingBox();
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  await page.locator('[data-campus-location="hairdressing"]').click();
  await expect(page.locator('.campus-building-label.is-hairdressing')).toBeVisible();
  const label = await page.locator('.campus-building-label.is-hairdressing').boundingBox();
  const map = await page.locator('#campusMap').boundingBox();
  expect(label.x).toBeGreaterThanOrEqual(map.x);
  expect(label.y).toBeGreaterThanOrEqual(map.y);
  expect(label.y + label.height).toBeLessThanOrEqual(map.y + map.height);
});
