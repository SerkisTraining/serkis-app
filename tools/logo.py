# Genera il logo SVG (monogramma a lastre) in varianti: any, maskable, apple, mark
BG="#0b0c0e"; BONE="#eef0f2"; RED="#e3262b"
def mark(scale=1.0, cx=256, cy=256):
    W,t,g,L,c,ov=216,52,16,58,30,22
    H=3*t+2*L+2*g
    x0,y0=-W/2,-H/2
    def P(pts): return " ".join(f"{cx+x*scale:.1f},{cy+y*scale:.1f}" for x,y in pts)
    y1=y0+t+L            # fine gamba sinistra
    yb=y1+g               # inizio sbarra
    y2=yb+t+g             # inizio gamba destra
    yE=y0+H
    upper=[(x0,y0),(x0+W-c,y0),(x0+W,y0+c),(x0+W,y0+t),(x0+t,y0+t),(x0+t,y1),(x0,y1)]
    bar=[(x0-ov,yb),(x0+W+ov,yb),(x0+W+ov,yb+t),(x0-ov,yb+t)]
    lower=[(x0+W-t,y2),(x0+W,y2),(x0+W,yE),(x0+c,yE),(x0,yE-c),(x0,yE-t),(x0+W-t,yE-t)]
    return "".join(f'<polygon fill="{f}" points="{P(p)}"/>' for f,p in [(BONE,upper),(RED,bar),(BONE,lower)])
def svg(kind):
    if kind=="any":   bg=f'<rect width="512" height="512" rx="108" fill="{BG}"/>'; m=mark(1.0)
    elif kind=="maskable": bg=f'<rect width="512" height="512" fill="{BG}"/>'; m=mark(0.82)
    elif kind=="apple": bg=f'<rect width="512" height="512" fill="{BG}"/>'; m=mark(0.9)
    else: bg=""; m=mark(1.0)
    vb='0 0 512 512' if kind!="mark" else '118 100 276 312'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{bg}{m}</svg>'
import sys
for k in ["any","maskable","apple","mark"]:
    open(f"docs/icons/{k}.svg","w").write(svg(k))
open("docs/favicon.svg","w").write(svg("any"))
print(svg("mark"))
