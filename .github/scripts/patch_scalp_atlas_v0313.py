from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.13 rulează DUPĂ patch-urile v0.3.2 ... v0.3.12.
# Corecție vizuală cerută după testul AUD/USD M10:
# - săgeata nu mai poate fi plasată în spatele/în interiorul mișcării;
# - BUY/SELL este proiectat în FAȚA ultimei zone detectate, predominant în dreapta;
# - păstrează spațiu față de trend, lumânări și margini;
# - folosește stânga doar ca ultim fallback dacă fotografia nu are deloc spațiu în dreapta.
# Motorul de analiză și timerul semnalului NU sunt modificate.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.12 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.13 TEST</Text>",
    'badge v0.3.13',
)

old_position = """  const arrowStyle = useMemo(() => {
    if (
      !analysis || analysis.signal === 'NONE' || remainingSeconds <= 0 || analysis.anchorX == null || analysis.anchorY == null ||
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
  }, [analysis, image, previewSize, remainingSeconds]);"""

new_position = """  const arrowStyle = useMemo(() => {
    if (
      !analysis || analysis.signal === 'NONE' || remainingSeconds <= 0 || analysis.anchorX == null || analysis.anchorY == null ||
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

    // „În față” = săgeata trebuie să stea după ultima zonă detectată, spre dreapta.
    // Dacă anchor-ul este ușor rămas în urmă, folosim și o bandă frontală minimă la ~70% din fotografie.
    const frontBandX = offsetX + displayW * 0.70;
    const structuralFrontX = lines.length
      ? Math.max(anchorX, ...lines.map(l => Math.max(l.x1, l.x2)))
      : anchorX;
    // Nu lăsăm o linie de trend extinsă artificial să împingă săgeata până în marginea telefonului.
    const cappedStructuralFront = Math.min(structuralFrontX, offsetX + displayW * 0.78);
    const frontX = Math.max(anchorX + 26, frontBandX, cappedStructuralFront + 10);

    const yOffsets = analysis.signal === 'BUY'
      ? [-30, -10, 12, 28]
      : [18, -6, -28, 34];
    const xOffsets = [0, 12, 24, 36];

    let best={left:frontX-arrowW/2,top:anchorY-arrowH/2,score:-Infinity};
    for(const dx of xOffsets){
      for(const dy of yOffsets){
        const left=frontX+dx-arrowW/2;
        const top=anchorY+dy-arrowH/2;
        const cx=left+arrowW/2, cy=top+arrowH/2;

        const inside = left >= offsetX+4 && top >= offsetY+4 &&
          left+arrowW <= offsetX+displayW-6 && top+arrowH <= offsetY+displayH-4;
        if(!inside) continue;

        // Regula tare: săgeata trebuie să rămână vizibil ÎN FAȚA ultimei lumânări detectate.
        if(cx < anchorX + 20) continue;

        const lineDistance = lines.length
          ? Math.min(...lines.map(l=>pointSegmentDistance(cx,cy,l.x1,l.y1,l.x2,l.y2)))
          : 80;
        const anchorDistance = Math.hypot(cx-anchorX,cy-anchorY);
        const edgeDistance = Math.min(
          cx-offsetX, offsetX+displayW-cx,
          cy-offsetY, offsetY+displayH-cy,
        );

        // Prioritate: în față + aer față de trend/lumânări. Distanța prea mare spre dreapta este penalizată ușor.
        const score = Math.min(lineDistance,75)*3.2 +
          Math.min(anchorDistance,75)*0.70 +
          Math.min(edgeDistance,34)*0.30 -
          dx*0.18;

        if(score>best.score) best={left,top,score};
      }
    }

    // Fallback: dacă nu există loc perfect, păstrăm totuși săgeata la dreapta anchor-ului,
    // cât mai aproape de marginea utilă a fotografiei.
    if(!Number.isFinite(best.score)){
      const fallbackCenterX=Math.max(anchorX+20,Math.min(offsetX+displayW-arrowW/2-8,frontX));
      best={left:fallbackCenterX-arrowW/2,top:anchorY-arrowH/2,score:0};
    }

    return {
      left: Math.max(offsetX+4,Math.min(offsetX+displayW-arrowW-6,best.left)),
      top: Math.max(offsetY+4,Math.min(offsetY+displayH-arrowH-4,best.top)),
    };
  }, [analysis, image, previewSize, remainingSeconds]);"""

app = replace_once(app, old_position, new_position, 'poziționare săgeată exclusiv în fața prețului')

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.13 aplicat: săgeata BUY/SELL este proiectată în fața ultimei zone, predominant în dreapta, cu spațiu față de trend și lumânări.')
