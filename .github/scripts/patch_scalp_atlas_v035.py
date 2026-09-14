from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.5 rulează DUPĂ patch-urile v0.3.2, v0.3.3 și v0.3.4.
# Corecții:
# - expirarea este calculată determinist exclusiv din timeframe-ul SELECTAT + scor;
# - afișarea rezultatului spune explicit din ce timeframe a fost calculată expirarea;
# - avertismentul explică faptul că 00:10:00 din broker este durata tranzacției,
#   nu dovada că graficul este M10.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "        <Text style={styles.timeframeWarning}>Verifică: timeframe-ul selectat trebuie să fie identic cu cel din fotografie.</Text>",
    "        <Text style={styles.timeframeWarning}>Atenție: timpul 00:10:00 din broker este durata tranzacției, nu timeframe-ul graficului. Selectează timeframe-ul numai după cel afișat pe grafic.</Text>",
    'avertisment timeframe clar',
)

app = replace_once(
    app,
    "              <Text style={styles.statusText}>Expirare recomandată: {analysis.state === 'WAIT' ? 'după confirmare' : analysis.expiry ? `${analysis.expiry} min` : '—'}</Text>",
    "              <Text style={styles.statusText}>Expirare recomandată: {analysis.state === 'WAIT' ? 'după confirmare' : analysis.expiry ? `${analysis.expiry} min • calcul ${timeframe}` : '—'}</Text>",
    'expirare cu sursa timeframe',
)

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.4 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.5 TEST</Text>",
    'badge v0.3.5',
)

APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(engine, "const ENGINE_VERSION='0.2.6';", "const ENGINE_VERSION='0.2.7';", 'engine version 0.2.7')

old_expiry = """  function expiryFor(tf,score){
    const base=TF_MIN[tf]||15;
    let mult=score>=.82?1:score>=.72?1.25:1.5;
    let mins=Math.max(1,Math.round(base*mult));
    if(tf==='H1')mins=Math.round(mins/5)*5;
    return mins;
  }"""

new_expiry = """  function expiryFor(tf,score){
    // Expirarea folosește NUMAI timeframe-ul selectat în SCALP ATLAS.
    // Exemplu verificabil: M10 + scor 72–81% => 13 minute.
    const base=TF_MIN[tf];
    if(!base)return null;
    let mins;
    if(score>=.82) mins=base;
    else if(score>=.72) mins=Math.round(base*1.25);
    else mins=Math.round(base*1.50);
    if(tf==='H1') mins=Math.max(5,Math.round(mins/5)*5);
    return Math.max(1,mins);
  }"""

engine = replace_once(engine, old_expiry, new_expiry, 'calcul expirare determinist')

engine = replace_once(
    engine,
    "            expiry:r.clear?expiryFor(timeframe,r.score):null,",
    "            expiry:r.clear?expiryFor(timeframe,r.score):null,\n            expiryTimeframe:r.clear?timeframe:null,",
    'payload timeframe expirare',
)

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.5 aplicat: expirare deterministă pe timeframe selectat + avertisment 00:10:00.')
