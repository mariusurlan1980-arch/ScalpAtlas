from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.35 — PLATFORM HUB
# Adaugă în continuarea aplicației secțiunea inspirată din macheta nr. 2:
# - listă numerotată cu platformele principale;
# - butoane care deschid platforma/site-ul aferent;
# - buton nativ de distribuire prin aplicațiile instalate;
# - buton DESCHIDE SCALP ATLAS care revine la începutul aplicației;
# - nu modifică deloc motorul de analiză BUY/SELL/WAIT.
#
# Notă: aplicația are deja scrollRef din v0.3.4, deci v0.3.35 îl reutilizează.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "  Platform,\n  Pressable,",
    "  Platform,\n  Linking,\n  Share,\n  Pressable,",
    'import Linking/Share',
)

app = replace_once(
    app,
    "const TIMEFRAMES = ['M1', 'M2', 'M3', 'M5', 'M10', 'M15', 'M30', 'H1'];",
    """const TIMEFRAMES = ['M1', 'M2', 'M3', 'M5', 'M10', 'M15', 'M30', 'H1'];

const PLATFORM_HUB = [
  { n: 1,  mark: '▶', name: 'Google Play', sub: 'Android', url: 'https://play.google.com/store/search?q=Scalp%20Atlas&c=apps' },
  { n: 2,  mark: '', name: 'App Store', sub: 'iPhone / iOS', url: 'https://apps.apple.com/us/search?term=Scalp%20Atlas' },
  { n: 3,  mark: 'f', name: 'Facebook', sub: 'Social', url: 'https://www.facebook.com' },
  { n: 4,  mark: 'X', name: 'X', sub: 'Social', url: 'https://x.com' },
  { n: 5,  mark: '◎', name: 'Instagram', sub: 'Social', url: 'https://www.instagram.com' },
  { n: 6,  mark: 'M', name: 'Messenger', sub: 'Mesaje', url: 'https://www.messenger.com' },
  { n: 7,  mark: '◉', name: 'WhatsApp', sub: 'Mesaje', url: 'https://www.whatsapp.com' },
  { n: 8,  mark: '♪', name: 'TikTok', sub: 'Video', url: 'https://www.tiktok.com' },
  { n: 9,  mark: '✈', name: 'Telegram', sub: 'Mesaje', url: 'https://telegram.org' },
  { n: 10, mark: 'D', name: 'Discord', sub: 'Comunitate', url: 'https://discord.com/app' },
  { n: 11, mark: '▷', name: 'YouTube', sub: 'Video', url: 'https://www.youtube.com' },
  { n: 12, mark: 'P', name: 'Pinterest', sub: 'Social', url: 'https://www.pinterest.com' },
  { n: 13, mark: 'in', name: 'LinkedIn', sub: 'Profesional', url: 'https://www.linkedin.com' },
  { n: 14, mark: 'r', name: 'Reddit', sub: 'Comunitate', url: 'https://www.reddit.com' },
  { n: 15, mark: '@', name: 'Threads', sub: 'Social', url: 'https://www.threads.net' },
  { n: 16, mark: '✉', name: 'Email', sub: 'Distribuie', url: 'mailto:?subject=SCALP%20ATLAS&body=SCALP%20ATLAS%20-%20analiza%20grafice%20cu%2070%20de%20modele.' },
] as const;""",
    'constante Platform Hub',
)

insert_functions = r'''

  const openPlatform = async (url: string, name: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else setMessage(`${name} nu poate fi deschis pe acest dispozitiv.`);
    } catch {
      setMessage(`${name} nu a putut fi deschis.`);
    }
  };

  const shareScalpAtlas = async () => {
    try {
      await Share.share({
        title: 'SCALP ATLAS',
        message: 'SCALP ATLAS — analiză de grafice cu 70 de modele, Cameră + Galerie și Timeframe AUTO. În curând pe mai multe platforme.',
      });
    } catch {
      setMessage('Distribuirea nu a putut fi deschisă.');
    }
  };
'''

app = replace_once(
    app,
    "\n  return (\n    <SafeAreaView style={styles.safe}>",
    insert_functions + "\n  return (\n    <SafeAreaView style={styles.safe}>",
    'funcții Platform Hub',
)

