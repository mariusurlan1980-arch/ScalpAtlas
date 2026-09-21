from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.50 — COMPACT CONFIRMATION BADGE
# Feedback AUD/CHF OTC M15:
# - culoarea galbenă din v0.3.49 este corectă;
# - eticheta "ZONĂ DE CONFIRMARE" este încă prea lată și acoperă lumânările.
#
# Corecție exclusiv vizuală:
# - pe grafic, WAIT afișează doar "CONFIRMARE";
# - badge compact, lățime fixă;
# - BUY/confirmare la rezistență -> badge deasupra liniei galbene;
# - SELL/confirmare la suport -> badge sub linia galbenă;
# - dacă biasul este neutru, sensul este dedus din modelul WAIT;
# - cardul rezultat rămâne complet și explicativ.
# Motorul, cele 70 de modele și regulile BUY/SELL/WAIT nu sunt modificate.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.49 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.50 TEST</Text>",
    'badge v0.3.50',
)

app = replace_once(
    app,
    """                {analysis.signal === 'NONE' && analysis.bias
                  ? 'ZONĂ DE CONFIRMARE'
                  : analysis.signal === 'NONE' && analysis.opportunityScore < 64
                    ? `OBSERVAȚIE ${analysis.opportunityDirection} ${analysis.opportunityScore}%`
                    : `ZONĂ ${analysis.opportunityDirection} ${analysis.opportunityScore}%`}""",
    """                {analysis.signal === 'NONE' && analysis.bias
                  ? 'CONFIRMARE'
                  : analysis.signal === 'NONE' && analysis.opportunityScore < 64
                    ? `OBSERVAȚIE ${analysis.opportunityDirection} ${analysis.opportunityScore}%`
                    : `ZONĂ ${analysis.opportunityDirection} ${analysis.opportunityScore}%`}""",
    'text compact WAIT pe grafic',
)

old_wait_position = """      const y = imageFrame.top + yNorm * imageFrame.height;
      const badgeW = 132;
      const gap = 6;
      const imageLeft = imageFrame.left + 4;
      const imageRight = imageFrame.left + imageFrame.width - 4;

      let rawLeft;
      const rightCandidate = x2 + gap;
      const leftCandidate = x1 - gap - badgeW;
      if (rightCandidate + badgeW <= imageRight) rawLeft = rightCandidate;
      else if (leftCandidate >= imageLeft) rawLeft = leftCandidate;
      else rawLeft = imageRight - badgeW;

      const rawTop = y - 36;
      return {
        left: Math.max(imageLeft, Math.min(imageRight - badgeW, rawLeft)),
        top: Math.max(imageFrame.top + 4, Math.min(imageFrame.top + imageFrame.height - 34, rawTop)),
      };"""

new_wait_position = """      const y = imageFrame.top + yNorm * imageFrame.height;
      const badgeW = 96;
      const badgeH = 24;
      const gap = 7;
      const imageLeft = imageFrame.left + 4;
      const imageRight = imageFrame.left + imageFrame.width - 4;
      const lineMid = (x1 + x2) / 2;

      const atlas = String(analysis.pattern || '').toLowerCase();
      const waitDirection = analysis.bias ||
        (atlas.includes('breakout ascendent') || atlas.includes('rezisten') || atlas.includes('maxim') ? 'BUY' :
         atlas.includes('breakout descendent') || atlas.includes('suport') || atlas.includes('minim') ? 'SELL' : null);

      const rawLeft = lineMid - badgeW / 2;
      const rawTop = waitDirection === 'SELL'
        ? y + gap
        : y - badgeH - gap;

      return {
        left: Math.max(imageLeft, Math.min(imageRight - badgeW, rawLeft)),
        top: Math.max(imageFrame.top + 4, Math.min(imageFrame.top + imageFrame.height - badgeH - 4, rawTop)),
        width: badgeW,
      };"""

app = replace_once(app, old_wait_position, new_wait_position, 'poziționare verticală WAIT după BUY/SELL')

style_marker = """  opportunityChartConfirm: { borderColor: '#ffd34d', backgroundColor: 'rgba(18,16,7,0.90)' },"""
style_replacement = """  opportunityChartConfirm: { borderColor: '#ffd34d', backgroundColor: 'rgba(18,16,7,0.90)', minWidth: 0, paddingHorizontal: 5, paddingVertical: 3 },"""
app = replace_once(app, style_marker, style_replacement, 'badge WAIT compact')

text_style_marker = """  opportunityChartText: { fontSize: 10, lineHeight: 12, fontWeight: '900', letterSpacing: 0.05 },"""
text_style_replacement = """  opportunityChartText: { fontSize: 10, lineHeight: 12, fontWeight: '900', letterSpacing: 0.05, textAlign: 'center' },"""
app = replace_once(app, text_style_marker, text_style_replacement, 'aliniere text badge')

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.50 aplicat: badge CONFIRMARE compact, deasupra rezistenței sau sub suport, fără a acoperi lumânările.')
