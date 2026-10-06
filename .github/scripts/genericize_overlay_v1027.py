from pathlib import Path
import re

SERVICE = Path(".github/native-overlay/ScalpOverlayService.kt")
LIVE = Path(".github/templates/ScalpAtlasIntegratedLiveV100RC1.tsx")

s = SERVICE.read_text(encoding="utf-8")

# Branding: broker-neutral / chart-neutral.
repls = {
    "Analiză live automată peste Pocket Option": "Analiză live automată peste orice grafic",
    "POCKET OPTION DETECTAT • AUTO": "GRAFIC DETECTAT • AUTO",
    "POCKET OPTION NEDETECTAT": "GRAFIC NEDETECTAT",
    "POCKET OPTION GATE v1.0.22": "GENERIC CHART GATE v1.0.27",
    "POCKET OPTION CHART CROP v1.0.16": "GENERIC CHART CROP v1.0.27",
    "Pocket Option Classic mode has two large saturated action buttons near the": "Detectăm structură vizuală de grafic fără a depinde de un broker anume.",
    "lower part of the screen: green BUY and red SELL. We use those UI anchors": "Filtrul este intenționat permisiv; motorul Atlas păstrează controlul final de calitate.",
    "to stop Scalp Atlas from analyzing the launcher, wallpaper or another app.": "Astfel aplicația poate lucra cu platforme diferite și teme dark/light.",
    "pocketDetected": "chartDetected",
    "isPocketOptionFrame": "isTradingChartFrame",
    "onPocketOption": "onTradingChart",
}
for a,b in repls.items():
    s = s.replace(a,b)

# Start in true AUTO. No M10 assumption is shown or allowed to confirm a signal.
s = s.replace('@Volatile private var currentTimeframe = "M10"', '@Volatile private var currentTimeframe = "AUTO"')

# Replace the old broker-button detector with a broker-neutral visual chart detector.
pattern = re.compile(
    r"  private fun isTradingChartFrame\(bitmap: Bitmap\): Boolean \{.*?\n  \}\n\n  private fun resetSignalStateForMarketChange\(\)",
    re.S,
)
generic_gate = r'''  private fun isTradingChartFrame(bitmap: Bitmap): Boolean {
    // GENERIC CHART GATE v1.0.27
    // Nu căutăm logo, butoane BUY/SELL sau alte elemente ale unui broker.
    // Căutăm doar suficientă structură vizuală în zona centrală; motorul Atlas
    // decide ulterior dacă imaginea are calitate suficientă pentru analiză.
    val w = bitmap.width
    val h = bitmap.height
    if (w < 160 || h < 240) return false

    val x0 = (w * 0.05f).roundToInt().coerceIn(0, w - 2)
    val x1 = (w * 0.95f).roundToInt().coerceIn(x0 + 1, w)
    val y0 = (h * 0.12f).roundToInt().coerceIn(0, h - 2)
    val y1 = (h * 0.82f).roundToInt().coerceIn(y0 + 1, h)
    val step = 8

    var samples = 0
    var edges = 0
    var chromatic = 0
    var dark = 0
    var light = 0

    var y = y0
    while (y < y1) {
      var x = x0
      while (x < x1 - step) {
        val p = bitmap.getPixel(x, y)
        val q = bitmap.getPixel(x + step, y)

        val r = Color.red(p)
        val g = Color.green(p)
        val b = Color.blue(p)
        val lum = (r * 30 + g * 59 + b * 11) / 100

        val qr = Color.red(q)
        val qg = Color.green(q)
        val qb = Color.blue(q)
        val qLum = (qr * 30 + qg * 59 + qb * 11) / 100

        samples += 1
        if (kotlin.math.abs(lum - qLum) >= 24) edges += 1
        if (maxOf(r, g, b) - minOf(r, g, b) >= 34) chromatic += 1
        if (lum <= 55) dark += 1
        if (lum >= 190) light += 1
        x += step
      }
      y += step
    }

    if (samples <= 0) return false
    val edgeRatio = edges.toFloat() / samples
    val colorRatio = chromatic.toFloat() / samples
    val darkRatio = dark.toFloat() / samples
    val lightRatio = light.toFloat() / samples

    // Acceptă atât teme dark cât și light, inclusiv lumânări monocrome.
    return edgeRatio >= 0.035f &&
      (colorRatio >= 0.008f || darkRatio >= 0.08f || lightRatio >= 0.08f)
  }

  private fun resetSignalStateForMarketChange()'''
