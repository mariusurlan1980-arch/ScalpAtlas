from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.12 rulează DUPĂ patch-urile v0.3.2 ... v0.3.11.
# Adaugă un cronometru de PROSPEȚIME / REVALIDARE a semnalului.
# IMPORTANT: acesta NU pretinde că știe cât timp piața va respecta structura.
# Este o fereastră conservatoare de intrare de la momentul analizei fotografiei.
# La 00:00 semnalul este marcat EXPIRAT și săgeata dispare până la o nouă analiză.
# Funcționează la fel pe OTC și pe piață normală deoarece este local în aplicație.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.11 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.12 TEST</Text>",
    'badge v0.3.12',
)

app = replace_once(
    app,
    "const TIMEFRAMES = ['M1', 'M2', 'M3', 'M5', 'M10', 'M15', 'M30', 'H1'];",
    "const TIMEFRAMES = ['M1', 'M2', 'M3', 'M5', 'M10', 'M15', 'M30', 'H1'];\n\n// Fereastră conservatoare de prospețime a semnalului, distinctă de expirarea tranzacției.\n// Aproximativ 1/3 din timeframe, ca să evităm folosirea unui screenshot devenit vechi.\nconst SIGNAL_TTL_SECONDS: Record<string, number> = {\n  M1: 20, M2: 40, M3: 60, M5: 90, M10: 180, M15: 300, M30: 600, H1: 1200,\n};",
    'mapare TTL semnal',
)

app = replace_once(
    app,
    "        if (result.signal !== 'NONE' && result.expiry && result.expiry > 0) {\n          setRemainingSeconds(Math.max(1, Math.round(result.expiry * 60)));\n        } else {\n          setRemainingSeconds(0);\n        }",
    "        if (result.signal !== 'NONE' && result.state !== 'WAIT' && result.state !== 'INVALID') {\n          // Cronometrul măsoară cât timp păstrăm analiza ca fiind PROASPĂTĂ pentru intrare,\n          // nu durata tranzacției și nu o garanție că structura rămâne validă.\n          setRemainingSeconds(SIGNAL_TTL_SECONDS[timeframe] ?? 60);\n        } else {\n          setRemainingSeconds(0);\n        }",
    'timer separat de expirarea tranzacției',
)

app = replace_once(
    app,
    "      !analysis || analysis.signal === 'NONE' || analysis.anchorX == null || analysis.anchorY == null ||\n      !image?.width || !image?.height || !previewSize.width",
    "      !analysis || analysis.signal === 'NONE' || remainingSeconds <= 0 || analysis.anchorX == null || analysis.anchorY == null ||\n      !image?.width || !image?.height || !previewSize.width",
    'ascunde săgeata când semnalul a expirat',
)

app = replace_once(
    app,
    "  }, [analysis, image, previewSize]);",
    "  }, [analysis, image, previewSize, remainingSeconds]);",
    'actualizare poziție săgeată la expirarea timerului',
)

app = replace_once(
    app,
    "                analysis.state === 'WAIT' ? styles.wait : analysis.signal === 'BUY' ? styles.buy : analysis.signal === 'SELL' ? styles.sell : styles.neutral,",
    "                analysis.signal !== 'NONE' && remainingSeconds <= 0 ? styles.wait : analysis.state === 'WAIT' ? styles.wait : analysis.signal === 'BUY' ? styles.buy : analysis.signal === 'SELL' ? styles.sell : styles.neutral,",
    'culoare semnal expirat',
)

app = replace_once(
    app,
    "                {analysis.state === 'WAIT' ? 'AȘTEAPTĂ CONFIRMAREA' : analysis.state === 'INVALID' ? 'FOTOGRAFIE DEJA ANALIZATĂ' : analysis.signal === 'NONE' ? 'FĂRĂ SEMNAL CLAR' : analysis.signal}",
    "                {analysis.signal !== 'NONE' && remainingSeconds <= 0 ? 'SEMNAL EXPIRAT' : analysis.state === 'WAIT' ? 'AȘTEAPTĂ CONFIRMAREA' : analysis.state === 'INVALID' ? 'FOTOGRAFIE DEJA ANALIZATĂ' : analysis.signal === 'NONE' ? 'FĂRĂ SEMNAL CLAR' : analysis.signal}",
    'titlu semnal expirat',
)

app = replace_once(
    app,
    "              <Text style={styles.statusText}>Expirare recomandată: {analysis.state === 'WAIT' ? 'după confirmare' : analysis.expiry ? `${analysis.expiry} min • calcul ${timeframe}` : '—'}</Text>",
    "              <Text style={styles.statusText}>Expirare recomandată: {analysis.state === 'WAIT' ? 'după confirmare' : analysis.expiry ? `${analysis.expiry} min • calcul ${timeframe}` : '—'}</Text>\n              {analysis.signal !== 'NONE' && (\n                <Text style={[styles.signalTimerText, remainingSeconds <= 30 && styles.signalTimerUrgent]}>\n                  Valabilitate estimată pentru intrare: {remainingSeconds > 0 ? timerLabel : 'EXPIRAT — REANALIZEAZĂ'}\n                </Text>\n              )}",
    'afișare cronometru în cardul rezultat',
)

app = replace_once(
    app,
    "  statusSmall: { color: '#728095', fontSize: 12 },\n  statusReason: { color: '#ffd34d', fontSize: 12, lineHeight: 17 },",
    "  statusSmall: { color: '#728095', fontSize: 12 },\n  signalTimerText: { color: '#46e6b0', fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 },\n  signalTimerUrgent: { color: '#ffd34d' },\n  statusReason: { color: '#ffd34d', fontSize: 12, lineHeight: 17 },",
    'stil cronometru semnal',
)

app = replace_once(
    app,
    "          BUY sau SELL apare numai după confirmare. Când prețul este la un nivel important fără spargere confirmată, aplicația afișează „Așteaptă confirmarea”. Probabilitatea este o estimare structurală, nu o garanție de tranzacționare.",
    "          BUY sau SELL apare numai după confirmare. Cronometrul arată o fereastră estimată de prospețime a analizei, nu garantează că structura rămâne validă până la 00:00. La expirare, reanalizează graficul. Probabilitatea este o estimare structurală, nu o garanție de tranzacționare.",
    'footer timer și limitare',
)

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.12 aplicat: cronometru de valabilitate estimată pentru intrare; la 00:00 semnalul expiră și cere reanalizare.')
