#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont

BG=(250,248,245); INK=(15,15,15); MUTED=(110,108,104)
ACCENT=(16,185,129); ACCENT2=(245,158,11); CARD=(255,255,255)

FB="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
EMO="/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"

W=1080; PAD=70; S=2  # supersample
def f(p,sz): return ImageFont.truetype(p,sz)

# logical font sizes
SZ={'title':60,'sub':30,'num':40,'head':38,'body':30,'url':29,'foot':34,'tag':24}
def F(role,bold=True):
    return f(FB if bold else FR, int(SZ[role]*S))

_emoji_font=f(EMO,109)
_emoji_cache={}
def emoji_img(ch,px):
    px=int(px)
    key=(ch,px)
    if key in _emoji_cache: return _emoji_cache[key]
    c=Image.new("RGBA",(137,137),(0,0,0,0))
    ImageDraw.Draw(c).text((0,0),ch,font=_emoji_font,embedded_color=True)
    bbox=c.getbbox()
    if bbox: c=c.crop(bbox)
    c=c.resize((px,px),Image.LANCZOS)
    _emoji_cache[key]=c
    return c

_mimg=Image.new("RGB",(10,10)); _md=ImageDraw.Draw(_mimg)
def tw(s,fnt): return _md.textlength(s,font=fnt)

img=Image.new("RGB",(W*S, 4000),BG)
d=ImageDraw.Draw(img)
def sc(t): return tuple(int(v*S) for v in t)

y=PAD*S

# top accent bar
d.rectangle([0,0,W*S,14*S],fill=ACCENT)

# tag
d.text((PAD*S,y),"REPCO  ·  YOUR POCKET COACH",font=F('tag'),fill=ACCENT); y+=44*S
# title
fT=F('title')
d.text((PAD*S,y),"Let's get you",font=fT,fill=INK); y+=70*S
mv="moving "
d.text((PAD*S,y),mv,font=fT,fill=INK)
em=emoji_img("💪",SZ['title']*S)
img.paste(em,(int(PAD*S+tw(mv,fT)),int(y)),em)
y+=84*S
d.text((PAD*S,y),"Your phone is the coach now. 3 little steps:",font=F('sub',False),fill=MUTED); y+=70*S

steps=[
 ("1","Open it","📲",
  ["Tap the link, then \"Add to Home","Screen\" so it lives with your apps."],
  "https://rerun-app-production.up.railway.app/"),
 ("2","Ask AI for a plan","🤖",
  ["Send the prompt (in my next message)","to ChatGPT, Claude, or Gemini.","It writes your workout as JSON."],
  None),
 ("3","Save + import","✅",
  ["Save its reply as plan.json, tap","Import in the app — boom, you're in."],
  None),
]

fH=F('head'); fBd=F('body',False); fU=F('url'); fN=F('num')
for num,head,emo,lines,url in steps:
    inner=(PAD+110)*S
    ch=40+50+len(lines)*40+(70 if url else 0)+36
    cy=y
    d.rounded_rectangle([PAD*S,cy,(W-PAD)*S,cy+ch*S],radius=28*S,fill=CARD)
    # number circle
    cx0=(PAD+34)*S; cyy=cy+34*S; dia=62*S
    d.ellipse([cx0,cyy,cx0+dia,cyy+dia],fill=ACCENT)
    d.text((cx0+dia/2,cyy+dia/2),num,font=fN,fill=(255,255,255),anchor="mm")
    ty=cy+38*S
    d.text((inner,ty),head,font=fH,fill=INK)
    e=emoji_img(emo,SZ['head']*S)
    img.paste(e,(int(inner+tw(head,fH)+14*S),int(ty)),e)
    ty+=56*S
    for ln in lines:
        d.text((inner,ty),ln,font=fBd,fill=MUTED); ty+=40*S
    if url:
        ty+=8*S
        uw=tw(url,fU)
        d.rounded_rectangle([inner-12*S,ty-6*S,inner+uw+24*S,ty+44*S],radius=16*S,fill=(236,253,245))
        d.text((inner,ty),url,font=fU,fill=(6,120,90))
    y=cy+ch*S+34*S

# footer
y+=6*S
fF=F('foot')
foot_lines=["No barbells, no pressure. Start gentle —","week 1 is the easy one. You've got this!"]
for ln in foot_lines:
    w=tw(ln,fF)
    d.text((W*S/2-w/2,y),ln,font=fF,fill=INK); y+=46*S
# party emoji centered under
pe=emoji_img("🎉",44*S)
img.paste(pe,(int(W*S/2-22*S),int(y)),pe); y+=44*S+30*S
d.rectangle([0,y,W*S,y+14*S],fill=ACCENT2); y+=14*S

img=img.crop((0,0,W*S,int(y)))
img=img.resize((W,int(y/S)),Image.LANCZOS)
img.save("/home/user/rerun-app/getting-started.png")
print("saved",img.size)
