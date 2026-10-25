# ScalpAtlas-SHOCK — isolated development branch

This branch is reserved for the new single-candle SHOCK detector and Android overlay. It does **not** replace the existing ScalpAtlas 3.2.7 application.

## Current state

- The latest v0.22 prototype is a local ZIP, not yet committed to this branch.
- No Android APK has been compiled from v0.22 here.
- No verified Pocket Option candle extraction exists.
- Do not emit BUY, SELL, or audible trade alerts based solely on green/red pixels.
- The approved compact overlay remains unchanged.

## Next build steps

1. Import the v0.22 source tree into this branch.
2. Run `npm test` and compile the Android app using its Gradle wrapper in GitHub Actions.
3. Fix compile errors, obtain the debug APK artifact, and install it on Motorola for UI/capture testing.
4. Validate active-candle extraction against consecutive captured frames before connecting the SHOCK engine or enabling alerts.

No claims of real-time trading functionality or signal accuracy should be made until these steps pass.
