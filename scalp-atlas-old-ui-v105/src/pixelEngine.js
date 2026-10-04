import { toByteArray } from 'base64-js';
import jpeg from 'jpeg-js';

const TF_MIN={M1:1,M2:2,M3:3,M5:5,M10:10,M15:15,M30:30,H1:60};

function regression(a){const n=a.length;if(n<2)return{slope:0,intercept:0};const mx=a.reduce((s,p)=>s+p.x,0)/n,my=a.reduce((s,p)=>s+p.y,0)/n;let num=0,den=0;a.forEach(p=>{num+=(p.x-mx)*(p.y-my);den+=(p.x-mx)**2});const slope=num/(den||1);return{slope,intercept:my-slope*mx}}

function pivots(a,h){const out=[];for(let i=2;i<a.length-2;i++){const p=a[i],near=[...a.slice(i-2,i),...a.slice(i+1,i+3)].map(x=>x.y);const type=p.y<Math.min(...near)-h*.006?'H':p.y>Math.max(...near)+h*.006?'L':null;if(type)out.push({...p,type})}return out.slice(-9)}

function curve(image){
  const{width:w,height:h,data}=image,bins=56,x0=Math.floor(w*.03),x1=Math.floor(w*.82),y0=Math.floor(h*.06),y1=Math.floor(h*.91),bw=(x1-x0)/bins;
  const ys=Math.max(2,Math.floor(h/350)),xs=Math.max(2,Math.floor(w/600)),pts=[];
  for(let b=0;b<bins;b++){const bx0=Math.floor(x0+b*bw),bx1=Math.floor(x0+(b+1)*bw);let sy=0,n=0,lo=1e9,hi=-1;
    for(let x=bx0;x<bx1;x+=xs)for(let y=y0;y<y1;y+=ys){const i=(y*w+x)*4,r=data[i],g=data[i+1],bl=data[i+2],sat=Math.max(r,g,bl)-Math.min(r,g,bl);const green=g>75&&g>r*1.12&&g>bl*.88&&sat>28,red=r>100&&r>g*1.10&&r>bl*1.05&&sat>30;if(green||red){sy+=y;n++;lo=Math.min(lo,y);hi=Math.max(hi,y)}}
    if(n>4)pts.push({x:(bx0+bx1)/2,y:sy/n,lo,hi,span:hi-lo,n});
  }
  const sm=pts.map((p,i)=>{const q=pts.slice(Math.max(0,i-1),Math.min(pts.length,i+2));return{...p,y:q.reduce((s,z)=>s+z.y,0)/q.length}}),coverage=sm.length/bins,density=sm.reduce((s,p)=>s+p.n,0)/Math.max(1,sm.length);
  return{points:sm,w,h,quality:Math.min(1,coverage*.9+Math.min(1,density/60)*.25)};
}

