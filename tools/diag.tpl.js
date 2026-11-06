
/* ===== DIAGNOSI SCHEDE (temporanea, non distribuita) ===== */
function diagParser_() {
  var window = {}, document = {}, localStorage = { getItem: function () { return null; }, setItem: function () {} };
  /*SLICE*/
  return { parseSheet: parseSheet, planFor: planFor, maxWeek: maxWeek, hasPlan: hasPlan, exKey: exKey, norm: norm, analyze: analyze,
    inferDates: inferDates, numOfTab: numOfTab, NOT_SCHEDA: NOT_SCHEDA, linkIds: linkIds };
}
function diagnosiReset() { PropertiesService.getScriptProperties().deleteProperty("DIAG_FROM"); Logger.log("ok"); }
function diagnosiSchede() {
  const T = diagParser_(), props = PropertiesService.getScriptProperties();
  const from = Number(props.getProperty("DIAG_FROM") || 0), t0 = Date.now();
  const list = athletes_({}).athletes;
  const fd = function (d) { return d ? Utilities.formatDate(d, "Europe/Rome", "dd/MM/yy") : "-"; };
  let i = from;
  for (; i < list.length; i++) {
    if (Date.now() - t0 > 280000) break;
    const a = list[i], parts = [];
    try {
      if (a.sheetId) {
        try {
          const r = readSheet_(a.sheetId, null, null, null, a.sheetGid), P = T.parseSheet(r.values), ok = T.hasPlan(P);
          const pl = ok ? T.planFor(P, T.maxWeek(P) || 6) : { ex: [], skipped: [] };
          parts.push("ATTUALE " + r.title + "/" + r.tab + ": " + fd(P.meta.when) + " es" + pl.ex.length + " kg" + pl.ex.filter(function (e) { return e.hasKg; }).length + (pl.skipped.length ? " skip" + pl.skipped.length : "") + (ok ? "" : " NOPLAN") + " fb" + (T.analyze(P).lastFb || 0));
        } catch (e) { parts.push("ATTUALE: file non apribile → l'app mostra la scheda più recente su Drive"); }
      } else parts.push("ATTUALE: nessun link");
      const sur = T.norm(a.name.trim().split(/\s+/).pop());
      const re = new RegExp("(^|[^a-z])" + sur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z]|$)");
      const fl = files_({ name: a.name, ids: T.linkIds(a) }).files.filter(function (f) {
        const t = T.norm(f.title);
        if (/template/.test(t) || /\btest\b/.test(t)) return false;
        if (!(f.linked || re.test(t))) return false;
        if (!(/\bscheda\b/.test(t) || !/valutazione|\bvf\b/.test(t))) return false;
        return f.linked || !T.NOT_SCHEDA.test(t);
      }).sort(function (x, y) { return String(y.updated).localeCompare(String(x.updated)); }).slice(0, 8);
      const hist = [], sigs = {};
      fl.forEach(function (f) {
        try {
          const ss = SpreadsheetApp.openById(f.id), its = [];
          ss.getSheets().slice(0, 12).forEach(function (sh, idx) {
            const lr = Math.min(sh.getLastRow(), 220), lc = Math.min(sh.getLastColumn(), 12);
            const v = (lr > 0 && lc > 0) ? trim_(sh.getRange(1, 1, lr, lc).getDisplayValues()) : [];
            const P = T.parseSheet(v); if (P.kind !== "scheda" || !T.hasPlan(P)) return;
            const pl = T.planFor(P, T.maxWeek(P) || 6); if (!pl.ex.length) return;
            its.push({ idx: idx, name: sh.getName(), num: T.numOfTab(sh.getName()), when: P.meta.when || null, pl: pl });
          });
          T.inferDates({ created: f.created, updated: f.updated }, its);
          const tp = [];
          its.forEach(function (t) {
            const sig = t.pl.ex.map(function (e) { return e.label + ":" + e.perW.map(function (p) { return p ? p.kg + "x" + p.sets : "-"; }).join(","); }).join("|");
            const dup = !!sigs[sig]; sigs[sig] = 1;
            tp.push(t.name + "(" + (t.approx ? "~" : "") + (t.fixed ? "!" : "") + fd(t.when) + " kg" + t.pl.ex.filter(function (e) { return e.hasKg; }).length + (dup ? " DUP" : "") + ")");
            if (!dup) hist.push(t);
          });
          parts.push("FILE " + f.title + (f.linked ? " [N]" : "") + ": " + (tp.join(" · ") || "nessuna scheda"));
        } catch (e) { parts.push("FILE " + f.title + ": ERRORE " + e.message); }
      });
      hist.sort(function (x, y) { return x.when - y.when; });
      const map = {};
      hist.forEach(function (h, ii) { h.pl.ex.forEach(function (e) { if (!e.hasKg) return; const k = T.exKey(e.label) || T.norm(e.label); (map[k] = map[k] || {})[ii] = 1; }); });
      const good = Object.keys(map).filter(function (k) { return Object.keys(map[k]).length >= 2; });
      parts.push("STORICO: " + hist.length + " schede, " + good.length + " esercizi nel grafico (" + good.slice(0, 6).join(", ") + ")");
    } catch (e) { parts.push("ERRORE " + e.message); }
    Logger.log("#" + i + " " + a.name + " | " + parts.join(" | "));
  }
  if (i < list.length) { props.setProperty("DIAG_FROM", String(i)); Logger.log("CONTINUA: rilancia diagnosiSchede (da #" + i + " di " + list.length + ")"); }
  else { props.deleteProperty("DIAG_FROM"); Logger.log("FINE: " + list.length + " atleti"); }
}
