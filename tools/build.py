"""Assembla l'app installabile (app/) e la pagina del cruscotto claude.ai (artifact/)."""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(ROOT, p), encoding="utf-8").read()
css, body, js = rd("src/style.css"), rd("src/body.html"), rd("src/app.js")
mark = re.search(r'(<polygon.*</svg>)', rd("docs/icons/mark.svg"), re.S).group(1).replace("</svg>", "")
body = body.replace("%%MARK%%", mark)
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=JetBrains+Mono:wght@400;500;700&display=swap">'
VER = re.search(r'const VERSION="([^"]+)"', js).group(1)

app_html = f"""<!doctype html>
<html lang="it"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Serkis Coach</title>
<meta name="description" content="Atleti, schede, test e feedback di Serkistraining">
<meta name="theme-color" content="#0b0c0e">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Serkis">
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
open(os.path.join(ROOT, "docs/index.html"), "w", encoding="utf-8").write(app_html)

manifest = {
  "name": "Serkis Coach", "short_name": "Serkis", "description": "Atleti, schede, test e feedback di Serkistraining",
  "lang": "it", "start_url": "./#oggi", "scope": "./", "display": "standalone", "orientation": "any",
  "background_color": "#0b0c0e", "theme_color": "#0b0c0e",
  "icons": [
    {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
  ]
}
open(os.path.join(ROOT, "docs/manifest.webmanifest"), "w").write(json.dumps(manifest, ensure_ascii=False, indent=2))

sw = """const C="serkis-%s";
const SHELL=["./","index.html","manifest.webmanifest","favicon.svg","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png","icons/favicon-32.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin)return;
  if(r.mode==="navigate"||u.pathname.endsWith("/")||u.pathname.endsWith("index.html")){
    e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put("index.html",cp));return res}).catch(()=>caches.match("index.html")));return;
  }
  e.respondWith(caches.match(r).then(x=>x||fetch(r)));
});
""" % VER
open(os.path.join(ROOT, "docs/sw.js"), "w").write(sw)

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
