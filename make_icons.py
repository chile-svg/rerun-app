#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont

PAPER=(245,243,238); INK=(10,10,10); RED=(200,32,43)
A=".fonts/Anton.ttf"
SS=4  # supersample

def render_O(size, bg, fg, scale):
    """Square icon: Anton 'O' centered, height = scale*size."""
    px=size*SS
    img=Image.new("RGB",(px,px),bg); d=ImageDraw.Draw(img)
    # find font size so glyph height == scale*px
    target=scale*px
    fs=int(target/ (264/300))   # Anton O height ratio ~ 264/300 of font size
    f=ImageFont.truetype(A,fs)
    bb=f.getbbox("O")  # x0,y0,x1,y1
    gw=bb[2]-bb[0]; gh=bb[3]-bb[1]
    x=(px-gw)/2 - bb[0]
    y=(px-gh)/2 - bb[1]
    d.text((x,y),"O",font=f,fill=fg)
    return img.resize((size,size),Image.LANCZOS)

# ---------- preview sheet: treatments + small-size legibility ----------
def rounded(img,r):
    img=img.convert("RGBA")
    m=Image.new("L",img.size,0); dm=ImageDraw.Draw(m)
    dm.rounded_rectangle([0,0,img.size[0]-1,img.size[1]-1],radius=r,fill=255)
    img.putalpha(m); return img

treat=[
    ("PAPER BG · RED O", PAPER, RED, 0.74),
    ("INK BG · RED O", INK, RED, 0.74),
    ("INK BG · PAPER O", INK, PAPER, 0.74),
    ("RED BG · PAPER O", RED, PAPER, 0.74),
]
cell=300; pad=40; labelh=40
W=cell*2+pad*3
H=(cell+labelh+pad)*2+pad
sheet=Image.new("RGB",(W,H),(214,211,204)); d=ImageDraw.Draw(sheet)
try: lf=ImageFont.truetype(".fonts/JBMono.ttf",16)
except: lf=ImageFont.load_default()
for i,(name,bg,fg,sc) in enumerate(treat):
    cx=pad+(i%2)*(cell+pad); cy=pad+(i//2)*(cell+labelh+pad)
    ic=rounded(render_O(cell,bg,fg,sc),int(cell*0.22))
    sheet.paste(ic,(cx,cy),ic)
    # small previews (64,40) to the corner
    s64=rounded(render_O(64,bg,fg,sc),14); sheet.paste(s64,(cx+cell-64-8,cy+8),s64)
    d.text((cx,cy+cell+10),name,font=lf,fill=(70,68,64))
sheet.save("icon-preview.png"); print("saved preview",sheet.size)

# ---------- final icons: paper bg, red Anton O (matches wordmark + splash) ----------
render_O(192, PAPER, RED, 0.74).save("icon-192.png")
render_O(512, PAPER, RED, 0.74).save("icon-512.png")
# maskable: smaller scale so the O stays inside the circular safe zone
render_O(512, PAPER, RED, 0.56).save("icon-512-maskable.png")
print("wrote icon-192 / icon-512 / icon-512-maskable")
