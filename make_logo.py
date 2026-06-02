#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont

PAPER=(245,243,238); INK=(10,10,10); RED=(200,32,43); MUTE=(10,10,10,150)
A=".fonts/Anton.ttf"; M=".fonts/JBMono.ttf"
S=3  # supersample
def anton(sz): return ImageFont.truetype(A,int(sz*S))
def mono(sz):
    f=ImageFont.truetype(M,int(sz*S))
    try: f.set_variation_by_axes([700])
    except: pass
    return f

W=1080
def new(h,bg=PAPER):
    img=Image.new("RGB",(W*S,int(h*S)),bg); return img,ImageDraw.Draw(img)
def tw(d,s,f): return d.textlength(s,font=f)

def mono_track(d,x,y,s,f,fill,track):
    # manual letter-spacing for mono labels
    cx=x
    for ch in s:
        d.text((cx,y),ch,font=f,fill=fill)
        cx+=d.textlength(ch,font=f)+track
    return cx

panels=[]

# ---------- Panel 1: primary lockup, centered ----------
def panel_primary():
    H=560; img,d=new(H)
    f=anton(150)
    word="REPRISE"
    wpx=tw(d,word,f)
    x=(W*S-wpx)/2
    d.text((x,150*S),word,font=f,fill=INK)
    # red delta dot on the I? Add a small red square as accent under
    fm=mono(15)
    tag="TRAIN & REHAB — TOGETHER"
    tagw=sum(d.textlength(c,font=fm)+6*S for c in tag)-6*S
    mono_track(d,(W*S-tagw)/2,360*S,tag,fm,RED,6*S)
    # thin rule
    d.rectangle([(W/2-120)*S,410*S,(W/2+120)*S,411.5*S],fill=(10,10,10))
    return img
panels.append(("01 · PRIMARY",panel_primary()))

# ---------- Panel 2: with delta accent (ties to old Δ logo) ----------
def panel_delta():
    H=560; img,d=new(H)
    f=anton(150)
    # REPR  Δ  SE  -> swap the I for a delta? spell RE·PR·I·SE; replace 'I' visually with triangle
    left="REPR"; right="SE"
    fI=f
    lw=tw(d,left,f);
    # delta triangle width approx
    triw=70*S
    gap=6*S
    rw=tw(d,right,f)
    total=lw+gap+triw+gap+rw
    x=(W*S-total)/2; yy=150*S
    d.text((x,yy),left,font=f,fill=INK); x+=lw+gap
    # draw delta (triangle) in red as the 'I'
    th=tw(d,"I",f)  # not used
    tri_h=150*S*0.72
    base_y=yy+150*S*0.92
    cx=x+triw/2
    d.polygon([(cx,base_y-tri_h),(x,base_y),(x+triw,base_y)],fill=RED)
    x+=triw+gap
    d.text((x,yy),right,font=f,fill=INK)
    fm=mono(15)
    tag="CLOSE THE LOOP — PHYSIO & PATIENT"
    tagw=sum(d.textlength(c,font=fm)+5*S for c in tag)-5*S
    mono_track(d,(W*S-tagw)/2,380*S,tag,fm,(10,10,10),5*S)
    return img
panels.append(("02 · DELTA MARK (keeps the Δ)",panel_delta()))

# ---------- Panel 3: stacked / editorial left ----------
def panel_stacked():
    H=620; img,d=new(H)
    f=anton(132)
    fm=mono(15)
    x=90*S
    mono_track(d,x,90*S,"TRAIN · REHAB · TOGETHER",fm,RED,5*S)
    d.text((x,150*S),"REP",font=f,fill=INK)
    d.text((x,290*S),"RISE",font=f,fill=INK)
    # vertical red rule
    d.rectangle([x-28*S,150*S,x-20*S,430*S],fill=RED)
    fm2=mono(14)
    mono_track(d,x,470*S,"TRAIN & REHAB, TOGETHER. CLOSE THE LOOP.",fm2,(10,10,10,255),4*S)
    return img
panels.append(("03 · STACKED / EDITORIAL",panel_stacked()))

# ---------- Panel 4: inverted (dark) ----------
def panel_dark():
    H=560; img,d=new(H,INK)
    f=anton(150)
    word="REPRISE"
    wpx=tw(d,word,f); x=(W*S-wpx)/2
    d.text((x,150*S),word,font=f,fill=PAPER)
    fm=mono(15)
    tag="TRAIN & REHAB — TOGETHER"
    tagw=sum(d.textlength(c,font=fm)+6*S for c in tag)-6*S
    mono_track(d,(W*S-tagw)/2,360*S,tag,fm,RED,6*S)
    d.rectangle([(W/2-120)*S,410*S,(W/2+120)*S,411.5*S],fill=PAPER)
    return img
panels.append(("04 · INVERTED",panel_dark()))

# ---------- compose contact sheet ----------
labelh=54
gap=20
heights=[labelh+p.height//S+gap for _,p in panels]
TOTAL=sum(heights)+40
sheet=Image.new("RGB",(W*S,int(TOTAL*S)),(232,229,222))
sd=ImageDraw.Draw(sheet)
fl=mono(13)
y=20
for (label,p),h in zip(panels,heights):
    # label
    cx=90*S
    for ch in label.upper():
        sd.text((cx,(y+18)*S),ch,font=fl,fill=(120,116,108))
        cx+=sd.textlength(ch,font=fl)+4*S
    sheet.paste(p,(0,int((y+labelh)*S)))
    y+=h
sheet=sheet.resize((W,int(TOTAL)),Image.LANCZOS)
sheet.save("reprise-lockups.png")
print("saved",sheet.size)
