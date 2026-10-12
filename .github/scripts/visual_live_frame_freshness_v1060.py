"""SCALP ATLAS v1.0.60: reject stale or out-of-order LIVE SCREEN responses.

Applied after all existing Kotlin overlay patches, before Android build.
Existing UI, screen capture, overlay, OCR, BIP and bar guards stay unchanged.

This confirms WHICH SCREEN FRAME produced a result. It does not provide
numeric prices, authenticated broker ticks, or profitable trade signals.
"""
from pathlib import Path

p=Path('.github/native-overlay/ScalpOverlayService.kt')
s=p.read_text(encoding='utf-8')

def one(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'v1.0.60 {label}: expected exactly once, got {n}')
    s=s.replace(old,new,1)

one(
'    private const val MIN_FRAME_INTERVAL_MS = 700L\n',
'''    private const val MIN_FRAME_INTERVAL_MS = 700L
    // LIVE SCREEN RESULT FRESHNESS v1.0.60. Images are NOT price-tick data.
    private const val MAX_LIVE_RESULT_AGE_MS = 4500L
''',
'result TTL')

one(
'  @Volatile private var frameCount = 0L\n',
'''  @Volatile private var frameCount = 0L
  @Volatile private var latestSubmittedFrameId = 0L
  @Volatile private var ignoredLateResults = 0L
''',
'frame metadata')

one(
'          "RESULT" -> {\n',
'''          "RESULT" -> {
            val responseFrameId = payload.optJSONObject("result")?.optLong("frameId", -1L) ?: -1L
            if (!isFreshLiveFrameResponse(responseFrameId)) {
              ignoredLateResults += 1
              // A delayed callback must never unlock the newer image request.
              if (responseFrameId == latestSubmittedFrameId) {
                analysisBusy = false
                clearVisualCandidateAfterExpiredFrame()
                updateOverlay(
                  "AȘTEAPTĂ",
                  "LIVE VIZUAL • cadru întârziat • FĂRĂ BIP",
                  "Imagine veche respinsă automat"
                )
              }
              return
            }
''',
'RESULT native callback')

one(
'          "ERROR" -> {\n',
'''          "ERROR" -> {
            val responseFrameId = payload.optLong("frameId", -1L)
            if (!isFreshLiveFrameResponse(responseFrameId)) {
              ignoredLateResults += 1
              if (responseFrameId == latestSubmittedFrameId) {
                analysisBusy = false
                clearVisualCandidateAfterExpiredFrame()
              }
              return
            }
''',
'ERROR native callback')

# Insert the frame acceptance helper outside AnalyzerBridge.
one(
'  private inner class AnalyzerBridge {\n',
'''  // Ignore results without a matching captured-image sequence or after the
  // 4.5-second age bound. Two overlapping WebView callbacks cannot authorize
  // a trade from an earlier image. This is visual LIVE, not numeric OHLC.
  private fun isFreshLiveFrameResponse(frameId: Long): Boolean {
    val now = System.currentTimeMillis()
    return frameId > 0L &&
      frameId == latestSubmittedFrameId &&
      analysisStartedAt > 0L &&
      now >= analysisStartedAt &&
      now - analysisStartedAt <= MAX_LIVE_RESULT_AGE_MS
  }

  private fun clearVisualCandidateAfterExpiredFrame() {
    candidateDir = null
    candidateBarKey = null
    candidateCount = 0
    candidateLastAt = 0L
  }

  private inner class AnalyzerBridge {
''',
'age helper')

one(
'''      frameCount += 1
      analysisBusy = true
''',
'''      frameCount += 1
      val submittedFrameId = frameCount
      val capturedTimeframe = currentTimeframe
      latestSubmittedFrameId = submittedFrameId
      analysisBusy = true
''',
'submission frame number')

old='''(if (currentTimeframe == "AUTO") "M15" else currentTimeframe) + "');",'''
new='''(if (capturedTimeframe == "AUTO") "M15" else capturedTimeframe) + "'," + submittedFrameId + ");",'''
if old not in s:
    raise SystemExit('v1.0.60 JS call anchor changed; cannot propagate image ID safely')
one(old,new,'native JS call frame ID')

# Label the live mode accurately in a narrow existing status, never create a
# new panel or change the user's familiar Clean View overlay interface.
old='''"M10 • flux ecran activ"'''
if old in s:
    s=s.replace(old, '"LIVE VIZUAL • flux ecran activ"',1)
elif '''"AUTO • flux ecran activ"''' in s:
    s=s.replace('''"AUTO • flux ecran activ"''',
                '''"LIVE VIZUAL • flux ecran activ"''',1)
else:
    print('INFO: existing startup status label retained')

checks=[
    'LIVE SCREEN RESULT FRESHNESS v1.0.60',
    'isFreshLiveFrameResponse(responseFrameId)',
    'latestSubmittedFrameId = submittedFrameId',
    '+ submittedFrameId + ");"',
    'clearVisualCandidateAfterExpiredFrame()',
]
for term in checks:
    if term not in s:
        raise SystemExit('v1.0.60 output safety gate missing: '+term)
if s.count('handleResult(result)') != 1:
    raise SystemExit('v1.0.60: unexpected handleResult call count')
p.write_text(s,encoding='utf-8')
print('v1.0.60 native visual frame IDs and out-of-order response veto installed')
