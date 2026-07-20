# Nawigacja ZSZ nr 5

Interaktywny plan budynków, kondygnacji i sal Zespołu Szkół Zawodowych nr 5 we Wrocławiu. Aplikacja zawiera plan 2.5D wnętrz, wyszukiwarkę sal, oznaczenia wejść i schodów oraz mapę terenu opartą na OpenStreetMap.

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

Testy Playwright sprawdzają wyszukiwanie, bezpośrednie linki, kondygnacje, mapę terenu, widok mobilny i fallback SVG.

## Wersja produkcyjna

```bash
npm run build:pages
```

Polecenie tworzy katalog `dist` zawierający wyłącznie pliki potrzebne do publikacji. Duże plany PNG są materiałami źródłowymi i nie są przesyłane do GitHub Pages.

## Publikacja

Push do gałęzi `main` uruchamia workflow GitHub Pages. Domena docelowa to `nawigacja.szkolamistrzow.info`.

W DNS subdomena `nawigacja` powinna mieć rekord `CNAME` wskazujący na `adeodatus11.github.io`.
