from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.25 — SMART CANDLE CHANNEL / CULOARUL LUMÂNĂRILOR
# - detectează automat canal ascendent / descendent / orizontal pe structura recentă;
# - trasează două margini albastre paralele + mediană punctată;
# - arată poziția prețului în canal (superioară / mediană / inferioară);
# - folosește canalul ca gardă de intrare: BUY aproape de marginea de sus sau SELL
#   aproape de marginea de jos devine WAIT dacă nu este breakout;
# - păstrează Timeframe AUTO, retest guard și toate filtrele precedente.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.24 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.25 TEST</Text>",
    'badge v0.3.25',
)

app = replace_once(
    app,
    "    kind: 'support' | 'resistance' | 'confirmation';",
    "    kind: 'support' | 'resistance' | 'confirmation' | 'channelUpper' | 'channelLower' | 'channelMid';",
    'tipuri linii candle channel',
)

app = replace_once(
    app,
    "  quality: number;\n  trendLines?: Array<{",
    "  quality: number;\n  channelType?: string | null;\n  channelPosition?: string | null;\n  channelQuality?: number | null;\n  trendLines?: Array<{",
    'metadate candle channel',
)

old_render = """            return <View key={`${line.kind}-${index}`} pointerEvents="none" style={[position,styles.trendLine,line.kind==='support'?styles.supportLine:line.kind==='resistance'?styles.resistanceLine:styles.confirmationLine]} />;"""
new_render = """            const lineStyle = line.kind==='channelUpper' || line.kind==='channelLower'
              ? styles.channelEdgeLine
              : line.kind==='channelMid'
                ? styles.channelMidLine
                : line.kind==='support'
                  ? styles.supportLine
                  : line.kind==='resistance'
                    ? styles.resistanceLine
                    : styles.confirmationLine;
            return <View key={`${line.kind}-${index}`} pointerEvents="none" style={[position,styles.trendLine,lineStyle]} />;"""
app = replace_once(app, old_render, new_render, 'randare linii culoar')

needle_card = """              <Text style={styles.statusText}>Expirare recomandată: {analysis.state === 'WAIT' ? 'după confirmare' : analysis.expiry ? `${analysis.expiry} min • calcul ${timeframe}` : '—'}</Text>"""
channel_card = """              <Text style={styles.statusText}>Expirare recomandată: {analysis.state === 'WAIT' ? 'după confirmare' : analysis.expiry ? `${analysis.expiry} min • calcul ${timeframe}` : '—'}</Text>
              {analysis.channelType && analysis.channelPosition && (
                <Text style={styles.channelInfo}>
                  Culoarul lumânărilor: {analysis.channelType} • {analysis.channelPosition}{analysis.channelQuality ? ` • ${analysis.channelQuality}%` : ''}
                </Text>
              )}"""
app = replace_once(app, needle_card, channel_card, 'card candle channel')

needle_style = """  confirmationLine: { backgroundColor: '#ffd34d', height: 3 },"""
channel_styles = """  confirmationLine: { backgroundColor: '#ffd34d', height: 3 },
  channelEdgeLine: { backgroundColor: '#63a8ff', height: 2, opacity: 0.95 },
  channelMidLine: { height: 0, backgroundColor: 'transparent', borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#63a8ff', opacity: 0.75 },"""
app = replace_once(app, needle_style, channel_styles, 'stiluri culoar')

needle_small = """  statusSmall: { color: '#728095', fontSize: 12 },"""
channel_info_style = """  statusSmall: { color: '#728095', fontSize: 12 },
  channelInfo: { color: '#78b7ff', fontSize: 12, lineHeight: 18, fontWeight: '700' },"""
app = replace_once(app, needle_small, channel_info_style, 'stil text culoar')
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.12';",
    "const ENGINE_VERSION='0.3.13';",
    'engine version 0.3.13',
)

marker = "  function trendLinesFor(curve,result){"
if marker not in engine:
    raise SystemExit('trendLinesFor nu a fost găsită; build oprit pentru siguranță.')

