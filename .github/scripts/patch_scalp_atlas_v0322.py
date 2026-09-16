from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.22 rulează DUPĂ v0.3.21.
# Corecție după testele CHF/NOK și EUR/CHF:
# - motorul nu mai cade prea ușor în același răspuns generic FĂRĂ SEMNAL CLAR;
# - un impuls local puternic, confirmat simultan de recent + micro + ultima mișcare,
#   poate ieși din zona generică, apoi trece prin toate gărzile de siguranță existente;
# - păstrăm WAIT dacă există rezistență/suport, contra-trend, epuizare etc.;
# - timeframe implicit devine M10, deoarece aplicația pornea mereu pe M1 și putea induce
#   o analiză cu timeframe greșit după redeschidere. Utilizatorul îl poate schimba oricând.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.21 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.22 TEST</Text>",
    'badge v0.3.22',
)
app = replace_once(
    app,
    "  const [timeframe, setTimeframe] = useState('M1');",
    "  const [timeframe, setTimeframe] = useState('M10');",
    'timeframe implicit M10',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.9';",
    "const ENGINE_VERSION='0.3.10';",
    'engine version 0.3.10',
)

# Introducem un escape controlat din blocul generic NO SIGNAL.
old_if = """    if(voteTotal<2.6||consensus<.24||(Math.abs(recentNorm)<.03&&Math.abs(microNorm)<.03)){
      // v0.3.21 — NO-SIGNAL STRUCTURE LABELS."""

new_if = """    // v0.3.22 — STRONG LOCAL DIRECTION ESCAPE.
    // Dacă ultimele două ferestre + ultima mișcare sunt clar aliniate, nu clasificăm
    // automat imaginea ca laterală doar fiindcă trendul vechi diluează consensul.
    // Semnalul rezultat NU ocolește gărzile v0.3.14–v0.3.20; acestea pot transforma
    // în continuare rezultatul în WAIT dacă intrarea nu este sigură structural.
    const strongLocalBuy=recentNorm>.075&&microNorm>.055&&lastMove>.012;
    const strongLocalSell=recentNorm<-.075&&microNorm<-.055&&lastMove<-.012;
    const strongLocalAligned=strongLocalBuy||strongLocalSell;

    if((voteTotal<2.6||consensus<.24||(Math.abs(recentNorm)<.03&&Math.abs(microNorm)<.03))&&!strongLocalAligned){
      // v0.3.21 — NO-SIGNAL STRUCTURE LABELS."""
engine = replace_once(engine, old_if, new_if, 'escape din no-signal generic')

old_dir = """    dir=voteDiff>0?'BUY':'SELL';"""
new_dir = """    dir=strongLocalBuy?'BUY':strongLocalSell?'SELL':(voteDiff>0?'BUY':'SELL');
    if(strongLocalAligned){
      score=Math.max(score,.74+quality*.05+recentStrength*.05+microStrength*.05);
    }"""
engine = replace_once(engine, old_dir, new_dir, 'direcție locală puternică')

old_clear = """    const clear=score>=.72&&consensus>=.32;"""
new_clear = """    const clear=score>=.72&&(consensus>=.32||strongLocalAligned);"""
engine = replace_once(engine, old_clear, new_clear, 'clear cu consens local puternic')

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.22 aplicat: motorul diferențiază mai bine graficele cu impuls local puternic; M10 este timeframe implicit.')
