#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw, ImageFont

BG=(250,248,245); INK=(20,20,20); MUTED=(108,106,102)
EMERALD=(16,185,129); AMBER=(217,119,6); SOFT=(236,253,245)

FB="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FO="/usr/share/fonts/truetype/freefont/FreeSansOblique.ttf"
EMO="/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
S=2
def f(p,sz): return ImageFont.truetype(p,int(sz*S))
_ef=ImageFont.truetype(EMO,109)
def emoji(ch,px):
    px=int(px); c=Image.new("RGBA",(137,137),(0,0,0,0))
    ImageDraw.Draw(c).text((0,0),ch,font=_ef,embedded_color=True)
    b=c.getbbox(); c=c.crop(b) if b else c
    return c.resize((px,px),Image.LANCZOS)

_mi=Image.new("RGB",(8,8)); _md=ImageDraw.Draw(_mi)
def tw(s,fnt): return _md.textlength(s,font=fnt)
def wrap(s,fnt,maxw):
    out=[];
    for para in s.split("\n"):
        words=para.split(" "); cur=""
        for w in words:
            t=(cur+" "+w).strip()
            if tw(t,fnt)<=maxw: cur=t
            else:
                if cur: out.append(cur)
                cur=w
        out.append(cur)
    return out

W=1080; PAD=84
f_kick=f(FB,27); f_head=f(FB,58); f_sub=f(FO,31); f_bul=f(FR,35); f_brand=f(FB,26); f_pg=f(FB,26)

def card(path, kicker, heading, subtitle, bullets, emo, tone, page):
    acc = AMBER if tone=="warn" else EMERALD
    img=Image.new("RGB",(W*S,W*S),BG); d=ImageDraw.Draw(img)
    d.rectangle([0,0,W*S,14*S],fill=EMERALD)            # top bar
    # emoji badge top-right
    eb=emoji(emo,108*S); img.paste(eb,(int((W-PAD-108)*S),int(70*S)),eb)
    y=78*S
    d.text((PAD*S,y),kicker.upper(),font=f_kick,fill=acc); y+=58*S
    for ln in wrap(heading,f_head,(W-2*PAD-130)*S):
        d.text((PAD*S,y),ln,font=f_head,fill=INK); y+=70*S
    y+=10*S
    if subtitle:
        for ln in wrap(subtitle,f_sub,(W-2*PAD)*S):
            d.text((PAD*S,y),ln,font=f_sub,fill=MUTED); y+=42*S
        y+=24*S
    else:
        y+=14*S
    for b in bullets:
        d.text((PAD*S,y-2*S),"▸",font=f_bul,fill=acc)
        lines=wrap(b,f_bul,(W-2*PAD-46)*S)
        for i,ln in enumerate(lines):
            d.text(((PAD+44)*S,y),ln,font=f_bul,fill=INK if i==0 else (70,70,70)); y+=46*S
        y+=20*S
    # footer
    d.rectangle([0,(W-14)*S,W*S,W*S],fill=EMERALD)
    d.text((PAD*S,(W-58)*S),"REPC",font=f_brand,fill=INK)
    d.text((PAD*S+tw("REPC",f_brand),(W-58)*S),"O",font=f_brand,fill=(200,32,43))
    pg=page
    d.text(((W-PAD)*S-tw(pg,f_pg),(W-58)*S),pg,font=f_pg,fill=MUTED)
    img=img.resize((W,W),Image.LANCZOS); img.save(path);

os.makedirs("pitch",exist_ok=True)

physio=[
 ("For physios","Get your rehab actually done.",
  "REPCO — a phone app that turns your prescription into a daily, visual checklist your patient will actually open.",
  ["Built for runners juggling rehab, strength and mileage",
   "You write the plan; they follow it on their phone",
   "Early prototype — I want your expert eyes on it"],"🩹","ok"),
 ("The problem","Handouts disappear.","",
  ["Paper and PDF exercise sheets get lost or ignored",
   "Patients forget the form the moment they walk out",
   "You have no visibility into what they actually did",
   "Adherence quietly wrecks outcomes — and it's invisible"],"😣","ok"),
 ("What it does today","Prescription to daily checklist.","",
  ["Each exercise shows sets, reps, weight + a reference picture and video",
   "Patient ticks off work and leaves feedback notes per session",
   "Lives on their home screen, works offline, data stays on their device",
   "You author a plan in plain language; it structures it for you",
   "Update the plan anytime — their logged history is kept"],"✅","ok"),
 ("What it can't do yet","Honest limits.","",
  ["No accounts or cloud — sharing is a manual file, no live link or chat",
   "Reference pictures come from an open library — not clinically validated",
   "No pain-scale, RPE or asymmetry logging yet",
   "No analytics, load monitoring or injury-risk metrics",
   "Not a medical device"],"⚠️","warn"),
 ("What I'd love you to try","Poke holes in it.","",
  ["Can you express a real prescription? (tempo, holds, progressions, cues)",
   "Are the exercise pics and videos accurate — or misleading anywhere?",
   "Would handing a patient this beat your current handout?",
   "What ONE thing is missing to use it with a real patient?"],"🔍","ok"),
 ("Giving feedback","Be brutal.","",
  ["15 minutes with the getting-started guide (I'll send it)",
   "Tell me the one thing that'd make you use it — and the one that'd make you quit",
   "Honesty beats politeness. Everything is on the table."],"📝","ok"),
]

runner=[
 ("For runners","Runs and rehab, one place.",
  "REPCO — your whole training block as a daily, tap-through checklist on your phone.",
  ["Runs, strength and the rehab you keep skipping — together",
   "Plans written by AI (or your coach); you just follow",
   "Early prototype — I want your honest take"],"🏃","ok"),
 ("The problem","It's scattered everywhere.","",
  ["Run plan in one app, rehab on a PDF, strength in your head",
   "The prehab and rehab always get skipped first",
   "Generic apps are rigid and subscription-heavy",
   "You never log it, so there's no feedback loop"],"🤯","ok"),
 ("What it does today","Your week, tap by tap.","",
  ["Day view: runs (distance + pace zones) and rehab/strength (sets, reps, weight)",
   "Reference picture and video on every exercise",
   "Tick off sessions and add quick feedback notes",
   "Installs to your home screen, works offline, data stays private",
   "Get an AI to write the whole plan from plain language — import in one tap"],"✅","ok"),
 ("What it can't do yet","Honest limits.","",
  ["No Garmin / Strava / Apple Health / GPS — logging is manual",
   "No accounts or cloud sync — one device, no auto-backup",
   "No auto-progression — it's only as smart as the plan you feed it",
   "Exercise pictures from an open library — can mismatch"],"⚠️","warn"),
 ("What I'd love you to try","Take it for a run.","",
  ["Did importing an AI-written plan actually work and feel useful?",
   "Is the day view clear and motivating with runs + rehab together?",
   "Would you really log here vs. your watch or Strava? Why or why not?",
   "What would make you ditch your current setup?"],"🧪","ok"),
 ("Giving feedback","Tell me straight.","",
  ["15 minutes with the getting-started guide (I'll send it)",
   "The one thing that'd make you keep using it — and the one that'd make you quit",
   "Brutal honesty beats politeness. Early days."],"📝","ok"),
]

for i,(k,h,s,b,e,t) in enumerate(physio,1):
    card(f"pitch/physio-{i}.png",k,h,s,b,e,t,f"{i}/6")
for i,(k,h,s,b,e,t) in enumerate(runner,1):
    card(f"pitch/runner-{i}.png",k,h,s,b,e,t,f"{i}/6")
print("done")
