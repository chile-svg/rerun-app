#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont

PAPER=(245,243,238); INK=(10,10,10); RED=(200,32,43)
A=".fonts/Anton.ttf"; M=".fonts/JBMono.ttf"
S=3
def anton(sz): return ImageFont.truetype(A,int(sz*S))
def mono(sz):
    f=ImageFont.truetype(M,int(sz*S))
    try: f.set_variation_by_axes([700])
    except: pass
    return f
W=1080
def new(h,bg=PAPER): img=Image.new("RGB",(W*S,int(h*S)),bg); return img,ImageDraw.Draw(img)
def tw(d,s,f): return d.textlength(s,font=f)
def mono_track(d,x,y,s,f,fill,track):
    cx=x
    for ch in s:
        d.text((cx,y),ch,font=f,fill=fill); cx+=d.textlength(ch,font=f)+track
    return cx
def tag_centered(d,y,s,f,fill,track):
    tagw=sum(d.textlength(c,font=f)+track for c in s)-track
    mono_track(d,(W*S-tagw)/2,y,s,f,fill,track)

panels=[]

# 01 PRIMARY
def p1():
    img,d=new(560); f=anton(150); word="REPCO"
    x=(W*S-tw(d,word,f))/2; d.text((x,150*S),word,font=f,fill=INK)
    tag_centered(d,360*S,"TRAIN & REHAB — TOGETHER",mono(15),RED,6*S)
    d.rectangle([(W/2-120)*S,410*S,(W/2+120)*S,411.5*S],fill=INK)
    return img
panels.append(("01 · PRIMARY",p1()))

# 02 LOOP MARK — the O becomes a red ring (close the loop)
def p2():
    img,d=new(560); f=anton(150)
    left="REPC"
    cap=f.getbbox("R")  # (x0,y0,x1,y1)
    caph=cap[3]-cap[1]
    ring=caph*1.0
    gap=10*S
    lw=tw(d,left,f)
    total=lw+gap+ring
    x=(W*S-total)/2; yy=150*S
    d.text((x,yy),left,font=f,fill=INK)
    rx=x+lw+gap
    ry=yy+cap[1]
    stroke=int(ring*0.20)
    d.ellipse([rx,ry,rx+ring,ry+ring],outline=RED,width=stroke)
    tag_centered(d,380*S,"CLOSE THE LOOP — PHYSIO & PATIENT",mono(15),INK,5*S)
    return img
panels.append(("02 · LOOP MARK (O = the loop)",p2()))

# 03 STACKED — CO in red to stress collaboration
def p3():
    img,d=new(620); f=anton(132); x=90*S
    mono_track(d,x,90*S,"TRAIN · REHAB · TOGETHER",mono(15),RED,5*S)
    d.text((x,150*S),"REP",font=f,fill=INK)
    d.text((x,290*S),"CO",font=f,fill=RED)
    d.rectangle([x-28*S,150*S,x-20*S,430*S],fill=RED)
    mono_track(d,x,470*S,"REPS YOU SHARE. PROGRESS YOU CLOSE TOGETHER.",mono(14),INK,4*S)
    return img
panels.append(("03 · STACKED — 'CO' = COLLAB",p3()))

# 04 INVERTED — CO highlighted
def p4():
    img,d=new(560,INK); f=anton(150)
    a="REP"; b="CO"
    total=tw(d,a,f)+tw(d,b,f)
    x=(W*S-total)/2; yy=150*S
    d.text((x,yy),a,font=f,fill=PAPER); x+=tw(d,a,f)
    d.text((x,yy),b,font=f,fill=RED)
    tag_centered(d,360*S,"TRAIN & REHAB — TOGETHER",mono(15),PAPER,6*S)
    d.rectangle([(W/2-120)*S,410*S,(W/2+120)*S,411.5*S],fill=PAPER)
    return img
panels.append(("04 · INVERTED",p4()))

# contact sheet
labelh=54; gap=20
heights=[labelh+p.height//S+gap for _,p in panels]
TOTAL=sum(heights)+40
sheet=Image.new("RGB",(W*S,int(TOTAL*S)),(232,229,222)); sd=ImageDraw.Draw(sheet)
fl=mono(13); y=20
for (label,p),h in zip(panels,heights):
    cx=90*S
    for ch in label.upper():
        sd.text((cx,(y+18)*S),ch,font=fl,fill=(120,116,108)); cx+=sd.textlength(ch,font=fl)+4*S
    sheet.paste(p,(0,int((y+labelh)*S))); y+=h
sheet=sheet.resize((W,int(TOTAL)),Image.LANCZOS)
sheet.save("repco-lockups.png"); print("saved",sheet.size)
