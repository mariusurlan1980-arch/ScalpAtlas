package com.scalpatlas.app

import android.app.Notification
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
import android.media.MediaPlayer
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Base64
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.roundToInt

@Suppress("DEPRECATION")
class ScalpOverlayService : Service() {

  companion object {
    const val ACTION_START = "com.scalpatlas.app.START_OVERLAY"
    const val ACTION_STOP = "com.scalpatlas.app.STOP_OVERLAY"
    const val EXTRA_RESULT_CODE = "resultCode"
    const val EXTRA_RESULT_DATA = "resultData"

    private const val CHANNEL_ID = "scalp_atlas_overlay"
    private const val NOTIFICATION_ID = 4816
    private const val MIN_FRAME_INTERVAL_MS = 700L
    private const val ANALYSIS_TIMEOUT_MS = 5000L
    private const val CONFIRMATION_SPACING_MS = 20000L
    private const val REQUIRED_CONFIRMATIONS = 3
  }

  private lateinit var windowManager: WindowManager
  private var overlayView: View? = null
  private var signalText: TextView? = null
  private var detailText: TextView? = null
  private var modelText: TextView? = null

  private var mediaProjection: MediaProjection? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var imageReader: ImageReader? = null
  private var captureThread: HandlerThread? = null
  private var captureHandler: Handler? = null

  private var analyzerWebView: WebView? = null
  private var analyzerReady = false
  @Volatile private var analysisBusy = false
  @Volatile private var analysisStartedAt = 0L
  @Volatile private var lastFrameAt = 0L
  @Volatile private var frameCount = 0L
  @Volatile private var resultCount = 0L
  @Volatile private var errorCount = 0L

  private var candidateDir: String? = null
  private var candidateCount = 0
  private var candidateLastAt = 0L
  private var lockedDir: String? = null
  private var lockedUntil = 0L

  private val mainHandler = Handler(Looper.getMainLooper())

