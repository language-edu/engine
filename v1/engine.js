/* =====================================================================
   ENGINE v1 – wspólny silnik stron z zadaniami (language-edu)
   Strona definiuje window.PAGE (treść), a ten plik buduje całą stronę.
   PAGE.mode = "student" | "teacher"
   ===================================================================== */
(function(){
const PAGE = window.PAGE || {};
const ENGINE_BASE = ((document.currentScript && document.currentScript.src) || "").replace(/[^/]*$/, "");
const TEACHER_MODE = PAGE.mode === "teacher";
const T = TEACHER_MODE ? (PAGE.TEACHER || {}) : {};
const CONFIG = PAGE.CONFIG || {};
/* nauczyciel: dodatkowe nagrania i klucze tylko do ćwiczeń z wersji nauczycielskiej */
if (TEACHER_MODE){ CONFIG.media = Object.assign({}, CONFIG.media, T.media); CONFIG.answers = Object.assign({}, CONFIG.answers, T.answers); }
CONFIG.media = CONFIG.media || {}; CONFIG.answers = CONFIG.answers || {};
const IMAGES = PAGE.IMAGES || {};
if (TEACHER_MODE && T.images) Object.assign(IMAGES, T.images);
const RULES = PAGE.RULES || {};
const asPlain = (list, extra) => (list || []).map(x => x.group ? x : Object.assign({ plain: true, type: "html" }, extra || {}, x));
const TWO_COL = ["order", "tf", "patterns", "pick", "choose", "pickanswer"];
const GAME_TYPES = ["reveal", "timed", "oddone", "spotdiff", "findfour", "xo", "race", "five", "picture"];
const isGame = x => GAME_TYPES.includes(x.type);
const coll = (list, extra) => asPlain(list, Object.assign({ coll: true }, extra || {}));
const WARM = (T.warmup || []).filter(x => !isGame(x) && x.type !== "hook");
const HOOKS = (T.warmup || []).filter(x => x.type === "hook").concat(T.hooks || []);
const GAMES = (T.warmup || []).filter(isGame).concat(T.games || []);
const ROUNDUP = (T.roundup || []).slice();
if (TEACHER_MODE && PAGE.PREV && PAGE.PREV.decks && PAGE.PREV.decks.length) ROUNDUP.unshift({ id: "ru-fc", type: "flashcards", title: "Round-up: " + PAGE.PREV.title, decks: PAGE.PREV.decks, mode: "both" });
/* small talk = jedna lista: powtórka (T.review), temat lekcji (T.smalltalk), polecenia z ruchem (T.commands) */
const SMALLTALK = [].concat(
  T.review && T.review.length ? [{ h: "🔁 Revision (previous lessons)" }, ...T.review] : [],
  T.smalltalk && T.smalltalk.length ? [{ h: "🎯 This lesson" }, ...T.smalltalk] : [],
  T.commands && T.commands.length ? [{ h: "🏃 Commands (stand up and do it)" }, ...T.commands] : []);
const START = TEACHER_MODE ? [].concat(
  WARM.length || SMALLTALK.length || ROUNDUP.length || HOOKS.length ? [{ group: "Warm-up" }] : [],
  coll(WARM, { warm: true }),
  coll(ROUNDUP),
  SMALLTALK.length ? coll([{ id: "smalltalk", type: "talk", title: "💬 Small talk", items: SMALLTALK, mode: "both", tip: true }]) : [],
  HOOKS.length ? coll([{ id: "hooks", type: "hookset", title: "🪝 Hook", items: HOOKS, mode: "both" }], { warm: true }) : []
) : [];
const HW = TEACHER_MODE && PAGE.studentLink ? coll([{ id: "hwqr", type: "qr", title: "📱 Homework page", mode: "both" }]) : [];
const ENDLIST = TEACHER_MODE ? coll(T.end).concat(HW) : [];
/* numery stron (tylko nauczyciel): "SB p. 24, ex. 1 · WB p. 21" → osobne, kolorowe plakietki z pełną nazwą książki */
const BOOKS = { SB: ["sb", "📗 Student's Book"], WB: ["wb", "📘 Workbook"], TB: ["tb", "📕 Teacher's Book"] };
function pageRefs(txt){
  return el("span", { class: "pgrefs" }, String(txt).split(/\s*·\s*/).map(part => {
    const m = part.match(/^(SB|WB|TB)\s+(.*)$/); const b = m && BOOKS[m[1]];
    return el("span", { class: "pgref " + (b ? b[0] : "") }, b ? b[1] + " " + m[2] : "📖 " + part);
  }));
}
/* wersja nauczycielska: wszystkie ćwiczenia SB i WB w kolejności z książek (T.book).
   wpis = id zadania ze strony ucznia albo { id, page: "SB p. 23, ex. 2", title, html, key, transcript } (karta tylko z książki).
   zadania spoza książek trafiają do zwiniętej sekcji Extra, fiszki zostają na początku lekcji */
function bookLesson(){
  const all = (PAGE.EXERCISES || []).filter(e => !e.group);
  const byId = Object.fromEntries(all.map(e => [e.id, e]));
  const used = new Set(), out = [];
  let last = null;
  const fc = all.filter(e => e.type === "flashcards"); fc.forEach(e => used.add(e.id));
  if (fc.length) out.push({ group: "Lesson" }, ...fc);
  T.book.forEach(b => {
    const ex = typeof b === "string" ? byId[b] : Object.assign({ type: "book", plain: true }, b);
    if (!ex) return; used.add(ex.id);
    const bk = String(ex.page || "").slice(0, 2);
    if (BOOKS[bk] && bk !== last){ out.push({ group: BOOKS[bk][1], coll: true, open: bk !== "WB" }); last = bk; }
    out.push(ex);
  });
  const rest = all.filter(e => !used.has(e.id) && e.type !== "note");
  const extra = rest.filter(e => e.type !== "video").concat(T.extra || []), vids = rest.filter(e => e.type === "video");
  if (extra.length) out.push({ group: "➕ Extra (not in the books)", coll: true }, ...extra.map(e => Object.assign({}, e, { coll: true })));
  /* filmy (vids) są w Materials, nie w lekcji */
  return out;
}
const LESSON_LIST = TEACHER_MODE && T.book && T.book.length ? bookLesson()
  : [].concat(START.length && !(PAGE.EXERCISES || [])[0]?.group ? [{ group: "Lesson" }] : [], PAGE.EXERCISES || []);
const EXERCISES = [].concat(
  START,
  LESSON_LIST,
  TEACHER_MODE && GAMES.length ? [{ group: "🎮 Games", coll: true }].concat(coll(GAMES, { game: true })) : [],
  ENDLIST.length ? [{ group: "End of the lesson" }].concat(ENDLIST) : []
);

/* ===================== NARZĘDZIA ===================== */
const SKEY = "lesson-" + (PAGE.slug || "page") + "-v1";
const LESSON = PAGE.title || "";
let S = {};
if (!TEACHER_MODE) try { S = JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { S = {}; }
S.kw = S.kw || {};
function save(){ if (TEACHER_MODE) return; try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) {} }
function st(id){ return S[id] || (S[id] = {}); }

function dk(s){ const b = atob(s); let o = ""; for (let i = 0; i < b.length; i++) o += String.fromCharCode(b.charCodeAt(i) ^ (23 + i)); return o.split("").reverse().join(""); }
function el(tag, attrs, ...kids){
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs){
    if (k === "class") e.className = attrs[k];
    else if (k === "html") e.innerHTML = attrs[k];
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
    else if ((k === "href" || k === "src") && /^\s*(javascript|vbscript):/i.test(String(attrs[k]))) e.setAttribute(k, "#");   /* linki z arkusza: bez javascript: */
    else e.setAttribute(k, attrs[k]);
  }
  kids.flat().forEach(k => { if (k != null) e.append(k.nodeType ? k : document.createTextNode(k)); });
  return e;
}
function shuffle(a){ a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* blokada wklejania / kopiowania */
function guard(f){
  f.setAttribute("autocomplete","off"); f.setAttribute("autocorrect","off");
  f.setAttribute("autocapitalize","off"); f.setAttribute("spellcheck","false");
  ["paste","drop","copy","cut","dragstart","dragover"].forEach(ev => f.addEventListener(ev, e => e.preventDefault()));
  f.addEventListener("beforeinput", e => { if (/^insertFrom(Paste|Drop|Yank|PasteAsQuotation)$/.test(e.inputType)) e.preventDefault(); });
  return f;
}
if (!TEACHER_MODE){
  document.addEventListener("copy", e => { e.preventDefault(); });
  document.addEventListener("cut", e => { e.preventDefault(); });
  document.addEventListener("contextmenu", e => { if (e.target.closest(".ex")) e.preventDefault(); });
}

/* ===================== SPRAWDZANIE (wyrozumiałe dla formy) ===================== */
const NOAPOS = { theres:"there is", isnt:"is not", arent:"are not", weve:"we have", ive:"i have", im:"i am",
  dont:"do not", doesnt:"does not", hasnt:"has not", havent:"have not", theyre:"they are", youre:"you are",
  its:"it is", hes:"he is", shes:"she is", whats:"what is", wheres:"where is", cant:"cannot", wont:"will not",
  couldnt:"could not", ll:"will", wasnt:"was not", werent:"were not", didnt:"did not", thats:"that is" };
const NUMS = { one:"1", two:"2", three:"3", four:"4", five:"5", six:"6", seven:"7", eight:"8", nine:"9", ten:"10",
  first:"1", second:"2", third:"3", fourth:"4", fifth:"5" };
function clean(s){ return String(s).replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trim(); }
function norm(s){
  let t = clean(s).toLowerCase().replace(/'/g, "").replace(/[.,!?;:"()\-–\/]/g, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1");
  return t.split(" ").map(w => NOAPOS[w] || NUMS[w] || w).join(" ").replace(/\bcan not\b/g, "cannot");
}
function formIssues(u, e){
  u = clean(u); e = clean(e); const is = [];
  if (/^[A-Z]/.test(e) && /^[a-z]/.test(u)) is.push("cap");
  if (/\bI\b/.test(e) && /(^|[^A-Za-z'])i([^A-Za-z]|$)/.test(u)) is.push("I");
  const toks = u.toLowerCase().replace(/[.,!?;:"]/g, " ").split(/\s+/);
  if (e.includes("'") && toks.some(w => NOAPOS[w] && w !== "its")) is.push("apos");
  else if (/\bit's\b/i.test(e) && toks.includes("its")) is.push("apos");
  const end = e.slice(-1);
  if (end === "?" && u.slice(-1) !== "?") is.push("q");
  else if ((end === "." || end === "!") && !/[.!]$/.test(u)) is.push("dot");
  return is;
}
/* zwraca {state:'ok'|'form'|'bad'|'empty', issues:[]} */
function grade(user, alts){
  if (!clean(user)) return { state: "empty", issues: [] };
  const nu = norm(user);
  for (const a of alts){
    if (/^\s*KWG?:/i.test(a)){
      const pad = " " + nu + " ";
      const isGap = /^\s*KWG:/i.test(a);
      const groups = a.replace(/^\s*KWG?:/i, "").split("+").map(g => g.split("/").map(x => norm(x)).filter(Boolean));
      if (groups.length && groups.every(g => g.some(x => pad.includes(" " + x + " ")))){
        const is = formIssues(user, isGap ? "x" : "X.");
        return { state: is.length ? "form" : "ok", issues: is };
      }
      continue;
    }
    if (norm(a) === nu){
      const is = formIssues(user, a);
      return { state: is.length ? "form" : "ok", issues: is };
    }
  }
  return { state: "bad", issues: [] };
}
const ISSUE_TXT = {
  cap: "capital letters at the beginning of sentences",
  I: "writing “I” with a capital letter",
  apos: "apostrophes (e.g. there's, isn't, didn't)",
  dot: "a full stop at the end of sentences",
  q: "question marks at the end of questions"
};
function setState(f, s){
  f.classList.remove("st-ok","st-bad","st-form","st-wait");
  if (s === "ok") f.classList.add("st-ok");
  else if (s === "form") f.classList.add("st-form");
  else if (s === "bad" || s === "empty") f.classList.add("st-bad");
  else if (s === "wait") f.classList.add("st-wait");
}

/* ===================== KARTA ZADANIA ===================== */
const REG = {}; // id -> {ex, num, fb, kwBox, score}
function makeCard(ex, num){
  const sec = el("section", { class: "ex" + (ex.extra ? " extra" : ""), id: "ex-" + ex.id });
  const h = el("div", { class: "ex-head" },
    num !== "" ? el("div", { class: "door", "aria-hidden": "true" }, String(num)) : null,
    el("h2", null, ex.title, ex.extra ? el("span", { class: "tag" }, "Extra") : null, ex.teacher ? el("span", { class: "tag teacher" }, "Checked by teacher") : null, ex.page && TEACHER_MODE ? pageRefs(ex.page) : null));
  sec.append(h);
  if (TEACHER_MODE){
    const bd = [];
    if (ex.warm) bd.push(ex.type === "hook" ? "🪝 Hook" : INTERACTIVE.includes(ex.type) ? "🎮 Interactive" : "💬 Speaking");
    if (ex.game) bd.push("🎮 Game");
    if (ex.mode === "class" || ex.mode === "both") bd.push("👥 Class");
    if (ex.mode === "1:1" || ex.mode === "both") bd.push("👤 1:1 / online");
    if (ex.interaction) bd.push("🔁 " + ex.interaction);
    if (bd.length) h.querySelector("h2").append(...bd.map(b => el("span", { class: "tbadge" }, b)));
    if (ex.mode) sec.dataset.mode = ex.mode;
    if (ex.coll || ex.type === "flashcards"){
      sec.classList.add("coll"); h.classList.add("collh"); h.setAttribute("role", "button"); h.tabIndex = 0;
      const tog = e => { if (e.target.closest("button,a,input,select")) return; sec.classList.toggle("open"); };
      h.addEventListener("click", tog);
      h.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); sec.classList.toggle("open"); } });
    }
  }
  if (ex.instr) sec.append(el("p", { class: "instr" }, ex.instr));
  if (ex.hint) sec.append(el("p", { class: "hint" }, ex.hint));
  if (TEACHER_MODE) teacherBlocks(ex).forEach(b => sec.append(b));
  /* pola dla ćwiczeń z książki: bookMedia (nagranie/film), pics (wycinki z książki), pre (tekst do przeczytania) */
  if (ex.bookMedia) [].concat(ex.bookMedia).forEach(m => sec.append(mediaBlock(m)));
  const pics = ex.pics ? el("div", { class: "bkpics noselect" }, ex.pics.map(k => el("img", { src: IMAGES[k] || k, alt: "", draggable: "false" }))) : null;
  if (pics && ex.side === false) sec.append(pics);
  if (ex.pre) sec.append(el("div", { class: "bkpre", html: ex.pre }));
  const body = el("div", { class: "body" });
  /* obrazek z książki obok zadania (side: false = nad zadaniem) */
  const hasAudio = [ex.media].concat(ex.bookMedia || []).some(k => k && ((CONFIG.media || {})[k] || {}).type === "audio");
  /* dwie kolumny tylko gdy po lewej jest nagranie – inaczej zostałoby puste miejsce */
  const two = TEACHER_MODE && !(pics && ex.side !== false) && ex.layout !== "full" && (ex.layout === "two" || (TWO_COL.includes(ex.type) && hasAudio));
  if (two){
    /* nauczyciel: wąskie zadania w dwóch kolumnach – po lewej polecenie, wskazówki, nagranie; po prawej zadanie */
    const left = el("div", { class: "lcol" }); [...sec.childNodes].slice(1).forEach(n => left.append(n));
    sec.append(el("div", { class: "two" }, left, body)); sec._left = left;
  } else {
    /* nauczyciel: polecenie, wskazówki, klucz i nagranie obok siebie (nagranie po prawej) */
    if (TEACHER_MODE && sec.childNodes.length > 1){
      const ml = el("div", { class: "mleft" }), mr = el("div", { class: "mright" });
      const vids = [];
      [...sec.childNodes].slice(1).forEach(n => { const md = n.classList && n.classList.contains("media"); if (md && !n.querySelector("iframe.audio, audio")) vids.push(n); else (md ? mr : ml).append(n); });
      sec.append(el("div", { class: "metarow" }, ml, mr), ...vids); sec._mr = mr;   /* filmy zostają na całą szerokość */
    }
    if (pics && ex.side !== false) sec.append(el("div", { class: "bkrow" }, pics, body)); else sec.append(body);
  }
  const r = { ex, num, sec, body, shown: 0 };
  r.fb = el("div", { class: "fb", role: "status" });
  r.kwBox = el("div", { class: "keyword", "aria-live": "polite" });
  if (ex.rule) ex.rule.forEach(k => body.append(ruleBox(k)));
  REG[ex.id] = r;
  return r;
}
/* nauczyciel: kafelki z ramki wyrazów przeciąga się myszką do luk (albo klik kafelek → klik luka) */
function bankDnD(sec){
  const tiles = [...sec.querySelectorAll(".bank span")]; if (!tiles.length) return;
  /* luki tak szerokie jak najdłuższy kafelek, żeby tekst się mieścił */
  const longest = Math.max(...tiles.map(t => t.textContent.trim().length));
  sec.querySelectorAll("input.gap").forEach(g => { g.style.width = "min(100%, " + (longest + 3) + "ch)"; });
  const gaps = () => [...sec.querySelectorAll("input.gap, input[type=text]")];
  let picked = null;
  const put = (inp, t) => { inp.value = t.textContent.trim(); inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); t.classList.add("used"); if (picked){ picked.classList.remove("pick"); picked = null; } };
  tiles.forEach(t => {
    t.draggable = true; t.classList.add("dtile");
    t.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", t.textContent.trim()); e.dataTransfer.effectAllowed = "copy"; DRAG = t; });
    t.addEventListener("click", () => { if (picked) picked.classList.remove("pick"); picked = picked === t ? null : t; if (picked) t.classList.add("pick"); });
  });
  sec.addEventListener("click", e => { const b = e.target.closest("button"); if (b && /Reset/.test(b.textContent)) tiles.forEach(t => t.classList.remove("used")); });
  gaps().forEach(inp => {
    inp.addEventListener("dragover", e => { e.preventDefault(); inp.classList.add("dropin"); });
    inp.addEventListener("dragleave", () => inp.classList.remove("dropin"));
    inp.addEventListener("drop", e => { e.preventDefault(); inp.classList.remove("dropin"); if (DRAG && sec.contains(DRAG)) put(inp, DRAG); DRAG = null; });
    inp.addEventListener("click", () => { if (picked) put(inp, picked); });
  });
}
/* klik w obrazek z książki / komiks / zdjęcie → pełny rozmiar (Esc lub klik zamyka) */
document.addEventListener("click", e => {
  const img = e.target.closest(".bkpics img, .comic img, .cframe img, img.photo, .notes img, .hkf img, img.wimg, .htmlbox img, .bkpre img");
  if (!img) return;
  const ov = el("div", { class: "lightbox", role: "dialog", "aria-label": "Picture" }, el("img", { src: img.src, alt: img.alt || "" }), el("button", { class: "lbx", type: "button", "aria-label": "Close" }, "✕"));
  const close = () => { ov.remove(); removeEventListener("keydown", esc, true); };
  const esc = ev => { if (ev.key === "Escape"){ ev.stopPropagation(); close(); } };
  ov.addEventListener("click", close); addEventListener("keydown", esc, true);
  document.body.append(ov);
});
let DRAG = null;
/* nauczyciel: każda gra ma „↺ Reset”, który rysuje grę od nowa (nowe losowanie, czyste pola) */
function gameReset(r){
  const ex = r.ex;
  if (!(ex.game || GAME_TYPES.includes(ex.type)) || ex.type === "flashcards") return;
  const redo = () => {
    for (let i = KEY_BOXES.length - 1; i >= 0; i--) if (KEY_BOXES[i].box === r.sec || r.sec.contains(KEY_BOXES[i].box)) KEY_BOXES.splice(i, 1);
    delete S[ex.id]; try { save(); } catch(e){}
    r.body.innerHTML = ""; r.shown = 0; RENDER[ex.type](r); bankDnD(r.sec); add();
  };
  const add = () => {
    const has = [...r.body.querySelectorAll("button")].some(b => /Reset|↺/.test(b.textContent));
    const bR = el("button", { class: "btn ghost greset", type: "button" }, "↺ Reset");
    bR.addEventListener("click", redo);
    if (has) return;
    r.body.append(el("div", { class: "controls" }, bR));
  };
  add();
}
function ruleBox(k){
  return el("details", Object.assign({ class: "rule noselect" }, TEACHER_MODE ? {} : { open: "" }), el("summary", null, "📘 Grammar reminder"), el("div", { class: "rulebody", html: RULES[k] || "" }));
}
function teacherNote(){
  return el("div", { class: "tnote" },
    el("b", null, "✍️ This exercise is checked by your teacher, not automatically."),
    el("br"), "When you finish, click ", el("b", null, "Copy text"), " and paste it into your answer sheet.");
}
/* validate() zwraca tekst ostrzeżenia albo "" gdy wszystko wypełnione */
function teacherControls(r, validate, onClear){
  const msg = el("span", { class: "copied", role: "status" });
  const copyBtn = el("button", { class: "btn", type: "button" }, "📋 Copy text");
  const clearBtn = el("button", { class: "btn ghost", type: "button" }, "Clear");
  r.body.append(el("div", { class: "controls" }, copyBtn, clearBtn, msg), r.fb);
  copyBtn.addEventListener("click", () => {
    const warn = validate();
    copyText(r.buildText()).then(() => {
      if (warn) showFb(r, "warn", warn);
      else showFb(r, "ok", "Copied! Now paste it into your answer sheet (Ctrl+V / long press → Paste).");
      msg.textContent = "Copied!"; setTimeout(() => msg.textContent = "", 2500);
    });
  });
  clearBtn.addEventListener("click", () => {
    if (!confirm("Delete everything you wrote in this exercise?")) return;
    onClear(); r.fb.className = "fb"; r.fb.textContent = ""; renderSummary();
  });
}
function addControls(r, onCheck, onClear, extraBtns){
  r.score = el("span", { class: "score" });
  r.reset = () => { onClear(); hideFb(r); r.shown = 0; r.revealed = false; };
  let tbtns = null;
  if (TEACHER_MODE){
    const solve = all => {
      const sv = r.solvers ? r.solvers() : [];
      if (!sv.length) return;
      hideFb(r);
      if (all){ sv.forEach(f => f()); r.shown = sv.length; }
      else if (r.shown < sv.length) sv[r.shown++]();
      r.revealed = true;
      r.score.textContent = Math.min(r.shown, sv.length) + " / " + sv.length + " shown";
    };
    tbtns = [el("button", { class: "btn tsolve", type: "button", onclick: () => solve(false) }, "👁 Show next"),
             el("button", { class: "btn tsolve", type: "button", onclick: () => solve(true) }, "👁 Show all")];
  }
  const c = el("div", { class: "controls" },
    el("button", { class: "btn", onclick: onCheck }, "Check"),
    tbtns,
    extraBtns || null,
    el("button", { class: "btn ghost", onclick: () => r.reset() }, TEACHER_MODE ? "↺ Reset" : "Clear"),
    r.score);
  r.body.append(c, r.fb, r.kwBox);
  showKw(r);
}
function hideFb(r){ r.fb.className = "fb"; r.fb.textContent = ""; r.score.textContent = ""; }
function showFb(r, cls, txt){ r.fb.className = "fb show " + cls; r.fb.textContent = txt; }
function showKw(r){
  if (S.kw[r.ex.id] && r.ex.kw){
    r.kwBox.innerHTML = "🔑 Keyword: <b>" + dk(r.ex.kw) + "</b>";
    r.kwBox.classList.add("show");
  } else r.kwBox.classList.remove("show");
  updateNav(); renderSummary();
}
/* wspólne podsumowanie wyniku */
function report(r, okCount, total, issues, anyBad){
  r.score.textContent = okCount + " / " + total;
  if (okCount === total){
    S.kw[r.ex.id] = true; save(); showKw(r);
    showFb(r, "ok", "Well done! Everything is correct.");
  } else if (!anyBad && issues.size){
    showFb(r, "warn", "Your answers are right, but you forgot about: " + [...issues].map(i => ISSUE_TXT[i]).join(", ") + ". " + (r.ex.kw ? "Fix it to reveal the keyword." : "Fix it!"));
  } else {
    showFb(r, "bad", "Correct the red fields" + (issues.size ? " and remember about: " + [...issues].map(i => ISSUE_TXT[i]).join(", ") : "") + ". Try again!");
  }
}
function keyFromConfig(name){
  const k = (CONFIG.answers && CONFIG.answers[name]) || [];
  return k.length && k.every(v => String(v).trim()) ? k : null;
}
function noKey(r){ showFb(r, "warn", "The answer key for this exercise isn't ready yet. Ask your teacher."); }

/* ===================== WERSJA NAUCZYCIELSKA ===================== */
/* tekst odpowiedzi do pokazania: pierwsza wersja, a dla wzorów KW: słowa kluczowe */
function ansText(alts){
  alts = [].concat(alts).map(String);
  const plain = alts.find(a => !/^\s*KWG?:/i.test(a));
  if (plain != null) return plain.split("|")[0].trim();
  return alts[0].replace(/^\s*KWG?:/i, "").split("+").map(g => g.split("/")[0].trim()).join(" … ");
}
function fill(f, alts){
  alts = [].concat(alts).map(String);
  if (alts.length && alts.every(a => /^\s*KWG?:/i.test(a))){
    /* odpowiedź otwarta: pokaż, jakich słów oczekujemy */
    f.value = "✱ " + alts[0].replace(/^\s*KWG?:/i, "").split("+").map(g => g.split("/").map(x => x.trim()).join(" / ")).join("  +  ");
    f.dispatchEvent(new Event("input")); setState(f, "wait"); f.title = "Open answer – it must contain these words"; return;
  }
  f.value = ansText(alts); f.dispatchEvent(new Event("input")); setState(f, "ok");
}
function srcTag(s){ return el("span", { class: "src src-" + s }, s); }
function tt(summary, cls, ...kids){
  return el("details", { class: "tt noselect" + (cls ? " " + cls : "") }, el("summary", null, summary), el("div", { class: "ttbody" }, ...kids));
}
const TLS = { get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
let FILTER_MODE = "all";
const curClassName = () => { const c = TLS.get("teacher-classes", null); return (c && c.current) || ""; };
const TODAY_ISO = new Date().toISOString().slice(0, 10);
/* ===== baza w Google Sheets (Apps Script): PAGE.db = { url, token, sheet } ===== */
const DB = (function(){
  const cfg = TEACHER_MODE && PAGE.db && PAGE.db.url ? PAGE.db : null;
  let data = TLS.get("teacher-db", null) || {};
  const st = { msg: "", busy: false, time: TLS.get("teacher-db-time", "") };
  const fire = () => { window.dispatchEvent(new Event("teacher-db")); window.dispatchEvent(new Event("teacher-class")); };
  const same = (row, keys) => Object.keys(keys).every(k => String(row[k] || "") === String(keys[k]));
  function apply(action, sheet, keys, values){
    const L = data[sheet] = data[sheet] || [];
    if (action === "remove"){ data[sheet] = L.filter(r => !same(r, keys)); return; }
    if (action === "append"){ L.push(Object.assign({}, values)); return; }
    const hit = L.filter(r => same(r, keys));
    if (hit.length) hit.forEach(r => Object.assign(r, values)); else L.push(Object.assign({}, keys, values));
  }
  async function call(params){
    const u = new URL(cfg.url);
    Object.entries(Object.assign({ token: cfg.token }, params)).forEach(([k, v]) => u.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v)));
    const r = await fetch(u.toString()); return r.json();
  }
  async function flush(){
    const Q = TLS.get("teacher-db-queue", []); if (!Q.length) return true;
    while (Q.length){ try { const j = await call(Q[0]); if (!j.ok) throw new Error(j.error); Q.shift(); TLS.set("teacher-db-queue", Q); } catch (e) { return false; } }
    return true;
  }
  return {
    on: !!cfg, status: st, sheetUrl: cfg && cfg.sheet ? "https://docs.google.com/spreadsheets/d/" + cfg.sheet + "/edit" : "",
    get: name => (data && data[name]) || [],
    async refresh(){
      if (!cfg || st.busy) return; st.busy = true; st.msg = "Refreshing…"; fire();
      try {
        await flush();
        const j = await call({ action: "read" });
        if (j.ok){ data = j.data || {}; TLS.set("teacher-db", data); st.time = new Date().toLocaleTimeString().slice(0, 5); TLS.set("teacher-db-time", st.time); st.msg = ""; }
        else st.msg = "⚠ " + j.error;
      } catch (e) { st.msg = "⚠ No connection – using the saved copy"; }
      st.busy = false; fire();
    },
    write(action, sheet, keys, values){
      apply(action, sheet, keys || {}, values || {}); TLS.set("teacher-db", data); fire();
      if (!cfg) return;
      const job = { action, sheet, keys: keys || {}, values: values || {} };
      const Q = TLS.get("teacher-db-queue", []); Q.push(job); TLS.set("teacher-db-queue", Q);
      flush().then(ok => { if (!ok){ st.msg = "⚠ Not saved yet (no connection) – will retry"; fire(); } });
    }
  };
})();
if (DB.on) setTimeout(() => DB.refresh(), 50);
/* lista materiałów ze znacznikami „Done” i „Printed” dla wybranej klasy (zapis w przeglądarce) */
function trackList(list){
  const cls = curClassName();
  const fmt = d => d ? d.slice(8, 10) + "." + d.slice(5, 7) : "";
  const local = (TLS.get("teacher-materials", {})[cls]) || {};
  const stateOf = u => {
    if (!DB.on) return local[u] || {};
    const r = DB.get("Znaczniki").find(x => x.Klasa === cls && x.Link === u) || {};
    return { done: r.Zrobione || null, printed: r["Wydrukowane"] === "tak" };
  };
  return el("ul", { class: "tlinks" }, list.map(([t, u, n]) => {
    const st = stateOf(u);
    const upd = (k, v) => {
      if (DB.on){ DB.write("upsert", "Znaczniki", { Klasa: cls, Link: u }, k === "done" ? { Zrobione: v || "" } : { "Wydrukowane": v ? "tak" : "" }); return; }
      const M = TLS.get("teacher-materials", {}); M[cls] = M[cls] || {}; M[cls][u] = Object.assign(M[cls][u] || {}, { [k]: v }); TLS.set("teacher-materials", M); window.dispatchEvent(new Event("teacher-class"));
    };
    const done = el("button", { type: "button", class: "mk" + (st.done ? " on" : ""), title: cls ? "Done with " + cls : "Choose a class in Tools → Class list" }, st.done ? "✓ " + cls + ", " + fmt(st.done) : "✓ Done");
    const pr = el("button", { type: "button", class: "mk" + (st.printed ? " on" : ""), title: "Printed for this class" }, st.printed ? "🖨 Printed" : "🖨 Print");
    if (!cls){ done.disabled = pr.disabled = true; }
    done.addEventListener("click", () => upd("done", st.done ? null : TODAY_ISO));
    pr.addEventListener("click", () => upd("printed", !st.printed));
    return el("li", null, el("a", { href: u, target: "_blank", rel: "noopener" }, t, " ↗"), n ? el("span", { class: "tln" }, " · " + n) : null, el("span", { class: "mks" }, done, pr));
  }));
}
function linkList(list){
  return el("ul", { class: "tlinks" }, list.map(([title, url, note]) =>
    el("li", null, el("a", { href: url, target: "_blank", rel: "noopener" }, title, " ↗"), note ? el("span", { class: "tln" }, " · " + note) : null)));
}
function teacherBlocks(ex){
  const out = [], id = ex.id;
  const tips = (T.tips || {})[id];
  if (tips && tips.length) out.push(tt("🧑‍🏫 Teacher tips", "", tips.map(([s, h]) => el("div", { class: "ttip" }, srcTag(s), el("div", { html: h })))));
  const ky = (T.keys || {})[id];
  if (ky) out.push(tt("🔑 Answer key (TB)", "", el("div", { class: "trans", html: ky })));
  const tr = (T.transcripts || {})[id];
  if (tr) out.push(tt("📄 Transcript", "", el("div", { class: "trans", html: tr })));
  const md = (T.models || {})[id];
  if (md) out.push(tt("✅ Model answer", "", el("div", { class: "ttip" }, srcTag(md[0]), el("div", { class: "model", html: md[1] }))));
  const stg = (T.stages || {})[id];
  if (stg){
    const lab = { lead: "Lead-in", predict: "Prediction", gist: "1st listen / read: gist", detail: "2nd listen / read: details", follow: "Follow-up", replay: "More ways to replay" };
    const kids = Object.keys(lab).filter(k => stg[k]).map(k => el("div", { class: "stg" }, el("b", null, lab[k]), el("div", { html: [].concat(stg[k]).join("<br>") })));
    if (stg.mistakes && stg.mistakes.length){
      const ol = el("ol", { class: "mist" });
      stg.mistakes.forEach(([wrong, right]) => {
        const r2 = el("span", { class: "mright" }, " → " + right); r2.hidden = true;
        const b = el("button", { class: "btn ghost small", type: "button" }, "show");
        b.addEventListener("click", () => { r2.hidden = !r2.hidden; });
        ol.append(el("li", null, el("span", { class: "mwrong" }, wrong), r2, " ", b));
      });
      kids.push(el("div", { class: "stg" }, el("b", null, "Correct my mistakes"), el("div", null, ol)));
    }
    out.push(tt("🎧 Lesson stages", "", kids));
  }
  const ln = (T.links || {})[id];
  if (ln && ln.length) out.push(tt("🖨 Materials", "", linkList(ln)));
  return out;
}
const MAT_ORDER = ["Do druku", "Testy", "Skills Booster", "Plickers", "Blooket", "Inne"];
/* kolejność w „Do druku”: short test, TRF, Extra support, karty pracy, reszta */
const RODZAJ_RANK = { "short test": 0, "trf": 1, "extra support": 2, "karty pracy": 3 };
const PRINT_RANK = m => { const r = RODZAJ_RANK[String(m.rodzaj || "").toLowerCase()]; if (r != null) return r; const t = m.tytul || "";   /* pole rodzaj ma pierwszeństwo, tytuł to zapas dla starych wpisów */
  return /^Short test/i.test(t) ? 0 : /\(TRF\)/.test(t) ? 1 : /Extra support/i.test(t) ? 2 : /Karty pracy/i.test(t) ? 3 : 4; };
function materialsBox(){
  const body = el("div", { class: "ttbody" }, el("p", { class: "hint", style: "margin:0" }, "Loading…"));
  const box = el("details", { class: "tt noselect", id: "materials" }, el("summary", null, "📚 Materials"), body);
  let last = null;
  window.addEventListener("teacher-class", () => { if (last){ const open = [...body.querySelectorAll("details")].map(d => d.open); show(...last); body.querySelectorAll("details").forEach((d, i) => { if (open[i] != null) d.open = open[i]; }); } });
  const show = (list, stale) => {
    body.innerHTML = "";
    const u = String(PAGE.unit || ""), l = u + "." + (PAGE.lesson || "");
    const mine = (list || []).filter(m => m && (String(m.lekcja) === u || String(m.lekcja) === l) && m.link);
    /* filmy z tej lekcji (dla chętnych) też trafiają do Materials */
    (PAGE.EXERCISES || []).filter(e => e.type === "video" && e.media && (CONFIG.media || {})[e.media]).forEach(e => mine.push({ lekcja: l, kategoria: "Filmy", tytul: e.title, link: CONFIG.media[e.media].url, uwagi: "" }));
    if (stale) body.append(el("p", { class: "fb show warn", style: "margin:0 0 8px" }, "⚠ Materials could not be loaded. This is a copy from the day of publishing and may be out of date."));
    last = [list, stale];
    const cls = curClassName();
    body.append(el("p", { class: "hint mkhead", style: "margin:0 0 6px" }, cls ? "Marks ✓ / 🖨 for class: " + cls + " (change it in 🧰 Tools → Class list)" : "To mark materials as done / printed, choose a class in 🧰 Tools → Class list.",
      DB.on && DB.sheetUrl ? el("span", null, " · ", el("a", { href: DB.sheetUrl, target: "_blank", rel: "noopener" }, "✏️ Edit materials in the sheet (tab „Materiały”)")) : null));
    const fastBox = () => (T.fast && T.fast.length) ? el("details", { class: "tt sub", open: "" }, el("summary", null, "For fast finishers (" + T.fast.length + ")"), el("div", { class: "ttbody" }, trackList(T.fast))) : null;
    if (!mine.length){ const f = fastBox(); if (f) body.append(f); else body.append(el("p", { class: "hint", style: "margin:0" }, "No materials yet for this lesson.")); return; }
    const cats = [...new Set(MAT_ORDER.concat(mine.map(m => m.kategoria || "Inne")))].sort((a, b) => (a === "Klucze odpowiedzi") - (b === "Klucze odpowiedzi"));   /* klucze zawsze na końcu */
    cats.forEach(c => {
      let items = mine.filter(m => (m.kategoria || "Inne") === c);
      if (c === "Do druku") items = items.map((m, i) => [m, i]).sort((x, y) => PRINT_RANK(x[0]) - PRINT_RANK(y[0]) || x[1] - y[1]).map(x => x[0]);
      if (!items.length) return;
      if (c === "Testy") items = items.slice().sort((a, b) => (/short/i.test(b.tytul) ? 1 : 0) - (/short/i.test(a.tytul) ? 1 : 0));
      body.append(el("details", { class: "tt sub" }, el("summary", null, c + " (" + items.length + ")"),
        el("div", { class: "ttbody" }, (c === "Klucze odpowiedzi" ? linkList : trackList)(items.map(m => [m.tytul || m.link, m.link, m.uwagi]))))) ;   /* klucze: sam link, bez ✓ Done / 🖨 Print */
      if (c === "Do druku"){ const f = fastBox(); if (f) body.append(f); }
    });
    if (!mine.some(m => (m.kategoria || "Inne") === "Do druku")){ const f = fastBox(); if (f) body.querySelector(".mkhead").after(f); }
  };
  /* materiały z arkusza bazy (zakładka „Materiały”); bez bazy albo bez wierszy: kopia z dnia publikacji (w zaszyfrowanej stronie) */
  if (DB.on){
    const fromDB = () => DB.get("Materiały").filter(r => r && r.Link && (!r.Seria || r.Seria === String(PAGE.series || "")))
      .map(r => ({ lekcja: r.Lekcja, kategoria: r.Kategoria, rodzaj: r.Rodzaj, tytul: r["Tytuł"], link: r.Link, uwagi: r.Uwagi }));
    let sig = "";
    const draw = () => {
      const m = fromDB(), useFb = !m.length, list = useFb ? (PAGE.materialsFallback || []) : m;
      const stale = useFb && !DB.status.busy && /⚠/.test(DB.status.msg || ""), key = JSON.stringify(list) + stale + JSON.stringify(DB.get("Znaczniki"));
      if (key === sig) return; sig = key;
      const open = [...body.querySelectorAll("details")].map(d => d.open);
      show(list, stale);
      body.querySelectorAll("details").forEach((d, i) => { if (open[i] != null) d.open = open[i]; });
    };
    window.addEventListener("teacher-db", () => { if (!DB.status.busy) draw(); });
    draw();
    return box;
  }
  if (!PAGE.materials){ show(PAGE.materialsFallback || [], false); return box; }
  const sc = document.createElement("script");
  sc.src = PAGE.materials + (PAGE.materials.includes("?") ? "&" : "?") + "v=" + Date.now();
  sc.onload = () => { let m = null; try { m = MATERIALY; } catch (e) {} if (Array.isArray(m)) show(m, false); else show(PAGE.materialsFallback || [], true); };
  sc.onerror = () => show(PAGE.materialsFallback || [], true);
  document.head.append(sc);
  return box;
}
function lessonCard(){
  const c = T.card || {};
  /* target / criteria: [["EN", "PL"], …] (PL opcjonalnie) */
  const bi = v => { const L = [].concat(v || []); if (!L.length) return null;
    return "<ul>" + L.map(x => { const [en, pl] = [].concat(x); return "<li>" + en + (pl ? '<div class="lcpl">🇵🇱 ' + pl + "</div>" : "") + "</li>"; }).join("") + "</ul>"; };
  const rows = [["🎯 Target", bi(c.target || c.goals)], ["✅ Success criteria", bi(c.criteria)], ["Language", c.language], ["Pages", c.pages], ["Time", c.time]].filter(x => x[1]);
  const kids = [];
  if (rows.length) kids.push(el("table", { class: "lc" }, rows.map(([k, v]) => el("tr", null, el("th", null, k), el("td", { html: v })))));
  if (c.html) kids.push(el("div", { html: c.html }));
  return kids.length ? tt("📋 Lesson plan", "", kids) : null;
}
/* Teacher hub jako pulpit: kafelki z grup, kliknięcie otwiera sekcję */
function hubDashboard(main, header){
  header.hidden = true;
  const groups = []; let cur = null;
  [...main.children].forEach(n => {
    if (n.matches("h2.group")){ cur = { h: n, secs: [], desc: n.dataset.desc || "" }; groups.push(cur); n.classList.add("hubh"); return; }
    if (cur && n.matches("section.ex")) cur.secs.push(n);
  });
  const back = el("button", { class: "btn ghost hubback", type: "button" }, "← Dashboard");
  const tiles = el("div", { class: "tiles" });
  const show = g => {
    tiles.hidden = !!g; back.hidden = !g;
    groups.forEach(x => { const on = x === g; x.h.hidden = !on; x.secs.forEach(s => s.classList.toggle("hubhide", !on)); });
    window.scrollTo({ top: 0 });
  };
  groups.forEach(g => {
    const t = g.h.textContent.trim(), m = t.match(/^(\S+)\s+(.*)$/);
    const b = el("button", { class: "tile", type: "button" }, el("span", { class: "ticon" }, m ? m[1] : "📁"), el("span", { class: "ttl2" }, m ? m[2] : t), g.desc ? el("span", { class: "tdesc" }, g.desc) : null);
    b.addEventListener("click", () => show(g)); tiles.append(b);
  });
  back.addEventListener("click", () => show(null));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !document.querySelector(".tpanel:not([hidden])")) show(null); });
  main.prepend(tiles, back);
  show(null);
}
function teacherTools(){
  const hide = el("button", { type: "button", title: "Close all teacher notes and hide shown answers (key H)" }, "🙈 Hide");
  const proj = el("button", { type: "button", title: "Bigger text for the projector (key P)", "aria-pressed": "false" }, "A+");
  const doHide = () => {
    document.querySelectorAll("details.tt[open]").forEach(d => d.open = false);
    Object.values(REG).forEach(r => { if (r.revealed && r.reset) r.reset(); });
  };
  const doProj = () => { const on = document.body.classList.toggle("proj"); proj.setAttribute("aria-pressed", on); };
  hide.addEventListener("click", doHide); proj.addEventListener("click", doProj);
  document.addEventListener("keydown", e => {
    if (e.target.closest("input,textarea,select,[contenteditable]") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "h" || e.key === "H") doHide();
    if (e.key === "p" || e.key === "P") doProj();
  });
  const filt = el("button", { type: "button", title: "Show activities for: all / class / 1:1 lessons" }, "👥👤 All");
  const MODES = ["all", "class", "1:1"], LAB = { all: "👥👤 All", class: "👥 Class", "1:1": "👤 1:1" };
  let fm = 0;
  filt.addEventListener("click", () => {
    fm = (fm + 1) % 3; const m = MODES[fm]; filt.textContent = LAB[m]; FILTER_MODE = m; window.dispatchEvent(new Event("teacher-filter"));
    document.querySelectorAll("section.ex[data-mode]").forEach(sec => {
      const md = sec.dataset.mode, hideIt = (m === "class" && md === "1:1") || (m === "1:1" && md === "class");
      sec.hidden = hideIt; const a = navEl.querySelector('a[href="#' + sec.id + '"]'); if (a) a.hidden = hideIt;
    });
  });
  const tools = el("button", { type: "button", title: "Timer, random student, pairs and groups" }, "🧰 Tools");
  const panel = toolsPanel(); tools.addEventListener("click", () => { panel.hidden = !panel.hidden; });
  document.body.append(panel);
  let refreshB = null;
  if (DB.on){
    refreshB = el("button", { type: "button", title: "Refresh data from the Google Sheet" }, "🔄");
    refreshB.addEventListener("click", () => DB.refresh());
    window.addEventListener("teacher-db", () => { refreshB.classList.toggle("spin", DB.status.busy); refreshB.title = DB.status.msg || ("Last refresh: " + (DB.status.time || "—")); refreshB.classList.toggle("warn", /⚠/.test(DB.status.msg)); });
  }
  return el("div", { class: "ttools noselect" }, filt, tools, refreshB, hide, proj);
}
function toolsPanel(){
  const LS = { get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const TODAY = new Date().toISOString().slice(0, 10);
  let CL = LS.get("teacher-classes", null);
  if (!CL){ CL = { current: "", classes: {} }; try { const old = localStorage.getItem("teacher-names"); if (old && old.trim()){ CL.classes["My class"] = { names: old.split("\n").map(x => x.trim()).filter(Boolean), absent: {} }; CL.current = "My class"; } } catch (e) {} }
  const saveCL = () => { LS.set("teacher-classes", CL); window.dispatchEvent(new Event("teacher-class")); };
  const dbClasses = () => { const m = {}; DB.get("Klasy").forEach(r => { const k = r.Klasa, n = r["Imię"]; if (!k || !n) return; (m[k] = m[k] || { names: [], absent: {} }).names.push(n); if (r.Nieobecny) m[k].absent[n] = r.Nieobecny; }); return m; };
  const allClasses = () => DB.on ? dbClasses() : CL.classes;
  const curC = () => allClasses()[CL.current];
  const present = () => { const c = curC(); return c ? c.names.filter(n => c.absent[n] !== TODAY) : []; };

  const tabsBar = el("div", { class: "roles" });
  const body = el("div", { class: "tpbody" });
  const close = el("button", { class: "btn ghost small", type: "button" }, "✕ Close");
  const panel = el("div", { class: "tpanel", hidden: "" }, el("div", { class: "tpin" }, el("div", { class: "tphead" }, tabsBar, close), body));
  close.addEventListener("click", () => panel.hidden = true);
  panel.addEventListener("click", e => { if (e.target === panel) panel.hidden = true; });
  const btn = (label, fn, cls) => { const b = el("button", { class: "btn " + (cls || "ghost"), type: "button" }, label); b.addEventListener("click", fn); return b; };

  /* ---- minutnik (zwykły i „fun”) ---- */
  const FUN = {
    classic: null,
    bomb: (p, done) => done ? '<div class="fx boom">💥</div>' : '<div class="fx bombw"><span class="bomb">💣</span><span class="fuse" style="width:' + Math.round(p * 110) + 'px"></span><span class="spark">✨</span></div>',
    monkey: (p, done) => done ? '<div class="fx">🐒<span class="yum">Yum!</span></div>' : '<div class="fx">🐒<span class="banana" style="clip-path:inset(0 ' + Math.round((1 - p) * 100) + '% 0 0)">🍌</span></div>',
    snowman: (p, done) => done ? '<div class="fx">💧</div>' : '<div class="fx"><span class="snow" style="transform:scale(' + (0.3 + 0.7 * p).toFixed(2) + ')">⛄</span></div>',
    rocket: (p, done) => done ? '<div class="fx launch">🚀</div>' : '<div class="fx rk"><span style="transform:translateY(' + Math.round((1 - p) * -40) + 'px)">🚀</span><span class="pad">🔥</span></div>'
  };
  const THEMES = [["classic", "⏱ Classic"], ["bomb", "💣 Bomb"], ["monkey", "🐒 Monkey & banana"], ["snowman", "⛄ Melting snowman"], ["rocket", "🚀 Rocket"]];
  let theme = LS.get("teacher-timer-theme", "classic");
  const disp = el("div", { class: "tbig" }, "0:00"), flo = el("div", { class: "tfloat", hidden: "", title: "Open the timer" });
  document.body.append(flo);
  let tm = null, left = 0, total = 1, paused = false;
  const fmt = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  const paint = done => {
    const f = FUN[theme], txt = done ? "⏰ Time!" : fmt(left);
    const html = (f ? f(left / total, done) : "") + '<div class="ftime">' + (f ? "" : "⏱ ") + txt + "</div>";
    disp.innerHTML = html; flo.innerHTML = html; flo.classList.toggle("fun", !!f);
  };
  const tick = () => { if (left <= 0){ clearInterval(tm); tm = null; paint(true); beep(); setTimeout(() => { if (!tm) flo.hidden = true; }, 6000); } else paint(false); };
  const run = sec => { clearInterval(tm); left = total = sec; paused = false; flo.hidden = false; tick(); tm = setInterval(() => { if (!paused){ left--; tick(); } }, 1000); };
  const secIn = el("input", { class: "gap", type: "number", min: "5", step: "5", value: "90", style: "width:7ch" });
  const thSel = el("select", { class: "pasel", style: "max-width:22ch" }, THEMES.map(([v, l]) => el("option", { value: v }, l)));
  thSel.value = theme; thSel.addEventListener("change", () => { theme = thSel.value; LS.set("teacher-timer-theme", theme); if (tm) paint(false); else disp.innerHTML = ""; });
  const timer = el("div", null, el("div", { class: "controls" }, thSel), disp,
    el("div", { class: "controls" }, [1, 2, 3, 5].map(m => btn(m + " min", () => run(m * 60))), secIn, btn("s ▶", () => run(Math.max(5, +secIn.value || 60)))),
    el("div", { class: "controls" }, btn("⏯ Pause", () => { paused = !paused; }, ""), btn("＋30 s", () => addT(30)), btn("＋1 min", () => addT(60)),
      btn("↺ Stop", () => { clearInterval(tm); tm = null; flo.hidden = true; disp.innerHTML = "0:00"; })));
  function addT(sec){ if (!tm){ run(sec); return; } left += sec; total += sec; paint(false); }

  /* ---- lista klasy ---- */
  const classView = el("div");
  function drawClass(){
    classView.innerHTML = "";
    const AC = allClasses();
    const sel = el("select", { class: "pasel", style: "max-width:24ch" }, el("option", { value: "" }, "— choose a class —"), Object.keys(AC).map(n => el("option", { value: n }, n)));
    sel.value = CL.current || ""; sel.addEventListener("change", () => { CL.current = sel.value; saveCL(); drawClass(); });
    if (DB.on){
      classView.append(el("div", { class: "controls" }, sel, btn("🔄 Refresh", () => DB.refresh()), DB.sheetUrl ? el("a", { class: "btn ghost", href: DB.sheetUrl + "#gid=0", target: "_blank", rel: "noopener" }, "✏️ Edit names in Google Sheet") : null),
        el("p", { class: "hint" }, "Names come from the Google Sheet (tab „Klasy”). " + (DB.status.msg || (DB.status.time ? "Last refresh: " + DB.status.time : ""))));
    } else {
      const nn = el("input", { class: "gap", type: "text", placeholder: "new class, e.g. 5A or Ola 1:1", style: "width:24ch" });
      const add = btn("＋ Add class", () => { const n = nn.value.trim(); if (!n) return; CL.classes[n] = CL.classes[n] || { names: [], absent: {} }; CL.current = n; saveCL(); drawClass(); });
      classView.append(el("div", { class: "controls" }, sel), el("div", { class: "controls" }, nn, add));
    }
    const c = curC();
    if (!c){ classView.append(el("p", { class: "hint" }, DB.on ? "Choose a class." : "Add a class, then type the names. Everything is saved only in this browser.")); return; }
    const att = el("div", { class: "att" });
    const cnt = el("span", { class: "score" }, present().length + " present");
    c.names.forEach(n => {
      const cb = el("input", { type: "checkbox" }); cb.checked = c.absent[n] === TODAY;
      const lab = el("label", { class: c.absent[n] === TODAY ? "abs" : "" }, cb, " ", n);
      cb.addEventListener("change", () => {
        if (DB.on) DB.write("upsert", "Klasy", { Klasa: CL.current, "Imię": n }, { Nieobecny: cb.checked ? TODAY : "" });
        else { if (cb.checked) c.absent[n] = TODAY; else delete c.absent[n]; saveCL(); }
        lab.classList.toggle("abs", cb.checked); cnt.textContent = present().length + " present"; });
      att.append(lab);
    });
    if (!DB.on){
      const ta = el("textarea", { rows: "5", placeholder: "One name per line", style: "min-height:100px" }); ta.value = c.names.join("\n");
      ta.addEventListener("change", () => { c.names = ta.value.split("\n").map(x => x.trim()).filter(Boolean); saveCL(); drawClass(); });
      let delArm = false; const del = btn("🗑 Delete class", () => { if (!delArm){ delArm = true; del.textContent = "Click again to delete"; return; } delete CL.classes[CL.current]; CL.current = ""; saveCL(); drawClass(); });
      classView.append(el("p", { class: "hint" }, "Names (one per line, saved when you click outside):"), ta,
        el("p", { class: "hint" }, "Tick who is absent today (cleared automatically tomorrow):"), att, el("div", { class: "controls" }, cnt, del));
      const io = el("textarea", { rows: "3", placeholder: "Export / import: copy this text to another computer, or paste here and click Import", style: "min-height:70px" });
      classView.append(el("details", { class: "tt sub" }, el("summary", null, "Export / import"), el("div", { class: "ttbody" }, io,
        el("div", { class: "controls" }, btn("⬆ Export", () => { io.value = JSON.stringify({ classes: CL.classes, materials: LS.get("teacher-materials", {}), polls: LS.get("teacher-polls", []) }); io.select(); }),
          btn("⬇ Import", () => { try { const d = JSON.parse(io.value);
            if (d.classes){ Object.assign(CL.classes, d.classes); if (d.materials) LS.set("teacher-materials", Object.assign(LS.get("teacher-materials", {}), d.materials)); if (d.polls) LS.set("teacher-polls", d.polls); }
            else Object.assign(CL.classes, d);
            saveCL(); drawClass(); } catch (e) { io.value = "This text is not a valid class list."; } })))));
    } else classView.append(el("p", { class: "hint" }, "Tick who is absent today (saved in the sheet, ignored from tomorrow):"), att, el("div", { class: "controls" }, cnt));
  }
  window.addEventListener("teacher-db", () => { if (classView.isConnected) drawClass(); });
  const header = () => el("p", { class: "hint" }, CL.current ? "Class: " + CL.current + " · " + present().length + " present" : "Choose a class in “Class list” first.");

  /* ---- losowanie ---- */
  const picked = new Set(); const pres = el("div", { class: "tbig" }, "?");
  const rep = el("input", { type: "checkbox" });
  const pick = () => { const L = present(); if (!L.length){ pres.textContent = "No names"; return; }
    let pool = L.filter(n => !picked.has(n)); if (!pool.length){ picked.clear(); pool = L; }
    if (rep.checked && picked.size && Math.random() < 0.25) pool = [...picked].filter(n => L.includes(n)).concat(pool.length ? [] : L);
    const n = pool[Math.floor(Math.random() * pool.length)]; picked.add(n); pres.textContent = "🎯 " + n; };
  const pickView = el("div");
  const drawPick = () => { pickView.innerHTML = ""; pickView.append(header(), pres, el("div", { class: "controls" }, btn("🎲 Pick a student", pick, ""), el("label", { class: "hint", style: "margin:0" }, rep, " sometimes pick someone again"))); };

  /* ---- grupy ---- */
  const gres = el("div", { class: "grpres" }); const gsize = el("select", { class: "pasel", style: "max-width:12ch" }, [2, 3, 4].map(n => el("option", { value: n }, n + " people")));
  const mkGroups = () => { const L = shuffle(present()), k = +gsize.value; gres.innerHTML = ""; if (!L.length){ gres.textContent = "No names."; return; }
    const g = []; for (let i = 0; i < L.length; i += k) g.push(L.slice(i, i + k));
    if (g.length > 1 && g[g.length - 1].length < Math.min(2, k)) g[g.length - 2].push(...g.pop());
    g.forEach((x, i) => gres.append(el("div", { class: "grp" }, el("b", null, "Group " + (i + 1)), el("div", null, x.join(", "))))); };
  const groupsView = el("div");
  const drawGroups = () => { groupsView.innerHTML = ""; groupsView.append(header(), el("div", { class: "controls" }, gsize, btn("🔀 Make groups", mkGroups, "")), gres); };

  /* ---- głosowanie ---- */
  let polls = LS.get("teacher-polls", []);
  const getPolls = () => DB.on ? DB.get("Ankiety").filter(r => r.Pytanie).map(r => ({ q: r.Pytanie, opts: String(r.Opcje || "").split("|").map(x => x.trim()).filter(Boolean) })) : polls;
  const voteView = el("div");
  const qIn = el("input", { class: "gap", type: "text", placeholder: "Question, e.g. Which Blooket game?", style: "width:100%;max-width:520px" });
  const oIn = el("textarea", { rows: "4", placeholder: "Options, one per line", style: "min-height:90px" });
  let votes = [];
  const board = el("div", { class: "vboard" });
  function drawBoard(){
    board.innerHTML = ""; const opts = oIn.value.split("\n").map(x => x.trim()).filter(Boolean); if (!opts.length) return;
    while (votes.length < opts.length) votes.push(0);
    const max = Math.max(1, ...votes);
    if (qIn.value.trim()) board.append(el("div", { class: "vq" }, qIn.value.trim()));
    opts.forEach((o, i) => {
      const plus = el("button", { class: "vopt", type: "button" }, el("span", { class: "vbar", style: "width:" + (votes[i] / max * 100) + "%" }), el("span", { class: "vlab" }, o), el("b", { class: "vn" }, String(votes[i])));
      plus.addEventListener("click", () => { votes[i]++; drawBoard(); });
      const minus = el("button", { class: "btn ghost small", type: "button", title: "Remove a vote" }, "−"); minus.addEventListener("click", () => { votes[i] = Math.max(0, votes[i] - 1); drawBoard(); });
      board.append(el("div", { class: "vrow" }, plus, minus));
    });
  }
  function drawSaved(){
    saved.innerHTML = "";
    const P = getPolls();
    if (!P.length){ saved.append(el("p", { class: "hint", style: "margin:0" }, "No saved polls yet.")); return; }
    P.forEach((pl, i) => saved.append(el("div", { class: "vsaved" },
      btn("▶ " + pl.q, () => { qIn.value = pl.q; oIn.value = pl.opts.join("\n"); votes = []; drawBoard(); }),
      btn("✕", () => { if (DB.on) DB.write("remove", "Ankiety", { Pytanie: pl.q }); else { polls.splice(i, 1); LS.set("teacher-polls", polls); } drawSaved(); }))));
  }
  const saved = el("div");
  [qIn, oIn].forEach(x => x.addEventListener("input", () => { votes = []; drawBoard(); }));
  voteView.append(qIn, oIn, el("div", { class: "controls" },
    btn("↺ Reset votes", () => { votes = []; drawBoard(); }),
    btn("💾 Save poll", () => { const q = qIn.value.trim(), opts = oIn.value.split("\n").map(x => x.trim()).filter(Boolean); if (!q || !opts.length) return;
      if (DB.on) DB.write("upsert", "Ankiety", { Pytanie: q }, { Opcje: opts.join(" | ") });
      else { polls = polls.filter(p => p.q !== q); polls.unshift({ q, opts }); LS.set("teacher-polls", polls); }
      drawSaved(); })),
    board, el("p", { class: "hint" }, "Click an option to add a vote (count hands or let students click)."),
    el("details", { class: "tt sub", open: "" }, el("summary", null, "Saved polls"), el("div", { class: "ttbody" }, saved)));
  drawSaved(); window.addEventListener("teacher-db", drawSaved);

  flo.addEventListener("click", () => { panel.hidden = false; tabsBar.querySelector("button").click(); });
  window.TEACHER_OPEN_TOOLS = i => { panel.hidden = false; const b = tabsBar.querySelectorAll("button")[i || 0]; if (b) b.click(); };
  const TABS = [["⏱ Timer", timer, null], ["📋 Class list", classView, drawClass], ["🎯 Pick", pickView, drawPick], ["👥 Groups", groupsView, drawGroups], ["🗳 Vote", voteView, null]];
  TABS.forEach(([lab, view, draw], i) => { const b = el("button", { class: "btn ghost small", type: "button" }, lab);
    b.addEventListener("click", () => { if (draw) draw(); body.innerHTML = ""; body.append(view); tabsBar.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); });
    tabsBar.append(b); if (!i) b.click(); });
  return panel;
}

