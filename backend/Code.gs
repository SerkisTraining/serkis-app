/**
 * SERKIS COACH — backend su Google Apps Script
 *
 * Cosa fa: legge gli atleti da Notion, schede e test da Google Sheets/Drive,
 * scrive le modifiche nelle schede e le note nel foglio "SERKIS APP — Note".
 * Gira con il tuo account Google: i dati non passano da altri server.
 *
 * Installazione (una volta):
 *  1. Incolla qui sotto il token dell'integrazione Notion (NOTION_TOKEN).
 *  2. Seleziona la funzione "setup" in alto e premi Esegui. Autorizza.
 *     Nel registro trovi la CHIAVE dell'app.
 *  3. Distribuisci → Nuova distribuzione → tipo "App web"
 *     Esegui come: Me · Chi ha accesso: Chiunque → Distribuisci.
 *     Copia l'URL che finisce con /exec.
 *  4. Apri l'app e incolla URL e chiave (oppure esegui "codiceCollegamento").
 *
 * Dopo una modifica a questo file: Distribuisci → Gestisci distribuzioni →
 * matita → Versione: Nuova versione → Distribuisci (l'URL resta lo stesso).
 */
const CONFIG = {
  NOTION_TOKEN: "INCOLLA_QUI_IL_TOKEN_NOTION",
  NOTES_ID: "1jzW0uELNty_8Dx0AWhwJXzg7YObm6Nr_fYbNlP0Z3mo",
  COACH_DS: "264112d7-0f3d-80c1-9340-000bfe370a29",
  COACH_DB: "264112d70f3d80d385d6c18d5efe1b56",
  VF_DS: "800b8a16-6f27-4a04-984f-3f9e2ce7f640",
  VF_DB: "d2f147fd8bc840c3ac5b78e509ef365f"
};
const VERSION = "1.6";
// Indirizzo della pagina cliente (il link che mandi agli atleti finisce con #t=CODICE)
const CLIENT_PAGE = "https://serkistraining.github.io/serkis-app/c/";

/* ---------- installazione ---------- */
function setup() {
  const p = PropertiesService.getScriptProperties();
  let key = p.getProperty("APP_KEY");
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "").slice(0, 8);
    p.setProperty("APP_KEY", key);
  }
  const sh = notesSheet_();
  sh.getRange("A:H").setNumberFormat("@");
  if (sh.getRange("A1").getDisplayValue() !== "id") {
    sh.getRange(1, 1, 1, 8).setValues([["id", "createdAt", "athleteId", "athleteName", "kind", "week", "signal", "text"]]);
  }
  let notion;
  try {
    const c = queryNotion_(CONFIG.COACH_DS, CONFIG.COACH_DB);
    let v = "non collegato";
    try { v = queryNotion_(CONFIG.VF_DS, CONFIG.VF_DB).length + " atleti"; } catch (e) { v = "ERRORE: " + e.message; }
    notion = "OK · Coaching: " + c.length + " atleti · Valutazione funzionale: " + v;
  } catch (e) { notion = "ERRORE: " + e.message; }
  DriveApp.getRootFolder();
  Logger.log("CHIAVE APP: " + key);
  Logger.log("Notion: " + notion);
  Logger.log("Foglio note: OK");
  Logger.log("Ora: Distribuisci → Nuova distribuzione → App web (Esegui come: Me · Chi ha accesso: Chiunque).");
}

function codiceCollegamento() {
  const key = PropertiesService.getScriptProperties().getProperty("APP_KEY");
  const url = ScriptApp.getService().getUrl();
  Logger.log("Indirizzo: " + url + (/\/exec$/.test(url || "") ? "" : "  ← se non finisce con /exec usa l'URL della distribuzione"));
  Logger.log("Codice: SERKIS1." + Utilities.base64EncodeWebSafe(JSON.stringify({ u: url, k: key })).replace(/=+$/, ""));
}

// Controllo rapido dall'editor: Esegui → verifica. Non mostra la chiave.
function verifica() {
  const t0 = Date.now();
  const list = athletes_({ fresh: true }).athletes;
  Logger.log("Backend " + VERSION + " · atleti: " + list.length + " · con scheda: " + list.filter(function (a) { return a.sheetId; }).length + " · " + (Date.now() - t0) + " ms");
  list.filter(function (a) { return (a.sheetLinks || []).length > 1; }).forEach(function (a) {
    let fogli = "";
    try { const ss = SpreadsheetApp.openById(a.sheetId); fogli = ss.getName() + " → " + ss.getSheets().map(function (s) { return s.getName(); }).join(", "); } catch (e) { fogli = "file non leggibile"; }
    Logger.log(a.name + ": " + a.sheetLinks.length + " link · scheda attuale: " + fogli + (a.sheetGid ? " · foglio " + a.sheetGid : ""));
  });
}

/* ---------- ingresso web ---------- */
function doGet() {
  return ContentService.createTextOutput("Serkis Coach backend " + VERSION + " attivo.");
}

function doPost(e) {
  let req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || "{}"); }
  catch (err) { return out_({ error: "Richiesta non valida" }); }
  // Pagina cliente: niente chiave app, solo il codice personale dell'atleta
  if (CLIENT_ACTIONS[req.action]) {
    try { return out_(CLIENT_ACTIONS[req.action](req)); }
    catch (err) { return out_({ error: String((err && err.message) || err) }); }
  }
  const key = PropertiesService.getScriptProperties().getProperty("APP_KEY");
  if (!key || req.key !== key) return out_({ error: "Chiave non valida", code: "auth" });
  const fn = ACTIONS[req.action];
  if (!fn) return out_({ error: "Azione sconosciuta: " + req.action });
  try { return out_(fn(req)); }
  catch (err) { return out_({ error: String((err && err.message) || err) }); }
}

const ACTIONS = {
  ping: function () { return { ok: true, version: VERSION }; },
  athletes: athletes_,
  sheets: sheets_,
  files: files_,
  bundle: bundle_,
  page: page_,
  update: update_,
  templates: templates_,
  create: create_,
  notes: notes_,
  noteAdd: noteAdd_,
  noteDel: noteDel_,
  clients: clients_,
  clientLink: clientLink_,
  clientSet: clientSet_,
  clientPin: clientPin_,
  fbLog: fbLog_,
  notionSchema: notionSchema_,
  athleteNew: athleteNew_
};

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Notion ---------- */
// Il token resta salvato nelle proprietà dello script: incollando una versione nuova del codice non va rimesso.
function notionToken_() {
  const p = PropertiesService.getScriptProperties();
  const t = CONFIG.NOTION_TOKEN;
  if (t && !/^INCOLLA/.test(t)) { if (p.getProperty("NOTION_TOKEN") !== t) p.setProperty("NOTION_TOKEN", t); return t; }
  return p.getProperty("NOTION_TOKEN") || t;
}

