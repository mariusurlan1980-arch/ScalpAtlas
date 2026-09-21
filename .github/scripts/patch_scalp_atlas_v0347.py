from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.47 — CHANNEL / MODEL CONSISTENCY
# Feedback AUD/CHF OTC M15:
# - liniile albastre arătau un canal DESCENDENT;
# - cardul putea afișa "Canal Ascendent – recul contra trendului" + Direcție urmărită BUY.
# Aceasta este o contradicție între detectorul de canal și modelul WAIT.
#
# Corecție:
# - când detectorul de canal este valid, numele modelului WAIT trebuie să respecte canalul real;
# - dacă direcția urmărită este contra canalului (BUY în canal descendent / SELL în canal ascendent),
#   direcția este neutralizată până la confirmare structurală;
# - nu transformăm rebound-ul contra canalului în BUY/SELL doar dintr-o singură revenire.
# Cele 70 de modele și pragurile de semnal rămân neschimbate.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.46 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.47 TEST</Text>",
    'badge v0.3.47',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.27';",
    "const ENGINE_VERSION='0.3.28';",
    'engine version 0.3.28',
)

marker = """        send({
          type:'RESULT',"""

guard = """        // v0.3.47 — sincronizează modelul WAIT cu canalul desenat.
        // Dacă modelul vechi urmărește o direcție opusă canalului detectat, nu afișăm
        // BUY/SELL ca direcție urmărită până când reversarea nu este confirmată.
        if(candleChannel.valid&&r.wait&&r.bias){
          const counterToChannel=
            (r.bias==='BUY'&&candleChannel.type==='Canal Descendent')||
            (r.bias==='SELL'&&candleChannel.type==='Canal Ascendent');

          if(counterToChannel){
            const wasBuy=r.bias==='BUY';
            r={
              ...r,
              bias:null,
              dir:'NONE',
              clear:false,
              state:'WAIT',
              wait:true,
              score:Math.min(Number(r.score)||.71,.71),
              atlas:wasBuy
                ? 'Canal Descendent – rebound contra canalului'
                : 'Canal Ascendent – recul contra canalului',
              reason:wasBuy
                ? 'Canalul detectat este descendent. Revenirea BUY este încă împotriva canalului și nu este confirmată. Așteaptă o spargere/închidere clară peste structura descendentă; altfel, o respingere poate relua SELL.'
                : 'Canalul detectat este ascendent. Reculul SELL este încă împotriva canalului și nu este confirmat. Așteaptă o spargere/închidere clară sub structura ascendentă; altfel, o respingere poate relua BUY.'
            };
            opportunity=null;
          }
        }

        send({
          type:'RESULT',"""

engine = replace_once(engine, marker, guard, 'sincronizare canal/model WAIT')
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.47 aplicat: modelul WAIT este sincronizat cu canalul real, iar direcția contra-canal este neutralizată până la confirmare.')
