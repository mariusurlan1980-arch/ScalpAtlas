package com.scalpatlas.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ScalpOverlayModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val CAPTURE_REQUEST = 4815
    private var capturePromise: Promise? = null
  }

  private val activityListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != CAPTURE_REQUEST) return

      val promise = capturePromise
      capturePromise = null

      if (resultCode != Activity.RESULT_OK || data == null) {
        promise?.reject("CAPTURE_DENIED", "Capturarea ecranului nu a fost permisă.")
        return
      }

      val serviceIntent = Intent(reactContext, ScalpOverlayService::class.java).apply {
        action = ScalpOverlayService.ACTION_START
        putExtra(ScalpOverlayService.EXTRA_RESULT_CODE, resultCode)
        putExtra(ScalpOverlayService.EXTRA_RESULT_DATA, data)
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactContext.startForegroundService(serviceIntent)
      } else {
        reactContext.startService(serviceIntent)
      }

      promise?.resolve("STARTED")
    }
  }

  init {
    reactContext.addActivityEventListener(activityListener)
  }

  override fun getName(): String = "ScalpOverlay"

  @ReactMethod
  fun startOverlayMode(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Aplicația nu este activă.")
      return
    }

    if (!Settings.canDrawOverlays(reactContext)) {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:" + reactContext.packageName)
      ).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve("OVERLAY_PERMISSION_REQUIRED")
      return
    }

    if (capturePromise != null) {
      promise.reject("BUSY", "Cererea pentru capturarea ecranului este deja deschisă.")
      return
    }

    val manager = reactContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    capturePromise = promise
    activity.startActivityForResult(manager.createScreenCaptureIntent(), CAPTURE_REQUEST)
  }

  /**
   * Expose the ACTUAL installed versionCode to the main screen.
   * This detects stale APKs and accidentally opened duplicate apps without
   * writing any version label over the broker chart.
   */
  @ReactMethod
  fun getBuildInfo(promise: Promise) {
    try {
      val info = reactContext.packageManager.getPackageInfo(reactContext.packageName, 0)
      val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        info.longVersionCode
      } else {
        @Suppress("DEPRECATION")
        info.versionCode.toLong()
      }
      promise.resolve("BUILD " + versionCode + " · " + reactContext.packageName)
    } catch (error: Throwable) {
      promise.reject("BUILD_INFO_ERROR", "Nu pot citi versiunea instalată.", error)
    }
  }

  /**
   * Read only non-sensitive LIVE counters and gating status. The user can
   * inspect why SCAN is blocked on the home screen; no image is exported.
   */
  @ReactMethod
  fun getLiveDiagnostics(promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(
        "scalp_atlas_live_diagnostics", Context.MODE_PRIVATE
      )
      val now = System.currentTimeMillis()
      val updatedAt = prefs.getLong("updatedAt", 0L)
      val fresh = updatedAt > 0L && updatedAt <= now && now - updatedAt <= 8_000L
      val stage = if (fresh) prefs.getString("stage", "OPRIT") ?: "OPRIT" else "OPRIT"
      if (stage == "OPRIT") {
        promise.resolve("FLUX OPRIT · pornește LIVE pentru diagnostic")
      } else {
        val tf = prefs.getString("timeframe", "AUTO ?") ?: "AUTO ?"
        val pair = prefs.getString("pair", "NEIDENTIFICAT") ?: "NEIDENTIFICAT"
        val reason = prefs.getString("reason", "În verificare") ?: "În verificare"
        val frames = prefs.getLong("frames", 0L)
        val results = prefs.getLong("results", 0L)
        val errors = prefs.getLong("errors", 0L)
        promise.resolve(
          "FLUX " + stage + " · TF " + tf + " · " + pair + "\n" +
            "Cadre " + frames + " · Analize " + results + " · Erori " + errors +
            "\n" + reason
        )
      }
    } catch (error: Throwable) {
      promise.reject("LIVE_DIAGNOSTICS_ERROR", "Nu pot citi starea LIVE.", error)
    }
  }

  @ReactMethod
  fun stopOverlayMode(promise: Promise) {
    // stopService is immediate and works even when Android forbids starting
    // background services; onDestroy removes the floating window and capture.
    val intent = Intent(reactContext, ScalpOverlayService::class.java)
    reactContext.stopService(intent)
    promise.resolve("STOPPED")
  }
}