function notion_(path, method, body, version) {
  const opt = {
    method: method || "get",
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + notionToken_(), "Notion-Version": version || "2022-06-28" }
  };
  if (body) { opt.contentType = "application/json"; opt.payload = JSON.stringify(body); }
  const r = UrlFetchApp.fetch("https://api.notion.com" + path, opt);
  let j = null;
  try { j = JSON.parse(r.getContentText()); } catch (e) {}
  return { code: r.getResponseCode(), json: j };
}

function notionErr_(r) {
  const msg = (r.json && r.json.message) || "errore";
  const hint = (r.code === 401) ? " (token Notion errato)" :
    (r.code === 404 || r.code === 403) ? " (collega l'integrazione ai database in Notion: ••• → Connessioni)" : "";
  return new Error("Notion " + r.code + ": " + msg + hint);
}

function queryNotion_(ds, db) {
  let res = [], cursor = null, mode = "ds";
  for (let g = 0; g < 20; g++) {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    let r = mode === "ds"
      ? notion_("/v1/data_sources/" + ds + "/query", "post", body, "2025-09-03")
      : notion_("/v1/databases/" + db + "/query", "post", body, "2022-06-28");
    if (r.code !== 200 && mode === "ds" && !cursor) {
      mode = "db";
      r = notion_("/v1/databases/" + db + "/query", "post", body, "2022-06-28");
    }
    if (r.code !== 200) throw notionErr_(r);
    res = res.concat(r.json.results || []);
    if (!r.json.has_more) break;
    cursor = r.json.next_cursor;
  }
  return res;
}

function pt_(p) {
  if (!p) return "";
  switch (p.type) {
    case "title": return (p.title || []).map(function (t) { return t.plain_text; }).join("");
    case "rich_text": return (p.rich_text || []).map(function (t) { return t.plain_text; }).join("");
    case "select": return p.select ? p.select.name : "";
    case "status": return p.status ? p.status.name : "";
    case "multi_select": return (p.multi_select || []).map(function (o) { return o.name; }).join(", ");
    case "url": return p.url || "";
    case "date": return p.date ? p.date.start : "";
    case "number": return p.number == null ? "" : String(p.number);
    case "files": return (p.files || []).map(function (f) { return f.type === "external" ? f.external.url : (f.file ? f.file.url : ""); }).join(" ");
    case "formula": {
      const f = p.formula || {};
      if (f.type === "date") return f.date ? f.date.start : "";
      return f[f.type] == null ? "" : String(f[f.type]);
    }
    default: return "";
  }
}

