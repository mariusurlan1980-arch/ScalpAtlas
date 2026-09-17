from pathlib import Path
import re

APP = Path('scalp-atlas-new/App.tsx')

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)

app = APP.read_text(encoding='utf-8')

new_platforms = """const PLATFORM_HUB = [
  { n: 1,  mark: '▶', name: 'Google Play', sub: 'Android',       color: '#16c96f', url: 'https://play.google.com/store/search?q=Scalp%20Atlas&c=apps' },
  { n: 2,  mark: 'A', name: 'App Store',   sub: 'iPhone / iOS', color: '#2da8ff', url: 'https://apps.apple.com/us/search?term=Scalp%20Atlas' },
  { n: 3,  mark: 'f', name: 'Facebook',    sub: '',             color: '#1877f2', url: 'https://www.facebook.com' },
  { n: 4,  mark: 'X', name: 'X (Twitter)', sub: '',             color: '#101216', url: 'https://x.com' },
  { n: 5,  mark: '◎', name: 'Instagram',   sub: '',             color: '#df2ca6', url: 'https://www.instagram.com' },
  { n: 6,  mark: 'M', name: 'Messenger',   sub: '',             color: '#8b42ff', url: 'https://www.messenger.com' },
  { n: 7,  mark: '☎', name: 'WhatsApp',    sub: '',             color: '#20c864', url: 'https://www.whatsapp.com' },
  { n: 8,  mark: '♪', name: 'TikTok',      sub: '',             color: '#080b10', url: 'https://www.tiktok.com' },
  { n: 9,  mark: '➤', name: 'Telegram',    sub: '',             color: '#2aa9e9', url: 'https://telegram.org' },
  { n: 10, mark: '◉', name: 'Discord',     sub: '',             color: '#5865f2', url: 'https://discord.com/app' },
  { n: 11, mark: '▶', name: 'YouTube',     sub: '',             color: '#ff1744', url: 'https://www.youtube.com' },
  { n: 12, mark: 'P', name: 'Pinterest',   sub: '',             color: '#e60023', url: 'https://www.pinterest.com' },
  { n: 13, mark: 'in',name: 'LinkedIn',    sub: '',             color: '#0a78c7', url: 'https://www.linkedin.com' },
  { n: 14, mark: 'r', name: 'Reddit',      sub: '',             color: '#ff5b1a', url: 'https://www.reddit.com' },
  { n: 15, mark: '@', name: 'Threads',     sub: '',             color: '#0c0d10', url: 'https://www.threads.net' },
  { n: 16, mark: '✉', name: 'Email',       sub: '',             color: '#2da8ff', url: 'mailto:?subject=SCALP%20ATLAS&body=SCALP%20ATLAS%20-%20analiza%20grafice%20cu%2070%20de%20modele.' },
] as const;"""

app, count = re.subn(r"const PLATFORM_HUB = \[.*?\n\] as const;", new_platforms, app, count=1, flags=re.S)
if count != 1:
    raise SystemExit('PLATFORM_HUB: blocul nu a fost găsit exact o dată.')

