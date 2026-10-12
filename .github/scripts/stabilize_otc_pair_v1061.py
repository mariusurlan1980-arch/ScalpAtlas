"""SCALP ATLAS v1.0.61 — stabilize the detected OTC pair without weakening alerts.

The old OCR returns EUR/RUB and EUR/RUB OTC for the SAME open OTC chart,
depending on whether ML Kit reads the faint "OTC" word. This made the
overlay reset its analysis even when the chart and M5 timeframe did not change.

- A temporary missing OTC suffix does not erase an already identified OTC
  instrument or reset candle/alert guards.
- A distinct newly detected instrument needs 2 matching OCR reads and
  suspends signal confirmations while that possible switch is pending.
- The verified timeframe remains in charge; no signal on AUTO timeframe.
- The existing UI/layout, overlay, bip, and underlying chart analysis are
  unchanged. This is LIVE SCREEN analysis, NOT numeric tick data.
"""
from pathlib import Path
p=Path('.github/native-overlay/ScalpOverlayService.kt')
s=p.read_text(encoding='utf-8')
def one(old,new,label):
    global s
    n=s.count(old)
    if n != 1:
        raise SystemExit(f'v1.0.61 {label}: need exactly 1 anchor, got {n}')
    s=s.replace(old,new,1)

one(
'  @Volatile private var currentPair = "—"\n',
'''  @Volatile private var currentPair = "—"
  // OTC OCR identity stability v1.0.61 (separate from timeframe OCR).
  @Volatile private var pairSwitchCandidate: String? = null
  @Volatile private var pairSwitchReads = 0
''',
'pair switch state'
)

one(
'''      if (detectedPair != null && detectedPair != currentPair) {
        resetSignalStateForMarketChange()
        currentPair = detectedPair
        changed = true
      }
''',
'''      // OTC OCR IDENTITY v1.0.61: ML Kit sometimes omits the faint OTC
      // suffix from EUR/RUB OTC. Such a PARTIAL read is not proof of a
      // different market. Keep the last explicitly observed OTC suffix and
      // avoid erasing candidate history on the same real chart.
      val otcSuffixTemporarilyMissing =
        detectedPair != null &&
        currentPair.endsWith(" OTC") &&
        detectedPair == currentPair.removeSuffix(" OTC")

      if (detectedPair != null && detectedPair != currentPair &&
          !otcSuffixTemporarilyMissing) {
        // Protect against one transient erroneous pair OCR result.
        if (pairSwitchCandidate == detectedPair) {
          pairSwitchReads = (pairSwitchReads + 1).coerceAtMost(2)
        } else {
          pairSwitchCandidate = detectedPair
          pairSwitchReads = 1
        }
        if (pairSwitchReads >= 2) {
          currentPair = detectedPair
          pairSwitchCandidate = null
          pairSwitchReads = 0
          changed = true
        }
      } else {
        // Successful repeated reading of the known pair, or no new
        // positive evidence of a market change, cancels a stale candidate.
        pairSwitchCandidate = null
        pairSwitchReads = 0
      }
''',
'OCR same-pair partial read'
)

# Check for a pending market switch before the existing signals/lock/beep
# are even evaluated. The original frame-ID and countdown guards remain.
one(
'''  private fun handleResult(result: JSONObject) {
    val now = System.currentTimeMillis()
''',
'''  private fun handleResult(result: JSONObject) {
    val now = System.currentTimeMillis()

    // SAFE MARKET SWITCH v1.0.61:
    // Do not let the previously detected pair's analysis authorize a bip
    // while the next chart pair is still only 1/2 OCR readings verified.
    if (pairSwitchCandidate != null) {
      candidateDir = null
      candidateBarKey = null
      candidateCount = 0
      candidateLastAt = 0L
      updateOverlay(
        "AȘTEAPTĂ",
        "$currentPair • $currentTimeframe • PERECHE ÎN VERIFICARE • NU INTRA",
        "Confirm perechea nouă 1/2 • FĂRĂ BIP"
      )
      return
    }
''',
'pending pair result veto'
)

# A verified changed instrument is reset only ONCE, after 2 reads; reuse
# the prior reset routine with its bar/candidate safety clearing.
if s.count('resetSignalStateForMarketChange()') < 2:
    raise SystemExit('v1.0.61 existing market-switch reset disappeared')
if 'LIVE SCREEN RESULT FRESHNESS v1.0.60' not in s:
    raise SystemExit('v1.0.61 stale-frame guard disappeared')
if 'ONE-DIRECTION GUARD v1.0.49' not in s:
    raise SystemExit('v1.0.61 direction consistency guard disappeared')
if s.count('playBip()') < 2:
    raise SystemExit('v1.0.61 sound handler disappeared')
p.write_text(s,encoding='utf-8')
print('v1.0.61: same OTC pair keeps its identity; 2 matching reads required to reset on new market')
