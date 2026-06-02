#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont

PAPER=(245,243,238); INK=(10,10,10); RED=(200,32,43); GREY=(120,116,108)
A=".fonts/Anton.ttf"; M=".fonts/JBMono.ttf"
S=3
def anton(sz): return ImageFont.truetype(A,int(sz*S))
def mono(sz):
    f=ImageFont.truetype(M,int(sz*S))
    try: f.set_variation_by_axes([700])
    except: pass
    return f
W=1080
def tw(d,s,f): return d.textlength(s,font=f)
def mono_track(d,x,y,s,f,fill,track):
    cx=x
    for ch in s: d.text((cx,y),ch,font=f,fill=fill); cx+=d.textlength(ch,font=f)+track
    return cx
def tag_centered(d,y,s,f,fill,track):
    w=sum(d.textlength(c,font=f)+track for c in s)-track
    mono_track(d,(W*S-w)/2,y,s,f,fill,track)

# Anton cap-height ratio (capheight/fontsize) from measured 258/300
CAP=258/300

H1=520; H2=430
sheet=Image.new("RGB",(W*S,(H1+H2)*S),PAPER); d=ImageDraw.Draw(sheet)

# ---------- corrected PRIMARY lockup: red O is the real Anton glyph ----------
f=anton(165)
word="REPCO"
x0=(W*S-tw(d,word,f))/2; yy=140*S
d.text((x0,yy),word,font=f,fill=INK)            # full word in ink
ox=x0+tw(d,"REPC",f)
d.text((ox,yy),"O",font=f,fill=RED)             # redraw just the O in red, exact position
tag_centered(d,360*S,"CLOSE THE LOOP — PHYSIO & PATIENT",mono(15),RED,5*S)
d.rectangle([(W/2-120)*S,408*S,(W/2+120)*S,409.5*S],fill=INK)

# ---------- O STUDY: circle vs matched-ring vs Anton glyph ----------
top=H1
d.rectangle([0,top*S,W*S,(top+1)*S],fill=(0,0,0,40))
mono_track(d,90*S,(top+34)*S,"THE O — MAKING IT COHERENT",mono(13),GREY,4*S)

capH=150          # target visual cap height for the study
cy=top+90         # top of the glyph row
cols=[W*0.22, W*0.5, W*0.78]

# (a) perfect circle ring (the old v2 — incoherent)
cxa=cols[0]*S
dia=capH*S
strk=int(dia*0.18)
d.ellipse([cxa-dia/2,cy*S,cxa+dia/2,cy*S+dia],outline=RED,width=strk)

# (b) matched ring — Anton O proportions (w/h 146/264) + matched wall (~51/300)
cxb=cols[1]*S
ow=capH*(146/264)*S        # condensed width
oh=capH*(264/258)*S        # include overshoot vs cap
wall=int(capH*(51/258)*S)  # side-wall thickness from measurement
# draw as outer red ellipse minus inner paper ellipse (gives flat, even wall)
d.ellipse([cxb-ow/2,cy*S,cxb+ow/2,cy*S+oh],fill=RED)
d.ellipse([cxb-ow/2+wall,cy*S+wall,cxb+ow/2-wall,cy*S+oh-wall],fill=PAPER)

# (c) the real Anton glyph O, in red
cxc=cols[2]*S
fo=anton(capH/CAP)
ow2=tw(d,"O",fo)
# align baseline of glyph with others: glyph bbox top offset
bb=fo.getbbox("O")
d.text((cxc-ow2/2, cy*S - bb[1]),"O",font=fo,fill=RED)

# labels
ly=(cy+capH+44)
for cx,lbl in [(cols[0],"(A) CIRCLE — FOREIGN"),(cols[1],"(B) MATCHED RING"),(cols[2],"(C) ANTON GLYPH ✓")]:
    fl=mono(12)
    w=sum(d.textlength(c,font=fl)+3*S for c in lbl)-3*S
    col = (40,150,80) if lbl.endswith("✓") else GREY
    mono_track(d,cx*S-w/2,ly*S,lbl,fl,col,3*S)

sheet=sheet.resize((W,H1+H2),Image.LANCZOS)
sheet.save("repco-loop-coherent.png"); print("saved",sheet.size)