channel_detector = r'''  function detectCandleChannel(curve){
    if(!curve||!curve.pts||curve.pts.length<12)return {valid:false};
    const pts=curve.pts,w=curve.w,h=curve.h;
    const count=Math.max(14,Math.min(36,Math.floor(pts.length*.62)));
    const sample=pts.slice(-count);
    if(sample.length<12)return {valid:false};

    const percentile=(values,q)=>{
      if(!values.length)return 0;
      const a=[...values].sort((x,y)=>x-y);
      const pos=(a.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);
      if(lo===hi)return a[lo];
      return a[lo]+(a[hi]-a[lo])*(pos-lo);
    };

    const centerReg=linReg(sample.map(p=>({x:p.x,y:p.y})));
    const upperReg=linReg(sample.map(p=>({x:p.x,y:p.lo})));
    const lowerReg=linReg(sample.map(p=>({x:p.x,y:p.hi})));
    const upperResiduals=sample.map(p=>p.lo-(centerReg.slope*p.x+centerReg.intercept));
    const lowerResiduals=sample.map(p=>p.hi-(centerReg.slope*p.x+centerReg.intercept));
    const upperOffset=percentile(upperResiduals,.20);
    const lowerOffset=percentile(lowerResiduals,.80);
    const channelWidth=lowerOffset-upperOffset;
    if(!Number.isFinite(channelWidth)||channelWidth<h*.045||channelWidth>h*.34)return {valid:false};

    const margin=Math.max(h*.010,Math.min(h*.026,channelWidth*.13));
    let inside=0,touchUpper=0,touchLower=0;
    for(const p of sample){
      const base=centerReg.slope*p.x+centerReg.intercept;
      const upper=base+upperOffset,lower=base+lowerOffset;
      if(p.lo>=upper-margin*1.5&&p.hi<=lower+margin*1.5)inside++;
      if(Math.abs(p.lo-upper)<=margin*1.8)touchUpper++;
      if(Math.abs(p.hi-lower)<=margin*1.8)touchLower++;
    }

    const containment=inside/sample.length;
    const slopeGap=Math.abs((upperReg.slope-lowerReg.slope)*w/h);
    const parallelScore=Math.max(0,Math.min(1,1-slopeGap/.10));
    const touchScore=Math.min(1,(Math.min(3,touchUpper)+Math.min(3,touchLower))/6);
    const span=(sample[sample.length-1].x-sample[0].x)/w;
    const spanScore=Math.max(0,Math.min(1,(span-.20)/.40));
    const quality=containment*.42+parallelScore*.25+touchScore*.20+spanScore*.13;

    const slopeNorm=-centerReg.slope*w/h;
    const type=slopeNorm>.040?'Canal Ascendent':slopeNorm<-.040?'Canal Descendent':'Canal Orizontal';
    const firstX=sample[0].x;
    const lastX=sample[sample.length-1].x;
    const endX=Math.min(w*.94,Math.max(lastX,lastX+w*.09));
    const baseAt=(x)=>centerReg.slope*x+centerReg.intercept;
    const upperAt=(x)=>baseAt(x)+upperOffset;
    const lowerAt=(x)=>baseAt(x)+lowerOffset;
    const midAt=(x)=>(upperAt(x)+lowerAt(x))/2;

    const anchor=curve.anchor||sample[sample.length-1];
    const upperNow=upperAt(anchor.x),lowerNow=lowerAt(anchor.x);
    const ratio=Math.max(0,Math.min(1,(anchor.y-upperNow)/Math.max(1,lowerNow-upperNow)));
    const zone=ratio<=.33?'zona superioară':ratio>=.67?'zona inferioară':'zona mediană';
    const valid=quality>=.58&&containment>=.64&&touchUpper>=2&&touchLower>=2&&span>=.22;

    return {
      valid,type,quality,position:ratio,zone,slopeNorm,
      upperYNorm:upperNow/h,lowerYNorm:lowerNow/h,
      x1:firstX/w,x2:endX/w,
      upper1:upperAt(firstX)/h,upper2:upperAt(endX)/h,
      lower1:lowerAt(firstX)/h,lower2:lowerAt(endX)/h,
      mid1:midAt(firstX)/h,mid2:midAt(endX)/h,
    };
  }

'''
engine = engine.replace(marker, channel_detector + marker, 1)

start = engine.find("  function trendLinesFor(curve,result){")
end = engine.find("\n  function run(dataUrl,timeframe){", start)
if start < 0 or end < 0:
    raise SystemExit('limitele trendLinesFor nu au fost găsite')