photo_hub = r'''
        <View style={styles.platformHub}>
          <View style={styles.platformHubHeader}>
            <Text style={styles.platformHubKicker}>
              <Text style={{ color: '#23c7ff' }}>SCALP </Text>
              <Text style={{ color: '#9a65ff' }}>ATLAS</Text>
            </Text>
            <Text style={styles.platformHubTitle}>PE TOATE PLATFORMELE</Text>
            <Text style={styles.platformHubText}>
              Descarcă, instalează sau intră pe platformele tale preferate. Un singur click, oriunde în lume.
            </Text>
          </View>

          <View style={styles.platformGrid}>
            {PLATFORM_HUB.map((platform) => (
              <Pressable key={platform.n} onPress={() => openPlatform(platform.url, platform.name)} style={styles.platformCard}>
                <Text style={styles.platformNumberText}>{platform.n}</Text>
                <View style={[styles.platformMark, { backgroundColor: platform.color }]}>
                  <Text style={styles.platformMarkText}>{platform.mark}</Text>
                </View>
                <View style={styles.platformCopy}>
                  <Text style={styles.platformName}>{platform.name}</Text>
                  {!!platform.sub && <Text style={styles.platformSub}>{platform.sub}</Text>}
                </View>
                <Text style={styles.platformArrow}>›</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} style={styles.openAtlasButton}>
            <View pointerEvents="none" style={styles.openAtlasGlowLeft} />
            <View pointerEvents="none" style={styles.openAtlasGlowRight} />
            <Text style={styles.openAtlasButtonText}>🚀  DESCHIDE SCALP ATLAS</Text>
            <Text style={styles.openAtlasButtonSub}>Lansează aplicația acum</Text>
          </Pressable>

          <View style={styles.deviceBlock}>
            <View style={styles.deviceIcons}>
              <Text style={styles.deviceIcon}>▯</Text>
              <Text style={styles.deviceIcon}>▭</Text>
              <Text style={styles.deviceIcon}>▱</Text>
              <Text style={styles.deviceIcon}>▣</Text>
              <Text style={styles.deviceIcon}>⌚</Text>
            </View>
            <Text style={styles.deviceText}>Disponibil pe telefoane, tablete, PC și smartwatch</Text>
          </View>

          <View style={styles.tradeLimitRow}>
            <View style={styles.tradeLimitLine} />
            <Text style={styles.tradeLimitText}>🌐  TRADING FĂRĂ LIMITĂ</Text>
            <View style={styles.tradeLimitLine} />
          </View>

          <View style={styles.worldSection}>
            <View style={styles.earthGlow} />
            <View style={styles.earthBody}>
              <View style={[styles.earthArc, { top: 18 }]} />
              <View style={[styles.earthArc, { top: 48, transform: [{ rotate: '-7deg' }] }]} />
              <View style={[styles.earthArc, { top: 78, transform: [{ rotate: '9deg' }] }]} />
              <View style={[styles.earthLight, { left: '15%', top: '38%' }]} />
              <View style={[styles.earthLight, { left: '28%', top: '55%' }]} />
              <View style={[styles.earthLight, { left: '42%', top: '32%' }]} />
              <View style={[styles.earthLight, { left: '57%', top: '51%' }]} />
              <View style={[styles.earthLight, { left: '69%', top: '36%' }]} />
              <View style={[styles.earthLight, { left: '80%', top: '60%' }]} />
            </View>
            <View style={styles.worldCopy}>
              <Text style={styles.worldTitle}>
                <Text style={{ color: '#2cc9ff' }}>SCALP </Text>
                <Text style={{ color: '#b55dff' }}>ATLAS</Text>
              </Text>
              <Text style={styles.worldSubtitle}>ORIUNDE TE AFLI</Text>
            </View>
          </View>
        </View>
'''

start = "        <View style={styles.platformHub}>"
end = "\n      </ScrollView>"
i = app.find(start)
j = app.find(end, i)
if i < 0 or j < 0:
    raise SystemExit('Secțiunea Platform Hub nu a fost găsită pentru înlocuire.')
app = app[:i] + photo_hub + app[j:]