function sid_(s) {
  const m = String(s || "").match(/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
  return m ? m[1] : null;
}

// Tutti i link a Google Sheets di una proprietà, con l'eventuale foglio (gid)
function links_(s) {
  const out = [], re = /spreadsheets\/d\/([A-Za-z0-9_-]{20,})([^\s"]*)/g;
  let m;
  while ((m = re.exec(String(s || "")))) {
    const g = (m[2].match(/[#&?]gid=(\d+)/) || [])[1] || null;
    const ex = out.filter(function (x) { return x.id === m[1]; })[0];
    if (ex) { if (g) ex.gid = g; } else out.push({ id: m[1], gid: g });
  }
  return out;
}

// Con più link, la scheda attuale è il file creato per ultimo
function pickCurrent_(links) {
  if (links.length <= 1) return links[0] || null;
  const cache = CacheService.getScriptCache();
  let best = null, bt = -1;
  links.forEach(function (l) {
    let t = Number(cache.get("cr:" + l.id) || 0);
    if (!t) {
      try { t = DriveApp.getFileById(l.id).getDateCreated().getTime(); cache.put("cr:" + l.id, String(t), 21600); } catch (e) { t = 0; }
    }
    if (t > bt) { bt = t; best = l; }
  });
  return best || links[links.length - 1];
}

function athletes_(req) {
  const cache = CacheService.getScriptCache();
  if (!req.fresh) { const hit = cache.get("athletes"); if (hit) return { athletes: JSON.parse(hit) }; }
  const coach = queryNotion_(CONFIG.COACH_DS, CONFIG.COACH_DB).filter(function (pg) { return !pg.in_trash && !pg.archived; }).map(function (pg) {
    const P = pg.properties || {};
    return {
      src: "coach", id: pg.id.replace(/-/g, ""), name: pt_(P["Nome Cognome"]).trim() || "Senza nome",
      tag: pt_(P["Multi-select"]), status: pt_(P["Status programma"]) || "—",
      start: pt_(P["Data inizio"]) || null, dur: parseInt(pt_(P["Durata scheda"]), 10) || null,
      subStart: pt_(P["Inizio abbonamento"]) || null,
      sheetLinks: links_(pt_(P["Training Program"])),
      notionUrl: pg.url, analisiUrl: pt_(P["Analisi allenamento"]) || null
    };
  });
  let vf = [];
  try {
    vf = queryNotion_(CONFIG.VF_DS, CONFIG.VF_DB).filter(function (pg) { return !pg.in_trash && !pg.archived; }).map(function (pg) {
      const P = pg.properties || {};
      return {
        src: "vf", id: pg.id.replace(/-/g, ""), name: pt_(P["Nome Cognome"]).trim() || "Senza nome", tag: "Kineva",
        status: pt_(P["Stato"]) || "—", start: pt_(P["Inizio programma"]) || null, dur: null,
        firstEval: pt_(P["Data prima valutazione"]) || null, sheetLinks: links_(pt_(P["Scheda"])),
        valId: sid_(pt_(P["Valutazione"])), notionUrl: pg.url, videoUrl: pt_(P["Cartella video Drive"]) || null
      };
    });
  } catch (e) { /* database Kineva non collegato all'integrazione */ }
  const all = coach.concat(vf);
  all.forEach(function (a) { const cur = pickCurrent_(a.sheetLinks || []); a.sheetId = cur ? cur.id : null; a.sheetGid = cur ? cur.gid : null; });
  try { cache.put("athletes", JSON.stringify(all), 120); } catch (e) {}
  return { athletes: all };
}

function page_(req) {
  const lines = [];
  blocks_(req.id, 0, lines);
  return { text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}

function blocks_(id, depth, lines) {
  let cursor = null;
  for (let g = 0; g < 5; g++) {
    const r = notion_("/v1/blocks/" + id + "/children?page_size=100" + (cursor ? "&start_cursor=" + cursor : ""), "get");
    if (r.code !== 200) { if (depth === 0) throw notionErr_(r); return; }
    (r.json.results || []).forEach(function (b) {
      const t = b.type, d = b[t] || {};
      const txt = (d.rich_text || []).map(function (x) { return x.plain_text; }).join("");
      const ind = new Array(depth + 1).join("  ");
      if (/^heading_/.test(t)) lines.push("", "## " + txt);
      else if (t === "bulleted_list_item" || t === "numbered_list_item" || t === "to_do") lines.push(ind + "• " + txt);
      else if (t === "paragraph" || t === "quote" || t === "callout" || t === "toggle") lines.push(ind + txt);
      else if (t === "child_page") lines.push(ind + "↳ " + (d.title || ""));
      else if (t === "divider") lines.push("");
      if (b.has_children && depth < 2 && t !== "child_page" && t !== "child_database") blocks_(b.id, depth + 1, lines);
    });
    if (!r.json.has_more) break;
    cursor = r.json.next_cursor;
  }
}

function notionLink_(req, url) {
  const pid = req.athleteId, props = {};
  if (req.src === "coach" && req.kind === "scheda") {
    const pg = notion_("/v1/pages/" + pid, "get");
    if (pg.code !== 200) throw notionErr_(pg);
    const cur = ((pg.json.properties || {})["Training Program"] || {}).files || [];
    if (cur.some(function (f) { return f.type !== "external"; })) return { error: "Training Program contiene file caricati in Notion: aggiorna il link a mano." };
    const files = [{ name: String(req.title).slice(0, 100), type: "external", external: { url: url } }]
      .concat(cur.map(function (f) { return { name: f.name, type: "external", external: { url: f.external.url } }; }));
    props["Training Program"] = { files: files.slice(0, 25) };
    props["Data inizio"] = { date: { start: req.startDate } };
    const map = { 4: "4 sett", 5: "5 set", 6: "6 set", 8: "8 set" };
    if (map[req.weeks]) props["Durata scheda"] = { select: { name: map[req.weeks] } };
  } else if (req.src === "vf" && req.kind === "scheda") {
    props["Scheda"] = { url: url };
    props["Inizio programma"] = { date: { start: req.startDate } };
  } else if (req.src === "vf" && req.kind === "vf") {
    props["Valutazione"] = { url: url };
  } else {
    return { skipped: true };
  }
  const r = notion_("/v1/pages/" + pid, "patch", { properties: props });
  if (r.code !== 200) throw notionErr_(r);
  CacheService.getScriptCache().remove("athletes");
  return { ok: true };
}

/* ---------- Sheets e Drive ---------- */
function trim_(v) {
  return v.map(function (r) { let n = r.length; while (n > 0 && r[n - 1] === "") n--; return r.slice(0, n); });
}

function readSheet_(id, tab, maxRows, maxCols, gid) {
  const ss = SpreadsheetApp.openById(id);
  const all = ss.getSheets();
  const byGid = gid != null && gid !== "" ? all.filter(function (s) { return String(s.getSheetId()) === String(gid); })[0] : null;
  const sh = (tab && ss.getSheetByName(tab)) || byGid || all[0];
  const lr = Math.min(sh.getLastRow(), maxRows || 220), lc = Math.min(sh.getLastColumn(), maxCols || 12);
  const values = (lr > 0 && lc > 0) ? trim_(sh.getRange(1, 1, lr, lc).getDisplayValues()) : [];
  return { id: id, title: ss.getName(), tab: sh.getName(), tabs: all.map(function (s) { return s.getName(); }),
    gids: all.map(function (s) { return String(s.getSheetId()); }), values: values, url: ss.getUrl() };
}

function sheets_(req) {
  const out = {}, cache = CacheService.getScriptCache();
  const gids = req.gids || {};
  (req.ids || []).slice(0, 10).forEach(function (id) {
    const gid = req.tab ? null : (gids[id] || null);
    const ck = "sh:" + id + ":" + (req.tab || "") + ":" + (gid || "");
    if (!req.fresh) { const hit = cache.get(ck); if (hit) { out[id] = JSON.parse(hit); return; } }
    try {
      const r = readSheet_(id, req.tab, null, null, gid);
      out[id] = r;
      try { cache.put(ck, JSON.stringify(r), 600); } catch (e) {}
    } catch (e) { out[id] = { error: "Non riesco ad aprire il file: " + e.message }; }
  });
  return { sheets: out };
}

// File su Drive per cognome, più i file collegati in Notion (anche con soprannomi nel titolo)
function files_(req) {
  const parts = String(req.name || "").trim().split(/\s+/), sur = parts[parts.length - 1] || "";
  const out = [], seen = {};
  const push = function (f, linked) {
    if (seen[f.getId()]) return; seen[f.getId()] = 1;
    out.push({ id: f.getId(), title: f.getName(), url: f.getUrl(), updated: f.getLastUpdated().toISOString(), created: f.getDateCreated().toISOString(), linked: !!linked });
  };
  (req.ids || []).slice(0, 6).forEach(function (id) {
    try { const f = DriveApp.getFileById(id); if (!f.isTrashed() && f.getMimeType() === MimeType.GOOGLE_SHEETS) push(f, true); } catch (e) {}
  });
  if (sur.length >= 2) {
    const it = DriveApp.searchFiles('title contains "' + sur.replace(/"/g, "") + '" and mimeType = "application/vnd.google-apps.spreadsheet" and trashed = false');
    while (it.hasNext() && out.length < 46) push(it.next(), false);
  }
  return { files: out };
}

function bundle_(req) {
  const out = [], maxT = Math.min(Number(req.maxTabs) || 12, 12), maxR = Math.min(Number(req.maxRows) || 150, 220), maxC = req.maxRows ? 12 : 10;
  (req.ids || []).slice(0, 5).forEach(function (id) {
    try {
      const ss = SpreadsheetApp.openById(id), f = DriveApp.getFileById(id);
      const tabs = ss.getSheets().slice(0, maxT).map(function (sh) {
        const lr = Math.min(sh.getLastRow(), maxR), lc = Math.min(sh.getLastColumn(), maxC);
        return { name: sh.getName(), gid: String(sh.getSheetId()), values: (lr > 0 && lc > 0) ? trim_(sh.getRange(1, 1, lr, lc).getDisplayValues()) : [] };
      });
      out.push({ id: id, title: ss.getName(), url: ss.getUrl(), updated: f.getLastUpdated().toISOString(), created: f.getDateCreated().toISOString(), tabs: tabs });
    } catch (e) { out.push({ id: id, error: e.message }); }
  });
  return { files: out };
}

function clean_(s) { return String(s == null ? "" : s).replace(/\r/g, "").trim(); }
function safe_(v) {
  v = String(v == null ? "" : v);
  if (/^[=+\-@]/.test(v) || (v.trim() && /^[\d\s.,:\/\-]+$/.test(v.trim()))) return "'" + v;
  return v;
}

function update_(req) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.openById(req.sheetId);
    const sh = (req.tab && ss.getSheetByName(req.tab)) || ss.getSheets()[0];
    const cells = req.cells || [], conflict = [];
    cells.forEach(function (c) {
      const cur = sh.getRange(c.r, c.c + 1).getDisplayValue();
      if (clean_(cur) !== clean_(c.old)) conflict.push({ r: c.r, c: c.c, cur: cur });
    });
    if (conflict.length) return { conflict: conflict };
    cells.forEach(function (c) { sh.getRange(c.r, c.c + 1).setValue(safe_(c.value)); });
    SpreadsheetApp.flush();
    const k = "sh:" + req.sheetId + ":", gidS = String(sh.getSheetId());
    CacheService.getScriptCache().removeAll([k + ":", k + ":" + gidS, k + (req.tab || "") + ":", k + sh.getName() + ":"]);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function tplKind_(t) {
  if (/ANTEPRIMA|BOZZA|ARCHIVIO|EDITORIAL/i.test(t)) return null;
  if (/TEST TEMPLATE.*ONLINE/i.test(t)) return "test-online";
  if (/TEST TEMPLATE.*PRESENZA/i.test(t)) return "test-presenza";
  if (/VALUTAZIONE/i.test(t)) return "vf";
  if (/TRAINING TEMPLATE/i.test(t)) return "scheda";
  return null;
}

function templates_() {
  const it = DriveApp.searchFiles('title contains "template" and mimeType = "application/vnd.google-apps.spreadsheet" and trashed = false');
  const out = [];
  while (it.hasNext() && out.length < 40) {
    const f = it.next(), k = tplKind_(f.getName());
    if (k) out.push({ id: f.getId(), title: f.getName(), kind: k });
  }
  return { templates: out };
}

function itDate_(s) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return Utilities.formatDate(new Date(), "Europe/Rome", "dd/MM/yyyy");
  return m[3] + "/" + m[2] + "/" + m[1];
}

function addDaysIso_(s, n) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  d.setDate(d.getDate() + n);
  return Utilities.formatDate(d, "Europe/Rome", "dd/MM/yyyy");
}

// "5 settimane   ·   16/11/2026 - 20/12/2026", come nella scheda di Mattia Minischetti
function periodo_(req) {
  const w = Number(req.weeks) || 6;
  return w + " settimane   ·   " + itDate_(req.startDate) + " - " + addDaysIso_(req.startDate, w * 7 - 1);
}

// Righe del feedback "S1  │  … S6  │" (o "S1: …"): tante quante le settimane della scheda
function fbLines_(cell, weeks) {
  const lines = String(cell || "").split("\n");
  if (lines.length < 2 || !/^\s*S1\s*(│|:)/.test(lines[0])) return null;
  if (!lines.every(function (l) { return /^\s*S\d+\s*(│|:)\s*$/.test(l); })) return null;
  const pipe = /│/.test(lines[0]), out = [];
  for (let i = 1; i <= weeks; i++) out.push(pipe ? "S" + i + "  │  " : "S" + i + ":");
  return out.join("\n");
}

function create_(req) {
  const tpl = DriveApp.getFileById(req.templateId);
  const parents = tpl.getParents();
  const folder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const copy = tpl.makeCopy(String(req.title || "Nuovo file"), folder);
  const ss = SpreadsheetApp.openById(copy.getId()), sh = ss.getSheets()[0];
  const d = itDate_(req.startDate);
  const lr = Math.min(sh.getLastRow(), 8), lc = Math.min(sh.getLastColumn(), 8);
  if (lr > 0 && lc > 0) {
    sh.getRange(1, 1, lr, lc).getDisplayValues().forEach(function (row, r) {
      row.forEach(function (cell, c) {
        const t = String(cell).trim(), u = t.toUpperCase();
        if (u === "NOME") sh.getRange(r + 1, c + 2).setValue(req.name || "");
        if (u === "PERIODO" && req.kind === "scheda") sh.getRange(r + 1, c + 2).setValue(periodo_(req));
        if (u === "DATA" && req.kind !== "scheda") sh.getRange(r + 1, c + 2).setValue("'" + d);
        // template nuovo: segnaposto direttamente nelle celle
        if (t === "Nome Cognome") sh.getRange(r + 1, c + 1).setValue(req.name || "");
        if (/^N settimane/i.test(t) && req.kind === "scheda") sh.getRange(r + 1, c + 1).setValue(periodo_(req));
      });
    });
  }
  if (req.kind === "scheda" && req.weeks) {
    const LR = Math.min(sh.getLastRow(), 220), LC = Math.min(sh.getLastColumn(), 12);
    if (LR > 0 && LC > 0) {
      const v = sh.getRange(1, 1, LR, LC).getDisplayValues();
      v.forEach(function (row, r) { row.forEach(function (cell, c) {
        const n = fbLines_(cell, Number(req.weeks));
        if (n != null && n !== cell) sh.getRange(r + 1, c + 1).setValue(n);
      }); });
    }
  }
  if (req.kind === "test") { try { sh.setName(d); } catch (e) {} }
  SpreadsheetApp.flush();
  let notion = { skipped: true };
  if (req.setNotion && req.athleteId) {
    try { notion = notionLink_(req, ss.getUrl()); } catch (e) { notion = { error: e.message }; }
  }
  return { id: copy.getId(), url: ss.getUrl(), notion: notion };
}

/* ---------- nuovo cliente in Notion ---------- */
const EDITABLE_ = { select: 1, status: 1, multi_select: 1, date: 1, url: 1, rich_text: 1, number: 1, checkbox: 1, email: 1, phone_number: 1 };

function dbProps_(which) {
  const ds = which === "vf" ? CONFIG.VF_DS : CONFIG.COACH_DS, db = which === "vf" ? CONFIG.VF_DB : CONFIG.COACH_DB;
  let r = notion_("/v1/data_sources/" + ds, "get", null, "2025-09-03");
  if (r.code !== 200) r = notion_("/v1/databases/" + db, "get", null, "2022-06-28");
  if (r.code !== 200) throw notionErr_(r);
  return r.json.properties || {};
}

// Campi modificabili dei due database, con le opzioni di select e status: l'app costruisce il modulo da qui
function notionSchema_() {
  const out = {};
  ["coach", "vf"].forEach(function (w) {
    try {
      const P = dbProps_(w), list = [];
      Object.keys(P).forEach(function (k) {
        const p = P[k];
        if (p.type === "title") { out[w + "Title"] = k; return; }
        if (!EDITABLE_[p.type]) return;
        const o = p[p.type] || {};
        list.push({ name: k, type: p.type, options: (o.options || []).map(function (x) { return x.name; }) });
      });
      out[w] = list;
    } catch (e) { out[w + "Err"] = e.message; }
  });
  return out;
}

function propVal_(type, v) {
  if (v == null || v === "" || (Array.isArray(v) && !v.length)) return null;
  switch (type) {
    case "select": return { select: { name: String(v) } };
    case "status": return { status: { name: String(v) } };
    case "multi_select": return { multi_select: [].concat(v).map(function (x) { return { name: String(x) }; }) };
    case "date": return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? { date: { start: String(v) } } : null;
    case "url": return { url: String(v) };
    case "email": return { email: String(v) };
    case "phone_number": return { phone_number: String(v) };
    case "number": return isNaN(Number(v)) ? null : { number: Number(v) };
    case "checkbox": return { checkbox: !!v };
    case "rich_text": return { rich_text: [{ type: "text", text: { content: String(v).slice(0, 1900) } }] };
  }
  return null;
}

// Crea la riga dell'atleta (con il modello predefinito del database, se c'è) e compila i campi scelti nell'app
function athleteNew_(req) {
  const w = req.db === "vf" ? "vf" : "coach", name = String(req.name || "").trim();
  if (!name) throw new Error("Scrivi nome e cognome");
  const P = dbProps_(w), props = {}, vals = req.props || {};
  let title = "Nome Cognome";
  Object.keys(P).forEach(function (k) { if (P[k].type === "title") title = k; });
  props[title] = { title: [{ type: "text", text: { content: name } }] };
  Object.keys(vals).forEach(function (k) {
    if (!P[k] || !EDITABLE_[P[k].type]) return;
    const pv = propVal_(P[k].type, vals[k]);
    if (pv) props[k] = pv;
  });
  const ds = w === "vf" ? CONFIG.VF_DS : CONFIG.COACH_DS, db = w === "vf" ? CONFIG.VF_DB : CONFIG.COACH_DB;
  let r = notion_("/v1/pages", "post", { parent: { type: "data_source_id", data_source_id: ds }, properties: props, template: { type: "default" } }, "2025-09-03");
  let tpl = true;
  if (r.code !== 200) { tpl = false; r = notion_("/v1/pages", "post", { parent: { type: "data_source_id", data_source_id: ds }, properties: props }, "2025-09-03"); }
  if (r.code !== 200) r = notion_("/v1/pages", "post", { parent: { database_id: db }, properties: props }, "2022-06-28");
  if (r.code !== 200) throw notionErr_(r);
  const id = r.json.id;
  // il modello si applica dopo la creazione: riscrivo i campi scelti perché restino quelli
  if (tpl) {
    Utilities.sleep(2500);
    const rp = {}; Object.keys(props).forEach(function (k) { if (k !== title) rp[k] = props[k]; });
    if (Object.keys(rp).length) notion_("/v1/pages/" + id, "patch", { properties: rp });
  }
  CacheService.getScriptCache().remove("athletes");
  return { athlete: { id: id.replace(/-/g, ""), src: w, name: name, notionUrl: r.json.url }, template: tpl };
}

// Prova dall'editor: crea un cliente di prova con il modello, mostra i campi salvati e lo sposta nel cestino
function provaNuovoCliente() {
  const s = notionSchema_();
  Logger.log("Campi Coaching: " + (s.coach || []).map(function (f) { return f.name; }).join(", ") + (s.coachErr ? " ERRORE " + s.coachErr : ""));
  Logger.log("Campi Kineva: " + (s.vf || []).map(function (f) { return f.name; }).join(", ") + (s.vfErr ? " ERRORE " + s.vfErr : ""));
  const r = athleteNew_({ db: "coach", name: "PROVA APP da cancellare", props: { "Status programma": "Da mandare", "Multi-select": "ONLINE COLLABO", "Inizio abbonamento": "2026-11-16", "Stato": "In corso" } });
  Logger.log("Creato con modello: " + r.template);
  Utilities.sleep(3000);
  const pg = notion_("/v1/pages/" + r.athlete.id, "get");
  const P = pg.json.properties;
  Logger.log("Salvato: " + ["Nome Cognome", "Status programma", "Multi-select", "Inizio abbonamento", "Stato"].map(function (k) { return k + "=" + pt_(P[k]); }).join(" · "));
  const bl = notion_("/v1/blocks/" + r.athlete.id + "/children?page_size=5", "get");
  Logger.log("Blocchi del modello nella pagina: " + ((bl.json && bl.json.results) || []).length);
  notion_("/v1/pages/" + r.athlete.id, "patch", { in_trash: true }, "2025-09-03");
  Logger.log("Pagina di prova spostata nel cestino");
}

/* ---------- note ---------- */
function notesSheet_() { return SpreadsheetApp.openById(CONFIG.NOTES_ID).getSheets()[0]; }

function notes_() {
  const sh = notesSheet_(), lr = sh.getLastRow();
  if (lr < 2) return { notes: [] };
  const v = sh.getRange(2, 1, lr - 1, 8).getDisplayValues();
  return {
    notes: v.filter(function (r) { return r[0]; }).map(function (r) {
      return { id: r[0], createdAt: r[1], athleteId: r[2], athleteName: r[3], kind: r[4],
        week: r[5] ? (parseInt(r[5], 10) || null) : null, signal: r[6] || null, text: r[7] };
    })
  };
}

function noteAdd_(req) {
  const n = req.note || {};
  if (!n.id || !n.athleteId) throw new Error("Nota incompleta");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = notesSheet_(), r = sh.getLastRow() + 1;
    const row = [n.id, n.createdAt, n.athleteId, n.athleteName, n.kind, n.week == null ? "" : n.week, n.signal || "", n.text || ""]
      .map(function (x) { return String(x == null ? "" : x); });
    sh.getRange(r, 1, 1, 8).setNumberFormat("@").setValues([row]);
    return { note: n };
  } finally { lock.releaseLock(); }
}

function noteDel_(req) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = notesSheet_(), lr = sh.getLastRow();
    if (lr < 2) return { ok: true };
    const ids = sh.getRange(2, 1, lr - 1, 1).getDisplayValues();
    for (let i = 0; i < ids.length; i++) { if (ids[i][0] === req.id) { sh.deleteRow(i + 2); break; } }
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/* ---------- pagina cliente ---------- */
// Foglio "Clienti" nel file note: un codice per atleta, con le impostazioni della sua pagina.
// Foglio "Feedback": registro di ogni invio (data, giornata, settimana, RPE…), per date sessioni e avvisi.
const CL_COLS = ["token", "athleteId", "athleteName", "active", "showFuture", "notify", "pinSheet", "pinTab", "pinSig", "createdAt", "gender"];
const FB_COLS = ["at", "athleteId", "athleteName", "sheetId", "tab", "day", "week", "exercise", "rpe", "tec", "pain", "skip", "why", "nota"];

function tab_(name, cols) {
  const ss = SpreadsheetApp.openById(CONFIG.NOTES_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
    sh.getRange("A:Z").setNumberFormat("@");
  }
  return sh;
}
function rows_(sh, n) {
  const lr = sh.getLastRow();
  return lr < 2 ? [] : sh.getRange(2, 1, lr - 1, n).getDisplayValues();
}
function clientRow_(r, i) {
  const o = {}; CL_COLS.forEach(function (k, j) { o[k] = r[j]; });
  o.active = o.active !== "no"; o.showFuture = o.showFuture !== "no"; o.notify = o.notify !== "no"; o.row = i + 2;
  return o;
}
function clientByToken_(token) {
  if (!/^[a-z0-9]{20,}$/.test(String(token || ""))) return null;
  const all = rows_(tab_("Clienti", CL_COLS), CL_COLS.length);
  for (let i = 0; i < all.length; i++) if (all[i][0] === token) return clientRow_(all[i], i);
  return null;
}
function clientUrl_(token) { return CLIENT_PAGE + "#t=" + token; }

function clients_() {
  return { clients: rows_(tab_("Clienti", CL_COLS), CL_COLS.length).map(clientRow_).map(function (c) { c.url = clientUrl_(c.token); return c; }) };
}

function clientLink_(req) {
  if (!req.athleteId) throw new Error("Atleta mancante");
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = tab_("Clienti", CL_COLS), all = rows_(sh, CL_COLS.length);
    for (let i = 0; i < all.length; i++) if (all[i][1] === req.athleteId) { const c = clientRow_(all[i], i); c.url = clientUrl_(c.token); return { client: c }; }
    if (!req.create) return { client: null };
    const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "").slice(0, 28).toLowerCase();
    const row = [token, req.athleteId, req.athleteName || "", "si", "si", "si", "", "", "", new Date().toISOString()];
    sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setNumberFormat("@").setValues([row]);
    const c = clientRow_(row, sh.getLastRow() - 2); c.url = clientUrl_(token);
    return { client: c };
  } finally { lock.releaseLock(); }
}

// Attiva/disattiva il link, settimane future, notifica. Con "renew" crea un codice nuovo (il vecchio smette di funzionare).
function clientSet_(req) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const c = clientByToken_(req.token); if (!c) throw new Error("Link non trovato");
    const sh = tab_("Clienti", CL_COLS), yn = function (v) { return v ? "si" : "no"; };
    if (req.active != null) sh.getRange(c.row, 4).setValue(yn(req.active));
    if (req.showFuture != null) sh.getRange(c.row, 5).setValue(yn(req.showFuture));
    if (req.notify != null) sh.getRange(c.row, 6).setValue(yn(req.notify));
    if (req.gender === "m" || req.gender === "f" || req.gender === "") { sh.getRange(1, 11).setValue("gender"); sh.getRange(c.row, 11).setNumberFormat("@").setValue(req.gender); }
    let token = c.token;
    if (req.renew) { token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "").slice(0, 28).toLowerCase(); sh.getRange(c.row, 1).setValue(token); }
    const n = clientByToken_(token); n.url = clientUrl_(token);
    return { client: n };
  } finally { lock.releaseLock(); }
}

// L'app del coach comunica quale scheda (file e foglio) ha riconosciuto come attuale:
// la pagina cliente usa la stessa, finché in Notion non cambiano i link.
function clientPin_(req) {
  const all = rows_(tab_("Clienti", CL_COLS), CL_COLS.length);
  for (let i = 0; i < all.length; i++) if (all[i][1] === req.athleteId) {
    const sh = tab_("Clienti", CL_COLS);
    sh.getRange(i + 2, 7, 1, 3).setNumberFormat("@").setValues([[req.sheetId || "", req.tab || "", req.sig || ""]]);
    return { ok: true };
  }
  return { ok: false };
}

function fbLog_(req) {
  const since = String(req.since || "");
  const v = rows_(tab_("Feedback", FB_COLS), FB_COLS.length);
  return { log: v.filter(function (r) { return !since || r[0] >= since; }).map(function (r) {
    const o = {}; FB_COLS.forEach(function (k, j) { o[k] = r[j]; }); return o;
  }) };
}

// Dati dell'atleta direttamente dalla sua pagina Notion (Coaching o Valutazione funzionale)
function athleteOne_(id) {
  const r = notion_("/v1/pages/" + id, "get");
  if (r.code !== 200) throw notionErr_(r);
  const P = r.json.properties || {};
  const vf = !!P["Scheda"] && !P["Training Program"];
  const links = links_(pt_(vf ? P["Scheda"] : P["Training Program"]));
  return { id: id, name: pt_(P["Nome Cognome"]).trim(), start: pt_(vf ? P["Inizio programma"] : P["Data inizio"]) || null,
    dur: vf ? null : (parseInt(pt_(P["Durata scheda"]), 10) || null), links: links };
}
function sigOf_(links) { return links.map(function (l) { return l.id + (l.gid ? ":" + l.gid : ""); }).join(","); }

function clientSheet_(c) {
  const a = athleteOne_(c.athleteId);
  const sig = sigOf_(a.links);
  let sheetId = null, tab = null, gid = null;
  if (c.pinSheet && c.pinSig === sig) { sheetId = c.pinSheet; tab = c.pinTab || null; }
  else { const cur = pickCurrent_(a.links); if (cur) { sheetId = cur.id; gid = cur.gid; } }
  if (!sheetId && !c.pinSheet) return { a: a, sheet: null };
  let s;
  try { s = readSheet_(sheetId || c.pinSheet, sheetId ? tab : c.pinTab, 220, 12, gid); }
  catch (e) {
    // link Notion a un file eliminato: usa la scheda che l'app del coach ha riconosciuto
    if (!c.pinSheet || c.pinSheet === sheetId) throw e;
    s = readSheet_(c.pinSheet, c.pinTab || null, 220, 12, null);
  }
  return { a: a, sheet: s };
}

const CLIENT_ACTIONS = {
  c_load: function (req) {
    const c = clientByToken_(req.token);
    if (!c || !c.active) return { error: "Link non valido o disattivato. Chiedi al tuo coach un link nuovo.", code: "token" };
    const r = clientSheet_(c);
    if (!r.sheet) return { error: "La tua scheda non è ancora pronta. Il coach te la manda a breve.", code: "nosheet" };
    return { name: r.a.name, start: r.a.start, dur: r.a.dur, showFuture: c.showFuture, g: c.gender || "",
      sheet: { id: r.sheet.id, tab: r.sheet.tab, title: r.sheet.title, values: r.sheet.values } };
  },
  // Scrive la riga della settimana nella cella FEEDBACK dell'esercizio, senza toccare le altre righe
  c_save: function (req) {
    const c = clientByToken_(req.token);
    if (!c || !c.active) return { error: "Link non valido o disattivato.", code: "token" };
    const r = clientSheet_(c);
    if (!r.sheet || r.sheet.id !== req.sheetId || r.sheet.tab !== req.tab) return { error: "La scheda è cambiata: ricarica la pagina.", code: "changed" };
    const row = Number(req.row), col = Number(req.col), week = Number(req.week);
    if (!(row > 1 && row <= 220 && col >= 1 && col <= 12 && week >= 1 && week <= 12)) throw new Error("Cella non valida");
    let isFb = false;
    for (let i = row - 2; i >= 0 && i >= row - 40; i--) { if (/FEEDBACK/i.test((r.sheet.values[i] || [])[col - 1] || "")) { isFb = true; break; } }
    if (!isFb) throw new Error("Non è una cella di feedback");
    const text = String(req.text || "").replace(/[\r\n]+/g, " ").replace(/^[=+\-@]+/, "").trim().slice(0, 600);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    let cell;
    try {
      const ss = SpreadsheetApp.openById(r.sheet.id), sh = ss.getSheetByName(r.sheet.tab);
      const rg = sh.getRange(row, col);
      cell = fbWrite_(rg.getDisplayValue(), week, text);
      rg.setValue(cell);
      SpreadsheetApp.flush();
      const m = req.meta || {};
      const log = [new Date().toISOString(), c.athleteId, c.athleteName, r.sheet.id, r.sheet.tab, m.day || "", String(week), m.exercise || "",
        m.rpe == null ? "" : String(m.rpe), m.tec || "", m.pain == null ? "" : String(m.pain), m.skip ? "si" : "", m.why || "", m.nota || ""];
      const lg = tab_("Feedback", FB_COLS);
      lg.getRange(lg.getLastRow() + 1, 1, 1, log.length).setNumberFormat("@").setValues([log.map(function (x) { return String(x).slice(0, 600); })]);
    } finally { lock.releaseLock(); }
    CacheService.getScriptCache().removeAll(["sh:" + r.sheet.id + ":" + r.sheet.tab + ":", "sh:" + r.sheet.id + "::"]);
    if (req.dayDone && c.notify) {
      try {
        MailApp.sendEmail(Session.getEffectiveUser().getEmail(), c.athleteName + " ha chiuso " + (req.meta && req.meta.day || "una giornata") + " · sett. " + week,
          c.athleteName + " ha inviato i feedback di " + (req.meta && req.meta.day || "una giornata") + ", settimana " + week + ".\n\n" + (req.summary || "") +
          "\n\nScheda: https://docs.google.com/spreadsheets/d/" + r.sheet.id + "/edit");
      } catch (e) {}
    }
    return { ok: true, cell: cell };
  }
};

// Righe "Sett. 2: …" (template Programmazione) oppure "S2  │  …" (template Serkistraining)
function fbWrite_(cell, w, text) {
  const lines = String(cell || "").replace(/\r/g, "").split("\n");
  const re = new RegExp("^(\\s*(?:Sett\\.?\\s*|S)" + w + "\\s*(?::|│)\\s*)(.*)$");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (m) { lines[i] = m[1] + text; return lines.join("\n"); }
  }
  const pipe = lines.some(function (l) { return /^\s*S\d+\s*│/.test(l); });
  if (lines.length === 1 && !lines[0].trim()) return (pipe ? "S" + w + "  │  " : "Sett. " + w + ": ") + text;
  lines.push((pipe ? "S" + w + "  │  " : "Sett. " + w + ": ") + text);
  return lines.join("\n");
}