block = engine[start:end]
block = replace_once(
    block,
    "    const lines=[];\n    const direction=result.clear?result.dir:(result.wait?result.bias:'NONE');",
    """    const lines=[];
    const direction=result.clear?result.dir:(result.wait?result.bias:'NONE');
    const candleChannel=detectCandleChannel(curve);
    if(candleChannel.valid){
      lines.push({kind:'channelUpper',x1:candleChannel.x1,y1:candleChannel.upper1,x2:candleChannel.x2,y2:candleChannel.upper2});
      lines.push({kind:'channelLower',x1:candleChannel.x1,y1:candleChannel.lower1,x2:candleChannel.x2,y2:candleChannel.lower2});
      lines.push({kind:'channelMid',x1:candleChannel.x1,y1:candleChannel.mid1,x2:candleChannel.x2,y2:candleChannel.mid2});
    }""",
    'linii smart candle channel',
)
block = replace_once(
    block,
    """    // Pentru semnale confirmate păstrăm linia direcției trendului.
    if(direction==='BUY')addExtended(lows,'support','hi');
    else if(direction==='SELL')addExtended(highs,'resistance','lo');""",
    """    // Dacă avem un culoar clar, cele trei linii albastre descriu deja structura;
    // evităm o a patra linie diagonală care ar încărca inutil graficul.
    if(!candleChannel.valid){
      if(direction==='BUY')addExtended(lows,'support','hi');
      else if(direction==='SELL')addExtended(highs,'resistance','lo');
    }""",
    'eliminare linie redundantă când există canal',
)
engine = engine[:start] + block + engine[end:]

old_run = """        const r=classify(curve),anchor=curve.anchor;
        send({"""
new_run = """        let r=classify(curve); const anchor=curve.anchor;
        const candleChannel=detectCandleChannel(curve);
        if(candleChannel.valid&&r.clear&&!String(r.atlas||'').toLowerCase().includes('breakout')){
          const pos=candleChannel.position;
          const buyAtUpper=r.dir==='BUY'&&pos<=.26;
          const sellAtLower=r.dir==='SELL'&&pos>=.74;
          const counterChannel=(r.dir==='BUY'&&candleChannel.type==='Canal Descendent')||
            (r.dir==='SELL'&&candleChannel.type==='Canal Ascendent');

          if(buyAtUpper||sellAtLower||counterChannel){
            const bias=r.dir;
            const levelNorm=bias==='BUY'?candleChannel.upperYNorm:candleChannel.lowerYNorm;
            r={
              ...r,clear:false,state:'WAIT',wait:true,bias,dir:'NONE',
              score:Math.min(r.score,.72),confirmationLevelY:levelNorm,
              atlas:counterChannel
                ? candleChannel.type+' – semnal contra culoarului'
                : candleChannel.type+' – intrare la marginea opusă',
              reason:counterChannel
                ? 'Semnalul '+bias+' este contra direcției culoarului lumânărilor. Așteaptă ruperea și confirmarea marginii canalului înainte de intrare.'
                : bias==='BUY'
                  ? 'BUY este deja aproape de marginea superioară a culoarului. Așteaptă breakout confirmat sau o revenire spre jumătatea inferioară.'
                  : 'SELL este deja aproape de marginea inferioară a culoarului. Așteaptă breakout confirmat sau o revenire spre jumătatea superioară.'
            };
          }else if((r.dir==='BUY'&&candleChannel.type==='Canal Ascendent'&&pos>=.60)||
                   (r.dir==='SELL'&&candleChannel.type==='Canal Descendent'&&pos<=.40)){
            r.score=Math.min(.88,r.score+.025);
          }
        }
        send({"""
engine = replace_once(engine, old_run, new_run, 'folosire canal în decizia finală')

old_quality = """            quality:Math.round(curve.quality*100),
            trendLines:trendLinesFor(curve,r),"""
new_quality = """            quality:Math.round(curve.quality*100),
            channelType:candleChannel.valid?candleChannel.type:null,
            channelPosition:candleChannel.valid?candleChannel.zone:null,
            channelQuality:candleChannel.valid?Math.round(candleChannel.quality*100):null,
            trendLines:trendLinesFor(curve,r),"""
engine = replace_once(engine, old_quality, new_quality, 'payload candle channel')

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.25 aplicat: Smart Candle Channel cu două margini + mediană, poziție în canal și gardă BUY/SELL la margini.')
