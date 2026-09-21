from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.53 — CONFIRMATION DIRECTION COLORS
# Feedback:
# - CONFIRMARE BUY trebuie să fie recunoscută instant ca direcție BUY;
# - CONFIRMARE SELL trebuie să fie recunoscută instant ca direcție SELL;
# - fundalul rămâne întunecat/neutru pentru a nu arăta ca un semnal deja activ.
#
# Corecție exclusiv vizuală:
# - CONFIRMARE BUY => contur verde + text verde;
# - CONFIRMARE SELL => contur roșu + text roșu;
# - badge-ul rămâne compact și poziționat ca în v0.3.50;
# - motorul, cele 70 de modele și logica BUY/SELL/WAIT nu sunt modificate.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.52 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.53 TEST</Text>",
    'badge v0.3.53',
)

app = replace_once(
    app,
    """                analysis.signal === 'NONE' && analysis.bias
                  ? styles.opportunityChartConfirm
                  : analysis.opportunityDirection === 'BUY' ? styles.opportunityChartBuy : styles.opportunityChartSell,""",
    """                analysis.signal === 'NONE' && analysis.bias
                  ? (analysis.bias === 'BUY' ? styles.opportunityChartConfirmBuy : styles.opportunityChartConfirmSell)
                  : analysis.opportunityDirection === 'BUY' ? styles.opportunityChartBuy : styles.opportunityChartSell,""",
    'contur BUY/SELL pentru confirmare',
)

app = replace_once(
    app,
    """                analysis.signal === 'NONE' && analysis.bias
                  ? styles.confirmationZone
                  : analysis.opportunityDirection === 'BUY' ? styles.buy : styles.sell,""",
    """                analysis.signal === 'NONE' && analysis.bias
                  ? (analysis.bias === 'BUY' ? styles.buy : styles.sell)
                  : analysis.opportunityDirection === 'BUY' ? styles.buy : styles.sell,""",
    'text BUY/SELL pentru confirmare',
)

app = replace_once(
    app,
    "  opportunityChartConfirm: { borderColor: '#ffd34d', backgroundColor: 'rgba(18,16,7,0.90)', minWidth: 0, paddingHorizontal: 5, paddingVertical: 3 },",
    """  opportunityChartConfirmBuy: { borderColor: 'rgba(56,217,150,0.96)', backgroundColor: 'rgba(7,18,14,0.92)', minWidth: 0, paddingHorizontal: 5, paddingVertical: 3 },
  opportunityChartConfirmSell: { borderColor: 'rgba(255,100,100,0.96)', backgroundColor: 'rgba(22,8,8,0.92)', minWidth: 0, paddingHorizontal: 5, paddingVertical: 3 },""",
    'stiluri confirmare verde/roșu',
)

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.53 aplicat: CONFIRMARE BUY este verde, CONFIRMARE SELL este roșie; motorul rămâne neschimbat.')
