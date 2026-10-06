from pathlib import Path
import re

ANDROID = Path("scalp-atlas-new/android")
APP_MAIN = ANDROID / "app/src/main"
MANIFEST = APP_MAIN / "AndroidManifest.xml"

if not MANIFEST.exists():
    raise SystemExit("AndroidManifest.xml nu există. Rulează expo prebuild înainte de instalarea overlay-ului.")

manifest = MANIFEST.read_text(encoding="utf-8")

permissions = [
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
    "android.permission.POST_NOTIFICATIONS",
]
for perm in permissions:
    marker = f'android:name="{perm}"'
    if marker not in manifest:
        end = manifest.find(">", manifest.find("<manifest"))
        if end < 0:
            raise SystemExit("Manifest Android invalid.")
        manifest = manifest[: end + 1] + f'\n  <uses-permission android:name="{perm}" />' + manifest[end + 1 :]

service_xml = """
    <service
      android:name=".overlay.ScalpOverlayService"
      android:exported="false"
      android:stopWithTask="false"
      android:foregroundServiceType="mediaProjection" />
"""
if 'android:name=".overlay.ScalpOverlayService"' not in manifest:
    if "</application>" not in manifest:
        raise SystemExit("Tagul </application> nu a fost găsit.")
    manifest = manifest.replace("</application>", service_xml + "  </application>", 1)

MANIFEST.write_text(manifest, encoding="utf-8")

main_apps = list(APP_MAIN.rglob("MainApplication.kt"))
if not main_apps:
    raise SystemExit("MainApplication.kt nu a fost găsit după expo prebuild.")
main_app = main_apps[0]
text = main_app.read_text(encoding="utf-8")

if "import com.scalpatlas.app.overlay.ScalpOverlayPackage" not in text:
    import_anchor = "import com.facebook.react.PackageList\n"
    if import_anchor in text:
        text = text.replace(
            import_anchor,
            import_anchor + "import com.scalpatlas.app.overlay.ScalpOverlayPackage\n",
            1,
        )
    else:
        package_end = text.find("\n", text.find("package "))
        text = text[:package_end+1] + "import com.scalpatlas.app.overlay.ScalpOverlayPackage\n" + text[package_end+1:]

if "add(ScalpOverlayPackage())" not in text:
    text, count = re.subn(
        r"(PackageList\(this\)\.packages\.apply\s*\{)",
        r"\1\n              add(ScalpOverlayPackage())",
        text,
        count=1,
    )
    if count != 1:
        raise SystemExit("Nu am putut înregistra ScalpOverlayPackage în MainApplication.kt.")

main_app.write_text(text, encoding="utf-8")

overlay_dir = APP_MAIN / "java/com/scalpatlas/app/overlay"
overlay_dir.mkdir(parents=True, exist_ok=True)

package_code = r'''package com.scalpatlas.app.overlay

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ScalpOverlayPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(ScalpOverlayModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
'''
(overlay_dir / "ScalpOverlayPackage.kt").write_text(package_code, encoding="utf-8")

module_code = r'''package com.scalpatlas.app.overlay

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class ScalpOverlayModule(
  private val ctx: ReactApplicationContext
) : ReactContextBaseJavaModule(ctx), ActivityEventListener {

  companion object {
    private const val REQUEST_CAPTURE = 5127
    @Volatile var instance: ScalpOverlayModule? = null
  }

  private var capturePromise: Promise? = null

  init {
    instance = this
    ctx.addActivityEventListener(this)
  }

  override fun getName(): String = "ScalpOverlay"

  @ReactMethod
  fun hasOverlayPermission(promise: Promise) {
    promise.resolve(Settings.canDrawOverlays(ctx))
  }

  @ReactMethod
  fun requestOverlayPermission(promise: Promise) {
    try {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${ctx.packageName}")
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("OVERLAY_PERMISSION", e)
    }
  }

  @ReactMethod
  fun start(promise: Promise) {
    if (!Settings.canDrawOverlays(ctx)) {
      promise.reject("OVERLAY_PERMISSION", "Permisiunea «Afișare peste alte aplicații» nu este activă.")
      return
    }

    val activity = ctx.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "SCALP ATLAS trebuie să fie deschis pentru pornirea capturii.")
      return
    }

    if (capturePromise != null) {
      promise.reject("CAPTURE_BUSY", "Solicitarea de captură este deja deschisă.")
      return
    }

    try {
      val manager = ctx.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      capturePromise = promise
      activity.startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_CAPTURE)
    } catch (e: Exception) {
      capturePromise = null
      promise.reject("CAPTURE_START", e)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      ctx.stopService(Intent(ctx, ScalpOverlayService::class.java))
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("OVERLAY_STOP", e)
    }
  }

  @ReactMethod
  fun update(signal: String, probability: Double, timeframe: String, state: String, promise: Promise) {
    ScalpOverlayService.instance?.updateOverlay(signal, probability.toInt(), timeframe, state)
    promise.resolve(true)
  }

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CAPTURE) return

    val promise = capturePromise
    capturePromise = null

    if (resultCode != Activity.RESULT_OK || data == null) {
      promise?.reject("CAPTURE_DENIED", "Capturarea ecranului nu a fost acceptată.")
      return
    }

    try {
      val service = Intent(ctx, ScalpOverlayService::class.java).apply {
        action = ScalpOverlayService.ACTION_START
        putExtra(ScalpOverlayService.EXTRA_RESULT_CODE, resultCode)
        putExtra(ScalpOverlayService.EXTRA_RESULT_DATA, data)
      }
      androidx.core.content.ContextCompat.startForegroundService(ctx, service)
      promise?.resolve(true)
    } catch (e: Exception) {
      promise?.reject("SERVICE_START", e)
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  fun emitFrame(base64: String, uri: String, width: Int, height: Int, timestamp: Long) {
    if (!ctx.hasActiveReactInstance()) return
    val map = com.facebook.react.bridge.Arguments.createMap().apply {
      putString("base64", base64)
      putString("uri", uri)
      putInt("width", width)
      putInt("height", height)
      putDouble("timestamp", timestamp.toDouble())
    }
    ctx.runOnJSQueueThread {
      try {
        ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("ScalpOverlayFrame", map)
      } catch (_: Exception) {
      }
    }
  }
}
'''
(overlay_dir / "ScalpOverlayModule.kt").write_text(module_code, encoding="utf-8")

