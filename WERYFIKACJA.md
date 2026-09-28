# Weryfikacja mapy, 27.09.2026

## Wykonane

- Build produkcyjny `npm run build:pages`: poprawny. `git diff --check`: bez błędów.
- Playwright w Chrome, `npx playwright test --workers=1`: 33/33 testów. Obejmują osiem kondygnacji, wyszukiwanie, alias 05, historię, powrót do sali, oba tryby mapy, stan kamery, hover, klawiaturę, SVG, awarię kafelków oraz brak pobierania kafelków w schemacie.
- Zrzuty dla 1440x900, 1024x768, 430x932, 390x844 i 320x568: `test-results`. Kontrola niepustego renderera obejmuje analizę pikseli zrzutu mapy.
- Ciemny motyw, ograniczenie ruchu i powiększenie CSS do 200%: test automatyczny. Nie zastępuje to prób w rzeczywistym czytniku ekranu ani na fizycznym telefonie.
- Przy 390x844 mapa zaczyna się na wysokości 233 px; zajmuje 58% wysokości okna. Przyciski zoomu terenu mają co najmniej 44x44 px.
- Otwarcie `dist/index.html` przez `file://`: sala 37, przejście do terenu i wymuszony SVG działają, bez błędów JavaScript.
- Niezależny audyt agenta: poprawiono powrót do mapy po wyborze sali z listy, priorytet schodów i wejść, kadrowanie wybranego obiektu terenu oraz wielkość kontrolek Leaflet.

## Lighthouse

Lighthouse 13.5.0, profil mobile, throttling `simulate`, lokalny podgląd `dist` z gzip na porcie 8788, `?room=37`. Pomiar 27.09.2026, 22:40 czasu polskiego, bez równoległego zestawu testów.

| Miara | Wynik |
| --- | --- |
| Wydajność | 95/100 |
| Automatyczny audyt dostępności | 100/100 |
| Dobre praktyki | 100/100 |
| SEO | 100/100 |
| LCP | 1,7 s |
| CLS | 0,001 |
| TBT | 250 ms |

Są to wyniki lokalnego artefaktu z kompresją, nie pomiary opublikowanej domeny. Raport JSON znajduje się w `/tmp/school-lighthouse-final.json`; ten plik tymczasowy nie jest elementem wdrożenia. Wynik dostępności nie oznacza certyfikacji WCAG AA.

## Przed publikacją

- Potwierdzić ewentualne zmiany przestrzenne opisane w `GEOMETRIA-DO-WERYFIKACJI.md`; w tej wersji sporne wielokąty pozostały niezmienione.
- Przeprowadzić test z uczniami i rodzicami: sala 37, sekretariat uczniowski i sala gimnastyczna, bez dodatkowej instrukcji.
- Sprawdzić VoiceOver lub NVDA, rzeczywisty ekran dotykowy i powiększenie przeglądarki.
- Wersja przygotowana lokalnie; nie wykonano commita, pushu ani wdrożenia na domenie produkcyjnej. Zastane zmiany brandingowe oraz notatki o wyposażeniu zachowano.