/* ===================== MEDIA ===================== */
function toEmbed(u){
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return { src: "https://www.youtube.com/embed/" + m[1], open: "https://www.youtube.com/watch?v=" + m[1] };
  m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]+)/);
  if (m) return { src: "https://drive.google.com/file/d/" + m[1] + "/preview", open: "https://drive.google.com/file/d/" + m[1] + "/view" };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { src: "https://player.vimeo.com/video/" + m[1], open: "https://vimeo.com/" + m[1] };
  if (/\.(mp3|m4a|wav|ogg)(\?|$)/i.test(u)) return { audio: true, src: u, open: u };
  return { src: u, open: u };
}
function mediaBlock(key){
  const m = CONFIG.media[key] || {}; const url = (m.url || "").trim();
  const box = el("div", { class: "media" }, el("div", { class: "ttl" }, (m.type === "video" ? "🎬 " : "🎧 ") + (m.title || key)));
  if (!url){ box.append(el("div", { class: "missing" }, "The recording will appear here when your teacher adds the link.")); return box; }
  if (m.newTab){ box.append(el("a", { class: "btn watch", href: url, target: "_blank", rel: "noopener" }, "▶ Watch the video"), el("div", { class: "hint", style: "margin:8px 0 0" }, "The video opens in a new tab.")); return box; }
  const e = toEmbed(url);
  const src = m.embed ? toEmbed(m.embed).src : e.src;
  if (e.audio) box.append(el("audio", { controls: "", preload: "none", src: e.src }));
  else { const fr = el("iframe", { class: m.type === "audio" ? "audio" : "video", src, allow: "autoplay; fullscreen; encrypted-media; picture-in-picture", allowfullscreen: "", loading: "lazy", title: m.title || key });
    box.append(fr); };
  const lk = el("a", { class: "mopen", href: m.embed ? url : e.open, target: "_blank", rel: "noopener" }, "Open it in a new tab ↗");
  if (m.type === "audio") box.querySelector(".ttl").append(lk); else box.append(el("br"), lk);
  return box;
}

