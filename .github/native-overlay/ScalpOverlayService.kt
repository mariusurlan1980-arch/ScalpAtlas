package com.scalpatlas.app

import android.animation.ValueAnimator
import android.app.Notification
import android.app.PendingIntent
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Color
import android.graphics.ColorFilter
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
import android.text.TextUtils
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Base64
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.LinearInterpolator
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
import kotlin.math.min
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
    // A visually correct pattern is useless if the analyzed frame is stale.
    // Fail closed before any candidate confirmation or audible alert.
    private const val MAX_ALERT_ANALYSIS_AGE_MS = 3000L
    private const val CONFIRMATION_SPACING_MS = 1500L
    private const val REQUIRED_CONFIRMATIONS = 2
    // If optical evidence disappears, an old candidate must not recover as
    // if it had been continuously confirmed for the past minute.
    private const val CANDIDATE_EVIDENCE_GRACE_MS = 6_000L
    private const val CANDIDATE_MAX_AGE_MS = 15_000L
    // A direction's 5-7 minute lock is NOT a 5-7 minute window for NEW entries.
    private const val ALERT_FRESH_MS = 30_000L
    private const val OCR_INTERVAL_MS = 3000L
    private const val TF_STALE_MS = 18000L
    private const val MARKET_STALE_MS = 12_000L
    private const val MARKET_SETTLE_MS = 6_000L
    private const val MARKET_OCR_CONFIRMATIONS = 2
  }

  private lateinit var windowManager: WindowManager
  private var overlayView: View? = null
  @Volatile private var overlayWindowParams: WindowManager.LayoutParams? = null
  private var signalText: TextView? = null
  private var detailText: TextView? = null
  private var modelText: TextView? = null
  private var journalControl: TextView? = null
  private var testStatusText: TextView? = null
  private lateinit var journal: SignalJournal
  private lateinit var liveTest: LiveTestMonitor
  private var lastTestStatusAt = 0L
  @Volatile private var keepScreenForTest = false
  @Volatile private var latestMarket = "NEIDENTIFICAT"
  @Volatile private var latestMarketAt = 0L
  @Volatile private var marketVerified = false
  @Volatile private var marketLabelAmbiguous = false
  @Volatile private var marketStableAt = 0L
  @Volatile private var marketEpoch = 0L
  private var pendingMarket: String? = null
  private var pendingMarketCount = 0
  private var pendingMarketAt = 0L
  private var pendingMarketSince = 0L
  @Volatile private var frameMarketEpoch = -1L
  @Volatile private var frameMarket = "NEIDENTIFICAT"
  @Volatile private var latestChartJpegBytes: ByteArray? = null

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
  @Volatile private var lastCapturedImageAt = 0L
  @Volatile private var lastAnalysisResultAt = 0L
  @Volatile private var lastFreezeNoticeAt = 0L
  private var lastRenderedSignal = ""
  @Volatile private var lastShockQuality = 0
  // Only measured live-candle shock RETRACEMENT is displayed as percentage.
  @Volatile private var observedShockPercent = 0
  @Volatile private var observedShockAt = 0L
  @Volatile private var lastConfirmedShockPercent = 0
  @Volatile private var observedCandleDirection = "NONE"
  @Volatile private var observedOpticalQuality = 0
  @Volatile private var observedCandleAt = 0L
  private var lastRenderedDetails = ""
  private var lastRenderedModel = ""
  private var lastRenderedCounterAt = 0L
  @Volatile private var activeFrameId = -1L
  @Volatile private var previousVisualSample: IntArray? = null
  @Volatile private var lastVisualChangeAt = 0L
  @Volatile private var frameCount = 0L
  @Volatile private var resultCount = 0L
  @Volatile private var errorCount = 0L
  // Lightweight LIVE heartbeat for the MAIN app screen only; no screenshots
  // or personal broker information are persisted as diagnostic data.
  private var lastDiagnosticWriteAt = 0L
  private var lastDiagnosticStage = ""

  private var candidateDir: String? = null
  private var candidateCount = 0
  private var candidateLastAt = 0L
  private var candidateLastSeenAt = 0L
  private var candidateStartedAt = 0L
  private var lockedDir: String? = null
  private var lockedUntil = 0L
  private var lockedAt = 0L
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
  private var manualTfMismatchCount = 0
  private var manualTfMismatchAt = 0L
  @Volatile private var manualTfConflict = false
  private val ocrRecognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
  @Volatile private var chartZone = 1
  @Volatile private var bellEnabled = true
  private val bellPrefsName = "scalp_atlas_327"
  private val bellPrefsKey = "bell_enabled"
  private var bellControl: TextView? = null
  private var tfControl: TextView? = null
  private var chartControl: TextView? = null

  /**
   * Reset unfinished analysis when the screen or OCR is temporarily unavailable.
   *
   * IMPORTANT: Never cancel an already-confirmed alert here. Android OCR can
   * temporarily lose the M5 label, and a frozen/occluded region can recover.
   * Clearing the lock used to produce SELL then AȘTEAPTĂ BUY seconds later.
   * Only handleResult() may expire the confirmed lock after lockedUntil.
   */
  private fun resetSignalState() {
    observedShockPercent = 0
    observedShockAt = 0L
    observedCandleDirection = "NONE"
    observedOpticalQuality = 0
    observedCandleAt = 0L
    candidateDir = null
    candidateCount = 0
    candidateLastAt = 0L
    candidateLastSeenAt = 0L
    candidateStartedAt = 0L
    analysisBusy = false
    activeFrameId = -1L
  }

  /**
   * Instrument changes must never inherit the previous pair's 3 confirmations,
   * BUY/SELL headline, or its 5-7 minute direction lock.
   * This is distinct from transient timeframe OCR failures.
   */
  private fun clearOnInstrumentChange() {
    marketLabelAmbiguous = false
    resetSignalState()
    lockedDir = null
    lockedUntil = 0L
    lockedAt = 0L
    lastShockQuality = 0
    lastConfirmedShockPercent = 0
    resetVisualBaseline()
    marketEpoch += 1L
  }

  private fun currentPair(now: Long): String =
    if (marketVerified && now - latestMarketAt <= MARKET_STALE_MS)
      latestMarket else "NEIDENTIFICAT"

  private fun pairReady(now: Long): Boolean =
    marketVerified && !marketLabelAmbiguous &&
      now - latestMarketAt <= MARKET_STALE_MS &&
      now - marketStableAt >= MARKET_SETTLE_MS

  private fun resetVisualBaseline() {
    previousVisualSample = null
    lastVisualChangeAt = 0L
  }

  private val mainHandler = Handler(Looper.getMainLooper())

  override fun onCreate() {
    super.onCreate()
    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    journal = SignalJournal(this)
    liveTest = LiveTestMonitor(this)
    bellEnabled = getSharedPreferences(bellPrefsName, Context.MODE_PRIVATE).getBoolean(bellPrefsKey, true)
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

  // Swiping the ScalpAtlas task away explicitly closes its floating window.
  // Merely switching to the broker does not remove the app task or interrupt LIVE.
  override fun onTaskRemoved(rootIntent: Intent?) {
    stopSelf()
    super.onTaskRemoved(rootIntent)
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

  private fun buildNotification(): Notification {
    val stopIntent = Intent(this, ScalpOverlayService::class.java).apply {
      action = ACTION_STOP
    }
    val stopPendingIntent = PendingIntent.getService(
      this, 4827, stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_view)
      .setContentTitle("SCALP ATLAS • LIVE")
      .setContentText("Captură activă • apasă Oprește LIVE pentru a închide suprapunerea")
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Oprește LIVE", stopPendingIntent)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  private fun dp(value: Int): Int =
    (value * resources.displayMetrics.density).roundToInt()

  private fun rounded(color: Int, strokeColor: Int): GradientDrawable =
    GradientDrawable().apply {
      setColor(color)
      cornerRadius = dp(14).toFloat()
      setStroke(dp(1), strokeColor)
    }

  /**
   * Compact white floating overlay approved from the 3.2.7 reference image.
   * Percentage is measured SHOCK RETRACEMENT of the forming candle,
   * NEVER optical detection quality or estimated WIN probability.
   * There are no legacy TF, journal or test rows in the visible overlay.
   */
  private class ShockCandleView(context: Context) : View(context) {
    var direction: String = "NONE"
      set(value) {
        if (field != value) {
          field = value
          invalidate()
        }
      }

    override fun onDraw(canvas: Canvas) {
      super.onDraw(canvas)
      val tone = when (direction) {
        "BUY" -> Color.rgb(33, 211, 125)
        "SELL" -> Color.rgb(226, 72, 85)
        else -> Color.rgb(171, 182, 193)
      }
      val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = tone
        style = Paint.Style.STROKE
        strokeWidth = width * 0.055f
        strokeCap = Paint.Cap.ROUND
      }
      val cx = width * 0.5f
      val top = height * 0.12f
      val bottom = height * 0.89f
      canvas.drawLine(cx, top, cx, bottom, p)
      p.style = Paint.Style.FILL
      canvas.drawRoundRect(
        width * 0.29f, height * 0.32f, width * 0.71f, height * 0.70f,
        width * 0.05f, width * 0.05f, p
      )
    }
  }


  /**
   * Pulse only the circle, never the text. 500 ms brighter + 500 ms dimmer.
   * This is a VISUAL confirmation only; no signals or BIPs are emitted here.
   */
  private class ShockPulseDrawable(private val strokePx: Float) : android.graphics.drawable.Drawable() {
    var direction: String = "NONE"
      set(value) { if (field != value) { field = value; invalidateSelf() } }
    var intensity: Float = 0.35f
      set(value) { field = value.coerceIn(0f, 1f); invalidateSelf() }
    override fun draw(canvas: Canvas) {
      val cx = bounds.exactCenterX()
      val cy = bounds.exactCenterY()
      val radius = (min(bounds.width(), bounds.height()) * 0.5f - strokePx * 1.6f).coerceAtLeast(1f)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
      }
      val tone = when(direction) {
        "BUY" -> Color.rgb(0, 204, 102)
        "SELL" -> Color.rgb(235, 52, 72)
        else -> Color.rgb(221, 233, 229)
      }
      paint.color = tone
      if (direction == "NONE") {
        paint.strokeWidth = strokePx
        paint.alpha = 255
        canvas.drawCircle(cx, cy, radius, paint)
      } else {
        // Subtle outer colored halo, never obscures the broker's candles.
        paint.strokeWidth = strokePx * 2.5f
        paint.alpha = (20f + 35f * intensity).roundToInt().coerceIn(0, 255)
        canvas.drawCircle(cx, cy, radius, paint)
        paint.strokeWidth = strokePx
        paint.alpha = (89f + 166f * intensity).roundToInt().coerceIn(0, 255)
        canvas.drawCircle(cx, cy, radius, paint)
      }
    }
    override fun setAlpha(alpha: Int) {}
    override fun setColorFilter(colorFilter: ColorFilter?) {}
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
  }

  private var pulseRingDrawable: ShockPulseDrawable? = null
  private var pulseRingAnimator: ValueAnimator? = null
  private var pulseRingDirection = "NONE"

  private fun stopPulseRing() {
    pulseRingAnimator?.cancel()
    pulseRingAnimator = null
    pulseRingDirection = "NONE"
    pulseRingDrawable?.apply { direction = "NONE"; intensity = 0.35f }
  }

  private fun setPulseRing(direction: String) {
    val next = if (direction == "BUY" || direction == "SELL") direction else "NONE"
    if (pulseRingDirection == next) return
    stopPulseRing()
    if (next == "NONE") return
    pulseRingDirection = next
    pulseRingDrawable?.direction = next
    pulseRingAnimator = ValueAnimator.ofFloat(0.35f, 1f, 0.35f).apply {
      duration = 1000L
      repeatCount = ValueAnimator.INFINITE
      interpolator = LinearInterpolator()
      addUpdateListener { animation ->
        val now = System.currentTimeMillis()
        // Strict stop on signal expiry, market change, absent/late capture, or TF loss.
        val safe = pulseRingDirection == next && lockedDir == next &&
          now < lockedUntil && analyzerReady &&
          lastCapturedImageAt > 0L && now - lastCapturedImageAt in 0L..3500L &&
          pairReady(now) && !manualTfConflict &&
          (!tfAutomatic || (tfVerified && now - confirmedTfAt in 0L..TF_STALE_MS))
        if (!safe) stopPulseRing()
        else pulseRingDrawable?.intensity = animation.animatedValue as Float
      }
      start()
    }
  }

  private var candleGraphic: ShockCandleView? = null
  private var qualityText: TextView? = null
  private var captureStatusText: TextView? = null
  private var signalRing: LinearLayout? = null

  private fun createOverlay() {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(9), dp(6), dp(9), dp(8))
      background = GradientDrawable().apply {
        setColor(Color.rgb(249, 250, 250))
        cornerRadius = dp(18).toFloat()
        setStroke(dp(1), Color.rgb(232, 237, 237))
      }
      elevation = dp(7).toFloat()
    }

    // No ScalpAtlas title. A visible close button ensures LIVE is never trapped
    // over the broker. The bell is the ONLY sound control.
    val header = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    val close = TextView(this).apply {
      text = "×"
      textSize = 21f
      setTextColor(Color.rgb(95, 108, 113))
      gravity = Gravity.CENTER
      contentDescription = "Închide suprapunerea și oprește LIVE"
      setOnClickListener { stopSelf() }
    }
    header.addView(close, LinearLayout.LayoutParams(dp(34), dp(28)))
    val headerGap = View(this)
    header.addView(headerGap, LinearLayout.LayoutParams(0, dp(1), 1f))
    bellControl = TextView(this).apply {
      text = if (bellEnabled) "🔔" else "🔕"
      textSize = 17f
      gravity = Gravity.CENTER
      contentDescription = "Activează sau dezactivează bipul"
      setOnClickListener {
        bellEnabled = !bellEnabled
        getSharedPreferences(bellPrefsName, Context.MODE_PRIVATE)
          .edit().putBoolean(bellPrefsKey, bellEnabled).apply()
        text = if (bellEnabled) "🔔" else "🔕"
      }
    }
    header.addView(bellControl, LinearLayout.LayoutParams(dp(35), dp(28)))
    root.addView(header)

    val body = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      setPadding(0, dp(3), 0, dp(2))
    }
    val candleColumn = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
    }
    candleGraphic = ShockCandleView(this).also {
      candleColumn.addView(it, LinearLayout.LayoutParams(dp(53), dp(72)))
    }
    captureStatusText = TextView(this).apply {
      text = "PAUZĂ"
      setTextColor(Color.rgb(91, 108, 116))
      textSize = 12f
      gravity = Gravity.CENTER
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      setPadding(0, dp(3), 0, 0)
    }
    candleColumn.addView(captureStatusText)
    body.addView(candleColumn, LinearLayout.LayoutParams(dp(79), dp(106)))
    val spacing = View(this)
    body.addView(spacing, LinearLayout.LayoutParams(dp(7), dp(1)))

    pulseRingDrawable = ShockPulseDrawable(dp(4).toFloat())
    signalRing = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      background = pulseRingDrawable
    }
    qualityText = TextView(this).apply {
      text = "—%"
      setTextColor(Color.rgb(105, 120, 126))
      textSize = 25f
      gravity = Gravity.CENTER
      setTypeface(typeface, android.graphics.Typeface.BOLD)
    }
    signalText = TextView(this).apply {
      text = "—"
      setTextColor(Color.rgb(105, 120, 126))
      textSize = 16f
      gravity = Gravity.CENTER
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      setPadding(0, dp(2), 0, 0)
    }
    signalRing?.addView(qualityText)
    signalRing?.addView(signalText)
    body.addView(signalRing, LinearLayout.LayoutParams(dp(109), dp(109)))
    root.addView(body)

    val note = TextView(this).apply {
      text = "ȘOC = RETRAGERE LUMÂNARE • NU WIN"
      setTextColor(Color.rgb(105, 111, 117))
      textSize = 8f
      gravity = Gravity.CENTER
      maxLines = 1
      setPadding(0, dp(4), 0, 0)
    }
    root.addView(note)

    val params = WindowManager.LayoutParams(
      dp(224),
      WindowManager.LayoutParams.WRAP_CONTENT,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      else WindowManager.LayoutParams.TYPE_PHONE,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = dp(8)
      y = dp(210) // initial position below asset picker; leaves BHD/CNY OTC visible for OCR
    }

    // Drag the white card on its background; bell and X remain clickable.
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
          val metrics = resources.displayMetrics
          params.x = (startX + (event.rawX - touchX).toInt())
            .coerceIn(0, (metrics.widthPixels - dp(224)).coerceAtLeast(0))
          params.y = (startY + (event.rawY - touchY).toInt())
            .coerceIn(0, (metrics.heightPixels - dp(165)).coerceAtLeast(0))
          overlayView?.let { windowManager.updateViewLayout(it, params) }
          true
        }
        else -> false
      }
    }
    overlayView = root
    overlayWindowParams = params
    windowManager.addView(root, params)
  }

  /**
   * Keep the physical screen awake ONLY during the time-limited 30-minute
   * observation test. The FLAG_KEEP_SCREEN_ON window flag needs no dangerous
   * device-admin permissions and cannot override a manual power-button lock.
   *
   * No wakelock or keep-screen behavior survives service shutdown.
   */
  private fun setKeepScreenForTest(enabled: Boolean) {
    if (keepScreenForTest == enabled) return
    keepScreenForTest = enabled
    mainHandler.post {
      val params = overlayWindowParams ?: return@post
      val root = overlayView ?: return@post
      val flag = WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
      val newFlags = if (keepScreenForTest) params.flags or flag
        else params.flags and flag.inv()
      if (params.flags == newFlags) return@post
      params.flags = newFlags
      try {
        windowManager.updateViewLayout(root, params)
      } catch (_: Throwable) {
        // Device/OEM can ignore keep-awake; the LIVE journal will record gaps.
      }
    }
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
            lastAnalysisResultAt = System.currentTimeMillis()
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
   * Track genuine small price/candle changes in the live broker's chart.
   *
   * Older 24x14 sampling skipped thin OTC candle bodies/wicks, incorrectly
   * labelling a working MediaProjection stream as "GRAFIC STATIC".
   * Use a dense sample on the plot's latest-candle side; our own overlay has
   * already been masked from the bitmap at this point.
   *
   * The window is 35s, not 12s: a quiet candle may barely change between
   * samples. If it genuinely stays unchanged, reject trade alerts.
   * These pixels verify chart activity, NOT trade direction or accuracy.
   */
  private fun hasFreshChartMotion(bitmap: Bitmap, now: Long): Boolean {
    val columns = 88
    val rows = 72
    val sampled = IntArray(columns * rows)
    var k = 0
    for (row in 0 until rows) {
      val yFraction = 0.025f + 0.88f * (row + 0.5f) / rows
      val y = (bitmap.height * yFraction).toInt().coerceIn(0, bitmap.height - 1)
      for (col in 0 until columns) {
        val xFraction = 0.31f + 0.62f * (col + 0.5f) / columns
        val x = (bitmap.width * xFraction).toInt().coerceIn(0, bitmap.width - 1)
        sampled[k++] = bitmap.getPixel(x, y)
      }
    }

    val previous = previousVisualSample
    previousVisualSample = sampled
    if (previous == null || previous.size != sampled.size) {
      lastVisualChangeAt = now
      return true
    }

    var changed = 0
    for (i in sampled.indices) {
      val current = sampled[i]
      val old = previous[i]
      if (kotlin.math.abs(Color.red(current) - Color.red(old)) > 8 ||
          kotlin.math.abs(Color.green(current) - Color.green(old)) > 8 ||
          kotlin.math.abs(Color.blue(current) - Color.blue(old)) > 8) {
        changed++
        if (changed >= 2) break
      }
    }
    if (changed >= 2) lastVisualChangeAt = now
    return now - lastVisualChangeAt <= 35_000L
  }

  /**
   * ML Kit reads the broker's visible timeframe caption in a full-size frame.
   * Only recognises a leading, standalone M5/M10/M15 or 5m/10m/15m:
   * avoids '00:05:00' (expiry) and 'TF M10' inside our own floating window.
   * Two consistent reads are required; uncertain OCR means NO SIGNAL.
   */
  private fun scheduleTimeframeOcr(frame: Bitmap, now: Long) {
    if (ocrBusy || now - lastOcrAttemptAt < OCR_INTERVAL_MS) return
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
        // Read the broker label from the upper chart or the right-hand chart
        // axis. Pocket Option can put "M10" after other text in an OCR line.
        // Exclude the bottom trading controls and our floating overlay so an
        // expiry duration or "TF AUTO M10" cannot confirm a timeframe.
        val pattern = Regex("""(?i)(?<![A-Z0-9])(?:M\s*(5|10|15)|(5|10|15)\s*M)(?![A-Z0-9])""")
        val values = result.textBlocks.flatMap { it.lines }.mapNotNull { line ->
          val bounds = line.boundingBox ?: return@mapNotNull null
          val centerX = bounds.centerX().toFloat() / copy.width
          val centerY = bounds.centerY().toFloat() / copy.height
          if (centerY > 0.73f || (centerY > 0.25f && centerX < 0.55f)) return@mapNotNull null
          val match = pattern.find(line.text) ?: return@mapNotNull null
          val minutes = match.groupValues[1].ifEmpty { match.groupValues[2] }
          "M" + minutes
        }.distinct()

        val observedAt = System.currentTimeMillis()
        // Read an explicit FX pair only when visible on the captured broker screen.
        // If OCR cannot find one, never guess which asset was selected.
        // OTC and ordinary charts using the same currency symbols must NOT
        // share confirmations, locks or per-instrument diagnostics.
        val pairPattern = Regex("""(?i)\b([A-Z]{3})\s*/\s*([A-Z]{3})\b(\s*\(?\s*OTC\s*\)?)?""")

        // Search ONLY the broker's instrument header. Text lower on the chart
        // can contain older labels/prices and must not select a different asset.
        // Join adjacent header lines because ML Kit sometimes splits "BHD/CNY"
        // and "OTC" on the same broker button.
        val headerLines = result.textBlocks.flatMap { it.lines }.filter { line ->
          val box = line.boundingBox ?: return@filter false
          val centerY = box.centerY().toFloat() / copy.height
          centerY in 0.045f..0.31f
        }.sortedWith(compareBy({ it.boundingBox?.centerY() ?: 0 }, { it.boundingBox?.left ?: 0 }))
        val headerText = headerLines.joinToString(" ") { it.text }
        // OCR may separate the OTC label or print it as "O T C".
        val otcPattern = Regex("""(?i)(?<![A-Z0-9])O\s*T\s*C(?![A-Z0-9])""")
        val pairs = pairPattern.findAll(headerText).map { match ->
          val base = match.groupValues[1].uppercase() + "/" + match.groupValues[2].uppercase()
          val nearby = headerText.substring(match.range.last + 1).take(32)
          val otc = match.groupValues[3].contains("OTC", ignoreCase = true) ||
            otcPattern.containsMatchIn(nearby)
          if (otc) "$base OTC" else base
        }.distinct().toList()
        // Require TWO consistent OCR detections. The first different asset
        // immediately invalidates a confirmed pair and old signal candidates.
        if (pairs.size == 1) {
          val foundPair = pairs[0]
          val sameBase = foundPair.removeSuffix(" OTC") == latestMarket.removeSuffix(" OTC")
          val ambiguousMode = marketVerified && sameBase && foundPair != latestMarket
          if (foundPair != latestMarket && marketVerified) {
            if (ambiguousMode) {
              // Never send an alert on uncertain OTC/standard mode.
              // Do not restart marketStableAt for a single missing OCR suffix.
              marketLabelAmbiguous = true
              resetSignalState()
              updateOverlay("AȘTEAPTĂ", "Verific OTC / standard",
                "Etichetă OCR neclară • fără bip")
            } else {
              marketVerified = false
              clearOnInstrumentChange()
              updateOverlay("AȘTEAPTĂ", "Pereche schimbată • verific " + foundPair,
                "BUY/SELL anterior anulat • aștept identificarea perechii")
            }
          } else if (foundPair == latestMarket) {
            marketLabelAmbiguous = false
          }
          if (pendingMarket != foundPair || observedAt - pendingMarketAt > 9_000L) {
            pendingMarket = foundPair
            pendingMarketCount = 1
            pendingMarketSince = observedAt
          } else {
            pendingMarketCount += 1
          }
          pendingMarketAt = observedAt
          // Four coherent observations for an OTC/standard mode change.
          val modeSwitchReady = !ambiguousMode ||
            (pendingMarketCount >= 4 && observedAt - pendingMarketSince >= 9_000L)
          if (pendingMarketCount >= MARKET_OCR_CONFIRMATIONS && modeSwitchReady) {
            if (!marketVerified || latestMarket != foundPair) {
              latestMarket = foundPair
              marketVerified = true
              marketStableAt = observedAt
              clearOnInstrumentChange()
              updateOverlay("AȘTEAPTĂ", "Pereche " + foundPair + " confirmată",
                "Analiză separată • aștept stabilizarea graficului")
            }
            latestMarketAt = observedAt
          }
        } else if (marketVerified && observedAt - latestMarketAt > MARKET_STALE_MS) {
          marketVerified = false
          marketLabelAmbiguous = false
          pendingMarket = null
          pendingMarketCount = 0
          resetSignalState()
          updateOverlay("AȘTEAPTĂ", "Pereche neidentificată",
            "Fără bip până la reconfirmarea instrumentului")
        }

        if (!tfAutomatic) {
          // Manual fallback must not silently interpret a visible M15 chart
          // as M5. Two consistent contradictory readings fail closed.
          if (values.size == 1) {
            if (values[0] == selectedTimeframe) {
              manualTfConflict = false
              manualTfMismatchCount = 0
              manualTfMismatchAt = 0L
            } else {
              if (observedAt - manualTfMismatchAt > 9_000L) manualTfMismatchCount = 0
              manualTfMismatchCount += 1
              manualTfMismatchAt = observedAt
              if (manualTfMismatchCount >= 2 && !manualTfConflict) {
                manualTfConflict = true
                clearOnInstrumentChange()
                updateOverlay("AȘTEAPTĂ", "TF diferit pe Pocket Option",
                  "Selectat " + selectedTimeframe + " • detectat " + values[0] +
                    " • bip blocat")
              }
            }
          }
          return@addOnSuccessListener
        }

        if (values.size == 1) {
          val found = values[0]
          if (pendingTf != found || observedAt - pendingTfAt > 9000L) {
            pendingTf = found
            pendingTfCount = 1
            pendingTfAt = observedAt
            if (tfVerified && found != selectedTimeframe) {
              tfVerified = false
              clearOnInstrumentChange()
              marketStableAt = observedAt
              updateOverlay("AȘTEAPTĂ", "AUTO • verific " + found,
                "Schimbare interval detectată • aștept confirmarea")
            }
          } else {
            pendingTfCount += 1
            pendingTfAt = observedAt
            if (pendingTfCount >= 2 && tfAutomatic) {
              val changed = selectedTimeframe != found
              val recovered = !tfVerified
              selectedTimeframe = found
              tfVerified = true
              confirmedTfAt = observedAt
              tfControl?.text = "TF AUTO " + found + " ▸"
              if (changed) {
                clearOnInstrumentChange()
                marketStableAt = observedAt
                updateOverlay("AȘTEAPTĂ", "AUTO • " + found + " confirmat",
                  "Schimbare reală de interval • reiau stabilizarea")
              } else if (recovered) {
                // Reconfirmation of the SAME M10 does not reset settlement.
                updateOverlay("AȘTEAPTĂ", "AUTO • " + found + " reconfirmat",
                  "Păstrez stabilizarea perechii")
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

    if (virtualDisplay != null) {
      liveTest.begin(System.currentTimeMillis(), frameCount, resultCount, errorCount)
      setKeepScreenForTest(true)
      mainHandler.post { testStatusText?.text = "TEST LIVE 30:00 • ECRAN PORNIT" }
    }
    startFramePolling(width, height)
    updateOverlay("AȘTEAPTĂ", "LIVE • flux ecran activ", "Cadre 0 • Rez 0 • Erori 0")
  }

  private fun startFramePolling(width: Int, height: Int) {
    val handler = captureHandler ?: return
    val task = object : Runnable {
      var lastStatusRefreshAt = 0L
      override fun run() {
        if (mediaProjection == null || imageReader == null) return

        processLatestImage(imageReader!!, width, height)

        val now = System.currentTimeMillis()
        // A missing frame/OCR result must still be visible as a specific
        // SCAN diagnostic, not an indefinite unlabeled "SCAN" state.
        if (now - lastStatusRefreshAt >= 2500L) {
          lastStatusRefreshAt = now
          updateOverlay(if (lockedDir != null && now < lockedUntil) lockedDir!! else "AȘTEAPTĂ",
            "Stare flux LIVE", "Verificare captură și OCR")
        }
        // A refused signal isn't a frozen Android screen stream.
        if (lastCapturedImageAt > 0L &&
            now - lastCapturedImageAt > 3500L &&
            now - lastFreezeNoticeAt > 5000L) {
          lastFreezeNoticeAt = now
          updateOverlay(
            "AȘTEAPTĂ",
            "Captură ecran întreruptă",
            "Nu sosesc imagini de la Android • repornește SUPRAPUNERE"
          )
        }

        // The test does not stop LIVE after 30m; it only closes its report.
        if (now - lastTestStatusAt >= 5_500L) {
          lastTestStatusAt = now
          try {
            val label = liveTest.tick(
              now, frameCount, resultCount, errorCount,
              !tfAutomatic || (tfVerified && now - confirmedTfAt <= TF_STALE_MS),
              lastCapturedImageAt > 0L && now - lastCapturedImageAt <= 3500L,
              lastAnalysisResultAt > 0L && now - lastAnalysisResultAt <= 5000L
            )
            // Monitoring may end without closing the LIVE overlay. Restore
            // normal Android auto-lock as soon as the 30-minute test finishes.
            setKeepScreenForTest(liveTest.isActive())
            mainHandler.post {
              if (testStatusText?.text?.toString() != label) testStatusText?.text = label
            }
          } catch (_: Throwable) {
            // The test is observational; logging must never stop chart capture.
          }
        }
        handler.postDelayed(this, 550L)
      }
    }
    handler.post(task)
  }

  /**
   * MediaProjection captures our own window. Mask it before analyzing candles;
   * our red SELL, green borders and text are not broker price action.
   * Occluded prices cannot be restored, so signals must fail closed.
   */
  private fun maskSelfOverlay(source: Bitmap, screenWidth: Int, cropTop: Int): Bitmap {
    val view = overlayView ?: return source
    val w = view.width
    val h = view.height
    if (w <= 0 || h <= 0) return source

    // Read real window location, not Gravity.END arithmetic.
    val location = IntArray(2)
    view.getLocationOnScreen(location)
    val margin = dp(12)
    val left = location[0] - margin
    val right = location[0] + w + margin
    val top = location[1] - cropTop - margin
    val bottom = location[1] - cropTop + h + margin
    if (right <= 0 || left >= source.width || bottom <= 0 || top >= source.height) return source
    val copy = source.copy(Bitmap.Config.ARGB_8888, true)
    Canvas(copy).drawRect(
      left.toFloat().coerceAtLeast(0f),
      top.toFloat().coerceAtLeast(0f),
      right.toFloat().coerceAtMost(copy.width.toFloat()),
      bottom.toFloat().coerceAtMost(copy.height.toFloat()),
      Paint().apply { color = Color.rgb(13, 18, 30); style = Paint.Style.FILL }
    )
    source.recycle()
    return copy
  }

  private fun processLatestImage(reader: ImageReader, width: Int, height: Int) {
    val image = reader.acquireLatestImage() ?: return
    try {
      val now = System.currentTimeMillis()
      lastCapturedImageAt = now
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

      var fullFrame = Bitmap.createBitmap(raw, 0, 0, width, height)
      if (fullFrame !== raw) raw.recycle()
      // MediaProjection captures the floating panel as well as the broker.
      // Never let our BUY/SELL colors/text contaminate OCR or candle evidence.
      fullFrame = maskSelfOverlay(fullFrame, width, 0)

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

      if (!tfAutomatic && manualTfConflict) {
        resetSignalState()
        fullFrame.recycle()
        if (now - lastTfStatusAt >= 2000L) {
          lastTfStatusAt = now
          updateOverlay("AȘTEAPTĂ", "Timeframe diferit",
            "Setează TF din aplicație identic cu Pocket Option • fără bip")
        }
        return
      }

      // New pair or stale/unknown OCR label: NEVER emit a BUY/SELL. A
      // generic screenshot is not a verified instrument identity.
      if (!pairReady(now)) {
        resetSignalState()
        fullFrame.recycle()
        if (now - lastTfStatusAt >= 2000L) {
          lastTfStatusAt = now
          updateOverlay(
            "AȘTEAPTĂ",
            if (marketVerified) "Pereche " + latestMarket + " • stabilizare"
              else "Pereche neconfirmată",
            "Aștept două citiri OCR și grafic stabil • fără bip"
          )
        }
        return
      }

      // Single automatic visible chart region. Exclude the trading buttons
      // beneath Pocket Option candles; the hidden old GRAFIC 1/2/3 switch
      // no longer controls the region. Other brokers must pass optical gates.
      val portrait = height >= width
      val topFraction = if (portrait) 0.17f else 0.06f
      val bottomFraction = if (portrait) 0.73f else 0.90f
      val cropTop = (height * topFraction).roundToInt().coerceIn(0, height - 2)
      val cropBottom = (height * bottomFraction).roundToInt().coerceIn(cropTop + 1, height)
      val chartHeight = max(1, cropBottom - cropTop)
      val originalChartFrame = Bitmap.createBitmap(fullFrame, 0, cropTop, width, chartHeight)
      if (originalChartFrame !== fullFrame) fullFrame.recycle()
      val chartFrame = maskSelfOverlay(originalChartFrame, width, cropTop)
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
        updateOverlay(
          "AȘTEAPTĂ",
          "Nu văd mișcare în ultimele 35s",
          "Captură activă • aștept lumânări noi • fără bip"
        )
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

      val capturedJpeg = stream.toByteArray()
      latestChartJpegBytes = capturedJpeg
      // A follow-up is only a saved picture; never mark WIN/LOSS from pixels.
      val observedMarket = currentPair(now)
      try {
        journal.followUp(now, observedMarket, selectedTimeframe, capturedJpeg)
      } catch (_: Throwable) {
        // Journal I/O must never stop the actual chart analysis loop.
      }

      val base64 = Base64.encodeToString(capturedJpeg, Base64.NO_WRAP)
      lastFrameAt = now
      frameCount += 1
      val frameId = frameCount
      val tfAtCapture = selectedTimeframe
      val pairAtCapture = currentPair(now)
      val epochAtCapture = marketEpoch
      frameMarket = pairAtCapture
      frameMarketEpoch = epochAtCapture
      activeFrameId = frameId
      analysisBusy = true
      analysisStartedAt = now

      mainHandler.post {
        if (activeFrameId == frameId) {
          val dataUrl = "data:image/jpeg;base64," + base64
          val quotedUrl = JSONObject.quote(dataUrl)
          analyzerWebView?.evaluateJavascript(
            "window.ScalpAtlasAnalyze && window.ScalpAtlasAnalyze(" + quotedUrl + "," +
              JSONObject.quote(tfAtCapture) + "," + frameId + "," +
              JSONObject.quote(pairAtCapture) + "," + epochAtCapture + ");",
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
    val analysisAgeMs = now - lastFrameAt
    if (lastFrameAt <= 0L || analysisAgeMs < 0L ||
        analysisAgeMs > MAX_ALERT_ANALYSIS_AGE_MS) {
      resetSignalState()
      updateOverlay("AȘTEAPTĂ", "Analiză întârziată",
        "Cadru vechi • fără candidat și fără bip")
      return
    }
    // Results coming back after OCR detects a different pair belong to the
    // previous chart; they must never be published as signals on this one.
    if (manualTfConflict || !pairReady(now) || frameMarketEpoch != marketEpoch ||
        frameMarket != currentPair(now)) {
      resetSignalState()
      updateOverlay("AȘTEAPTĂ", "Pereche neconfirmată sau schimbată",
        "Rezultat vechi respins • fără bip")
      return
    }
    if (tfAutomatic && (!tfVerified || now - confirmedTfAt > TF_STALE_MS)) {
      resetSignalState()
      return
    }
    // LIVE broker screen is the sole source: require result provenance,
    // confirmed instrument and epoch from the SAME captured frame.
    if (result.optString("source") != "ANDROID_SCREEN_CAPTURE" ||
        result.optString("brokerPair") != frameMarket ||
        result.optLong("marketEpoch", -1L) != frameMarketEpoch) {
      resetSignalState()
      updateOverlay("AȘTEAPTĂ", "Flux neconfirmat",
        "Pereche sau cadru schimbat • fără bip")
      return
    }
    // SHOCK-only contract: a single forming-candle retracement and recovery
    // must be evidenced by multiple captured pixels, not a predicted candle.
    val rawSignal = result.optString("shockDirection", "NONE")
    val score = 0 // no unvalidated probability displayed
    val quality = result.optInt("quality", 0)
    // Optical recognition is NOT a BUY/SELL signal. Show it in the miniature.
    val observed = result.optString("observedCandleDirection", "NONE")
    val detected = result.optBoolean("candleDetected", false)
    val opticalQuality = result.optInt("opticalQuality", 0).coerceIn(0, 99)
    if (detected && opticalQuality > 0 && (observed == "BUY" || observed == "SELL")) {
      observedCandleDirection = observed
      observedOpticalQuality = opticalQuality
      observedCandleAt = now
    } else {
      observedCandleDirection = "NONE"
      observedOpticalQuality = 0
      observedCandleAt = 0L
    }
    val timeframe = selectedTimeframe
    val opticalGate = result.optBoolean("shockOpticalVerified", false)
    val shockSameCandle = result.optBoolean("shockSameCandle", false)
    val shockRetraced = result.optBoolean("shockRetraced", false)
    val shockRecovered = result.optBoolean("shockRecovered", false)
    val shockFrameFresh = result.optLong("shockFrameId", -1L) == result.optLong("frameId", -2L)
    val shockBodyPercent = result.optInt("shockRetracementPercent", 0).coerceIn(0, 100)
    val shockReboundPercent = result.optInt("shockRecoveryPercent", 0).coerceIn(0, 100)
    val shockDropDurationMs = result.optLong("shockDropDurationMs", -1L)
    if (detected && (observed == "BUY" || observed == "SELL") && shockBodyPercent > 0) {
      observedShockPercent = shockBodyPercent
      observedShockAt = now
    } else {
      observedShockPercent = 0
      observedShockAt = 0L
    }
    // Both processors require >=90% retracement within <=5s and >=40% rebound.
    val confirmedSignal = if (quality >= 55 && opticalGate && shockSameCandle &&
        shockRetraced && shockRecovered && shockFrameFresh &&
        shockBodyPercent >= 90 && shockReboundPercent >= 40 &&
        shockDropDurationMs in 300L..5000L &&
        (rawSignal == "BUY" || rawSignal == "SELL")) rawSignal else "NONE"
    val rejectionText = "ȘOC neconfirmat optic pe aceeași lumânare"
    val expiry = result.optInt("expiry", 0)
    val directionMax = result.optInt("directionMax", 0)
    val pattern = "ȘOC • o lumânare"
    val reason = result.optString("reason", "")
    val opticalCount = if (opticalGate) 1 else 0

    try {
      liveTest.onClassifier(
        now, confirmedSignal, result.optString("candidateDirection", "NONE"),
        score, quality, opticalGate, opticalCount, currentPair(now),
        result.optString("marketRegime", "NEDETERMINAT")
      )
    } catch (_: Throwable) {}

    // Sample diagnostic telemetry locally: track which gate rejects signals.
    // Observations are never labelled wins/losses and do not place orders.
    try {
      val market = currentPair(now)
      val picture = if (now - lastFrameAt <= 4000L) latestChartJpegBytes else null
      val tentativeDirection = result.optString("candidateDirection", "NONE")
      journal.observe(
        now, timeframe, market, tentativeDirection,
        confirmedSignal == "BUY" || confirmedSignal == "SELL",
        score, quality, opticalGate, opticalCount, reason, picture,
        result.optString("marketRegime", "NEDETERMINAT")
      )
    } catch (_: Throwable) {
      // A diagnostic error must not interrupt the audio or live chart stream.
    }

    // The lock is independent of OCR and frame-capture reset paths.
    // A confirmed SELL cannot turn into a candidate BUY until it expires.
    val currentLock = lockedDir
    if (currentLock != null && now < lockedUntil) {
      val seconds = max(0L, (lockedUntil - now) / 1000L)
      // Show the confirmed direction for the full five-minute display window.
      // The countdown is NOT a fresh entry invitation after the original BIP.
      updateOverlay(
        currentLock,
        "Semnal emis la BIP • afișare rămasă " + formatSeconds(seconds),
        "Semnal anterior, NU intrare nouă • " + timeframe
      )
      return
    }

    if (currentLock != null && now >= lockedUntil) {
      lockedDir = null
      lockedUntil = 0L
      lockedAt = 0L
      lastConfirmedShockPercent = 0
      candidateDir = null
      candidateCount = 0
      candidateLastAt = 0L
      candidateLastSeenAt = 0L
      candidateStartedAt = 0L
    }

    if (confirmedSignal != "BUY" && confirmedSignal != "SELL") {
      val candidateStillFresh =
        candidateDir != null &&
        candidateCount > 0 &&
        candidateLastSeenAt > 0L &&
        now - candidateLastSeenAt <= CANDIDATE_EVIDENCE_GRACE_MS &&
        candidateStartedAt > 0L &&
        now - candidateStartedAt <= CANDIDATE_MAX_AGE_MS

      if (candidateStillFresh) {
        updateOverlay(
          "AȘTEAPTĂ",
          "Candidat " + candidateDir + " " + candidateCount + "/" + REQUIRED_CONFIRMATIONS +
            " • fără bip până la confirmare",
          timeframe + " • reverific direcția"
        )
        return
      }

      candidateDir = null
      candidateCount = 0
      candidateLastAt = 0L
      candidateLastSeenAt = 0L
      candidateStartedAt = 0L
      updateOverlay(
        "AȘTEAPTĂ",
        if (rejectionText.isNotBlank()) rejectionText else if (reason.isNotBlank()) reason else "Analiza graficului este neconcludentă",
        timeframe + " • scor orientativ " + score +
          " • lumânări recunoscute " + opticalCount
      )
      return
    }

    val candidateEvidenceExpired =
      candidateLastSeenAt <= 0L ||
      now - candidateLastSeenAt > CANDIDATE_EVIDENCE_GRACE_MS ||
      candidateStartedAt <= 0L ||
      now - candidateStartedAt > CANDIDATE_MAX_AGE_MS
    if (candidateDir != confirmedSignal || candidateEvidenceExpired) {
      candidateDir = confirmedSignal
      candidateCount = 1
      candidateLastAt = now
      candidateStartedAt = now
    } else if (now - candidateLastAt >= CONFIRMATION_SPACING_MS) {
      candidateCount += 1
      candidateLastAt = now
    }
    candidateLastSeenAt = now

    if (candidateCount < REQUIRED_CONFIRMATIONS) {
      updateOverlay(
        "AȘTEAPTĂ",
        "Candidat " + confirmedSignal + " " + candidateCount + "/" + REQUIRED_CONFIRMATIONS +
          " • fără bip până la confirmare",
        pattern + " • " + timeframe
      )
      return
    }

    // SIGNAL LOCK v1.0.23
    // Blocarea direcției urmează fereastra indicativă a semnalului,
    // pentru a evita alerte contradictorii în câteva secunde.
    // Keep the lock aligned to the selected M10 ten-minute DEMO contract.
    // A lock prevents opposite notifications; it is not a trade order.
    val lockMinutes = 5 // fixed five-minute display and direction lock
    // Publish expiry before direction so other callbacks cannot treat the
    // freshly published direction as an expired lock.
    lockedUntil = now + lockMinutes * 60_000L
    lockedAt = now
    lockedDir = confirmedSignal
    lastShockQuality = quality // Internal optical quality, NOT displayed as shock %
    lastConfirmedShockPercent = shockBodyPercent // Physical retracement
    candidateDir = null
    candidateCount = 0
    candidateLastAt = 0L
    candidateLastSeenAt = 0L
    candidateStartedAt = 0L

    // Record every genuine BIP once, along with a private chart snapshot.
    // This is a SIMULATED signal log, NOT a broker-order or profit log.
    try {
      val market = currentPair(now)
      val picture = if (now - lastFrameAt <= 4000L) latestChartJpegBytes else null
      val count = journal.record(
        now, confirmedSignal, timeframe, market, score, pattern, picture
      )
      mainHandler.post { journalControl?.text = "JURNAL " + count + " ▸" }
    } catch (_: Throwable) {
      // The signal/audio can still work if file storage temporarily fails.
    }
    try { liveTest.onBeep(now, confirmedSignal, currentPair(now)) } catch (_: Throwable) {}
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
    if (!bellEnabled) return
    mainHandler.post {
      if (!bellEnabled) return@post
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
      val now = System.currentTimeMillis()
      val signalChanged = signal != lastRenderedSignal
      lastRenderedSignal = signal
      val green = signal == "BUY"
      val red = signal == "SELL"
      val opticalFresh = observedCandleAt > 0L &&
        now - observedCandleAt in 0L..5000L && observedOpticalQuality > 0
      val visualDirection = when {
        green -> "BUY"
        red -> "SELL"
        opticalFresh -> observedCandleDirection
        else -> "NONE"
      }
      val visualTone = when (visualDirection) {
        "BUY" -> Color.rgb(0, 137, 75)
        "SELL" -> Color.rgb(192, 50, 64)
        else -> Color.rgb(105, 120, 126)
      }
      // Repaint the miniature and optical percentage for EVERY live result.
      // The arrow still shows BUY/SELL only after a confirmed SHOCK beep.
      candleGraphic?.direction = visualDirection
      if (signalChanged) {
        signalText?.text = when {
          green -> "↑ BUY"
          red -> "↓ SELL"
          else -> "—"
        }
        signalText?.setTextColor(
          if (green || red) visualTone else Color.rgb(105, 120, 126)
        )
      }
      val streamRecent = lastCapturedImageAt > 0L &&
        now - lastCapturedImageAt in 0L..3500L
      val tfReady = !tfAutomatic || (tfVerified &&
        now - confirmedTfAt in 0L..TF_STALE_MS)
      val brokerConnected = analyzerReady && streamRecent && tfReady &&
        pairReady(now) &&
        lastAnalysisResultAt > 0L &&
        now - lastAnalysisResultAt in 0L..5000L
      // A new BUY/SELL is displayed on the first confirmed analysis callback.
      // Animation is gated by a real, unexpired signal lock, never OCR colors.
      setPulseRing(
        if (brokerConnected && (green || red) && lockedDir == signal &&
            now < lockedUntil) signal else "NONE"
      )
      val percentFromCandle = when {
        brokerConnected && (green || red) &&
          lockedDir == signal && now < lockedUntil &&
          lastConfirmedShockPercent >= 90 -> lastConfirmedShockPercent
        brokerConnected && observedShockAt > 0L &&
          now - observedShockAt in 0L..3000L -> observedShockPercent
        else -> 0
      }
      qualityText?.text = if (percentFromCandle > 0) percentFromCandle.toString() + "%" else "—%"
      qualityText?.setTextColor(visualTone)
      val candleConnected = brokerConnected && opticalFresh
      val scanStatus = when {
        candleConnected -> "LIVE"
        brokerConnected -> "LUMÂNARE?"
        !analyzerReady -> "MOTOR?"
        !streamRecent -> "ECRAN?"
        !tfReady -> "TF?"
        marketLabelAmbiguous -> "ETICHETĂ?"
        !marketVerified || now - latestMarketAt > MARKET_STALE_MS -> "PERECHE?"
        !pairReady(now) -> "STABIL"
        else -> "GRAFIC?"
      }
      // Show the precise gate holding back LIVE on the main screen, without
      // making the floating panel larger or weakening any signal gate.
      if (now - lastDiagnosticWriteAt >= 2_000L || scanStatus != lastDiagnosticStage) {
        lastDiagnosticWriteAt = now
        lastDiagnosticStage = scanStatus
        val diagnosticReason = when (scanStatus) {
          "MOTOR?" -> "Motorul de analiză nu este pregătit"
          "ECRAN?" -> "Android nu trimite imagini recente"
          "TF?" -> "Intervalul M5/M10/M15 nu este confirmat"
          "PERECHE?" -> "Perechea nu este confirmată"
          "ETICHETĂ?" -> "Nu disting sigur OTC de standard; fără bip"
          "STABIL" -> "Stabilizare: " +
            max(0L, (MARKET_SETTLE_MS - (now - marketStableAt) + 999L) / 1000L) + " s"
          "GRAFIC?" -> "Pereche și TF confirmate; aștept analiza graficului"
          "LUMÂNARE?" -> "Cadre primite, dar nu detectez lumânarea activă"
          else -> "Flux activ; semnal numai după ȘOC confirmat"
        }
        try {
          getSharedPreferences("scalp_atlas_live_diagnostics", Context.MODE_PRIVATE)
            .edit()
            .putString("stage", scanStatus)
            .putString("reason", diagnosticReason)
            .putString("pair", currentPair(now))
            .putString("timeframe", if (tfAutomatic && !tfVerified) "AUTO ?" else selectedTimeframe)
            .putLong("frames", frameCount)
            .putLong("results", resultCount)
            .putLong("errors", errorCount)
            .putInt("opticalQuality", if (opticalFresh) observedOpticalQuality else 0)
            .putString("candleDirection", if (opticalFresh) observedCandleDirection else "NONE")
            .putLong("updatedAt", now)
            .apply()
        } catch (_: Throwable) {
          // Diagnostics must never interrupt screen capture or SHOCK signals.
        }
      }
      captureStatusText?.text = scanStatus
      captureStatusText?.setTextColor(
        if (brokerConnected) Color.rgb(0, 137, 75)
        else Color.rgb(105, 120, 126)
      )
      // Internal diagnostics remain in journal/monitor, not over broker graph.
      lastRenderedDetails = details
      lastRenderedModel = model
    }
  }

  override fun onDestroy() {
    mainHandler.post { stopPulseRing() }
    try {
      getSharedPreferences("scalp_atlas_live_diagnostics", Context.MODE_PRIVATE)
        .edit()
        .putString("stage", "OPRIT")
        .putString("reason", "Captura ecranului este oprită")
        .putLong("updatedAt", System.currentTimeMillis())
        .apply()
    } catch (_: Throwable) {}
    setKeepScreenForTest(false)
    try {
      liveTest.end(System.currentTimeMillis(), frameCount, resultCount, errorCount, false)
    } catch (_: Throwable) {}
    // Service shutdown ends the session; no signal lock survives a new start.
    lockedDir = null
    lockedUntil = 0L
    lockedAt = 0L
    try { virtualDisplay?.release() } catch (_: Throwable) {}
    try { imageReader?.close() } catch (_: Throwable) {}
    try { mediaProjection?.stop() } catch (_: Throwable) {}
    try { ocrRecognizer.close() } catch (_: Throwable) {}
    overlayWindowParams = null
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
