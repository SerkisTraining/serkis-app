
/* ===== DIAGNOSI SCHEDE (temporanea, non distribuita) ===== */
function diagParser_() {
  var window = {}, document = {}, localStorage = { getItem: function () { return null; }, setItem: function () {} };
  /*SLICE*/
  return { parseSheet: parseSheet, planFor: planFor, maxWeek: maxWeek, hasPlan: hasPlan, exKey: exKey, norm: norm, analyze: analyze };
}
function diagnosiReset() { PropertiesService.getScriptProperties().deleteProperty("DIAG_FROM"); Logger.log("ok"); }
function diagnosiSchede() {
  const T = diagParser_(), props = PropertiesService.getScriptProperties();
  const from = Number(props.getProperty("DIAG_FROM") || 0), t0 = Date.now();
  const list = athletes_({}).athletes;
  const fd = function (d) { return d ? Utilities.formatDate(d, "Europe/Rome", "dd/MM/yy") : "-"; };
  const sum = function (vals) {
    const P = T.parseSheet(vals); const ok = T.hasPlan(P);
    const D = T.maxWeek(P) || 6, pl = ok ? T.planFor(P, D) : { ex: [], skipped: [] };
    const kg = pl.ex.filter(function (e) { return e.hasKg; });
    return { P: P, ok: ok, pl: pl, s: fd(P.meta.when) + " es" + pl.ex.length + " kg" + kg.length + (pl.skipped.length ? " skip" + pl.skipped.length : "") + " sez" + P.sections.length + (ok ? "" : " NOPLAN") };
  };
  let i = from;
  for (; i < list.length; i++) {
    if (Date.now() - t0 > 280000) break;
    const a = list[i], parts = [];
    try {
      if (a.sheetId) {
        const r = readSheet_(a.sheetId, null, null, null, a.sheetGid);
        const x = sum(r.values), an = T.analyze(x.P);
        parts.push("ATTUALE " + r.title + "/" + r.tab + ": " + x.s + " fb" + (an && an.lastFb || 0));
      } else parts.push("ATTUALE: nessun link");
      const sur = T.norm(a.name.trim().split(/\s+/).pop());
      const re = new RegExp("(^|[^a-z])" + sur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z]|$)");
      const fl = files_({ name: a.name }).files.filter(function (f) {
        const t = T.norm(f.title);
        return re.test(t) && !/template/.test(t) && !/\btest\b/.test(t) && (/\bscheda\b/.test(t) || !/valutazione|\bvf\b/.test(t));
      }).sort(function (x, y) { return String(y.updated).localeCompare(String(x.updated)); }).slice(0, 8);
      const hist = [];
      fl.forEach(function (f) {
        try {
          const ss = SpreadsheetApp.openById(f.id), tabs = ss.getSheets().slice(0, 12), tp = [];
          tabs.forEach(function (sh) {
            const lr = Math.min(sh.getLastRow(), 220), lc = Math.min(sh.getLastColumn(), 12);
            const v = (lr > 0 && lc > 0) ? trim_(sh.getRange(1, 1, lr, lc).getDisplayValues()) : [];
            const x = sum(v); tp.push(sh.getName() + "(" + x.s + ")");
            if (x.ok) hist.push({ date: x.P.meta.when, pl: x.pl });
          });
          parts.push("FILE " + f.title + " [" + Utilities.formatDate(DriveApp.getFileById(f.id).getDateCreated(), "Europe/Rome", "dd/MM/yy") + "]: " + tp.join(" · "));
        } catch (e) { parts.push("FILE " + f.title + ": ERRORE " + e.message); }
      });
      const dated = hist.filter(function (h) { return h.date; }), map = {};
      dated.forEach(function (h, ii) { h.pl.ex.forEach(function (e) { if (!e.hasKg) return; const k = T.exKey(e.label) || T.norm(e.label); (map[k] = map[k] || {})[ii] = 1; }); });
      const good = Object.keys(map).filter(function (k) { return Object.keys(map[k]).length >= 2; });
      parts.push("STORICO: schede " + hist.length + ", con data " + dated.length + ", esercizi nel grafico " + good.length);
    } catch (e) { parts.push("ERRORE " + e.message); }
    Logger.log("#" + i + " " + a.name + " (" + a.src + ") | " + parts.join(" | "));
  }
  if (i < list.length) { props.setProperty("DIAG_FROM", String(i)); Logger.log("CONTINUA: rilancia diagnosiSchede (da #" + i + " di " + list.length + ")"); }
  else { props.deleteProperty("DIAG_FROM"); Logger.log("FINE: " + list.length + " atleti"); }
}
