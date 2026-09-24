# SCALP ATLAS 1.0.0 RC1 — Release checklist

## Feature freeze
No new product features are added after RC1. Only release-blocking fixes are allowed.

### Locked core
- CAMERA LIVE
- Chart Guard / invalid-frame protection
- 70-model atlas
- BUY / SELL / WAIT confirmation flow
- 2/2 signal stabilization
- Bip 1 confirmed-signal alert
- Estimated direction duration
- Timeframe AUTO
- History, statistics and journal
- 26 languages with AUTO device-language detection and manual language override
- Android, Web/PWA and iPhone/iPad project support

## Automated gates
- TypeScript check: required
- Android release build: required
- Web export: required
- iOS simulator build on Xcode 26: required
- 70-model atlas verification: required
- localization resources verification: required

## Real-device smoke test before promoting RC1 to final
1. Install RC1 on a physical Android device.
2. Open the app three times and verify onboarding behavior.
3. Grant camera permission and start CAMERA LIVE.
4. Point CAMERA LIVE at a valid trading chart on a second device.
5. Verify valid-chart detection and invalid-frame rejection.
6. Verify WAIT is possible and BUY/SELL is not forced.
7. Verify confirmed BUY/SELL requires the stabilization flow.
8. Verify Bip 1 occurs once for a confirmed signal and does not repeat continuously.
9. Verify timeframe and estimated direction duration are visible.
10. Switch several languages manually and return to AUTO.
11. Verify History, Statistics and Journal open without interrupting the app.
12. Leave and re-enter Live and confirm the app remains stable.
13. Test at least one low-light / blurry / partial-chart case.
14. Confirm no crash during a continuous live session.

## Release rule
Promote RC1 to SCALP ATLAS 1.0.0 FINAL only after all automated gates pass and the physical-device smoke test passes without a release-blocking issue.

## Store positioning
SCALP ATLAS provides technical visual chart analysis and estimated signals. It does not execute trades, manage funds, or guarantee results.
