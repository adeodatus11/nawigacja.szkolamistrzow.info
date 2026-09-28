import { test, expect } from "@playwright/test";

test("bezpośredni link otwiera salę 37 na właściwym piętrze", async ({ page }) => {
  await page.goto("/?room=37");

  await expect(page.locator("#selectedTitle")).toHaveText("Sala 37, pracownia informatyczna");
  await expect(page.locator("#floorTitle")).toHaveText("III piętro");
  await expect(page.locator('[data-floor="pietro-3"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".map-room-label.is-selected")).toHaveText("37");
  await expect(page.locator(".map-landmark-label.is-stairs")).toHaveCount(3);
  await expect(page.locator(".map-room-label", { hasText: "12" })).toHaveCount(0);
});

test("wyszukiwanie nie zmienia piętra przed zatwierdzeniem", async ({ page }) => {
  await page.goto("/?floor=parter");
  await page.locator("#roomSearch").fill("biblioteka");

  await expect(page.locator("#floorTitle")).toHaveText("Parter");
  await expect(page.locator("#selectedTitle")).toHaveText("Wybierz salę");
  await expect(page.locator(".room-result")).toHaveCount(1);
  await expect(page.locator(".room-result strong")).toContainText("Sala 20");

  await page.locator("#roomSearch").press("Enter");
  await expect(page.locator("#floorTitle")).toHaveText("I piętro");
  await expect(page.locator("#selectedTitle")).toContainText("biblioteka");
});

test("zmiana budynku pokazuje wyłącznie jego kondygnacje i czyści wybór", async ({ page }) => {
  await page.goto("/?room=37");
  await page.locator('[data-building="gym"]').click();

  await expect(page.locator("#selectedTitle")).toHaveText("Wybierz salę");
  await expect(page.locator("#floorTitle")).toHaveText("Sala gimnastyczna, parter");
  await expect(page.locator("#floorButtons .floor-button")).toHaveCount(2);
  await expect(page.locator(".map-room-label", { hasText: "37" })).toHaveCount(0);
  await expect(page.locator(".map-room-label", { hasText: "Hala" })).toHaveCount(1);
});

test("przyciski Wstecz i Dalej odtwarzają wybór sali", async ({ page }) => {
  await page.goto("/?floor=parter");
  await page.locator('[data-room="1"]').click();
  await expect(page.locator("#selectedTitle")).toContainText("sekretariat");

  await page.goBack();
  await expect(page.locator("#selectedTitle")).toHaveText("Wybierz salę");
  await expect(page.locator("#floorTitle")).toHaveText("Parter");

  await page.goForward();
  await expect(page.locator("#selectedTitle")).toContainText("sekretariat");
});

test("fallback SVG korzysta z tych samych danych", async ({ page }) => {
  await page.goto("/?fallback=1&room=37");

  await expect(page.locator("#schoolScene")).toBeHidden();
  await expect(page.locator("#fallbackMap")).toBeVisible();
  await expect(page.locator("#fallbackMap svg")).toHaveCount(1);
  await expect(page.locator('[data-svg-room="37"]')).toHaveClass(/is-selected/);
  await expect(page.locator(".svg-stairs")).toHaveCount(3);
  await expect(page.locator(".svg-stairs rect")).toHaveCount(44);
});

test("kolory rozróżniają sale lekcyjne, administrację i sale gimnastyczne", async ({ page }) => {
  await page.goto("/?fallback=1&floor=parter");

  await expect(page.locator(".room-legend li")).toHaveText([
    "Sale lekcyjne / pracownie",
    "Administracja",
    "Sale gimnastyczne",
  ]);
  await expect(page.locator('[data-svg-room="6"]')).toHaveClass(/room-type-classroom/);
  await expect(page.locator('[data-svg-room="1"]')).toHaveClass(/room-type-administration/);
  await expect(page.locator('[data-svg-room="8"]')).toHaveClass(/room-type-gym/);
  await expect(page.locator('[data-room="6"]')).toHaveClass(/room-type-classroom/);
  await expect(page.locator('[data-room="1"]')).toHaveClass(/room-type-administration/);
  await expect(page.locator('[data-room="8"]')).toHaveClass(/room-type-gym/);

  const fills = await Promise.all(["6", "1", "8"].map((roomId) => (
    page.locator(`[data-svg-room="${roomId}"] polygon`).evaluate((element) => getComputedStyle(element).fill)
  )));
  expect(new Set(fills).size).toBe(3);
});

test("najechanie na pomieszczenie pokazuje jego pełną nazwę", async ({ page }) => {
  await page.goto("/?floor=pietro-3");
  const roomLabel = page.locator(".map-room-label", { hasText: "37" });
  const bounds = await roomLabel.boundingBox();
  expect(bounds).not.toBeNull();

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(page.locator(".room-hover-tooltip")).toBeVisible();
  await expect(page.locator(".room-hover-tooltip")).toHaveText("Sala 37, pracownia informatyczna");
  await expect(roomLabel).toHaveClass(/is-hovered/);
});

test("mobilny układ nie ma poziomego przewijania", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?room=37");

  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    mapWidth: document.querySelector("#mapViewport").getBoundingClientRect().width,
  }));

  expect(layout.documentWidth).toBe(layout.viewport);
  expect(layout.mapWidth).toBeLessThanOrEqual(layout.viewport);
  await expect(page.locator("#buildingSelect")).toBeVisible();
  await expect(page.locator("#floorSelect")).toBeVisible();
  await expect(page.locator("#zoomIn")).toBeVisible();
});