new_styles = r'''  platformHub: { marginTop: 8, backgroundColor: '#02070d', paddingHorizontal: 4, paddingTop: 12, paddingBottom: 0, gap: 16 },
  platformHubHeader: { alignItems: 'center', gap: 4, paddingHorizontal: 12 },
  platformHubKicker: { fontWeight: '900', fontSize: 28, letterSpacing: 1.1, textShadowColor: 'rgba(55,130,255,0.38)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 5 },
  platformHubTitle: { color: '#d2d7ff', fontWeight: '900', fontSize: 15, letterSpacing: 1.2 },
  platformHubText: { color: '#d3d8e2', fontSize: 12.3, lineHeight: 18, textAlign: 'center', marginTop: 5, maxWidth: 430 },
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 9 },
  platformCard: { width: '48.5%', minHeight: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1.3, borderColor: '#1188c6', borderRadius: 12, backgroundColor: '#07111a', paddingHorizontal: 8, paddingVertical: 7, gap: 7 },
  platformCardPressed: { opacity: 0.8 },
  platformNumber: { width: 0, height: 0 },
  platformNumberText: { width: 18, color: '#f4f8ff', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  platformMark: { width: 31, height: 31, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  platformMarkText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  platformCopy: { flex: 1, minWidth: 0 },
  platformName: { color: '#f8fbff', fontSize: 11.8, fontWeight: '900' },
  platformSub: { color: '#b8c0ca', fontSize: 8.3, marginTop: 1 },
  platformArrow: { color: '#72d8ff', fontSize: 24, lineHeight: 24, fontWeight: '800' },
  shareAllButton: { display: 'none' },
  shareAllButtonText: { color: '#ffffff' },
  shareAllButtonSub: { color: '#ffffff' },
  openAtlasButton: { position: 'relative', overflow: 'hidden', borderRadius: 14, borderWidth: 1.2, borderColor: '#885dff', backgroundColor: '#4e31e7', paddingVertical: 15, paddingHorizontal: 12, alignItems: 'center', marginTop: 1 },
  openAtlasGlowLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '58%', backgroundColor: '#00a8ff', opacity: 0.78 },
  openAtlasGlowRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '52%', backgroundColor: '#d146ff', opacity: 0.55 },
  openAtlasButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '900', letterSpacing: .35 },
  openAtlasButtonSub: { color: '#eef1ff', fontSize: 11.5, marginTop: 3, fontWeight: '700' },
  deviceBlock: { alignItems: 'center', gap: 6, paddingTop: 2 },
  deviceIcons: { width: '84%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deviceIcon: { color: '#dce8f5', fontSize: 34, lineHeight: 38, fontWeight: '300' },
  deviceRow: { alignItems: 'center' },
  deviceText: { color: '#d3dae4', fontSize: 10.5, textAlign: 'center' },
  tradeLimitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 1 },
  tradeLimitLine: { flex: 1, height: 2, backgroundColor: '#149ee9', borderRadius: 2 },
  tradeLimitText: { color: '#1fc2ff', fontSize: 11, fontWeight: '900', letterSpacing: .4 },
  worldSection: { height: 230, overflow: 'hidden', marginHorizontal: -4, marginTop: -3, alignItems: 'center', justifyContent: 'flex-end', backgroundColor: '#01050a' },
  earthGlow: { position: 'absolute', bottom: -74, width: '120%', height: 230, borderRadius: 260, backgroundColor: '#0b5d9f', opacity: 0.28, shadowColor: '#22bfff', shadowOpacity: 0.9, shadowRadius: 26, shadowOffset: { width: 0, height: -8 }, elevation: 10 },
  earthBody: { position: 'absolute', bottom: -106, width: '118%', height: 260, borderRadius: 260, backgroundColor: '#03284a', borderWidth: 2, borderColor: '#1bbcff', overflow: 'hidden' },
  earthArc: { position: 'absolute', left: '-5%', width: '110%', height: 1.5, backgroundColor: '#0f7fc1', opacity: 0.55 },
  earthLight: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: '#ffd879', shadowColor: '#ffd879', shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
  worldCopy: { position: 'absolute', bottom: 18, alignItems: 'center' },
  worldTitle: { fontSize: 27, fontWeight: '900', letterSpacing: 1.1, textShadowColor: 'rgba(83,117,255,0.65)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },
  worldSubtitle: { color: '#cdd8ff', fontSize: 15, fontWeight: '900', letterSpacing: 1.1, marginTop: 1 },
  worldwideText: { color: '#d8e6ff', fontSize: 11, fontWeight: '900', textAlign: 'center' },
'''

app, count = re.subn(r"  platformHub: \{.*?\n  worldwideText: .*?\n", new_styles, app, count=1, flags=re.S)
if count != 1:
    raise SystemExit('Blocul de stiluri Platform Hub nu a fost găsit exact o dată.')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.36 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.37 TEST</Text>",
    'badge v0.3.37',
)

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.37 aplicat: Platform Hub refăcut după macheta foto; motorul rămâne neschimbat.')
