from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, os, random, subprocess, wave
import numpy as np

W,H,FPS,DURATION = 1280,720,24,30
OUTDIR = os.path.join(os.path.dirname(__file__), 'assets')
FRAMES = os.path.join(OUTDIR, '_frames')
os.makedirs(FRAMES, exist_ok=True)

FONT_REG='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(size,bold=False): return ImageFont.truetype(FONT_BOLD if bold else FONT_REG,size)

def bg_frame(t):
    img=Image.new('RGB',(W,H),(7,11,18)); d=ImageDraw.Draw(img)
    # subtle horizon glow
    for i in range(220,0,-8):
        a=i/220
        y=360
        col=(7+int(7*a),11+int(18*a),18+int(34*a))
        d.ellipse((W*0.05-i*3,y-i,W*0.95+i*3,y+i),fill=col)
    # digital particles / world-network feeling
    rnd=random.Random(42)
    pts=[]
    for _ in range(90):
        x=rnd.randint(30,W-30); y=rnd.randint(40,360); r=rnd.choice([1,1,1,2])
        pulse=.45+.55*math.sin(t*1.7+x*.014+y*.009)
        c=(35+int(45*pulse),80+int(70*pulse),125+int(105*pulse))
        d.ellipse((x-r,y-r,x+r,y+r),fill=c); pts.append((x,y))
    for i in range(0,len(pts)-3,7):
        a=pts[i]; b=pts[i+3]
        d.line((a,b),fill=(18,43,68),width=1)
    return img

def gradient_text(draw,xy,text,size):
    x,y=xy; f=font(size,True)
    # segmented neon title
    colors=[(95,226,255),(99,126,255),(194,100,255),(255,75,207)]
    cursor=x
    for idx,ch in enumerate(text):
        c=colors[min(3,int(idx/max(1,len(text)-1)*4))]
        draw.text((cursor,y),ch,font=f,fill=c)
        cursor += draw.textlength(ch,font=f)

def phone(draw,x,y,w,h,scene_t,mode='chart'):
    draw.rounded_rectangle((x,y,x+w,y+h),radius=34,fill=(16,24,36),outline=(55,72,94),width=2)
    sx,sy=x+16,y+18; sw,sh=w-32,h-36
    draw.rounded_rectangle((sx,sy,sx+sw,sy+sh),radius=24,fill=(5,8,14),outline=(31,43,57),width=2)
    gradient_text(draw,(sx+24,sy+22),'SCALP ATLAS',28)
    draw.text((sx+24,sy+58),'70 models • Camera + Gallery • Atlas Engine',font=font(12),fill=(125,139,158))
    tfs=['M1','M2','M3','M5','M10','M15','M30','H1']; tx=sx+24
    for i,tf in enumerate(tfs):
        tw=42 if len(tf)==2 else 48
        fill=(241,245,249) if i==0 else (12,20,31); txt=(9,13,20) if i==0 else (145,160,180)
        draw.rounded_rectangle((tx,sy+84,tx+tw,sy+114),radius=8,fill=fill,outline=(38,51,71),width=1)
        draw.text((tx+8,sy+91),tf,font=font(11,True),fill=txt); tx+=tw+6
    draw.rounded_rectangle((sx+24,sy+130,sx+sw/2-6,sy+172),radius=11,fill=(241,245,249)); draw.text((sx+65,sy+143),'CAMERA',font=font(13,True),fill=(9,13,20))
    draw.rounded_rectangle((sx+sw/2+6,sy+130,sx+sw-24,sy+172),radius=11,fill=(12,20,31),outline=(73,86,109),width=1); draw.text((sx+sw/2+50,sy+143),'GALLERY',font=font(13,True),fill=(235,242,249))
    cx0,cy0,cx1,cy1=sx+24,sy+188,sx+sw-24,sy+390
    draw.rounded_rectangle((cx0,cy0,cx1,cy1),radius=14,fill=(7,12,20),outline=(27,38,52),width=1)
    for gy in range(cy0+40,cy1,40): draw.line((cx0,gy,cx1,gy),fill=(15,27,40),width=1)
    for gx in range(cx0+55,cx1,55): draw.line((gx,cy0,gx,cy1),fill=(15,27,40),width=1)
    # animated pseudo candles
    points=[]
    n=27
    for i in range(n):
        xx=cx0+16+i*(cx1-cx0-34)/(n-1)
        trend=cy1-55-i*3.8 + 28*math.sin(i*.73+scene_t*.7)
        yy=max(cy0+24,min(cy1-28,trend)); points.append((xx,yy))
        bullish=(i%4)!=1; col=(71,222,139) if bullish else (244,99,102)
        body=10+8*abs(math.sin(i*1.2))
        draw.line((xx,yy-body-12,xx,yy+body+12),fill=col,width=2)
        draw.rectangle((xx-4,yy-body,xx+4,yy+body),fill=col)
    if mode=='analyze':
        scan=cx0+((scene_t*110)%(cx1-cx0))
        draw.rectangle((scan-4,cy0,scan+4,cy1),fill=(45,165,255))
        for q in [5,13,22]:
            px,py=points[q]; draw.ellipse((px-11,py-11,px+11,py+11),outline=(95,226,255),width=3)
        draw.text((cx0+15,cy0+12),'ANALYZING STRUCTURE…',font=font(13,True),fill=(133,220,255))
    if mode=='buy':
        px,py=points[-1]; draw.polygon([(px+8,py-25),(px+24,py-45),(px+40,py-25),(px+31,py-25),(px+31,py),(px+17,py),(px+17,py-25)],fill=(70,225,142))
    if mode=='sell':
        px,py=points[-1]; draw.polygon([(px+8,py+25),(px+24,py+45),(px+40,py+25),(px+31,py+25),(px+31,py),(px+17,py),(px+17,py+25)],fill=(244,91,105))
    return (sx,sy,sw,sh)

