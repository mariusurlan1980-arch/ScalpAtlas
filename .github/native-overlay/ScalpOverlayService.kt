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
  private var pocketDetected = false

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

  // SHOCK compact native overlay. No BUY/SELL until verified same-candle OHLC.
  private fun createOverlay() {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(8), dp(8), dp(8), dp(8))
      background = rounded(Color.rgb(7, 16, 30), Color.rgb(44, 70, 82))
      elevation = dp(8).toFloat()
    }
    val candle = TextView(this).apply {
      text = "│\n█\n│"
      gravity = Gravity.CENTER
      textSize = 22f
      setLineSpacing(-dp(8).toFloat(), 1f)
      setTextColor(Color.rgb(150, 164, 178))
      contentDescription = "Lumânare în așteptarea datelor verificate"
    }
    root.addView(candle, LinearLayout.LayoutParams(dp(42), dp(110)))
    val ring = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.rgb(9, 22, 30))
        setStroke(dp(5), Color.rgb(70, 90, 100))
      }
    }
    signalText = TextView(this).apply {
      text = "—"
      textSize = 29f
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      setTypeface(typeface, android.graphics.Typeface.BOLD)
    }
    detailText = TextView(this).apply {
      text = "ȘOC"
      textSize = 13f
      gravity = Gravity.CENTER
      setTextColor(Color.rgb(190, 210, 220))
    }
    ring.addView(signalText)
    ring.addView(detailText)
    root.addView(ring, LinearLayout.LayoutParams(dp(116), dp(116)))
    val close = TextView(this).apply {
      text = "×"
      textSize = 21f
      gravity = Gravity.TOP
      setTextColor(Color.LTGRAY)
      setOnClickListener { stopSelf() }
    }
    root.addView(close, LinearLayout.LayoutParams(dp(26), dp(110)))
    modelText = null

    val params = WindowManager.LayoutParams(
      dp(206), WindowManager.LayoutParams.WRAP_CONTENT,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      else WindowManager.LayoutParams.TYPE_PHONE,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.END
      x = dp(8)
      y = dp(40)
    }
    var startX = 0
    var startY = 0
    var touchX = 0f
    var touchY = 0f
    root.setOnTouchListener { _, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          startX = params.x; startY = params.y
          touchX = event.rawX; touchY = event.rawY
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
            // READY may have arrived before onPageFinished. Do not overwrite it.
            if (analyzerReady) {
              updateOverlay(
                "AȘTEAPTĂ",
                "M10 • motor ACTIV",
                "Cadre " + frameCount + " • Rez " + resultCount + " • Erori " + errorCount
              )
            } else {
              updateOverlay("AȘTEAPTĂ", "M10 • HTML încărcat", "Verific motorul...")
              view?.evaluateJavascript(
                "window.ScalpAtlasPing && window.ScalpAtlasPing();",
                null
              )
            }
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

  private fun isPocketOptionFrame(bitmap: Bitmap): Boolean {
    // POCKET OPTION GATE v1.0.22
    // Pocket Option Classic mode has two large saturated action buttons near the
    // lower part of the screen: green BUY and red SELL. We use those UI anchors
    // to stop Scalp Atlas from analyzing the launcher, wallpaper or another app.
    val w = bitmap.width
    val h = bitmap.height
    if (w < 100 || h < 200) return false

    val y0 = (h * 0.70f).roundToInt().coerceIn(0, h - 2)
    val y1 = (h * 0.91f).roundToInt().coerceIn(y0 + 1, h)
    val x0 = (w * 0.03f).roundToInt()
    val x1 = (w * 0.97f).roundToInt()

    var samples = 0
    var green = 0
    var red = 0
    var leftGreen = 0
    var rightRed = 0

    var y = y0
    while (y < y1) {
      var x = x0
      while (x < x1) {
        val p = bitmap.getPixel(x, y)
        val r = Color.red(p)
        val g = Color.green(p)
        val b = Color.blue(p)
        samples += 1

        val isGreen = g > 105 && g > r * 1.18 && g > b * 1.08
        val isRed = r > 145 && r > g * 1.22 && r > b * 1.10

        if (isGreen) {
          green += 1
          if (x < w / 2) leftGreen += 1
        }
        if (isRed) {
          red += 1
          if (x > w / 2) rightRed += 1
        }
        x += 6
      }
      y += 6
    }

    if (samples <= 0) return false
    val greenRatio = green.toFloat() / samples
    val redRatio = red.toFloat() / samples
    val leftGreenRatio = leftGreen.toFloat() / samples
    val rightRedRatio = rightRed.toFloat() / samples

    return greenRatio >= 0.028f &&
      redRatio >= 0.028f &&
      leftGreenRatio >= 0.018f &&
      rightRedRatio >= 0.018f
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

    startFramePolling(width, height)
    updateOverlay("AȘTEAPTĂ", "M10 • flux ecran activ", "Cadre 0 • Rez 0 • Erori 0")
  }

  private fun startFramePolling(width: Int, height: Int) {
    val handler = captureHandler ?: return
    val task = object : Runnable {
      override fun run() {
        if (mediaProjection == null || imageReader == null) return

        processLatestImage(imageReader!!, width, height)

        val now = System.currentTimeMillis()
        if (lastFrameAt > 0L && now - lastFrameAt > 2500L) {
          updateOverlay(
            "AȘTEAPTĂ",
            "M10 • FLUX ÎNGHEȚAT",
            "Cadre " + frameCount + " • Rez " + resultCount + " • Erori " + errorCount + " • repornește SUPRAPUNERE"
          )
        }

        handler.postDelayed(this, 550L)
      }
    }
    handler.post(task)
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

      val onPocketOption = isPocketOptionFrame(fullFrame)
      if (!onPocketOption) {
        if (pocketDetected) {
          pocketDetected = false
          candidateDir = null
          candidateCount = 0
          candidateLastAt = 0L
        }
        fullFrame.recycle()
        updateOverlay(
          "AȘTEAPTĂ",
          "POCKET OPTION NEDETECTAT",
          "Analiza este oprită în afara platformei"
        )
        return
      } else if (!pocketDetected) {
        pocketDetected = true
        updateOverlay(
          "AȘTEAPTĂ",
          "POCKET OPTION DETECTAT • M10",
          "Analiză activă"
        )
      }

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
    // The old 70-pattern analyzer is not a verified same-candle SHOCK detector.
    // Reject all legacy results; never beep or display an invented recovery %.
    updateOverlay("—", "ȘOC", "Date OHLC neverificate")
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
      // Keep compact overlay unarmed until verified live candle data exists.
      signalText?.text = "—"
      signalText?.setTextColor(Color.WHITE)
      detailText?.text = "ȘOC"
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