export function analyzeJpeg(base64,timeframe){
  const c=curve(jpeg.decode(toByteArray(base64),{useTArray:true,formatAsRGBA:true})),{points,w,h,quality}=c;
  const chartDetected=points.length>=10&&quality>=.28;
  if(!chartDetected)return{chartDetected:false,validatedPattern:false,quality:Math.round(quality*100)};
  const markerEnd=points.at(-1),markerStart=points[Math.max(0,points.length-4)];
  const markerDelta=markerStart.y-markerEnd.y;
  const liveMarker={x:Math.max(.04,Math.min(.96,markerEnd.x/w)),y:Math.max(.04,Math.min(.96,markerEnd.y/h)),direction:markerDelta>=0?'UP':'DOWN'};
  const full=regression(points),recent=regression(points.slice(-Math.max(8,Math.floor(points.length*.38)))),micro=regression(points.slice(-Math.max(5,Math.floor(points.length*.18))));
  const norm=-full.slope*w/h,rn=-recent.slope*w/h,mn=-micro.slope*w/h,last=(points[Math.max(0,points.length-4)].y-points.at(-1).y)/h;
  let buy=0,sell=0;const vote=(v,t,k)=>{if(v>t)buy+=k;else if(v<-t)sell+=k};vote(norm,.06,1);vote(rn,.04,1.45);vote(mn,.03,1.75);vote(last,.02,1.65);
  const total=buy+sell,consensus=Math.abs(buy-sell)/Math.max(.001,total);if(total<2.2||consensus<.22)return{chartDetected:true,validatedPattern:false,quality:Math.round(quality*100),liveMarker};
  const direction=buy>sell?'BUY':'SELL',pv=pivots(points,h),highs=pv.filter(p=>p.type==='H'),lows=pv.filter(p=>p.type==='L');
  const sign=direction==='BUY'?1:-1;
  const momentumAligned=sign*rn>.04&&sign*mn>.03&&sign*last>.02;
  if(!momentumAligned)return{chartDetected:true,validatedPattern:false,quality:Math.round(quality*100),liveMarker,rejectionReason:'MOMENTUM_CONFLICT'};
  const third=Math.max(4,Math.floor(points.length/3)),first=points.slice(0,third),lastThird=points.slice(-third);
  const span1=first.reduce((s,p)=>s+p.span,0)/first.length,span2=lastThird.reduce((s,p)=>s+p.span,0)/lastThird.length;
  const narrowing=span2<span1*.78,expanding=span2>span1*1.22,end=points.at(-1),pred=full.slope*end.x+full.intercept,deviation=(end.y-pred)/h;
  const breakoutUp=deviation<-.045&&rn>norm+.12&&mn>.09,breakoutDown=deviation>.045&&rn<norm-.12&&mn<-.09;
  let patternName=Math.abs(norm)>.055?(direction==='BUY'?'Canal Ascendent':'Canal Descendent'):(direction==='BUY'?'1-2-3 Bottom':'1-2-3 Top');
  if(direction==='SELL'&&highs.length>=2&&Math.abs(highs.at(-1).y-highs.at(-2).y)<h*.035)patternName='Dublu Maxim';
  if(direction==='BUY'&&lows.length>=2&&Math.abs(lows.at(-1).y-lows.at(-2).y)<h*.035)patternName='Dublu Minim';
  if(direction==='SELL'&&highs.length>=3&&Math.max(...highs.slice(-3).map(p=>p.y))-Math.min(...highs.slice(-3).map(p=>p.y))<h*.045)patternName='Triplu Maxim';
  if(direction==='BUY'&&lows.length>=3&&Math.max(...lows.slice(-3).map(p=>p.y))-Math.min(...lows.slice(-3).map(p=>p.y))<h*.045)patternName='Triplu Minim';
  if(narrowing&&(breakoutUp||breakoutDown))patternName='Wedge + Breakout';
  else if(breakoutUp&&direction==='BUY')patternName='Breakout Rezistență';
  else if(breakoutDown&&direction==='SELL')patternName='Breakout Suport';
  else if(narrowing)patternName=direction==='BUY'?'Wedge Ascendent':'Wedge Descendent';
  else if(expanding)patternName='Triunghi Expanding';
  if(pv.length>=5){const q=pv.slice(-5),types=q.map(p=>p.type).join('');if(types==='HLHLH'){const[s1,n1,head,n2,s2]=q;if(Math.abs(s1.y-s2.y)<h*.045&&Math.abs(n1.y-n2.y)<h*.065&&head.y<Math.min(s1.y,s2.y)-h*.03&&direction==='SELL')patternName='Head & Shoulders'}else if(types==='LHLHL'){const[s1,n1,head,n2,s2]=q;if(Math.abs(s1.y-s2.y)<h*.045&&Math.abs(n1.y-n2.y)<h*.065&&head.y>Math.max(s1.y,s2.y)+h*.03&&direction==='BUY')patternName='Head & Shoulders inversat'}}
  let score=.48+quality*.18+consensus*.20;if(Math.sign(mn)!==Math.sign(rn))score-=.08;score=Math.max(.44,Math.min(.93,score));if(score<.61)return{chartDetected:true,validatedPattern:false,quality:Math.round(quality*100),liveMarker};
  const base=TF_MIN[timeframe]||5,mult=score>=.82?1:score>=.72?1.25:1.5;
  const probability=Math.round(score*100);
  const expiryMinutes=Math.max(1,Math.round(base*mult));
  const durationLow=Math.max(1,Math.round(base*(probability>=82?1.2:1)));
  const durationHigh=Math.max(durationLow+1,Math.round(base*(probability>=82?2.4:probability>=72?2:1.6)));
  return{chartDetected:true,validatedPattern:true,direction,patternName,probability,expiry:`${expiryMinutes} minute`,directionDuration:`${durationLow}–${durationHigh} minute`,quality:Math.round(quality*100),liveMarker};
}