// Prova dall'editor: Esegui → provaPaginaCliente (legge i link creati, non scrive niente)
function provaPaginaCliente() {
  const all = rows_(tab_("Clienti", CL_COLS), CL_COLS.length).map(clientRow_);
  Logger.log("Link cliente: " + all.length);
  all.forEach(function (c) {
    try { const r = clientSheet_(c); Logger.log(c.athleteName + " → " + (r.sheet ? r.sheet.title + " · " + r.sheet.tab : "nessuna scheda") + (c.active ? "" : " (disattivato)")); }
    catch (e) { Logger.log(c.athleteName + " → errore: " + e.message); }
  });
}

/* ---------- mail del mattino ---------- */
// Ogni giorno verso le 6:00 (ora di Roma) manda al coach l'elenco delle cose da fare sulle schede.
// Per attivarla, una volta sola: Esegui → installaMailMattino. Per provarla subito: Esegui → provaMailMattino.
const DIGEST_TO = "s.pretta98@gmail.com";
const APP_URL = "https://serkistraining.github.io/serkis-app/";

function installaMailMattino() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "mailMattino") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("mailMattino").timeBased().atHour(6).nearMinute(0).everyDays(1).inTimezone("Europe/Rome").create();
  Logger.log("Mail del mattino attiva: ogni giorno verso le 6:00 a " + DIGEST_TO);
}
function provaMailMattino() { mailMattino(); Logger.log("Mail di prova inviata a " + DIGEST_TO); }

