from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.49 — WAIT BADGE VISUAL CLEANUP
# Feedback AUD/USD OTC M15:
# - linia galbenă de confirmare din v0.3.48 este corectă și vizibilă;
# - eticheta "ZONĂ DE CONFIRMARE" păstra însă conturul verde/roșu al oportunității,
#   ceea ce putea sugera BUY/SELL înainte de confirmare;
# - eticheta putea acoperi lumânările din zona curentă.
#
# Corecție exclusiv vizuală:
# - WAIT + bias => contur galben, fundal neutru;
# - poziția etichetei WAIT este calculată din linia galbenă de confirmare;
# - eticheta este plasată lateral de linie când există spațiu, altfel la marginea
#   dreaptă a fotografiei, deasupra nivelului;
# - BUY/SELL confirmat și Opportunity Zone păstrează culorile existente.
# Motorul de analiză și cele 70 de modele NU sunt modificate.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.48 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.49 TEST</Text>",
    'badge v0.3.49',
)

old_calc = """  const opportunityLabelStyle = useMemo(() => {
    if (!analysis?.opportunityDirection || analysis.opportunityScore == null || !imageFrame) return null;

    const targetKind = analysis.opportunityDirection === 'BUY' ? 'channelLower' : 'channelUpper';
    const channelLine = analysis.trendLines?.find((line) => line.kind === targetKind);
    const nx = channelLine?.x2 ?? analysis.anchorX ?? 0.72;
    const ny = channelLine?.y2 ?? analysis.anchorY ?? 0.50;

    const rawLeft = imageFrame.left + nx * imageFrame.width - 52;
    const rawTop = imageFrame.top + ny * imageFrame.height + (analysis.opportunityDirection === 'BUY' ? -34 : 10);

    return {
      left: Math.max(6, Math.min(previewSize.width - 118, rawLeft)),
      top: Math.max(6, Math.min(previewSize.height - 34, rawTop)),
    };
  }, [analysis, imageFrame, previewSize]);"""

new_calc = """  const opportunityLabelStyle = useMemo(() => {
    if (!analysis?.opportunityDirection || analysis.opportunityScore == null || !imageFrame) return null;

    const isWaitConfirmation = analysis.signal === 'NONE' && !!analysis.bias;
    if (isWaitConfirmation) {
      const confirmationLine = analysis.trendLines?.find((line) => line.kind === 'confirmation');
      const yNorm = confirmationLine?.y1 ?? analysis.anchorY ?? 0.50;
      const x1Norm = confirmationLine?.x1 ?? 0.18;
      const x2Norm = confirmationLine?.x2 ?? 0.82;
      const x1 = imageFrame.left + x1Norm * imageFrame.width;
      const x2 = imageFrame.left + x2Norm * imageFrame.width;
      const y = imageFrame.top + yNorm * imageFrame.height;
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
      };
    }

    const targetKind = analysis.opportunityDirection === 'BUY' ? 'channelLower' : 'channelUpper';
    const channelLine = analysis.trendLines?.find((line) => line.kind === targetKind);
    const nx = channelLine?.x2 ?? analysis.anchorX ?? 0.72;
    const ny = channelLine?.y2 ?? analysis.anchorY ?? 0.50;

    const rawLeft = imageFrame.left + nx * imageFrame.width - 52;
    const rawTop = imageFrame.top + ny * imageFrame.height + (analysis.opportunityDirection === 'BUY' ? -34 : 10);

    return {
      left: Math.max(6, Math.min(previewSize.width - 118, rawLeft)),
      top: Math.max(6, Math.min(previewSize.height - 34, rawTop)),
    };
  }, [analysis, imageFrame, previewSize]);"""

app = replace_once(app, old_calc, new_calc, 'poziționare etichetă WAIT după linia galbenă')

old_container = """                styles.opportunityChartBadge,
                opportunityLabelStyle,
                analysis.opportunityDirection === 'BUY' ? styles.opportunityChartBuy : styles.opportunityChartSell,
              ]}"""

new_container = """                styles.opportunityChartBadge,
                opportunityLabelStyle,
                analysis.signal === 'NONE' && analysis.bias
                  ? styles.opportunityChartConfirm
                  : analysis.opportunityDirection === 'BUY' ? styles.opportunityChartBuy : styles.opportunityChartSell,
              ]}"""

app = replace_once(app, old_container, new_container, 'contur galben WAIT')

style_marker = """  opportunityChartSell: { borderColor: 'rgba(255,100,100,0.92)' },"""
style_replacement = """  opportunityChartSell: { borderColor: 'rgba(255,100,100,0.92)' },
  opportunityChartConfirm: { borderColor: '#ffd34d', backgroundColor: 'rgba(18,16,7,0.90)' },"""
app = replace_once(app, style_marker, style_replacement, 'stil badge confirmare galben')

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.49 aplicat: ZONĂ DE CONFIRMARE are contur galben și poziționare laterală după linia galbenă.')