test("każda z ośmiu kondygnacji renderuje wyłącznie własne pomieszczenia", async ({ page }) => {
  const floorCases = [
    ["piwnica", "Piwnica"],
    ["parter", "Parter"],
    ["pietro-1", "I piętro"],
    ["pietro-2", "II piętro"],
    ["pietro-3", "III piętro"],
    ["pracownie", "Pracownie zewnętrzne"],
    ["gimnastyczna-0", "Sala gimnastyczna, parter"],
    ["gimnastyczna-1", "Sala gimnastyczna, I piętro"],
  ];

  for (const [floorId, title] of floorCases) {
    await page.goto(`/?floor=${floorId}`);
    await expect(page.locator("#floorTitle")).toHaveText(title);
    await expect(page.locator(".map-room-label:visible").first()).toBeVisible();
    await expect(page.locator(".map-room-label.is-selected")).toHaveCount(0);
  }
});

test("zaktualizowane funkcje pomieszczeń są dostępne pod właściwymi numerami", async ({ page }) => {
  const roomCases = [
    ["gim-piwnica", "Sala gimnastyczna, piwnica"],
    ["sklepik", "Sklepik szkolny"],
    ["6", "Sale 6–7, pracownia fryzjerska"],
    ["14", "Sala 14, wicedyrektor Marzena Filusz"],
    ["24", "Sala 24, wicedyrektor Małgorzata Kończyńska"],
    ["36", "Sala 36, wicedyrektor Maciej Najwer"],
    ["35", "Sala 35, sekretariat dyrektora COSINUS"],
  ];

  for (const [roomId, title] of roomCases) {
    await page.goto(`/?room=${roomId}`);
    await expect(page.locator("#selectedTitle")).toHaveText(title);
  }
});

test("parter ma poprawiony układ sal 6 i 7 bez fikcyjnej sali FR", async ({ page }) => {
  await page.goto("/?floor=parter");

  const parter = await page.evaluate(async () => {
    const { spaces } = await import("/map-data.js");
    return spaces
      .filter((space) => space.floorId === "parter")
      .map(({ id, name, polygon }) => ({ id, name, polygon }));
  });

  expect(parter.some(({ id }) => id === "fryz-parter")).toBe(false);
  expect(parter.find(({ id }) => id === "szatnia")?.polygon).toEqual([[-11, 0], [0, 0], [0, 7], [-11, 7]]);
  expect(parter.find(({ id }) => id === "5")?.polygon).toEqual([[0, 0], [10, 0], [10, 7], [0, 7]]);
  expect(parter.some(({ id }) => id === "7")).toBe(false);
  expect(parter.find(({ id }) => id === "wc-0")?.polygon).toEqual([[28, 0], [33, 0], [33, 7], [28, 7]]);
  expect(parter.find(({ id }) => id === "6")?.polygon).toEqual([[10, 0], [28, 0], [28, 7], [10, 7]]);

  await expect(page.locator(".map-room-label", { hasText: /^FR$/ })).toHaveCount(0);
  await expect(page.locator(".map-room-label", { hasText: /^05$/ })).toHaveCount(1);
});

test("sala 5 pozostaje oddzielną salą lekcyjną", async ({ page }) => {
  await page.goto("/?room=5");

  await expect(page.locator("#selectedTitle")).toHaveText("Sala 5");
  await expect(page.locator(".map-room-label.is-selected")).toHaveText("5");
  await expect(page.locator("#selectedHint")).toContainText("Naprzeciw lewej klatki schodowej");
});

test("piwnica pokazuje tylko wskazane miejsca, a sala 1a nie występuje", async ({ page }) => {
  await page.goto("/?floor=piwnica");
  await expect(page.locator(".room-result")).toHaveCount(6);
  await expect(page.locator(".room-number", { hasText: "P" })).toHaveCount(2);

  await page.locator("#roomSearch").fill("1a");
  await expect(page.locator(".room-result")).toHaveCount(0);

  await page.goto("/?fallback=1&floor=parter");
  await expect(page.locator(".svg-structure")).toHaveCount(2);
  await expect(page.locator('[data-svg-room="1a"]')).toHaveCount(0);
});