def title(draw,text,sub=None,accent=None):
    draw.text((70,115),text,font=font(48,True),fill=(239,245,252))
    if sub: draw.text((72,180),sub,font=font(22),fill=accent or (130,157,190))

def scene(frame_idx):
    t=frame_idx/FPS; local=t%5
    img=bg_frame(t); d=ImageDraw.Draw(img)
    # gentle camera zoom feel via coordinates
    pulse=1+0.01*math.sin(local*.9)
    if t<5:
        gradient_text(d,(70,225),'SCALP ATLAS',64)
        d.text((74,306),'SMART CHART ANALYSIS',font=font(24,True),fill=(174,197,222))
        d.text((74,348),'Capture • Analyze • Decide',font=font(18),fill=(115,133,156))
        phone(d,735,90,450,560,local,'chart')
    elif t<10:
        title(d,'CAPTURE OR UPLOAD','Camera + Gallery • M1 → H1')
        phone(d,690,80,470,570,local,'chart')
        d.text((72,260),'Choose timeframe',font=font(24,True),fill=(95,226,255)); d.text((72,300),'Load a clean chart image',font=font(20),fill=(158,176,198))
    elif t<15:
        title(d,'ANALYZING STRUCTURE…','70 SCALPING MODELS',(95,226,255))
        phone(d,690,80,470,570,local,'analyze')
        d.text((72,275),'Pattern scan',font=font(22,True),fill=(185,204,224)); d.text((72,315),'Trend • pivots • structure',font=font(19),fill=(131,150,175))
    elif t<20:
        title(d,'CLEAR SIGNAL','CLEAR TIMING',(88,226,148))
        phone(d,690,80,470,570,local,'buy')
        d.text((72,270),'BUY ↑',font=font(50,True),fill=(80,225,143)); d.text((72,335),'Probability: 78%',font=font(24),fill=(227,237,247)); d.text((72,375),'Recommended expiry: 3 MIN',font=font(24),fill=(111,198,255))
    elif t<25:
        title(d,'TIMEFRAME ≠ EXPIRY','Recommended expiry')
        mapping=[('M1','3 MIN'),('M2','6 MIN'),('M3','9 MIN'),('M5','12 MIN'),('M10','15 MIN')]
        yy=245
        for a,b in mapping:
            d.rounded_rectangle((80,yy,230,yy+48),radius=12,fill=(16,29,45),outline=(40,63,89),width=1); d.text((105,yy+11),a,font=font(20,True),fill=(123,204,255)); d.text((278,yy+11),'→',font=font(22,True),fill=(99,126,255)); d.text((335,yy+11),b,font=font(20,True),fill=(235,241,248)); yy+=58
        phone(d,730,95,420,530,local,'chart')
    else:
        title(d,'BUY • SELL • NO CLEAR SIGNAL','Built for disciplined analysis')
        phone(d,695,82,470,565,local,'sell')
        d.text((72,265),'SELL ↓',font=font(42,True),fill=(244,91,105)); d.text((72,323),'or wait when structure is unclear',font=font(19),fill=(162,179,201)); d.text((72,420),'SCALP ATLAS',font=font(34,True),fill=(239,245,252)); d.text((72,465),'COMING SOON',font=font(23,True),fill=(103,152,255))
    # frame label
    d.text((W-145,H-32),f'{min(6,int(t//5)+1)}/6',font=font(12,True),fill=(82,103,128))
    return img

