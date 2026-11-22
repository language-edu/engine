# engine

Wspólny silnik interaktywnych stron z zadaniami domowymi (language-edu).

- `v1/engine.js`, `v1/engine.css` – silnik. Każda strona zawiera tylko swoją treść (`window.PAGE`) i wczytuje silnik z `https://language-edu.github.io/engine/v1/`.
- `tools/build.py` – z jednego pliku źródłowego `<slug>.src.js` buduje `<slug>.html` (uczeń) i `<slug>-teacher.html` (nauczyciel).
- `tools/encrypt.sh` – szyfruje strony (StatiCrypt) i wypisuje linki z hasłem. Wersja nauczycielska ma osobne „Zapamiętaj mnie”.
- `test/` – strona testowa ze wszystkimi głównymi typami zadań. Sprawdzać ją po każdej zmianie silnika, w obu wersjach, na komputerze i telefonie.

Zmiana w `v1/` działa od razu na wszystkich stronach (po ok. 10 minutach, cache GitHub Pages). Zmiany niezgodne wstecz idą do nowego katalogu `v2/`.
