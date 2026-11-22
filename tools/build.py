#!/usr/bin/env python3
"""
Buduje dwie strony z jednego pliku źródłowego:
  <slug>.html          – wersja uczniowska (słowa-klucze zakodowane, bez danych nauczyciela)
  <slug>-teacher.html  – wersja nauczycielska (bez słów-kluczy, z PAGE.TEACHER i materiałami)

Użycie:
  python3 build.py ZRODLO.src.js --out KATALOG [--materials materialy.tsv] [--engine URL]
         [--base-url https://language-edu.github.io/B5 --student-suffix "#staticrypt_pwd=…&remember_me"]
         [--prev POPRZEDNIA_LEKCJA.src.js]   (fiszki poprzedniej lekcji → round-up)

Plik źródłowy (JS):
  PAGE = { slug, title, description, series, unit, lesson, hero, CONFIG, IMAGES, RULES, EXERCISES };
  /* ===== TEACHER ONLY ===== */
  PAGE.TEACHER = { card, warmup, smalltalk, roundup, end, tips, transcripts, models, links, stages };

W EXERCISES słowa-klucze wpisuje się jawnie: kw: "SOFA".
"""
import argparse, base64, html, json, os, re, sys

MARK = "/* ===== TEACHER ONLY ===== */"
ENGINE = "https://language-edu.github.io/engine/v1"
KW_RE = re.compile(r'\bkw:\s*"([^"]*)"')


def enc_kw(word):
    t = word[::-1]
    b = bytes((ord(c) ^ (23 + i)) & 0xFF for i, c in enumerate(t))
    return base64.b64encode(b).decode()


def prev_cards(path):
    """fiszki z poprzedniej lekcji (obrazki z prefiksem prev_, żeby się nie dublowały)"""
    js = r"""
const fs = require('fs'); global.window = global; let PAGE;
eval(fs.readFileSync(process.argv[1], 'utf8').replace(/^\s*PAGE\s*=/m, 'PAGE =').split('/* ===== TEACHER ONLY ===== */')[0]);
const imgs = PAGE.IMAGES || {}, out = {}, decks = [];
(PAGE.EXERCISES || []).filter(e => e.type === 'flashcards').forEach(e => (e.decks || []).forEach(d => {
  decks.push({ name: d.name, cards: (d.cards || []).map(c => { const c2 = Object.assign({}, c); if (c.img && imgs[c.img]) { out['prev_' + c.img] = imgs[c.img]; c2.img = 'prev_' + c.img; } return c2; }) });
}));
process.stdout.write(JSON.stringify({ title: PAGE.title, decks, images: out }));
"""
    import subprocess
    r = subprocess.run(["node", "-e", js, path], capture_output=True, text=True)
    if r.returncode:
        sys.exit("--prev: " + r.stderr)
    return r.stdout


