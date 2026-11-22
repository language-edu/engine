#!/usr/bin/env python3
"""
Test regresji silnika: buduje każdą lekcję (wersja ucznia i nauczyciela) z lokalnym silnikiem
i sprawdza w przeglądarce (Playwright, Chromium), czy wszystko działa.

  python3 tools/test.py ŹRÓDŁA... [--engine-dir test/next] [--materials materialy.tsv]

ŹRÓDŁA = pliki <slug>.src.js albo katalogi z nimi. Kolejność ma znaczenie: lekcja N dostaje
--prev z lekcji N-1 z tego samego unitu (jeśli jest na liście).

Sprawdza dla każdej strony:
  * brak błędów JavaScript (pageerror),
  * każde ćwiczenie z „Show all” → po „Check” wszystkie pola są poprawne (klucz pasuje do sprawdzania),
  * każdy przycisk „Reset” daje się kliknąć bez błędu,
  * wersja ucznia nie zawiera numerów stron ani danych nauczyciela.
Kod wyjścia 0 = wszystko w porządku, 1 = są problemy (lista na końcu).
"""
import argparse, glob, http.server, os, re, shutil, socketserver, subprocess, sys, tempfile, threading

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def sources(args):
    out = []
    for a in args:
        out += sorted(glob.glob(os.path.join(a, "*.src.js"))) if os.path.isdir(a) else [a]
    return out


def meta(path):
    s = open(path, encoding="utf-8").read()
    g = lambda k: (re.search(r'\b' + k + r':\s*"?([^",\n]+)"?', s) or [None, ""])[1].strip()
    return g("slug"), g("unit"), g("lesson")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", nargs="+")
    ap.add_argument("--engine-dir", default=os.path.join(ROOT, "test", "next"))
    ap.add_argument("--materials")
    a = ap.parse_args()
    srcs = sources(a.src)
    if not srcs:
        sys.exit("No *.src.js files found.")

    site = tempfile.mkdtemp(prefix="engine-test-")
    shutil.copytree(a.engine_dir, os.path.join(site, "engine"))
    if a.materials:
        shutil.copy(a.materials, site)

    info = [(p,) + meta(p) for p in srcs]
    for i, (p, slug, unit, lesson) in enumerate(info):
        cmd = [sys.executable, os.path.join(HERE, "build.py"), p, "--out", site, "--engine", "/engine"]
        prev = [q for q, _, u, l in info if u == unit and l.isdigit() and lesson.isdigit() and int(l) == int(lesson) - 1]
        if prev: cmd += ["--prev", prev[0]]
        if a.materials: cmd += ["--materials", a.materials]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode:
            print("BUILD FAILED", p, r.stderr); sys.exit(1)

    os.chdir(site)
    srv = socketserver.TCPServer(("127.0.0.1", 0), type("Q", (http.server.SimpleHTTPRequestHandler,), {"log_message": lambda *x: None}))
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    from playwright.sync_api import sync_playwright
    problems = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for _, slug, _, _ in info:
            for ver in ("", "-teacher"):
                name = slug + ver
                html = open(os.path.join(site, name + ".html"), encoding="utf-8").read()
                if not ver and re.search(r'\bpage:\s*"', html):
                    problems.append(f"{name}: student page contains page references")
                if not ver and "PAGE.TEACHER" in html:
                    problems.append(f"{name}: student page contains teacher data")
                pg = b.new_page(viewport={"width": 1300, "height": 900})
                errs = []
                pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
                pg.goto(f"http://127.0.0.1:{port}/{name}.html")
                pg.wait_for_timeout(1500)
                res = pg.evaluate("""() => {
                  document.querySelectorAll('.ghide').forEach(x => x.classList.remove('ghide'));
                  const out = [];
                  document.querySelectorAll('section.ex').forEach(s => {
                    const btn = t => [...s.querySelectorAll('button')].find(b => b.textContent.includes(t));
                    const all = btn('Show all'), chk = btn('Check');
                    if (all && chk){
                      all.click(); chk.click();
                      const bad = [...s.querySelectorAll('.st-bad, li.bad, .bad')].length;
                      if (bad) out.push(s.id + ': ' + bad + ' field(s) wrong after Show all + Check');
                    }
                    [...s.querySelectorAll('button')].filter(b => /Reset/.test(b.textContent)).forEach(b => b.click());
                  });
                  return [document.querySelectorAll('section.ex').length, out];
                }""")
                pg.wait_for_timeout(300)
                n, bad = res
                problems += [f"{name}: {x}" for x in bad]
                problems += [f"{name}: JS error: {e}" for e in errs]
                print(f"{'OK ' if not bad and not errs else 'ERR'} {name}: {n} cards")
                pg.close()
        b.close()
    srv.shutdown()
    shutil.rmtree(site, ignore_errors=True)
    if problems:
        print("\nProblems:"); [print(" -", p) for p in problems]; sys.exit(1)
    print("\nAll good.")


if __name__ == "__main__":
    main()
