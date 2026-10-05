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
    val activity = currentActivity
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

  @ReactMethod
  fun stopOverlayMode(promise: Promise) {
    val intent = Intent(reactContext, ScalpOverlayService::class.java).apply {
      action = ScalpOverlayService.ACTION_STOP
    }
    reactContext.startService(intent)
    promise.resolve("STOPPED")
  }
}
