"""SCALP ATLAS v1.0.56: remove arbitrary 20-65 second M5 signal window.

Only M5: keep verified countdown, 2 successive OCR reads, correct timeframe
and pair identification, stable direction, confirmed candle-color checks,
per-bar deduplication, and one BIP for a FULLY confirmed signal.

Do not treat a visible CANDIDAT as an order instruction.
Do not change M10 rules, interface, or the audio gates.
"""
from pathlib import Path

p=Path(".github/native-overlay/ScalpOverlayService.kt")
s=p.read_text(encoding="utf-8")
old='''    // EARLY M5 BIP GUARD v1.0.47.
    // Early window 00:20..01:05 after current M5 candle opens:
    // 4:40..3:55 remaining. A five-minute option trade spans the next bar;
    // no claim that this timing predicts the direction or ensures profit.
    if (remaining !in 235..280) {
      return "M5: semnal prea târziu/devreme • testează doar în primele 20–65 secunde"
    }'''
new='''    // M5 COUNTDOWN GUARD v1.0.56:
    // Allow verified alerts throughout the *middle* of an M5 candle.
    // Exclude opening/closing 30s to avoid OCR/bar rollover instability,
    // not because the time itself predicts profitable direction.
    // CANDIDAT stays visible without a BIP even during these exclusions.
    if (remaining !in 30..270) {
      return "M5: verifică lumânarea stabilă • fără BIP în primele/ultimele 30 secunde"
    }'''
if s.count(old)!=1:
    raise SystemExit("M5 timing guard not found uniquely; cannot apply v1.0.56 safely")
s=s.replace(old,new,1)
if s.count("M5 COUNTDOWN GUARD v1.0.56")!=1:
    raise SystemExit("v1.0.56 marker absent")
if "M10 5-MINUTE ENTRY GUARD v1.0.44" not in s:
    raise SystemExit("M10 safety policy was removed unexpectedly")
if "ONE-DIRECTION GUARD v1.0.49" not in s or "ONE-ALERT-PER-M10-BAR v1.0.45" not in s:
    raise SystemExit("Direction guard or per-bar dedupe missing")
if "m5EntryTimingRejection(now)" not in s or "noteChartCountdownFromChart" not in s:
    raise SystemExit("M5 countdown evidence validation missing")
p.write_text(s,encoding="utf-8")
print("SCALP ATLAS v1.0.56: M5 OCR guard 30..270s remaining; M10 unchanged")