  override fun onCreate() {
    super.onCreate()
    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    createNotificationChannel()
    createOverlay()
    createAnalyzer()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopSelf()
        return START_NOT_STICKY
      }
      ACTION_START -> {
        startForegroundCompat(buildNotification())
        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
        val data = if (Build.VERSION.SDK_INT >= 33) {
          intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
        } else {
          intent.getParcelableExtra(EXTRA_RESULT_DATA)
        }

        if (resultCode != 0 && data != null) {
          startProjection(resultCode, data)
        } else {
          updateOverlay("AȘTEAPTĂ", "M10 • Captură indisponibilă", "Deschide din nou modul SUPRAPUNERE")
        }
      }
    }
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun startForegroundCompat(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Scalp Atlas suprapunere",
        NotificationManager.IMPORTANCE_LOW
      )
      channel.description = "Analiză live M10 peste Pocket Option"
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification =
    NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_view)
      .setContentTitle("SCALP ATLAS • SUPRAPUNERE LIVE")
      .setContentText("Analiză M10 în timp real")
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()

  private fun dp(value: Int): Int =
    (value * resources.displayMetrics.density).roundToInt()

  private fun rounded(color: Int, strokeColor: Int): GradientDrawable =
    GradientDrawable().apply {
      setColor(color)
      cornerRadius = dp(14).toFloat()
      setStroke(dp(1), strokeColor)
    }

  private fun createOverlay() {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(12), dp(10), dp(12), dp(10))
      background = rounded(Color.rgb(7, 16, 30), Color.rgb(40, 211, 151))
      elevation = dp(10).toFloat()
    }

    val header = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    val title = TextView(this).apply {
      text = "SCALP ATLAS • M10"
      setTextColor(Color.rgb(70, 220, 235))
      textSize = 13f
      setTypeface(typeface, android.graphics.Typeface.BOLD)
    }

    val close = TextView(this).apply {
      text = "  ×  "
      setTextColor(Color.WHITE)
      textSize = 20f
      gravity = Gravity.CENTER
      setOnClickListener { stopSelf() }
    }

    header.addView(title, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    header.addView(close)

    signalText = TextView(this).apply {
      text = "AȘTEAPTĂ"
      setTextColor(Color.rgb(255, 201, 74))
      textSize = 24f
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      setPadding(0, dp(4), 0, 0)
    }

    detailText = TextView(this).apply {
      text = "Flux ecran • pregătire"
      setTextColor(Color.rgb(210, 222, 238))
      textSize = 12f
      setPadding(0, dp(2), 0, 0)
    }

    modelText = TextView(this).apply {
      text = "Motor M10 • 3 confirmări"
      setTextColor(Color.rgb(135, 153, 176))
      textSize = 10f
      setPadding(0, dp(2), 0, 0)
    }

    root.addView(header)
    root.addView(signalText)
    root.addView(detailText)
    root.addView(modelText)

    val params = WindowManager.LayoutParams(
      dp(215),
      WindowManager.LayoutParams.WRAP_CONTENT,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      else WindowManager.LayoutParams.TYPE_PHONE,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
      PixelFormat.TRANSLUCENT
    ).apply {
      // Ținem overlay-ul sus, în afara zonei de grafic analizate.
      gravity = Gravity.TOP or Gravity.END
      x = dp(10)
      y = dp(28)
    }

    var startX = 0
    var startY = 0
    var touchX = 0f
    var touchY = 0f

    root.setOnTouchListener { _, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          startX = params.x
          startY = params.y
          touchX = event.rawX
          touchY = event.rawY
          true
        }
        MotionEvent.ACTION_MOVE -> {
          params.x = startX + (event.rawX - touchX).toInt()
          params.y = startY + (event.rawY - touchY).toInt()
          overlayView?.let { windowManager.updateViewLayout(it, params) }
          true
        }
        else -> false
      }
    }

    overlayView = root
    windowManager.addView(root, params)
  }

  private fun createAnalyzer() {
    mainHandler.post {
      val web = WebView(this).apply {
        settings.javaScriptEnabled = true
        settings.loadsImagesAutomatically = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.domStorageEnabled = false
        setBackgroundColor(Color.TRANSPARENT)
        alpha = 0.01f
        addJavascriptInterface(AnalyzerBridge(), "AndroidBridge")
        webViewClient = object : WebViewClient() {
          override fun onPageFinished(view: WebView?, url: String?) {
            analyzerReady = false
            updateOverlay("AȘTEAPTĂ", "M10 • HTML încărcat", "Aștept confirmarea motorului...")
          }
        }
      }

      // Android WebView executes canvas/image work reliably when it is attached to
      // a window. We keep a 1x1 almost-transparent analyzer inside the overlay.
      (overlayView as? LinearLayout)?.addView(
        web,
        LinearLayout.LayoutParams(1, 1)
      )
      analyzerWebView = web
      web.loadUrl("file:///android_asset/analysis_engine.html")
    }
  }

  private inner class AnalyzerBridge {
    @JavascriptInterface
    fun postMessage(message: String) {
      try {
        val payload = JSONObject(message)
        when (payload.optString("type")) {
          "READY" -> {
            analyzerReady = true
            analysisBusy = false
            updateOverlay("AȘTEAPTĂ", "M10 • motor ACTIV", "Cadre " + frameCount + " • Rez " + resultCount + " • Erori " + errorCount)
          }
          "RESULT" -> {
            analysisBusy = false
            resultCount += 1
            val result = payload.optJSONObject("result") ?: return
            handleResult(result)
          }
          "ERROR" -> {
            analysisBusy = false
            errorCount += 1
            updateOverlay(
              "AȘTEAPTĂ",
              "M10 • cadru respins",
              payload.optString("message", "Analiză indisponibilă") +
                " • Cadre " + frameCount + " • Rez " + resultCount + " • Erori " + errorCount
            )
          }
        }
      } catch (_: Throwable) {
        analysisBusy = false
      }
    }
  }

  private fun startProjection(resultCode: Int, resultData: Intent) {
    if (mediaProjection != null) return

    val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    mediaProjection = projectionManager.getMediaProjection(resultCode, resultData)
    mediaProjection?.registerCallback(object : MediaProjection.Callback() {
      override fun onStop() {
        stopSelf()
      }
    }, mainHandler)

    val metrics = resources.displayMetrics
    val width = metrics.widthPixels
    val height = metrics.heightPixels
    val density = metrics.densityDpi

    captureThread = HandlerThread("ScalpAtlasCapture").also { it.start() }
    captureHandler = Handler(captureThread!!.looper)

    imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 3)

    virtualDisplay = mediaProjection?.createVirtualDisplay(
      "ScalpAtlasLiveCapture",
      width,
      height,
      density,
      DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
      imageReader?.surface,
      null,
      captureHandler
    )

    updateOverlay("AȘTEAPTĂ", "M10 • flux ecran activ", "Deschide Pocket Option")
  }

  private fun processLatestImage(reader: ImageReader, width: Int, height: Int) {
    val image = reader.acquireLatestImage() ?: return
    try {
      val now = System.currentTimeMillis()
      if (analysisBusy && now - analysisStartedAt > ANALYSIS_TIMEOUT_MS) {
        analysisBusy = false
      }
      if (!analyzerReady || analysisBusy || now - lastFrameAt < MIN_FRAME_INTERVAL_MS) return

      val plane = image.planes.firstOrNull() ?: return
      val buffer = plane.buffer
      val pixelStride = plane.pixelStride
      val rowStride = plane.rowStride
      val rowPadding = rowStride - pixelStride * width
      val bitmapWidth = width + rowPadding / max(1, pixelStride)

      val raw = Bitmap.createBitmap(bitmapWidth, height, Bitmap.Config.ARGB_8888)
      raw.copyPixelsFromBuffer(buffer)

      val fullFrame = Bitmap.createBitmap(raw, 0, 0, width, height)
      if (fullFrame !== raw) raw.recycle()

      // POCKET OPTION CHART CROP v1.0.16:
      // Motorul primește doar zona centrală a graficului, nu antetul, butoanele,
      // soldul sau fereastra Scalp Atlas. În portret păstrăm aproximativ 16–72%
      // din înălțimea ecranului; în landscape folosim o zonă mai largă.
      val cropTop = if (height >= width) {
        (height * 0.16f).roundToInt().coerceIn(0, height - 2)
      } else {
        (height * 0.08f).roundToInt().coerceIn(0, height - 2)
      }
      val cropBottom = if (height >= width) {
        (height * 0.72f).roundToInt().coerceIn(cropTop + 1, height)
      } else {
        (height * 0.88f).roundToInt().coerceIn(cropTop + 1, height)
      }
      val chartHeight = max(1, cropBottom - cropTop)
      val chartFrame = Bitmap.createBitmap(fullFrame, 0, cropTop, width, chartHeight)
      if (chartFrame !== fullFrame) fullFrame.recycle()

      // STREAM FIX v1.0.17: smaller payload + direct JS entrypoint.
      val targetWidth = minOf(420, width)
      val targetHeight = max(1, (chartHeight * (targetWidth.toFloat() / width)).roundToInt())
      val scaled = if (targetWidth != width) Bitmap.createScaledBitmap(chartFrame, targetWidth, targetHeight, true) else chartFrame
      if (scaled !== chartFrame) chartFrame.recycle()

      val stream = ByteArrayOutputStream()
      scaled.compress(Bitmap.CompressFormat.JPEG, 52, stream)
      scaled.recycle()

      val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
      lastFrameAt = now
      frameCount += 1
      analysisBusy = true
      analysisStartedAt = now

      mainHandler.post {
        modelText?.text = "Cadre " + frameCount + " • Rez " + resultCount + " • Erori " + errorCount + " • ANALIZEZ..."
        val dataUrl = "data:image/jpeg;base64," + base64
        val quotedUrl = JSONObject.quote(dataUrl)
        analyzerWebView?.evaluateJavascript(
          "window.ScalpAtlasAnalyze && window.ScalpAtlasAnalyze(" + quotedUrl + ",'M10');",
          null
        )
      }
    } catch (_: Throwable) {
      analysisBusy = false
    } finally {
      image.close()
    }
  }

  private fun handleResult(result: JSONObject) {
    val now = System.currentTimeMillis()
    val rawSignal = result.optString("signal", "NONE")
    val score = result.optInt("probability", 0)
    val expiry = result.optInt("expiry", 0)
    val directionMax = result.optInt("directionMax", 0)
    val pattern = result.optString("pattern", "—")

    val currentLock = lockedDir
    if (currentLock != null && now < lockedUntil) {
      val seconds = max(0L, (lockedUntil - now) / 1000L)
      if (rawSignal == currentLock) {
        updateOverlay(
          currentLock,
          "Scor " + score + "% • Expirare " + if (expiry > 0) expiry.toString() + " min" else "—",
          pattern + " • direcție activă " + formatSeconds(seconds)
        )
      } else {
        updateOverlay(
          "AȘTEAPTĂ",
          currentLock + " rămâne activ • " + formatSeconds(seconds),
          "Semnal opus blocat până la expirarea ferestrei"
        )
      }
      return
    }

    if (currentLock != null && now >= lockedUntil) {
      lockedDir = null
      lockedUntil = 0L
      candidateDir = null
      candidateCount = 0
      candidateLastAt = 0L
    }

    if (rawSignal != "BUY" && rawSignal != "SELL") {
      candidateDir = null
      candidateCount = 0
      candidateLastAt = 0L
      updateOverlay(
        "AȘTEAPTĂ",
        "M10 • fără semnal clar • Scor " + score + "%",
        pattern
      )
      return
    }

    if (candidateDir != rawSignal) {
      candidateDir = rawSignal
      candidateCount = 1
      candidateLastAt = now
    } else if (now - candidateLastAt >= CONFIRMATION_SPACING_MS) {
      candidateCount += 1
      candidateLastAt = now
    }

    if (candidateCount < REQUIRED_CONFIRMATIONS) {
      updateOverlay(
        "AȘTEAPTĂ " + rawSignal,
        "Confirmare " + candidateCount + "/" + REQUIRED_CONFIRMATIONS + " • Scor " + score + "%",
        pattern + " • M10"
      )
      return
    }

    val lockMinutes = max(10, directionMax)
    lockedDir = rawSignal
    lockedUntil = now + lockMinutes * 60_000L
    candidateDir = null
    candidateCount = 0
    candidateLastAt = 0L

    playBip()
    updateOverlay(
      rawSignal,
      "Scor " + score + "% • Expirare " + if (expiry > 0) expiry.toString() + " min" else "—",
      pattern + " • direcție estimată " + if (directionMax > 0) directionMax.toString() + " min" else "M10"
    )
  }

  private fun formatSeconds(total: Long): String {
    val minutes = total / 60
    val seconds = total % 60
    return "%02d:%02d".format(minutes, seconds)
  }

  private fun playBip() {
    mainHandler.post {
      try {
        val player = MediaPlayer.create(this, R.raw.scalp_bip)
        player?.setOnCompletionListener { it.release() }
        player?.start()
      } catch (_: Throwable) {}

      try {
        val vibrator = getSystemService(VIBRATOR_SERVICE) as Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          vibrator.vibrate(VibrationEffect.createOneShot(180, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
          vibrator.vibrate(180)
        }
      } catch (_: Throwable) {}
    }
  }

  private fun updateOverlay(signal: String, details: String, model: String) {
    mainHandler.post {
      signalText?.text = signal
      signalText?.setTextColor(
        when {
          signal.startsWith("BUY") -> Color.rgb(52, 218, 148)
          signal.startsWith("SELL") -> Color.rgb(255, 88, 96)
          else -> Color.rgb(255, 201, 74)
        }
      )
      detailText?.text = details
      modelText?.text = model + " • Cadre " + frameCount + " • Rez " + resultCount + " • Erori " + errorCount
    }
  }

  override fun onDestroy() {
    try { virtualDisplay?.release() } catch (_: Throwable) {}
    try { imageReader?.close() } catch (_: Throwable) {}
    try { mediaProjection?.stop() } catch (_: Throwable) {}
    virtualDisplay = null
    imageReader = null
    mediaProjection = null

    try { captureThread?.quitSafely() } catch (_: Throwable) {}
    captureThread = null
    captureHandler = null

    mainHandler.post {
      try { analyzerWebView?.destroy() } catch (_: Throwable) {}
      analyzerWebView = null
      try { overlayView?.let { windowManager.removeView(it) } } catch (_: Throwable) {}
      overlayView = null
    }

    super.onDestroy()
  }
}
