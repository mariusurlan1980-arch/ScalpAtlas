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
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
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
    private const val OCR_INTERVAL_MS = 3000L
    private const val TF_STALE_MS = 18000L
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
  @Volatile private var activeFrameId = -1L
  @Volatile private var previousVisualSample: IntArray? = null
  @Volatile private var lastVisualChangeAt = 0L
  @Volatile private var frameCount = 0L
  @Volatile private var resultCount = 0L
  @Volatile private var errorCount = 0L

  private var candidateDir: String? = null
  private var candidateCount = 0
  private var candidateLastAt = 0L
  private var lockedDir: String? = null
  private var lockedUntil = 0L
  @Volatile private var selectedTimeframe = "M10"
  @Volatile private var tfAutomatic = true
  @Volatile private var tfVerified = false
  @Volatile private var confirmedTfAt = 0L
  @Volatile private var lastOcrAttemptAt = 0L
  @Volatile private var lastTfStatusAt = 0L
  @Volatile private var ocrBusy = false
  private var pendingTf: String? = null
  private var pendingTfCount = 0
  private var pendingTfAt = 0L
  private val ocrRecognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
  @Volatile private var chartZone = 1
  private var tfControl: TextView? = null
  private var chartControl: TextView? = null

  private fun resetSignalState() {
    candidateDir = null
    candidateCount = 0
    candidateLastAt = 0L
    lockedDir = null
    lockedUntil = 0L
    analysisBusy = false
    activeFrameId = -1L
  }

  private fun resetVisualBaseline() {
    previousVisualSample = null
    lastVisualChangeAt = 0L
  }

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
          updateOverlay("AȘTEAPTĂ", "LIVE • Captură indisponibilă", "Deschide din nou modul SUPRAPUNERE")
        }
      }
    }
    return START_NOT_STICKY
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
      channel.description = "Citire grafic live peste aplicația selectată"
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification =
    NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_view)
      .setContentTitle("SCALP ATLAS • SUPRAPUNERE LIVE")
      .setContentText("Alerte BUY/SELL fără executare ordine")
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
      text = "SCALP ATLAS • LIVE"
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
      text = "ALERTE NUMAI • 3 confirmări"
      setTextColor(Color.rgb(135, 153, 176))
      textSize = 10f
      setPadding(0, dp(2), 0, 0)
    }

    val controls = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    tfControl = TextView(this).apply {
      text = "TF AUTO ▸"
      setTextColor(Color.rgb(70, 220, 235))
      textSize = 12f
      setPadding(0, dp(5), dp(18), dp(3))
      setOnClickListener {
        // Automatic by default. Manual fallback if broker hides timeframe text.
        val modes = arrayOf("AUTO", "M5", "M10", "M15")
        val current = if (tfAutomatic) "AUTO" else selectedTimeframe
        val next = modes[(modes.indexOf(current) + 1) % modes.size]
        tfAutomatic = next == "AUTO"
        tfVerified = !tfAutomatic
        pendingTf = null
        pendingTfCount = 0
        confirmedTfAt = 0L
        if (!tfAutomatic) selectedTimeframe = next
        text = "TF " + next + " ▸"
        resetSignalState()
        resetVisualBaseline()
        updateOverlay(
          "AȘTEAPTĂ",
          if (tfAutomatic) "AUTO • caut intervalul brokerului" else "Manual " + selectedTimeframe,
          if (tfAutomatic) "Bip oprit până la identificarea M5/M10/M15" else "Verifică intervalul de pe grafic"
        )
      }
    }
    chartControl = TextView(this).apply {
      text = "GRAFIC 2/3 ▸"
      setTextColor(Color.rgb(210, 222, 238))
      textSize = 12f
      setPadding(0, dp(5), 0, dp(3))
      setOnClickListener {
        chartZone = (chartZone + 1) % 3
        text = "GRAFIC " + (chartZone + 1) + "/3 ▸"
        resetSignalState()
        resetVisualBaseline()
        updateOverlay("AȘTEAPTĂ", "Zonă grafic " + (chartZone + 1) + "/3", "Verifică dacă zona include lumânările")
      }
    }
    controls.addView(tfControl)
    controls.addView(chartControl)
    root.addView(header)
    root.addView(controls)
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
            // READY may have arrived before onPageFinished. Do not overwrite it.
            if (analyzerReady) {
              updateOverlay(
                "AȘTEAPTĂ",
                "LIVE • motor ACTIV",
                "Cadre " + frameCount + " • Rez " + resultCount + " • Erori " + errorCount
              )
            } else {
              updateOverlay("AȘTEAPTĂ", "LIVE • HTML încărcat", "Verific motorul...")
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
            updateOverlay("AȘTEAPTĂ", "LIVE • motor ACTIV", "Cadre " + frameCount + " • Rez " + resultCount + " • Erori " + errorCount)
          }
          "RESULT" -> {
            val result = payload.optJSONObject("result") ?: return
            if (result.optLong("frameId", -1L) != activeFrameId) return
            analysisBusy = false
            activeFrameId = -1L
            resultCount += 1
            handleResult(result)
          }
          "ERROR" -> {
            val failedId = payload.optLong("frameId", -1L)
            if (failedId != activeFrameId) return
            analysisBusy = false
            activeFrameId = -1L
            errorCount += 1
            updateOverlay(
              "AȘTEAPTĂ",
              "LIVE • cadru respins",
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

  /**
   * Broker-neutral basic visual check; analysis engine makes signal decision.
   * Android 14 MediaProjection can capture a selected app window.
   */
  private fun isUsableChartImage(bitmap: Bitmap): Boolean {
    val w = bitmap.width
    val h = bitmap.height
    if (w < 150 || h < 90) return false
    val colors = HashSet<Int>()
    val strideX = max(3, w / 32)
    val strideY = max(3, h / 24)
    for (y in 0 until h step strideY) {
      for (x in 0 until w step strideX) {
        val pixel = bitmap.getPixel(x, y)
        val key = ((Color.red(pixel) / 24) shl 16) or
          ((Color.green(pixel) / 24) shl 8) or (Color.blue(pixel) / 24)
        colors.add(key)
        if (colors.size >= 9) return true
      }
    }
    return false
  }

  /**
   * Check chart-region changes: three confirmations from an unchanged screenshot
   * must never become a sounding trading recommendation.
   */
  private fun hasFreshChartMotion(bitmap: Bitmap, now: Long): Boolean {
    val sampled = IntArray(24 * 14)
    var k = 0
    for (row in 0 until 14) {
      val y = (bitmap.height * (row + 1) / 15).coerceIn(0, bitmap.height - 1)
      for (col in 0 until 24) {
        val x = (bitmap.width * (col + 1) / 25).coerceIn(0, bitmap.width - 1)
        sampled[k++] = bitmap.getPixel(x, y)
      }
    }
    val previous = previousVisualSample
    previousVisualSample = sampled
    if (previous == null) {
      lastVisualChangeAt = now
      return true
    }
    var changed = 0
    for (i in sampled.indices) {
      val a = sampled[i]
      val b = previous[i]
      if (kotlin.math.abs(Color.red(a) - Color.red(b)) > 12 ||
          kotlin.math.abs(Color.green(a) - Color.green(b)) > 12 ||
          kotlin.math.abs(Color.blue(a) - Color.blue(b)) > 12) changed++
    }
    if (changed >= 2) lastVisualChangeAt = now
    return now - lastVisualChangeAt <= 12_000L
  }

  /**
   * ML Kit reads the broker's visible timeframe caption in a full-size frame.
   * Only recognises a leading, standalone M5/M10/M15 or 5m/10m/15m:
   * avoids '00:05:00' (expiry) and 'TF M10' inside our own floating window.
   * Two consistent reads are required; uncertain OCR means NO SIGNAL.
   */
  private fun scheduleTimeframeOcr(frame: Bitmap, now: Long) {
    if (!tfAutomatic || ocrBusy || now - lastOcrAttemptAt < OCR_INTERVAL_MS) return
    ocrBusy = true
    lastOcrAttemptAt = now

    val targetWidth = minOf(840, frame.width)
    val targetHeight = max(1, (frame.height * targetWidth.toFloat() / frame.width).roundToInt())
    val copy = try {
      if (targetWidth == frame.width) frame.copy(Bitmap.Config.ARGB_8888, false)
      else Bitmap.createScaledBitmap(frame, targetWidth, targetHeight, true)
    } catch (error: Throwable) {
      ocrBusy = false
      return
    }
    ocrRecognizer.process(InputImage.fromBitmap(copy, 0))
      .addOnSuccessListener { result ->
        if (!tfAutomatic) return@addOnSuccessListener
        val pattern = Regex("""(?i)^\s*(M5|M10|M15|5M|10M|15M)(?:\s|$|[^A-Z0-9])""")
        val values = result.textBlocks.flatMap { it.lines }.mapNotNull { line ->
          val raw = pattern.find(line.text.trim())?.groupValues?.get(1)?.uppercase() ?: return@mapNotNull null
          if (raw.startsWith("M")) raw else "M" + raw.dropLast(1)
        }.distinct()

        val observedAt = System.currentTimeMillis()
        if (values.size == 1) {
          val found = values[0]
          if (pendingTf != found || observedAt - pendingTfAt > 9000L) {
            pendingTf = found
            pendingTfCount = 1
            pendingTfAt = observedAt
            if (tfVerified && found != selectedTimeframe) {
              tfVerified = false
              resetSignalState()
              updateOverlay("AȘTEAPTĂ", "AUTO • verific " + found,
                "Schimbare interval detectată • aștept confirmarea")
            }
          } else {
            pendingTfCount += 1
            pendingTfAt = observedAt
            if (pendingTfCount >= 2 && tfAutomatic) {
              val changed = !tfVerified || selectedTimeframe != found
              selectedTimeframe = found
              tfVerified = true
              confirmedTfAt = observedAt
              tfControl?.text = "TF AUTO " + found + " ▸"
              if (changed) {
                resetSignalState()
                resetVisualBaseline()
                updateOverlay("AȘTEAPTĂ", "AUTO • " + found + " confirmat",
                  "Timeframe citit din ecran • analiza poate începe")
              }
            }
          }
        } else if (tfVerified && observedAt - confirmedTfAt > TF_STALE_MS) {
          tfVerified = false
          resetSignalState()
          updateOverlay("AȘTEAPTĂ", "TF necunoscut",
            "Nu se poate confirma intervalul • selectează TF manual")
        }
      }
      .addOnFailureListener {
        if (tfAutomatic && System.currentTimeMillis() - confirmedTfAt > TF_STALE_MS) {
          tfVerified = false
          resetSignalState()
          updateOverlay("AȘTEAPTĂ", "OCR indisponibil",
            "Alege M5, M10 sau M15 manual • fără bip în AUTO")
        }
      }
      .addOnCompleteListener {
        if (copy !== frame) copy.recycle()
        ocrBusy = false
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

    startFramePolling(width, height)
    updateOverlay("AȘTEAPTĂ", "LIVE • flux ecran activ", "Cadre 0 • Rez 0 • Erori 0")
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
            "LIVE • FLUX ÎNGHEȚAT",
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
        activeFrameId = -1L
        errorCount += 1
        updateOverlay("AȘTEAPTĂ", "Motor întârziat", "Rezultat expirat • reiau analiza")
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

      // OCR reads the BROKER SCREEN, not the reduced chart crop.
      // No signal is permitted in AUTO until timeframe is confirmed.
      scheduleTimeframeOcr(fullFrame, now)
      if (tfAutomatic && (!tfVerified || now - confirmedTfAt > TF_STALE_MS)) {
        if (tfVerified) {
          tfVerified = false
          resetSignalState()
        }
        fullFrame.recycle()
        if (now - lastTfStatusAt >= 2000L) {
          lastTfStatusAt = now
          updateOverlay("AȘTEAPTĂ", "TF AUTO • caut M5/M10/M15",
            "Intervalul brokerului nu este confirmat • bip dezactivat")
        }
        return
      }

      // User-selectable ROI for different broker layouts; no clicks on broker.
      val zone = chartZone
      val portrait = height >= width
      val topFraction = if (portrait) floatArrayOf(0.07f, 0.16f, 0.28f)[zone]
        else floatArrayOf(0.03f, 0.08f, 0.17f)[zone]
      val bottomFraction = if (portrait) floatArrayOf(0.55f, 0.72f, 0.89f)[zone]
        else floatArrayOf(0.72f, 0.88f, 0.96f)[zone]
      val cropTop = (height * topFraction).roundToInt().coerceIn(0, height - 2)
      val cropBottom = (height * bottomFraction).roundToInt().coerceIn(cropTop + 1, height)
      val chartHeight = max(1, cropBottom - cropTop)
      val chartFrame = Bitmap.createBitmap(fullFrame, 0, cropTop, width, chartHeight)
      if (chartFrame !== fullFrame) fullFrame.recycle()
      if (!isUsableChartImage(chartFrame)) {
        chartFrame.recycle()
        resetSignalState()
        resetVisualBaseline()
        updateOverlay("AȘTEAPTĂ", "GRAFIC NECITIBIL", "Alege altă zonă • fără alerte")
        return
      }
      if (!hasFreshChartMotion(chartFrame, now)) {
        chartFrame.recycle()
        resetSignalState()
        updateOverlay("AȘTEAPTĂ", "GRAFIC STATIC", "Imagine neschimbată peste 12s • fără bip")
        return
      }

      // STREAM FIX v1.0.17: smaller payload + direct JS entrypoint.
      val targetWidth = minOf(520, width)
      val targetHeight = max(1, (chartHeight * (targetWidth.toFloat() / width)).roundToInt())
      val scaled = if (targetWidth != width) Bitmap.createScaledBitmap(chartFrame, targetWidth, targetHeight, true) else chartFrame
      if (scaled !== chartFrame) chartFrame.recycle()

      val stream = ByteArrayOutputStream()
      scaled.compress(Bitmap.CompressFormat.JPEG, 52, stream)
      scaled.recycle()

      val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
      lastFrameAt = now
      frameCount += 1
      val frameId = frameCount
      val tfAtCapture = selectedTimeframe
      activeFrameId = frameId
      analysisBusy = true
      analysisStartedAt = now

      mainHandler.post {
        if (activeFrameId == frameId) {
          val dataUrl = "data:image/jpeg;base64," + base64
          val quotedUrl = JSONObject.quote(dataUrl)
          analyzerWebView?.evaluateJavascript(
            "window.ScalpAtlasAnalyze && window.ScalpAtlasAnalyze(" + quotedUrl + "," +
              JSONObject.quote(tfAtCapture) + "," + frameId + ");",
            null
          )
        }
      }
    } catch (error: Throwable) {
      analysisBusy = false
      activeFrameId = -1L
      errorCount += 1
      updateOverlay("AȘTEAPTĂ", "Captură nereușită",
        (error.message ?: "Eroare captură") + " • Erori " + errorCount)
    } finally {
      image.close()
    }
  }

  private fun handleResult(result: JSONObject) {
    val now = System.currentTimeMillis()
    if (result.optString("timeframe", "") != selectedTimeframe) return
    if (tfAutomatic && (!tfVerified || now - confirmedTfAt > TF_STALE_MS)) {
      resetSignalState()
      return
    }
    val rawSignal = result.optString("signal", "NONE")
    val score = result.optInt("probability", 0)
    val quality = result.optInt("quality", 0)
    val timeframe = selectedTimeframe
    // Indicatorul nu reprezintă probabilitate statistică verificată.
    val confirmedSignal = if (quality >= 55 && score >= 70) rawSignal else "NONE"
    val expiry = result.optInt("expiry", 0)
    val directionMax = result.optInt("directionMax", 0)
    val pattern = result.optString("pattern", "—")

    val currentLock = lockedDir
    if (currentLock != null && now < lockedUntil) {
      val seconds = max(0L, (lockedUntil - now) / 1000L)
      if (confirmedSignal == currentLock) {
        updateOverlay(
          currentLock,
          "Scor orientativ " + score + " • Durată " + if (expiry > 0) expiry.toString() + " min" else "—",
          pattern + " • direcție activă " + formatSeconds(seconds)
        )
      } else {
        // Keep confirmed BUY/SELL visible throughout its lock; no repeated bip.
        updateOverlay(
          currentLock,
          "Semnal activ • " + formatSeconds(seconds) + " rămase",
          "Fără alertă opusă în aceeași fereastră"
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

    if (confirmedSignal != "BUY" && confirmedSignal != "SELL") {
      val candidateStillFresh =
        candidateDir != null &&
        candidateCount > 0 &&
        candidateLastAt > 0L &&
        now - candidateLastAt <= 65000L

      if (candidateStillFresh) {
        updateOverlay(
          "AȘTEAPTĂ " + candidateDir,
          "Confirmare " + candidateCount + "/" + REQUIRED_CONFIRMATIONS + " • semnalul este reverificat",
          timeframe + " • candidat păstrat"
        )
        return
      }

      candidateDir = null
      candidateCount = 0
      candidateLastAt = 0L
      updateOverlay(
        "AȘTEAPTĂ",
        timeframe + " • fără semnal clar • Scor " + score + "%",
        pattern
      )
      return
    }

    if (candidateDir != confirmedSignal) {
      candidateDir = confirmedSignal
      candidateCount = 1
      candidateLastAt = now
    } else if (now - candidateLastAt >= CONFIRMATION_SPACING_MS) {
      candidateCount += 1
      candidateLastAt = now
    }

    if (candidateCount < REQUIRED_CONFIRMATIONS) {
      updateOverlay(
        "AȘTEAPTĂ " + confirmedSignal,
        "Confirmare " + candidateCount + "/" + REQUIRED_CONFIRMATIONS + " • Scor " + score + "%",
        pattern + " • " + timeframe
      )
      return
    }

    // SIGNAL LOCK v1.0.23
    // Blocarea direcției urmează fereastra indicativă a semnalului,
    // pentru a evita alerte contradictorii în câteva secunde.
    val lockMinutes = when {
      expiry in 5..7 -> expiry
      expiry > 0 -> expiry.coerceIn(5, 7)
      else -> 6
    }
    lockedDir = confirmedSignal
    lockedUntil = now + lockMinutes * 60_000L
    candidateDir = null
    candidateCount = 0
    candidateLastAt = 0L

    playBip(confirmedSignal)
    updateOverlay(
      confirmedSignal,
      "Scor orientativ " + score + " • Durată " + if (expiry > 0) expiry.toString() + " min" else "—",
      pattern + " • direcție estimată " + if (directionMax > 0) directionMax.toString() + " min" else timeframe
    )
  }

  private fun formatSeconds(total: Long): String {
    val minutes = total / 60
    val seconds = total % 60
    return "%02d:%02d".format(minutes, seconds)
  }

  private fun playBip(direction: String) {
    mainHandler.post {
      try {
        val player = MediaPlayer.create(this, if (direction == "BUY") R.raw.scalp_buy_bip else R.raw.scalp_sell_bip)
        player?.setVolume(1f, 1f)
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
    try { ocrRecognizer.close() } catch (_: Throwable) {}
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