service_code = r'''package com.scalpatlas.app.overlay

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.Base64
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class ScalpOverlayService : Service() {

  companion object {
    const val ACTION_START = "com.scalpatlas.app.overlay.START"
    const val EXTRA_RESULT_CODE = "resultCode"
    const val EXTRA_RESULT_DATA = "resultData"
    private const val CHANNEL_ID = "scalp_atlas_overlay"
    private const val NOTIFICATION_ID = 1025
    private const val FRAME_INTERVAL_MS = 1800L
    @Volatile var instance: ScalpOverlayService? = null
  }

  private lateinit var windowManager: WindowManager
  private var overlayView: View? = null
  private var signalText: TextView? = null
  private var detailText: TextView? = null

  private var projection: MediaProjection? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var imageReader: ImageReader? = null
  private var captureThread: HandlerThread? = null
  private var captureHandler: Handler? = null
  private var lastCaptureAt = 0L

  override fun onCreate() {
    super.onCreate()
    instance = this
    createNotificationChannel()
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("SCALP ATLAS")
      .setContentText("Pocket Overlay activ")
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }

    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    createOverlay()
  }

  @Suppress("DEPRECATION")
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_START) {
      val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
      val resultData = intent.getParcelableExtra<Intent>(EXTRA_RESULT_DATA)
      if (resultCode != 0 && resultData != null && projection == null) {
        startProjection(resultCode, resultData)
      }
    }
    return START_STICKY
  }

  private fun startProjection(resultCode: Int, resultData: Intent) {
    val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    val mediaProjection = manager.getMediaProjection(resultCode, resultData) ?: run {
      stopSelf()
      return
    }
    projection = mediaProjection

    val metrics = resources.displayMetrics
    val width = max(1, metrics.widthPixels)
    val height = max(1, metrics.heightPixels)
    val density = max(1, metrics.densityDpi)

    captureThread = HandlerThread("ScalpOverlayCapture").also { it.start() }
    captureHandler = Handler(captureThread!!.looper)

    mediaProjection.registerCallback(object : MediaProjection.Callback() {
      override fun onStop() {
        stopSelf()
      }
    }, captureHandler)

    imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
    imageReader!!.setOnImageAvailableListener({ reader ->
      val now = System.currentTimeMillis()
      val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
      try {
        if (now - lastCaptureAt < FRAME_INTERVAL_MS) return@setOnImageAvailableListener
        lastCaptureAt = now

        val plane = image.planes[0]
        val buffer = plane.buffer
        val pixelStride = plane.pixelStride
        val rowStride = plane.rowStride
        val rowPadding = rowStride - pixelStride * width
        val paddedWidth = width + rowPadding / pixelStride

        val padded = Bitmap.createBitmap(paddedWidth, height, Bitmap.Config.ARGB_8888)
        buffer.rewind()
        padded.copyPixelsFromBuffer(buffer)

        val clean = Bitmap.createBitmap(padded, 0, 0, width, height)
        if (clean !== padded) padded.recycle()

        val scale = min(1f, 720f / width.toFloat())
        val outWidth = max(1, (width * scale).roundToInt())
        val outHeight = max(1, (height * scale).roundToInt())
        val scaled = if (outWidth != width) Bitmap.createScaledBitmap(clean, outWidth, outHeight, true) else clean
        if (scaled !== clean) clean.recycle()

        val bytes = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, 54, bytes)
        scaled.recycle()
        val jpeg = bytes.toByteArray()

        val dir = File(cacheDir, "scalp_overlay_frames")
        if (!dir.exists()) dir.mkdirs()
        dir.listFiles()?.sortedByDescending { it.lastModified() }?.drop(3)?.forEach { it.delete() }

        val file = File(dir, "frame_${now}.jpg")
        FileOutputStream(file).use { it.write(jpeg) }

        val base64 = Base64.encodeToString(jpeg, Base64.NO_WRAP)
        ScalpOverlayModule.instance?.emitFrame(
          base64,
          "file://${file.absolutePath}",
          outWidth,
          outHeight,
          now
        )
      } catch (_: Exception) {
      } finally {
        image.close()
      }
    }, captureHandler)

    virtualDisplay = mediaProjection.createVirtualDisplay(
      "ScalpAtlasPocketCapture",
      width,
      height,
      density,
      DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
      imageReader!!.surface,
      null,
      captureHandler
    )
  }

  private fun createOverlay() {
    if (!android.provider.Settings.canDrawOverlays(this)) return
    if (overlayView != null) return

    val density = resources.displayMetrics.density
    fun dp(v: Int) = (v * density).roundToInt()

    val panel = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(10), dp(7), dp(10), dp(7))
      background = GradientDrawable().apply {
        setColor(Color.argb(230, 7, 13, 21))
        cornerRadius = dp(12).toFloat()
        setStroke(dp(1), Color.rgb(49, 216, 238))
      }
    }

    val title = TextView(this).apply {
      text = "≡  SCALP ATLAS"
      setTextColor(Color.rgb(210, 226, 240))
      textSize = 10f
      setTypeface(typeface, android.graphics.Typeface.BOLD)
    }

    signalText = TextView(this).apply {
      text = "WAIT • AUTO"
      setTextColor(Color.rgb(255, 211, 77))
      textSize = 16f
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      setPadding(0, dp(2), 0, 0)
    }

    detailText = TextView(this).apply {
      text = "Scanez graficul…"
      setTextColor(Color.rgb(132, 153, 174))
      textSize = 9f
      maxLines = 1
    }

    panel.addView(title)
    panel.addView(signalText)
    panel.addView(detailText)

    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    else
      @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

    val params = WindowManager.LayoutParams(
      dp(190),
      WindowManager.LayoutParams.WRAP_CONTENT,
      type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_SECURE,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = dp(12)
      y = dp(76)
    }

    var downX = 0
    var downY = 0
    var startX = 0
    var startY = 0
    panel.setOnTouchListener { _, event ->
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          downX = event.rawX.toInt()
          downY = event.rawY.toInt()
          startX = params.x
          startY = params.y
          true
        }
        MotionEvent.ACTION_MOVE -> {
          params.x = startX + event.rawX.toInt() - downX
          params.y = startY + event.rawY.toInt() - downY
          try { windowManager.updateViewLayout(panel, params) } catch (_: Exception) {}
          true
        }
        else -> true
      }
    }

    try {
      windowManager.addView(panel, params)
      overlayView = panel
    } catch (_: Exception) {
    }
  }

  fun updateOverlay(signal: String, probability: Int, timeframe: String, state: String) {
    val safeSignal = signal.uppercase()
    val displaySignal = when (safeSignal) {
      "BUY" -> "BUY"
      "SELL" -> "SELL"
      "WAIT" -> "WAIT"
      else -> "SCANEZ"
    }

    val color = when (displaySignal) {
      "BUY" -> Color.rgb(56, 217, 150)
      "SELL" -> Color.rgb(255, 100, 100)
      "WAIT" -> Color.rgb(255, 211, 77)
      else -> Color.rgb(220, 227, 237)
    }

    Handler(mainLooper).post {
      signalText?.setTextColor(color)
      signalText?.text = "$displaySignal • ${timeframe.ifBlank { "AUTO" }}${if (probability > 0) " • $probability%" else ""}"
      detailText?.text = state.ifBlank { "Analiză activă" }
    }
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          "SCALP ATLAS Overlay",
          NotificationManager.IMPORTANCE_LOW
        )
      )
    }
  }

  override fun onDestroy() {
    instance = null
    try { overlayView?.let { windowManager.removeView(it) } } catch (_: Exception) {}
    overlayView = null

    try { virtualDisplay?.release() } catch (_: Exception) {}
    virtualDisplay = null
    try { imageReader?.close() } catch (_: Exception) {}
    imageReader = null
    try { projection?.stop() } catch (_: Exception) {}
    projection = null
    try { captureThread?.quitSafely() } catch (_: Exception) {}
    captureThread = null
    captureHandler = null

    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
'''
(overlay_dir / "ScalpOverlayService.kt").write_text(service_code, encoding="utf-8")

print(f"Overlay Android instalat în {overlay_dir}; manifest și MainApplication actualizate.")
