from pathlib import Path
engine=Path(".github/templates/ScalpAtlasAnalysisEngineV0416.ts").read_text(encoding="utf-8")
native=Path(".github/native-overlay/ScalpOverlayService.kt").read_text(encoding="utf-8")
checks={
 "engine exports closed direction": "closedCandleDirection:evidence.ok?evidence.closedDirection:'NONE'" in engine,
 "engine exports two closed candles": "closedCandleCount:evidence.ok?2:0" in engine,
 "native reads candle direction": 'result.optString("closedCandleDirection", "NONE")' in native,
 "native reads candle count": 'result.optInt("closedCandleCount", 0)' in native,
 "native rejects mismatch": "twoClosedAgree &&" in native,
 "native signal is gated": "opticalGate && twoClosedAgree &&" in native,
 "original beep remains": "playBip(confirmedSignal)" in native,
}
for label,passed in checks.items():
 print(("PASS" if passed else "FAIL")+": "+label)
if not all(checks.values()):raise SystemExit("Candle-gate integration verification failed")
