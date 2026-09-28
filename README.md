# Nawigacja ZSZ nr 5

Interaktywny plan budynków, kondygnacji i sal Zespołu Szkół Zawodowych nr 5 we Wrocławiu. Telefon domyślnie pokazuje rzut z góry, komputer płytkie 2.5D. Mapa terenu otwiera lokalny schemat; kafelki OpenStreetMap pobierane są dopiero po wybraniu „Okolicy”. Projekt nie obejmuje wyposażenia szkoły.

## Dane i nawigacja

- Geometria wnętrz: `map-data.js`; geometria terenu: `campus-data.js`.
- `wayfinding.js` zawiera wspólne kategorie, aliasy, odczyt adresów i powiązania z dojściem. Brak powiązania ze schodami oznacza brak potwierdzonych danych, nie brak schodów.
- Kolory wszystkich rendererów wynikają ze zmiennych CSS. Logotypy i font Jost pozostają lokalnymi zasobami.
- Linki: `?room=37`, `?room=05`, `?floor=pietro-3&mode=2d`, `?view=campus&location=hairdressing`. `mode=2.5d` włącza perspektywę; `context=surroundings` wybiera mapę okolicy. W adresie z salą i piętrem sala wyznacza kondygnację.
- `?fallback=1` uruchamia plan SVG z wyborem klawiaturą, zoomem, resetem i przesuwaniem. Zbudowany `dist/index.html` można otworzyć przez `file://`; schemat nie wymaga sieci.
- Renderer działa na żądanie. Położenie kamery jest pamiętane osobno dla kondygnacji, perspektywy i orientacji ekranu. Na telefonie przesuwanie jednym palcem włącza przycisk dłoni; domyślnie można przewijać stronę.
- Nierozstrzygnięte kolizje danych i brakujące współrzędne wejść opisano w `GEOMETRIA-DO-WERYFIKACJI.md`. Redesign nie zmienia tych wielokątów ani nie wyznacza automatycznych tras.

## Uruchomienie lokalne

```bash
npm ci
npm run build
npm start
```

Strona będzie dostępna pod adresem `http://localhost:8787/`.

## Testy

```bash
npm test
```

Testy Playwright sprawdzają wyszukiwanie, bezpośrednie linki, historię, wszystkie kondygnacje, kamerę, mapę terenu, brak kafelków, widok mobilny i fallback SVG. Zrzuty pięciu rozmiarów ekranu i test pikseli renderera zapisują się w `test-results`.

Przed publikacją sprawdzić również realny telefon i czytnik ekranu oraz przeprowadzić z uczniami i rodzicami zadania znalezienia sali 37, sekretariatu i sali gimnastycznej. Automatyczne audyty nie stanowią potwierdzenia pełnej zgodności WCAG ani poprawności fizycznego układu szkoły.

## Wersja produkcyjna

```bash
npm run build:pages
```

Polecenie tworzy katalog `dist` zawierający wyłącznie pliki potrzebne do publikacji. Duże plany PNG są materiałami źródłowymi i nie są przesyłane do GitHub Pages.

`npm run preview` udostępnia gotowy `dist` na `http://127.0.0.1:8788/` z kompresją gzip, do lokalnego sprawdzania wydajności. Nie jest częścią aplikacji ani backendem produkcyjnym. Port można zmienić zmienną `PORT`.

## Publikacja

Push do gałęzi `main` uruchamia workflow GitHub Pages. Do czasu skonfigurowania DNS strona działa pod adresem `https://adeodatus11.github.io/nawigacja.szkolamistrzow.info/`. Domena docelowa to `nawigacja.szkolamistrzow.info`.

W DNS subdomena `nawigacja` powinna mieć rekord `CNAME` wskazujący na `adeodatus11.github.io`. Po propagacji DNS domenę należy przypisać w ustawieniach GitHub Pages i włączyć wymuszanie HTTPS.