for i in range(FPS*DURATION):
    scene(i).save(os.path.join(FRAMES,f'f_{i:04d}.jpg'),quality=88,optimize=True)

# Original electronic music bed
sr=48000; n=sr*DURATION; tt=np.arange(n)/sr; audio=np.zeros(n,dtype=np.float64)
chords=[[110,164.81,220],[130.81,196,261.63],[146.83,220,293.66],[98,146.83,196]]
for ci,fre in enumerate(chords):
    a=int(ci*7.5*sr); b=int((ci+1)*7.5*sr); x=np.arange(b-a)/sr
    env=np.minimum(np.minimum(1,x/1.2),np.minimum(1,(7.5-x)/1.2)); pad=np.zeros_like(x)
    for j,f in enumerate(fre): pad += np.sin(2*np.pi*f*x+j*.4)/(j+1)
    audio[a:b]+=0.12*env*pad
bpm=110; beat=60/bpm
for k in range(int(DURATION/beat)+1):
    a=int(k*beat*sr); l=int(.28*sr)
    if a+l>=n: break
    x=np.arange(l)/sr; audio[a:a+l]+=0.18*np.exp(-x*10)*np.sin(2*np.pi*(55+35*np.exp(-x*18))*x)
rng=np.random.default_rng(26)
for k in range(int(DURATION/(beat/2))+1):
    a=int(k*(beat/2)*sr); l=int(.05*sr)
    if a+l>=n: break
    x=np.arange(l)/sr; noise=rng.normal(0,1,l); noise=np.concatenate([[0],np.diff(noise)]); audio[a:a+l]+=0.016*np.exp(-x*60)*noise
fade=np.ones(n); fade[:sr]=np.linspace(0,1,sr); fade[-sr:]=np.linspace(1,0,sr); audio*=fade; audio/=max(1,np.max(np.abs(audio))/.72)
st=np.stack([audio,np.roll(audio,53)*.985],axis=1); pcm=(st*32767).astype(np.int16)
wav_path=os.path.join(OUTDIR,'demo_music.wav')
with wave.open(wav_path,'wb') as wf: wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(sr); wf.writeframes(pcm.tobytes())

out=os.path.join(OUTDIR,'scalp-atlas-demo.mp4')
subprocess.run(['ffmpeg','-y','-framerate',str(FPS),'-i',os.path.join(FRAMES,'f_%04d.jpg'),'-i',wav_path,'-c:v','libx264','-preset','veryfast','-crf','27','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',out],check=True)
print(out)
