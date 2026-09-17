from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.29 — ON-CHART OPPORTUNITY LABELS
# - păstrează cardul ZONĂ BUY / ZONĂ SELL din v0.3.28;
# - adaugă același scor direct pe grafic, lângă marginea relevantă a culoarului;
# - eticheta este doar vizuală: nu schimbă logica BUY/SELL/WAIT și nu transformă zona în semnal.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.28 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.29 TEST</Text>",
    'badge v0.3.29',
)

marker = "  const trendLineStyle = (line: NonNullable<AnalysisResult['trendLines']>[number]) => {"
if marker not in app:
    raise SystemExit('trendLineStyle nu a fost găsit; build oprit pentru siguranță.')

opportunity_style = r'''  const opportunityLabelStyle = useMemo(() => {
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
  }, [analysis, imageFrame, previewSize]);

'''
app = app.replace(marker, opportunity_style + marker, 1)

render_marker = """          {arrowStyle && analysis && (
            <View style={[styles.arrowWrap, arrowStyle]} pointerEvents=\"none\">"""
render_block = """          {opportunityLabelStyle && analysis?.opportunityDirection && analysis.opportunityScore != null && (
            <View
              pointerEvents=\"none\"
              style={[
                styles.opportunityChartBadge,
                opportunityLabelStyle,
                analysis.opportunityDirection === 'BUY' ? styles.opportunityChartBuy : styles.opportunityChartSell,
              ]}
            >
              <Text style={[styles.opportunityChartText, analysis.opportunityDirection === 'BUY' ? styles.buy : styles.sell]}>
                ZONĂ {analysis.opportunityDirection} {analysis.opportunityScore}%
              </Text>
            </View>
          )}
          {arrowStyle && analysis && (
            <View style={[styles.arrowWrap, arrowStyle]} pointerEvents=\"none\">"""
app = replace_once(app, render_marker, render_block, 'eticheta oportunitate pe grafic')

style_marker = """  opportunityDisclaimer: { color: '#68778a', marginTop: 5, fontSize: 10, lineHeight: 14 },"""
style_block = """  opportunityDisclaimer: { color: '#68778a', marginTop: 5, fontSize: 10, lineHeight: 14 },
  opportunityChartBadge: { position: 'absolute', zIndex: 6, minWidth: 106, borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, alignItems: 'center', backgroundColor: 'rgba(7,11,18,0.86)' },
  opportunityChartBuy: { borderColor: 'rgba(56,217,150,0.92)' },
  opportunityChartSell: { borderColor: 'rgba(255,100,100,0.92)' },
  opportunityChartText: { fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.1 },"""
app = replace_once(app, style_marker, style_block, 'stil etichetă oportunitate pe grafic')
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.16';",
    "const ENGINE_VERSION='0.3.17';",
    'engine version 0.3.17',
)
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.29 aplicat: ZONĂ BUY/SELL + procent apar și direct pe grafic, lângă marginea relevantă a culoarului; logica rămâne neschimbată.')