/* ===================== WYMOWA (synteza mowy przeglądarki, en-GB) ===================== */
let GB_VOICE = null;
function pickVoice(){
  try {
    const vs = speechSynthesis.getVoices();
    GB_VOICE = vs.find(v => v.lang === "en-GB" && /Google/.test(v.name)) || vs.find(v => v.lang === "en-GB") || vs.find(v => /^en[-_]GB/i.test(v.lang)) || null;
  } catch (e) {}
}
try { pickVoice(); speechSynthesis.addEventListener("voiceschanged", pickVoice); } catch (e) {}
function speak(t){
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "en-GB"; u.rate = 0.85; if (GB_VOICE) u.voice = GB_VOICE;
    speechSynthesis.speak(u);
  } catch (e) {}
}
function sayBtn(text){
  const b = el("button", { class: "say", type: "button", "aria-label": "Listen: " + text, title: "Listen (British English)" }, "🔊");
  b.addEventListener("click", ev => { ev.stopPropagation(); ev.preventDefault(); speak(text); });
  b.addEventListener("keydown", ev => ev.stopPropagation());
  return b;
}

/* ===================== AKTYWNOŚCI NAUCZYCIELSKIE: pomocnicze ===================== */
const INTERACTIVE = ["reveal", "timed", "oddone", "spotdiff", "findfour", "xo", "race", "five", "flashcards", "picture"];
let AUDIO = null;
function beep(){
  try {
    AUDIO = AUDIO || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(t => { const o = AUDIO.createOscillator(), g = AUDIO.createGain(); o.frequency.value = 880; o.connect(g); g.connect(AUDIO.destination);
      g.gain.setValueAtTime(0.25, AUDIO.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, AUDIO.currentTime + t + 0.2); o.start(AUDIO.currentTime + t); o.stop(AUDIO.currentTime + t + 0.21); });
  } catch (e) {}
}
function cardsOf(ex){
  const src = ex.from ? ([...EXERCISES, ...(typeof ROUNDUP !== "undefined" ? ROUNDUP : [])].find(e => e.id === ex.from) || {}) : ex;
  const decks = src.decks || [];
  const pick = ex.deck != null ? [decks[ex.deck]].filter(Boolean) : decks;
  return pick.flatMap(d => d.cards || []);
}
function cardPic(c, cls){
  if (!c || !c.img) return null;
  if (IMAGES[c.img]) return el("img", { class: cls || "fcimg", src: IMAGES[c.img], alt: "", draggable: "false" });
  return el("div", { class: "fcemoji", "aria-hidden": "true" }, c.img);
}
/* panel z pytaniem z fiszki do gier: pokazuje obrazek + PL, po kliknięciu EN */
function cardPrompt(){
  const box = el("div", { class: "gprompt" });
  const show = el("button", { class: "btn ghost small", type: "button" }, "👁 Answer");
  const ans = el("div", { class: "gans" });
  let cur = null;
  show.addEventListener("click", () => { if (!cur) return; ans.innerHTML = ""; ans.append(el("b", null, cur.en), " ", sayBtn(cur.say || cur.en)); });
  return { box, set(c){ cur = c; box.innerHTML = ""; ans.innerHTML = ""; if (!c){ return; } box.append(el("div", { class: "gq" }, cardPic(c, "gimg"), el("div", { class: "fct pl" }, c.pl)), el("div", { class: "gqa" }, show, ans)); } };
}

function btn2(label, fn, cls){ const b = el("button", { class: "btn " + (cls || "ghost"), type: "button" }, label); b.addEventListener("click", fn); return b; }
/* edytor list w Teacher hub z zapisem zestawów w przeglądarce */
function hubEditor(r, kind, placeholder, sample){
  const KEY = "teacher-hub-" + kind;
  const ta = el("textarea", { rows: "5", placeholder, style: "min-height:110px" }); ta.value = sample || "";
  const name = el("input", { class: "gap", type: "text", placeholder: "set name", style: "width:18ch" });
  const sel = el("select", { class: "pasel", style: "max-width:22ch" });
  const api = { lines: () => ta.value.split("\n").map(x => x.trim()).filter(Boolean), onChange: null };
  const load = () => { const S = TLS.get(KEY, {}); sel.innerHTML = ""; sel.append(el("option", { value: "" }, "— saved sets —"), ...Object.keys(S).map(k => el("option", { value: k }, k))); };
  sel.addEventListener("change", () => { const S = TLS.get(KEY, {}); if (S[sel.value] != null){ ta.value = S[sel.value]; name.value = sel.value; api.onChange && api.onChange(); } });
  ta.addEventListener("input", () => api.onChange && api.onChange());
  const save = el("button", { class: "btn ghost small", type: "button" }, "💾 Save"); save.addEventListener("click", () => { const n = name.value.trim(); if (!n) return; const S = TLS.get(KEY, {}); S[n] = ta.value; TLS.set(KEY, S); load(); sel.value = n; });
  const del = el("button", { class: "btn ghost small", type: "button" }, "🗑"); del.addEventListener("click", () => { const S = TLS.get(KEY, {}); delete S[sel.value]; TLS.set(KEY, S); load(); });
  load();
  api.box = el("div", { class: "hubed" }, ta, el("div", { class: "controls" }, sel, name, save, del));
  return api;
}

