"""Icone e favicon dal logo ufficiale (cartella brand/, concept "Avanzamento").
I file del logo non vengono ridisegnati né ricolorati: solo ridimensionati.
L'icona "maskable" (Android) e quella Apple non ammettono angoli trasparenti: l'icona
icona-app-notte viene posata su un quadrato Notte #131B2C, lo stesso colore del suo fondo.
Uso: python3 tools/icons3.py CARTELLA   (es. docs, docs/beta, docs/c)"""
import os, sys, shutil
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "brand")
NOTTE = (19, 27, 44, 255)
APP = Image.open(os.path.join(B, "png/icona-app-notte.png")).convert("RGBA")
def fit(size): return APP.resize((size, size), Image.LANCZOS)
def on_notte(size, scale):
    bg = Image.new("RGBA", (size, size), NOTTE); s = round(size * scale)
    bg.alpha_composite(APP.resize((s, s), Image.LANCZOS), ((size - s) // 2, (size - s) // 2)); return bg
out = sys.argv[1]; os.makedirs(os.path.join(out, "icons"), exist_ok=True)
fit(192).save(os.path.join(out, "icons/icon-192.png"))
fit(512).save(os.path.join(out, "icons/icon-512.png"))
on_notte(512, 0.80).save(os.path.join(out, "icons/icon-maskable-512.png"))
on_notte(180, 1.0).convert("RGB").save(os.path.join(out, "icons/apple-touch-icon.png"))
shutil.copy(os.path.join(B, "png/favicon-64.png"), os.path.join(out, "icons/favicon-64.png"))
shutil.copy(os.path.join(B, "svg/icona-app-notte.svg"), os.path.join(out, "favicon.svg"))
for old in ("icons/favicon-32.png",):
    p = os.path.join(out, old)
    if os.path.exists(p): os.remove(p)
print("icone in", out)