def shell(title, data_js, engine, extra_js=""):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
<meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
<meta name="referrer" content="no-referrer">
<title>{html.escape(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{engine}/engine.css?v={VERSION}">
</head>
<body>
<noscript>This page needs JavaScript.</noscript>
<script>
{extra_js}{data_js}
</script>
<script src="{engine}/engine.js?v={VERSION}"></script>
</body>
</html>
"""


# znacznik wersji w adresie silnika – przeglądarka nie łączy nowego JS ze starym CSS z pamięci podręcznej
import time as _time
VERSION = _time.strftime("%Y%m%d%H%M")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--out", required=True)
    ap.add_argument("--materials", help="eksport zakładki Materiały z arkusza bazy (.tsv) – kopia awaryjna w stronie nauczyciela")
    ap.add_argument("--engine", default=ENGINE)
    ap.add_argument("--prev", help="plik źródłowy poprzedniej lekcji: jej fiszki trafiają do round-upu")
    ap.add_argument("--db-url", help="adres aplikacji Apps Script (baza w Google Sheets)")
    ap.add_argument("--db-token", default="")
    ap.add_argument("--db-sheet", default="", help="ID arkusza bazy (link „Edit in sheet”)")
    ap.add_argument("--base-url", help="adres repo podręcznika, np. https://language-edu.github.io/B5")
    ap.add_argument("--student-suffix", default="", help="ciąg #staticrypt_pwd=…&remember_me hasła uczniowskiego")
    a = ap.parse_args()

    text = open(a.src, encoding="utf-8").read()
    if MARK in text:
        common, teacher = text.split(MARK, 1)
    else:
        common, teacher = text, ""
    m = re.search(r'\bslug:\s*"([^"]+)"', common)
    t = re.search(r'\btitle:\s*"([^"]+)"', common)
    if not m or not t:
        sys.exit("Brak slug lub title w PAGE")
    slug, title = m.group(1), t.group(1)
    sm = re.search(r'\bseries:\s*"([^"]+)"', common)
    um = re.search(r'\bunit:\s*"?(\w+)', common)
    series, unit = (sm.group(1) if sm else ""), (um.group(1) if um else "")
    os.makedirs(a.out, exist_ok=True)

    # wersja uczniowska
    student_js = KW_RE.sub(lambda x: 'kw: "%s"' % enc_kw(x.group(1)), common)
    student_js = re.sub(r'\bpage:\s*"[^"]*",\s*', '', student_js)  # numery stron tylko dla nauczyciela
    student_js += '\nPAGE.mode = "student";\n'
    sp = os.path.join(a.out, slug + ".html")
    open(sp, "w", encoding="utf-8").write(shell(title + " – homework", student_js, a.engine))

    # wersja nauczycielska
    teacher_js = KW_RE.sub("kw: null", common + "\n" + teacher)
    teacher_js += '\nPAGE.mode = "teacher";\n'
    extra = ""
    if a.db_url:
        teacher_js += "PAGE.db = %s;\n" % json.dumps({"url": a.db_url, "token": a.db_token, "sheet": a.db_sheet})
    if a.prev:
        teacher_js += "PAGE.PREV = %s;\n" % prev_cards(a.prev)
        teacher_js += "PAGE.IMAGES = Object.assign(PAGE.IMAGES || {}, PAGE.PREV.images || {});\n"
    if a.base_url:
        teacher_js += 'PAGE.studentLink = %s;\n' % json.dumps(a.base_url.rstrip("/") + "/" + slug + ".html" + a.student_suffix)
    if a.materials:
        # kopia materiałów z dnia publikacji, tylko w zaszyfrowanej stronie nauczyciela.
        # Na bieżąco strona czyta zakładkę „Materiały” z arkusza bazy.
        # Plik: eksport zakładki „Materiały” (.tsv: Seria, Lekcja, Kategoria, Rodzaj, Tytuł, Link, Uwagi)
        # albo stary format .js z tablicą MATERIALY.
        if a.materials.endswith(".tsv"):
            lines = [l.split("\t") for l in open(a.materials, encoding="utf-8").read().splitlines() if l.strip()]
            head = lines[0]
            F = {"Lekcja": "lekcja", "Kategoria": "kategoria", "Rodzaj": "rodzaj", "Tytuł": "tytul", "Link": "link", "Uwagi": "uwagi"}
            rows = []
            for l in lines[1:]:
                r = dict(zip(head, l + [""] * (len(head) - len(l))))
                if r.get("Seria") and series and r["Seria"] != series:
                    continue
                if unit and r.get("Lekcja", "").split(".")[0] != unit:
                    continue  # w kopii tylko bieżący unit
                rows.append({F[k]: v for k, v in r.items() if k in F})
            teacher_js += "PAGE.materialsFallback = %s;\n" % json.dumps(rows, ensure_ascii=False)
        else:
            mat = open(a.materials, encoding="utf-8").read()
            extra = "(function(){\n" + mat + "\nwindow.MATERIALY_FALLBACK = MATERIALY;\n})();\n"
            teacher_js += "PAGE.materialsFallback = window.MATERIALY_FALLBACK || [];\n"
    tp = os.path.join(a.out, slug + "-teacher.html")
    open(tp, "w", encoding="utf-8").write(shell(title + " – teacher", teacher_js, a.engine, extra))
    print(sp)
    print(tp)


if __name__ == "__main__":
    main()
