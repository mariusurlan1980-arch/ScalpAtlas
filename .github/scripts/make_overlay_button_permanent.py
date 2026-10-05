from pathlib import Path

p = Path("scalp-atlas-new/LiveAnalysisApp.tsx")
s = p.read_text(encoding="utf-8")

old = """                  {Platform.OS === 'android' && (
                    <View style={styles.overlayModeRow}>
                      <Pressable style={styles.overlayModeButton} onPress={() => void startOverlayMode()}>
                        <Text style={styles.overlayModeButtonText}>SUPRAPUNERE LIVE</Text>
                      </Pressable>
                      <Pressable style={styles.overlayStopButton} onPress={() => void stopOverlayMode()}>
                        <Text style={styles.overlayStopButtonText}>OPREȘTE</Text>
                      </Pressable>
                    </View>
                  )}
"""
if old in s:
    s = s.replace(old, "", 1)

anchor = """              )}

              <View
                style={styles.cameraWrap}
"""
permanent = """              )}

              {Platform.OS === 'android' && (
                <View style={styles.overlayModeRow}>
                  <Pressable style={styles.overlayModeButton} onPress={() => void startOverlayMode()}>
                    <Text style={styles.overlayModeButtonText}>SUPRAPUNERE LIVE · PESTE POCKET OPTION</Text>
                  </Pressable>
                  <Pressable style={styles.overlayStopButton} onPress={() => void stopOverlayMode()}>
                    <Text style={styles.overlayStopButtonText}>OPREȘTE</Text>
                  </Pressable>
                </View>
              )}
              {Platform.OS === 'android' && (
                <Text style={styles.overlayHint}>După pornire, deschide Pocket Option. Ține apăsat pe fereastra Scalp Atlas și trage pentru poziționare.</Text>
              )}

              <View
                style={styles.cameraWrap}
"""
if anchor not in s:
    raise SystemExit("cameraWrap anchor not found")
s = s.replace(anchor, permanent, 1)

style_anchor = "  overlayModeRow: { flexDirection: 'row', gap: 10, marginTop: 10 },\n"
if "overlayHint:" not in s:
    if style_anchor not in s:
        raise SystemExit("overlayModeRow style anchor not found")
    s = s.replace(
        style_anchor,
        style_anchor + "  overlayHint: { color: '#95a6bc', fontSize: 10, lineHeight: 14, marginTop: 6, marginBottom: 6, textAlign: 'center' },\n",
        1,
    )

p.write_text(s, encoding="utf-8")
