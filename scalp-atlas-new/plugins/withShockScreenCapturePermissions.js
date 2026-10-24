/** Android prerequisites for a future user-consented MediaProjection screen capture.
 * IMPORTANT: Permissions do NOT implement MediaProjection or draw-over-apps.
 * Runtime user consent, foreground service and native frame pipeline are still required.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const REQUIRED = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
];

module.exports = function withShockScreenCapturePermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const name of REQUIRED) {
      if (!manifest['uses-permission'].some((item) => item.$?.['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }
    return config;
  });
};
