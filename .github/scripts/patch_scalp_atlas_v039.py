from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.9 rulează DUPĂ patch-urile v0.3.2 ... v0.3.8.
# Modificare exclusiv vizuală, aleasă de utilizator: „Varianta 3”.
# - săgeata BUY/SELL devine mai mică, slim și elegantă;
# - corp îngust + cap compact, aprox. lățimea unei lumânări;
# - aceeași geometrie pentru BUY și SELL (SELL este rotit 180°);
# - motorul de analiză și regulile de confirmare NU se schimbă.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.8 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.9 TEST</Text>",
    'badge v0.3.9',
)

old_arrow_block = """          {arrowStyle && analysis && (
            <View style={[styles.arrowWrap, arrowStyle]} pointerEvents=\"none\">
              <Text style={[styles.arrow, analysis.signal === 'BUY' ? styles.buy : styles.sell]}>
                {analysis.signal === 'BUY' ? '↑' : '↓'}
              </Text>
            </View>
          )}"""

new_arrow_block = """          {arrowStyle && analysis && (
            <View style={[styles.arrowWrap, arrowStyle]} pointerEvents=\"none\">
              <View style={[styles.arrowSlim, analysis.signal === 'SELL' && styles.arrowSlimDown]}>
                <View style={[
                  styles.arrowHeadSlim,
                  { borderBottomColor: analysis.signal === 'BUY' ? '#38d996' : '#ff6464' },
                ]} />
                <View style={[
                  styles.arrowStemSlim,
                  { backgroundColor: analysis.signal === 'BUY' ? '#38d996' : '#ff6464' },
                ]} />
              </View>
            </View>
          )}"""
app = replace_once(app, old_arrow_block, new_arrow_block, 'săgeată slim Varianta 3')

old_position = """    return {
      left: Math.min(previewSize.width - 42, Math.max(4, offsetX + analysis.anchorX * displayW + 3)),
      top: Math.min(previewSize.height - 48, Math.max(4, offsetY + analysis.anchorY * displayH - 20)),
    };"""
new_position = """    return {
      left: Math.min(previewSize.width - 30, Math.max(4, offsetX + analysis.anchorX * displayW + 3)),
      top: Math.min(previewSize.height - 36, Math.max(4, offsetY + analysis.anchorY * displayH - 14)),
    };"""
app = replace_once(app, old_position, new_position, 'poziționare pentru săgeata slim')

old_styles = """  arrowWrap: { position: 'absolute', width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 42, lineHeight: 44, fontWeight: '900', textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },"""
new_styles = """  arrowWrap: { position: 'absolute', width: 26, height: 32, alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  // Varianta 3: semnal compact, aproximativ cât o lumânare, fără volum excesiv.
  arrowSlim: { width: 16, height: 27, alignItems: 'center', justifyContent: 'flex-start' },
  arrowSlimDown: { transform: [{ rotate: '180deg' }] },
  arrowHeadSlim: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  arrowStemSlim: { width: 3, height: 16, borderRadius: 2, marginTop: -1 },"""
app = replace_once(app, old_styles, new_styles, 'stil săgeată slim Varianta 3')

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.9 aplicat: săgeată BUY/SELL Varianta 3 — slim, compactă și mai puțin voluminoasă.')
