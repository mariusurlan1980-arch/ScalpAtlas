from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.4 rulează DUPĂ patch-urile v0.3.2 și v0.3.3.
# Fixează trei probleme observate în testul real:
# - Breakout Suport/Rezistență nu mai este declarat fără un nivel structural real;
# - nivelul spart este transmis exact din clasificare și desenat galben;
# - rezultatul se aduce automat în zona vizibilă și versiunea este afișată clar.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "  const analyzerRef = useRef<WebView>(null);",
    "  const analyzerRef = useRef<WebView>(null);\n  const scrollRef = useRef<ScrollView>(null);",
    'scroll ref',
)

app = replace_once(
    app,
    "      <ScrollView contentContainerStyle={styles.page}>",
    "      <ScrollView ref={scrollRef} contentContainerStyle={styles.page}>",
    'ScrollView ref',
)

app = replace_once(
    app,
    "        );\n        return;\n      }\n      if (payload.type === 'ERROR') {",
    "        );\n        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 180);\n        return;\n      }\n      if (payload.type === 'ERROR') {",
    'auto scroll rezultat',
)

app = replace_once(
    app,
    "            <Text style={styles.subtitle}>{SCALP_ATLAS_COUNT} modele • Cameră + Galerie • Atlas Engine</Text>",
    "            <Text style={styles.subtitle}>{SCALP_ATLAS_COUNT} modele • Cameră + Galerie • Atlas Engine</Text>\n            <Text style={styles.versionBadge}>v0.3.4 TEST</Text>",
    'badge versiune',
)

app = replace_once(
    app,
    "  page: { flexGrow: 1, padding: 18, paddingBottom: 88, gap: 16, backgroundColor: '#070b12' },",
    "  page: { flexGrow: 1, padding: 18, paddingBottom: 150, gap: 16, backgroundColor: '#070b12' },",
    'spațiu inferior extins',
)

app = replace_once(
    app,
    "  subtitle: { color: '#7f8b9e', marginTop: 4, fontSize: 12 },",
    "  subtitle: { color: '#7f8b9e', marginTop: 4, fontSize: 12 },\n  versionBadge: { color: '#ffd34d', marginTop: 3, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },",
    'stil versiune',
)

APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(engine, "const ENGINE_VERSION='0.2.5';", "const ENGINE_VERSION='0.2.6';", 'engine version 0.2.6')

engine = replace_once(
    engine,
    "      else if(breakoutUp&&dir==='BUY'){atlas='Breakout Rezistență';idx=21;score=Math.max(score,.74+quality*.07+microStrength*.08+consensus*.05);}\n      else if(breakoutDown&&dir==='SELL'){atlas='Breakout Suport';idx=22;score=Math.max(score,.74+quality*.07+microStrength*.08+consensus*.05);}",
    "      else if(refHigh&&breakoutUp&&dir==='BUY'){atlas='Breakout Rezistență';idx=21;score=Math.max(score,.74+quality*.07+microStrength*.08+consensus*.05);}\n      else if(refLow&&breakoutDown&&dir==='SELL'){atlas='Breakout Suport';idx=22;score=Math.max(score,.74+quality*.07+microStrength*.08+consensus*.05);}",
    'breakout necesită nivel real',
)

engine = replace_once(
    engine,
    "      score,\n      reason:clear?'':'Potrivirea cu atlasul este prea slabă sau semnalele se contrazic'\n    };",
    "      score,\n      breakoutLevelY: idx===21&&refHigh ? refHigh.y/h : idx===22&&refLow ? refLow.y/h : null,\n      reason:clear?'':'Potrivirea cu atlasul este prea slabă sau semnalele se contrazic'\n    };",
    'nivel exact breakout în rezultat',
)

old_block = """    // Dacă semnalul este un breakout confirmat, păstrăm pe grafic și nivelul
    // orizontal care a fost spart. Astfel SELL + Breakout Suport arată explicit
    // suportul, iar BUY + Breakout Rezistență arată explicit rezistența.
    if(result.clear&&curve.anchor&&(result.idx===21||result.idx===22||result.idx===44)){
      const anchor=curve.anchor;
      const levelItems=(direction==='BUY'?highs:lows).filter(p=>p.x<anchor.x-curve.w*.04);
      const ref=levelItems[levelItems.length-1]||(direction==='BUY'?highs[highs.length-1]:lows[lows.length-1]);
      if(ref){
        const y=Math.max(0,Math.min(curve.h,ref.y));
        const startX=Math.max(curve.w*.08,ref.x-curve.w*.12);
        const endX=Math.min(curve.w*.94,anchor.x+curve.w*.10);
        lines.push({kind:'confirmation',x1:startX/curve.w,y1:y/curve.h,x2:endX/curve.w,y2:y/curve.h});
      }
    }
    return lines;"""

new_block = """    // Pentru breakout confirmat folosim exact nivelul structural calculat în classify().
    // Astfel eticheta Breakout Suport/Rezistență și linia galbenă nu se pot contrazice.
    if(result.clear&&curve.anchor&&(result.idx===21||result.idx===22)&&Number.isFinite(result.breakoutLevelY)){
      const anchor=curve.anchor;
      const y=Math.max(0,Math.min(curve.h,result.breakoutLevelY*curve.h));
      const startX=Math.max(curve.w*.08,anchor.x-curve.w*.30);
      const endX=Math.min(curve.w*.94,anchor.x+curve.w*.11);
      lines.push({kind:'confirmation',x1:startX/curve.w,y1:y/curve.h,x2:endX/curve.w,y2:y/curve.h});
    }
    return lines;"""

engine = replace_once(engine, old_block, new_block, 'linie breakout exactă')
ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.4 aplicat: breakout valid numai cu nivel real, linie galbenă exactă, auto-scroll și badge versiune.')
