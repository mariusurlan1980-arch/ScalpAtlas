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
import android.provider.Settings
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
    // LIVE SCREEN RESULT FRESHNESS v1.0.60. Images are NOT price-tick data.
    private const val MAX_LIVE_RESULT_AGE_MS = 4500L
    private const val ANALYSIS_TIMEOUT_MS = 5000L
    private const val CONFIRMATION_SPACING_MS = 8000L
    private const val REQUIRED_CONFIRMATIONS = 2
    private const val SIGNAL_HOLD_MS = 10_000L
    private const val MARKET_OCR_INTERVAL_MS = 2200L
  }

  private lateinit var windowManager: WindowManager
  private var overlayView: View? = null
  private var timeframeTitleText: TextView? = null
  private var signalText: TextView? = null
  private var detailText: TextView? = null
  private var modelText: TextView? = null
  private var titleText: TextView? = null
  private var autoDemoText: TextView? = null
  private var demoDiagnosticText: TextView? = null

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
  @Volatile private var latestSubmittedFrameId = 0L
  @Volatile private var ignoredLateResults = 0L
  @Volatile private var resultCount = 0L
  @Volatile private var errorCount = 0L
  @Volatile private var marketOcrBusy = false
  @Volatile private var lastMarketOcrAt = 0L
  @Volatile private var currentTimeframe = "AUTO"
  @Volatile private var timeframeCandidate: String? = null
  @Volatile private var timeframeCandidateCount = 0
  @Volatile private var timeframeMissCount = 0
  @Volatile private var chartCountdownTf = "AUTO"
  @Volatile private var chartCountdownSeconds: Int? = null
  @Volatile private var chartCountdownAt = 0L
  @Volatile private var chartCountdownEvidenceCount = 0
  @Volatile private var currentPair = "—"
  // OTC OCR identity stability v1.0.61 (separate from timeframe OCR).
  @Volatile private var pairSwitchCandidate: String? = null
  @Volatile private var pairSwitchReads = 0

  private var candidateBarKey: String? = null
  private var previewBarKey: String? = null
  private var previewStableReads = 0
  private var previewReadAt = 0L
  private var candidateDir: String? = null
  private var candidateCount = 0
  private var candidateLastAt = 0L
  private var lockedDir: String? = null
  private var lockedUntil = 0L
  private var signalVisibleUntil = 0L
  private var chartDetected = false

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
          updateOverlay("AȘTEAPTĂ", "$currentTimeframe • Captură indisponibilă", "Deschide din nou modul SUPRAPUNERE")
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
      channel.description = "Analiză live automată peste orice grafic"
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification =
    NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_view)
      .setContentTitle("SCALP ATLAS • SUPRAPUNERE LIVE")
      .setContentText("Pereche și timeframe detectate automat")
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
      text = "SCALP ATLAS • AUTO"
      setTextColor(Color.rgb(70, 220, 235))
      textSize = 13f
      setTypeface(typeface, android.graphics.Typeface.BOLD)
    }
    titleText = title

    timeframeTitleText = title

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
      text = "Motor AUTO • 3 confirmări"
      setTextColor(Color.rgb(135, 153, 176))
      textSize = 10f
      setPadding(0, dp(2), 0, 0)
    }

    autoDemoText = TextView(this).apply {
      textSize = 11f
      gravity = Gravity.CENTER
      setPadding(dp(8), dp(7), dp(8), dp(7))
      background = rounded(Color.rgb(16, 31, 48), Color.rgb(70, 220, 235))
      // LONG PRESS = non-trading readiness test (never clicks Pocket Option).
      setOnLongClickListener {
        refreshAutoDemoText("TEST: " + ScalpAutoDemoAccessibilityService.checkDemoReadiness())
        true
      }
      setOnClickListener {
        if (!ScalpAutoDemoAccessibilityService.isConnected()) {
          ScalpAutoDemoAccessibilityService.setEnabled(this@ScalpOverlayService, false)
          refreshAutoDemoText("ACTIVEAZĂ ACCESIBILITATEA")
          startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          })
        } else {
          val next = !ScalpAutoDemoAccessibilityService.isEnabled(this@ScalpOverlayService)
          ScalpAutoDemoAccessibilityService.setEnabled(this@ScalpOverlayService, next)
          refreshAutoDemoText(if (next) "PORNIT • NUMAI QT DEMO" else "OPRIT")
        }
      }
    }
    refreshAutoDemoText()

    root.addView(header)
    root.addView(signalText)
    root.addView(detailText)
    root.addView(modelText)
    root.addView(autoDemoText, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(7) })

    // Explicit tap test because the Android overlay's drag handler may
    // prevent some devices from delivering a long-press gesture.
    // This only reads accessibility and NEVER dispatches a broker click.
    demoDiagnosticText = TextView(this).apply {
      text = "TEST CONEXIUNE DEMO • ATINGE"
      textSize = 11f
      gravity = Gravity.CENTER
      setTextColor(Color.rgb(70, 220, 235))
      setPadding(dp(8), dp(10), dp(8), dp(10))
      setOnClickListener {
        text = "TEST: " + ScalpAutoDemoAccessibilityService.checkDemoReadiness()
        setTextColor(Color.rgb(255, 201, 74))
      }
    }
    root.addView(demoDiagnosticText, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(3) })

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
                "$currentTimeframe • motor ACTIV",
                "Cadre " + frameCount + " • Rez " + resultCount + " • Erori " + errorCount
              )
            } else {
              updateOverlay("AȘTEAPTĂ", "$currentTimeframe • HTML încărcat", "Verific motorul...")
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

  // Ignore results without a matching captured-image sequence or after the
  // 4.5-second age bound. Two overlapping WebView callbacks cannot authorize
  // a trade from an earlier image. This is visual LIVE, not numeric OHLC.
  private fun isFreshLiveFrameResponse(frameId: Long): Boolean {
    val now = System.currentTimeMillis()
    return frameId > 0L &&
      frameId == latestSubmittedFrameId &&
      analysisStartedAt > 0L &&
      now >= analysisStartedAt &&
      now - analysisStartedAt <= MAX_LIVE_RESULT_AGE_MS
  }

  private fun clearVisualCandidateAfterExpiredFrame() {
    candidateDir = null
    candidateBarKey = null
    candidateCount = 0
    candidateLastAt = 0L
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
            updateOverlay("AȘTEAPTĂ", "$currentTimeframe • motor ACTIV", "Cadre " + frameCount + " • Rez " + resultCount + " • Erori " + errorCount)
          }
          "RESULT" -> {
            val responseFrameId = payload.optJSONObject("result")?.optLong("frameId", -1L) ?: -1L
            if (!isFreshLiveFrameResponse(responseFrameId)) {
              ignoredLateResults += 1
              // A delayed callback must never unlock the newer image request.
              if (responseFrameId == latestSubmittedFrameId) {
                analysisBusy = false
                clearVisualCandidateAfterExpiredFrame()
                updateOverlay(
                  "AȘTEAPTĂ",
                  "LIVE VIZUAL • cadru întârziat • FĂRĂ BIP",
                  "Imagine veche respinsă automat"
                )
              }
              return
            }
            analysisBusy = false
            resultCount += 1
            val result = payload.optJSONObject("result") ?: return
            handleResult(result)
          }
          "ERROR" -> {
            val responseFrameId = payload.optLong("frameId", -1L)
            if (!isFreshLiveFrameResponse(responseFrameId)) {
              ignoredLateResults += 1
              if (responseFrameId == latestSubmittedFrameId) {
                analysisBusy = false
                clearVisualCandidateAfterExpiredFrame()
              }
              return
            }
            analysisBusy = false
            errorCount += 1
            updateOverlay(
              "AȘTEAPTĂ",
              "$currentTimeframe • cadru respins",
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

  private fun isTradingChartFrame(bitmap: Bitmap): Boolean {
    // GENERIC CHART GATE v1.0.27
    // Nu căutăm logo, butoane BUY/SELL sau alte elemente ale unui broker.
    // Căutăm doar suficientă structură vizuală în zona centrală; motorul Atlas
    // decide ulterior dacă imaginea are calitate suficientă pentru analiză.
    val w = bitmap.width
    val h = bitmap.height
    if (w < 160 || h < 240) return false

    val x0 = (w * 0.05f).roundToInt().coerceIn(0, w - 2)
    val x1 = (w * 0.95f).roundToInt().coerceIn(x0 + 1, w)
    val y0 = (h * 0.12f).roundToInt().coerceIn(0, h - 2)
    val y1 = (h * 0.82f).roundToInt().coerceIn(y0 + 1, h)
    val step = 8

    var samples = 0
    var edges = 0
    var chromatic = 0
    var dark = 0
    var light = 0

    var y = y0
    while (y < y1) {
      var x = x0
      while (x < x1 - step) {
        val p = bitmap.getPixel(x, y)
        val q = bitmap.getPixel(x + step, y)

        val r = Color.red(p)
        val g = Color.green(p)
        val b = Color.blue(p)
        val lum = (r * 30 + g * 59 + b * 11) / 100

        val qr = Color.red(q)
        val qg = Color.green(q)
        val qb = Color.blue(q)
        val qLum = (qr * 30 + qg * 59 + qb * 11) / 100

        samples += 1
        if (kotlin.math.abs(lum - qLum) >= 24) edges += 1
        if (maxOf(r, g, b) - minOf(r, g, b) >= 34) chromatic += 1
        if (lum <= 55) dark += 1
        if (lum >= 190) light += 1
        x += step
      }
      y += step
    }

    if (samples <= 0) return false
    val edgeRatio = edges.toFloat() / samples
    val colorRatio = chromatic.toFloat() / samples
    val darkRatio = dark.toFloat() / samples
    val lightRatio = light.toFloat() / samples

    // Acceptă atât teme dark cât și light, inclusiv lumânări monocrome.
    return edgeRatio >= 0.035f &&
      (colorRatio >= 0.008f || darkRatio >= 0.08f || lightRatio >= 0.08f)
  }

  private fun resetSignalStateForMarketChange() {
    candidateBarKey = null
    chartCountdownTf = "AUTO"
    chartCountdownSeconds = null
    chartCountdownAt = 0L
    chartCountdownEvidenceCount = 0
    candidateDir = null
    candidateCount = 0
    candidateLastAt = 0L
    lockedDir = null
    lockedUntil = 0L
    signalVisibleUntil = 0L
  }

  private fun normalizeTimeframe(text: String): String? {
    // v1.0.39: păstrăm spațiile/separatorii OCR.
    // Înainte, "M5 01:08" devenea "M501:08", iar limita regex după M5 dispărea.
    // Asta lăsa overlay-ul blocat pe AUTO chiar dacă M5/M10 era vizibil pe grafic.
    val normalized = text
      .uppercase()
      .replace('\n', ' ')
      .replace('\r', ' ')

    val patterns = listOf(
      "M30" to Regex("(?:^|[^A-Z0-9])M\\s*3\\s*[0O](?=[^A-Z0-9]|$)"),
      "M15" to Regex("(?:^|[^A-Z0-9])M\\s*[1I]\\s*[5S](?=[^A-Z0-9]|$)"),
      "M10" to Regex("(?:^|[^A-Z0-9])M\\s*[1I]\\s*[0O](?=[^A-Z0-9]|$)"),
      "M5"  to Regex("(?:^|[^A-Z0-9])M\\s*[5S](?=[^A-Z0-9]|$)"),
      "M3"  to Regex("(?:^|[^A-Z0-9])M\\s*3(?=[^A-Z0-9]|$)"),
      "M2"  to Regex("(?:^|[^A-Z0-9])M\\s*2(?=[^A-Z0-9]|$)"),
      "M1"  to Regex("(?:^|[^A-Z0-9])M\\s*[1I](?=[^A-Z0-9]|$)"),
      "H1"  to Regex("(?:^|[^A-Z0-9])H\\s*[1I](?=[^A-Z0-9]|$)")
    )
    return patterns.firstOrNull { it.second.containsMatchIn(normalized) }?.first
  }

  private fun normalizePair(text: String): String? {
    val upper = text.uppercase()
    val match = Regex("\\b([A-Z]{3})\\s*/\\s*([A-Z]{3})(?:\\s+OTC)?\\b").find(upper) ?: return null
    return match.groupValues[1] + "/" + match.groupValues[2] + if (match.value.contains("OTC")) " OTC" else ""
  }

  private fun scheduleMarketOcr(bitmap: Bitmap) {
    val now = System.currentTimeMillis()
    if (marketOcrBusy || now - lastMarketOcrAt < MARKET_OCR_INTERVAL_MS) return

    marketOcrBusy = true
    lastMarketOcrAt = now

    val copy = bitmap.copy(Bitmap.Config.ARGB_8888, false)
    val w = copy.width
    val h = copy.height

    fun cropAndScale(x0f: Float, y0f: Float, x1f: Float, y1f: Float): Pair<Bitmap, Bitmap> {
      val x0 = (w * x0f).roundToInt().coerceIn(0, w - 2)
      val y0 = (h * y0f).roundToInt().coerceIn(0, h - 2)
      val x1 = (w * x1f).roundToInt().coerceIn(x0 + 2, w)
      val y1 = (h * y1f).roundToInt().coerceIn(y0 + 2, h)
      val crop = Bitmap.createBitmap(copy, x0, y0, x1 - x0, y1 - y0)
      val targetWidth = (crop.width * 4).coerceAtMost(1800)
      val targetHeight = ((crop.height.toFloat() * targetWidth) / crop.width.toFloat()).roundToInt()
      val scaled = Bitmap.createScaledBitmap(crop, targetWidth, targetHeight.coerceAtLeast(2), true)
      return Pair(crop, scaled)
    }

    // ROI 1: controale/instrument în stânga-sus. Evită fereastra flotantă din dreapta-sus.
    val (topLeftCrop, topLeftScaled) = cropAndScale(0.00f, 0.06f, 0.62f, 0.44f)
    // ROI 2: eticheta timeframe de lângă axa prețului. În captura M1 este aici.
    val (rightMidCrop, rightMidScaled) = cropAndScale(0.69f, 0.24f, 0.90f, 0.73f)
    val (rightFocusCrop, rightFocusScaled) = cropAndScale(0.69f, 0.28f, 0.89f, 0.46f)

    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    var leftText = ""

    fun cleanup() {
      try { topLeftScaled.recycle() } catch (_: Throwable) {}
      if (topLeftCrop !== topLeftScaled) try { topLeftCrop.recycle() } catch (_: Throwable) {}
      try { rightMidScaled.recycle() } catch (_: Throwable) {}
      if (rightMidCrop !== rightMidScaled) try { rightMidCrop.recycle() } catch (_: Throwable) {}
      try { rightFocusScaled.recycle() } catch (_: Throwable) {}
      if (rightFocusCrop !== rightFocusScaled) try { rightFocusCrop.recycle() } catch (_: Throwable) {}
      try { copy.recycle() } catch (_: Throwable) {}
      try { recognizer.close() } catch (_: Throwable) {}
      marketOcrBusy = false
    }

    fun applyDetectedTexts(rightText: String) {
      // v1.0.32 STRICT TIMEFRAME ROI:
      // Perechea se citește din stânga, timeframe-ul EXCLUSIV din zona dreapta-mijloc
      // unde brokerul afișează M1/M5/M10 etc. Nu combinăm cele două zone.
      // Eliminăm și eventualul text propriu al overlay-ului din OCR ca să nu
      // se auto-confirme un timeframe vechi (ex. "SCALP ATLAS • M30").
      val cleanRightText = rightText
        .lines()
        .filterNot { line ->
          val u = line.uppercase()
          u.contains("SCALP") ||
            u.contains("ATLAS") ||
            u.contains("AȘTEAPTĂ") ||
            u.contains("PAUZĂ") ||
            u.contains("CANDIDAT") ||
            u.contains("CONFIRMAT") ||
            u.contains("NU INTRA")
        }
        .joinToString(" ")

      val detectedTimeframe = normalizeTimeframe(cleanRightText)
      noteChartCountdownFromChart(cleanRightText, detectedTimeframe)
      val detectedPair = normalizePair(leftText)
      var changed = false

      if (detectedTimeframe != null) {
        timeframeMissCount = 0
        if (timeframeCandidate == detectedTimeframe) {
          timeframeCandidateCount += 1
        } else {
          timeframeCandidate = detectedTimeframe
          timeframeCandidateCount = 1

          if (currentTimeframe != "AUTO" && detectedTimeframe != currentTimeframe) {
            currentTimeframe = "AUTO"
            resetSignalStateForMarketChange()
            updateOverlay(
              "AȘTEAPTĂ",
              "TIMEFRAME AUTO • verific " + detectedTimeframe,
              "Confirmare timeframe 1/2 • fără semnal"
            )
          }
        }

        if (timeframeCandidateCount >= 2 && currentTimeframe != detectedTimeframe) {
          currentTimeframe = detectedTimeframe
          timeframeCandidateCount = 0
          changed = true
        }
      } else {
        timeframeMissCount += 1
        if (timeframeMissCount >= 3) {
          timeframeCandidate = null
          timeframeCandidateCount = 0
          timeframeMissCount = 0
          if (currentTimeframe != "AUTO") {
            currentTimeframe = "AUTO"
            resetSignalStateForMarketChange()
            updateOverlay(
              "AȘTEAPTĂ",
              "TIMEFRAME AUTO • etichetă M1/M5/M10/M15 neconfirmată",
              "Nu emit BIP până când brokerul afișează clar timeframe-ul"
            )
          }
        }
      }

      // OTC OCR IDENTITY v1.0.61: ML Kit sometimes omits the faint OTC
      // suffix from EUR/RUB OTC. Such a PARTIAL read is not proof of a
      // different market. Keep the last explicitly observed OTC suffix and
      // avoid erasing candidate history on the same real chart.
      val otcSuffixTemporarilyMissing =
        detectedPair != null &&
        currentPair.endsWith(" OTC") &&
        detectedPair == currentPair.removeSuffix(" OTC")

      if (detectedPair != null && detectedPair != currentPair &&
          !otcSuffixTemporarilyMissing) {
        // Protect against one transient erroneous pair OCR result.
        if (pairSwitchCandidate == detectedPair) {
          pairSwitchReads = (pairSwitchReads + 1).coerceAtMost(2)
        } else {
          pairSwitchCandidate = detectedPair
          pairSwitchReads = 1
        }
        if (pairSwitchReads >= 2) {
          currentPair = detectedPair
          pairSwitchCandidate = null
          pairSwitchReads = 0
          changed = true
        }
      } else {
        // Successful repeated reading of the known pair, or no new
        // positive evidence of a market change, cancels a stale candidate.
        pairSwitchCandidate = null
        pairSwitchReads = 0
      }

      if (changed) {
        resetSignalStateForMarketChange()
        updateOverlay(
          "AȘTEAPTĂ",
          "$currentPair • $currentTimeframe confirmat",
          "Timeframe verificat 2/2 • analiza a fost resetată"
        )
      } else if (currentTimeframe == "AUTO" && detectedTimeframe != null) {
        updateOverlay(
          "AȘTEAPTĂ",
          "TIMEFRAME AUTO • verific " + detectedTimeframe,
          "Confirmare timeframe " + timeframeCandidateCount + "/2 • fără semnal"
        )
      }
    }

    // Două citiri OCR pe zone mici și mărite sunt mai fiabile decât OCR pe ecranul complet.
    recognizer.process(InputImage.fromBitmap(topLeftScaled, 0))
      .addOnSuccessListener { result ->
        leftText = result.text
      }
      .addOnCompleteListener {
        recognizer.process(InputImage.fromBitmap(rightMidScaled, 0))
          .addOnSuccessListener { broadResult ->
            val broadText = broadResult.text
            recognizer.process(InputImage.fromBitmap(rightFocusScaled, 0))
              .addOnSuccessListener { focusResult ->
                val focusText = focusResult.text
                val focusTf = normalizeTimeframe(focusText)
                val broadWithoutOverlay = broadText.lines()
                  .filterNot { line ->
                    val u = line.uppercase()
                    u.contains("SCALP") || u.contains("ATLAS") ||
                      u.contains("AȘTEAPTĂ") || u.contains("NU INTRA") ||
                      u.contains("PAUZĂ") || u.contains("CONFIRMAT")
                  }
                  .joinToString(" ")
                // Broad fallback is permitted only if it contains an actual
                // nearby broker countdown and no self-overlay branding.
                val hasCountdown = Regex("""(?<![0-9])[0-9]{1,2}:[0-5][0-9](?![0-9])""")
                  .containsMatchIn(broadWithoutOverlay)
                val trusted = if (focusTf != null) focusText
                  else if (hasCountdown && !broadText.contains("SCALP", ignoreCase = true) &&
                           !broadText.contains("ATLAS", ignoreCase = true)) broadWithoutOverlay
                  else ""
                applyDetectedTexts(trusted)
              }
              .addOnFailureListener {
                val safeBroad = broadText.takeIf {
                  !it.contains("SCALP", ignoreCase = true) &&
                  !it.contains("ATLAS", ignoreCase = true) &&
                  Regex("""(?<![0-9])[0-9]{1,2}:[0-5][0-9](?![0-9])""")
                    .containsMatchIn(it)
                } ?: ""
                applyDetectedTexts(safeBroad)
              }
              .addOnCompleteListener {
                cleanup()
              }
          }
          .addOnFailureListener {
            recognizer.process(InputImage.fromBitmap(rightFocusScaled, 0))
              .addOnSuccessListener { focusResult ->
                applyDetectedTexts(focusResult.text)
              }
              .addOnFailureListener {
                applyDetectedTexts("")
              }
              .addOnCompleteListener {
                cleanup()
              }
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

    startFramePolling(width, height)
    updateOverlay("AȘTEAPTĂ", "$currentTimeframe • flux ecran activ", "Cadre 0 • Rez 0 • Erori 0")
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
            "$currentTimeframe • FLUX ÎNGHEȚAT",
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

      scheduleMarketOcr(fullFrame)

      val onTradingChart = isTradingChartFrame(fullFrame)
      if (!onTradingChart) {
        if (chartDetected) {
          chartDetected = false
          candidateDir = null
          candidateCount = 0
          candidateLastAt = 0L
        }
        fullFrame.recycle()
        updateOverlay(
          "AȘTEAPTĂ",
          "GRAFIC NEDETECTAT",
          "Analiza este oprită în afara platformei"
        )
        return
      } else if (!chartDetected) {
        chartDetected = true
        updateOverlay(
          "AȘTEAPTĂ",
          "GRAFIC DETECTAT • AUTO",
          "Analiză activă"
        )
      }


      // GENERIC CHART CROP v1.0.27:
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
      val submittedFrameId = frameCount
      val capturedTimeframe = currentTimeframe
      latestSubmittedFrameId = submittedFrameId
      analysisBusy = true
      analysisStartedAt = now

      mainHandler.post {
        val dataUrl = "data:image/jpeg;base64," + base64
        val quotedUrl = JSONObject.quote(dataUrl)
        analyzerWebView?.evaluateJavascript(
          "window.ScalpAtlasAnalyze && window.ScalpAtlasAnalyze(" + quotedUrl + ",'" + (if (capturedTimeframe == "AUTO") "M15" else capturedTimeframe) + "'," + submittedFrameId + ");",
          null
        )
      }
    } catch (_: Throwable) {
      analysisBusy = false
    } finally {
      image.close()
    }
  }

  private fun noteChartCountdownFromChart(rightOcrText: String, detectedTimeframe: String?) {
    val now = System.currentTimeMillis()
    if (detectedTimeframe != "M5" && detectedTimeframe != "M10") return
    if (chartCountdownTf != detectedTimeframe) {
      chartCountdownTf = detectedTimeframe
      chartCountdownSeconds = null
      chartCountdownAt = 0L
      chartCountdownEvidenceCount = 0
    }

    val timeframeSeconds = if (detectedTimeframe == "M5") 300L else 600L
    val wallRemaining = (timeframeSeconds - ((now / 1000L) % timeframeSeconds)).toInt()
    val choices = Regex("""(?<![0-9])([0-9]{1,2}):([0-5][0-9])(?![0-9])""")
      .findAll(rightOcrText)
      .mapNotNull { m ->
        val mm = m.groupValues[1].toIntOrNull()
        val ss = m.groupValues[2].toIntOrNull()
        if (mm == null || ss == null || mm !in 0..9) null else mm * 60 + ss
      }
      .toList()

    val read = choices.minByOrNull { kotlin.math.abs(it - wallRemaining) }
    if (read == null || kotlin.math.abs(read - wallRemaining) > 35) {
      // A missing read does not turn an old OCR sample into fresh evidence.
      if (now - chartCountdownAt > 12_000L) {
        chartCountdownSeconds = null
        chartCountdownAt = 0L
        chartCountdownEvidenceCount = 0
      }
      return
    }

    val previous = chartCountdownSeconds
    val elapsed = (now - chartCountdownAt).coerceAtLeast(0L) / 1000L
    val consecutive = previous != null &&
      chartCountdownAt > 0L &&
      now - chartCountdownAt <= 15_000L &&
      kotlin.math.abs((previous - elapsed.toInt()) - read) <= 12

    chartCountdownEvidenceCount =
      if (consecutive) (chartCountdownEvidenceCount + 1).coerceAtMost(3) else 1
    chartCountdownSeconds = read
    chartCountdownAt = now
  }

  private fun m5EntryTimingRejection(now: Long): String? {
    if (currentTimeframe != "M5") return null
    val read = chartCountdownSeconds
    if (read == null || chartCountdownTf != "M5" || chartCountdownEvidenceCount < 2 ||
        chartCountdownAt <= 0L || now - chartCountdownAt > 12_000L) {
      return "M5: cronometrul lumânării nu este verificat (2 citiri OCR)"
    }
    val elapsed = ((now - chartCountdownAt).coerceAtLeast(0L) / 1000L).toInt()
    val remaining = read - elapsed
    val expected = 300 - ((now / 1000L) % 300L).toInt()
    if (kotlin.math.abs(remaining - expected) > 20) {
      return "M5: cronometrul graficului nu coincide cu timpul real"
    }
    // M5 COUNTDOWN GUARD v1.0.56:
    // Allow verified alerts throughout the *middle* of an M5 candle.
    // Exclude opening/closing 30s to avoid OCR/bar rollover instability,
    // not because the time itself predicts profitable direction.
    // CANDIDAT stays visible without a BIP even during these exclusions.
    if (remaining !in 30..270) {
      return "M5: verifică lumânarea stabilă • fără BIP în primele/ultimele 30 secunde"
    }
    return null
  }

  private fun m10EntryTimingRejection(now: Long): String? {
    if (currentTimeframe != "M10") return null
    val read = chartCountdownSeconds
    if (read == null || chartCountdownTf != "M10" || chartCountdownEvidenceCount < 2 ||
        chartCountdownAt <= 0L || now - chartCountdownAt > 12_000L) {
      return "Cronometru M10 nedetectat sau neverificat (2 citiri OCR)"
    }

    val elapsed = ((now - chartCountdownAt).coerceAtLeast(0L) / 1000L).toInt()
    val remaining = read - elapsed
    val expected = 600 - ((now / 1000L) % 600L).toInt()
    if (kotlin.math.abs(remaining - expected) > 35) {
      return "Cronometrul graficului nu este sincronizat cu M10"
    }
    // At least 6m30s must remain (5m expiry + margin); also exclude
    // the opening 70 seconds when OCR / candle colors can be unstable.
    if (remaining !in 390..530) {
      return "Fereastră M10 pentru test 5 min: așteaptă 06:30–08:50"
    }
    return null
  }

  private fun verifiedBarKeyForSignal(now: Long): String? {
    if (currentTimeframe != "M10" && currentTimeframe != "M5") return null
    // Paired with the strict verified M10 countdown guard from v1.0.44.
    // No pair or stale OCR = NO signal. The 10-minute boundary is only
    // accepted after chart timer and phone clock have agreed.
    val pair = currentPair.trim().uppercase()
    if (pair.isBlank() || pair == "—" || pair == "UNKNOWN") return null
    if (m10EntryTimingRejection(now) != null || m5EntryTimingRejection(now) != null) return null
    val read = chartCountdownSeconds ?: return null
    val elapsed = ((now - chartCountdownAt).coerceAtLeast(0L) / 1000L).toInt()
    val remaining = read - elapsed
    val closeMillis = now + remaining * 1000L
    val barMillis = if (currentTimeframe == "M5") 300_000L else 600_000L
    val closeBarId = (closeMillis + 30_000L) / barMillis
    return pair + "|" + currentTimeframe + "|" + closeBarId
  }

  private fun recordPaperOnlySignal(now: Long, key: String, dir: String) {
    // Stores metadata for REVIEW after five minutes. No price feed or
    // verified closing quote exists, so this does NOT label wins/losses.
    try {
      val prefs = getSharedPreferences("scalp_atlas_paper_signals", Context.MODE_PRIVATE)
      val previous = org.json.JSONArray(prefs.getString("events", "[]"))
      val recent = org.json.JSONArray()
      for (i in max(0, previous.length() - 79) until previous.length()) {
        recent.put(previous.get(i))
      }
      recent.put(
        JSONObject()
          .put("pair", currentPair)
          .put("timeframe", currentTimeframe)
          .put("dir", dir)
          .put("sentAt", now)
          .put("reviewAt", now + 5 * 60_000L)
          .put("barKey", key)
          .put("outcome", "REQUIRES_PRICE_VERIFICATION")
      )
      prefs.edit().putString("events", recent.toString()).apply()
    } catch (_: Exception) {
      // An optional private journal must not crash the real-time overlay.
    }
  }

  // ONE-DIRECTION GUARD v1.0.49
  // A vote is not a trading instruction. If the same M5/M10 candle switches
  // tentative direction, suppress both directions for that bar, including BIP.
  // Pair+timeframe+bar key and conflict status persist across overlay restarts.
  private fun directionConsistencyBlock(now: Long, tentative: String, signal: String): String? {
    val seconds = when (currentTimeframe) {
      "M5" -> 300_000L
      "M10" -> 600_000L
      else -> return null
    }
    val pair = currentPair.trim().uppercase()
    if (pair.isBlank() || pair == "—" || pair == "UNKNOWN") {
      return "Instrument neidentificat • nu confirm direcția"
    }
    val barBegin = (now / seconds) * seconds
    val key = pair + "|" + currentTimeframe + "|" + barBegin
    val prefs = getSharedPreferences("scalp_atlas_direction_guard_v1049", Context.MODE_PRIVATE)
    if (previewBarKey != key) {
      previewBarKey = key
      previewStableReads = 0
      previewReadAt = 0L
      // Keep the store small; do not forget conflicts within the same bar.
      val editor = prefs.edit()
      for (oldKey in prefs.all.keys) {
        val oldStart = oldKey.substringAfterLast('|').toLongOrNull()
        if (oldStart != null && now - oldStart > 4L * 60L * 60L * 1000L) {
          editor.remove(oldKey)
        }
      }
      editor.apply()
    }

    val first = prefs.getString(key, null)
    if (first == "CONFLICT") {
      return "DIRECȚII CONTRADICTORII în aceeași lumânare • FĂRĂ BIP până la următoarea"
    }

    val valid = tentative == "BUY" || tentative == "SELL"
    if (valid) {
      if (first != null && first != tentative) {
        prefs.edit().putString(key, "CONFLICT").commit()
        previewStableReads = 0
        previewReadAt = 0L
        return "INVERSARE BUY/SELL detectată în aceeași lumânare • FĂRĂ BIP"
      }
      if (first == null && !prefs.edit().putString(key, tentative).commit()) {
        return "Nu pot salva direcția inițială • FĂRĂ BIP"
      }
      // Do not mark BUY or SELL as a candidate from a single noisy scan.
      if (previewReadAt == 0L || now - previewReadAt > 16_000L) {
        previewStableReads = 1
        previewReadAt = now
      } else if (now - previewReadAt >= 4_000L) {
        previewStableReads = (previewStableReads + 1).coerceAtMost(3)
        previewReadAt = now
      }
      if (previewStableReads < 2) {
        return "Verific stabilitatea direcției (2 citiri la minimum 4 secunde) • FĂRĂ BIP"
      }
    }

    if (signal == "BUY" || signal == "SELL") {
      if (!valid || signal != tentative || first != null && first != signal) {
        return "Votul recent nu confirmă direcția semnalului • FĂRĂ BIP"
      }
      if (previewStableReads < 2) {
        return "Direcție insuficient stabilă • FĂRĂ BIP"
      }
    }
    return null
  }

  private fun handleResult(result: JSONObject) {
    val now = System.currentTimeMillis()

    // SAFE MARKET SWITCH v1.0.61:
    // Do not let the previously detected pair's analysis authorize a bip
    // while the next chart pair is still only 1/2 OCR readings verified.
    if (pairSwitchCandidate != null) {
      candidateDir = null
      candidateBarKey = null
      candidateCount = 0
      candidateLastAt = 0L
      updateOverlay(
        "AȘTEAPTĂ",
        "$currentPair • $currentTimeframe • PERECHE ÎN VERIFICARE • NU INTRA",
        "Confirm perechea nouă 1/2 • FĂRĂ BIP"
      )
      return
    }

    if (currentTimeframe == "AUTO") {
      candidateDir = null
      candidateCount = 0
      candidateLastAt = 0L
      lockedDir = null
      lockedUntil = 0L
      val score = result.optInt("probability", 0)
      updateOverlay(
        "AȘTEAPTĂ",
        "TIMEFRAME AUTO • detectez din grafic",
        "Fără semnal până la identificarea timeframe-ului • Scor " + score + "%"
      )
      return
    }
    val rawSignal = result.optString("signal", "NONE")
    // DIAGNOSTIC PREVIEW v1.0.48: NOT a trade instruction and NEVER a bip.
    // The engine's tentative vote direction is distinct from rawSignal.
    val previewDir = result.optString("candidateDirection", "NONE")
    val previewLabel = when (previewDir) {
      "BUY" -> "CANDIDAT CUMPĂRARE"
      "SELL" -> "CANDIDAT VÂNZARE"
      else -> "AȘTEAPTĂ"
    }
    val score = result.optInt("probability", 0)
    // The user tests five-minute expiry on M10. This is an execution
    // setting, not a statistical promise that a 5-minute trade will win.
    val expiry = if (currentTimeframe == "M5" || currentTimeframe == "M10") 5 else result.optInt("expiry", 0)
    val directionMax = result.optInt("directionMax", 0)
    val pattern = result.optString("pattern", "—")
    val reason = result.optString("reason", "")

    val directionBlock = directionConsistencyBlock(now, previewDir, rawSignal)
    if (directionBlock != null) {
      candidateDir = null
      candidateBarKey = null
      candidateCount = 0
      candidateLastAt = 0L
      updateOverlay(
        "AȘTEAPTĂ",
        "$currentPair • $currentTimeframe • DIRECȚIE NECONFIRMATĂ • NU INTRA",
        directionBlock
      )
      return
    }

    val currentLock = lockedDir
    if (currentLock != null && now < lockedUntil) {
      val seconds = max(0L, (lockedUntil - now) / 1000L)
      if (now < signalVisibleUntil) {
        val holdSeconds = max(1L, (signalVisibleUntil - now + 999L) / 1000L)
        updateOverlay(
          signalLabel(currentLock),
          "CONFIRMAT " + REQUIRED_CONFIRMATIONS + "/" + REQUIRED_CONFIRMATIONS +
            " + BIP • " + holdSeconds + "s",
          "SEMNAL FIX • rămâne afișat 10 secunde • fără inversare"
        )
      } else {
        updateOverlay(
          "PAUZĂ SEMNAL",
          "Așteaptă următorul semnal • " + formatSeconds(seconds),
          "NU INTRA • CUMPĂRARE/VÂNZARE apare numai la CONFIRMAT " +
            REQUIRED_CONFIRMATIONS + "/" + REQUIRED_CONFIRMATIONS + " + BIP"
        )
      }
      return
    }

    if (currentLock != null && now >= lockedUntil) {
      lockedDir = null
      lockedUntil = 0L
      signalVisibleUntil = 0L
      candidateDir = null
      candidateCount = 0
      candidateLastAt = 0L
    }

    // M10 5-MINUTE ENTRY GUARD v1.0.44.
    // Fail closed before counting confirmations or playing any beep.
    val timingRejection = m10EntryTimingRejection(now) ?: m5EntryTimingRejection(now)
    if (timingRejection != null) {
      candidateDir = null
      candidateBarKey = null
      candidateCount = 0
      candidateLastAt = 0L
      updateOverlay(
        if (currentTimeframe == "AUTO") "AȘTEAPTĂ" else previewLabel,
        "NECONFIRMAT • NU INTRA • FĂRĂ BIP • $currentTimeframe / 5 min",
        timingRejection
      )
      return
    }

    // STABLE-CANDIDATE FIX v1.0.45: any missing/rejected result breaks
    // the candidate sequence. A fresh 2/2 must be continuous and in the
    // same M10 candle, not separated by stale WAIT/NONE results.
    if (rawSignal != "BUY" && rawSignal != "SELL") {
      candidateDir = null
      candidateBarKey = null
      candidateCount = 0
      candidateLastAt = 0L
      updateOverlay(
        if (currentTimeframe == "AUTO") "AȘTEAPTĂ" else previewLabel,
        "$currentPair • $currentTimeframe • NECONFIRMAT • NU INTRA • FĂRĂ BIP",
        if (reason.isNotBlank()) reason else "Nu există încă un semnal confirmat"
      )
      return
    }

    val currentChartBarKey = if (currentTimeframe == "M5" || currentTimeframe == "M10") verifiedBarKeyForSignal(now) else null
    if ((currentTimeframe == "M10" || currentTimeframe == "M5") && currentChartBarKey == null) {
      candidateDir = null
      candidateBarKey = null
      candidateCount = 0
      candidateLastAt = 0L
      updateOverlay(
        previewLabel,
        "NECONFIRMAT • NU INTRA • FĂRĂ BIP",
        "Nu pot confirma perechea, cronometrul sau lumânarea M5/M10"
      )
      return
    }

    if (candidateDir != rawSignal || candidateBarKey != currentChartBarKey) {
      candidateDir = rawSignal
      candidateBarKey = currentChartBarKey
      candidateCount = 1
      candidateLastAt = now
    } else if (now - candidateLastAt >= CONFIRMATION_SPACING_MS) {
      candidateCount += 1
      candidateLastAt = now
    }

    if (candidateCount < REQUIRED_CONFIRMATIONS) {
      updateOverlay(
        "AȘTEAPTĂ",
        "Candidat " + signalLabel(rawSignal) + " • Confirmare " + candidateCount + "/" + REQUIRED_CONFIRMATIONS,
        "Scor " + score + "% • " + pattern + " • " + currentPair + " • " + currentTimeframe
      )
      return
    }

    // ONE-ALERT-PER-M10-BAR v1.0.45:
    // Guard is persisted across overlay restarts and pair switching.
    // It prevents a second BIP for the exact same confirmed pair+M10 bar.
    if (currentTimeframe == "M5" || currentTimeframe == "M10") {
      val barKey = currentChartBarKey ?: return
      val prefs = getSharedPreferences("scalp_atlas_bar_dedupe", Context.MODE_PRIVATE)
      val seen = prefs.getStringSet("barKeys", emptySet()) ?: emptySet()
      if (barKey in seen) {
        candidateDir = null
        candidateBarKey = null
        candidateCount = 0
        candidateLastAt = 0L
        updateOverlay(
          "PAUZĂ SEMNAL",
          "NU INTRA • semnal deja emis pentru lumânarea curentă",
          "Un singur BIP per pereche și lumânare"
        )
        return
      }
      val currentBarId = barKey.substringAfterLast('|').toLongOrNull() ?: return
      val updated = seen.filter { stored ->
        val id = stored.substringAfterLast('|').toLongOrNull()
        id != null && id >= currentBarId - 144L
      }.toMutableSet()
      updated.add(barKey)
      if (!prefs.edit().putStringSet("barKeys", updated).commit()) {
        updateOverlay("AȘTEAPTĂ", "NU INTRA • evidența semnalelor indisponibilă", "Fără bip")
        return
      }
      recordPaperOnlySignal(now, barKey, rawSignal)
    }

    // SIGNAL LOCK v1.0.23
    // Blocarea direcției trebuie să urmeze expirarea recomandată a trade-ului,
    // nu fereastra mai lungă de direcție. Expirarea urmează timeframe-ul detectat.
    val lockMinutes = when {
      expiry > 0 -> expiry.coerceIn(1, 60)
      currentTimeframe.startsWith("M") -> currentTimeframe.drop(1).toIntOrNull()?.coerceIn(1, 60) ?: 10
      currentTimeframe == "H1" -> 60
      else -> 10
    }
    lockedDir = rawSignal
    candidateBarKey = null
    lockedUntil = now + lockMinutes * 60_000L
    signalVisibleUntil = now + SIGNAL_HOLD_MS
    candidateDir = null
    candidateCount = 0
    candidateLastAt = 0L

    // DEMO EXPERIMENT: two consecutive *scans* plus separate candle
    // color and M10 countdown heuristics; no claim of future profit.
    playBip()
    val autoDemoResult = ScalpAutoDemoAccessibilityService.requestDemoTrade(rawSignal)
    // Keep execution status visible beyond the 10-second sound/signal overlay.
    // A BIP alone proves only a signal, not a broker trade.
    mainHandler.post { refreshAutoDemoText(autoDemoResult) }
    val expiryLabel = if (expiry > 0) "$expiry min" else "—"
    updateOverlay(
      signalLabel(rawSignal),
      "CONFIRMAT " + REQUIRED_CONFIRMATIONS + "/" + REQUIRED_CONFIRMATIONS + " • Scor " + score + "%",
      "BIP • Expirare $expiryLabel • $pattern • $currentPair • $currentTimeframe • $autoDemoResult"
    )
  }

  private fun refreshAutoDemoText(status: String? = null) {
    val connected = ScalpAutoDemoAccessibilityService.isConnected()
    val enabled = ScalpAutoDemoAccessibilityService.isEnabled(this)
    val value = status ?: when {
      !connected -> "ACTIVEAZĂ ACCESIBILITATEA"
      enabled -> "PORNIT • NUMAI QT DEMO"
      else -> "OPRIT"
    }
    autoDemoText?.text = "AUTO DEMO: " + value
    autoDemoText?.setTextColor(
      if (connected && enabled) Color.rgb(52, 218, 148) else Color.rgb(210, 222, 238)
    )
  }

  private fun signalLabel(signal: String): String =
    when (signal) {
      "BUY" -> "CUMPĂRARE"
      "SELL" -> "VÂNZARE"
      else -> signal
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
      titleText?.text = "SCALP ATLAS • " + currentTimeframe
      timeframeTitleText?.text = "SCALP ATLAS • " + currentTimeframe
      signalText?.text = signal
      signalText?.setTextColor(
        when {
          signal.startsWith("BUY") || signal.startsWith("CUMPĂRARE") -> Color.rgb(52, 218, 148)
          signal.startsWith("SELL") || signal.startsWith("VÂNZARE") -> Color.rgb(255, 88, 96)
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
