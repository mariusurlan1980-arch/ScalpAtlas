from pathlib import Path
p=Path(".github/templates/ScalpAtlasAnalysisEngineV0416.ts")
s=p.read_text(encoding="utf-8")
needle="opticalCandleGate:!!evidence.ok&&clear,"
assert s.count(needle)==1, "Analyzer structure changed"
s=s.replace(needle,needle+"\n            closedCandleDirection:evidence.ok?evidence.closedDirection:'NONE',\n            closedCandleCount:evidence.ok?2:0,")
p.write_text(s,encoding="utf-8")
p=Path(".github/native-overlay/ScalpOverlayService.kt")
s=p.read_text(encoding="utf-8")
needle='val opticalGate = result.optBoolean("opticalCandleGate", false)'
assert s.count(needle)==1, "Native gate structure changed"
s=s.replace(needle,needle+'\n    val closedCandleDirection = result.optString("closedCandleDirection", "NONE")\n    val closedCandleCount = result.optInt("closedCandleCount", 0)\n    val twoClosedAgree = closedCandleCount == 2 && closedCandleDirection == rawSignal')
needle='quality >= 55 && score >= 70 && opticalGate &&'
assert s.count(needle)==1, "Confirmation structure changed"
s=s.replace(needle,'quality >= 55 && score >= 70 && opticalGate && twoClosedAgree &&')
p.write_text(s,encoding="utf-8")
print("PASS: fail-closed two closed candle direction gate installed")
