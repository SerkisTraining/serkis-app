"""Icone 2.0: la "i" in verticale di serkistraining (gambo osso, testa gialla) su fondo nero.
Uso: python3 tools/icons2.py CARTELLA"""
import os, sys
from PIL import Image, ImageDraw
BG=(15,15,16); BONE=(244,242,236); Y=(242,194,48)
def icon(size, pad=0.0, rounded=True):
    S=size*4; im=Image.new("RGBA",(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    if rounded: d.rounded_rectangle([0,0,S-1,S-1], radius=int(S*0.22), fill=BG)
    else: d.rectangle([0,0,S,S], fill=BG)
    k=1-pad; cx=S/2
    sw=S*0.13*k; sh=S*0.40*k; dot=S*0.17*k; gap=S*0.055*k
    top=S/2-(sh+gap+dot)/2
    d.rounded_rectangle([cx-sw/2, top, cx+sw/2, top+sh], radius=int(sw*0.18), fill=BONE)
    y0=top+sh+gap
    d.ellipse([cx-dot/2, y0, cx+dot/2, y0+dot], fill=Y)
    return im.resize((size,size), Image.LANCZOS)
def svg(rounded=True):
    r='rx="113"' if rounded else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" {r} fill="#0F0F10"/><rect x="222.7" y="149.6" width="66.6" height="204.8" rx="12" fill="#F4F2EC"/><circle cx="256" cy="419" r="43.5" fill="#F2C230"/></svg>'
out=sys.argv[1]; os.makedirs(os.path.join(out,"icons"),exist_ok=True)
icon(192).save(os.path.join(out,"icons/icon-192.png"))
icon(512).save(os.path.join(out,"icons/icon-512.png"))
icon(512,pad=0.22,rounded=False).save(os.path.join(out,"icons/icon-maskable-512.png"))
icon(180,rounded=False).convert("RGB").save(os.path.join(out,"icons/apple-touch-icon.png"))
icon(32).save(os.path.join(out,"icons/favicon-32.png"))
open(os.path.join(out,"favicon.svg"),"w").write(svg())
print("icone in",out)
