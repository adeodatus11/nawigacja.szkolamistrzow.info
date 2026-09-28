import { test, expect } from '@playwright/test';

for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
  test(`przekrój całego budynku ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?room=37&mode=2.5d');
    await expect(page.locator('#floorTitle')).toHaveText('Przekrój budynku głównego');
    await expect(page.locator('[data-section-floor]:visible')).toHaveCount(5);
    await expect(page.locator('.map-room-label.is-selected')).toHaveText('37');
    for (const floor of ['piwnica', 'parter', 'pietro-1', 'pietro-2', 'pietro-3']) {
      expect(await page.locator(`[data-label-floor="${floor}"]`).count()).toBeGreaterThan(0);
    }
    await expect(page.locator('#mapViewport')).toHaveAttribute('data-visible-floors', 'piwnica,parter,pietro-1,pietro-2,pietro-3');
    const canvas = page.locator('#mapViewport canvas');
    const pixels = await canvas.screenshot();
    const colored = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const sample = document.createElement('canvas');
      sample.width = image.width; sample.height = image.height;
      const context = sample.getContext('2d');
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, image.width, image.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 20) count++;
      return count / (image.width * image.height);
    }, pixels.toString('base64'));
    expect(colored).toBeGreaterThan(0.01);
    await page.locator('#zoomIn').click();
    expect((await canvas.screenshot()).equals(pixels)).toBe(false);
    await page.locator('#resetView').click();
    await page.screenshot({ path: info.outputPath('section.png'), fullPage: true });
    await page.locator('[data-section-floor="parter"]').click();
    await expect(page.locator('[data-map-mode="2d"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#floorTitle')).toHaveText('Parter');
    await expect(page.locator('[data-section-floor]')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('[data-section-floor]:visible')).toHaveCount(5);
  });
}
