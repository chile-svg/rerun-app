#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont

BG=(13,17,23); BAR=(22,27,34); GRAY=(201,209,217)
AMBER=(240,166,94); MINT=(126,231,135); DIM=(125,133,144)
GREEN=(63,185,80)

MR="/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
MB="/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
EMO="/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
S=2
def f(p,sz): return ImageFont.truetype(p,int(sz*S))
fc=f(MR,25); fb=f(MB,28); ftitle=f(MB,28)
_ef=ImageFont.truetype(EMO,109)
def emoji(ch,px):
    px=int(px); c=Image.new("RGBA",(137,137),(0,0,0,0))
    ImageDraw.Draw(c).text((0,0),ch,font=_ef,embedded_color=True)
    b=c.getbbox();  c=c.crop(b) if b else c
    return c.resize((px,px),Image.LANCZOS)

# (role, text)  roles: i=instr gray, l=label amber bold, j=json mint, b=bullet
P=[
 ("i","Make me a beginner general-fitness plan as JSON"),
 ("i","for the REPCO app. Output ONLY valid JSON —"),
 ("i","no extra text."),
 ("g",""),
 ("i","About me: pretty sedentary, easing back in. I"),
 ("i","know basic gym moves (squats, lunges, dumbbell"),
 ("i","press, rows) but nothing fancy. Goal = general"),
 ("i","strength + cardio + building a habit. 4 weeks,"),
 ("i","starting 2026-06-01, 3 days/week. Start gentle"),
 ("i","and build up. No barbell or scary lifts. Put a"),
 ("i","short friendly form/safety cue in \"notes\" on"),
 ("i","EVERY exercise."),
 ("g",""),
 ("l","Use exactly this shape:"),
 ("j","{"),
 ("j","  \"meta\": { \"title\": \"FITNESS PLAN\","),
 ("j","             \"period\": \"Jun 2026\" },"),
 ("j","  \"days\": ["),
 ("j","    { \"date\": \"2026-06-01\","),
 ("j","      \"type\": \"strength\","),
 ("j","      \"title\": \"Full Body A\","),
 ("j","      \"exercises\": ["),
 ("j","        { \"name\": \"Bodyweight squat\","),
 ("j","          \"sets\": 2, \"reps\": 10,"),
 ("j","          \"notes\": \"Sit back like into a"),
 ("j","           chair, only as low as comfy.\" }"),
 ("j","      ] },"),
 ("j","    { \"date\": \"2026-06-03\","),
 ("j","      \"type\": \"easy\", \"title\": \"Cardio\","),
 ("j","      \"exercises\": ["),
 ("j","        { \"name\": \"Brisk walk\","),
 ("j","          \"reps\": \"20 min\","),
 ("j","          \"notes\": \"Talk-not-sing pace.\" }"),
 ("j","      ] }"),
 ("j","  ]"),
 ("j","}"),
 ("g",""),
 ("l","Rules:"),
 ("b","\"days\" = one object per workout day."),
 ("b","\"date\" required (YYYY-MM-DD)."),
 ("b","\"type\" = strength, easy (cardio), recovery,"),
 ("i","  rest."),
 ("b","every exercise needs \"name\"; sets / reps /"),
 ("i","  weight / notes optional (notes on all!)."),
 ("b","reps can be a number or text (\"30 min\")."),
 ("b","week 1 easiest, build to week 4."),
 ("b","full 4 weeks, valid JSON only."),
]

W=1040; PAD=46; LH=34; TOPBAR=92
H=TOPBAR+PAD+len(P)*LH+PAD
img=Image.new("RGB",(W*S,H*S),BG); d=ImageDraw.Draw(img)

# header bar
d.rectangle([0,0,W*S,TOPBAR*S],fill=BAR)
for i,col in enumerate([(255,95,86),(255,189,46),(39,201,63)]):
    cx=(PAD+i*30)*S; cy=(TOPBAR/2)*S; r=9*S
    d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=col)
tt="prompt for your AI"
d.text(((PAD+120)*S,(TOPBAR/2-16)*S),tt,font=ftitle,fill=GRAY)
e=emoji("🤖",30*S)
img.paste(e,(int((PAD+120)*S+d.textlength(tt,font=ftitle)+14*S),int((TOPBAR/2-16)*S)),e)

y=(TOPBAR+PAD)*S
for role,txt in P:
    x=PAD*S
    if role=="i": d.text((x,y),txt,font=fc,fill=GRAY)
    elif role=="l": d.text((x,y),txt,font=fb,fill=AMBER)
    elif role=="j": d.text((x,y),txt,font=fc,fill=MINT)
    elif role=="b":
        d.text((x,y),"▸",font=fc,fill=GREEN)
        d.text((x+26*S,y),txt,font=fc,fill=GRAY)
    y+=LH*S

img=img.resize((W,H),Image.LANCZOS)
img.save("/home/user/rerun-app/ai-prompt.png")
print("saved",img.size)