test("oznaczenia WC odpowiadają kondygnacjom", async ({ page }) => {
  const wcCases = [
    ["wc-0", "WC męskie"],
    ["wc-1", "WC damskie"],
    ["wc-2", "WC męskie"],
    ["wc-3", "WC damskie"],
  ];

  for (const [roomId, title] of wcCases) {
    await page.goto(`/?room=${roomId}`);
    await expect(page.locator("#selectedTitle")).toHaveText(title);
  }
});

test("wejścia na parterze mają poprawne przeznaczenie", async ({ page }) => {
  await page.goto("/?floor=parter");

  await expect(page.locator(".map-landmark-label.is-entrance", { hasText: "Wejście główne" })).toHaveCount(1);
  await expect(page.locator(".map-landmark-label.is-entrance", { hasText: "Wejście na boisko / dziedziniec" })).toHaveCount(1);
  await expect(page.locator(".map-landmark-label.is-entrance", { hasText: "Wejście boczne" })).toHaveCount(0);
});

test("mapa terenu pokazuje wyłącznie właściwe obrysy OSM szkoły", async ({ page }) => {
  await page.goto("/?view=campus");

  await expect(page.locator("#campusPanel")).toBeVisible();
  await expect(page.locator(".map-panel")).toBeHidden();
  await expect(page.locator("[data-campus-location]")).toHaveCount(4);
  expect(await page.locator("#campusMap path.leaflet-interactive").count()).toBe(4);
  await expect(page.locator('.campus-entry-button')).toHaveCount(2);
  await expect(page.locator(".campus-header > a")).toHaveAttribute("href", /openstreetmap\.org/);

  const correctedCampus = await page.evaluate(async () => {
    const { campusLocations, campusEntrances } = await import("/campus-data.js");
    const location = campusLocations.find((item) => item.id === "gastronomy");
    const gym = campusLocations.find((item) => item.id === "gym");
    const main = campusLocations.find((item) => item.id === "main");
    const entrance = campusEntrances.find((item) => item.id === "gastronomy-entrance");
    return {
      geometryType: location.geometry.type,
      sourceWayIds: location.sourceWayIds,
      entrance: entrance.coordinates,
      gymSourceWayIds: gym.sourceWayIds,
      mainSourceWayIds: main.sourceWayIds,
      mainMinimumLongitude: Math.min(...main.geometry.coordinates[0].map(([longitude]) => longitude)),
    };
  });
  expect(correctedCampus.geometryType).toBe("Polygon");
  expect(correctedCampus.sourceWayIds).toEqual([100918765]);
  expect(correctedCampus.entrance).toEqual([51.093867, 17.038516]);
  expect(correctedCampus.gymSourceWayIds).toEqual([100918049, 100930587]);
  expect(correctedCampus.mainSourceWayIds).toEqual([100914516, 100935952, 100937062, 100942625]);
  expect(correctedCampus.mainMinimumLongitude).toBeGreaterThan(17.0376);
});

test("wybór fryzjerstwa na mapie terenu otwiera salę prF2", async ({ page }) => {
  await page.goto("/?view=campus");
  await page.locator('[data-campus-location="hairdressing"]').click();

  await expect(page.locator("#campusDetailTitle")).toHaveText("Pracownia fryzjerska");
  await expect(page.locator("#campusDetailText")).toContainText("uliczki między budynkami");
  await page.locator("#campusOpenIndoor").click();

  await expect(page.locator("#selectedTitle")).toHaveText("prF2, pracownia fryzjerska");
  await expect(page.locator("#floorTitle")).toHaveText("Pracownie zewnętrzne");
  await expect(page).toHaveURL(/room=prf2/);
});

test("rzut pracowni ma dwa oddzielne obrysy i sale prF2 oraz prF3", async ({ page }) => {
  await page.goto("/?fallback=1&floor=pracownie");

  await expect(page.locator("#fallbackMap .svg-floor")).toHaveCount(2);
  await expect(page.locator("#fallbackMap .svg-corridor")).toHaveCount(2);
  await expect(page.locator('[data-svg-room="prf2"]')).toHaveCount(1);
  await expect(page.locator('[data-svg-room="prf3"]')).toHaveCount(1);
});

test("mobilna mapa terenu nie powoduje przewijania poziomego", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?view=campus");

  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    map: document.querySelector("#campusMap").getBoundingClientRect().width,
  }));
  expect(widths.document).toBe(widths.viewport);
  expect(widths.map).toBeLessThanOrEqual(widths.viewport);
  await expect(page.locator("#campusOpenIndoor")).toBeVisible();
});