function mailMattino() {
  const d = digest_();
  MailApp.sendEmail({ to: DIGEST_TO, subject: d.subject, htmlBody: d.html, body: d.text, name: "Serkis Coach" });
}

function romeToday_() {
  const s = Utilities.formatDate(new Date(), "Europe/Rome", "yyyy-MM-dd").split("-");
  return new Date(+s[0], +s[1] - 1, +s[2]);
}
function isoDay_(s) { const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function addD_(d, n) { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
function itD_(d) { return ["dom", "lun", "mar", "mer", "gio", "ven", "sab"][d.getDay()] + " " + ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2); }
function escH_(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

function digest_() {
  const today = romeToday_();
  const list = athletes_({ fresh: true }).athletes.filter(function (a) { return a.status !== "Fine collaborazione"; });
  const S = { scadute: [], ultima: [], arrivo: [], dolore: [], rpe: [], saltati: [], fermi: [], test: [], nuovi: [], problemi: [] };
  list.forEach(function (a) {
    if (a.status === "Mandare test/testare") S.test.push({ a: a, t: "test da fare" });
    if (a.status === "Da fare" || a.status === "In coda") S.nuovi.push({ a: a, t: a.status });
    const start = isoDay_(a.start), dur = a.dur;
    let week = null;
    if (start) {
      const days = Math.round((today - start) / 864e5);
      week = days < 0 ? 0 : Math.floor(days / 7) + 1;
      if (dur && a.src === "coach" && days >= 0) {
        const end = addD_(start, dur * 7 - 1);
        if (week > dur) S.scadute.push({ a: a, t: "scheda finita " + itD_(end) + " (" + (days - dur * 7 + 1) + " gg fa)" });
        else if (week === dur) S.ultima.push({ a: a, t: "ultima settimana, finisce " + itD_(end) + ": la nuova parte " + itD_(addD_(end, 1)) });
        else if (week === dur - 1) S.arrivo.push({ a: a, t: "penultima settimana, finisce " + itD_(end) });
      }
    } else if (a.src === "coach" && a.sheetId) S.problemi.push({ a: a, t: "manca la data di inizio in Notion" });
    if (!a.sheetId) { if (a.src === "coach" && a.status === "In corso") S.problemi.push({ a: a, t: "nessuna scheda collegata in Notion" }); return; }
    if (!week) return;
    let P;
    try {
      const sh = readSheet_(a.sheetId, null, 220, 12, a.sheetGid);
      P = SK.parse(sh.values);
    } catch (e) { S.problemi.push({ a: a, t: "non riesco ad aprire la scheda (" + e.message + ")" }); return; }
    if (!P.days.length) return; // formato vecchio: il controllo dei feedback si fa solo sui template nuovi
    const cur = Math.min(week, dur || week), recent = [cur, cur - 1].filter(function (w) { return w >= 1; });
    let lastFb = 0;
    P.days.forEach(function (d) {
      d.items.forEach(function (it) {
        const name = it.name.split("\n")[0];
        for (let w = 1; w <= (dur || 12); w++) if (SK.readFb(it.fb, w)) lastFb = Math.max(lastFb, w);
        recent.forEach(function (w) {
          const s = SK.readFb(it.fb, w); if (!s) return;
          const pm = s.match(/fastidio\s*(\d{1,2})\s*\/\s*10/i);
          if ((pm && +pm[1] > 0) || (!pm && /dolor|fastidi|male\b|infortun/i.test(s))) S.dolore.push({ a: a, t: name + " · sett. " + w + ": " + (pm ? "fastidio " + pm[1] + "/10" : s.slice(0, 120)) });
          if (/^SALTATO/i.test(s)) S.saltati.push({ a: a, t: name + " saltato in sett. " + w + (s.replace(/^SALTATO\s*·?\s*/i, "") ? " (" + s.replace(/^SALTATO\s*·?\s*/i, "") + ")" : "") });
          const nc = s.match(/non chiuso:?\s*([^·]*)/i);
          if (nc) S.saltati.push({ a: a, t: name + " non completato in sett. " + w + (nc[1].trim() ? " (" + nc[1].trim() + ")" : "") });
        });
        // RPE 10, oppure sotto 5, per 2 settimane di fila o più, ancora in corso
        let r10 = 0, rLow = 0;
        for (let w = 1; w <= cur; w++) {
          const r = SK.rpeOf(SK.readFb(it.fb, w));
          r10 = r === 10 ? r10 + 1 : (r == null ? r10 : 0);
          rLow = (r != null && r < 5) ? rLow + 1 : (r == null ? rLow : 0);
          if (w >= cur - 1 && r != null) {
            if (r === 10 && r10 >= 2) S.rpe.push({ a: a, t: name + ": RPE 10 per " + r10 + " settimane di fila (fino alla sett. " + w + ")", k: a.id + name + "h" });
            if (r < 5 && rLow >= 2) S.rpe.push({ a: a, t: name + ": RPE sotto 5 per " + rLow + " settimane di fila (fino alla sett. " + w + ")", k: a.id + name + "l" });
          }
        }
      });
    });
    if (cur >= 3 && lastFb <= cur - 2 && !(dur && week > dur)) S.fermi.push({ a: a, t: lastFb ? "ultimo feedback in sett. " + lastFb + ", ora siamo alla " + cur : "nessun feedback, siamo alla sett. " + cur });
  });
  // un solo avviso RPE per esercizio (il più recente)
  const seen = {}; S.rpe = S.rpe.reverse().filter(function (x) { if (seen[x.k]) return false; seen[x.k] = 1; return true; }).reverse();

  const sections = [
    ["Schede scadute", S.scadute, "#B42318"],
    ["Schede da fare per la settimana prossima", S.ultima, "#B42318"],
    ["Dolori e fastidi segnalati", S.dolore, "#B42318"],
    ["RPE da controllare (2+ settimane di fila)", S.rpe, "#8A5C00"],
    ["Esercizi saltati o non completati", S.saltati, "#8A5C00"],
    ["Test da fare", S.test, "#8A5C00"],
    ["Nuovi atleti da impostare", S.nuovi, "#8A5C00"],
    ["Feedback fermi da 2+ settimane", S.fermi, "#45443F"],
    ["In arrivo (penultima settimana)", S.arrivo, "#45443F"],
    ["Da sistemare in Notion", S.problemi, "#45443F"]
  ].filter(function (s) { return s[1].length; });
  const urgent = S.scadute.length + S.ultima.length + S.dolore.length + S.rpe.length;
  const giorno = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"][today.getDay()] + " " + today.getDate() + "/" + (today.getMonth() + 1);
  const subject = "Serkis Coach · " + giorno + " · " + (sections.length ? urgent + " cose urgenti" : "niente di urgente");
  const byAthlete = function (items) {
    const g = {}; items.forEach(function (x) { (g[x.a.name] = g[x.a.name] || []).push(x.t); });
    return Object.keys(g).sort(function (x, y) { return x.localeCompare(y, "it"); }).map(function (n) { return { n: n, t: g[n] }; });
  };
  let html = '<div style="font-family:Inter,Arial,sans-serif;max-width:620px;color:#161615;font-size:15px;line-height:1.5">' +
    '<div style="background:#161615;color:#F7F6F2;padding:16px 20px;border-radius:14px 14px 0 0;font-size:18px;font-weight:700">serkistraining · ' + escH_(giorno) + '</div>' +
    '<div style="border:1px solid #DCDBD5;border-top:0;border-radius:0 0 14px 14px;padding:8px 20px 18px">';
  let text = "Serkis Coach · " + giorno + "\n";
  if (!sections.length) { html += '<p>Niente di urgente oggi: nessuna scheda in scadenza e nessun avviso dai feedback.</p>'; text += "\nNiente di urgente oggi.\n"; }
  sections.forEach(function (s) {
    const g = byAthlete(s[1]);
    html += '<h3 style="margin:18px 0 6px;font-size:15px;color:' + s[2] + '">' + escH_(s[0]) + ' · ' + g.length + '</h3><ul style="margin:0;padding-left:18px">';
    text += "\n" + s[0].toUpperCase() + "\n";
    g.forEach(function (x) {
      html += '<li style="margin:3px 0"><b>' + escH_(x.n) + '</b>: ' + x.t.map(escH_).join("; ") + '</li>';
      text += "- " + x.n + ": " + x.t.join("; ") + "\n";
    });
    html += '</ul>';
  });
  html += '<p style="margin-top:20px"><a href="' + APP_URL + '" style="background:#F2C230;color:#161615;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">Apri Serkis Coach</a></p>' +
    '<p style="font-size:12px;color:#64625C">I controlli sui feedback valgono per le schede con il template nuovo. Mail automatica dal tuo backend Serkis Coach.</p></div></div>';
  text += "\nApri l'app: " + APP_URL + "\n";
  return { subject: subject, html: html, text: text, counts: sections.map(function (s) { return s[0] + ": " + s[1].length; }) };
}
// Anteprima nel registro, senza mandare la mail
function anteprimaMailMattino() { const d = digest_(); Logger.log(d.subject); Logger.log(d.text); }

// Prova dall'editor: crea una scheda di prova dal template nuovo (5 settimane), mostra intestazione e feedback, poi la sposta nel cestino
function provaTemplateNuovo() {
  const t = templates_().templates.filter(function (x) { return x.kind === "scheda" && /template\s*b\b|giallo/i.test(x.title); })[0];
  Logger.log("Template: " + (t ? t.title : "NON TROVATO"));
  const r = create_({ templateId: t.id, kind: "scheda", title: "PROVA APP da cancellare", name: "Mario Prova", startDate: "2026-11-16", weeks: 5 });
  const sh = SpreadsheetApp.openById(r.id).getSheets()[0], v = sh.getRange(1, 1, 8, 5).getDisplayValues();
  Logger.log("Riga 2: " + v[1].join(" | "));
  Logger.log("Feedback G1: " + JSON.stringify(v[6][4]));
  DriveApp.getFileById(r.id).setTrashed(true);
  Logger.log("File di prova nel cestino");
}