platform_section = r'''

        <View style={styles.platformHub}>
          <View style={styles.platformHubHeader}>
            <Text style={styles.platformHubKicker}>SCALP ATLAS</Text>
            <Text style={styles.platformHubTitle}>PE TOATE PLATFORMELE</Text>
            <Text style={styles.platformHubText}>
              Deschide, distribuie sau caută Scalp Atlas pe platformele tale preferate.
            </Text>
          </View>

          <View style={styles.platformGrid}>
            {PLATFORM_HUB.map((platform) => (
              <Pressable
                key={platform.n}
                onPress={() => openPlatform(platform.url, platform.name)}
                style={({ pressed }) => [styles.platformCard, pressed && styles.platformCardPressed]}
              >
                <View style={styles.platformNumber}><Text style={styles.platformNumberText}>{platform.n}</Text></View>
                <View style={styles.platformMark}><Text style={styles.platformMarkText}>{platform.mark}</Text></View>
                <View style={styles.platformCopy}>
                  <Text style={styles.platformName}>{platform.name}</Text>
                  <Text style={styles.platformSub}>{platform.sub}</Text>
                </View>
                <Text style={styles.platformArrow}>›</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={shareScalpAtlas} style={styles.shareAllButton}>
            <Text style={styles.shareAllButtonText}>↗  DISTRIBUIE SCALP ATLAS</Text>
            <Text style={styles.shareAllButtonSub}>Alege orice aplicație instalată pe telefon</Text>
          </Pressable>

          <Pressable onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} style={styles.openAtlasButton}>
            <Text style={styles.openAtlasButtonText}>🚀  DESCHIDE SCALP ATLAS</Text>
            <Text style={styles.openAtlasButtonSub}>Revino la analiză</Text>
          </Pressable>

          <View style={styles.deviceRow}>
            <Text style={styles.deviceText}>Telefon • Tabletă • Android • iPhone/iOS • PC/Web</Text>
          </View>
          <Text style={styles.worldwideText}>SCALP ATLAS • ORIUNDE TE AFLI</Text>
        </View>
'''

app = replace_once(
    app,
    "      </ScrollView>\n\n      {Platform.OS !== 'web' && (",
    platform_section + "\n      </ScrollView>\n\n      {Platform.OS !== 'web' && (",
    'secțiune Platform Hub',
)

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.34 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.35 TEST</Text>",
    'badge v0.3.35',
)

style_block = r'''  platformHub: { marginTop: 4, borderRadius: 20, borderWidth: 1, borderColor: '#164d78', backgroundColor: '#07111d', padding: 14, gap: 14, shadowColor: '#1aa8ff', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  platformHubHeader: { alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  platformHubKicker: { color: '#30c5ff', fontWeight: '900', fontSize: 21, letterSpacing: 1.2 },
  platformHubTitle: { color: '#b7c8ff', fontWeight: '900', fontSize: 14, letterSpacing: 1.1 },
  platformHubText: { color: '#a9b7ca', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  platformCard: { width: '48.7%', minHeight: 62, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#1e5c86', borderRadius: 12, backgroundColor: '#0a1725', paddingHorizontal: 8, paddingVertical: 8, gap: 7 },
  platformCardPressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  platformNumber: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#102941', borderWidth: 1, borderColor: '#245a82' },
  platformNumberText: { color: '#d8e8f8', fontSize: 10, fontWeight: '900' },
  platformMark: { width: 27, height: 27, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#102d4b' },
  platformMarkText: { color: '#e9f6ff', fontSize: 14, fontWeight: '900' },
  platformCopy: { flex: 1, minWidth: 0 },
  platformName: { color: '#f5f8fc', fontSize: 11, fontWeight: '900' },
  platformSub: { color: '#70869e', fontSize: 8.5, marginTop: 1 },
  platformArrow: { color: '#7ccfff', fontSize: 21, lineHeight: 21, fontWeight: '600' },
  shareAllButton: { borderRadius: 13, borderWidth: 1, borderColor: '#2f8dd3', backgroundColor: '#0b3151', paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  shareAllButtonText: { color: '#dff5ff', fontSize: 13, fontWeight: '900', letterSpacing: .4 },
  shareAllButtonSub: { color: '#83b8d6', fontSize: 9.5, marginTop: 3 },
  openAtlasButton: { borderRadius: 14, borderWidth: 1, borderColor: '#8358ff', backgroundColor: '#172e7a', paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center' },
  openAtlasButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900', letterSpacing: .4 },
  openAtlasButtonSub: { color: '#c9d3ff', fontSize: 10, marginTop: 3 },
  deviceRow: { alignItems: 'center', borderTopWidth: 1, borderTopColor: '#16314a', paddingTop: 11 },
  deviceText: { color: '#91a8be', fontSize: 10.5, textAlign: 'center' },
  worldwideText: { color: '#2ebeff', fontSize: 11, fontWeight: '900', textAlign: 'center', letterSpacing: .8, marginBottom: 2 },
'''

app = replace_once(
    app,
    "  hiddenAnalyzer: { position: 'absolute', left: -20, top: -20, width: 2, height: 2, opacity: 0.01 },",
    style_block + "  hiddenAnalyzer: { position: 'absolute', left: -20, top: -20, width: 2, height: 2, opacity: 0.01 },",
    'stiluri Platform Hub',
)

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.35 aplicat: Platform Hub numerotat + distribuire nativă + buton DESCHIDE SCALP ATLAS; motorul de analiză rămâne neschimbat.')
