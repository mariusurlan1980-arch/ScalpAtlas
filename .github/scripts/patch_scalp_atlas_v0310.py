from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.10 rulează DUPĂ patch-urile v0.3.2 ... v0.3.9.
# Finisare vizuală cerută după testul real pe M10:
# - coada săgeții este și mai scurtă;
# - săgeata este puțin mai mică;
# - poziția nu mai este fix lipită de anchor;
# - se aleg mai multe poziții candidate și este preferată zona cu distanță
#   mai mare față de linia de trend, lumânarea ancoră și margini.
# Motorul de analiză, semnalul și probabilitatea NU sunt modificate.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.9 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.10 TEST</Text>",
    'badge v0.3.10',
)

old_position = """  const arrowStyle = useMemo(() => {
    if (
      !analysis || analysis.signal === 'NONE' || analysis.anchorX == null || analysis.anchorY == null ||
      !image?.width || !image?.height || !previewSize.width
    ) return null;
    const scale = Math.min(previewSize.width / image.width, previewSize.height / image.height);
    const displayW = image.width * scale;
    const displayH = image.height * scale;
    const offsetX = (previewSize.width - displayW) / 2;
    const offsetY = (previewSize.height - displayH) / 2;
    return {
      left: Math.min(previewSize.width - 30, Math.max(4, offsetX + analysis.anchorX * displayW + 3)),
      top: Math.min(previewSize.height - 36, Math.max(4, offsetY + analysis.anchorY * displayH - 14)),
    };
  }, [analysis, image, previewSize]);"""

new_position = """  const arrowStyle = useMemo(() => {
    if (
      !analysis || analysis.signal === 'NONE' || analysis.anchorX == null || analysis.anchorY == null ||
      !image?.width || !image?.height || !previewSize.width
    ) return null;

    const scale = Math.min(previewSize.width / image.width, previewSize.height / image.height);
    const displayW = image.width * scale;
    const displayH = image.height * scale;
    const offsetX = (previewSize.width - displayW) / 2;
    const offsetY = (previewSize.height - displayH) / 2;
    const anchorX = offsetX + analysis.anchorX * displayW;
    const anchorY = offsetY + analysis.anchorY * displayH;
    const arrowW = 22;
    const arrowH = 26;

    const pointSegmentDistance = (px:number, py:number, x1:number, y1:number, x2:number, y2:number) => {
      const vx=x2-x1, vy=y2-y1, wx=px-x1, wy=py-y1;
      const len2=vx*vx+vy*vy;
      const t=len2>0?Math.max(0,Math.min(1,(wx*vx+wy*vy)/len2)):0;
      const qx=x1+t*vx, qy=y1+t*vy;
      return Math.hypot(px-qx,py-qy);
    };

    const lines=(analysis.trendLines||[]).map(line => ({
      x1: offsetX + line.x1 * displayW,
      y1: offsetY + line.y1 * displayH,
      x2: offsetX + line.x2 * displayW,
      y2: offsetY + line.y2 * displayH,
    }));

    // Căutăm întâi spațiul liber din dreapta; dacă nu este sigur, încercăm stânga.
    // SELL preferă zona ușor sub/în dreapta anchor-ului, BUY ușor deasupra/în dreapta.
    const candidates = analysis.signal === 'BUY'
      ? [
          {dx:30,dy:-34},{dx:38,dy:-8},{dx:28,dy:14},
          {dx:-48,dy:-34},{dx:-50,dy:-8},{dx:-44,dy:16},
        ]
      : [
          {dx:30,dy:12},{dx:38,dy:-12},{dx:28,dy:-36},
          {dx:-48,dy:12},{dx:-50,dy:-12},{dx:-44,dy:-38},
        ];

    let best={left:anchorX+28,top:anchorY-13,score:-Infinity};
    for(const c of candidates){
      const left=anchorX+c.dx-arrowW/2;
      const top=anchorY+c.dy-arrowH/2;
      const cx=left+arrowW/2, cy=top+arrowH/2;

      // Săgeata trebuie să rămână în fotografia afișată, nu în marginea neagră a preview-ului.
      const inside = left >= offsetX+4 && top >= offsetY+4 &&
        left+arrowW <= offsetX+displayW-4 && top+arrowH <= offsetY+displayH-4;
      if(!inside) continue;

      const lineDistance = lines.length
        ? Math.min(...lines.map(l=>pointSegmentDistance(cx,cy,l.x1,l.y1,l.x2,l.y2)))
        : 80;
      const anchorDistance = Math.hypot(cx-anchorX,cy-anchorY);
      const edgeDistance = Math.min(
        cx-offsetX, offsetX+displayW-cx,
        cy-offsetY, offsetY+displayH-cy,
      );

      // Prioritatea principală: să nu atingă linia de trend.
      // Apoi păstrăm distanță de ultima lumânare și preferăm discret partea dreaptă.
      const score = Math.min(lineDistance,70)*3.0 +
        Math.min(anchorDistance,70)*0.75 +
        Math.min(edgeDistance,36)*0.35 +
        (c.dx>0?8:0);

      if(score>best.score) best={left,top,score};
    }

    return {
      left: Math.max(offsetX+4,Math.min(offsetX+displayW-arrowW-4,best.left)),
      top: Math.max(offsetY+4,Math.min(offsetY+displayH-arrowH-4,best.top)),
    };
  }, [analysis, image, previewSize]);"""

app = replace_once(app, old_position, new_position, 'poziționare inteligentă în spațiu liber')

old_styles = """  arrowWrap: { position: 'absolute', width: 26, height: 32, alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  // Varianta 3: semnal compact, aproximativ cât o lumânare, fără volum excesiv.
  arrowSlim: { width: 16, height: 27, alignItems: 'center', justifyContent: 'flex-start' },
  arrowSlimDown: { transform: [{ rotate: '180deg' }] },
  arrowHeadSlim: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  arrowStemSlim: { width: 3, height: 16, borderRadius: 2, marginTop: -1 },"""

new_styles = """  arrowWrap: { position: 'absolute', width: 22, height: 26, alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  // Varianta 3 finisată: mai mică, coadă mai scurtă și mai mult aer față de grafic.
  arrowSlim: { width: 12, height: 21, alignItems: 'center', justifyContent: 'flex-start' },
  arrowSlimDown: { transform: [{ rotate: '180deg' }] },
  arrowHeadSlim: { width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  arrowStemSlim: { width: 2, height: 10, borderRadius: 1, marginTop: -1 },"""

app = replace_once(app, old_styles, new_styles, 'săgeată mai scurtă și mai mică')

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.10 aplicat: săgeată Varianta 3 mai mică, coadă scurtă, poziționare automată departe de trend și anchor.')
