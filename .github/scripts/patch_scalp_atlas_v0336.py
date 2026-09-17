from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.36 — PLATFORM HUB PERFORMANCE
# - poziția 15 rămâne clar Threads (TikTok nu mai este duplicat);
# - reduce încărcarea inițială pe telefoane mai slabe;
# - motorul WebView pornește doar după ce există o fotografie de analizat;
# - reduce memoria imaginilor JPEG;
# - taie efectele grafice costisitoare și elimină randarea zonelor off-screen pe Android;
# - motorul BUY/SELL/WAIT rămâne neschimbat.

app = APP.read_text(encoding='utf-8')

# 15 = Threads, explicit.
old_15 = "  { n: 15, mark: '@', name: 'Threads', sub: 'Social', url: 'https://www.threads.net' },"
new_15 = "  { n: 15, mark: '@', name: 'Threads', sub: 'Social', url: 'https://www.threads.net' },"
if old_15 not in app:
    # acceptăm și varianta machetei în care TikTok era duplicat
    app = replace_once(
        app,
        "  { n: 15, mark: '♪', name: 'TikTok', sub: 'Video', url: 'https://www.tiktok.com' },",
        new_15,
        'platforma 15 Threads',
    )

# Scroll mai fluid pe Android: elementele foarte îndepărtate de ecran nu rămân toate desenate.
app = replace_once(
    app,
    "      <ScrollView ref={scrollRef} contentContainerStyle={styles.page}>",
    "      <ScrollView ref={scrollRef} contentContainerStyle={styles.page} removeClippedSubviews={Platform.OS === 'android'} overScrollMode=\"never\">",
    'optimizare ScrollView',
)

# Fotografii ceva mai compacte: suficient pentru screenshot-uri de grafice, mai puțin RAM/base64.
app = app.replace("        quality: 0.65,", "        quality: 0.55,")

# Motorul de analiză nu mai consumă WebView la pornirea aplicației fără imagine.
app = replace_once(
    app,
    "      {Platform.OS !== 'web' && (\n        <WebView",
    "      {Platform.OS !== 'web' && image && (\n        <WebView",
    'WebView lazy mount',
)

# La schimbarea imaginii, motorul va porni/repornit și READY va seta starea corect.
app = replace_once(
    app,
    "    setAnalysis(null);\n    setRemainingSeconds(0);",
    "    setAnalysis(null);\n    setEngineReady(false);\n    setRemainingSeconds(0);",
    'reset engine la imagine nouă',
)

# Eliminăm transformarea la apăsarea fiecărui card — efect mic vizual, dar inutil pe low-end.
app = replace_once(
    app,
    "                style={({ pressed }) => [styles.platformCard, pressed && styles.platformCardPressed]}",
    "                style={styles.platformCard}",
    'card platformă static',
)

# Eliminăm umbra/elevation costisitoare la scroll; păstrăm border-ul luminos.
app = replace_once(
    app,
    "  platformHub: { marginTop: 4, borderRadius: 20, borderWidth: 1, borderColor: '#164d78', backgroundColor: '#07111d', padding: 14, gap: 14, shadowColor: '#1aa8ff', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 4 },",
    "  platformHub: { marginTop: 4, borderRadius: 20, borderWidth: 1, borderColor: '#164d78', backgroundColor: '#07111d', padding: 14, gap: 14 },",
    'hub fără shadow costisitor',
)

# Nu mai avem nevoie de transformarea pentru card apăsat; stilul rămâne definit doar ca fallback neutru.
app = replace_once(
    app,
    "  platformCardPressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },",
    "  platformCardPressed: { opacity: 0.78 },",
    'stil pressed simplificat',
)

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.35 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.36 TEST</Text>",
    'badge v0.3.36',
)

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.36 aplicat: platforma 15 = Threads + pornire mai ușoară + scroll și memorie optimizate; motorul de analiză rămâne neschimbat.')