s, n = pattern.subn(generic_gate, s, count=1)
if n != 1:
    raise SystemExit("Nu am găsit detectorul broker-specific pentru înlocuire.")

# OCR should run on every plausible screen frame before the chart gate, so AUTO can resolve.
old = """      val onTradingChart = isTradingChartFrame(fullFrame)
      if (!onTradingChart) {"""
new = """      scheduleMarketOcr(fullFrame)

      val onTradingChart = isTradingChartFrame(fullFrame)
      if (!onTradingChart) {"""
if old not in s:
    raise SystemExit("Nu am găsit punctul de intrare al filtrului de grafic.")
s = s.replace(old, new, 1)
# Remove the old second OCR scheduling call if it still exists later.
first = s.find("      scheduleMarketOcr(fullFrame)")
second = s.find("      scheduleMarketOcr(fullFrame)", first + 1)
if second >= 0:
    s = s[:second] + s[second + len("      scheduleMarketOcr(fullFrame)\n"):]

# Use a supported internal timeframe for structural analysis while UI stays AUTO.
old = '''          "window.ScalpAtlasAnalyze && window.ScalpAtlasAnalyze(" + quotedUrl + ",'" + currentTimeframe + "');",'''
new = '''          "window.ScalpAtlasAnalyze && window.ScalpAtlasAnalyze(" + quotedUrl + ",'" + (if (currentTimeframe == "AUTO") "M15" else currentTimeframe) + "');",'''
if old not in s:
    raise SystemExit("Nu am găsit apelul nativ către motor.")
s = s.replace(old, new, 1)

# Never confirm/bip before the actual timeframe has been read.
needle = '''  private fun handleResult(result: JSONObject) {
    val now = System.currentTimeMillis()
'''
guard = '''  private fun handleResult(result: JSONObject) {
    val now = System.currentTimeMillis()

    if (currentTimeframe == "AUTO") {
      candidateDir = null
      candidateCount = 0
      candidateLastAt = 0L
      lockedDir = null
      lockedUntil = 0L
      val score = result.optInt("probability", 0)
      updateOverlay(
        "AȘTEAPTĂ",
        "TIMEFRAME AUTO • detectez din grafic",
        "Fără semnal până la identificarea timeframe-ului • Scor " + score + "%"
      )
      return
    }
'''
if needle not in s:
    raise SystemExit("Nu am găsit handleResult.")
s = s.replace(needle, guard, 1)

# Generic user-facing words in native service.
s = s.replace("POCKET", "GRAFIC")
s = s.replace("Pocket", "Grafic")
s = s.replace("pocket", "chart")

SERVICE.write_text(s, encoding="utf-8")

live = LIVE.read_text(encoding="utf-8")
live = live.replace("SUPRAPUNERE LIVE · PESTE POCKET OPTION", "SUPRAPUNERE LIVE · ORICE BROKER")
live = live.replace("UN SINGUR TELEFON • PESTE POCKET OPTION", "UN SINGUR TELEFON • ORICE GRAFIC")
live = live.replace("Deschide Pocket Option; perechea și timeframe-ul sunt detectate automat.", "Deschide graficul brokerului; instrumentul și timeframe-ul sunt detectate automat.")
live = live.replace("Pocket Option", "graficul brokerului")
live = live.replace("POCKET OPTION", "ORICE BROKER")
LIVE.write_text(live, encoding="utf-8")

# Safety check: final post-patch sources must be broker-neutral.
for path in (SERVICE, LIVE):
    text = path.read_text(encoding="utf-8")
    if "Pocket Option" in text or "POCKET OPTION" in text:
        raise SystemExit(f"Referință broker-specific rămasă în {path}")

print("v1.0.27: overlay generic, AUTO real și branding broker-neutral aplicate.")
