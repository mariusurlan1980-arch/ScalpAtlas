# Scalp Atlas 4.0 — Precision Scalping (implementation specification)

This branch is a safe workspace. Do not change the existing release or original alert sound.

## Required behavior
- Analyze M5/M10/M15, prefer M10; verify timeframe and that candles are **closed**.
- BUY only when the last two closed candles are bullish; SELL only when both are bearish.
- Also require aligned trend, swing high/low structure, and a confirmed pullback/impulse; never infer a trade from candle color alone.
- If screenshot quality, timeframe, or structure is uncertain: WAIT with a specific diagnostic reason; do not beep.
- Deduplicate signals using symbol + timeframe + closed candle timestamp + direction; no repeated alerts for one setup.
- UI: exactly one bell toggle controlling alerts; preserve original BIP asset and volume behavior.
- Keep manual trading only. No automated broker execution.
- Expiry 5 minutes is a test setting, not a performance guarantee.

## Verification before APK
1. Unit tests: bullish/bullish + aligned structure => eligible BUY; bearish/bearish => eligible SELL; mixed or open candles => WAIT.
2. Unknown timeframe, poor-quality image, sideways structure => WAIT with explicit reason.
3. Repeated analysis of same closed candles => at most one beep.
4. Bell OFF => no sound; ON => original BIP only.
5. Android build must pass; install and test on Motorola G24 DEMO before release.

Implementation not yet applied to Android source files; identify actual module paths before editing.
