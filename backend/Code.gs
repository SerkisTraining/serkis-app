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
const VERSION = "1.0";

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

/* ---------- ingresso web ---------- */
function doGet() {
  return ContentService.createTextOutput("Serkis Coach backend " + VERSION + " attivo.");
}

function doPost(e) {
  let req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || "{}"); }
  catch (err) { return out_({ error: "Richiesta non valida" }); }
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
  noteDel: noteDel_
};

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Notion ---------- */
function notion_(path, method, body, version) {
  const opt = {
    method: method || "get",
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + CONFIG.NOTION_TOKEN, "Notion-Version": version || "2022-06-28" }
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

function athletes_(req) {
  const cache = CacheService.getScriptCache();
  if (!req.fresh) { const hit = cache.get("athletes"); if (hit) return { athletes: JSON.parse(hit) }; }
  const coach = queryNotion_(CONFIG.COACH_DS, CONFIG.COACH_DB).filter(function (pg) { return !pg.in_trash && !pg.archived; }).map(function (pg) {
    const P = pg.properties || {};
    return {
      src: "coach", id: pg.id.replace(/-/g, ""), name: pt_(P["Nome Cognome"]).trim() || "Senza nome",
      tag: pt_(P["Multi-select"]), status: pt_(P["Status programma"]) || "—",
      start: pt_(P["Data inizio"]) || null, dur: parseInt(pt_(P["Durata scheda"]), 10) || null,
      subStart: pt_(P["Inizio abbonamento"]) || null, sheetId: sid_(pt_(P["Training Program"])),
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
        firstEval: pt_(P["Data prima valutazione"]) || null, sheetId: sid_(pt_(P["Scheda"])),
        valId: sid_(pt_(P["Valutazione"])), notionUrl: pg.url, videoUrl: pt_(P["Cartella video Drive"]) || null
      };
    });
  } catch (e) { /* database Kineva non collegato all'integrazione */ }
  const all = coach.concat(vf);
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

function readSheet_(id, tab, maxRows, maxCols) {
  const ss = SpreadsheetApp.openById(id);
  const all = ss.getSheets();
  const sh = (tab && ss.getSheetByName(tab)) || all[0];
  const lr = Math.min(sh.getLastRow(), maxRows || 220), lc = Math.min(sh.getLastColumn(), maxCols || 12);
  const values = (lr > 0 && lc > 0) ? trim_(sh.getRange(1, 1, lr, lc).getDisplayValues()) : [];
  return { id: id, title: ss.getName(), tab: sh.getName(), tabs: all.map(function (s) { return s.getName(); }), values: values, url: ss.getUrl() };
}

function sheets_(req) {
  const out = {}, cache = CacheService.getScriptCache();
  (req.ids || []).slice(0, 10).forEach(function (id) {
    const ck = "sh:" + id + ":" + (req.tab || "");
    if (!req.fresh) { const hit = cache.get(ck); if (hit) { out[id] = JSON.parse(hit); return; } }
    try {
      const r = readSheet_(id, req.tab);
      out[id] = r;
      try { cache.put(ck, JSON.stringify(r), 600); } catch (e) {}
    } catch (e) { out[id] = { error: "Non riesco ad aprire il file: " + e.message }; }
  });
  return { sheets: out };
}

function files_(req) {
  const parts = String(req.name || "").trim().split(/\s+/), sur = parts[parts.length - 1] || "";
  if (sur.length < 2) return { files: [] };
  const it = DriveApp.searchFiles('title contains "' + sur.replace(/"/g, "") + '" and mimeType = "application/vnd.google-apps.spreadsheet" and trashed = false');
  const out = [];
  while (it.hasNext() && out.length < 40) {
    const f = it.next();
    out.push({ id: f.getId(), title: f.getName(), url: f.getUrl(), updated: f.getLastUpdated().toISOString() });
  }
  return { files: out };
}

function bundle_(req) {
  const out = [];
  (req.ids || []).slice(0, 5).forEach(function (id) {
    try {
      const ss = SpreadsheetApp.openById(id), f = DriveApp.getFileById(id);
      const tabs = ss.getSheets().slice(0, 6).map(function (sh) {
        const lr = Math.min(sh.getLastRow(), 90), lc = Math.min(sh.getLastColumn(), 10);
        return { name: sh.getName(), values: (lr > 0 && lc > 0) ? trim_(sh.getRange(1, 1, lr, lc).getDisplayValues()) : [] };
      });
      out.push({ id: id, title: ss.getName(), url: ss.getUrl(), updated: f.getLastUpdated().toISOString(), tabs: tabs });
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
    CacheService.getScriptCache().removeAll(["sh:" + req.sheetId + ":", "sh:" + req.sheetId + ":" + (req.tab || ""), "sh:" + req.sheetId + ":" + sh.getName()]);
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
        const u = String(cell).trim().toUpperCase();
        if (u === "NOME") sh.getRange(r + 1, c + 2).setValue(req.name || "");
        if (u === "PERIODO" && req.kind === "scheda") sh.getRange(r + 1, c + 2).setValue((req.weeks || 6) + " settimane - " + d);
        if (u === "DATA" && req.kind !== "scheda") sh.getRange(r + 1, c + 2).setValue("'" + d);
      });
    });
  }
  if (req.kind === "test") { try { sh.setName(d); } catch (e) {} }
  SpreadsheetApp.flush();
  let notion = { skipped: true };
  if (req.setNotion && req.athleteId) {
    try { notion = notionLink_(req, ss.getUrl()); } catch (e) { notion = { error: e.message }; }
  }
  return { id: copy.getId(), url: ss.getUrl(), notion: notion };
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
