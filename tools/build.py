"""Assembla l'app installabile, la pagina cliente (docs/c/) e la pagina del cruscotto claude.ai (artifact/).
Uso: python3 tools/build.py        → app in docs/ (versione ufficiale)
     python3 tools/build.py beta   → app in docs/beta/ (indirizzo di prova)"""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(ROOT, p), encoding="utf-8").read()
BETA = len(sys.argv) > 1 and sys.argv[1] == "beta"
OUT = os.path.join(ROOT, "docs/beta" if BETA else "docs")
os.makedirs(OUT, exist_ok=True)
css, body, js = rd("src/style.css"), rd("src/body.html"), rd("src/scheda.js") + "\n" + rd("src/app.js")
mark = re.search(r'(<polygon.*</svg>)', rd("docs/icons/mark.svg"), re.S).group(1).replace("</svg>", "")
body = body.replace("%%MARK%%", mark)
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap">'
VER = re.search(r'const VERSION="([^"]+)"', js).group(1) + ("-prova" if BETA else "")
NAME = "Serkistraining Coach" + (" (prova)" if BETA else "")

app_html = f"""<!doctype html>
<html lang="it"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{NAME}</title>
<meta name="description" content="Atleti, schede, test e feedback di Serkistraining">
<meta name="theme-color" content="#0F0F10">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="{"Coach prova" if BETA else "Coach"}">
<meta name="robots" content="noindex">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="icon" href="icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
{FONTS}
<style>html{{-webkit-text-size-adjust:100%}}:root{{padding-top:env(safe-area-inset-top,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}
{css}</style>
</head><body>
{body}
<script>
{js}
</script>
</body></html>
"""
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(app_html)

manifest = {
  "name": NAME, "short_name": "Coach prova" if BETA else "Coach", "description": "Atleti, schede, test e feedback di Serkistraining",
  "lang": "it", "start_url": "./#oggi", "scope": "./", "display": "standalone", "orientation": "any",
  "background_color": "#0F0F10", "theme_color": "#0F0F10",
  "icons": [
    {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
  ]
}
open(os.path.join(OUT, "manifest.webmanifest"), "w").write(json.dumps(manifest, ensure_ascii=False, indent=2))

sw = """const C="serkis-%s";
const BASE=new URL("./",self.registration.scope).pathname;
const SHELL=["./","index.html","manifest.webmanifest","favicon.svg","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png","icons/favicon-32.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin)return;
  if(/^(c|beta)\\//.test(u.pathname.slice(BASE.length)))return;
  if(r.mode==="navigate"||u.pathname.endsWith("/")||u.pathname.endsWith("index.html")){
    e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put("index.html",cp));return res}).catch(()=>caches.match("index.html")));return;
  }
  e.respondWith(caches.match(r).then(x=>x||fetch(r)));
});
""" % VER
open(os.path.join(OUT, "sw.js"), "w").write(sw)

# pagina cliente: sempre in docs/c/
BACKEND = re.search(r'const DEFAULT_BACKEND="([^"]+)"', js).group(1)
client = rd("src/client.html").replace("%%SCHEDA%%", rd("src/scheda.js")).replace("%%BACKEND%%", BACKEND)
os.makedirs(os.path.join(ROOT, "docs/c"), exist_ok=True)
open(os.path.join(ROOT, "docs/c/index.html"), "w", encoding="utf-8").write(client)
if BETA:
    print("build ok", VER, len(app_html), "· pagina cliente", len(client))
    sys.exit(0)

os.makedirs(os.path.join(ROOT, "artifact"), exist_ok=True)
art = f"""<title>Cruscotto Serkistraining</title>
<meta name="claude:viewport-fit-sides" content="cover">
{FONTS}
<style>{css}</style>
{body}
<script>
{js}
</script>
"""
open(os.path.join(ROOT, "artifact/cruscotto.html"), "w", encoding="utf-8").write(art)
open(os.path.join(ROOT, "docs", ".nojekyll"), "w").close()
print("build ok", VER, len(app_html), len(art))