/* ===================== TYPY ZADAŃ ===================== */
const RENDER = {

  /* --- tekst do napisania (sprawdza nauczyciel): teacher: true, img, bank, start, paperTitle, minWords --- */
  writing(r){
    const ex = r.ex, s = st(ex.id);
    if (!TEACHER_MODE) r.body.append(teacherNote());
    if (ex.bank) r.body.append(el("div", { class: "bank noselect" }, ex.bank.map(b => el("span", null, b))));
    if (ex.img) r.body.append(el("img", { class: "photo wimg noselect", src: IMAGES[ex.img], alt: ex.imgAlt || "", draggable: "false" }));
    const paper = el("div", { class: "paper" });
    if (ex.paperTitle) paper.append(el("div", { class: "pt noselect" }, ex.paperTitle));
    const ta = guard(el("textarea", { "aria-label": "Your text", rows: "9" }));
    const start = ex.start || "";
    ta.value = s.t != null ? s.t : start;
    const cnt = el("div", { class: "count" });
    const words = () => (ta.value.trim().match(/\S+/g) || []).length;
    const upd = () => cnt.textContent = "Words: " + words() + (ex.minWords ? " / at least " + ex.minWords : "");
    ta.addEventListener("input", () => { s.t = ta.value; save(); upd(); ta.classList.remove("st-bad"); renderSummary(); });
    paper.append(ta, cnt); r.body.append(paper); upd();
    const body = () => ta.value.trim();
    const started = () => !!body() && body() !== start.trim();
    r.isStarted = () => started();
    r.isComplete = () => started() && (!ex.minWords || words() >= ex.minWords);
    r.buildText = () => ["Exercise " + r.num + " – " + ex.title + " (" + LESSON + ")", "", body()].join("\n");
    teacherControls(r, () => {
      ta.classList.toggle("st-bad", !started());
      if (!started()) return "Copied – but you haven't written your text yet. Write it and copy again.";
      if (ex.minWords && words() < ex.minWords) return "Copied – but your text is a bit short (at least " + ex.minWords + " words). Add more and copy again.";
      return "";
    }, () => { s.t = start; save(); ta.value = start; upd(); ta.classList.remove("st-bad"); });
  },

  /* --- bez numeru: krótka notka (np. po polsku) --- */
  note(r){ r.sec.classList.add("notecard"); r.body.append(el("p", { class: "notetext" }, r.ex.text)); },

  /* --- bez numeru: link do filmu w nowej karcie (media z CONFIG) --- */
  video(r){
    const m = CONFIG.media[r.ex.media] || {};
    r.sec.querySelector(".ex-head").remove(); r.body.remove(); r.sec.classList.add("vidcard");
    r.sec.append(el("a", { class: "vidlink", href: m.url || "#", target: "_blank", rel: "noopener" }, "🎬 " + r.ex.title, el("span", null, " ↗")));
  },

  /* --- bez numeru: komiks / historyjka z obrazków + nagranie: imgs: ["c1","c2"], media --- */
  comic(r){
    if (r.ex.media) r.body.append(mediaBlock(r.ex.media));
    r.body.append(el("p", { class: "swipe" }, "↔ Swipe left and right to read the whole story."));
    const box = el("div", { class: "comic noselect" }, r.ex.imgs.map((k, i) => el("img", { src: IMAGES[k], alt: (r.ex.title || "Story") + " – part " + (i + 1), draggable: "false" })));
    const cuts = TEACHER_MODE && (T.panels || {})[r.ex.id];
    if (!cuts){ r.body.append(box); return; }
    /* nauczyciel: cały komiks albo ramka po ramce (T.panels[id] = [[obrazek, x od, x do], …] w pikselach oryginału) */
    const frame = el("div", { class: "cframe noselect" }), fimg = el("img", { alt: "", draggable: "false" }); frame.append(fimg); frame.hidden = true;
    const cnt = el("span", { class: "score" }), urls = []; let k = 0;
    const cut = ([key, x0, x1, mask]) => new Promise(res => { const im = new Image(); im.onload = () => { const cv = document.createElement("canvas"); cv.width = x1 - x0 + 1; cv.height = im.naturalHeight; const g = cv.getContext("2d"); g.drawImage(im, x0, 0, cv.width, cv.height, 0, 0, cv.width, cv.height); if (mask){ g.fillStyle = mask[4] || "#fff"; g.fillRect(mask[0] - x0, mask[1], mask[2], mask[3]); } res(cv.toDataURL("image/jpeg", .92)); }; im.src = IMAGES[key]; });   /* mask = [x, y, szer., wys., kolor] zamalowany kolorem tła (np. podpis z sąsiedniej ramki) */
    Promise.all(cuts.map(cut)).then(list => { urls.push(...list); show(); });
    const show = () => { if (!urls.length) return; fimg.src = urls[k]; cnt.textContent = "Frame " + (k + 1) + " / " + urls.length; };
    const go = d => { k = Math.min(Math.max(k + d, 0), urls.length - 1); show(); };
    const bW = el("button", { class: "btn", type: "button", "aria-pressed": "true" }, "🖼 Whole comic");
    const bF = el("button", { class: "btn ghost", type: "button", "aria-pressed": "false" }, "🎞 Frame by frame");
    const bP = el("button", { class: "btn ghost", type: "button" }, "◀ Previous"), bN = el("button", { class: "btn", type: "button" }, "Next ▶");
    bP.addEventListener("click", () => go(-1)); bN.addEventListener("click", () => go(1));
    const nav = el("div", { class: "controls" }, bP, bN, cnt); nav.hidden = true;
    const mode = f => { frame.hidden = !f; nav.hidden = !f; box.hidden = f; bW.className = "btn" + (f ? " ghost" : ""); bF.className = "btn" + (f ? "" : " ghost"); };
    bW.addEventListener("click", () => mode(false)); bF.addEventListener("click", () => mode(true));
    r.body.append(el("div", { class: "controls" }, bW, bF), box, frame, nav);
    KEY_BOXES.push({ box: r.sec, key: key => { if (frame.hidden) return false; if (key === "ArrowRight"){ go(1); return true; } if (key === "ArrowLeft"){ go(-1); return true; } return false; } });
  },

  /* --- zwrot według wzoru liter: items: [[sytuacja, "K _ _ p …", "Keep your chin up!"], …] --- */
  patterns(r){
    const ex = r.ex, s = st(ex.id); s.v = s.v || {};
    const ol = el("ol", { class: "items pat" }); const fields = [];
    ex.items.forEach(([sit, pat, ans], i) => {
      const f = guard(el("input", { class: "gap", type: "text", "aria-label": "sentence " + (i + 1) }));
      f.value = s.v[i] || "";
      f.addEventListener("input", () => { s.v[i] = f.value; save(); setState(f, ""); });
      fields.push([f, String(ans).split("|")]);
      ol.append(el("li", null, el("div", { class: "sit noselect" }, sit), el("div", { class: "pp noselect" }, pat), f));
    });
    r.body.append(ol);
    r.solvers = () => fields.map(([f, alts]) => () => fill(f, alts));
    addControls(r, () => gradeFields(r, fields), () => { s.v = {}; save(); fields.forEach(([f]) => { f.value = ""; setState(f, ""); }); });
  },

  /* --- dwie części przy każdym pytaniu: wybór [Is|Are] + odpowiedź z listy pod pytaniem
       options: {a:"…"}, items: ["[Is|Are] there …?"], key: [0,…], match: ["d",…] --- */
  pickanswer(r){
    const ex = r.ex, s = st(ex.id); s.v = s.v || {}; s.m = s.m || {};
    if (ex.media) r.body.append(mediaBlock(ex.media));
    const letters = Object.keys(ex.options);
    const ol = el("ol", { class: "items pick pa noselect" }); const groups = [], sels = [];
    ex.items.forEach((text, i) => {
      const li = el("li"); const q = el("div", { class: "paq" });
      text.split(/(\[[^\]]+\])/).forEach(part => {
        const m = part.match(/^\[(.+)\]$/);
        if (!m){ q.append(part); return; }
        const opts = m[1].split("|"); const wrap = el("span", { class: "pg" });
        const btns = opts.map((o, oi) => {
          const b = el("button", { type: "button", "aria-pressed": "false" }, o);
          b.addEventListener("click", () => { s.v[i] = oi; save(); wrap.classList.remove("st-ok", "st-bad"); paint(); });
          return b;
        });
        btns.forEach((b, oi) => { wrap.append(b); if (oi < btns.length - 1) wrap.append(el("span", { class: "sl" }, "/")); });
        const paint = () => btns.forEach((b, oi) => b.setAttribute("aria-pressed", s.v[i] === oi));
        paint(); groups.push([wrap, paint]); q.append(wrap);
      });
      const sel = el("select", { class: "pasel", "aria-label": "answer to question " + (i + 1) },
        el("option", { value: "" }, "— choose the answer —"),
        letters.map(L => el("option", { value: L }, L + ")  " + ex.options[L])));
      const shown = el("div", { class: "pashow" });
      const echo = () => { shown.textContent = sel.value ? ex.options[sel.value] : ""; };
      sel.value = s.m[i] || ""; echo();
      sel.addEventListener("change", () => { s.m[i] = sel.value; save(); setState(sel, ""); echo(); });
      sel.echo = echo; sels.push(sel);
      li.append(q, el("div", { class: "paa" }, el("span", { class: "arr" }, "↳"), sel), shown);
      ol.append(li);
    });
    r.body.append(ol);
    r.solvers = () => ex.items.flatMap((_, i) => [() => { s.v[i] = ex.key[i]; save(); groups[i][1](); groups[i][0].classList.add("st-ok"); }, () => { const sel = sels[i]; sel.value = ex.match[i]; s.m[i] = sel.value; save(); sel.echo(); setState(sel, "ok"); }]);
    addControls(r, () => {
      let ok = 0;
      groups.forEach(([w], i) => { const g = s.v[i] === ex.key[i]; if (g) ok++; w.classList.remove("st-ok", "st-bad"); w.classList.add(g ? "st-ok" : "st-bad"); });
      sels.forEach((sel, i) => { const g = sel.value === ex.match[i]; if (g) ok++; setState(sel, g ? "ok" : "bad"); });
      report(r, ok, groups.length + sels.length, new Set(), true);
    }, () => { s.v = {}; s.m = {}; save(); groups.forEach(([w, p]) => { w.classList.remove("st-ok", "st-bad"); p(); }); sels.forEach(sel => { sel.value = ""; setState(sel, ""); sel.echo(); }); });
  },

  /* --- pytanie z rozsypanych słów + odpowiedź
       items: [[["what","there","?"], ["What is there …?"], "klucz odpowiedzi (opcjonalnie)"], …]
       klucz odpowiedzi w items[i][2] albo w CONFIG.answers[keyFrom][i]; pusty = czeka na klucz; photo --- */
  qa(r){
    const ex = r.ex, s = st(ex.id); s.q = s.q || {}; s.a = s.a || {};
    if (ex.media) r.body.append(mediaBlock(ex.media));
    if (ex.photo) r.body.append(el("img", { class: "photo noselect", src: IMAGES[ex.photo], alt: "", draggable: "false" }));
    const ol = el("ol", { class: "items qa" }); const qf = [], af = [];
    const mk = (store, i, label) => {
      const f = guard(el("input", { class: "gap", type: "text", "aria-label": label }));
      f.value = store[i] || "";
      f.addEventListener("input", () => { store[i] = f.value; save(); setState(f, ""); });
      return f;
    };
    ex.items.forEach((it, i) => {
      const q = mk(s.q, i, "question " + (i + 1)), a = mk(s.a, i, "answer " + (i + 1));
      qf.push(q); af.push(a);
      ol.append(el("li", null, el("div", { class: "chips noselect" }, it[0].map(c => el("span", null, c))),
        el("label", null, el("span", { class: "noselect" }, "Q:"), q),
        el("label", null, el("span", { class: "noselect" }, "A:"), a)));
    });
    r.body.append(ol);
    r.solvers = () => { const ck = ex.keyFrom ? ((CONFIG.answers && CONFIG.answers[ex.keyFrom]) || []) : []; return ex.items.flatMap((it, i) => { const key = String(it[2] != null ? it[2] : (ck[i] || "")).trim(); return [() => fill(qf[i], it[1]), () => key ? fill(af[i], key.split("|").map(x => x.trim())) : setState(af[i], "wait")]; }); };
    addControls(r, () => {
      const ck = ex.keyFrom ? ((CONFIG.answers && CONFIG.answers[ex.keyFrom]) || []) : [];
      let ok = 0, anyBad = false, missing = 0; const issues = new Set();
      const one = (f, alts) => {
        const g = grade(f.value, alts); setState(f, g.state);
        if (g.state === "ok") ok++; else if (g.state === "form") g.issues.forEach(x => issues.add(x)); else anyBad = true;
      };
      ex.items.forEach((it, i) => {
        one(qf[i], it[1]);
        const key = String(it[2] != null ? it[2] : (ck[i] || "")).trim();
        if (!key){ missing++; setState(af[i], "wait"); return; }
        one(af[i], key.split("|").map(x => x.trim()));
      });
      const total = ex.items.length * 2;
      if (missing){
        r.score.textContent = ok + " / " + (total - missing);
        showFb(r, anyBad || issues.size ? "bad" : "warn",
          (anyBad || issues.size ? "Correct the red/yellow fields" + (issues.size ? " (remember about: " + [...issues].map(x => ISSUE_TXT[x]).join(", ") + ")" : "") + ". " : "So far so good! ") +
          "Some answers (dashed fields) will be checked when your teacher adds the key.");
        return;
      }
      report(r, ok, total, issues, anyBad);
    }, () => { s.q = {}; s.a = {}; save(); qf.concat(af).forEach(f => { f.value = ""; setState(f, ""); }); });
  },

  match(r){
    const ex = r.ex, s = st(ex.id); s.a = s.a || {};
    let selWord = null, selPic = null;
    const words = el("ul", { class: "words noselect" });
    const pics = el("div", { class: "pics noselect" });
    const wEls = [], pEls = {};
    function assign(wi, letter){
      for (const k in s.a) if (s.a[k] === letter) delete s.a[k];
      s.a[wi] = letter; save(); selWord = selPic = null; paint();
    }
    function paint(){
      wEls.forEach((w, i) => {
        w.classList.toggle("sel", selWord === i);
        const slot = w.querySelector(".slot"); slot.innerHTML = "";
        if (s.a[i]) slot.append(el("img", { src: IMAGES[s.a[i]], alt: "picture " + s.a[i] }));
      });
      for (const L in pEls){
        const by = Object.keys(s.a).find(k => s.a[k] === L);
        pEls[L].classList.toggle("used", by != null);
        pEls[L].classList.toggle("sel", selPic === L);
        pEls[L].querySelector(".usedby").textContent = by != null ? (+by + 1) : "";
      }
    }
    ex.words.forEach((w, i) => {
      const li = el("li", { class: "word", tabindex: "0", role: "button" },
        el("span", { class: "n" }, (i + 1) + "."), ex.speak ? sayBtn(w) : null, el("span", { class: "w" }, w), el("span", { class: "slot" }));
      li.addEventListener("click", ev => {
        if (ev.target.closest(".slot") && s.a[i]){ delete s.a[i]; save(); paint(); return; }
        if (selPic){ assign(i, selPic); return; }
        selWord = selWord === i ? null : i; paint();
      });
      li.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); li.click(); } });
      wEls.push(li); words.append(li);
    });
    pics.style.setProperty("--cols", ex.cols || 5);
    (ex.letters || "abcdefghij".split("")).forEach(L => {
      const p = el("div", { class: "pic", tabindex: "0", role: "button", "aria-label": "picture " + L },
        el("span", { class: "usedby" }), el("img", { src: IMAGES[L], alt: "", draggable: "false" }), el("span", { class: "l" }, L));
      p.addEventListener("click", () => {
        if (selWord != null){ assign(selWord, L); return; }
        selPic = selPic === L ? null : L; paint();
      });
      p.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); p.click(); } });
      pEls[L] = p; pics.append(p);
    });
    r.body.append(el("div", { class: "match" }, words, pics));
    paint();
    r.solvers = () => ex.words.map((w, i) => () => { assign(i, ex.key[i]); setState(wEls[i], "ok"); });
    addControls(r, () => {
      let ok = 0;
      wEls.forEach((w, i) => { const g = s.a[i] === ex.key[i]; if (g) ok++; setState(w, g ? "ok" : "bad"); });
      report(r, ok, ex.words.length, new Set(), ok < ex.words.length);
    }, () => { s.a = {}; save(); wEls.forEach(w => setState(w, "")); paint(); });
  },

  gaps(r){
    const ex = r.ex, s = st(ex.id); s.v = s.v || {};
    if (ex.look) r.body.append(el("div", { class: "look noselect" }, el("div", { class: "lt" }, "🔍 Look"),
      el("div", null, ex.look.map(([a, b]) => el("span", { class: "lp" }, a, el("b", null, " → "), b)))));
    if (ex.bank) r.body.append(el("div", { class: "bank noselect" }, ex.bank.map(b => el("span", null, b))));
    if (ex.example) r.body.append(el("div", { class: "bubbles noselect" }, el("div", { class: "bub" }, ex.example[0]), el("div", { class: "bub r" }, ex.example[1])));
    const ol = el("ol", { class: "items noselect" + (ex.cls ? " " + ex.cls : "") }); const fields = [];
    ex.items.forEach((it, i) => {
      const f = guard(el("input", { class: "gap", type: "text", "aria-label": "gap " + (i + 1) }));
      f.value = s.v[i] || ""; f.style.width = Math.max(8, (String(it[1][0]).split("|")[0].length + 3)) + "ch";
      f.addEventListener("input", () => { s.v[i] = f.value; save(); setState(f, ""); });
      fields.push([f, it[1].flatMap(x => String(x).split("|").map(t => t.trim()))]);   /* „a|b” = dwie poprawne odpowiedzi */
      ol.append(el("li", null, it[0], f, it[2]));
    });
    r.body.append(ol);
    r.solvers = () => fields.map(([f, alts]) => () => fill(f, alts));
    addControls(r, () => gradeFields(r, fields), () => { s.v = {}; save(); fields.forEach(([f]) => { f.value = ""; setState(f, ""); }); });
  },

  email(r){
    const ex = r.ex, s = st(ex.id); s.v = s.v || {};
    if (ex.media) r.body.append(mediaBlock(ex.media));
    const body = el("div", { class: "body noselect" }); const fields = [];
    ex.text.split("\n").forEach(line => {
      const p = el("div");
      line.split(/(\{\d+\})/).forEach(part => {
        const m = part.match(/^\{(\d+)\}$/);
        if (!m){ p.append(part); return; }
        const n = +m[1];
        const f = guard(el("input", { class: "gap", type: "text", "aria-label": "gap " + n }));
        f.style.width = "11ch"; f.value = s.v[n] || "";
        f.addEventListener("input", () => { s.v[n] = f.value; save(); setState(f, ""); });
        fields.push([f, n]);
        p.append(el("sup", null, String(n)), f);
      });
      body.append(p);
    });
    r.body.append(el("div", { class: "email" }, el("div", { class: "bar" }, r.ex.bar || ""), body));
    r.solvers = () => { const key = keyFromConfig(ex.keyFrom) || []; return fields.map(([f, n]) => () => fill(f, String(key[n - 1] || "").split("|").map(x => x.trim()))); };
    addControls(r, () => {
      const key = keyFromConfig(ex.keyFrom); if (!key){ noKey(r); return; }
      gradeFields(r, fields.map(([f, n]) => [f, String(key[n - 1]).split("|").map(x => x.trim())]));
    }, () => { s.v = {}; save(); fields.forEach(([f]) => { f.value = ""; setState(f, ""); }); });
  },

  reading(r){
    const ex = r.ex;
    r.sec.classList.add("reading");
    const ins = r.sec.querySelector(".instr"); if (ins) ins.remove();
    r.sec.querySelector(".ex-head").remove();
    r.body.classList.add("noselect");
    if (ex.media) r.body.append(mediaBlock(ex.media));
    if (ex.heading) r.body.append(el("h3", null, ex.heading));
    if (ex.img) r.body.append(el("img", { src: IMAGES[ex.img], alt: ex.imgAlt || "", draggable: "false" }));
    r.body.append(el("div", { html: ex.html || "" }));
  },

  photowords(r){
    const ex = r.ex, s = st(ex.id); s.v = s.v || {};
    const grid = el("div", { class: "pw" }); const fields = [];
    ex.items.forEach(([img, pat, ans], i) => {
      const f = guard(el("input", { class: "gap", type: "text", "aria-label": "word " + (i + 1) }));
      f.value = s.v[i] || "";
      f.addEventListener("input", () => { s.v[i] = f.value; save(); setState(f, ""); });
      fields.push([f, [ans]]);
      grid.append(el("div", { class: "pwc" },
        el("div", { class: "pwi noselect" }, el("span", { class: "pwn" }, String(i + 1)), el("img", { src: IMAGES[img], alt: "photo " + (i + 1), draggable: "false" })),
        el("div", { class: "pwp noselect" }, pat), f));
    });
    r.body.append(grid);
    r.solvers = () => fields.map(([f, alts]) => () => fill(f, alts));
    addControls(r, () => gradeFields(r, fields), () => { s.v = {}; save(); fields.forEach(([f]) => { f.value = ""; setState(f, ""); }); });
  },

  pick(r){
    const ex = r.ex, s = st(ex.id); s.v = s.v || {};
    const ol = el("ol", { class: "items pick noselect" }); const groups = [];
    let g = 0;
    ex.items.forEach(text => {
      const li = el("li");
      text.split(/(\[[^\]]+\])/).forEach(part => {
        const m = part.match(/^\[(.+)\]$/);
        if (!m){ li.append(part); return; }
        const gi = g++; const opts = m[1].split("|");
        const wrap = el("span", { class: "pg" });
        const btns = opts.map((o, oi) => {
          const b = el("button", { type: "button", "aria-pressed": "false" }, o);
          b.addEventListener("click", () => { s.v[gi] = oi; save(); wrap.classList.remove("st-ok", "st-bad"); paint(); });
          return b;
        });
        btns.forEach((b, oi) => { wrap.append(b); if (oi < btns.length - 1) wrap.append(el("span", { class: "sl" }, "/")); });
        const paint = () => btns.forEach((b, oi) => b.setAttribute("aria-pressed", s.v[gi] === oi));
        paint(); groups.push([wrap, paint]); li.append(wrap);
      });
      ol.append(li);
    });
    r.body.append(ol);
    r.solvers = () => groups.map(([w, p], i) => () => { s.v[i] = ex.key[i]; save(); p(); w.classList.add("st-ok"); });
    addControls(r, () => {
      let ok = 0;
      groups.forEach(([w], i) => { const gd = s.v[i] === ex.key[i]; if (gd) ok++; w.classList.remove("st-ok", "st-bad"); w.classList.add(gd ? "st-ok" : "st-bad"); });
      report(r, ok, groups.length, new Set(), ok < groups.length);
    }, () => { s.v = {}; save(); groups.forEach(([w, p]) => { w.classList.remove("st-ok", "st-bad"); p(); }); });
  },

  article(r){
    const ex = r.ex, s = st(ex.id);
    if (!TEACHER_MODE) r.body.append(el("div", { class: "tnote" },
      el("b", null, "✍️ This exercise is checked by your teacher, not automatically."),
      el("br"), "When you finish, click ", el("b", null, "Copy text"), " and paste it into your answer sheet."));
    const picks = el("div", { class: "artpics" }); const cards = [];
    ex.pics.forEach(([img, words], i) => {
      const c = el("button", { type: "button", class: "artpic", "aria-pressed": "false" },
        el("div", { class: "bank noselect" }, words.map(w => el("span", null, w))),
        el("img", { src: IMAGES[img], alt: "picture " + (i + 1), draggable: "false" }),
        el("div", { class: "lab" }, "Picture " + (i + 1)));
      c.addEventListener("click", () => { s.pic = i; save(); paint(); renderSummary(); });
      cards.push(c); picks.append(c);
    });
    const paint = () => cards.forEach((c, i) => c.setAttribute("aria-pressed", s.pic === i));
    const paper = el("div", { class: "paper" }, el("div", { class: "bn noselect" }, el("span", null, "BREAKING "), el("b", null, "NEWS")));
    const ta = guard(el("textarea", { "aria-label": "Your article", rows: "9" }));
    ta.value = s.t != null ? s.t : ex.start;
    const cnt = el("div", { class: "count" });
    const words = () => (ta.value.trim().match(/\S+/g) || []).length;
    const upd = () => cnt.textContent = "Words: " + words();
    ta.addEventListener("input", () => { s.t = ta.value; save(); upd(); ta.classList.remove("st-bad"); renderSummary(); });
    paper.append(ta, cnt);
    r.body.append(picks, paper);
    paint(); upd();
    const body = () => ta.value.trim();
    const started = () => body() && body() !== ex.start.trim();
    r.isStarted = () => !!started() || s.pic != null;
    r.isComplete = () => !!started() && s.pic != null;
    r.buildText = () => ["Exercise " + r.num + " – " + ex.title + " (" + LESSON + ")",
      "Picture: " + (s.pic != null ? (s.pic + 1) : "—"), "", "BREAKING NEWS", body()].join("\n");
    const msg = el("span", { class: "copied", role: "status" });
    const copyBtn = el("button", { class: "btn", type: "button" }, "📋 Copy text");
    const clearBtn = el("button", { class: "btn ghost", type: "button" }, "Clear");
    r.body.append(el("div", { class: "controls" }, copyBtn, clearBtn, msg), r.fb);
    copyBtn.addEventListener("click", () => {
      const probs = [];
      if (s.pic == null) probs.push("choose a picture");
      if (!started()) probs.push("write your article");
      ta.classList.toggle("st-bad", !started());
      copyText(r.buildText()).then(() => {
        if (probs.length) showFb(r, "warn", "Copied – but remember to " + probs.join(" and ") + ". Then copy again.");
        else showFb(r, "ok", "Copied! Now paste it into your answer sheet (Ctrl+V / long press → Paste).");
        msg.textContent = "Copied!"; setTimeout(() => msg.textContent = "", 2500);
      });
    });
    clearBtn.addEventListener("click", () => {
      if (!confirm("Delete everything you wrote in this exercise?")) return;
      delete s.pic; s.t = ex.start; save(); ta.value = ex.start; paint(); upd();
      r.fb.className = "fb"; r.fb.textContent = ""; renderSummary();
    });
  },

  writeform(r){
    /* formTitle, formRows: [[[label, key], …], …], dialogueTitle,
       dialogue: [[who, fixedText, key|null], …]  (key null = linijka bez pola) */
    const ex = r.ex, s = st(ex.id); s.v = s.v || {};
    const fields = {};
    const inp = (k, label) => {
      const f = guard(el("input", { class: "gap", type: "text", "aria-label": label }));
      f.value = s.v[k] || "";
      f.addEventListener("input", () => { s.v[k] = f.value; save(); f.classList.remove("st-bad"); renderSummary(); });
      fields[k] = f; return f;
    };
    if (!TEACHER_MODE) r.body.append(teacherNote());
    if (ex.formRows){
      const form = el("div", { class: "lpform" }, el("div", { class: "lph noselect" }, ex.formTitle || "Form"));
      ex.formRows.forEach(row => form.append(el("div", { class: "lprow" + (row.length === 3 ? " three" : "") },
        row.map(([label, k]) => el("label", null, el("span", { class: "noselect" }, label + ":"), inp(k, label))))));
      r.body.append(form);
    }
    const dlg = el("div", { class: "wdlg" }); if (ex.dialogueTitle) dlg.append(el("div", { class: "wdh noselect" }, ex.dialogueTitle));
    (ex.dialogue || []).forEach(([who, fixed, k], i) => {
      const row = el("div", { class: "wl" + (k ? "" : " noselect") }, el("span", { class: "who noselect" }, who + ":"));
      if (fixed) row.append(el("span", { class: k ? "pre noselect" : "" }, fixed));
      if (k) row.append(inp(k, who + ", line " + (i + 1)));
      dlg.append(row);
    });
    r.body.append(dlg);
    const v = k => (fields[k].value || "").trim();
    r.buildText = () => {
      const out = ["Exercise " + r.num + " – " + ex.title + " (" + LESSON + ")", ""];
      if (ex.formRows){ out.push(ex.formTitle || "Form"); ex.formRows.forEach(row => out.push(row.map(([l, k]) => l + ": " + v(k)).join("   "))); out.push(""); }
      if (ex.dialogueTitle) out.push(ex.dialogueTitle);
      (ex.dialogue || []).forEach(([who, fixed, k]) => out.push(who + ": " + [fixed, k ? v(k) : ""].filter(Boolean).join(" ")));
      return out.join("\n");
    };
    r.isComplete = () => Object.keys(fields).every(k => v(k));
    r.isStarted = () => Object.keys(fields).some(k => v(k));
    teacherControls(r, () => {
      const empty = Object.keys(fields).filter(k => !v(k));
      Object.keys(fields).forEach(k => fields[k].classList.toggle("st-bad", !v(k)));
      return empty.length ? "Copied – but some fields are empty (marked in red). Fill them in and copy again." : "";
    }, () => { s.v = {}; save(); Object.values(fields).forEach(f => { f.value = ""; f.classList.remove("st-bad"); }); });
  },

  wordsearch(r){
    const ex = r.ex, s = st(ex.id); s.found = s.found || []; s.v = s.v || {};
    const [matW, patW] = atob(ex.words).split("|").map(x => x.split(","));
    const ALL = matW.concat(patW);
    const G = ex.grid, H = G.length, W = G[0].length;
    const wrap = el("div", { class: "ws noselect" });
    const grid = el("div", { class: "wsgrid", style: "--w:" + W });
    const cells = [];
    let start = null;
    G.forEach((row, y) => row.split("").forEach((ch, x) => {
      const c = el("button", { type: "button", class: "cell", "aria-label": ch }, ch);
      c.addEventListener("click", () => pick(y, x));
      cells.push(c); grid.append(c);
    }));
    const info = el("div", { class: "wsinfo" });
    function cell(y, x){ return cells[y * W + x]; }
    function paint(){
      cells.forEach(c => c.classList.remove("found", "start"));
      s.found.forEach(f => f.cells.forEach(([y, x]) => cell(y, x).classList.add("found")));
      if (start) cell(start[0], start[1]).classList.add("start");
      info.textContent = "Found: " + s.found.length + " / " + ALL.length;
    }
    function pick(y, x){
      if (!start){ start = [y, x]; paint(); return; }
      const [y0, x0] = start; start = null;
      const dy = Math.sign(y - y0), dx = Math.sign(x - x0);
      const len = Math.max(Math.abs(y - y0), Math.abs(x - x0)) + 1;
      if ((y !== y0 && x !== x0 && Math.abs(y - y0) !== Math.abs(x - x0)) || len < 2){ paint(); return; }
      let w = "", path = [];
      for (let i = 0; i < len; i++){ const yy = y0 + dy * i, xx = x0 + dx * i; w += G[yy][xx]; path.push([yy, xx]); }
      const rev = w.split("").reverse().join("");
      const hit = ALL.find(a => a === w || a === rev);
      if (hit && !s.found.some(f => f.w === hit)){ s.found.push({ w: hit, cells: path }); save(); }
      else { path.forEach(([yy, xx]) => { const c = cell(yy, xx); c.classList.add("miss"); setTimeout(() => c.classList.remove("miss"), 450); }); }
      paint();
    }
    wrap.append(grid, info); r.body.append(wrap);
    // table
    const table = el("div", { class: "wstable" });
    const cols = [[], []];
    ex.heads.forEach((h, ci) => {
      const col = el("div", { class: "wscol" }, el("div", { class: "wsh noselect" }, h));
      for (let i = 0; i < ex.rows; i++){
        const k = ci + "-" + i;
        const f = guard(el("input", { class: "gap", type: "text", "aria-label": h + " " + (i + 1) }));
        f.value = s.v[k] || "";
        f.addEventListener("input", () => { s.v[k] = f.value; save(); setState(f, ""); });
        cols[ci].push(f); col.append(f);
      }
      table.append(col);
    });
    r.body.append(table);
    paint();
    r.solvers = () => [matW, patW].flatMap((ws, ci) => ws.map((w, i) => () => { if (cols[ci][i]) fill(cols[ci][i], [w.toLowerCase()]); }));
    addControls(r, () => {
      const sets = [matW, patW]; const used = new Set(); let ok = 0, anyBad = false;
      cols.forEach((fs, ci) => fs.forEach(f => {
        const v = norm(f.value).toUpperCase();
        if (!v){ setState(f, ""); return; }
        if (sets[ci].includes(v) && !used.has(v)){ used.add(v); ok++; setState(f, "ok"); }
        else { anyBad = true; setState(f, "bad"); }
      }));
      report(r, ok, ALL.length, new Set(), true);
      if (ok < ALL.length && !anyBad) showFb(r, "bad", "Everything you wrote is correct, but some words are missing. Find all ten words!");
    }, () => { s.v = {}; s.found = []; start = null; save(); cols.flat().forEach(f => { f.value = ""; setState(f, ""); }); paint(); });
  },

  selfcheck(r){
    const ex = r.ex, n = ex.items.length;
    let dir = "pl", deck = [], cur = null, known = 0, shown = false;
    const bar = el("div", { class: "roles" });
    const bPL = el("button", { class: "btn ghost small", type: "button" }, "Polish → English");
    const bEN = el("button", { class: "btn ghost small", type: "button" }, "English → Polish");
    bar.append(bPL, bEN);
    const prog = el("div", { class: "scprog" }, el("span"));
    const count = el("div", { class: "sccount" });
    const prompt = el("div", { class: "scq" });
    const ans = el("div", { class: "sca" });
    const card = el("div", { class: "sccard noselect" }, prompt, ans);
    const show = el("button", { class: "btn", type: "button" }, "Show");
    const yes = el("button", { class: "btn ok", type: "button" }, "✓ I knew it");
    const no = el("button", { class: "btn no", type: "button" }, "✗ Not yet");
    const again = el("button", { class: "btn ghost", type: "button" }, "Start again");
    const ctr = el("div", { class: "controls" }, show, yes, no, again);
    r.body.append(bar, prog, count, card, ctr);
    function start(d){
      dir = d; known = 0; deck = shuffle([...Array(n).keys()]);
      bPL.setAttribute("aria-pressed", d === "pl"); bEN.setAttribute("aria-pressed", d === "en");
      next();
    }
    function next(){
      shown = false;
      prog.firstChild.style.width = (known / n * 100) + "%";
      count.textContent = "I know: " + known + " / " + n + (deck.length ? "   ·   left: " + deck.length : "");
      if (!deck.length){
        cur = null; prompt.textContent = "🎉 Great! You remember all the words and phrases.";
        ans.textContent = ""; show.hidden = yes.hidden = no.hidden = true; again.hidden = false; return;
      }
      cur = deck.shift();
      const [en, pl] = ex.items[cur];
      prompt.textContent = dir === "pl" ? pl : en;
      ans.textContent = dir === "pl" ? en : pl;
      ans.classList.remove("on");
      show.hidden = false; yes.hidden = no.hidden = true; again.hidden = false;
    }
    function reveal(){ if (cur == null || shown) return; shown = true; ans.classList.add("on"); show.hidden = true; yes.hidden = no.hidden = false; }
    show.addEventListener("click", reveal);
    card.addEventListener("click", reveal);
    yes.addEventListener("click", () => { known++; next(); });
    no.addEventListener("click", () => { deck.splice(Math.min(3, deck.length), 0, cur); next(); });
    again.addEventListener("click", () => start(dir));
    bPL.addEventListener("click", () => start("pl"));
    bEN.addEventListener("click", () => start("en"));
    start("pl");
  },

  articles(r){
    r.body.classList.add("noselect");
    (r.ex.articles || []).forEach(a => {
      const art = el("article", { class: "art" });
      art.append(el("h3", null, a.flag ? el("img", { class: "flag", src: IMAGES[a.flag], alt: "" }) : null, a.title || ""));
      if (a.img) art.append(el("img", { class: "ph", src: IMAGES[a.img], alt: a.imgAlt || "", draggable: "false" }));
      art.append(el("div", { html: a.html || "" }));
      r.body.append(art);
    });
  },

  choose(r){
    const ex = r.ex, s = st(ex.id); s.v = s.v || {};
    if (ex.media) r.body.append(mediaBlock(ex.media));
    const letters = Object.keys(ex.options);
    r.body.append(el("ul", { class: "opts noselect" }, letters.map(L => el("li", null, el("b", null, L), " " + ex.options[L]))));
    const rows = [];
    const list = el("ol", { class: "choose noselect" });
    ex.items.forEach(([head, before, after], i) => {
      const slot = el("span", { class: "chosen" });
      const btns = letters.map(L => el("button", { type: "button", "aria-pressed": "false" }, L));
      const li = el("li", null, el("div", { class: "ch" }, head),
        el("p", null, before + " ", el("span", { class: "gapmark" }, String(i + 1)), " ", slot, after ? " " + after : ""),
        el("div", { class: "tfb" }, btns));
      const paint = () => {
        btns.forEach(b => b.setAttribute("aria-pressed", s.v[i] === b.textContent));
        slot.textContent = s.v[i] ? ex.options[s.v[i]] : "……";
        slot.classList.toggle("empty", !s.v[i]);
      };
      btns.forEach(b => b.addEventListener("click", () => { s.v[i] = b.textContent; save(); setState(li, ""); paint(); }));
      paint(); rows.push([li, paint]); list.append(li);
    });
    r.body.append(list);
    r.solvers = () => rows.map(([li, p], i) => () => { s.v[i] = ex.key[i]; save(); p(); setState(li, "ok"); });
    addControls(r, () => {
      let ok = 0;
      rows.forEach(([li], i) => { const g = s.v[i] === ex.key[i]; if (g) ok++; setState(li, g ? "ok" : "bad"); });
      report(r, ok, rows.length, new Set(), ok < rows.length);
    }, () => { s.v = {}; save(); rows.forEach(([li, p]) => { setState(li, ""); p(); }); });
  },

  textgaps(r){
    const ex = r.ex, s = st(ex.id); s.v = s.v || {};
    if (ex.media) r.body.append(mediaBlock(ex.media));
    if (ex.bank) r.body.append(el("div", { class: "bank noselect" }, ex.bank.map(b => el("span", null, b))));
    const box = el("div", { class: (ex.cls ? ex.cls : ex.notes != null ? "notes" : (ex.lines || ex.speakers) ? "dlgtext" + (ex.speakers ? " spk" : "") : "summarytext") + " noselect" }); const fields = [];
    if (ex.notes != null){ if (ex.notes) box.append(el("img", { src: IMAGES[ex.notes], alt: "", draggable: "false" })); box.append(el("div", { class: "nt" }, ex.title)); }
    let line = el("div"); box.append(line);
    ex.text.split(/(\{\d+\}|\n)/).forEach(part => {
      if (part === "\n"){ line = el("div"); box.append(line); return; }
      const m = part.match(/^\{(\d+)\}$/);
      if (!m){
        if (ex.speakers && !line.childNodes.length){
          const sp = part.match(/^([A-Z][a-z]+):\s?(.*)$/s);
          if (sp){ line.append(el("span", { class: "who" }, sp[1] + ":"), sp[2]); return; }
        }
        if (!ex.lines){ line.append(part); return; }
        part.split(/(\([a-z]+\)|^[XY]:)/).forEach(p => {
          if (/^\([a-z]+\)$/.test(p) || /^[XY]:$/.test(p)) line.append(el("b", null, p)); else if (p) line.append(p);
        });
        return;
      }
      const n = +m[1];
      const f = guard(el("input", { class: "gap", type: "text", "aria-label": "gap " + n }));
      f.style.width = (ex.widths && ex.widths[n]) || "11ch"; f.value = s.v[n] || "";
      f.addEventListener("input", () => { s.v[n] = f.value; save(); setState(f, ""); });
      fields.push([f, n]); line.append(el("sup", null, String(n)), f);
    });
    r.body.append(box);
    r.solvers = () => { const key = ex.answers || keyFromConfig(ex.keyFrom) || []; return fields.map(([f, n]) => () => fill(f, String(key[n - 1] || "").split("|").map(x => x.trim()))); };
    addControls(r, () => {
      const key = ex.answers || keyFromConfig(ex.keyFrom); if (!key){ noKey(r); return; }
      gradeFields(r, fields.map(([f, n]) => [f, String(key[n - 1]).split("|").map(x => x.trim())]));
    }, () => { s.v = {}; save(); fields.forEach(([f]) => { f.value = ""; setState(f, ""); }); });
  },

  open(r){
    const ex = r.ex, s = st(ex.id); s.v = s.v || {};
    if (ex.media) r.body.append(mediaBlock(ex.media));
    if (ex.textLink) r.body.append(el("p", { class: "hint" }, "You can find the text ", el("a", { class: "textlink", href: "#ex-" + ex.textLink }, "here"), "."));
    const ol = el("ol", { class: "items open" }); const fields = [];
    ex.items.forEach((q, i) => {
      const f = guard(el("input", { class: "gap", type: "text", "aria-label": "answer " + (i + 1) }));
      f.value = s.v[i] || "";
      f.addEventListener("input", () => { s.v[i] = f.value; save(); setState(f, ""); });
      fields.push(f);
      ol.append(el("li", null, el("div", { class: "q noselect" }, q), f));
    });
    r.body.append(ol);
    r.solvers = () => { const key = keyFromConfig(ex.keyFrom) || []; return fields.map((f, i) => () => fill(f, String(key[i] || "").split("|").map(x => x.trim()))); };
    addControls(r, () => {
      const key = keyFromConfig(ex.keyFrom); if (!key){ noKey(r); return; }
      gradeFields(r, fields.map((f, i) => [f, String(key[i]).split("|").map(x => x.trim())]));
    }, () => { s.v = {}; save(); fields.forEach(f => { f.value = ""; setState(f, ""); }); });
  },

  tf(r){
    const ex = r.ex, s = st(ex.id); s.v = s.v || {};
    if (ex.media) r.body.append(mediaBlock(ex.media));
    const ul = el("ul", { class: "tf noselect" }); const rows = [];
    ex.items.forEach((t, i) => {
      const bT = el("button", { type: "button", "aria-pressed": "false", "aria-label": "True" }, "T");
      const bF = el("button", { type: "button", "aria-pressed": "false", "aria-label": "False" }, "F");
      const li = el("li", null, el("span", { class: "n" }, (i + 1) + "."), el("span", { class: "t" }, t), el("span", { class: "tfb" }, bT, bF));
      const paint = () => { bT.setAttribute("aria-pressed", s.v[i] === "T"); bF.setAttribute("aria-pressed", s.v[i] === "F"); };
      [bT, bF].forEach(b => b.addEventListener("click", () => { s.v[i] = b.textContent; save(); setState(li, ""); paint(); }));
      paint(); rows.push(li); ul.append(li);
    });
    r.body.append(ul);
    r.solvers = () => { const key = keyFromConfig(ex.keyFrom) || []; return rows.map((li, i) => () => { const K = String(key[i] || "").trim().toUpperCase(); s.v[i] = K; save(); li.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.textContent === K)); setState(li, "ok"); }); };
    addControls(r, () => {
      const key = keyFromConfig(ex.keyFrom); if (!key){ noKey(r); return; }
      let ok = 0;
      rows.forEach((li, i) => { const g = s.v[i] === String(key[i]).trim().toUpperCase(); if (g) ok++; setState(li, g ? "ok" : "bad"); });
      report(r, ok, rows.length, new Set(), ok < rows.length);
    }, () => { s.v = {}; save(); rows.forEach(li => { setState(li, ""); li.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", "false")); }); });
  },

  phrases(r){
    const ex = r.ex;
    const ul = el("ul", { class: "phrases noselect" });
    ex.items.forEach(([en, pl]) => {
      const li = el("li", null, ex.speak ? sayBtn(en) : null, el("span", { class: "en" }, en), el("span", { class: "pl" }, pl));
      li.addEventListener("click", () => { if (ul.classList.contains("covered")) li.classList.toggle("peek"); });
      ul.append(li);
    });
    const btn = el("button", { class: "btn", type: "button" }, "Cover phrases");
    btn.addEventListener("click", () => {
      const c = ul.classList.toggle("covered");
      ul.querySelectorAll("li").forEach(li => li.classList.remove("peek"));
      btn.textContent = c ? "Show phrases" : "Cover phrases";
    });
    r.body.append(el("div", { class: "controls", style: "margin:0 0 12px" }, btn), ul);
  },

  build(r){
    const ex = r.ex, s = st(ex.id); s.v = s.v || {};
    const ol = el("ol", { class: "items build" }); const fields = [];
    ex.items.forEach(([chips, alts], i) => {
      const f = guard(el("input", { class: "gap", type: "text", "aria-label": "sentence " + (i + 1) }));
      f.value = s.v[i] || "";
      f.addEventListener("input", () => { s.v[i] = f.value; save(); setState(f, ""); });
      fields.push([f, alts]);
      ol.append(el("li", null, el("div", { class: "chips noselect" }, chips.map(c => el("span", null, c))), f));
    });
    r.body.append(ol);
    r.solvers = () => fields.map(([f, alts]) => () => fill(f, alts));
    addControls(r, () => gradeFields(r, fields), () => { s.v = {}; save(); fields.forEach(([f]) => { f.value = ""; setState(f, ""); }); });
  },

  order(r){
    const ex = r.ex, s = st(ex.id), n = ex.lines.length;
    const mix = () => { let o; do { o = shuffle([...Array(n).keys()]); } while (o.every((v, i) => v === i)); return o; };
    if (!Array.isArray(s.o) || s.o.length !== n) { s.o = mix(); save(); }
    const ul = el("ul", { class: "order noselect" });
    function build(){
      ul.innerHTML = "";
      s.o.forEach((li, pos) => {
        const [who, txt] = ex.lines[li];
        const up = el("button", { type: "button", "aria-label": "Move up" }, "↑");
        const dn = el("button", { type: "button", "aria-label": "Move down" }, "↓");
        up.addEventListener("click", () => move(pos, pos - 1));
        dn.addEventListener("click", () => move(pos, pos + 1));
        const item = el("li", { "data-i": li },
          el("span", { class: "handle", "aria-hidden": "true" }, "⋮⋮"),
          who ? el("span", { class: "who" }, who + ":") : null, el("span", { class: "txt" }, txt),
          el("span", { class: "arrows" }, up, dn));
        item.addEventListener("pointerdown", startDrag);
        ul.append(item);
      });
    }
    function move(a, b){ if (b < 0 || b >= n) return; const o = s.o; [o[a], o[b]] = [o[b], o[a]]; save(); build(); hideFb(r); }
    function startDrag(e){
      if (e.target.closest("button")) return;
      const isHandle = e.target.closest(".handle");
      if (e.pointerType === "mouse" ? e.button !== 0 : !isHandle) return;
      e.preventDefault();
      const item = e.currentTarget; let started = false; const y0 = e.clientY;
      const onMove = ev => {
        if (!started && Math.abs(ev.clientY - y0) < 4) return;
        started = true; item.classList.add("dragging");
        const others = [...ul.children].filter(c => c !== item);
        let before = null;
        for (const o of others){ const b = o.getBoundingClientRect(); if (ev.clientY < b.top + b.height / 2){ before = o; break; } }
        if (before) { if (item.nextSibling !== before) ul.insertBefore(item, before); }
        else if (ul.lastChild !== item) ul.append(item);
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); document.removeEventListener("pointercancel", onUp);
        item.classList.remove("dragging");
        if (started){ s.o = [...ul.children].map(c => +c.dataset.i); save(); build(); hideFb(r); }
      };
      document.addEventListener("pointermove", onMove); document.addEventListener("pointerup", onUp); document.addEventListener("pointercancel", onUp);
    }
    if (ex.photo) r.body.append(el("img", { class: "photo", src: IMAGES[ex.photo], alt: "Lost Property Office", draggable: "false" }));
    build(); r.body.append(ul);
    const mixBtn = el("button", { class: "btn ghost", type: "button", onclick: () => { s.o = mix(); save(); build(); hideFb(r); } }, "Mix again");
    r.solvers = () => ex.lines.map((_, k) => () => { const o = s.o, j = o.indexOf(k); [o[k], o[j]] = [o[j], o[k]]; save(); build(); [...ul.children].slice(0, k + 1).forEach(c => setState(c, "ok")); });
    addControls(r, () => {
      let ok = 0;
      [...ul.children].forEach((c, pos) => { const g = +c.dataset.i === pos; if (g) ok++; setState(c, g ? "ok" : "bad"); });
      report(r, ok, n, new Set(), ok < n);
    }, () => { s.o = mix(); save(); build(); }, mixBtn);
  },

  roleplay(r){
    const ex = r.ex; const src = EXERCISES.find(e => e.id === ex.from);
    const holder = el("div"); r.body.append(holder);
    const roles = [...new Set(src.lines.map(l => l[0]))];
    let hidden = null;
    function draw(){
      holder.innerHTML = "";
      if (!S.kw[src.id]){
        holder.append(el("div", { class: "lock" }, "🔒 First put the dialogue in order in exercise " + REG[src.id].num + "."));
        return;
      }
      const bar = el("div", { class: "roles" });
      const mk = (label, val) => { const b = el("button", { class: "btn ghost small", type: "button", "aria-pressed": String(hidden === val) }, label);
        b.addEventListener("click", () => { hidden = val; draw(); }); return b; };
      bar.append(mk("Show all", null), ...roles.map(ro => mk("Hide: " + ro, ro)));
      const ul = el("ul", { class: "dlg noselect" });
      src.lines.forEach(([who, txt]) => {
        const line = el("span", { class: "line" }, txt);
        const li = el("li", { class: who === hidden ? "hid" : "" }, el("span", { class: "who" }, who + ":"), line);
        line.addEventListener("click", () => { if (who === hidden) li.classList.toggle("hid"); });
        ul.append(li);
      });
      holder.append(bar, ul);
    }
    RENDERED_ROLEPLAY.push(draw); draw();
  },

  /* --- 📖 ćwiczenie tylko z książki (wersja nauczycielska): html (polecenie), img, key (odpowiedzi), transcript --- */
  book(r){
    const ex = r.ex;
    if (ex.img) r.body.append(el("img", { class: "photo noselect", src: IMAGES[ex.img] || ex.img, alt: "", draggable: "false" }));
    if (ex.html) r.body.append(el("div", { class: "htmlbox", html: ex.html }));
    if (ex.key) r.body.append(el("details", { class: "tt sub" }, el("summary", null, "🔑 Answer key"), el("div", { class: "ttbody", html: ex.key })));
    if (ex.transcript) r.body.append(el("details", { class: "tt sub" }, el("summary", null, "🎧 Transcript"), el("div", { class: "ttbody", html: ex.transcript })));
  },

  /* --- bez numeru: dowolny HTML (np. warm-up, exit ticket): html, media, img --- */
  html(r){
    const ex = r.ex;
    if (ex.media) r.body.append(mediaBlock(ex.media));
    if (ex.img) r.body.append(el("img", { class: "photo noselect", src: IMAGES[ex.img] || ex.img, alt: ex.imgAlt || "", draggable: "false" }));
    r.body.append(el("div", { class: "htmlbox", html: ex.html || "" }));
  },

  /* --- fiszki: decks: [{ name: "Words", cards: [{ pl, en, img, say, note }] }]
       from: "id" = te same talie co w innym zadaniu (np. w warm-upie)
       img: klucz z IMAGES albo emoji. Przód: obrazek + PL, tył: EN + 🔊 + note --- */
  flashcards(r){
    const src = r.ex.from ? (EXERCISES.find(e => e.id === r.ex.from) || r.ex) : r.ex;
    const decks = (src.decks || []).filter(d => d.cards && d.cards.length);
    if (!decks.length) return;
    let di = 0, dir = "pl", queue = [], cur = null, flipped = false, known = 0, review = new Set(), hist = [];
    const bar = el("div", { class: "roles fcbar" });
    const deckBtns = decks.length > 1 ? decks.map((d, i) => { const b = el("button", { class: "btn ghost small", type: "button" }, d.name + " (" + d.cards.length + ")"); b.addEventListener("click", () => { di = i; start(); }); return b; }) : [];
    const bPL = el("button", { class: "btn ghost small", type: "button" }, "Polski → English");
    const bEN = el("button", { class: "btn ghost small", type: "button" }, "English → Polski");
    bPL.addEventListener("click", () => { dir = "pl"; start(); });
    bEN.addEventListener("click", () => { dir = "en"; start(); });
    if (deckBtns.length) bar.append(...deckBtns, el("span", { class: "fcsep" }));
    bar.append(bPL, bEN);
    const prog = el("div", { class: "scprog" }, el("span"));
    const count = el("div", { class: "sccount" });
    const front = el("div", { class: "fcf" }), back = el("div", { class: "fcb" });
    const inner = el("div", { class: "fcin" }, front, back);
    const card = el("div", { class: "fccard noselect", tabindex: "0", role: "button", "aria-label": "Flip the card" }, inner);
    const flipB = el("button", { class: "btn", type: "button" }, "↻ Flip");
    const yes = el("button", { class: "btn ok", type: "button" }, TEACHER_MODE ? "👍 Most know it" : "✓ I knew it");
    const no = el("button", { class: "btn no", type: "button" }, TEACHER_MODE ? "👎 Most don't know it" : "✗ Not yet");
    const again = el("button", { class: "btn ghost", type: "button" }, "Start again");
    const onlyNo = el("button", { class: "btn ghost", type: "button" }, "Practise the “not yet” cards");
    const endBox = el("div", { class: "fcend" });
    const prevB = el("button", { class: "btn ghost", type: "button", title: "Previous card (←)" }, "← Back");
    const listB = TEACHER_MODE ? el("button", { class: "btn ghost", type: "button", "aria-pressed": "false" }, "☰ Show all cards") : null;
    const listBox = el("div", { class: "fclist" }); listBox.hidden = true;
    const keysHint = el("p", { class: "hint fckeys" }, TEACHER_MODE ? "Keys: Space = flip · → most know it · ↑ most don't know it · ← back" : "Keys: Space = flip · → I knew it · ↑ not yet · ← back");
    const ssB = el("button", { class: "btn ghost", type: "button" }, "▶ Slideshow");
    const ssSp = el("select", { class: "pasel fcspeed", "aria-label": "Slideshow speed" }, [["1500", "fast"], ["3000", "normal"], ["5000", "slow"]].map(([v, l]) => el("option", { value: v }, "speed: " + l)));
    ssSp.value = "3000";
    let ss = null;
    const ssStop = () => { clearInterval(ss); ss = null; ssB.textContent = "▶ Slideshow"; };
    const ssStep = () => { if (!document.body.contains(card)) return ssStop(); if (cur == null){ start(); return; } if (!flipped) flip(); else { queue.push(cur); next(); } };
    ssB.addEventListener("click", () => { if (ss){ ssStop(); return; } ssB.textContent = "⏸ Stop"; ssStep(); ss = setInterval(ssStep, +ssSp.value); });
    ssSp.addEventListener("change", () => { if (ss){ clearInterval(ss); ss = setInterval(ssStep, +ssSp.value); } });
    const wrapFc = el("div", { class: "fc" }, bar, prog, count, card, endBox, el("div", { class: "controls" }, prevB, flipB, yes, no, onlyNo, again, listB), el("div", { class: "controls fcss" }, ssB, ssSp), keysHint, listBox);
    r.body.append(wrapFc);
    function drawList(){
      listBox.innerHTML = "";
      listBox.append(el("div", { class: "fcgrid" }, D().map(c => el("div", { class: "fcitem" }, pic(c), el("div", { class: "fcpl" }, c.pl), el("div", { class: "fcen" }, sayBtn(c.say || c.en), " ", c.en), c.note ? el("div", { class: "fcnote", html: c.note }) : null))));
    }
    if (listB) listB.addEventListener("click", () => { const on = listBox.hidden; listBox.hidden = !on; listB.setAttribute("aria-pressed", on); if (on) drawList(); });
    const D = () => decks[di].cards;
    const pic = c => {
      if (!c.img) return null;
      if (IMAGES[c.img]) return el("img", { class: "fcimg", src: IMAGES[c.img], alt: "", draggable: "false" });
      return el("div", { class: "fcemoji", "aria-hidden": "true" }, c.img);
    };
    function face(box, parts){ box.innerHTML = ""; parts.filter(Boolean).forEach(p => box.append(p)); }
    function paintCard(c){
      const say = sayBtn(c.say || c.en);
      const enLine = el("div", { class: "fct" }, c.en);
      const plLine = el("div", { class: "fct pl" }, c.pl);
      const note = c.note ? el("div", { class: "fcnote", html: c.note }) : null;
      if (dir === "pl"){ face(front, [pic(c), plLine]); face(back, [enLine, el("div", null, say), note]); }
      else { face(front, [enLine, el("div", null, say)]); face(back, [pic(c), plLine, note]); }
    }
    function unflip(){ card.classList.add("noanim"); card.classList.remove("flip"); void card.offsetWidth; card.classList.remove("noanim"); flipped = false; }
    function start(list){
      bPL.setAttribute("aria-pressed", dir === "pl"); bEN.setAttribute("aria-pressed", dir === "en");
      deckBtns.forEach((b, i) => b.setAttribute("aria-pressed", i === di));
      queue = shuffle(list || [...D().keys()]); known = 0; review = new Set(); hist = []; r.fcTotal = queue.length;
      if (listB && !listBox.hidden) drawList();
      next();
    }
    function next(){
      unflip(); endBox.innerHTML = ""; endBox.hidden = true;
      const total = r.fcTotal;
      prog.firstChild.style.width = (known / total * 100) + "%";
      count.textContent = TEACHER_MODE ? "Cards left: " + queue.length : "I know: " + known + " / " + total + (queue.length ? "   ·   left: " + queue.length : "");
      if (!queue.length){
        cur = null; card.hidden = true; endBox.hidden = false;
        flipB.hidden = yes.hidden = no.hidden = true; again.hidden = false;
        onlyNo.hidden = TEACHER_MODE || !review.size;
        if (TEACHER_MODE){
          endBox.append(el("div", { class: "scq" }, "✅ Done!"));
          if (review.size) endBox.append(el("p", null, el("b", null, "Review next lesson: "), [...review].map(i => D()[i].en).join(", ")));
          else endBox.append(el("p", null, "Most of the class knew every card."));
        } else endBox.append(el("div", { class: "scq" }, review.size ? "👏 Good work! Practise the “not yet” cards once more." : "🎉 Great! You know all the cards."));
        return;
      }
      card.hidden = false; cur = queue.shift(); paintCard(D()[cur]);
      flipB.hidden = false; yes.hidden = no.hidden = true; again.hidden = false; onlyNo.hidden = true;
      prevB.hidden = !hist.length;
    }
    function flip(){
      if (cur == null) return;
      flipped = !flipped; card.classList.toggle("flip", flipped);
      if (flipped){ yes.hidden = no.hidden = false; }
    }
    card.addEventListener("click", ev => { if (ev.target.closest(".say")) return; flip(); });
    card.addEventListener("keydown", ev => {
      if (ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); flip(); }
      else if (ev.key === "ArrowRight"){ ev.preventDefault(); rateYes(); }
      else if (ev.key === "ArrowUp"){ ev.preventDefault(); rateNo(); }
      else if (ev.key === "ArrowLeft"){ ev.preventDefault(); goBack(); }
    });
    flipB.addEventListener("click", flip);
    const snap = () => hist.push({ queue: queue.slice(), cur, known, review: new Set(review), total: r.fcTotal });
    function goBack(){
      const h = hist.pop(); if (!h) return;
      queue = [h.cur].concat(h.queue); known = h.known; review = h.review; r.fcTotal = h.total;
      next();
    }
    function rateYes(){ if (cur == null) return; snap(); known++; next(); }
    function rateNo(){ if (cur == null) return; snap(); doNo(); }
    yes.addEventListener("click", rateYes);
    no.addEventListener("click", rateNo);
    prevB.addEventListener("click", goBack);
    function doNo(){
      review.add(cur);
      if (TEACHER_MODE){
        queue.splice(Math.floor(queue.length / 2), 0, cur);
        queue.push(cur);
        r.fcTotal = Math.max(r.fcTotal, known + queue.length);
      } else queue.splice(Math.min(3, queue.length), 0, cur);
      next();
    }
    /* klawiatura: działa dla fiszek, które są najbardziej widoczne na ekranie */
    KEY_BOXES.push({ box: wrapFc, key: k => {
      if (k === " ") { flip(); return true; }
      if (k === "ArrowRight") { rateYes(); return true; }
      if (k === "ArrowUp") { rateNo(); return true; }
      if (k === "ArrowLeft") { goBack(); return true; }
      return false;
    } });
    again.addEventListener("click", () => start());
    onlyNo.addEventListener("click", () => start([...review]));
    start();
  },

  /* --- 💬 pytania do rozmowy / small talk: items: [["Question?", "model answer"], …] lub ["Question?", …] --- */
  /* --- 💬 small talk w zwijanych częściach (items z { h: "nagłówek" }); losowanie pokazuje pytanie w okienku --- */
  talkSections(r){
    const ex = r.ex, parts = [];
    if (ex.tip) r.body.append(el("p", { class: "hint" }, "Ask the question first, then say the name. Don't go in order. Correct by drilling after the answer."));
    (ex.items || []).forEach(it => { if (it && it.h) parts.push({ h: it.h, qs: [] }); else if (parts.length) parts[parts.length - 1].qs.push([].concat(it)[0]); });
    const show = el("div", { class: "tshow", "aria-live": "polite" }, "🎲 Press “Random question”");
    const sel = el("select", { class: "pasel", "aria-label": "Questions from" }, el("option", { value: "-1" }, "All parts"), parts.map((p, i) => el("option", { value: i }, p.h)));
    const used = new Set(); let last = "";
    const pick = () => {
      const pool = (sel.value === "-1" ? parts : [parts[+sel.value]]).flatMap(p => p.qs);
      let left = pool.filter(q => !used.has(q)); if (!left.length){ pool.forEach(q => used.delete(q)); left = pool.filter(q => q !== last); }
      if (!left.length) return;
      last = left[Math.floor(Math.random() * left.length)]; used.add(last); show.innerHTML = last;
    };
    const bN = el("button", { class: "btn", type: "button" }, "🎲 Random question"); bN.addEventListener("click", pick);
    r.body.append(el("div", { class: "controls" }, sel, bN), show);
    parts.forEach(p => r.body.append(el("details", { class: "tt sub tpart" }, el("summary", null, p.h + " (" + p.qs.length + ")"), el("ul", { class: "tcompact" }, p.qs.map(q => el("li", { html: q }))))));
    KEY_BOXES.push({ box: r.sec, key: k => { if (k === "ArrowRight"){ pick(); return true; } return false; } });
  },

  talk(r){
    const ex = r.ex;
    if (ex.html) r.body.append(el("div", { class: "htmlbox", html: ex.html }));
    if ((ex.items || []).some(it => it && it.h)) return RENDER.talkSections(r);
    if (ex.tip) r.body.append(el("p", { class: "hint" }, "Ask the question first, then say the name. Don't go in order. Correct by drilling after the answer."));
    const ol = el("ol", { class: "talk" });
    let sec = "", lis = [];
    (ex.items || []).forEach(it => {
      if (it && it.h){ sec = it.h; ol.append(el("li", { class: "tsec" }, it.h)); return; }
      const [q, a] = [].concat(it);
      const li = el("li", null, el("span", { class: "tq", html: q }), a ? el("details", { class: "tt sub tans noselect" }, el("summary", null, "example answer"), el("div", { class: "ttbody", html: a })) : null);
      li.dataset.sec = sec; ol.append(li); lis.push(li);
    });
    const secs = [...new Set(lis.map(l => l.dataset.sec).filter(Boolean))];
    let only = "", asked = new Set(), cur = -1;
    const nextQ = () => {
      const ok = i => !only || lis[i].dataset.sec === only;
      let pool = [...lis.keys()].filter(i => ok(i) && !asked.has(i));
      if (!pool.length){ [...lis.keys()].filter(ok).forEach(i => { asked.delete(i); lis[i].classList.remove("asked"); }); pool = [...lis.keys()].filter(i => ok(i) && i !== cur); }
      if (!pool.length) return;
      cur = pool[Math.floor(Math.random() * pool.length)]; asked.add(cur);
      lis.forEach(l => l.classList.remove("cur")); lis[cur].classList.add("cur", "asked");
    };
    const ctr = el("div", { class: "controls" });
    if (secs.length > 1){
      const sel = el("select", { class: "pasel", "aria-label": "Questions from" }, el("option", { value: "" }, "All questions"), secs.map(x => el("option", { value: x }, x)));
      sel.addEventListener("change", () => { only = sel.value; ol.querySelectorAll("li").forEach(li => li.hidden = !!only && (li.classList.contains("tsec") ? li.textContent !== only : li.dataset.sec !== only)); });
      ctr.append(sel);
    }
    const bN = el("button", { class: "btn", type: "button" }, "🎲 Next question"); bN.addEventListener("click", nextQ);
    const bR = el("button", { class: "btn ghost", type: "button" }, "↺ Reset");
    bR.addEventListener("click", () => { asked.clear(); cur = -1; lis.forEach(l => l.classList.remove("asked", "cur")); });
    ctr.append(bN, bR);
    r.body.append(ol, ctr, el("p", { class: "hint fckeys" }, "Key: → next question (random, not in order)"));
    KEY_BOXES.push({ box: r.sec, key: k => { if (k === "ArrowRight"){ nextQ(); return true; } return false; } });
  },

  /* --- 🎮 odkrywanie krok po kroku: steps: ["clue 1", …], answer --- */
  reveal(r){
    const ex = r.ex; let n = 0, k = 0;
    if (ex.html) r.body.append(el("div", { class: "htmlbox", html: ex.html }));
    const rounds = ex.rounds ? shuffle(ex.rounds.slice()) : [{ steps: ex.steps || [], answer: ex.answer }];
    const list = el("ol", { class: "rv" }), ans = el("div", { class: "rva" });
    const cnt = el("span", { class: "score" }), rc = el("span", { class: "score" });
    let items = [];
    const load = () => {
      const R = rounds[k]; list.innerHTML = ""; n = 0;
      items = R.steps.map(st => { const d = el("li", { class: "rvs", html: st }); list.append(d); return d; });
      ans.innerHTML = R.answer ? "✅ " + R.answer : ""; rc.textContent = rounds.length > 1 ? "Round " + (k + 1) + " / " + rounds.length : ""; paint();
    };
    const paint = () => { items.forEach((d, i) => d.hidden = i >= n); ans.hidden = !ans.innerHTML || n <= items.length; cnt.textContent = "Clue " + Math.min(n, items.length) + " / " + items.length; };
    const nx = () => { if (n <= items.length){ n++; paint(); } };
    const bN = el("button", { class: "btn", type: "button" }, "▶ Next clue"); bN.addEventListener("click", nx);
    const bA = el("button", { class: "btn tsolve", type: "button" }, "👁 Answer"); bA.addEventListener("click", () => { n = items.length + 1; paint(); });
    const ctr = el("div", { class: "controls" }, bN, bA);
    if (rounds.length > 1){
      const bP = el("button", { class: "btn ghost", type: "button" }, "◀"); bP.addEventListener("click", () => { k = (k - 1 + rounds.length) % rounds.length; load(); });
      const bR = el("button", { class: "btn ghost", type: "button" }, "Next round ▶"); bR.addEventListener("click", () => { k = (k + 1) % rounds.length; load(); });
      ctr.append(bP, bR, rc);
    } else { const bR = el("button", { class: "btn ghost", type: "button" }, "↺ Reset"); bR.addEventListener("click", load); ctr.append(bR); }
    ctr.append(cnt);
    r.body.append(list, ans, ctr, el("p", { class: "hint fckeys" }, "Keys: → next clue · ← back"));
    load();
    KEY_BOXES.push({ box: r.sec, key: key => { if (key === "ArrowRight"){ nx(); return true; } if (key === "ArrowLeft"){ if (n > 0){ n--; paint(); } return true; } return false; } });
  },

  /* --- 🎮 obrazek na czas: img, seconds, question, answers (html) --- */
  timed(r){
    const ex = r.ex, secs = ex.seconds || 20;
    const img = el("img", { class: "tmimg noselect", src: IMAGES[ex.img] || ex.img || "", alt: "", draggable: "false" });
    const q = el("div", { class: "tmq" }, "📷 Press Start to see the picture.");
    const cover = el("div", { class: "tmcover" }, q);
    const clock = el("span", { class: "tmclock" });
    let t = null, left = secs;
    const stop = () => { clearInterval(t); t = null; };
    const start = () => {
      stop(); cover.hidden = true; left = secs; clock.textContent = "⏱ " + left + " s";
      t = setInterval(() => { left--; clock.textContent = "⏱ " + left + " s";
        if (left <= 0){ stop(); q.innerHTML = ex.question || "What can you remember?"; cover.hidden = false; clock.textContent = "⏰ Time!"; beep(); } }, 1000);
    };
    const bS = el("button", { class: "btn", type: "button" }, "▶ Start (" + secs + " s)"); bS.addEventListener("click", start);
    const bShow = el("button", { class: "btn tsolve", type: "button" }, "👁 Show picture"); bShow.addEventListener("click", () => { stop(); cover.hidden = true; clock.textContent = ""; });
    const bHide = el("button", { class: "btn ghost", type: "button" }, "🙈 Hide"); bHide.addEventListener("click", () => { stop(); q.innerHTML = ex.question || "What can you remember?"; cover.hidden = false; clock.textContent = ""; });
    r.body.append(el("div", { class: "tm" }, img, cover), el("div", { class: "controls" }, bS, bShow, bHide, clock));
    if (ex.answers) r.body.append(tt("✅ What's in the picture", "", el("div", { html: ex.answers })));
  },

  /* --- 🎮 odd one out: sets: [{ items: ["sofa", "bed", "lamp", "kitchen"], odd: 3, why: "…" }] --- */
  oddone(r){
    const sets = r.ex.sets || []; let k = 0;
    const stage = el("div", { class: "oo" }), cnt = el("span", { class: "score" });
    function draw(){
      stage.innerHTML = ""; const s = sets[k]; if (!s) return;
      const why = el("div", { class: "oowhy", html: "💡 " + (s.why || "") }); why.hidden = true;
      const row = el("div", { class: "oorow" }, s.items.map((it, i) => {
        const b = el("button", { type: "button", class: "ooi" }, IMAGES[it] ? el("img", { src: IMAGES[it], alt: "", draggable: "false" }) : it);
        b.addEventListener("click", () => { if (i === s.odd){ b.classList.add("ok"); why.hidden = false; } else { b.classList.add("bad"); setTimeout(() => b.classList.remove("bad"), 700); } });
        return b;
      }));
      row.reveal = () => { row.children[s.odd].classList.add("ok"); why.hidden = false; };
      stage.append(row, why); stage.row = row; cnt.textContent = (k + 1) + " / " + sets.length;
    }
    const go = d => { k = Math.max(0, Math.min(sets.length - 1, k + d)); draw(); };
    const bP = el("button", { class: "btn ghost", type: "button" }, "◀"); bP.addEventListener("click", () => go(-1));
    const bN = el("button", { class: "btn", type: "button" }, "Next ▶"); bN.addEventListener("click", () => go(1));
    const bA = el("button", { class: "btn tsolve", type: "button" }, "👁 Answer"); bA.addEventListener("click", () => stage.row && stage.row.reveal());
    r.body.append(stage, el("div", { class: "controls" }, bP, bN, bA, cnt));
    draw();
    KEY_BOXES.push({ box: r.sec, key: key => { if (key === "ArrowRight"){ go(1); return true; } if (key === "ArrowLeft"){ go(-1); return true; } return false; } });
  },

  /* --- 🎮 spot the difference: a, b (IMAGES), diffs: [[x%, y%, r%], …] --- */
  spotdiff(r){
    const ex = r.ex, diffs = ex.diffs || [], found = new Set();
    const cnt = el("span", { class: "score" });
    const mk = src => el("div", { class: "sdw noselect" }, el("img", { src: IMAGES[src] || src, alt: "", draggable: "false" }));
    const A = mk(ex.a), B = mk(ex.b);
    const paint = () => { cnt.textContent = "Found: " + found.size + " / " + diffs.length; };
    const mark = i => { if (found.has(i)) return; found.add(i); const [x, y, rr] = diffs[i];
      [A, B].forEach(w => w.append(el("span", { class: "sdc", style: "left:" + x + "%;top:" + y + "%;width:" + (rr * 2) + "%" }))); paint(); };
    [A, B].forEach(w => w.addEventListener("click", ev => {
      const b = w.getBoundingClientRect(), px = ev.clientX - b.left, py = ev.clientY - b.top;
      const hit = diffs.findIndex(([x, y, rr]) => Math.hypot(px - x / 100 * b.width, py - y / 100 * b.height) <= rr / 100 * b.width * 1.2);
      if (hit >= 0) mark(hit);
      else { const m = el("span", { class: "sdmiss", style: "left:" + (px / b.width * 100) + "%;top:" + (py / b.height * 100) + "%" }, "✗"); w.append(m); setTimeout(() => m.remove(), 600); }
    }));
    const bA = el("button", { class: "btn tsolve", type: "button" }, "👁 Show all"); bA.addEventListener("click", () => diffs.forEach((_, i) => mark(i)));
    const bR = el("button", { class: "btn ghost", type: "button" }, "↺ Reset"); bR.addEventListener("click", () => { found.clear(); [A, B].forEach(w => w.querySelectorAll(".sdc").forEach(c => c.remove())); paint(); });
    r.body.append(el("div", { class: "sd" }, A, B), el("div", { class: "controls" }, bA, bR, cnt));
    paint();
  },

  /* --- 🎮 find four: groups: [{ name: "Rooms", words: ["kitchen", …4] }, …] --- */
  findfour(r){
    const groups = r.ex.groups || [];
    const COLORS = ["#F9DF6D", "#A0C35A", "#B0C4EF", "#BA81C5"];
    let tiles, solved, sel, mistakes;
    const grid = el("div", { class: "ffg" }), done = el("div", { class: "ffdone" }), info = el("span", { class: "score" }), msg = el("span", { class: "copied" });
    const sub = el("button", { class: "btn", type: "button" }, "✓ Check");
    function reset(){ tiles = shuffle(groups.flatMap((g, gi) => g.words.map(w => ({ w, gi })))); solved = []; sel = []; mistakes = 0; draw(); }
    function draw(){
      done.innerHTML = "";
      solved.forEach(gi => done.append(el("div", { class: "ffrow", style: "background:" + COLORS[gi % 4] }, el("b", null, groups[gi].name), el("div", null, groups[gi].words.join(", ")))));
      grid.innerHTML = "";
      tiles.filter(t => !solved.includes(t.gi)).forEach(t => {
        const b = el("button", { type: "button", class: "fft" + (sel.includes(t) ? " sel" : "") }, t.w);
        b.addEventListener("click", () => { if (sel.includes(t)) sel = sel.filter(x => x !== t); else if (sel.length < 4) sel.push(t); msg.textContent = ""; draw(); });
        grid.append(b);
      });
      info.textContent = "Mistakes: " + mistakes; sub.disabled = sel.length !== 4;
    }
    sub.addEventListener("click", () => {
      if (sel.length !== 4) return;
      const gi = sel[0].gi;
      if (sel.every(t => t.gi === gi)){ solved.push(gi); sel = []; msg.textContent = solved.length === groups.length ? "🎉 All groups found!" : "✅ Group found!"; }
      else { mistakes++; const c = {}; sel.forEach(t => c[t.gi] = (c[t.gi] || 0) + 1); msg.textContent = Math.max(...Object.values(c)) === 3 ? "😮 One away!" : "✗ Not a group"; grid.classList.add("shake"); setTimeout(() => grid.classList.remove("shake"), 400); }
      draw();
    });
    const bS = el("button", { class: "btn ghost", type: "button" }, "🔀 Shuffle"); bS.addEventListener("click", () => { tiles = shuffle(tiles); draw(); });
    const bA = el("button", { class: "btn tsolve", type: "button" }, "👁 Reveal a group"); bA.addEventListener("click", () => { const gi = groups.findIndex((_, i) => !solved.includes(i)); if (gi >= 0){ solved.push(gi); sel = []; draw(); } });
    const bR = el("button", { class: "btn ghost", type: "button" }, "↺ Reset"); bR.addEventListener("click", reset);
    r.body.append(done, grid, el("div", { class: "controls" }, sub, bS, bA, bR, info, msg));
    reset();
  },

  /* --- 🎮 kółko i krzyżyk z fiszek: from: "fc", deck (opcjonalnie) --- */
  xo(r){
    const cards = shuffle(cardsOf(r.ex)); if (!cards.length) return;
    while (cards.length < 9) cards.push(...cards.slice(0, 9 - cards.length));
    let names = r.ex.teams || ["X", "O"];
    let own, turn, active, over;
    const grid = el("div", { class: "xog" }), status = el("div", { class: "xost" }), P = cardPrompt();
    const ok = el("button", { class: "btn ok", type: "button" }, "✓ Correct"), no = el("button", { class: "btn no", type: "button" }, "✗ Wrong");
    const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    function reset(){ names = FILTER_MODE === "1:1" ? ["Teacher", "Student"] : (r.ex.teams || ["X", "O"]); own = Array(9).fill(null); turn = 0; active = null; over = false; P.set(null); draw(); }
    window.addEventListener("teacher-filter", () => { names = FILTER_MODE === "1:1" ? ["Teacher", "Student"] : (r.ex.teams || ["X", "O"]); draw(); });
    function draw(){
      grid.innerHTML = "";
      own.forEach((o, i) => { const b = el("button", { type: "button", class: "xoc" + (o != null ? " t" + o : "") + (active === i ? " act" : "") }, o != null ? ["✕", "◯"][o] : String(i + 1));
        b.addEventListener("click", () => { if (over || own[i] != null) return; active = i; P.set(cards[i]); draw(); }); grid.append(b); });
      const win = LINES.find(l => own[l[0]] != null && l.every(i => own[i] === own[l[0]]));
      if (win){ over = true; status.textContent = "🏆 " + (FILTER_MODE === "1:1" ? "" : "Team ") + names[own[win[0]]] + " wins!"; }
      else if (own.every(o => o != null)){ over = true; status.textContent = "🤝 Draw!"; }
      else status.textContent = (FILTER_MODE === "1:1" ? "" : "Team ") + names[turn] + " – " + (active == null ? "choose a square" : "answer!");
      ok.hidden = no.hidden = active == null || over;
    }
    ok.addEventListener("click", () => { if (active == null) return; own[active] = turn; active = null; turn = 1 - turn; P.set(null); draw(); });
    no.addEventListener("click", () => { active = null; turn = 1 - turn; P.set(null); draw(); });
    const bR = el("button", { class: "btn ghost", type: "button" }, "↺ Reset"); bR.addEventListener("click", () => { shuffle(cards); reset(); });
    r.body.append(status, el("div", { class: "gwrap" }, grid, P.box), el("div", { class: "controls" }, ok, no, bR));
    reset();
  },

  /* --- 🎮 wyścig drużyn: from, teams: ["Team 1","Team 2"], steps: 10 --- */
  race(r){
    const ex = r.ex, steps = ex.steps || 10; let names = ex.teams || ["Team 1", "Team 2"];
    let pos, turn, dice, queue;
    const board = el("div", { class: "rcb" }), status = el("div", { class: "xost" }), P = cardPrompt();
    const roll = el("button", { class: "btn", type: "button" }, "🎲 Roll");
    const ok = el("button", { class: "btn ok", type: "button" }, "✓ Correct"), no = el("button", { class: "btn no", type: "button" }, "✗ Wrong");
    function reset(){ names = FILTER_MODE === "1:1" ? ["Teacher", "Student"] : (ex.teams || ["Team 1", "Team 2"]); pos = names.map(() => 0); turn = 0; dice = null; queue = []; P.set(null); draw(); }
    window.addEventListener("teacher-filter", reset);
    function draw(){
      board.innerHTML = "";
      names.forEach((n, ti) => board.append(el("div", { class: "rcrow" + (ti === turn ? " cur" : "") }, el("b", null, n),
        el("div", { class: "rctrack", style: "--n:" + (steps + 1) }, [...Array(steps + 1).keys()].map(i => el("span", { class: "rcs" + (i === pos[ti] ? " on t" + ti : "") + (i === steps ? " fin" : "") }, i === steps ? "🏁" : (i === pos[ti] ? "●" : "")))))));
      const w = pos.findIndex(p => p >= steps);
      status.textContent = w >= 0 ? "🏆 " + names[w] + " wins!" : names[turn] + (dice ? " rolled " + dice + " – answer!" : " – roll the dice");
      roll.hidden = w >= 0 || dice != null; ok.hidden = no.hidden = dice == null || w >= 0;
    }
    roll.addEventListener("click", () => { dice = 1 + Math.floor(Math.random() * 3); if (!queue.length) queue = shuffle(cardsOf(ex)); P.set(queue.shift()); draw(); });
    const end = good => { if (good) pos[turn] = Math.min(steps, pos[turn] + dice); dice = null; P.set(null); if (pos[turn] < steps) turn = (turn + 1) % names.length; draw(); };
    ok.addEventListener("click", () => end(true)); no.addEventListener("click", () => end(false));
    const bR = el("button", { class: "btn ghost", type: "button" }, "↺ Reset"); bR.addEventListener("click", reset);
    r.body.append(status, board, P.box, el("div", { class: "controls" }, roll, ok, no, bR));
    reset();
  },

  /* --- 🎮 piątka: categories: ["Rooms", "Furniture", …], seconds: 30, teams --- */
  five(r){
    const ex = r.ex, names = ex.teams || ["Team 1", "Team 2"], secs = ex.seconds || 30;
    let queue = [], score = names.map(() => 0), t = null, left = 0;
    const cat = el("div", { class: "fivecat" }, "—"), clock = el("span", { class: "tmclock" }), sb = el("div", { class: "fivesb" });
    const paint = () => { sb.innerHTML = ""; names.forEach((n, i) => { const b = el("button", { class: "btn ghost", type: "button" }, n + ": " + score[i] + "  ＋1"); b.addEventListener("click", () => { score[i]++; paint(); }); sb.append(b); }); };
    const next = () => { if (!queue.length) queue = shuffle(ex.categories || []); cat.textContent = queue.shift() || "—"; clearInterval(t); left = secs; clock.textContent = "⏱ " + left + " s";
      t = setInterval(() => { left--; clock.textContent = "⏱ " + left + " s"; if (left <= 0){ clearInterval(t); clock.textContent = "⏰ Time!"; beep(); } }, 1000); };
    const bN = el("button", { class: "btn", type: "button" }, "🎲 New category"); bN.addEventListener("click", next);
    const bR = el("button", { class: "btn ghost", type: "button" }, "↺ Reset scores"); bR.addEventListener("click", () => { score = names.map(() => 0); paint(); });
    r.body.append(el("p", { class: "hint" }, "Name 5 things in the category before the time runs out."), cat, el("div", { class: "controls" }, bN, clock), sb, el("div", { class: "controls" }, bR));
    paint();
  },

  /* --- 🎮 obrazek: view "blur" (3 etapy), "lens" (lupa), "flash" (ułamek sekundy)
       jeden obrazek: img, answer · wiele: from: "fc" (+ deck) – wszystkie obrazki z fiszek --- */
  picture(r){
    const ex = r.ex, mode = ex.view || "blur";
    const multi = !!(ex.from || ex.cards);
    const items = multi ? (ex.cards || cardsOf(ex)).filter(c => c.img && IMAGES[c.img]).map(c => ({ src: IMAGES[c.img], answer: c.en, say: c.say || c.en }))
                        : [{ src: IMAGES[ex.img] || ex.img || "", answer: ex.answer }];
    if (!items.length) return;
    const order = multi ? shuffle([...items.keys()]) : [0];
    let k = 0, reset = () => {};
    const img = el("img", { class: "pcimg", src: "", alt: "", draggable: "false" });
    const box = el("div", { class: "pc noselect pc-" + mode }, img);
    const ctr = el("div", { class: "controls" });
    const ans = el("div", { class: "rva" }); ans.hidden = true;
    const showAns = el("button", { class: "btn tsolve", type: "button" }, "👁 Answer");
    showAns.addEventListener("click", () => { const it = items[order[k]]; if (!it.answer) return; ans.innerHTML = ""; ans.append("✅ " + it.answer, " ", multi ? sayBtn(it.say) : ""); ans.hidden = false; });
    const cnt = el("span", { class: "score" });
    const go = d => { k = (k + d + order.length) % order.length; load(); };
    function load(){ img.src = items[order[k]].src; ans.hidden = true; cnt.textContent = multi ? (k + 1) + " / " + order.length : ""; reset(); }
    if (mode === "blur"){
      const LV = ex.levels || [18, 7, 0]; let st = 0;
      const info = el("span", { class: "score" });
      const paint = () => { img.style.filter = LV[st] ? "blur(" + LV[st] + "px)" : "none"; info.textContent = "Step " + (st + 1) + " / " + LV.length; };
      const nx = () => { if (st < LV.length - 1){ st++; paint(); } else if (multi) go(1); };
      reset = () => { st = 0; paint(); };
      box.addEventListener("click", nx);
      const bN = el("button", { class: "btn", type: "button" }, "🔍 Sharper"); bN.addEventListener("click", nx);
      ctr.append(bN, info);
      KEY_BOXES.push({ box: r.sec, key: key => { if (key === "ArrowRight"){ nx(); return true; } if (key === "ArrowLeft" && multi){ go(-1); return true; } return false; } });
    } else if (mode === "lens"){
      const cover = el("div", { class: "pclens" }); box.append(cover);
      const setPos = (x, y) => { cover.style.setProperty("--x", x + "%"); cover.style.setProperty("--y", y + "%"); };
      cover.style.setProperty("--r", (ex.lens || 14) + "%");
      reset = () => { cover.hidden = false; setPos(50, 50); };
      const move = ev => { const bb = box.getBoundingClientRect(); setPos((ev.clientX - bb.left) / bb.width * 100, (ev.clientY - bb.top) / bb.height * 100); };
      box.addEventListener("pointermove", move); box.addEventListener("pointerdown", move);
      const size = el("input", { type: "range", min: "6", max: "35", value: String(ex.lens || 14), "aria-label": "Lens size" });
      size.addEventListener("input", () => cover.style.setProperty("--r", size.value + "%"));
      const bA = el("button", { class: "btn ghost", type: "button" }, "🖼 Whole picture"); bA.addEventListener("click", () => cover.hidden = !cover.hidden);
      ctr.append(bA, el("label", { class: "hint", style: "margin:0;display:flex;align-items:center;gap:6px" }, "lens size", size));
    } else {
      const q = el("div", { class: "tmq" }, "👀 Watch carefully!");
      const cover = el("div", { class: "tmcover" }, q); box.append(cover);
      let ms = ex.ms || 300, t = null;
      reset = () => { clearTimeout(t); cover.hidden = false; q.innerHTML = "👀 Watch carefully!"; };
      const sp = el("select", { class: "pasel", style: "max-width:12ch", "aria-label": "Flash time" }, [200, 300, 500, 800, 1500].map(v => el("option", { value: v }, (v / 1000) + " s")));
      sp.value = String(ms); sp.addEventListener("change", () => ms = +sp.value);
      const bF = el("button", { class: "btn", type: "button" }, "⚡ Flash");
      bF.addEventListener("click", () => { clearTimeout(t); cover.hidden = true; t = setTimeout(() => { cover.hidden = false; q.innerHTML = ex.question || "What did you see?"; }, ms); });
      const bS = el("button", { class: "btn ghost", type: "button" }, "🖼 Show"); bS.addEventListener("click", () => { clearTimeout(t); cover.hidden = !cover.hidden; });
      ctr.append(sp, bF, bS);
    }
    if (items.some(it => it.answer)) ctr.append(showAns);
    if (multi){
      const bP = el("button", { class: "btn ghost", type: "button" }, "◀"); bP.addEventListener("click", () => go(-1));
      const bN2 = el("button", { class: "btn ghost", type: "button" }, "Next picture ▶"); bN2.addEventListener("click", () => go(1));
      ctr.append(bP, bN2, cnt);
    } else { const bR = el("button", { class: "btn ghost", type: "button" }, "↺ Reset"); bR.addEventListener("click", () => load()); ctr.append(bR); }
    r.body.append(box, ctr, ans);
    load();
  },

  /* --- 🪝 wszystkie hooki lekcji w jednej zwijanej karcie: items = lista hooków (każdy rozwijany osobno) --- */
  hookset(r){
    r.ex.items.forEach(h => {
      const body = el("div", { class: "ttbody" });
      const d = el("details", { class: "tt sub hkone" }, el("summary", null, "🪝 " + (h.title || "Hook") + (h.mode === "class" ? " · 👥 Class" : "")), body);
      r.body.append(d);
      RENDER.hook({ ex: h, sec: d, body });
    });
  },

  /* --- 🪝 hook do lekcji: quote/author, img (domena publiczna; blur: true = wyostrzanie) + credit + info, link + linkLabel, paste: true, questions --- */
  hook(r){
    const ex = r.ex;
    if (ex.quote) r.body.append(el("blockquote", { class: "hkq" }, el("p", { html: "“" + ex.quote + "”" }), ex.author ? el("cite", { html: "— " + ex.author }) : null));
    if (ex.img && ex.blur){
      RENDER.picture({ ex: { id: ex.id + "-pic", img: ex.img, view: "blur", answer: ex.answer }, sec: r.sec, body: r.body });
    } else if (ex.img) r.body.append(el("figure", { class: "hkf" }, el("img", { src: IMAGES[ex.img] || ex.img, alt: ex.imgAlt || "", draggable: "false" }), ex.credit ? el("figcaption", { html: ex.credit }) : null));
    if (ex.img && ex.blur && ex.credit && !ex.info) ex.info = "";
    if (ex.info != null) r.body.append(el("details", { class: "tt sub hkinfo" }, el("summary", null, "ℹ️ " + (ex.infoTitle || "About it")), el("div", { class: "ttbody", html: (ex.blur && ex.credit ? "<p class=\"hkcredit\">" + ex.credit + "</p>" : "") + (ex.info || "") })));
    if (ex.link) r.body.append(el("div", { class: "controls" }, el("a", { class: "btn", href: ex.link, target: "_blank", rel: "noopener" }, "🔗 " + (ex.linkLabel || "Open the picture"), " ↗")));
    /* video: zwinięty film YouTube (ładuje się dopiero po rozwinięciu) */
    if (ex.video){
      const id = (String(ex.video).match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/) || [])[1];
      const holder = el("div", { class: "media" });
      const d = el("details", { class: "tt sub" }, el("summary", null, "🎬 " + (ex.videoTitle || "Video")), el("div", { class: "ttbody" }, holder));
      d.addEventListener("toggle", () => { if (d.open && !holder.firstChild && id) holder.append(el("iframe", { class: "video", src: "https://www.youtube-nocookie.com/embed/" + id + "?rel=0", allow: "autoplay; fullscreen; encrypted-media; picture-in-picture", allowfullscreen: "", title: ex.videoTitle || "Video" }), el("a", { href: ex.video, target: "_blank", rel: "noopener" }, "Open it in a new tab ↗")); });
      r.body.append(d);
    }
    if (ex.paste){
      const drop = el("div", { class: "hubdrop", tabindex: "0" }, "📋 Paste a picture here (Ctrl/Cmd+V) or drop a file.");
      const show = f => { if (!f || !/^image\//.test(f.type)) return; const fr = new FileReader(); fr.onload = () => { drop.innerHTML = ""; drop.append(el("img", { src: fr.result, alt: "" })); }; fr.readAsDataURL(f); };
      drop.addEventListener("paste", e => { const it = [...((e.clipboardData || {}).items || [])].find(x => x.type.startsWith("image/")); if (it){ e.preventDefault(); show(it.getAsFile()); } });
      drop.addEventListener("dragover", e => e.preventDefault()); drop.addEventListener("drop", e => { e.preventDefault(); show(e.dataTransfer.files[0]); });
      r.body.append(drop);
    }
    if (ex.questions && ex.questions.length){
      let n = 0; const ol = el("ol", { class: "rv hkqs" });
      const items = ex.questions.map(q => { const li = el("li", { html: [].concat(q)[0] }); ol.append(li); return li; });
      const paint = () => { items.forEach((li, i) => li.hidden = i >= n); };
      const nx = () => { if (n < items.length){ n++; paint(); } };
      const bN = el("button", { class: "btn", type: "button" }, "💬 Next question"); bN.addEventListener("click", nx);
      const bA = el("button", { class: "btn ghost", type: "button" }, "Show all"); bA.addEventListener("click", () => { n = items.length; paint(); });
      r.body.append(ol, el("div", { class: "controls" }, bN, bA)); paint();
      if (!ex.blur) KEY_BOXES.push({ box: r.sec, key: k => { if (k === "ArrowRight"){ nx(); return true; } return false; } });
    }
  },

  /* ===================== TEACHER HUB ===================== */
  /* --- materiały do rozmowy (arkusz: Do rozmowy + Omówione) --- */
  talkmedia(r){
    const box = el("div");
    const icon = u => /youtu\.?be/.test(u) ? "▶️" : /tiktok/.test(u) ? "🎵" : /instagram/.test(u) ? "📷" : /\.(png|jpe?g|gif|webp)(\?|$)/i.test(u) ? "🖼" : "🔗";
    const fmt = d => d ? d.slice(8, 10) + "." + d.slice(5, 7) : "";
    let tag = "", only = true;
    function draw(){
      box.innerHTML = "";
      if (!DB.on){ box.append(el("p", { class: "fb show warn" }, "Connect the Google Sheet first (see the instructions). Then everything you add there appears here.")); return; }
      const cls = curClassName(), items = DB.get("Do rozmowy").filter(x => x.Link), done = DB.get("Omówione");
      const tags = [...new Set(items.flatMap(x => String(x.Tagi || "").split(",").map(t => t.trim()).filter(Boolean)))];
      const tSel = el("select", { class: "pasel", style: "max-width:20ch" }, el("option", { value: "" }, "All tags"), tags.map(t => el("option", { value: t }, t))); tSel.value = tag;
      tSel.addEventListener("change", () => { tag = tSel.value; draw(); });
      const onlyCb = el("input", { type: "checkbox" }); onlyCb.checked = only; onlyCb.addEventListener("change", () => { only = onlyCb.checked; draw(); });
      const discussedBy = u => done.filter(d => d.Link === u);
      let list = items.filter(x => !tag || String(x.Tagi || "").split(",").map(t => t.trim()).includes(tag));
      if (only && cls) list = list.filter(x => !discussedBy(x.Link).some(d => d.Klasa === cls));
      const rnd = el("button", { class: "btn", type: "button" }, "🎲 Random"); 
      rnd.addEventListener("click", () => { const c = box.querySelectorAll(".tmcard"); if (!c.length) return; c.forEach(x => x.classList.remove("pick")); const k = c[Math.floor(Math.random() * c.length)]; k.classList.add("pick"); k.scrollIntoView({ behavior: "smooth", block: "center" }); });
      box.append(el("p", { class: "hint" }, cls ? "Class: " + cls : "Choose a class in 🧰 Tools → Class list to mark what you discussed."),
        el("div", { class: "controls" }, tSel, el("label", { class: "hint", style: "margin:0;display:flex;gap:6px;align-items:center" }, onlyCb, "not discussed with this class yet"), rnd,
          btn2("🔄 Refresh", () => DB.refresh()), DB.sheetUrl ? el("a", { class: "btn ghost", href: DB.sheetUrl, target: "_blank", rel: "noopener" }, "✏️ Sheet") : null));
      const grid = el("div", { class: "tmgrid" });
      if (!list.length) grid.append(el("p", { class: "hint" }, "Nothing here. Add links in the sheet (tab „Do rozmowy”) or below."));
      list.forEach(x => {
        const by = discussedBy(x.Link), mine = by.find(d => d.Klasa === cls);
        const b = el("button", { type: "button", class: "mk" + (mine ? " on" : "") }, mine ? "✓ " + cls + ", " + fmt(mine.Data) : "✓ Discussed");
        if (!cls) b.disabled = true;
        b.addEventListener("click", () => { if (mine) DB.write("remove", "Omówione", { Klasa: cls, Link: x.Link }); else DB.write("append", "Omówione", null, { Klasa: cls, Link: x.Link, Data: TODAY_ISO }); });
        const qs = String(x.Pytania || "").split("|").map(q => q.trim()).filter(Boolean);
        grid.append(el("div", { class: "tmcard" },
          el("a", { class: "tmt", href: x.Link, target: "_blank", rel: "noopener" }, icon(x.Link) + " " + (x["Tytuł"] || x.Link), " ↗"),
          el("div", { class: "tln" }, [x.Tagi, x.Poziom].filter(Boolean).join(" · ")),
          qs.length ? el("details", { class: "tt sub" }, el("summary", null, "Questions (" + qs.length + ")"), el("div", { class: "ttbody" }, el("ol", null, qs.map(q => el("li", null, q))))) : null,
          by.filter(d => d.Klasa !== cls).length ? el("div", { class: "tln" }, "Also with: " + by.filter(d => d.Klasa !== cls).map(d => d.Klasa + " " + fmt(d.Data)).join(", ")) : null,
          el("div", { class: "controls" }, b)));
      });
      box.append(grid);
      const f = { link: el("input", { class: "gap", type: "url", placeholder: "link" }), title: el("input", { class: "gap", type: "text", placeholder: "title" }), tags: el("input", { class: "gap", type: "text", placeholder: "tags, comma separated" }),
        level: el("input", { class: "gap", type: "text", placeholder: "level (4-5 / 6-8 / all)" }), qs: el("input", { class: "gap", type: "text", placeholder: "questions separated by |" }) };
      const add = btn2("＋ Add", () => { if (!f.link.value.trim()) return; DB.write("append", "Do rozmowy", null, { Link: f.link.value.trim(), "Tytuł": f.title.value.trim(), Tagi: f.tags.value.trim(), Poziom: f.level.value.trim(), Pytania: f.qs.value.trim(), Dodano: TODAY_ISO }); });
      box.append(el("details", { class: "tt sub" }, el("summary", null, "＋ Add a video / meme / link"), el("div", { class: "ttbody addform" }, f.link, f.title, f.tags, f.level, f.qs, add)));
    }
    draw(); window.addEventListener("teacher-db", draw); window.addEventListener("teacher-class", draw);
    r.body.append(box);
  },
  /* --- moje linki (arkusz: Moje linki; bez arkusza: ex.defaults) --- */
  mylinks(r){
    const box = el("div");
    function rows(){
      const D = DB.on && DB.get("Moje linki").length ? DB.get("Moje linki") : (r.ex.defaults || []).map(([Kategoria, Nazwa, Link, Opis, Tryb, Ulubione]) => ({ Kategoria, Nazwa, Link, Opis, Tryb, Ulubione }));
      return D.filter(x => x.Link && !(FILTER_MODE === "1:1" && x.Tryb === "class") && !(FILTER_MODE === "class" && x.Tryb === "1:1"));
    }
    const tile = x => {
      const star = el("button", { type: "button", class: "star" + (x.Ulubione === "tak" ? " on" : ""), title: "Favourite" }, x.Ulubione === "tak" ? "★" : "☆");
      star.addEventListener("click", e => { e.preventDefault(); if (DB.on) DB.write("upsert", "Moje linki", { Link: x.Link }, { Ulubione: x.Ulubione === "tak" ? "" : "tak" }); });
      if (!DB.on) star.disabled = true;
      let host = ""; try { host = new URL(x.Link).hostname.replace(/^www\./, ""); } catch (e) {}
      return el("a", { class: "lnk", href: x.Link, target: "_blank", rel: "noopener" },
        el("img", { class: "fav", src: "https://icons.duckduckgo.com/ip3/" + host + ".ico", alt: "", loading: "lazy", referrerpolicy: "no-referrer" }),
        el("span", { class: "lnn" }, x.Nazwa || host), x.Opis ? el("span", { class: "lno" }, x.Opis) : null,
        x.Tryb === "class" ? el("span", { class: "tbadge" }, "👥") : x.Tryb === "1:1" ? el("span", { class: "tbadge" }, "👤") : null, star);
    };
    function draw(){
      box.innerHTML = ""; const R = rows();
      const fav = R.filter(x => x.Ulubione === "tak");
      if (fav.length) box.append(el("h3", { class: "lcat" }, "⭐ Favourites"), el("div", { class: "lgrid" }, fav.map(tile)));
      [...new Set(R.map(x => x.Kategoria || "Other"))].forEach(c => box.append(el("h3", { class: "lcat" }, c), el("div", { class: "lgrid" }, R.filter(x => (x.Kategoria || "Other") === c).map(tile))));
      const ctr = el("div", { class: "controls" });
      if (DB.on){
        ctr.append(btn2("🔄 Refresh", () => DB.refresh()), DB.sheetUrl ? el("a", { class: "btn ghost", href: DB.sheetUrl, target: "_blank", rel: "noopener" }, "✏️ Edit links in the sheet") : null);
        const f = { cat: el("input", { class: "gap", type: "text", placeholder: "category" }), name: el("input", { class: "gap", type: "text", placeholder: "name" }), link: el("input", { class: "gap", type: "url", placeholder: "link" }), desc: el("input", { class: "gap", type: "text", placeholder: "description" }) };
        const md = el("select", { class: "pasel", style: "max-width:12ch" }, [["both", "both"], ["class", "class"], ["1:1", "1:1"]].map(([v, l]) => el("option", { value: v }, l)));
        const add = btn2("＋ Add", () => { if (!f.link.value.trim()) return; DB.write("append", "Moje linki", null, { Kategoria: f.cat.value.trim() || "Other", Nazwa: f.name.value.trim(), Link: f.link.value.trim(), Opis: f.desc.value.trim(), Tryb: md.value, Ulubione: "" }); });
        box.append(ctr, el("details", { class: "tt sub" }, el("summary", null, "＋ Add a link"), el("div", { class: "ttbody addform" }, f.cat, f.name, f.link, f.desc, md, add)));
      } else box.append(el("p", { class: "hint" }, "After connecting the Google Sheet you can add links there (tab „Moje linki”)."));
    }
    draw(); window.addEventListener("teacher-db", draw); window.addEventListener("teacher-filter", draw);
    r.body.append(box);
  },

  /* --- przyciski otwierające narzędzia --- */
  toolbtns(r){
    const L = [["⏱ Timer", 0], ["📋 Class list", 1], ["🎯 Pick a student", 2], ["👥 Pairs & groups", 3], ["🗳 Vote", 4]];
    const bs = L.map(([t, i]) => { const b = el("button", { class: "btn hubbtn", type: "button" }, t); b.addEventListener("click", () => window.TEACHER_OPEN_TOOLS && window.TEACHER_OPEN_TOOLS(i)); b.dataset.i = i; return b; });
    r.body.append(el("div", { class: "hubbtns" }, bs));
    window.addEventListener("teacher-filter", () => bs.forEach(b => b.hidden = FILTER_MODE === "1:1" && (b.dataset.i === "2" || b.dataset.i === "3")));
  },

  /* --- własne słowa → fiszki / kółko i krzyżyk / wyścig --- */
  mywords(r){
    const ed = hubEditor(r, "words", "One per line:  English = Polski = emoji   (Polish and emoji are optional)", "sofa = sofa = 🛋️\nbed = łóżko = 🛏️\ndoor = drzwi = 🚪\nwindow = okno = 🪟");
    const g = el("select", { class: "pasel", style: "max-width:24ch" }, [["flashcards", "🃏 Flashcards"], ["xo", "⭕ Noughts and crosses"], ["race", "🏁 Team race"]].map(([v, l]) => el("option", { value: v }, l)));
    const stage = el("div", { class: "hubstage" });
    const play = el("button", { class: "btn", type: "button" }, "▶ Play");
    play.addEventListener("click", () => {
      const cards = ed.lines().map(l => { const [en, pl, img] = l.split("=").map(x => x.trim()); return { en, pl: pl || en, img: img || "" }; }).filter(c => c.en);
      if (!cards.length) return;
      stage.innerHTML = ""; const ex2 = { id: r.ex.id + "-" + Date.now(), type: g.value, decks: [{ name: "My words", cards }] };
      RENDER[g.value]({ ex: ex2, sec: r.sec, body: stage, shown: 0 });
    });
    r.body.append(ed.box, el("div", { class: "controls" }, g, play), stage);
  },
  /* --- własne Find four --- */
  myfour(r){
    const ed = hubEditor(r, "four", "4 lines:  Group name: word, word, word, word", "Rooms: kitchen, bedroom, bathroom, hall\nFurniture: sofa, bed, desk, chair\nPrepositions: in, on, under, next to\nColours: red, blue, green, pink");
    const stage = el("div", { class: "hubstage" }), play = el("button", { class: "btn", type: "button" }, "▶ Play");
    play.addEventListener("click", () => {
      const groups = ed.lines().map(l => { const [n, w] = l.split(":"); return { name: (n || "").trim(), words: (w || "").split(",").map(x => x.trim()).filter(Boolean) }; }).filter(x => x.words.length === 4);
      stage.innerHTML = ""; if (groups.length < 2){ stage.textContent = "Write at least 2 groups with exactly 4 words."; return; }
      RENDER.findfour({ ex: { id: r.ex.id, groups }, sec: r.sec, body: stage });
    });
    r.body.append(ed.box, el("div", { class: "controls" }, play), stage);
  },
  /* --- własne Odd one out --- */
  myodd(r){
    const ed = hubEditor(r, "odd", "One set per line, mark the odd one with *, reason after |", "sofa, bed, lamp, *kitchen | kitchen is a room\napple, *chair, banana, pear | a chair isn't food");
    const stage = el("div", { class: "hubstage" }), play = el("button", { class: "btn", type: "button" }, "▶ Play");
    play.addEventListener("click", () => {
      const sets = ed.lines().map(l => { const [a, why] = l.split("|"); const items = (a || "").split(",").map(x => x.trim()).filter(Boolean); const odd = items.findIndex(x => x.startsWith("*")); return { items: items.map(x => x.replace(/^\*/, "")), odd, why: (why || "").trim() }; }).filter(x => x.items.length > 1 && x.odd >= 0);
      stage.innerHTML = ""; if (!sets.length){ stage.textContent = "Mark the odd one with *."; return; }
      RENDER.oddone({ ex: { id: r.ex.id, sets }, sec: r.sec, body: stage });
    });
    r.body.append(ed.box, el("div", { class: "controls" }, play), stage);
  },
  /* --- własny obrazek: blur / lens / flash / timed --- */
  mypicture(r){
    let src = "";
    const prev = el("div", { class: "hubdrop", tabindex: "0" }, "📋 Paste a picture here (Ctrl/Cmd+V), drop a file, or choose one below.");
    const file = el("input", { type: "file", accept: "image/*" });
    const url = el("input", { class: "gap", type: "url", placeholder: "…or paste an image link (https://…)", style: "width:100%;max-width:520px" });
    const setSrc = v => { src = v; prev.innerHTML = ""; prev.append(el("img", { src: v, alt: "" })); };
    const readFile = f => { if (!f || !/^image\//.test(f.type)) return; const fr = new FileReader(); fr.onload = () => setSrc(fr.result); fr.readAsDataURL(f); };
    file.addEventListener("change", () => readFile(file.files[0]));
    url.addEventListener("change", () => url.value.trim() && setSrc(url.value.trim()));
    prev.addEventListener("paste", e => { const it = [...(e.clipboardData || {}).items || []].find(x => x.type.startsWith("image/")); if (it){ e.preventDefault(); readFile(it.getAsFile()); } });
    prev.addEventListener("dragover", e => e.preventDefault());
    prev.addEventListener("drop", e => { e.preventDefault(); readFile(e.dataTransfer.files[0]); });
    const view = el("select", { class: "pasel", style: "max-width:24ch" }, [["blur", "🔍 Blurry → sharp"], ["lens", "🔦 Magnifying glass"], ["flash", "⚡ Flash"], ["timed", "⏱ Memory picture"]].map(([v, l]) => el("option", { value: v }, l)));
    const stage = el("div", { class: "hubstage" }), play = el("button", { class: "btn", type: "button" }, "▶ Play");
    play.addEventListener("click", () => {
      stage.innerHTML = ""; if (!src){ stage.textContent = "Add a picture first."; return; }
      const v = view.value;
      if (v === "timed") RENDER.timed({ ex: { id: r.ex.id, img: src, seconds: 15 }, sec: r.sec, body: stage });
      else RENDER.picture({ ex: { id: r.ex.id, img: src, view: v }, sec: r.sec, body: stage });
    });
    r.body.append(prev, el("div", { class: "controls" }, file), url, el("div", { class: "controls" }, view, play), stage);
  },
  /* --- bank pytań small talk: bank: [{ t: "topic", l: "4-5" | "6-8" | "all", q: [...] }] --- */
  talkbank(r){
    const bank = r.ex.bank || [];
    const topics = [...new Set(bank.map(b => b.t))];
    const tSel = el("select", { class: "pasel", style: "max-width:26ch" }, el("option", { value: "" }, "All topics"), topics.map(t => el("option", { value: t }, t)));
    const lSel = el("select", { class: "pasel", style: "max-width:16ch" }, [["", "All grades"], ["4-5", "Grades 4–5"], ["6-8", "Grades 6–8"]].map(([v, l]) => el("option", { value: v }, l)));
    const cur = el("div", { class: "tbcur" }, "🎲 Click “Next question”");
    const list = el("ol", { class: "talk tbl" });
    let pool = [], asked = new Set();
    const filt = () => { pool = bank.filter(b => (!tSel.value || b.t === tSel.value) && (!lSel.value || b.l === lSel.value || b.l === "all")).flatMap(b => b.q.map(q => [q, b.t]));
      asked.clear(); list.innerHTML = ""; pool.forEach(([q, t]) => list.append(el("li", null, q, el("span", { class: "tln" }, " · " + t)))); };
    const nx = () => { if (!pool.length) return; let idx = [...pool.keys()].filter(i => !asked.has(i)); if (!idx.length){ asked.clear(); idx = [...pool.keys()]; }
      const i = idx[Math.floor(Math.random() * idx.length)]; asked.add(i); cur.textContent = pool[i][0];
      [...list.children].forEach((li, j) => { li.classList.toggle("cur", j === i); if (asked.has(j)) li.classList.add("asked"); }); };
    [tSel, lSel].forEach(x => x.addEventListener("change", filt));
    const bN = el("button", { class: "btn", type: "button" }, "🎲 Next question"); bN.addEventListener("click", nx);
    r.body.append(el("div", { class: "controls" }, tSel, lSel, bN), cur, el("details", { class: "tt sub" }, el("summary", null, "All questions"), el("div", { class: "ttbody" }, list)));
    filt();
    KEY_BOXES.push({ box: r.sec, key: k => { if (k === "ArrowRight"){ nx(); return true; } return false; } });
  },
  /* --- tablica wyników --- */
  score(r){
    let teams, pts;
    const board = el("div", { class: "scb" });
    const cnt = el("select", { class: "pasel", style: "max-width:12ch" }, [2, 3, 4].map(n => el("option", { value: n }, n + " teams")));
    const setup = () => { const n = FILTER_MODE === "1:1" ? 2 : +cnt.value; teams = FILTER_MODE === "1:1" ? ["Teacher", "Student"] : [...Array(n).keys()].map(i => "Team " + "ABCD"[i]); pts = teams.map(() => 0); draw(); };
    function draw(){
      board.innerHTML = "";
      teams.forEach((t, i) => {
        const nm = el("input", { class: "gap scn", type: "text", value: t }); nm.addEventListener("input", () => teams[i] = nm.value);
        const p = el("div", { class: "scp" }, String(pts[i]));
        const plus = el("button", { class: "btn", type: "button" }, "＋1"); plus.addEventListener("click", () => { pts[i]++; p.textContent = pts[i]; });
        const minus = el("button", { class: "btn ghost", type: "button" }, "−1"); minus.addEventListener("click", () => { pts[i] = Math.max(0, pts[i] - 1); p.textContent = pts[i]; });
        board.append(el("div", { class: "scc" }, nm, p, el("div", { class: "controls" }, plus, minus)));
      });
    }
    cnt.addEventListener("change", setup);
    const reset = el("button", { class: "btn ghost", type: "button" }, "↺ Reset"); reset.addEventListener("click", () => { pts = teams.map(() => 0); draw(); });
    r.body.append(el("div", { class: "controls" }, cnt, reset), board);
    setup(); window.addEventListener("teacher-filter", setup);
  },
  /* --- kostka --- */
  dice(r){
    const out = el("div", { class: "dice" }, "🎲");
    const roll = n => { let k = 0; const t = setInterval(() => { out.textContent = String(1 + Math.floor(Math.random() * n)); if (++k > 9){ clearInterval(t); out.classList.remove("rolling"); } }, 60); out.classList.add("rolling"); };
    r.body.append(out, el("div", { class: "controls" }, [6, 3].map(n => { const b = el("button", { class: "btn", type: "button" }, "🎲 1–" + n); b.addEventListener("click", () => roll(n)); return b; })));
  },
  /* --- koło losujące --- */
  wheel(r){
    const ed = hubEditor(r, "wheel", "Options, one per line", "Who starts?\nTeam A\nTeam B");
    const cv = el("canvas", { class: "wheel", width: "360", height: "360" });
    const res = el("div", { class: "tbcur" }, "");
    let ang = 0, spinning = false;
    const COLS = ["#2D5B8A", "#F2C94C", "#B4472F", "#2F8550", "#7C8FA5", "#E5A93B", "#5B97E8", "#BA81C5"];
    const opts = () => ed.lines().filter(Boolean).slice(0, 24);
    function draw(){
      const o = opts(), c = cv.getContext("2d"), R = 175, n = Math.max(o.length, 1); c.clearRect(0, 0, 360, 360);
      o.forEach((t, i) => { const a0 = ang + i * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n;
        c.beginPath(); c.moveTo(180, 180); c.arc(180, 180, R, a0, a1); c.fillStyle = COLS[i % COLS.length]; c.fill();
        c.save(); c.translate(180, 180); c.rotate((a0 + a1) / 2); c.fillStyle = (i % COLS.length) === 1 || (i % COLS.length) === 5 ? "#1D2A3A" : "#fff"; c.font = "bold 15px Nunito, sans-serif"; c.textAlign = "right"; c.fillText(t.slice(0, 18), R - 10, 5); c.restore(); });
      c.beginPath(); c.moveTo(352, 180); c.lineTo(372, 168); c.lineTo(372, 192); c.fillStyle = "#1D2A3A"; c.fill();
    }
    const spin = () => { const o = opts(); if (spinning || !o.length) return; spinning = true; res.textContent = "";
      const start = ang, total = 4 * Math.PI + Math.random() * 2 * Math.PI, t0 = performance.now(), dur = 3200;
      const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); ang = start + total * e; draw();
        if (k < 1) requestAnimationFrame(step); else { spinning = false; const n = o.length, a = ((2 * Math.PI - (ang % (2 * Math.PI))) % (2 * Math.PI)); res.textContent = "🎯 " + o[Math.floor(a / (2 * Math.PI / n)) % n]; } };
      requestAnimationFrame(step); };
    cv.addEventListener("click", spin);
    const b = el("button", { class: "btn", type: "button" }, "🎡 Spin"); b.addEventListener("click", spin);
    ed.onChange = draw;
    r.body.append(ed.box, el("div", { class: "wheelw" }, cv), el("div", { class: "controls" }, b), res);
    draw();
  },
  /* --- spis stron lekcji: list: [{ series, unit, lesson, title, student, teacher }] --- */
  lessons(r){
    const by = {};
    (r.ex.list || []).forEach(x => { (by[x.series] = by[x.series] || []).push(x); });
    const box = el("div");
    Object.keys(by).forEach(sr => {
      const rows = by[sr].sort((a, b) => a.unit - b.unit || a.lesson - b.lesson).map(x => el("tr", null, el("td", null, "U" + x.unit + " L" + x.lesson), el("td", null, x.title),
        el("td", null, x.student ? el("a", { href: x.student, target: "_blank", rel: "noopener" }, "👧 student ↗") : "—"),
        el("td", null, x.teacher ? el("a", { href: x.teacher, target: "_blank", rel: "noopener" }, "🧑‍🏫 teacher ↗") : "—")));
      box.append(el("details", { class: "tt sub", open: "" }, el("summary", null, sr + " (" + by[sr].length + ")"), el("div", { class: "ttbody" }, el("table", { class: "lc lsn" }, rows))));
    });
    r.body.append(box);
  },

  /* --- kod QR do strony uczniowskiej (PAGE.studentLink) --- */
  qr(r){
    const url = PAGE.studentLink || "";
    const holder = el("div", { class: "qrbox" }, "…");
    const link = el("a", { href: url, target: "_blank", rel: "noopener", class: "qrlink" }, "Open the homework page ↗");
    const big = el("button", { class: "btn ghost", type: "button" }, "⤢ Full screen");
    r.body.append(el("p", { class: "hint" }, "Students scan the code to open their homework page (the password is already in the link)."), holder, el("div", { class: "controls" }, big, link));
    const draw = (box, cell) => {
      const go = () => { try { const q = qrcode(0, "M"); q.addData(url); q.make(); box.innerHTML = q.createSvgTag({ cellSize: cell, margin: 2, scalable: true }); } catch (e) { box.textContent = "QR code could not be created."; } };
      if (typeof qrcode !== "undefined") go();
      else { const sc = document.createElement("script"); sc.src = ENGINE_BASE + "qr.js"; sc.onload = go; sc.onerror = () => box.textContent = "QR code could not be loaded."; document.head.append(sc); }
    };
    draw(holder, 6);
    big.addEventListener("click", () => {
      const box = el("div", { class: "qrbig" });
      const ov = el("div", { class: "tpanel qrov" }, el("div", { class: "tpin" }, el("h2", null, "📱 Scan to open your homework"), box, el("button", { class: "btn", type: "button", onclick: () => ov.remove() }, "Close")));
      ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });
      document.body.append(ov); draw(box, 12);
    });
  },

  write(r){
    const ex = r.ex, s = st(ex.id);
    const ta = guard(el("textarea", { "aria-label": "Your text", placeholder: "Hi …!\n\nI live in a … . Downstairs, there's …" }));
    ta.value = s.t || "";
    const cnt = el("div", { class: "count" });
    const upd = () => { const w = (ta.value.trim().match(/\S+/g) || []).length; cnt.textContent = "Words: " + w; };
    ta.addEventListener("input", () => { s.t = ta.value; save(); upd(); });
    upd(); r.body.append(ta, cnt);
  }
};
const RENDERED_ROLEPLAY = [];
const KEY_BOXES = [];
document.addEventListener("keydown", e => {
  if (!KEY_BOXES.length || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest("input,textarea,select,button,[contenteditable],.fccard")) return;
  if (![" ", "ArrowRight", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
  if (document.querySelector(".tpanel:not([hidden])")) return;
  const vh = window.innerHeight; let best = null, bestV = 0;
  KEY_BOXES.forEach(f => { const b = f.box.getBoundingClientRect(); const v = Math.min(b.bottom, vh) - Math.max(b.top, 0); if (v > bestV){ bestV = v; best = f; } });
  if (best && bestV > 120 && best.key(e.key)) e.preventDefault();
});

function gradeFields(r, fields){
  let ok = 0, anyBad = false; const issues = new Set();
  fields.forEach(([f, alts]) => {
    const g = grade(f.value, alts); setState(f, g.state);
    if (g.state === "ok") ok++;
    else if (g.state === "form") g.issues.forEach(i => issues.add(i));
    else anyBad = true;
  });
  report(r, ok, fields.length, issues, anyBad);
}

/* ===================== NAWIGACJA I PODSUMOWANIE ===================== */
let navEl = null;
function updateNav(){
  if (!navEl) return;
  navEl.querySelectorAll("a[data-id]").forEach(a => a.classList.toggle("done", !!S.kw[a.dataset.id]));
}
let sumBox;
function renderSummary(){
  if (!sumBox) return;
  const withKw = Object.values(REG).filter(r => r.ex.kw);
  const written = Object.values(REG).filter(r => r.buildText);
  const got = withKw.filter(r => S.kw[r.ex.id]).length;
  sumBox.innerHTML = "";
  sumBox.append(el("h2", null, "Your keywords"), el("p", null, "Collected: " + got + " / " + withKw.length));
  const ul = el("ul");
  withKw.forEach(r => ul.append(el("li", null,
    el("span", null, "Exercise " + r.num + ": " + r.ex.title),
    S.kw[r.ex.id] ? el("span", { class: "got" }, dk(r.ex.kw)) : el("span", { class: "miss" }, "missing"))));
  written.forEach(r => ul.append(el("li", null,
    el("span", null, "Exercise " + r.num + ": " + r.ex.title + " (checked by teacher)"),
    r.isComplete() ? el("span", { class: "got" }, "✓ written") : el("span", { class: "miss" }, r.isStarted() ? "not finished" : "missing"))));
  const msg = el("span", { class: "copied", role: "status" });
  const copy = el("button", { class: "btn", type: "button" }, "Copy list");
  copy.addEventListener("click", () => {
    let txt = LESSON + " – keywords (" + got + "/" + withKw.length + ")\n" +
      withKw.map(r => "Exercise " + r.num + " (" + r.ex.title + "): " + (S.kw[r.ex.id] ? dk(r.ex.kw) : "—")).join("\n");
    written.forEach(r => { txt += "\n\n" + (r.isStarted() ? r.buildText() : "Exercise " + r.num + " (" + r.ex.title + "): —"); });
    copyText(txt).then(() => { msg.textContent = "Copied!"; setTimeout(() => msg.textContent = "", 2500); });
  });
  const reset = el("button", { class: "btn ghost", type: "button" }, "Start again");
  reset.addEventListener("click", () => {
    if (!confirm("Delete all your answers and keywords?")) return;
    try { localStorage.removeItem(SKEY); } catch (e) {}
    location.reload();
  });
  sumBox.append(ul);
  if (written.length) sumBox.append(el("p", { class: "sumnote" }, "“Copy list” copies your keywords and your written texts – paste everything into your answer sheet."));
  sumBox.append(el("div", { class: "controls" }, copy, reset, msg));
}
function copyText(t){
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).catch(() => fallback());
  return Promise.resolve(fallback());
  function fallback(){
    const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.append(ta); ta.select();
    const h = e => { e.stopImmediatePropagation(); }; document.addEventListener("copy", h, true);
    try { document.execCommand("copy"); } catch (e) {}
    document.removeEventListener("copy", h, true); ta.remove();
  }
}

/* ===================== STRONA ===================== */
const LEGAL_PL = '<b>Nota prawna.</b> Niniejsza strona stanowi pomoc dydaktyczną przygotowaną wyłącznie na potrzeby prowadzonych zajęć z języka angielskiego i jest przeznaczona do niekomercyjnego użytku przez uczniów w ramach procesu nauczania. Zamieszczone fragmenty tekstów, ilustracje, nagrania oraz odesłania do materiałów audiowizualnych pochodzą z podręczników i materiałów wykorzystywanych na zajęciach i zostały użyte w ograniczonym zakresie, wyłącznie w celach dydaktycznych i ilustracyjnych, w granicach dozwolonego użytku przewidzianego w ustawie z dnia 4 lutego 1994 r. o prawie autorskim i prawach pokrewnych. Wszelkie prawa autorskie i pokrewne do tych materiałów przysługują ich właścicielom. Strona nie jest powiązana z wydawcami ani przez nich autoryzowana. Dalsze rozpowszechnianie, kopiowanie lub wykorzystywanie jej zawartości, w tym w celach komercyjnych, bez zgody uprawnionych jest niedozwolone. Strona nie gromadzi danych osobowych; postępy ucznia są zapisywane wyłącznie lokalnie w przeglądarce. Jeżeli uważasz, że zamieszczony materiał narusza Twoje prawa, skontaktuj się z nauczycielem prowadzącym, a materiał zostanie niezwłocznie usunięty.';
const LEGAL_EN = '<b>Legal notice.</b> This page is a teaching aid prepared solely for English lessons and is intended for non-commercial use by students as part of the learning process. Any text excerpts, illustrations, recordings and links to audiovisual materials included herein originate from coursebooks and materials used in class and are reproduced to a limited extent, exclusively for educational and illustrative purposes, within the scope of permitted use under the Polish Act of 4 February 1994 on Copyright and Related Rights. All copyright and related rights in such materials remain with their respective owners. This page is not affiliated with, endorsed by or authorised by the publishers. Any further distribution, copying or use of its content, including for commercial purposes, without the consent of the rights holders is not permitted. This page does not collect personal data; student progress is stored only locally in the browser. If you believe that any material published here infringes your rights, please contact the teacher, and the material will be removed without delay.';
const PLAIN_TYPES = ["reading", "comic", "note", "video", "html", "flashcards", "talk", "reveal", "timed", "oddone", "spotdiff", "findfour", "xo", "race", "five", "qr", "picture", "toolbtns", "mywords", "myfour", "myodd", "mypicture", "talkbank", "score", "dice", "wheel", "lessons", "talkmedia", "mylinks", "hook"];

(function init(){
  const B = document.body;
  if (TEACHER_MODE) B.classList.add("teacher");
  const header = el("header", { class: "topbar" }, el("nav", { id: "nav", "aria-label": "Exercises" }));
  const hero = el("div", { class: "hero" });
  hero.innerHTML = PAGE.hero || '<svg viewBox="0 0 120 110" aria-hidden="true"><circle cx="60" cy="55" r="40" fill="#F2C94C"/></svg>';
  const sub = PAGE.hub ? (PAGE.description || "") : TEACHER_MODE
    ? "🧑‍🏫 Teacher version" + (PAGE.unit ? " · Unit " + PAGE.unit + (PAGE.lesson ? ", Lesson " + PAGE.lesson : "") : "")
    : (PAGE.description || "") + " You get a keyword for every exercise you finish with no mistakes.";
  hero.append(el("div", null, el("h1", null, LESSON), el("p", null, sub)));
  const main = el("main", { id: "main" });
  const footer = el("footer", null,
    el("p", null, TEACHER_MODE ? "Teacher version – answers are not saved." : "Your progress is saved in this browser."),
    el("div", { class: "legal", lang: "pl", html: LEGAL_PL }), el("div", { class: "legal", lang: "en", html: LEGAL_EN }));
  B.prepend(header, hero, main, footer);
  navEl = document.getElementById("nav");
  if (TEACHER_MODE){
    if (!PAGE.hub) main.append(el("div", { class: "tcard" }, lessonCard(), materialsBox()));
    B.append(teacherTools());
  }
  let num = 0, curG = null;
  EXERCISES.forEach(ex => {
    if (ex.group){
      const g = el("h2", { class: "group" + (ex.coll ? " gcoll" : "") }, ex.group); if (ex.desc) g.dataset.desc = ex.desc; main.append(g);
      if (ex.coll){
        curG = { h: g, secs: [], open: !!ex.open }; const G = curG; if (ex.open) g.classList.add("open");
        g.setAttribute("role", "button"); g.tabIndex = 0;
        G.toggle = open => { const o = open != null ? open : !g.classList.contains("open"); g.classList.toggle("open", o); G.secs.forEach(x => x.classList.toggle("ghide", !o)); };
        g.addEventListener("click", () => G.toggle()); g.addEventListener("keydown", e => { if (e.key === "Enter") G.toggle(); });
      } else curG = null;
      return;
    }
    /* nauczyciel: numer z książki (page: "SB p. 25, ex. 4" → 4); bez numeru w książce (Quick check, Useful!, gry) = bez numeru */
    let r, label = "";
    if (TEACHER_MODE){ const m = String(ex.page || "").match(/ex\.\s*(\d+)/); label = m ? m[1] : ""; }
    else { const plain = ex.plain || PLAIN_TYPES.includes(ex.type); if (!plain){ num++; label = String(num); } }
    r = makeCard(ex, label);
    main.append(r.sec);
    if (curG){ curG.secs.push(r.sec); if (!curG.open) r.sec.classList.add("ghide"); r.sec._g = curG; }
    if (ex.type === "video") return;
    if (ex.type === "note"){ r.sec.querySelector(".ex-head").remove(); navEl.append(el("a", { href: "#ex-" + ex.id }, ex.title || "Info")); return; }
    navEl.append(el("a", { href: "#ex-" + ex.id, "data-id": ex.id }, ex.type === "reading" ? "Text: " + ex.title : label ? label + ". " + ex.title : ex.title));
  });
  const setNavH = () => { const tb = document.querySelector(".topbar"); if (tb) document.documentElement.style.setProperty("--navh", tb.offsetHeight + "px"); };
  setNavH(); addEventListener("resize", setNavH);
  Object.values(REG).forEach(r => { RENDER[r.ex.type](r); if (TEACHER_MODE){ if (r.sec._left) r.body.querySelectorAll(":scope > .media").forEach(m => { if (m.querySelector("iframe.audio, audio")) r.sec._left.append(m); }); if (r.sec._mr){ r.body.querySelectorAll(":scope > .media").forEach(m => { if (m.querySelector("iframe.audio, audio")) r.sec._mr.append(m); }); r.sec.querySelector(".metarow").classList.toggle("solo", !r.sec._mr.children.length); } bankDnD(r.sec); gameReset(r); } });
  if (PAGE.hub) hubDashboard(main, header);
  navEl.addEventListener("click", e => {
    const a = e.target.closest("a[href^='#ex-']"); if (!a) return;
    const sec = document.getElementById(a.getAttribute("href").slice(1)); if (!sec) return;
    if (sec._g) sec._g.toggle(true);
    sec.classList.add("open");
  });
  if (!TEACHER_MODE){
    sumBox = el("section", { class: "summary", id: "summary" });
    main.append(sumBox);
    navEl.append(el("a", { href: "#summary", class: "sum" }, "Your keywords"));
  }
  renderSummary(); updateNav();
})();
})();
