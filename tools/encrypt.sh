#!/bin/bash
# Szyfruje strony StatiCryptem i wypisuje linki z hasłem.
# Użycie: encrypt.sh student|teacher HASŁO SÓL BAZOWY_URL KATALOG_WYJŚCIOWY plik.html [plik2.html ...]
#   BAZOWY_URL np. https://language-edu.github.io/B5
# Wersja nauczycielska ma osobny klucz "Zapamiętaj mnie", więc hasło ucznia i nauczyciela
# mogą być zapamiętane w tej samej przeglądarce jednocześnie.
set -e
MODE="$1"; PASS="$2"; SALT="$3"; BASE="$4"; OUT="$(realpath -m "$5")"; shift 5
WORK=/tmp/staticrypt-tool
if [ ! -d "$WORK/node_modules/staticrypt" ]; then
  mkdir -p "$WORK" && (cd "$WORK" && npm init -y >/dev/null && npm i staticrypt@3 >/dev/null 2>&1)
fi
TPL="$WORK/node_modules/staticrypt/lib/password_template.html"
if [ "$MODE" = "teacher" ]; then
  sed -e 's/"staticrypt_passphrase"/"staticrypt_passphrase_teacher"/' \
      -e 's/"staticrypt_expiration"/"staticrypt_expiration_teacher"/' "$TPL" > "$WORK/teacher_template.html"
  TPL="$WORK/teacher_template.html"
  TITLE="Teacher area – password"; INSTR="Wersja dla nauczyciela. Wpisz hasło nauczycielskie."
  PRIMARY="#1D2A3A"
else
  TITLE="Homework – password"; INSTR="Wpisz hasło od nauczyciela. / Enter the password from your teacher."
  PRIMARY="#2D5B8A"
fi
mkdir -p "$OUT"
for f in "$@"; do
  f="$(realpath "$f")"; name=$(basename "$f")
  (cd "$WORK" && npx staticrypt "$f" -p "$PASS" -s "$SALT" -c false --short --remember 365 -d "$OUT" -t "$TPL" \
    --template-title "$TITLE" --template-instructions "$INSTR" \
    --template-placeholder "Password / Hasło" --template-remember "Remember me / Zapamiętaj mnie" \
    --template-button "Open / Otwórz" --template-error "Wrong password / Złe hasło" \
    --template-color-primary "$PRIMARY" --template-color-secondary "#F3F6FA" >/dev/null 2>&1)
  python3 - "$OUT/$name" <<'PY'
import sys
p=sys.argv[1]; h=open(p).read()
meta='<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">\n<meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex">\n<meta name="referrer" content="no-referrer">\n'
if 'name="robots"' not in h:
    h=h.replace('<head>','<head>\n'+meta,1)
open(p,'w').write(h)
PY
  link=$(cd "$WORK" && npx staticrypt "$f" -p "$PASS" -s "$SALT" -c false --short --share "$BASE/$name" --share-remember 2>&1 | grep -o 'http[^ ]*staticrypt_pwd=[^ ]*' || true)
  echo "$name	$BASE/$name	$link"
done
