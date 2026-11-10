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
import android.graphics.Path
import android.graphics.PathMeasure
import android.graphics.Rect
import android.graphics.RectF
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
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
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

    @Volatile private var activeOverlayService: ScalpOverlayService? = null
    // Android's security settings must never be obscured by our overlay.
    // Hide only the WINDOW while the settings screen is open; do not stop
    // the MediaProjection service and force another screen-share permission.
    fun setHiddenDuringAndroidSettings(hidden: Boolean) {
      val service = activeOverlayService ?: return
      val applyVisibility = {
        if (hidden) {
          service.autoDemoArmed = false
          service.autoDemoMarket = null
          service.autoDemoExpiry = 0L
          service.autoDemoButton?.text = "🤖 PORNEȘTE • ON"
        }
        service.overlayView?.visibility = if (hidden) View.GONE else View.VISIBLE
      }
      if (Looper.myLooper() == Looper.getMainLooper()) applyVisibility()
      else service.mainHandler.post { applyVisibility() }
    }

    private const val CHANNEL_ID = "scalp_atlas_overlay"
    private const val NOTIFICATION_ID = 4816
    private const val MIN_FRAME_INTERVAL_MS = 700L
    private const val ANALYSIS_TIMEOUT_MS = 5000L
    // A visually correct pattern is useless if the analyzed frame is stale.
    // Fail closed before any candidate confirmation or audible alert.
    private const val MAX_ALERT_ANALYSIS_AGE_MS = 3000L
    private const val CONFIRMATION_SPACING_MS = 1500L
    private const val REQUIRED_CONFIRMATIONS = 2
    // 428: moderated optical DEMO SHOCK; maintain two confirmations and broker safety.
    private const val SHOCK_MIN_DEPTH = 25
    private const val SHOCK_MIN_RECOVERY = 20
    private const val SHOCK_MIN_TREND = 25
    private const val SHOCK_MAX_DROP_MS = 18_000L
    private const val SCALP_MIN_TREND = 50
    // If optical evidence disappears, an old candidate must not recover as
    // if it had been continuously confirmed for the past minute.
    private const val CANDIDATE_EVIDENCE_GRACE_MS = 6_000L
    private const val CANDIDATE_MAX_AGE_MS = 15_000L
    // A direction's 5-7 minute lock is NOT a 5-7 minute window for NEW entries.
    private const val ALERT_FRESH_MS = 30_000L
    private const val OCR_INTERVAL_MS = 3000L
    // 462: intentional one-order safety mode; never enter history UI.
    // Do NOT change this to allow consecutive orders without settlement.
    private const val CHART_ONLY_DEMO_462 = true
    // 465: no hard count limit or extra 7-minute pause. The 5-minute
    // broker gesture lock remains aligned to the verified 5-minute DEMO
    // expiry; time alone never proves CLOSED and never triggers MG.
    private const val DEMO_TEST_EXPIRY_MS_465 = 5 * 60_000L
    private const val TF_STALE_MS = 18000L
    private const val MARKET_STALE_MS = 12_000L
    private const val MARKET_SETTLE_MS = 6_000L
    private const val MARKET_OCR_CONFIRMATIONS = 2
  }

  private lateinit var windowManager: WindowManager
  private var rotatingBrainAnimator467: android.animation.ObjectAnimator? = null
  private var overlayView: View? = null
  @Volatile private var overlayWindowParams: WindowManager.LayoutParams? = null
  private var compactStatusText: TextView? = null
  private var signalText: TextView? = null
  private var strategyHeaderText: TextView? = null
  private var detailText: TextView? = null
  private var modelText: TextView? = null
  private var journalControl: TextView? = null
  private var testStatusText: TextView? = null
  private var touchProbeRow: LinearLayout? = null
  private var touchProbeCommandRow: LinearLayout? = null
  private var calculatorTestRow: LinearLayout? = null
  private var touchProbeStatus: TextView? = null
  // Opt-in single-pair evaluation: touches ONLY our own visible test buttons.
  // Never route gestures to Pocket Option or any financial order UI.
  private var onePairEvalEnabled = false
  private var onePairEvalPair: String? = null
  private var onePairEvalLastLockAt = 0L
  private var onePairEvalTouch: ((String) -> Unit)? = null
  private var onePairEvalButton: TextView? = null
  private var onePairEvalRow: LinearLayout? = null
  private var demoBrokerInspectionRow: LinearLayout? = null
  private var demoBrokerOrderRow: LinearLayout? = null
  private var demoAmountCheckRow: LinearLayout? = null
  // 448: ONE active QT Demo position at any time, never overlapping.
  // The next independent SHOCK can be considered only AFTER the preceding
  // order has an exact authenticated CLOSED receipt and two ZERO-OPEN reads.
  // The session stays user-approved; QT Real and duplicate orders stay blocked.
  private var fxRotationNavigating = false
  private var autoDemoSessionRequested = false
  private var autoDemoSessionConsumed = false
  private var autoDemoSessionEndAt = 0L
  // Wall-clock start of the currently authorized, verified DEMO entry cycle.
  // A BIP from before this boundary must never become a broker order.
  private var autoDemoEntryCycleStartedAt = 0L
  // Dedicated 386 TEST BUILD. A single QT Demo BUY (1 USD) may be attempted
  // in the first 60s of an explicitly started LIVE capture, WITHOUT SHOCK.
  // A successful attempt is consumed persistently; NO ordinary SHOCK orders
  // run in this diagnostic build. Never tap when Android cannot verify demo.
  private var demoClickTestPending = false
  private var demoClickTestUntil = 0L
  private var demoClickTestLastCheck = 0L
  private var demoClickMonitorRunning = false
  private val demoClickTestPrefs = "scalp_atlas_demo_click_test_398"
  private val autoShockAttemptPrefs = "scalp_atlas_demo_shock_400"
  private val sell404TestPrefs = "scalp_atlas_sell_pilot_404"
  private var sell404Diagnostic: String? = null
  // 399: REAL/DEMO visible-account checks are read-only. No REAL gesture path.
  private var brokerAccountMonitorRunning = false
  private var lastBrokerAccountStatus = ""
  private var lastDemoTradeStatus = "ÎNCHIDERE NECONFIRMATĂ"
  // 409: two separate broker reads of Transactions > Open > explicitly empty.
  // This is deliberately NOT inferred from a missing badge on the chart.
  private var demoEmptyReviewReads = 0
  private var demoEmptyReviewFirstAt = 0L
  private var lastAutoDemoHistoryNavAt = 0L
  // 418: Keep the last history-navigation outcome visible in the compact
  // panel. The analyzer refreshes frequently and otherwise overwrites it
  // with the generic last read-only page error from the CHART screen.
  private var lastAutoDemoHistoryNavStatus = ""
  private var lastAutoDemoHistoryNavStatusAt = 0L
  // 431: Do not mistake an Android-accepted navigation tap for a broker
  // page transition. Three failed page transitions stop automatic attempts
  // at opening history; only a verified QT Demo history page resets this.
  // This NEVER clears an old trade marker or unlocks an order.
  private var historyNavPending431 = false
  private var historyNavPendingAt431 = 0L
  private var historyNavFailed431 = 0
  private var historyNavStalled431 = false
  // 441: navigation failures pause scanning briefly but do not permanently
  // prohibit verified, read-only history navigation. NEVER clear old trades.
  private var historyNavStallSince441 = 0L
  // 432: two independent LIVE OCR reads of the lower-left broker
  // "Tranzacții" NAV LABEL. Never infer a control from fixed coordinates.
  @Volatile private var historyNavOcrAt432 = 0L
  @Volatile private var historyNavOcrPackage432: String? = null
  @Volatile private var historyNavOcrX432 = -1f
  @Volatile private var historyNavOcrY432 = -1f
  @Volatile private var historyNavOcrSamples432 = 0
  // 433: Distinguish the broker's history page from an active price chart.
  // History pairs are OLD trades, never a current broker instrument.
  // Only MediaProjection OCR of the page title AND both history tabs
  // can set this. The history mode expires without fresh visual evidence.
  @Volatile private var historyPageVisible433 = false
  @Volatile private var historyPageLastSeen433 = 0L
  @Volatile private var historyPageTab433 = "NECUNOSCUT"
  // 437: A recently observed, individually identified CLOSED DEMO receipt
  // must have TWO independent live OCR reads, and is never an order itself.
  private data class ClosedDetail437(
    val brokerPackage: String,
    val pair: String,
    val positionId: String,
    val stakeCents: Long,
    val payoutPercent: Int,
    val netProfitCents: Long,
    val side: String,
    val openedSecondsOfDay: Int
  )
  private var firstClosedDetail437: ClosedDetail437? = null
  private var firstClosedDetailAt437 = 0L
  @Volatile private var verifiedClosedDetail437: ClosedDetail437? = null
  @Volatile private var verifiedClosedDetailAt437 = 0L
  // 438: OCR-derived CLOSED row coordinates are navigation hints only.
  // They cannot count as a transaction receipt or release a prior lock.
  @Volatile private var closedRowAt438 = 0L
  @Volatile private var closedRowX438 = -1f
  @Volatile private var closedRowY438 = -1f
  @Volatile private var closedRowSamples438 = 0
  private var lastClosedRowTapAt438 = 0L
  // 458: At most ONE closed-row probe per persisted DEMO attempt.
  // If it cannot produce a unique authenticated receipt, switch to OPEN
  // and verify zero positions rather than clicking completed trades again.
  private var closedRowProbeKey458: String? = null
  private var openTabFirstObservedAt458 = 0L
  // 454: An unmatched CLOSED-history page must not trap the G24 broker
  // indefinitely. These timers authorize navigation ONLY, never a trade.
  private var closedListFirstObservedAt454 = 0L
  private var lastClosedListOpenNavAt454 = 0L
  // 457: Navigation is not settlement. A bounded history read should
  // leave the user on the chart, while the unverified old ID stays locked.
  private var lastPerspectiveReturnAttempt457 = 0L
  private var historyReturnPauseUntil457 = 0L
  @Volatile private var perspectiveOcrAt457 = 0L
  @Volatile private var perspectiveOcrPackage457: String? = null
  @Volatile private var perspectiveOcrX457 = -1f
  @Volatile private var perspectiveOcrY457 = -1f
  @Volatile private var perspectiveOcrSamples457 = 0
  private var lastVerifiedDetailBackId438: String? = null
  // 442: One CLOSED-history scan per outstanding DEMO attempt in a bounded
  // interval. Navigation is not settlement proof, and this cooldown NEVER
  // changes the saved attempted flag, ledger, or position gate.
  private var lastClosedHistoryScanAt442 = 0L
  private var lastClosedHistoryScanKey442: String? = null
  private val closedHistoryScanPauseMs442 = 180_000L
  // 455: Each actual OCR-targeted OPEN-tab gesture must be followed by
  // independent VISUAL proof of a changed tab. Android's ACTION_CLICK
  // returning true alone is never proof of a Pocket Option page change.
  // Three failed navigation attempts cap the loop until the LIVE session
  // or broker page is explicitly restarted; this never arms an order.
  private var lastOpenTabNavigationAt455 = 0L
  private var openTabNavigationAttempts455 = 0

  // 435: independently observed OPEN-tab LABEL, not a fixed touch point.
  @Volatile private var historyOpenOcrAt435 = 0L
  @Volatile private var historyOpenOcrX435 = -1f
  @Volatile private var historyOpenOcrY435 = -1f
  @Volatile private var historyOpenOcrCount435 = 0
  // 424: background QT Demo amount preparation. It is eligible only after
  // a broker receipt has updated the independent recovery ledger.
  private var lastAutoDemoStakeEditAt = 0L
  private var lastAutoDemoStakeEditResult = ""
  private var lastAutoDemoStakeEditResultAt = 0L
  // 425: read-only Closed-tab evidence review, never an inferred WIN/LOSS.
  private var closedHistoryInspectionInProgress = false
  private var lastClosedInspectionDiagnostic = ""
  private var lastClosedInspectionAt = 0L
  // 410: QT Demo can disappear from the header on Transactions > Open.
  // Retain a short read-only proof for the SAME broker package only.
  // Broker ORDER preflight still requires a fresh visible QT Demo header.
  private var verifiedDemoAccountAt = 0L
  private var verifiedDemoAccountPackage: String? = null
  // 414: Two independent OCR reads of the ACTUAL broker Transactions > Open
  // screen, with an explicit no-open-trades message and selected Open tab.
  // A stale screenshot or an unknown broker can never clear old order safety.
  @Volatile private var lastEmptyOpenOcrAt = 0L
  @Volatile private var lastEmptyOpenOcrPackage: String? = null
  @Volatile private var emptyOpenOcrConsecutive = 0
  @Volatile private var lastOpenTabVisualAt429 = 0L
  @Volatile private var lastOpenTabVisualPackage429: String? = null
  @Volatile private var openTabVisualConsecutive429 = 0
  @Volatile private var lastClosedTabVisualAt = 0L
  @Volatile private var lastClosedTabVisualPackage: String? = null
  @Volatile private var closedTabVisualConsecutive = 0
  private val tradePositionGate = TradePositionGate()
  // 421: DEMO recovery calculator is read-only until a broker CLOSED receipt
  // with matching position ID and audited WIN/LOSS can be verified.
  // Never turn an Android gesture or an empty Open tab into a trade result.
  private val demoRecoveryLedger by lazy {
    DemoRecoveryLedger(getSharedPreferences("scalp_atlas_demo_recovery_421", Context.MODE_PRIVATE))
  }
  private var autoDemoLastPreflightAt = 0L
  // Read-only reason shown even while the advanced diagnostics are hidden.
  private var autoDemoLastPreflightReason = "AȘTEAPTĂ VERIFICAREA"
  private var autoDemoArmed = false
  private var autoDemoMarket: String? = null
  private var autoDemoLockedAt = 0L
  private var autoDemoExpiry = 0L
  private var autoDemoRow: LinearLayout? = null
  private var autoDemoButton: TextView? = null
  private var onePairEvalAutoPending = false
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
  @Volatile private var observedShockDurationMs = 0L
  @Volatile private var lastConfirmedShockDurationMs = 0L
  @Volatile private var observedTrendDirection = "NONE"
  @Volatile private var observedTrendMeasured = false
  // Diagnostic only: verified prior candle bodies, 0..3; no order implication.
  @Volatile private var observedTrendHistoryCount = 0
  @Volatile private var observedTrendStrengthPercent = 0
  @Volatile private var observedTrendPoints = floatArrayOf()
  @Volatile private var observedTrendAt = 0L
  @Volatile private var lastConfirmedShockPercent = 0
  @Volatile private var lastConfirmedScalpPercent = 0
  @Volatile private var activeStrategy = "NONE"
  @Volatile private var observedWickPercent = 0
  @Volatile private var observedWickAt = 0L
  @Volatile private var shockBlocker = "AȘTEAPTĂ DATE"
  @Volatile private var scalpBlocker = "AȘTEAPTĂ DATE"
  @Volatile private var observedCandleDirection = "NONE"
  @Volatile private var observedOpticalQuality = 0
  @Volatile private var observedCandleAt = 0L
  @Volatile private var observedBodyPx = 24
  @Volatile private var observedUpperWickPx = 8
  @Volatile private var observedLowerWickPx = 8
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
  private var candidateStrategy: String? = null
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
  // A separate recognizer for tiny M5/M10/M15 labels on the right chart axis.
  // The fallback only reads visible pixels; it never guesses a timeframe.
  private val tfCropOcrRecognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
  // 403: separate enlarged OCR for the visible broker instrument selector.
  private val pairCropOcrRecognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
  @Volatile private var pairCropBusy = false
  private var lastPairCropAttemptAt = 0L
  @Volatile private var tfCropBusy = false
  private var lastTfCropAttemptAt = 0L
  @Volatile private var lastTfOcrSource = "NECONFIRMAT"
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
    observedShockDurationMs = 0L
    observedTrendDirection = "NONE"
    observedTrendMeasured = false
    observedTrendHistoryCount = 0
    observedTrendStrengthPercent = 0
    observedTrendPoints = floatArrayOf()
    observedTrendAt = 0L
    observedWickPercent = 0
    observedWickAt = 0L
    shockBlocker = "AȘTEAPTĂ DATE"
    scalpBlocker = "AȘTEAPTĂ DATE"
    observedCandleDirection = "NONE"
    observedOpticalQuality = 0
    observedCandleAt = 0L
    observedBodyPx = 24
    observedUpperWickPx = 8
    observedLowerWickPx = 8
    candidateDir = null
    candidateStrategy = null
    candidateCount = 0
    candidateLastAt = 0L
    candidateLastSeenAt = 0L
    candidateStartedAt = 0L
    analysisBusy = false
    activeFrameId = -1L
  }

  /**
   * A new pair must not inherit unfinished candidates, optical samples, or
   * trend readings. A confirmed 5-minute alert lock stays GLOBAL on the phone:
   * changing instruments must not start a second concurrent DEMO trade.
   */
  private fun clearOnInstrumentChange() {
    marketLabelAmbiguous = false
    resetSignalState()
    // Never clear lockedDir/lockedUntil when the observed broker pair changes.
    // They expire inside handleResult(), not from instrument switching.
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
  @Volatile private var shuttingDown = false
  private var lastRobotConnectionDiagnostic: String? = null

  override fun onCreate() {
    super.onCreate()
    activeOverlayService = this
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
          // 400: Starting authorized LIVE capture automatically arms SHOCK-only
          // on a strictly verified QT DEMO. It never arms QT REAL.
          // One gesture maximum per capture because a broker close receipt
          // cannot yet be read reliably. Unknown order state blocks all repeats.
          // A service restart must never bypass an unconfirmed previous
          // broker trade. This guard survives process death and app updates.
          val priorAutoShockAttempt = getSharedPreferences(
            autoShockAttemptPrefs, Context.MODE_PRIVATE
          ).getBoolean("attempted", false)
          // 405: a SELL gesture verified on the chart in v404 must not be
          // forgotten when the APK is upgraded or Android restarts.
          val priorSell404Attempt = getSharedPreferences(
            sell404TestPrefs, Context.MODE_PRIVATE
          ).getBoolean("attempted", false)
          autoDemoSessionRequested = !priorAutoShockAttempt && !priorSell404Attempt
          autoDemoSessionConsumed = priorAutoShockAttempt || priorSell404Attempt
          autoDemoEntryCycleStartedAt = if (autoDemoSessionRequested)
            System.currentTimeMillis() else 0L
          autoDemoArmed = false
          autoDemoLastPreflightReason =
            if (autoDemoSessionConsumed)
              "TRANZACȚIE ANTERIOARĂ • ÎNCHIDERE NEVERIFICATĂ"
            else "AȘTEAPTĂ VERIFICAREA"
          demoClickTestPending = false
          demoClickTestLastCheck = 0L
          mainHandler.post {
            touchProbeStatus?.text = if (autoDemoSessionConsumed)
              "🤖 TRANZACȚIE DEMO ANTERIOARĂ • VERIFIC ÎNCHIDEREA"
            else "🤖 LIVE • DEMO AUTO LA ȘOC • REAL BLOCAT"
          }
          // Stay eligible while the Android-authorized LIVE screen capture
          // exists. Only a user stop, OS capture revocation, or service death
          // ends it. Never create an unattended new capture permission.
          autoDemoSessionEndAt = Long.MAX_VALUE
          autoDemoLastPreflightAt = 0L
          autoDemoLockedAt = lockedAt // never trade from a preexisting signal
          // The single automated session uses the same audible confirmed SHOCK alert.
          // This is session-local; no user bell preference is overwritten.
          bellEnabled = true
          startProjection(resultCode, data)
          startBrokerAccountMonitor()
        } else {
          updateOverlay("AȘTEAPTĂ", "LIVE • Captură indisponibilă", "Deschide din nou modul SUPRAPUNERE")
        }
      }
    }
    return START_NOT_STICKY
  }

  // Android / Motorola can remove the MAIN activity task while the user
  // switches to Pocket Option. The foreground LIVE screen-capture session
  // is independent of that task and was explicitly started by the user.
  // Keep the already-authorized, one-shot QT Demo session ONLY while the
  // MediaProjection and overlay are still active. No restart / reauthorization
  // happens silently, and the Android "Oprește LIVE" notification always stops it.
  override fun onTaskRemoved(rootIntent: Intent?) {
    val liveCaptureActive = mediaProjection != null &&
      overlayView != null && !shuttingDown
    if (!liveCaptureActive) {
      demoClickTestPending = false
      autoDemoSessionRequested = false
      autoDemoSessionConsumed = true
      autoDemoArmed = false
      autoDemoMarket = null
      autoDemoExpiry = 0L
      mainHandler.post {
        touchProbeStatus?.text = "CAPTURĂ OPRITĂ • ROBOT BLOCAT"
      }
    } else {
      // Do not reset autoDemoSessionRequested, expiry, current pair or
      // the at-most-one-order guard when the user opens the broker.
      mainHandler.post {
        touchProbeStatus?.text = when {
          brokerAccountMonitorRunning -> "🤖 SCANARE CONT • FĂRĂ ORDINE"
          autoDemoSessionConsumed -> "🤖 SCANARE LIVE • FĂRĂ ORDINE"
          autoDemoArmed -> "🤖 DEMO AUTO ACTIV • AȘTEAPTĂ ȘOC"
          autoDemoSessionRequested -> "🤖 DEMO LIVE • VERIFICARE AUTOMATĂ"
          else -> "🤖 ROBOT BLOCAT • FĂRĂ SESIUNE"
        }
      }
    }
    super.onTaskRemoved(rootIntent)
  }

  /**
   * Test build only. Check QT Demo accessibility independently of frames,
   * candle trend and SHOCK. Exactly one BUY attempt, max 5 minutes.
   * The attempt is persisted before any broker click. Never touches QT Real,
   * unknown applications, non-1-USD amounts or unverified payout.
   * A visible reason is shown if any permission/target validation fails.
   */
  /**
   * 397: One SELL demo test, not BUY-then-SELL. The user initiates the Android
   * LIVE capture, which permits one attempt within 5 minutes. Every check is
   * read-only until the final physical gesture; persistent consumption first.
   */
  /**
   * 399: The overlay follows any broker chart, while the REAL / DEMO status
   * is read-only and visible. No order gesture is reachable from this monitor.
   * Android MediaProjection authorization and the X / STOP control remain
   * the only way to start and end the foreground screen-reading session.
   */
  /**
   * 424: Connect the verified-loss recovery QUOTE to Pocket Option's actual
   * DEMO amount field, using Android Accessibility ACTION_SET_TEXT and a fresh
   * broker UI read-back. It does NOT submit orders, does NOT read a WIN/LOSS,
   * and never alters the current 1 USD broker order path.
   *
   * Without a uniquely matched broker CLOSED receipt, the ledger has no
   * verified loss and this code MUST do nothing.
   */
  // 429: The next DEMO stake is calculated from the audited ledger and
  // the actual current payout. The initial 1 USD read can use the existing
  // verified broker buttons; dynamic stakes require the editable field.
  private fun desiredVerifiedDemoStake429(pair: String): Long? {
    if (pair.isBlank() || pair == "NEIDENTIFICAT") return null
    val payout = TouchTestService.readVerifiedDemoPayoutForPair(pair)
      ?: TouchTestService.readVerifiedDemoPayoutForStake429(pair, 100L)
      ?: return null
    return demoRecoveryLedger.quote(payout).stakeCents
  }

  private fun maybePrepareAutomaticDemoRecoveryStake(nowTick: Long) {
    if (lastAutoDemoStakeEditAt > 0L &&
        nowTick - lastAutoDemoStakeEditAt in 0L..7_000L) return
    val now = System.currentTimeMillis()
    if (!autoDemoSessionRequested || autoDemoSessionConsumed ||
        !TouchTestService.ready() || closedHistoryInspectionInProgress ||
        tradePositionGate.state() != TradePositionGate.State.READY ||
        mediaProjection == null || !analyzerReady ||
        lastCapturedImageAt <= 0L ||
        now - lastCapturedImageAt !in 0L..3500L ||
        lastAnalysisResultAt <= 0L ||
        now - lastAnalysisResultAt !in 0L..5000L ||
        (lockedAt > 0L && now - lockedAt in 0L..5000L) ||
        !lastBrokerAccountStatus.startsWith("QT DEMO IDENTIFICAT")) return
    if (!pairReady(now)) return
    val pair = currentPair(now)
    if (pair == "NEIDENTIFICAT") return

    // In 424, the only source of a recovery loss is a verified broker
    // opening receipt followed by its corresponding closed receipt. There
    // is no manual/optical/timeout shortcut to change the amount.
    val verifiedPayout = TouchTestService.readVerifiedDemoPayoutForPair(pair)
      ?: return
    // A finished recovery blocks new orders until the actual broker
    // displays 1 USD again. This reset is allowed even while quote() is
    // intentionally blocked by pendingBaseStakeReset.
    val resetToBase = demoRecoveryLedger.needsBaseStakeReset()
    val next = demoRecoveryLedger.quote(verifiedPayout)
    val stake = if (resetToBase) DemoRecoveryLedger.BASE_STAKE_CENTS
      else next.stakeCents ?: return
    if (!resetToBase && (next.lossCents <= 0L || stake <= 100L)) return
    lastAutoDemoStakeEditAt = nowTick
    val result = try {
      TouchTestService.setVerifiedDemoRecoveryStakeOnBroker(pair, stake)
    } catch (error: Exception) {
      android.util.Log.e("ScalpAtlas426", "DEMO stake update blocked", error)
      "BLOCAT: MODIFICARE SUMĂ ANDROID"
    }
    lastAutoDemoStakeEditResult = result.take(100)
    lastAutoDemoStakeEditResultAt = nowTick
    // Record completed reset only AFTER a broker read-back exactly 1.00.
    val baseResetAcknowledged = resetToBase &&
      demoRecoveryLedger.acknowledgeVerifiedBaseStakeReset(
        result.startsWith("SUMĂ QT DEMO CONFIRMATĂ 1.00 USD")
      )
    // The existing order executor is still strictly 1 USD and must NOT
    // place progressively larger orders until a verified receipt bridge and
    // full dynamic order preflight are implemented and tested on DEMO.
    touchProbeStatus?.text = when {
      baseResetAcknowledged ->
        "RECUPERARE ÎNCHEIATĂ • SUMA DEMO RESTABILITĂ LA 1 USD"
      resetToBase -> "RESET 1 USD NECONFIRMAT • " + result.take(76)
      result.startsWith("SUMĂ QT DEMO CONFIRMATĂ") ->
        "SUMĂ MODIFICATĂ ÎN DEMO • TRADE RECUPERARE NEACTIVAT"
      else -> result
    }
  }

  /**
   * Match OPEN time written by the broker against the physical gesture's
   * original Android monotonic timestamp. A process restart cannot make
   * another day's same-pair/order row a valid match. A device reboot
   * invalidates the elapsed-time proof, so the app fails closed.
   */
  private fun brokerOpenTimeMatchesAttempt437(
    openedSecondsOfDay: Int,
    attemptedElapsed: Long
  ): Boolean {
    val nowElapsed = android.os.SystemClock.elapsedRealtime()
    val sinceGesture = nowElapsed - attemptedElapsed
    if (attemptedElapsed <= 0L || sinceGesture !in 300_000L..86_400_000L)
      return false
    val gestureWallTime = System.currentTimeMillis() - sinceGesture
    // Pocket Option's displayed trade-history clock in the G24 QT DEMO
    // screen is UTC+3, while the device can be UTC+2 in winter.
    // Comparing against the phone-local zone caused false ID mismatches.
    val calendar = java.util.Calendar.getInstance(
      java.util.TimeZone.getTimeZone("GMT+03:00")
    ).apply {
      timeInMillis = gestureWallTime
    }
    val expectedSeconds = calendar.get(java.util.Calendar.HOUR_OF_DAY) * 3600 +
      calendar.get(java.util.Calendar.MINUTE) * 60 +
      calendar.get(java.util.Calendar.SECOND)
    val distance = kotlin.math.abs(expectedSeconds - openedSecondsOfDay)
    return minOf(distance, 86400 - distance) <= 150
  }

  // History navigation is a read-only recovery step for a POSSIBLE prior
  // broker order. A touch being accepted by Android cannot be counted as a
  // page transition or authorization for a new broker gesture.
  private fun recordBrokerHistoryBottomLabelOcr432(
    result: com.google.mlkit.vision.text.Text,
    image: Bitmap,
    observedAt: Long
  ) {
    // OCR is only an auxiliary navigation sensor, never authorization for
    // a financial order or for clearing a previous uncertain trade.
    val chartVerified = lastBrokerAccountStatus.startsWith("QT DEMO IDENTIFICAT") &&
      !lastBrokerAccountStatus.contains("QT REAL") &&
      autoDemoSessionConsumed && mediaProjection != null
    val pkg = if (chartVerified)
      TouchTestService.activeDemoExecutorPackageForReview() else null
    if (!chartVerified || pkg == null ||
        pkg != verifiedDemoAccountPackage ||
        android.os.SystemClock.elapsedRealtime() - verifiedDemoAccountAt !in 0L..90_000L) {
      historyNavOcrSamples432 = 0
      historyNavOcrPackage432 = null
      return
    }
    val possible = result.textBlocks.flatMap { it.lines }.mapNotNull { line ->
      val rect = line.boundingBox ?: return@mapNotNull null
      val text = line.text.trim().replace(Regex("""\s+"""), " ")
      if (!Regex("""(?i)^(?:Tranzacții|Tranzactii|Transactions|Trades)$""").matches(text))
        return@mapNotNull null
      val x = rect.centerX().toFloat() / image.width
      val y = rect.centerY().toFloat() / image.height
      val rw = rect.width().toFloat() / image.width
      val rh = rect.height().toFloat() / image.height
      if (x !in 0.02f..0.35f || y !in 0.84f..0.975f ||
          rw <= 0f || rw > 0.27f || rh <= 0f || rh > 0.055f)
        return@mapNotNull null
      Pair(x, y)
    }
    if (possible.size != 1) {
      historyNavOcrSamples432 = 0
      historyNavOcrPackage432 = null
      return
    }
    val loc = possible.single()
    if (historyNavOcrPackage432 == pkg &&
        observedAt - historyNavOcrAt432 in 1_000L..6_500L &&
        kotlin.math.abs(loc.first - historyNavOcrX432) <= 0.028f &&
        kotlin.math.abs(loc.second - historyNavOcrY432) <= 0.018f) {
      historyNavOcrSamples432 = (historyNavOcrSamples432 + 1).coerceAtMost(3)
    } else {
      historyNavOcrSamples432 = 1
    }
    historyNavOcrX432 = loc.first
    historyNavOcrY432 = loc.second
    historyNavOcrAt432 = observedAt
    historyNavOcrPackage432 = pkg
  }

  private fun attemptBrokerOpenTabWithVisualProof455(
    verifiedDemoReview: Boolean,
    brokerPackage: String?,
    nowElapsed: Long
  ): String {
    // Read-only broker identity + two OCR reads of the REAL, visible tab;
    // only this precisely bounded, non-order tab may be physically touched.
    if (!verifiedDemoReview || brokerPackage == null ||
        brokerPackage != verifiedDemoAccountPackage ||
        !TouchTestService.confirmedDemoHistoryPageReadOnly431(verifiedDemoReview))
      return "🔒 FILA DESCHIS • ISTORIC/CONT NECONFIRMAT • FĂRĂ ORDIN"
    val openSelected455 = historyPageVisible433 &&
      historyPageTab433 == "DESCHIS" &&
      lastOpenTabVisualPackage429 == brokerPackage &&
      openTabVisualConsecutive429 >= 2 &&
      System.currentTimeMillis() - lastOpenTabVisualAt429 in 0L..5_000L
    if (openSelected455) {
      openTabNavigationAttempts455 = 0
      lastOpenTabNavigationAt455 = 0L
      return "✅ FILA DESCHIS SELECTATĂ 2/2 • VERIFIC 0 POZIȚII"
    }
    if (openTabNavigationAttempts455 >= 3)
      return "🔒 FILA DESCHIS NU SE ACTIVEAZĂ • 3 ÎNCERCĂRI • FĂRĂ ALTE APĂSĂRI"
    if (lastOpenTabNavigationAt455 > 0L &&
        nowElapsed - lastOpenTabNavigationAt455 in 0L..12_000L)
      return "🔎 FILA DESCHIS • VERIFIC VIZUAL SCHIMBAREA • NU REPET"
    val ocrConfirmed455 = historyPageVisible433 &&
      System.currentTimeMillis() - historyPageLastSeen433 in 0L..5_000L &&
      historyOpenOcrCount435 >= 2 &&
      System.currentTimeMillis() - historyOpenOcrAt435 in 0L..6_000L &&
      historyOpenOcrX435 in 0.08f..0.48f &&
      historyOpenOcrY435 in 0.15f..0.31f
    if (!ocrConfirmed455) {
      // 459: On Motorola G24 Pocket Option may draw the visible "Deschis"
      // tab as an accessible labelled control while OCR cannot stabilize
      // its bounds for two frames. Use the EXACT accessibility label and
      // its physical on-screen bounds; never tap a guessed coordinate.
      // The history screen and QT DEMO identity were verified above.
      // This is navigation ONLY. The 2/2 SELECTED OPEN visual proof and
      // independent 0-positions proof remain mandatory.
      val labelNavigation459 =
        TouchTestService.advanceDemoHistoryReviewNavigation(
          cachedDemoVerifiedOnChart = verifiedDemoReview
        )
      if (labelNavigation459.contains("FILA DESCHIS") &&
          labelNavigation459.contains("GEST TRIMIS")) {
        lastOpenTabNavigationAt455 = nowElapsed
        openTabNavigationAttempts455++
        return "🔎 FILA DESCHIS • ATINGERE FIZICĂ ETICHETĂ " +
          openTabNavigationAttempts455 + "/3 • VERIFIC PAGINA"
      }
      return "🔒 FILA DESCHIS • OCR 2/2 ȘI ETICHETĂ INDISPONIBILE • FĂRĂ APĂSARE"
    }
    lastOpenTabNavigationAt455 = nowElapsed
    openTabNavigationAttempts455++
    val touchSent455 = TouchTestService.tapVerifiedDemoOpenTabOcr435(
      brokerPackage, historyOpenOcrX435, historyOpenOcrY435,
      cachedDemoVerifiedOnChart = verifiedDemoReview
    )
    // A successfully DISPATCHED gesture is NOT evidence that Pocket Option
    // switched tabs. The next frames must confirm visually selected OPEN.
    return if (touchSent455)
      "🔎 FILA DESCHIS • ATINGERE TRIMISĂ " +
        openTabNavigationAttempts455 + "/3 • AȘTEPT ECRANUL"
    else "🔒 FILA DESCHIS • ATINGERE RESPINSĂ " +
      openTabNavigationAttempts455 + "/3 • FĂRĂ ORDIN"
  }

  /** 458: On a verified history page prefer its OCR-confirmed broker
   * "Perspective" footer over Android GLOBAL_BACK. A navigation gesture
   * never proves settlement or changes any persisted order flags. */
  private fun returnToChartAfterReview458(
    cachedDemoVerifiedOnChart: Boolean,
    ocrVerifiedHistoryPage: Boolean
  ): String {
    val pkg = TouchTestService.activeDemoExecutorPackageForReview()
    val freshHistory = historyPageVisible433 &&
      System.currentTimeMillis() - historyPageLastSeen433 in 0L..5_000L
    val freshPerspective = cachedDemoVerifiedOnChart &&
      ocrVerifiedHistoryPage && freshHistory && pkg != null &&
      perspectiveOcrPackage457 == pkg &&
      perspectiveOcrSamples457 >= 2 &&
      System.currentTimeMillis() - perspectiveOcrAt457 in 0L..6_000L
    if (freshPerspective && pkg != null) {
      val sent = TouchTestService.tapVerifiedDemoPerspectiveFooter457(
        pkg, perspectiveOcrX457, perspectiveOcrY457,
        cachedDemoVerifiedOnChart = true,
        ocrConfirmedHistoryPage = true
      )
      perspectiveOcrSamples457 = 0
      if (sent) {
        historyReturnPauseUntil457 =
          android.os.SystemClock.elapsedRealtime() + 180_000L
        return "PERSPECTIVE • GEST TRIMIS • VERIFIC GRAFIC • FĂRĂ ORDIN NOU"
      }
    }
    // Only a broker-verified HISTORY page permits the legacy Back fallback.
    return TouchTestService.returnToDemoChartAfterVerifiedEmptyReview(
      cachedDemoVerifiedOnChart, ocrVerifiedHistoryPage && freshHistory
    )
  }

  private fun navigateVerifiedDemoHistory431(
    verifiedDemoReview: Boolean,
    nowElapsed: Long
  ): String {
    // 457: After a bounded CLOSED review, leave the price chart visible
    // instead of endlessly reopening Transactions. This pauses navigation
    // only; it never resets "attempted", broker IDs, MG, or position locks.
    if (historyReturnPauseUntil457 > nowElapsed)
      return "ISTORIC DEMO • PAUZĂ NAVIGARE • GRAFIC • ORDIN VECHI BLOCAT"
    // 435: A visually selected OPEN tab verified twice by independent
    // MediaProjection frames proves that the history page IS open even
    // when broker WebView accessibility exposes no page-title nodes.
    val brokerNow435 = TouchTestService.activeDemoExecutorPackageForReview()
    // 449: Version 447 docked the overlay only AFTER the history title was
    // OCR-confirmed. On G24 the overlay itself can cover the QT Demo header
    // before navigation, preventing the verification needed to open history.
    // Dock at the START of a pending, broker-only review; this never changes
    // the order gate, ledger, result or real-account restrictions.
    if (autoDemoSessionConsumed && brokerNow435 != null)
      dockOverlayForBrokerHistory447()
    val openPageSeen435 = verifiedDemoReview && historyPageVisible433 &&
      historyPageTab433 == "DESCHIS" && brokerNow435 != null &&
      brokerNow435 == lastOpenTabVisualPackage429 &&
      openTabVisualConsecutive429 >= 2 &&
      System.currentTimeMillis() - lastOpenTabVisualAt429 in 0L..5000L &&
      System.currentTimeMillis() - historyPageLastSeen433 in 0L..5000L
    if (openPageSeen435) {
      historyNavPending431 = false
      historyNavPendingAt431 = 0L
      historyNavFailed431 = 0
      historyNavStalled431 = false
      lastAutoDemoHistoryNavStatus =
        "ISTORIC DESCHIS OCR 2/2 • VERIFIC POZIȚII DEMO"
      lastAutoDemoHistoryNavStatusAt = nowElapsed
      return lastAutoDemoHistoryNavStatus
    }
    // 439: Merely seeing the DESCHIS label is NOT evidence that the OPEN
    // tab is selected. A CLOSED page shows both labels too. Require fresh
    // MediaProjection proof that OPEN is actually selected before treating
    // an Accessibility-visible label as an opened page. This is navigation
    // only; zero-OPEN still requires its own independent two-frame proof.
    val selectedOpenPage439 = verifiedDemoReview &&
      historyPageVisible433 && historyPageTab433 == "DESCHIS" &&
      System.currentTimeMillis() - historyPageLastSeen433 in 0L..5_000L &&
      lastOpenTabVisualPackage429 == brokerNow435 &&
      System.currentTimeMillis() - lastOpenTabVisualAt429 in 0L..5_000L
    if (selectedOpenPage439 &&
        TouchTestService.confirmedDemoHistoryPageReadOnly431(verifiedDemoReview)) {
      historyNavPending431 = false
      historyNavPendingAt431 = 0L
      historyNavFailed431 = 0
      historyNavStalled431 = false
      return "ISTORIC DESCHIS CONFIRMAT • VERIFIC TRANZACȚII DEMO"
    }
    // 455: On the user's G24 screenshot the broker remains on the blue
    // "Închis" tab even after Android reports a successful ACTION_CLICK on
    // "Deschis". Stop re-clicking WebView text and use ONLY the two-frame
    // OCR physical tap followed by a visual selected-tab proof.
    val historyScreen455 = verifiedDemoReview && brokerNow435 != null &&
      brokerNow435 == verifiedDemoAccountPackage &&
      TouchTestService.confirmedDemoHistoryPageReadOnly431(verifiedDemoReview)
    if (historyScreen455) {
      val openNavigation455 = attemptBrokerOpenTabWithVisualProof455(
        verifiedDemoReview, brokerNow435, nowElapsed
      )
      lastAutoDemoHistoryNavStatus = openNavigation455
      lastAutoDemoHistoryNavStatusAt = nowElapsed
      return openNavigation455
    }
    // 442: After a CLOSED-history read we must not oscillate back to the
    // broker history on every monitor tick. Let the chart remain visible
    // during the bounded review pause. A verified new CLOSED detail is not
    // blocked from completing its OPEN-tab reconciliation.
    val old442 = getSharedPreferences(autoShockAttemptPrefs, Context.MODE_PRIVATE)
    val pendingKey442 = listOf(
      old442.getString("expectedPackage429", "").orEmpty(),
      old442.getString("expectedPair429", "").orEmpty(),
      old442.getLong("attemptedAt429", -1L).toString()
    ).joinToString("|")
    if (!historyPageVisible433 && verifiedClosedDetail437 == null &&
        old442.getBoolean("attempted", false) &&
        lastClosedHistoryScanKey442 == pendingKey442 &&
        lastClosedHistoryScanAt442 > 0L &&
        nowElapsed - lastClosedHistoryScanAt442 in 0L until closedHistoryScanPauseMs442) {
      return "ISTORIC DEMO • PAUZĂ REVERIFICARE • FĂRĂ ORDIN"
    }
    if (historyNavPending431 &&
        nowElapsed - historyNavPendingAt431 >= 7_000L) {
      historyNavPending431 = false
      historyNavFailed431++
    }
    if (historyNavFailed431 >= 3 && !historyNavStalled431) {
      historyNavStalled431 = true
      historyNavStallSince441 = nowElapsed
    }
    if (historyNavStalled431) {
      // The 431 hard latch never retried after three navigation failures,
      // even many hours later. A timed pause allows READ-ONLY re-navigation,
      // while the pending broker-order safety marker remains untouched.
      val age441 = nowElapsed - historyNavStallSince441
      if (age441 !in 0L..29_999L) {
        historyNavStalled431 = false
        historyNavFailed431 = 0
        historyNavPending431 = false
        lastAutoDemoHistoryNavAt = 0L
      } else {
        // 449: Give a readable failure reason rather than a permanent,
        // context-free padlock. This is diagnostic ONLY.
        val stalled = "BLOCAT: ISTORICUL NU SE DESCHIDE • " +
          TouchTestService.brokerWindowDiagnostic446() + " • FĂRĂ ORDIN"
        lastAutoDemoHistoryNavStatus = stalled
        lastAutoDemoHistoryNavStatusAt = nowElapsed
        return stalled
      }
    }
    if (lastAutoDemoHistoryNavAt > 0L &&
        nowElapsed - lastAutoDemoHistoryNavAt in 0L..9_999L)
      return lastAutoDemoHistoryNavStatus
    lastAutoDemoHistoryNavAt = nowElapsed
    val brokerPkg432 = TouchTestService.activeDemoExecutorPackageForReview()
    val ocrReady432 = lastBrokerAccountStatus.startsWith("QT DEMO IDENTIFICAT") &&
      brokerPkg432 != null && brokerPkg432 == verifiedDemoAccountPackage &&
      brokerPkg432 == historyNavOcrPackage432 &&
      historyNavOcrSamples432 >= 2 &&
      System.currentTimeMillis() - historyNavOcrAt432 in 0L..6_000L &&
      historyNavOcrX432 in 0.02f..0.35f &&
      historyNavOcrY432 in 0.84f..0.975f
    val navigation = if (ocrReady432) {
      val wasSent432 = TouchTestService.tapVerifiedDemoHistoryOcr432(
        brokerPkg432!!, historyNavOcrX432, historyNavOcrY432,
        cachedDemoVerifiedOnChart = verifiedDemoReview
      )
      // The OCR result is one-shot per location and may not be reused.
      historyNavOcrSamples432 = 0
      if (wasSent432) "ISTORIC AUTO • DESCHID TRANZACȚII • OCR 432"
      else "ISTORIC AUTO • CONTROL NECONFIRMAT • OCR 432"
    } else TouchTestService.advanceDemoHistoryReviewNavigation(
      cachedDemoVerifiedOnChart = verifiedDemoReview
    )
    if (navigation.startsWith("ISTORIC AUTO • DESCHID TRANZACȚII")) {
      historyNavPending431 = true
      historyNavPendingAt431 = nowElapsed
    } else if (navigation.contains("CONTROL NECONFIRMAT") ||
               navigation.contains("BLOCAT")) {
      historyNavFailed431++
    }
    if (historyNavFailed431 >= 3 && !historyNavStalled431) {
      historyNavStalled431 = true
      historyNavStallSince441 = nowElapsed
    }
    lastAutoDemoHistoryNavStatus = if (historyNavStalled431)
      "BLOCAT: ISTORICUL NU SE DESCHIDE • " +
        TouchTestService.brokerWindowDiagnostic446() + " • FĂRĂ ORDIN"
    else navigation.take(105)
    lastAutoDemoHistoryNavStatusAt = nowElapsed
    return lastAutoDemoHistoryNavStatus
  }

  /**
   * 463: Passive-only reconciliation. The robot NEVER clicks "Deschis" or
   * "Închis". If the user happens to show the exact closed detail and then
   * the explicit empty Open tab, OCR and Accessibility can verify both.
   * Nothing about chart movement, time, a gesture or account balance settles
   * a trade. This is not a substitute for a broker-supported order-status API.
   */
  private fun inspectPassiveDemoProof463(
    nowElapsed: Long,
    reviewPackage: String?,
    cachedDemoVerifiedOnChart: Boolean
  ): String? {
    val prefs = getSharedPreferences(autoShockAttemptPrefs, Context.MODE_PRIVATE)
    if (!prefs.getBoolean("attempted", false)) return null
    if (getSharedPreferences(sell404TestPrefs, Context.MODE_PRIVATE)
        .getBoolean("attempted", false))
      return "463 • TEST SELL VECHI NECONFIRMAT • FĂRĂ ORDIN"
    if (!cachedDemoVerifiedOnChart ||
        reviewPackage == null || reviewPackage != verifiedDemoAccountPackage ||
        verifiedDemoAccountAt <= 0L ||
        nowElapsed - verifiedDemoAccountAt !in 0L..90_000L ||
        !historyPageVisible433 ||
        System.currentTimeMillis() - historyPageLastSeen433 !in 0L..6_000L)
      return null

    val expectedPackage = prefs.getString("expectedPackage429", null)
    val expectedPair = prefs.getString("expectedPair429", null)
    val stake = prefs.getLong("expectedStakeCents429", -1L)
    val payout = prefs.getInt("expectedPayout429", -1)
    val attemptedAt = prefs.getLong("attemptedAt429", -1L)
    if (expectedPackage != reviewPackage || expectedPair.isNullOrBlank() ||
        stake <= 0L ||
        payout !in 92..100 || attemptedAt <= 0L)
      return "463 • DETALII ORDIN VECHI INCOMPLETE • BLOCAT"

    if (historyPageTab433 != "DESCHIS") {
      val proof = verifiedClosedDetail437
      return if (proof != null &&
          System.currentTimeMillis() - verifiedClosedDetailAt437 in 0L..90_000L &&
          proof.brokerPackage == expectedPackage &&
          proof.pair == expectedPair)
        "463 • DETALIU ÎNCHIS CITIT 2/2 • LIPSEȘTE DOVADA 0 DESCHISE"
      else "463 • ISTORIC CITIT PASIV • ORDIN ÎNCĂ NEVERIFICAT"
    }

    val freshOcr = lastEmptyOpenOcrPackage == reviewPackage &&
      emptyOpenOcrConsecutive >= 2 &&
      System.currentTimeMillis() - lastEmptyOpenOcrAt in 0L..4_500L
    val selectedOpen = lastOpenTabVisualPackage429 == reviewPackage &&
      openTabVisualConsecutive429 >= 2 &&
      System.currentTimeMillis() - lastOpenTabVisualAt429 in 0L..5_000L
    if (!freshOcr || !selectedOpen) return "463 • AȘTEPT 0 DESCHISE OCR 2/2"
    val emptyRead = try {
      TouchTestService.inspectExplicitEmptyOpenDemoTabReadOnly(
        cachedDemoVerifiedOnChart = true,
        ocrVerifiedEmptyOpenTab = true
      )
    } catch (_: Throwable) { false }
    if (!emptyRead) return "463 • ZERO POZIȚII NECONFIRMAT"
    if (demoEmptyReviewReads == 0 ||
        nowElapsed - demoEmptyReviewFirstAt !in 0L..20_000L) {
      demoEmptyReviewReads = 1
      demoEmptyReviewFirstAt = nowElapsed
      return "463 • ZERO DESCHISE 1/2 • CITIRE PASIVĂ"
    }
    if (nowElapsed - demoEmptyReviewFirstAt < 2_000L)
      return "463 • AȘTEPT A DOUA CITIRE INDEPENDENTĂ"
    demoEmptyReviewReads = 0
    demoEmptyReviewFirstAt = 0L

    // Two empty-Open reads alone must NEVER clear a previous gesture.
    val closed = verifiedClosedDetail437
      ?: return "463 • ZERO DESCHISE 2/2 • LIPSEȘTE ID ÎNCHIS"
    if (System.currentTimeMillis() - verifiedClosedDetailAt437 !in 0L..90_000L ||
        closed.brokerPackage != expectedPackage ||
        closed.pair != expectedPair ||
        closed.stakeCents != stake ||
        closed.payoutPercent != payout ||
        (prefs.getString("expectedSide437", null) != null &&
          prefs.getString("expectedSide437", null) != closed.side) ||
        !brokerOpenTimeMatchesAttempt437(closed.openedSecondsOfDay, attemptedAt))
      return "463 • DOVADA ÎNCHIDERII NU SE POTRIVEȘTE • BLOCAT"

    val openId = demoRecoveryLedger.verifiedOpenPositionId429()
    if (openId != null && openId != closed.positionId)
      return "463 • ID OPEN / ÎNCHIS DIFERIT • BLOCAT"
    val ledgerKey = "QT_DEMO:" + expectedPackage
    val alreadySettled = demoRecoveryLedger.alreadySettledClosedReceipt444(
      ledgerKey, closed.positionId
    )
    val manualStake = prefs.getBoolean("brokerStake476", false)
    val ledgerUpdated = if (alreadySettled) true
      else if (manualStake && openId == null) true
      else if (openId != null)
        demoRecoveryLedger.onVerifiedDemoClosed(
          ledgerKey, openId, openId + ":CLOSED", closed.netProfitCents, true
        )
      else
        demoRecoveryLedger.reconcileSettledDemoWithMissingOpen437(
          ledgerKey, closed.positionId, closed.stakeCents,
          closed.payoutPercent, closed.netProfitCents,
          uniqueClosedDetailReadTwice = true,
          zeroOpenReadTwice = true,
          exactPriorGestureTimeMatched = true
        )
    if (!ledgerUpdated) return "463 • REGISTRU DEMO NU ACCEPTĂ DOVADA • BLOCAT"

    // Exact proof and ledger are durable before clearing the gesture flag.
    val cleared = prefs.edit().putBoolean("attempted", false)
      .remove("expectedPair429").remove("expectedPackage429")
      .remove("expectedStakeCents429").remove("expectedPayout429")
      .remove("brokerStake476").remove("expectedSide437").remove("attemptedAt429")
      .remove("attemptedWallAt454").commit()
    if (!cleared)
      return "463 • REZULTAT CITIT, DAR BLOCAREA NU S-A SALVAT"

    val gateReady = when (tradePositionGate.state()) {
      TradePositionGate.State.OPEN ->
        tradePositionGate.brokerConfirmedClosed(closed.positionId, true)
      TradePositionGate.State.UNKNOWN, TradePositionGate.State.READY ->
        tradePositionGate.brokerVerifiedEmptyDemoReview(true)
      TradePositionGate.State.SUBMITTING -> false
    }
    verifiedClosedDetail437 = null
    verifiedClosedDetailAt437 = 0L
    // A verified LOSS changes the ledger, but CHART-ONLY must never run a
    // Martingale progression or submit an untested larger stake automatically.
    val canRearmBase = gateReady && (manualStake || (!demoRecoveryLedger.isRecovering429() &&
      demoRecoveryLedger.quote(payout).stakeCents == 100L))
    autoDemoSessionRequested = canRearmBase
    autoDemoSessionConsumed = !canRearmBase
    autoDemoArmed = false
    autoDemoMarket = null
    autoDemoLastPreflightAt = 0L
    autoDemoLockedAt = lockedAt
    autoDemoEntryCycleStartedAt = if (canRearmBase)
      System.currentTimeMillis() else 0L
    return if (canRearmBase)
      "476 • ORDIN ÎNCHIS VERIFICAT • DEMO REACTIVAT"
    else "463 • REZULTAT VERIFICAT • NOI ORDINE BLOCATE (FĂRĂ MG)"
  }

  /**
   * 465: Unlimited count of individually preflighted $1 QT DEMO pilot attempts
   * after the prior configured 5-minute expiry and Android's gesture cooldown.
   * There is NO extra seven-minute pause and NO three-trade counter. Without
   * a broker order API the elapsed expiry is NOT proof of settlement, so
   * results remain UNKNOWN, no Martingale and no known OPEN-ID override.
   * Reject changed/unknown expiry, QT Real and mismatched account, amount,
   * pair or payout. This is ONLY an experimental DEMO simulator workflow.
   */
  private fun maybeRearmExpiredDemoPilot464(
    nowElapsed: Long,
    visiblePackage: String?,
    chartDemoVerified: Boolean
  ): String? {
    val prefs = getSharedPreferences(autoShockAttemptPrefs, Context.MODE_PRIVATE)
    if (!prefs.getBoolean("attempted", false) ||
        !autoDemoSessionConsumed ||
        getSharedPreferences(sell404TestPrefs, Context.MODE_PRIVATE)
          .getBoolean("attempted", false)) return null
    if (!chartDemoVerified || visiblePackage == null ||
        visiblePackage != verifiedDemoAccountPackage ||
        verifiedDemoAccountAt <= 0L ||
        nowElapsed - verifiedDemoAccountAt !in 0L..90_000L ||
        !lastBrokerAccountStatus.startsWith("QT DEMO IDENTIFICAT") ||
        !TouchTestService.ready() ||
        (historyPageVisible433 &&
          System.currentTimeMillis() - historyPageLastSeen433 in 0L..6_000L))
      return null

    val expectedPackage = prefs.getString("expectedPackage429", null)
    val expectedPair = prefs.getString("expectedPair429", null)
    val expectedSide = prefs.getString("expectedSide437", null)
    val expectedStake = prefs.getLong("expectedStakeCents429", -1L)
    val expectedPayout = prefs.getInt("expectedPayout429", -1)
    val priorWall = prefs.getLong("attemptedWallAt454", -1L)
    if (expectedPackage != visiblePackage || expectedPair.isNullOrBlank() ||
        expectedSide !in listOf("BUY", "SELL") ||
        expectedStake <= 0L || expectedPayout !in 92..100 ||
        priorWall <= 0L)
      return "464 • ORDIN VECHI INCOMPLET • NECESITĂ DOVADĂ BROKER"

    val wallAge = System.currentTimeMillis() - priorWall
    if (wallAge in 0 until DEMO_TEST_EXPIRY_MS_465)
      return "465 • AȘTEPT EXPIRAREA DEMO 5 MIN • FĂRĂ ORDIN"
    // Clock reversal and obsolete attempts cannot be reconciled by timing.
    if (wallAge !in DEMO_TEST_EXPIRY_MS_465..(24 * 60 * 60_000L))
      return "465 • TIMP ORDIN NECUNOSCUT • NECESITĂ DOVADĂ"
    if (!TouchTestService.priorDemoGestureCooldownComplete())
      return "465 • TRADE ÎNCĂ ÎN COOLDOWN ANDROID • FĂRĂ ORDIN"
    if (!TouchTestService.confirmedFiveMinuteDemoExpiry465())
      return "465 • EXPIRARE 00:05:00 NECONFIRMATĂ • FĂRĂ ORDIN"

    // A real broker OPEN UUID, a previous verified LOSS, or an active MG
    // cycle from an older build requires broker proof before timed rearm.
    if (demoRecoveryLedger.verifiedOpenPositionId429() != null ||
        (!prefs.getBoolean("brokerStake476", false) &&
          (demoRecoveryLedger.isRecovering429() ||
            demoRecoveryLedger.needsBaseStakeReset() ||
            demoRecoveryLedger.quote(expectedPayout).stakeCents != 100L)))
      return "464 • REGISTRU ORDIN/MG ACTIV • NECESITĂ DOVADĂ BROKER"

    val gateState = tradePositionGate.state()
    if (gateState != TradePositionGate.State.UNKNOWN &&
        gateState != TradePositionGate.State.READY)
      return "464 • POZIȚIE POSIBIL DESCHISĂ • FĂRĂ ORDIN"

    val nowWall = System.currentTimeMillis()
    val visiblePair = TouchTestService.readVisibleDemoPair() ?: return null
    if (!pairReady(nowWall) || currentPair(nowWall) != visiblePair)
      return "464 • PERECHE LIVE NECONFIRMATĂ • FĂRĂ ORDIN"
    val preflight = try {
      if (TouchTestService.readBrokerDemoOrder476(visiblePair) != null)
        "PREGĂTIT AUTO DEMO" else "BLOCAT: MIZĂ DEMO NECONFIRMATĂ"
    } catch (_: Throwable) { "BLOCAT: PRECHECK QT DEMO" }
    if (!preflight.startsWith("PREGĂTIT AUTO DEMO"))
      return "464 • AȘTEPT CONFIRMAREA MIZEI DEMO • FĂRĂ ORDIN"
    if (TouchTestService.activeDemoExecutorPackageForReview() != visiblePackage)
      return "464 • FEREASTRĂ DEMO SCHIMBATĂ • FĂRĂ ORDIN"

    // This state change is only a timed DEMO pilot release of UNKNOWN.
    // It is NOT a brokerVerifiedEmptyDemoReview and books NO P/L.
    if (!tradePositionGate.releaseUnknownGestureForExpiredDemoPilot464(
        elapsedWindowVerified = true,
        freshDemoPreflightVerified = true,
        limitedPilotCapacityAvailable = true))
      return "464 • STARE ORDIN INCERTĂ • FĂRĂ REPETARE"

    val stored = prefs.edit()
      // 465: no "3 probes" counter; older 464 count is intentionally ignored.
      .putLong("lastUnknownProbeWall464", priorWall)
      .putString("lastUnknownProbePair464", expectedPair)
      .putBoolean("attempted", false)
      .remove("expectedPackage429")
      .remove("expectedPair429")
      .remove("expectedStakeCents429")
      .remove("brokerStake476")
      .remove("expectedPayout429")
      .remove("expectedSide437")
      .remove("attemptedAt429")
      .remove("attemptedWallAt454")
      .commit()
    if (!stored) {
      tradePositionGate.uncertainResult()
      return "464 • NU POT SALVA PAUZA • FĂRĂ REPETARE"
    }

    autoDemoSessionRequested = true
    autoDemoSessionConsumed = false
    autoDemoArmed = false
    autoDemoMarket = null
    autoDemoExpiry = 0L
    autoDemoLastPreflightAt = 0L
    autoDemoLockedAt = lockedAt
    autoDemoEntryCycleStartedAt = System.currentTimeMillis()
    autoDemoLastPreflightReason = "QT DEMO • MIZĂ DIN BROKER • REZULTAT PRECEDENT NECUNOSCUT"
    return "476 • DEMO REACTIVAT • FĂRĂ LIMITĂ NUMERICĂ / FĂRĂ MG"
  }

  private fun startBrokerAccountMonitor() {
    if (brokerAccountMonitorRunning) return
    brokerAccountMonitorRunning = true
    mainHandler.post(object : Runnable {
      override fun run() {
        if (shuttingDown || mediaProjection == null || overlayView == null) {
          brokerAccountMonitorRunning = false
          return
        }
        val diagnostic = try {
          TouchTestService.inspectBrokerAccountReadOnly()
        } catch (error: Exception) {
          android.util.Log.e("ScalpAtlas399", "Read-only account check failed", error)
          "CONT NECONFIRMAT • FĂRĂ ORDINE"
        }
        if (diagnostic != lastBrokerAccountStatus) {
          lastBrokerAccountStatus = diagnostic
          touchProbeStatus?.text = "🤖 " + diagnostic.take(115)
        }
        // Amount edits depend on broker-verified settled trade receipts;
        // the existing 424 build has no automatic receipt reader, so this
        // event cannot be produced by Android gesture callbacks or SHOCK.
        // 463: In CHART-ONLY, do not silently edit the stake field for
        // Martingale. Keep any recovery amount disabled until a separately
        // validated broker settlement and an explicitly tested risk policy.
        if (!CHART_ONLY_DEMO_462)
          maybePrepareAutomaticDemoRecoveryStake(android.os.SystemClock.elapsedRealtime())
        // 462 CHART-ONLY DEMO: do not open, press, or scroll either the
        // CLOSED or OPEN transaction tabs automatically. A single valid
        // user-authorized DEMO SHOCK can still submit one broker order,
        // subject to the unchanged preflight and persistent "attempted"
        // guard. Without a broker-verified settlement, NO second order and
        // NO Martingale are permitted; elapsed time is not settlement proof.
        // Keep only the READ-ONLY broker identity monitor on the live chart.
        if (CHART_ONLY_DEMO_462) {
          // Restore the <=90-second chart DEMO identity proof which v462
          // accidentally skipped before its early return. We may then read
          // a manually displayed broker receipt, WITHOUT touching the UI.
          val proofNow463 = android.os.SystemClock.elapsedRealtime()
          val proofPackage463 =
            TouchTestService.activeDemoExecutorPackageForReview()
          val demoChart463 = diagnostic.contains("QT DEMO IDENTIFICAT")
          if (demoChart463 && proofPackage463 != null) {
            verifiedDemoAccountAt = proofNow463
            verifiedDemoAccountPackage = proofPackage463
          } else if (diagnostic.contains("QT REAL IDENTIFICAT") ||
              (proofPackage463 != null &&
                proofPackage463 != verifiedDemoAccountPackage)) {
            verifiedDemoAccountAt = 0L
            verifiedDemoAccountPackage = null
          }
          val chartCache463 = proofPackage463 != null &&
            proofPackage463 == verifiedDemoAccountPackage &&
            verifiedDemoAccountAt > 0L &&
            proofNow463 - verifiedDemoAccountAt in 0L..90_000L &&
            !diagnostic.contains("QT REAL IDENTIFICAT")
          val passiveStatus463 = inspectPassiveDemoProof463(
            proofNow463, proofPackage463, chartCache463
          )
          val pilotStatus464 = if (passiveStatus463 == null && autoDemoSessionConsumed)
            maybeRearmExpiredDemoPilot464(proofNow463, proofPackage463, chartCache463)
          else null
          val effectiveStatus464 = passiveStatus463 ?: pilotStatus464
          if (effectiveStatus464 != null) {
            lastAutoDemoHistoryNavStatus = effectiveStatus464
            lastAutoDemoHistoryNavStatusAt = proofNow463
          }
          if (autoDemoSessionConsumed) {
            touchProbeStatus?.text = if (effectiveStatus464 != null)
              "🤖 " + effectiveStatus464.take(110)
            else "GRAFIC CONTINUU • FĂRĂ NAVIGARE ISTORIC • " +
              "ORDIN VECHI BLOCAT PÂNĂ LA VERIFICARE"
          } else if (pilotStatus464 != null) {
            touchProbeStatus?.text = "🤖 " + pilotStatus464.take(110)
          }
          mainHandler.postDelayed(this, 2500L)
          return
        }
        // 410: On the broker's Transactions page the account header is
        // sometimes absent, even though QT Demo was confirmed on the chart.
        // Carry that proof for <=90s ONLY in the SAME broker package, and ONLY
        // for a read-only explicit empty-Open-tab review, never for an order.
        val nowReview = android.os.SystemClock.elapsedRealtime()
        val reviewPackage = TouchTestService.activeDemoExecutorPackageForReview()
        val demoVisibleNow = diagnostic.contains("QT DEMO IDENTIFICAT")
        if (demoVisibleNow && reviewPackage != null) {
          verifiedDemoAccountAt = nowReview
          verifiedDemoAccountPackage = reviewPackage
        } else if (diagnostic.contains("QT REAL IDENTIFICAT") ||
            (reviewPackage != null && reviewPackage != verifiedDemoAccountPackage)) {
          // 411: a transient SystemUI focus must not erase the prior verified
          // demo identity; the <=90s expiry and SAME-package check still
          // strictly control whether a read-only review can be accepted.
          verifiedDemoAccountAt = 0L
          verifiedDemoAccountPackage = null
        }
        val cachedDemoReview = !demoVisibleNow &&
          !diagnostic.contains("QT REAL IDENTIFICAT") &&
          reviewPackage != null && reviewPackage == verifiedDemoAccountPackage &&
          verifiedDemoAccountAt > 0L &&
          nowReview - verifiedDemoAccountAt in 0L..90_000L
        // A missing transaction badge is NEVER proof that an order closed.
        // Only a broker page explicitly stating zero OPEN transactions counts.
        if (demoVisibleNow || cachedDemoReview) {
          lastDemoTradeStatus = if (demoVisibleNow) try {
            TouchTestService.inspectVisibleDemoOpenBadgeReadOnly()
          } catch (_: Exception) {
            "POZIȚIE NECUNOSCUTĂ • FĂRĂ REARMARE"
          } else "VERIFICARE QT DEMO • TRANZACȚII DESCHISE"
          val oldSellAttempt = getSharedPreferences(
            sell404TestPrefs, Context.MODE_PRIVATE
          ).getBoolean("attempted", false)
          val oldShockAttempt = getSharedPreferences(
            autoShockAttemptPrefs, Context.MODE_PRIVATE
          ).getBoolean("attempted", false)
          val eligibleForBrokerEmptyReview = (oldSellAttempt || oldShockAttempt) &&
            autoDemoSessionConsumed && !autoDemoArmed &&
            !demoClickTestPending &&
            TouchTestService.priorDemoGestureCooldownComplete()
          // 416: Qt Demo is often VISIBLE on Transactions > Open. The
          // 414 OCR fallback erroneously required a CACHED identity only,
          // so it could never count OCR evidence on a page with visible Qt
          // Demo. A fresh on-screen QT Demo proof is strictly better than
          // a same-package cached proof. Both are READ-ONLY; order dispatch
          // still requires the full independent broker preflight on chart.
          val verifiedDemoReview = demoVisibleNow || cachedDemoReview
          // 429: After a possibly accepted physical DEMO gesture, inspect
          // the selected OPEN tab promptly. Waiting for a five-minute
          // cooldown would miss the only window to capture a live order ID.
          // A failed/ambiguous OPEN receipt never becomes a LOSS guess.
          val pendingPrefs429 = getSharedPreferences(autoShockAttemptPrefs, Context.MODE_PRIVATE)
          val expectedPair429 = pendingPrefs429.getString("expectedPair429", null)
          val expectedPackage429 = pendingPrefs429.getString("expectedPackage429", null)
          val expectedStake429 = pendingPrefs429.getLong("expectedStakeCents429", -1L)
          val expectedPayout429 = pendingPrefs429.getInt("expectedPayout429", -1)
          val attemptedAt429 = pendingPrefs429.getLong("attemptedAt429", -1L)
          var pendingReceipt429 = oldShockAttempt && !expectedPair429.isNullOrBlank() &&
            expectedPackage429 == reviewPackage &&
            expectedStake429 in 100L..DemoRecoveryLedger.MAX_SINGLE_STAKE_CENTS &&
            expectedPayout429 in 92..100
          val openReceiptMissing429 = pendingReceipt429 &&
            demoRecoveryLedger.verifiedOpenPositionId429() == null
          // 441: AFTER the 110-second OPEN receipt window expires, the
          // old code stopped navigating to history entirely. That left
          // CLOSED receipt reconciliation impossible for an hours-old
          // transaction. Navigate read-only regardless of receipt age;
          // attempt to CAPTURE a live OPEN ID only inside the short window.
          if (openReceiptMissing429 &&
              historyPageTab433 != "ÎNCHIS" &&
              historyPageTab433 != "DETALIU ÎNCHIS") {
            val openReceiptWindow441 = attemptedAt429 > 0L &&
              nowReview - attemptedAt429 in 0L..110_000L
            val selectedOpenVisual429 =
              lastOpenTabVisualPackage429 == reviewPackage &&
              openTabVisualConsecutive429 >= 2 &&
              System.currentTimeMillis() - lastOpenTabVisualAt429 in 0L..5000L
            val openReceipt429 = if (openReceiptWindow441)
              TouchTestService.readDoubleVerifiedDemoReceipt429(
                expectedPair = expectedPair429!!,
                cachedDemoVerifiedOnChart = verifiedDemoReview,
                closed = false,
                selectedTabVerifiedVisually = selectedOpenVisual429
              )
            else null
            if (openReceipt429 != null &&
                openReceipt429.brokerPackage == expectedPackage429 &&
                openReceipt429.stakeCents == expectedStake429 &&
                openReceipt429.netProfitCents == null) {
              val stored = demoRecoveryLedger.onVerifiedDemoOpened(
                brokerAccountKey = "QT_DEMO:" + expectedPackage429,
                positionId = openReceipt429.positionId,
                stakeCents = expectedStake429,
                payoutPercent = expectedPayout429,
                receiptIndependentlyVerified = true
              )
              if (stored) {
                touchProbeStatus?.text = "✅ ORDIN DESCHIS DEMO • ID VERIFICAT 2/2"
                returnToChartAfterReview458(
                                  true,
                                  historyPageVisible433 &&
                                    System.currentTimeMillis() - historyPageLastSeen433 in
                                      0L..5_000L
                                )
              } else {
                touchProbeStatus?.text =
                  "BLOCAT: ID OPEN VERIFICAT, DAR REGISTRUL NU ÎL ACCEPTĂ"
              }
            } else {
              val navigation431 = navigateVerifiedDemoHistory431(
                verifiedDemoReview, nowReview
              )
              if (navigation431.contains("BLOCAT: ISTORICUL"))
                touchProbeStatus?.text = navigation431
              else
                touchProbeStatus?.text = if (openReceiptWindow441)
                  "🔎 DESCHIS DEMO • " +
                    TouchTestService.receiptStatus429().take(65)
                else "🔎 ISTORIC DEMO • CAUT TRANZACȚIA ÎNCHISĂ"
            }
          } else if (openReceiptMissing429) {
            // A five-minute trade can no longer have an OPEN receipt.
            // Continue strict CLOSED history reconciliation instead of
            // describing an old OPEN as the only possible evidence.
            touchProbeStatus?.text =
              "🔎 DEMO • CAUT ID ÎN ISTORICUL ÎNCHIS • FĂRĂ ORDIN"
          }
          // A CLOSED list row is only a navigation target; the full UUID,
          // opened time, side, payout and signed result must still be checked
          // twice inside its detail sheet before a prior lock can be cleared.
          // 445: A broker-verified OPEN ID must NOT suppress selection of
          // its CLOSED history row. Previously only MISSING-OPEN attempts
          // could open a CLOSED detail, so normal trades could never settle.
          // Row OCR is navigation-only; full UUID + outcome still need 2/2.
          val closedList438 = pendingReceipt429 &&
            verifiedDemoReview && historyPageTab433 == "ÎNCHIS" &&
            historyPageVisible433 && verifiedClosedDetail437 == null &&
            reviewPackage != null && reviewPackage == expectedPackage429
          if (closedList438) {
            if (closedListFirstObservedAt454 == 0L)
              closedListFirstObservedAt454 = nowReview
          } else closedListFirstObservedAt454 = 0L
          val closedAttemptKey458 = listOf(expectedPackage429.orEmpty(),
            expectedPair429.orEmpty(), attemptedAt429.toString()).joinToString("|")
          if (closedList438 && historyReturnPauseUntil457 <= nowReview &&
              closedRowProbeKey458 != closedAttemptKey458 &&
              closedRowSamples438 >= 2 &&
              System.currentTimeMillis() - closedRowAt438 in 0L..6_000L &&
              nowReview - lastClosedRowTapAt438 > 20_000L) {
            // Mark before dispatch. Even a rejected/cancelled gesture cannot
            // cause endless clicks on a completed-trade row.
            closedRowProbeKey458 = closedAttemptKey458
            lastClosedRowTapAt438 = nowReview
            val sent438 = TouchTestService.tapVerifiedDemoClosedRowOcr438(
              reviewPackage!!, closedRowX438, closedRowY438
            )
            closedRowSamples438 = 0
            touchProbeStatus?.text = if (sent438)
              "🔎 ÎNCHIS DEMO • DESCHID DETALIU • VERIFIC ID 2/2"
            else "🔒 ÎNCHIS DEMO • RÂND NECONFIRMAT • FĂRĂ ORDIN"
          }
          // 458: The missing step in 457: from the selected CLOSED tab,
          // first attempt "Deschis" (OPEN). Only that tab can provide
          // the independently verified EMPTY OPEN 2/2 evidence which permits
          // a safe new base-$1 DEMO cycle. Never assume CLOSED list = empty.
          // The 455 helper caps attempts at 3 with >=12 seconds between taps.
          val closedAge458 = if (closedList438)
            nowReview - closedListFirstObservedAt454 else 0L
          val rowProbeSettled458 = closedRowProbeKey458 != closedAttemptKey458 ||
            nowReview - lastClosedRowTapAt438 >= 8_000L
          if (closedList438 && closedAge458 >= 10_000L &&
              rowProbeSettled458 && historyReturnPauseUntil457 <= nowReview &&
              !closedHistoryInspectionInProgress) {
            val openNav458 = attemptBrokerOpenTabWithVisualProof455(
              verifiedDemoReview, expectedPackage429, nowReview
            )
            if (openNav458.isNotBlank())
              touchProbeStatus?.text = "🔎 458 • " + openNav458.take(92)
          }
          // 457: The screen shown by the user is the CLOSED trade list.
          // After a bounded review, navigate to broker "Perspective" from
          // two fresh independent OCR detections, not back to "Tranzacții".
          // Preserve ALL old-order locks. No WIN/LOSS, stake or AUTO reset.
          // 458: Allow at least one strict OPEN-tab verification window
          // before escaping. If none of the 3 bounded taps is visually
          // acknowledged, return to Perspective with the old lock intact.
          val timedOutClosedList457 = closedList438 &&
            closedListFirstObservedAt454 > 0L &&
            (nowReview - closedListFirstObservedAt454 >= 65_000L ||
              (openTabNavigationAttempts455 >= 3 &&
                nowReview - closedListFirstObservedAt454 >= 45_000L))
          if (timedOutClosedList457 && !closedHistoryInspectionInProgress &&
              nowReview - lastPerspectiveReturnAttempt457 >= 30_000L &&
              historyReturnPauseUntil457 <= nowReview) {
            val freshPerspective457 = perspectiveOcrSamples457 >= 2 &&
              perspectiveOcrPackage457 == expectedPackage429 &&
              System.currentTimeMillis() - perspectiveOcrAt457 in 0L..6_000L &&
              perspectiveOcrX457 in 0.20f..0.63f &&
              perspectiveOcrY457 in 0.84f..0.985f &&
              historyPageVisible433 &&
              System.currentTimeMillis() - historyPageLastSeen433 in 0L..5_000L
            if (freshPerspective457) {
              lastPerspectiveReturnAttempt457 = nowReview
              val sent457 = TouchTestService.tapVerifiedDemoPerspectiveFooter457(
                expectedPackage429!!, perspectiveOcrX457, perspectiveOcrY457,
                cachedDemoVerifiedOnChart = verifiedDemoReview,
                ocrConfirmedHistoryPage = true
              )
              perspectiveOcrSamples457 = 0
              if (sent457) {
                // Page transition itself still requires a NEW chart frame.
                historyReturnPauseUntil457 = nowReview + 180_000L
                lastClosedHistoryScanKey442 = listOf(
                  expectedPackage429.orEmpty(), expectedPair429.orEmpty(),
                  attemptedAt429.toString()
                ).joinToString("|")
                lastClosedHistoryScanAt442 = nowReview
              }
              touchProbeStatus?.text = if (sent457)
                "🔎 PERSPECTIVE • REVENIRE TRIMISĂ • VERIFIC GRAFIC • MG BLOCAT"
              else "🔒 PERSPECTIVE • GEST RESPINS • FĂRĂ ORDIN"
            } else {
              touchProbeStatus?.text =
                "🔎 PERSPECTIVE • AȘTEPT ETICHETA OCR 2/2 • FĂRĂ ORDIN"
            }
          }
          val closedDetail438 = verifiedClosedDetail437
          if (closedDetail438 != null && pendingReceipt429 &&
              historyPageTab433 == "DETALIU ÎNCHIS" &&
              closedDetail438.brokerPackage == expectedPackage429 &&
              lastVerifiedDetailBackId438 != closedDetail438.positionId &&
              System.currentTimeMillis() - verifiedClosedDetailAt437 in 0L..20_000L) {
            // The proof stays in memory; navigate to the OPEN list to obtain
            // two independent zero-position reads before reconciliation.
            val openNav455 = attemptBrokerOpenTabWithVisualProof455(
              verifiedDemoReview, expectedPackage429, nowReview
            )
            if (openNav455.contains("ATINGERE TRIMISĂ") ||
                openNav455.contains("SELECTATĂ 2/2")) {
              lastVerifiedDetailBackId438 = closedDetail438.positionId
            }
            touchProbeStatus?.text = openNav455
          }
          // 458: A broker OPEN tab with no explicit zero-position message
          // must not hold the screen forever. Do not clear any order marker.
          val openReview458 = pendingReceipt429 && verifiedDemoReview &&
            historyPageVisible433 && historyPageTab433 == "DESCHIS" &&
            reviewPackage != null && reviewPackage == expectedPackage429
          if (openReview458) {
            if (openTabFirstObservedAt458 == 0L)
              openTabFirstObservedAt458 = nowReview
          } else openTabFirstObservedAt458 = 0L
          val ocrCurrent = verifiedDemoReview &&
            lastEmptyOpenOcrPackage == reviewPackage &&
            emptyOpenOcrConsecutive >= 2 &&
            System.currentTimeMillis() - lastEmptyOpenOcrAt in 0L..4500L
          val explicitZero = eligibleForBrokerEmptyReview && try {
            TouchTestService.inspectExplicitEmptyOpenDemoTabReadOnly(
              cachedDemoVerifiedOnChart = verifiedDemoReview,
              ocrVerifiedEmptyOpenTab = ocrCurrent
            )
          } catch (_: Throwable) { false }
          if (explicitZero) {
            val tick = android.os.SystemClock.elapsedRealtime()
            // Count two POSITIVE reads at least 2 seconds apart, within a
            // 20-second window. Transient unreadable accessibility frames
            // are NOT a negative/empty-trade proof; neither reset a verified
            // first sample nor count as a second one. Any real account
            // change resets the sample below.
            if (demoEmptyReviewReads == 0 || tick - demoEmptyReviewFirstAt > 20_000L) {
              demoEmptyReviewReads = 1
              demoEmptyReviewFirstAt = tick
              touchProbeStatus?.text =
                "VERIFICARE QT DEMO 0 POZIȚII • CONFIRM 1/2"
            } else if (tick - demoEmptyReviewFirstAt >= 2_000L) {
              demoEmptyReviewReads++
              if (demoEmptyReviewReads >= 2 &&
                  tradePositionGate.brokerVerifiedEmptyDemoReview(true)) {
                // 437: An order whose OPEN ID was not observed in time
                // can be reconciled ONLY against a unique, twice-read CLOSED
                // detail, the original persisted gesture time, same DEMO
                // account/pair/stake/payout, plus two explicit EMPTY Open
                // reads. A balance change or historical list entry never
                // provides sufficient evidence for rearming or LOSS.
                val closedProof437 = verifiedClosedDetail437
                val closedProofFresh437 = closedProof437 != null &&
                  System.currentTimeMillis() - verifiedClosedDetailAt437 in 0L..90_000L
                // 445: Reconcile BOTH possible paths:
                // A) OPEN receipt was missed -> strict recovered CLOSED ID.
                // B) OPEN receipt already has an exact broker UUID -> CLOSED
                //    UUID must be IDENTICAL before the ledger may settle it.
                // Both paths require a twice-read CLOSED detail, the original
                // persisted gesture's time, and two separate zero-OPEN reads.
                val verifiedOpenId445 =
                  demoRecoveryLedger.verifiedOpenPositionId429()
                val matchingAttempt437 = pendingReceipt429 &&
                  closedProofFresh437 && closedProof437 != null &&
                  closedProof437.brokerPackage == expectedPackage429 &&
                  closedProof437.pair == expectedPair429 &&
                  closedProof437.stakeCents == expectedStake429 &&
                  closedProof437.payoutPercent == expectedPayout429 &&
                  (pendingPrefs429.getString("expectedSide437", null) == null ||
                    pendingPrefs429.getString("expectedSide437", null) ==
                      closedProof437.side) &&
                  (verifiedOpenId445 == null ||
                    verifiedOpenId445 == closedProof437.positionId) &&
                  brokerOpenTimeMatchesAttempt437(
                    closedProof437.openedSecondsOfDay, attemptedAt429
                  )
                // 444: If the CLOSED settlement was already atomically
                // saved in the ledger, but Android-attempt clearing failed
                // or the app died before the second preferences commit,
                // recognize the exact SAME broker-verified UUID WITHOUT
                // booking its P/L a second time. This runs ONLY after the
                // full 437 match incl. original gesture time and 0 OPEN 2/2.
                val alreadySettled444 = matchingAttempt437 &&
                  closedProof437 != null &&
                  demoRecoveryLedger.alreadySettledClosedReceipt444(
                    brokerAccountKey = "QT_DEMO:" + expectedPackage429,
                    positionId = closedProof437.positionId
                  )
                val reconciled437 = if (alreadySettled444) true
                else if (matchingAttempt437 && closedProof437 != null) {
                  if (verifiedOpenId445 != null) {
                    // 445: The OPEN receipt's UUID must exactly match the
                    // independently confirmed CLOSED UUID. No loss estimate
                    // or time-only settlement is allowed here.
                    demoRecoveryLedger.onVerifiedDemoClosed(
                      brokerAccountKey = "QT_DEMO:" + expectedPackage429,
                      positionId = verifiedOpenId445,
                      closedReceiptId = verifiedOpenId445 + ":CLOSED",
                      netProfitCents = closedProof437.netProfitCents,
                      receiptIndependentlyVerified = true
                    )
                  } else {
                    demoRecoveryLedger.reconcileSettledDemoWithMissingOpen437(
                      brokerAccountKey = "QT_DEMO:" + expectedPackage429,
                      positionId = closedProof437.positionId,
                      stakeCents = closedProof437.stakeCents,
                      payoutPercent = closedProof437.payoutPercent,
                      netProfitCents = closedProof437.netProfitCents,
                      uniqueClosedDetailReadTwice = true,
                      zeroOpenReadTwice = true,
                      exactPriorGestureTimeMatched = true
                    )
                  }
                } else false
                val savedReconciled437 = reconciled437 &&
                  pendingPrefs429.edit().putBoolean("attempted", false)
                    .remove("expectedPair429").remove("expectedPackage429")
                    .remove("expectedStakeCents429").remove("expectedPayout429")
                    .remove("expectedSide437").remove("attemptedAt429").commit()
                if (savedReconciled437) {
                  pendingReceipt429 = false
                  verifiedClosedDetail437 = null
                  verifiedClosedDetailAt437 = 0L
                }
                // Both writes must succeed. An uncertain broker gesture is
                // never cleared from persistent storage based on a chart-only
                // guess, page change, screenshot OCR or elapsed time alone.
                // 448: A screenshot showing ZERO open trades is NOT proof
                // that the historical Android gesture succeeded or failed.
                // Never erase a legacy SELL 404 attempt merely because the
                // OPEN tab is empty. It has no authenticated CLOSED receipt
                // in this flow; a genuine receipt-review must resolve it.
                // 454: The old unknown order must not block DEMO forever
                // after TWO explicit broker-confirmed zero-OPEN reads. When
                // the historical UUID cannot be recovered, permit a NEW
                // DEMO base-$1 cycle, but NEVER infer WIN/LOSS or apply MG.
                // A previously verified OPEN UUID, a recovery cycle, two
                // concurrent legacy markers, a non-base stake, or an
                // unverified DEMO account always keeps the lock intact.
                // This fallback does NOT call onVerifiedDemoClosed and
                // does NOT modify the recovery ledger.
                val unknownBaseEligible454 = !savedReconciled437 &&
                  verifiedClosedDetail437 == null &&
                  (oldShockAttempt || oldSellAttempt) &&
                  demoRecoveryLedger.verifiedOpenPositionId429() == null &&
                  !demoRecoveryLedger.isRecovering429() &&
                  demoRecoveryLedger.quote(92).stakeCents == 100L &&
                  (!oldShockAttempt || expectedStake429 == 100L) &&
                  reviewPackage != null && reviewPackage == verifiedDemoAccountPackage &&
                  TouchTestService.priorDemoGestureCooldownComplete()
                val unknownBaseCleared454 = if (unknownBaseEligible454) {
                  // Older builds may have left BOTH the SELL-404 and
                  // SHOCK-400 markers. After independently proven 0 OPEN 2/2,
                  // clear each persisted lock with durable commits; never
                  // rearm on a partial write, and never infer a P/L.
                  val shockCleared454 = if (oldShockAttempt)
                    pendingPrefs429.edit()
                      .putBoolean("attempted", false)
                      .remove("expectedPair429")
                      .remove("expectedPackage429")
                      .remove("expectedStakeCents429")
                      .remove("expectedPayout429")
                      .remove("expectedSide437")
                      .remove("attemptedAt429")
                      .remove("attemptedWallAt454")
                      .commit()
                  else true
                  val sellCleared454 = if (shockCleared454 && oldSellAttempt)
                    getSharedPreferences(sell404TestPrefs, Context.MODE_PRIVATE)
                      .edit().putBoolean("attempted", false).commit()
                  else !oldSellAttempt
                  shockCleared454 && sellCleared454
                } else false
                if (unknownBaseCleared454) pendingReceipt429 = false
                val savedOldSell = !oldSellAttempt || unknownBaseCleared454
                // 448: The older code cleared an incomplete/stale prior
                // SHOCK attempt whenever pendingReceipt429 was false (for
                // example, a missing expected pair or payout). That could
                // trigger a SECOND order without a verified WIN/LOSS.
                // Keep that attempt locked until the exact matching CLOSED
                // receipt is confirmed twice and persisted by the ledger.
                val savedOldShock = when {
                  unknownBaseCleared454 -> true
                  pendingReceipt429 -> true
                  oldShockAttempt && !savedReconciled437 -> false
                  oldShockAttempt -> getSharedPreferences(
                    autoShockAttemptPrefs, Context.MODE_PRIVATE
                  ).edit().putBoolean("attempted", false)
                    .remove("expectedPair429").remove("expectedPackage429")
                    .remove("expectedStakeCents429").remove("expectedPayout429")
                    .remove("expectedSide437").remove("attemptedAt429").commit()
                  else -> true
                }
                if (savedOldSell && savedOldShock) {
                  autoDemoSessionRequested = !pendingReceipt429
                  autoDemoSessionConsumed = pendingReceipt429
                  autoDemoEntryCycleStartedAt = if (!pendingReceipt429)
                    System.currentTimeMillis() else 0L
                  autoDemoArmed = false
                  autoDemoMarket = null
                  autoDemoExpiry = 0L
                  autoDemoLastPreflightAt = 0L
                  autoDemoLockedAt = lockedAt
                  sell404Diagnostic = null
                  autoDemoLastPreflightReason =
                    "0 POZIȚII DEMO CONFIRMATE • REVIN LA GRAFIC"
                  touchProbeStatus?.text = when {
                    unknownBaseCleared454 ->
                      "✅ 0 DESCHISE 2/2 • DEMO 1 USD REACTIVAT • FĂRĂ MG RETROACTIV"
                    savedReconciled437 && alreadySettled444 ->
                      "✅ ID ÎNCHIS REVERIFICAT • FĂRĂ DUBLU WIN/LOSS • DEMO REACTIVAT"
                    savedReconciled437 ->
                      "✅ ORDIN ÎNCHIS VERIFICAT 2/2 • DEMO REACTIVAT"
                    pendingReceipt429 ->
                      "🔒 0 POZIȚII DESCHISE • ID ANTERIOR NECONFIRMAT"
                    else -> "✅ QT DEMO 0 POZIȚII • VERIFICARE FINALIZATĂ"
                  }
                  lastDemoTradeStatus =
                    "QT DEMO • LISTĂ DESCHIS GOALĂ VERIFICATĂ 2/2"
                  lastAutoDemoHistoryNavStatus = ""
                  lastAutoDemoHistoryNavStatusAt = 0L
                  historyNavPending431 = false
                  historyNavPendingAt431 = 0L
                  historyNavFailed431 = 0
                  historyNavStalled431 = false
                  // 425: After independently proving ZERO Open positions,
                  // inspect the actual CLOSED tab before returning to chart.
                  // It is diagnostic ONLY: an empty Open tab cannot identify a
                  // matching WIN/LOSS or authorize any stake increase.
                  val provenPackage = reviewPackage
                  // 442: Do not click the CLOSED tab repeatedly for the
                  // same unresolved DEMO gesture. OCR and full-ID checks
                  // remain mandatory; this only reduces UI oscillation.
                  val pendingKey442 = listOf(
                    expectedPackage429.orEmpty(), expectedPair429.orEmpty(),
                    attemptedAt429.toString()
                  ).joinToString("|")
                  val scanRecently442 = pendingReceipt429 &&
                    lastClosedHistoryScanKey442 == pendingKey442 &&
                    lastClosedHistoryScanAt442 > 0L &&
                    tick - lastClosedHistoryScanAt442 in
                      0L until closedHistoryScanPauseMs442
                  // 454: Once two broker-proven ZERO-OPEN samples safely
                  // rearmed an unknown base-$1 DEMO cycle, do NOT re-open
                  // the same old CLOSED history. Return to the live chart.
                  closedHistoryInspectionInProgress =
                    !scanRecently442 && !unknownBaseCleared454
                  val navigation = if (unknownBaseCleared454)
                    "✅ QT DEMO 0 DESCHISE • REVIN LA GRAFIC • AUTO 1 USD"
                  else if (scanRecently442)
                    "ISTORIC DEMO • PAUZĂ REVERIFICARE • FĂRĂ ORDIN"
                  else TouchTestService.advanceDemoClosedHistoryNavigation(
                    cachedDemoVerifiedOnChart = verifiedDemoReview
                  )
                  if (pendingReceipt429 &&
                      navigation.startsWith("ISTORIC DEMO • DESCHID FILA ÎNCHIS")) {
                    lastClosedHistoryScanAt442 = tick
                    lastClosedHistoryScanKey442 = pendingKey442
                  }
                  lastAutoDemoHistoryNavStatus = navigation.take(105)
                  lastAutoDemoHistoryNavStatusAt = tick
                  if (navigation.startsWith("ISTORIC DEMO • DESCHID FILA ÎNCHIS")) {
                    mainHandler.postDelayed({
                      val verifiedSameDemo = !shuttingDown && mediaProjection != null &&
                        ((autoDemoSessionRequested && !autoDemoSessionConsumed) ||
                          pendingReceipt429) &&
                        provenPackage != null &&
                        TouchTestService.activeDemoExecutorPackageForReview() == provenPackage
                      if (verifiedSameDemo) {
                        val closedEvidenceFresh =
                          lastClosedTabVisualPackage == provenPackage &&
                          closedTabVisualConsecutive >= 2 &&
                          System.currentTimeMillis() - lastClosedTabVisualAt in 0L..5000L
                        val inspection = TouchTestService.inspectDemoClosedTradeEvidenceReadOnly(
                          cachedDemoVerifiedOnChart = true,
                          visuallySelectedClosedTab = closedEvidenceFresh
                        )
                        lastClosedInspectionDiagnostic = inspection.take(105)
                        lastClosedInspectionAt = android.os.SystemClock.elapsedRealtime()
                        // Save counts only, not broker IDs or account balances.
                        getSharedPreferences("scalp_atlas_live_diagnostics", Context.MODE_PRIVATE)
                          .edit().putString("closedHistoryInspection425",
                            lastClosedInspectionDiagnostic).apply()
                        touchProbeStatus?.text = "🔎 " + lastClosedInspectionDiagnostic
                        if (pendingReceipt429 && expectedPair429 != null)
                          TouchTestService.readDoubleVerifiedDemoReceipt429(
                            expectedPair = expectedPair429,
                            cachedDemoVerifiedOnChart = true,
                            closed = true,
                            selectedTabVerifiedVisually = closedEvidenceFresh
                          )
                        // 427: A second independent read of the SAME selected
                        // CLOSED tab must agree before P/L can be described as
                        // observed twice. Neither read authorizes a DEMO
                        // recovery order without a matching verified OPEN ID.
                        mainHandler.postDelayed({
                          if (!shuttingDown && mediaProjection != null &&
                              provenPackage != null &&
                              TouchTestService.activeDemoExecutorPackageForReview() == provenPackage) {
                            val secondFresh =
                              lastClosedTabVisualPackage == provenPackage &&
                              closedTabVisualConsecutive >= 2 &&
                              System.currentTimeMillis() - lastClosedTabVisualAt in 0L..5000L
                            val second = TouchTestService.inspectDemoClosedTradeEvidenceReadOnly(
                              cachedDemoVerifiedOnChart = true,
                              visuallySelectedClosedTab = secondFresh
                            )
                            lastClosedInspectionDiagnostic = second.take(105)
                            lastClosedInspectionAt = android.os.SystemClock.elapsedRealtime()
                            getSharedPreferences("scalp_atlas_live_diagnostics", Context.MODE_PRIVATE)
                              .edit().putString("closedHistoryInspection427",
                                lastClosedInspectionDiagnostic).apply()
                            touchProbeStatus?.text = "🔎 " + lastClosedInspectionDiagnostic
                            if (pendingReceipt429 && expectedPair429 != null &&
                                expectedPackage429 == provenPackage) {
                              val closedReceipt429 =
                                TouchTestService.readDoubleVerifiedDemoReceipt429(
                                  expectedPair = expectedPair429,
                                  cachedDemoVerifiedOnChart = true,
                                  closed = true,
                                  selectedTabVerifiedVisually = secondFresh
                                )
                              val closedNet429 = closedReceipt429?.netProfitCents
                              val sameVerifiedOpen429 =
                                closedReceipt429 != null && closedNet429 != null &&
                                closedReceipt429.brokerPackage == expectedPackage429 &&
                                closedReceipt429.positionId ==
                                  demoRecoveryLedger.verifiedOpenPositionId429() &&
                                closedReceipt429.stakeCents ==
                                  demoRecoveryLedger.verifiedOpenStakeCents429() &&
                                closedReceipt429.stakeCents == expectedStake429
                              val ledgerUpdated429 = if (sameVerifiedOpen429)
                                demoRecoveryLedger.onVerifiedDemoClosed(
                                  brokerAccountKey = "QT_DEMO:" + expectedPackage429,
                                  positionId = closedReceipt429!!.positionId,
                                  closedReceiptId = closedReceipt429!!.positionId + ":CLOSED",
                                  netProfitCents = closedNet429!!,
                                  receiptIndependentlyVerified = true
                                )
                              else false
                              if (ledgerUpdated429) {
                                // Persist exactly once; a restart must never
                                // replay the last physical Android order.
                                val cleared429 = pendingPrefs429.edit()
                                  .putBoolean("attempted", false)
                                  .remove("expectedPair429")
                                  .remove("expectedPackage429")
                                  .remove("expectedStakeCents429")
                                  .remove("expectedPayout429")
                                  .remove("attemptedAt429")
                                  .commit()
                                if (cleared429) {
                                  autoDemoSessionRequested = true
                                  autoDemoSessionConsumed = false
                                  autoDemoEntryCycleStartedAt = System.currentTimeMillis()
                                  autoDemoArmed = false
                                  autoDemoMarket = null
                                  autoDemoLastPreflightAt = 0L
                                  autoDemoLockedAt = lockedAt
                                  touchProbeStatus?.text = if (closedNet429!! < 0L)
                                    "✅ LOSS DEMO VERIFICAT • CALCULEZ MIZA URMĂTOARE"
                                  else "✅ WIN DEMO VERIFICAT • ACTUALIZEZ RECUPERAREA"
                                } else {
                                  autoDemoSessionRequested = false
                                  autoDemoSessionConsumed = true
                                  touchProbeStatus?.text =
                                    "BLOCAT: REZULTAT VERIFICAT, DAR BLOCAREA NU S-A SALVAT"
                                }
                              } else {
                                autoDemoSessionRequested = false
                                autoDemoSessionConsumed = true
                                touchProbeStatus?.text =
                                  "BLOCAT: ID OPEN/CLOSED SAU P/L NECONFIRMATE"
                              }
                            }
                            mainHandler.postDelayed({
                              if (!shuttingDown && mediaProjection != null &&
                                  TouchTestService.activeDemoExecutorPackageForReview() == provenPackage) {
                                // 442: Return to the chart after a CLOSED
                                // history review even when the old order is
                                // unresolved. Back is navigation only; the
                                // persistent unknown-ID lock stays intact.
                                returnToChartAfterReview458(
                                  true,
                                  historyPageVisible433 &&
                                    System.currentTimeMillis() - historyPageLastSeen433 in
                                      0L..5_000L
                                )
                              }
                              closedHistoryInspectionInProgress = false
                            }, 800L)
                          } else {
                            closedHistoryInspectionInProgress = false
                          }
                        }, 1800L)
                      } else {
                        closedHistoryInspectionInProgress = false
                      }
                    }, 7000L)
                  } else {
                    mainHandler.postDelayed({
                      if (!shuttingDown && mediaProjection != null &&
                          provenPackage != null &&
                          TouchTestService.activeDemoExecutorPackageForReview() == provenPackage) {
                        // 442: A failed or throttled CLOSED review must
                        // not keep the broker trapped in its history pane.
                        returnToChartAfterReview458(
                                  true,
                                  historyPageVisible433 &&
                                    System.currentTimeMillis() - historyPageLastSeen433 in
                                      0L..5_000L
                                )
                      }
                      closedHistoryInspectionInProgress = false
                    }, 750L)
                  }
                } else {
                  // 448: Only an authenticated, persisted settlement permits
                  // the NEXT independent SHOCK to submit another QT Demo
                  // order. Any legacy/incomplete prior attempt stays locked.
                  autoDemoSessionRequested = false
                  autoDemoSessionConsumed = true
                  autoDemoArmed = false
                  touchProbeStatus?.text = when {
                    oldSellAttempt -> "🔒 TEST SELL VECHI NECONFIRMAT • FĂRĂ ORDIN"
                    oldShockAttempt && !savedReconciled437 ->
                      "🔒 ID VECHI NECONFIRMAT • FĂRĂ ORDIN NOU"
                    else -> "BLOCAT: MEMORARE VERIFICARE INCOMPLETĂ"
                  }
                }
                demoEmptyReviewReads = 0
                demoEmptyReviewFirstAt = 0L
              }
            }
          } else {
            // 458: If the OPEN list remains unreadable for 45 seconds, leave
            // the history page. Never use an absent empty-list message to
            // infer zero active positions, close an order, or unlock MG.
            if (openReview458 && openTabFirstObservedAt458 > 0L &&
                nowReview - openTabFirstObservedAt458 >= 45_000L &&
                historyReturnPauseUntil457 <= nowReview &&
                nowReview - lastPerspectiveReturnAttempt457 >= 30_000L) {
              lastPerspectiveReturnAttempt457 = nowReview
              touchProbeStatus?.text = "🔒 ZERO DESCHISE NECONFIRMAT • " +
                returnToChartAfterReview458(
                  verifiedDemoReview, historyPageVisible433 &&
                    System.currentTimeMillis() - historyPageLastSeen433 in 0L..5_000L
                )
            }
            // 416: a temporarily unreadable frame is not a second proof;
            // preserve the first independent positive sample for <=20 sec.
            // An expired sample must never permit recovery.
            val tick = android.os.SystemClock.elapsedRealtime()
            if (demoEmptyReviewReads > 0 &&
                tick - demoEmptyReviewFirstAt > 20_000L) {
              demoEmptyReviewReads = 0
              demoEmptyReviewFirstAt = 0L
            }
            // 417: the user already explicitly enabled this one-shot
            // autonomous QT Demo session. Do not require them to navigate
            // Transactions > Deschis over and over: navigate ONLY to safe,
            // exact text-labelled history controls (never BUY/SELL).
            // Rate limit to avoid oscillation/reloading a first OCR sample.
            if (eligibleForBrokerEmptyReview && demoEmptyReviewReads == 0 &&
                !(pendingReceipt429 && historyPageTab433 == "ÎNCHIS" &&
                  verifiedClosedDetail437 == null) &&
                !(pendingReceipt429 && historyPageTab433 == "DETALIU ÎNCHIS")) {
              val navResult431 = navigateVerifiedDemoHistory431(
                verifiedDemoReview, tick
              )
              if (navResult431.isNotBlank())
                touchProbeStatus?.text = "🤖 " + navResult431.take(105)
            }
          }
        } else {
          // Never carry one broker/account's evidence to another.
          demoEmptyReviewReads = 0
          demoEmptyReviewFirstAt = 0L
          lastDemoTradeStatus = "BROKER/CONT SCHIMBAT • FĂRĂ REARMARE"
          lastAutoDemoHistoryNavStatus = ""
          lastAutoDemoHistoryNavStatusAt = 0L
          if (autoDemoArmed) {
            autoDemoArmed = false
            autoDemoMarket = null
            autoDemoExpiry = 0L
            // Scanning stays active; user switching back to verified Demo
            // will pass fresh independent preflight before any signal order.
          }
        }
        mainHandler.postDelayed(this, 2500L)
      }
    })
  }

  private fun startDemoClickMonitor() {
    if (demoClickMonitorRunning || !demoClickTestPending) return
    demoClickMonitorRunning = true
    mainHandler.post(object : Runnable {
      override fun run() {
        if (shuttingDown || !demoClickTestPending || mediaProjection == null ||
            overlayView == null) {
          if (demoClickTestPending && mediaProjection == null)
            touchProbeStatus?.text = "TEST DEMO: CAPTURĂ LIVE INDISPONIBILĂ"
          demoClickTestPending = false
          demoClickMonitorRunning = false
          return
        }
        val tick = android.os.SystemClock.elapsedRealtime()
        if (tick >= demoClickTestUntil) {
          demoClickTestPending = false
          demoClickMonitorRunning = false
          touchProbeStatus?.text = "TEST SELL: 5 MINUTE EXPIRATE • FĂRĂ ORDIN"
          return
        }
        val diagnostic = try {
          when {
            !TouchTestService.ready() ->
              TouchTestService.accessDiagnostic(this@ScalpOverlayService)
            else -> {
              val result = TouchTestService.preflightAnyPairDemoSell()
              if (!result.startsWith("GATA TEST SELL QT DEMO")) {
                result
              } else if (!tradePositionGate.beginAttempt()) {
                "BLOCAT: POZIȚIE NECONFIRMATĂ • FĂRĂ ORDIN"
              } else {
                demoClickTestPending = false
                autoDemoSessionConsumed = true
                // The test is permanently consumed before the broker is touched.
                val persisted = getSharedPreferences(
                  demoClickTestPrefs, Context.MODE_PRIVATE
                ).edit().putBoolean("attempted", true).commit()
                if (!persisted) {
                  tradePositionGate.uncertainResult()
                  "BLOCAT: NU POT MEMORA TESTUL • FĂRĂ CLIC"
                } else {
                  TouchTestService.pressAnyPairDemoSellOnce { callbackText ->
                    // Android accepted gesture != broker confirmed trade.
                    tradePositionGate.uncertainResult()
                    if (!shuttingDown) mainHandler.post {
                      touchProbeStatus?.text = "TEST SELL DEMO: " + callbackText.take(110)
                    }
                  }
                }
              }
            }
          }
        } catch (error: Exception) {
          android.util.Log.e("ScalpAtlasDemo398", "SELL DEMO verification failed", error)
          "BLOCAT: EROARE ANDROID " + error.javaClass.simpleName.take(24)
        }
        if (!shuttingDown) {
          touchProbeStatus?.text = "TEST SELL DEMO: " + diagnostic.take(114)
        }
        if (demoClickTestPending && !shuttingDown) {
          mainHandler.postDelayed(this, 1500L)
        } else {
          demoClickMonitorRunning = false
        }
      }
    })
  }

  /**
   * 396: READ-ONLY debit confirmation after the first one-shot DEMO BUY.
   *
   * Android can finish dispatchGesture while the Pocket Option WebView has
   * not yet exposed its refreshed USD balance to Accessibility. 395 performed
   * ONE read after 10 seconds and aborted SELL even when the next screenshot
   * showed exactly -$1. This polling does not touch the broker and never
   * re-issues BUY. It times out after 70 seconds or on any pair change.
   *
   * SELL remains a separate once-only guarded action strictly after the
   * configured 5-minute expiry + a 35-second margin. A balance debit is
   * supporting evidence, NOT proof of an opened or closed broker trade.
   */
  private fun verifyBuyDebitThenQueueSell(
    startingBalance: Double, expectedPair: String, buyGestureDoneAt: Long
  ) {
    val timeoutAt = buyGestureDoneAt + 70_000L
    mainHandler.postDelayed(object : Runnable {
      override fun run() {
        if (shuttingDown || mediaProjection == null ||
            overlayView == null || !TouchTestService.ready()) {
          touchProbeStatus?.text = "SELL BLOCAT: LIVE/ANDROID OPRIT"
          return
        }
        if (TouchTestService.readVisibleDemoPair() != expectedPair) {
          touchProbeStatus?.text = "SELL BLOCAT: PERECHEA DEMO S-A SCHIMBAT"
          return
        }
        val afterBuy = TouchTestService.readVerifiedDemoBalance()
        val diff = afterBuy?.let { startingBalance - it }
        if (afterBuy != null && diff != null && kotlin.math.abs(diff - 1.0) <= 0.03) {
          touchProbeStatus?.text =
            "DEBIT BUY 1 USD OBSERVAT • VERIFICĂ TRANZACȚII → DESCHIS"
          // Schedule against the original gesture, not the final balance
          // polling iteration: no early SELL and no repeated orders.
          val elapsed = android.os.SystemClock.elapsedRealtime() - buyGestureDoneAt
          val untilSell = (340_000L - elapsed).coerceAtLeast(0L)
          mainHandler.postDelayed({
            if (shuttingDown || mediaProjection == null ||
                overlayView == null || !TouchTestService.ready()) {
              touchProbeStatus?.text = "SELL BLOCAT: LIVE/ANDROID OPRIT"
            } else {
              val prefs = getSharedPreferences(
                demoClickTestPrefs, Context.MODE_PRIVATE
              )
              if (prefs.getBoolean("sell_attempted", false)) {
                touchProbeStatus?.text = "SELL DEJA ÎNCERCAT • FĂRĂ REPETARE"
              } else if (!prefs.edit()
                  .putBoolean("sell_attempted", true).commit()) {
                touchProbeStatus?.text =
                  "SELL BLOCAT: NU POT SALVA LIMITA ORDINULUI"
              } else {
                val result = try {
                  TouchTestService.pressVerifiedFollowupDemoSell(
                    startingBalance, afterBuy, expectedPair
                  ) { callback ->
                    if (!shuttingDown) mainHandler.post {
                      touchProbeStatus?.text =
                        "TEST SELL DEMO: " + callback.take(108)
                    }
                  }
                } catch (error: Exception) {
                  android.util.Log.e(
                    "ScalpAtlasDemo396", "SELL after expiry blocked", error
                  )
                  "SELL BLOCAT: EROARE ANDROID • FĂRĂ REPETARE"
                }
                touchProbeStatus?.text = "TEST SELL DEMO: " + result.take(108)
              }
            }
          }, untilSell)
          return
        }
        val now = android.os.SystemClock.elapsedRealtime()
        if (now < timeoutAt) {
          val observed = afterBuy?.toString() ?: "NECITIT"
          touchProbeStatus?.text =
            "VERIFIC BUY • SOLD INIȚIAL " + startingBalance +
              " • ACUM " + observed + " • FĂRĂ ALT CLIC"
          mainHandler.postDelayed(this, 5_000L)
        } else {
          touchProbeStatus?.text =
            "SELL BLOCAT: BUY NEVALIDAT DUPĂ 70 SEC • FĂRĂ REPETARE"
        }
      }
    }, 7_000L)
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

  /** A violet halo with a magenta nebula and starlight traveling along the rim. */
  private class TravelingNeonEdge434(private val density: Float) :
    android.graphics.drawable.Drawable() {
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.FILL
      color = Color.rgb(249, 250, 250)
    }
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeCap = Paint.Cap.ROUND
      strokeJoin = Paint.Join.ROUND
    }
    private val starPosition = FloatArray(2)
    var progress = 0f
      set(value) {
        field = value
        invalidateSelf()
      }

    override fun draw(canvas: Canvas) {
      if (bounds.width() < 12 || bounds.height() < 12) return
      val outer = RectF(bounds)
      val radius = 18f * density
      canvas.drawRoundRect(outer, radius, radius, fill)
      // Glow is inset, so Android never clips the luminous border outside
      // the real 176dp overlay window or shifts the user's drag target.
      val inset = 4f * density
      val inner = RectF(outer).apply { inset(inset, inset) }
      val corner = (radius - inset).coerceAtLeast(3f * density)
      stroke.strokeWidth = 7f * density
      stroke.color = Color.argb(72, 138, 55, 255)
      canvas.drawRoundRect(inner, corner, corner, stroke)
      stroke.strokeWidth = 1.8f * density
      stroke.color = Color.rgb(125, 56, 207)
      canvas.drawRoundRect(inner, corner, corner, stroke)

      val perimeter = Path().apply {
        addRoundRect(inner, corner, corner, Path.Direction.CW)
      }
      val measure = PathMeasure(perimeter, true)
      val total = measure.length
      if (total <= 0f) return
      // The moving glow blends from violet to magenta and pale lavender.
      val tail = total * 0.28f
      val head = ((progress % 1f) + 1f) % 1f * total
      val steps = 16
      for (i in 0 until steps) {
        val from = ((head - tail + (i.toFloat() / steps) * tail) % total +
          total) % total
        val next = from + tail / steps + 0.35f * density
        val segment = Path()
        if (next <= total) {
          measure.getSegment(from, next, segment, true)
        } else {
          measure.getSegment(from, total, segment, true)
          measure.getSegment(0f, next - total, segment, true)
        }
        val t = i.toFloat() / (steps - 1)
        stroke.color = Color.argb((35 + 115 * t).toInt(), 164, 55, 255)
        stroke.strokeWidth = 7.5f * density
        canvas.drawPath(segment, stroke)
        stroke.color = Color.argb((90 + 165 * t).toInt(), (167 + 88 * t).toInt(), 68, 230)
        stroke.strokeWidth = 3.5f * density
        canvas.drawPath(segment, stroke)
        stroke.color = Color.argb((130 + 125 * t).toInt(), (202 + 53 * t).toInt(), (112 + 120 * t).toInt(), 255)
        stroke.strokeWidth = 1.7f * density
        canvas.drawPath(segment, stroke)
      }
      stroke.strokeWidth = 1.5f * density
      for (i in 0 until 4) {
        val distance = (head + total - tail * i * 0.19f) % total
        measure.getPosTan(distance, starPosition, null)
        stroke.color = Color.argb(255 - 42 * i, 255, 235, 255)
        canvas.drawPoint(starPosition[0], starPosition[1], stroke)
      }
    }

    override fun setAlpha(alpha: Int) {
      fill.alpha = alpha
      invalidateSelf()
    }
    override fun setColorFilter(colorFilter: ColorFilter?) {
      fill.colorFilter = colorFilter
      stroke.colorFilter = colorFilter
      invalidateSelf()
    }
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
  }

  private var neonEdgeDrawable434: TravelingNeonEdge434? = null
  private var neonEdgeAnimator434: ValueAnimator? = null

  private fun startNeonEdge434() {
    neonEdgeAnimator434?.cancel()
    neonEdgeAnimator434 = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = 3200L
      repeatCount = ValueAnimator.INFINITE
      interpolator = LinearInterpolator()
      addUpdateListener { frame ->
        neonEdgeDrawable434?.progress = frame.animatedValue as Float
      }
      start()
    }
  }

  private fun stopNeonEdge434() {
    neonEdgeAnimator434?.cancel()
    neonEdgeAnimator434 = null
    neonEdgeDrawable434 = null
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
    // The miniature stays in place, but candle body/wicks react to NEW
    // captured pixels. Never animate prices without incoming frames.
    var bodyPx: Int = 24
    var topWickPx: Int = 8
    var bottomWickPx: Int = 8
    fun updateObserved(body: Int, upper: Int, lower: Int) {
      bodyPx = body.coerceIn(5, 200)
      topWickPx = upper.coerceIn(0, 150)
      bottomWickPx = lower.coerceIn(0, 150)
      invalidate()
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
      val scale = height * 0.65f / max(70f, (bodyPx + topWickPx + bottomWickPx).toFloat())
      val bodyHeight = (bodyPx * scale).coerceIn(height * 0.13f, height * 0.58f)
      val topWick = (topWickPx * scale).coerceIn(0f, height * 0.16f)
      val bottomWick = (bottomWickPx * scale).coerceIn(0f, height * 0.16f)
      val bodyTop = height * 0.5f - bodyHeight * 0.5f
      val bodyBottom = bodyTop + bodyHeight
      canvas.drawLine(cx, bodyTop - topWick, cx, bodyBottom + bottomWick, p)
      p.style = Paint.Style.FILL
      canvas.drawRoundRect(
        width * 0.29f, bodyTop, width * 0.71f, bodyBottom,
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

  // Variant 3 mini trend: plot observed three CLOSED candle closes.
  // Without data the graph does NOT simulate a rising/falling direction.
  private class MiniTrendView(context: Context) : View(context) {
    private var points = floatArrayOf()
    private var direction = "NONE"
    fun showData(values: FloatArray, trend: String) {
      points = values.copyOf()
      direction = trend
      invalidate()
    }
    override fun onDraw(canvas: Canvas) {
      super.onDraw(canvas)
      val w = width.toFloat()
      val h = height.toFloat()
      val guide = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(75, 94, 120)
        strokeWidth = 1.2f
      }
      canvas.drawLine(w * .06f, h * .70f, w * .94f, h * .70f, guide)
      if (points.size < 3) return
      val tone = when(direction) {
        "BUY" -> Color.rgb(35, 212, 116)
        "SELL" -> Color.rgb(242, 84, 91)
        else -> Color.rgb(156, 171, 189)
      }
      val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = tone
        style = Paint.Style.STROKE
        strokeWidth = 2.7f
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
      }
      val plot = Path()
      points.forEachIndexed { i, v ->
        val x = w * (.08f + .84f * i / (points.size - 1))
        val y = h * (.12f + .75f * v.coerceIn(0f,100f) / 100f)
        if (i==0) plot.moveTo(x,y) else plot.lineTo(x,y)
      }
      canvas.drawPath(plot,line)
      // Finishes with an arrow aligned to the observed last segment.
      val last=points.last().coerceIn(0f,100f)
      val penult=points[points.size-2].coerceIn(0f,100f)
      val endX=w*.92f
      val endY=h*(.12f+.75f*last/100f)
      val dx=w*.84f/(points.size-1)
      val dy=h*.75f*(last-penult)/100f
      val len=kotlin.math.sqrt(dx*dx+dy*dy).coerceAtLeast(1f)
      val ux=dx/len
      val uy=dy/len
      val wing=6f
      val arrow=Path().apply {
        moveTo(endX-ux*wing-uy*wing*.7f,endY-uy*wing+ux*wing*.7f)
        lineTo(endX,endY)
        lineTo(endX-ux*wing+uy*wing*.7f,endY-uy*wing-ux*wing*.7f)
      }
      canvas.drawPath(arrow,line)
    }
  }

  private var trendMiniView: MiniTrendView? = null
  private var trendPercentLabel: TextView? = null
  private var trendDirectionLabel: TextView? = null
  private var candleGraphic: ShockCandleView? = null
  private var qualityText: TextView? = null
  private var shockDurationText: TextView? = null
  private var shockReasonText: TextView? = null
  private var signalGateNote: TextView? = null
  // 451: compact, read-only Martingale state; never triggers a broker gesture.
  private var martingaleStatusText: TextView? = null
  private var wickText: TextView? = null
  private var signalBlinkAnimator: ValueAnimator? = null
  private var signalBlinkDirection = "NONE"
  private fun stopSignalBlink() {
    signalBlinkAnimator?.cancel()
    signalBlinkAnimator = null
    signalBlinkDirection = "NONE"
    signalText?.alpha = 1f
  }
  private fun setSignalBlink(direction: String) {
    val next = if (direction == "BUY" || direction == "SELL") direction else "NONE"
    if (next == signalBlinkDirection) return
    stopSignalBlink()
    if (next == "NONE") return
    signalBlinkDirection = next
    // Full visible -> dim -> visible cycle = 1500ms.
    signalBlinkAnimator = ValueAnimator.ofFloat(1f, 0.08f, 1f).apply {
      duration = 1500L
      repeatCount = ValueAnimator.INFINITE
      interpolator = LinearInterpolator()
      addUpdateListener { animator ->
        val now = System.currentTimeMillis()
        val safe = signalBlinkDirection == next && lockedDir == next &&
          now < lockedUntil && analyzerReady &&
          lastCapturedImageAt > 0L && now-lastCapturedImageAt in 0L..3500L &&
          pairReady(now) && !manualTfConflict &&
          (!tfAutomatic || (tfVerified && now-confirmedTfAt in 0L..TF_STALE_MS))
        if (!safe) stopSignalBlink()
        else signalText?.alpha = animator.animatedValue as Float
      }
      start()
    }
  }
  private var captureStatusText: TextView? = null
  private var liveCameraDot: View? = null
  private var liveCameraAnimator: ValueAnimator? = null
  private var liveCameraDotActive = false
  private var signalRing: LinearLayout? = null

  // Purple camera-live LED: subtle soft halo + one pulse per second.
  // Only recent captured/analyzed frames enable this visual indicator.
  private fun stopLiveCameraDot() {
    liveCameraDotActive = false
    liveCameraAnimator?.cancel()
    liveCameraAnimator = null
    liveCameraDot?.alpha = 1f
    liveCameraDot?.scaleX = 1f
    liveCameraDot?.scaleY = 1f
    liveCameraDot?.visibility = View.GONE
  }

  private fun setLiveCameraDotActive(active: Boolean) {
    if (!active) {
      if (liveCameraDotActive) stopLiveCameraDot()
      return
    }
    if (liveCameraDotActive) return
    liveCameraDotActive = true
    liveCameraDot?.apply {
      visibility = View.VISIBLE
      alpha = 0.55f
      scaleX = 0.90f
      scaleY = 0.90f
    }
    liveCameraAnimator = ValueAnimator.ofFloat(0.55f, 1f, 0.55f).apply {
      duration = 1000L  // one full pulse per second
      repeatCount = ValueAnimator.INFINITE
      interpolator = LinearInterpolator()
      addUpdateListener { animator ->
        val now = System.currentTimeMillis()
        // No purple LIVE glow over an old/frozen capture.
        val streamFresh = analyzerReady && lastCapturedImageAt > 0L &&
          now - lastCapturedImageAt in 0L..3500L &&
          lastAnalysisResultAt > 0L && now - lastAnalysisResultAt in 0L..5000L
        if (!streamFresh) stopLiveCameraDot()
        else {
          val bright = animator.animatedValue as Float
          liveCameraDot?.alpha = bright
          // Gentle breathing glow, not a directional trading alert.
          val size = 0.90f + (bright - 0.55f) / 0.45f * 0.22f
          liveCameraDot?.scaleX = size
          liveCameraDot?.scaleY = size
        }
      }
      start()
    }
  }

  private fun createOverlay() {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(9), dp(6), dp(9), dp(8))
      // 434: border LED stays on in compact and expanded modes.
      // It replaces only the white CARD drawable, not the broker overlay UI.
      neonEdgeDrawable434 = TravelingNeonEdge434(resources.displayMetrics.density)
      background = neonEdgeDrawable434
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
    close.visibility = View.VISIBLE // Small X immediately ends LIVE, capture and any robot arm.
    header.addView(close, LinearLayout.LayoutParams(dp(30), dp(28)))
    // 467: User-approved miniature brain (transparent blue glow and tiny stars).
    // Visual-only: the animation cannot arm, signal, or place broker orders.
    val rotatingBrain467 = ImageView(this).apply {
      setImageResource(R.drawable.scalp_brain)
      scaleType = ImageView.ScaleType.FIT_CENTER
      contentDescription = "Creier Scalp Atlas luminos, rotire continuă"
      cameraDistance = dp(1000).toFloat()
      isClickable = false
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    val brainEclipse = android.widget.FrameLayout(this).apply {
      val corona = View(this@ScalpOverlayService).apply {
        background = GradientDrawable().apply {
          shape = GradientDrawable.OVAL
          gradientType = GradientDrawable.RADIAL_GRADIENT
          gradientRadius = dp(14).toFloat()
          colors = intArrayOf(Color.rgb(14, 15, 37), Color.rgb(25, 24, 53), Color.rgb(185, 85, 24))
          setStroke(dp(1), Color.rgb(255, 193, 75))
        }
      }
      addView(corona, android.widget.FrameLayout.LayoutParams(dp(28), dp(28), Gravity.CENTER))
      addView(rotatingBrain467, android.widget.FrameLayout.LayoutParams(dp(24), dp(24), Gravity.CENTER))
    }
    header.addView(brainEclipse, LinearLayout.LayoutParams(dp(35), dp(28)))
    rotatingBrainAnimator467?.cancel()
    rotatingBrainAnimator467 = android.animation.ObjectAnimator.ofFloat(
      rotatingBrain467, "rotationY", 0f, 360f
    ).apply {
      duration = 6200L
      repeatCount = ValueAnimator.INFINITE
      repeatMode = ValueAnimator.RESTART
      interpolator = LinearInterpolator()
      start()
    }
    val headerGap = View(this)
    header.addView(headerGap, LinearLayout.LayoutParams(0, dp(1), 1f))
    val compactStatus = TextView(this).apply {
      text = "ȘOC —%"
      textSize = 13f
      gravity = Gravity.CENTER
      setTextColor(Color.rgb(74, 93, 106))
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      maxLines = 1
      contentDescription = "Stare ȘOC live. Ține apăsat și mută suprapunerea."
    }
    compactStatusText = compactStatus
    header.addView(compactStatus, LinearLayout.LayoutParams(0, dp(28), 1f))
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
    val testBipControl = TextView(this).apply {
      text = "TEST BIP"
      textSize = 10f
      gravity = Gravity.CENTER
      setTextColor(Color.rgb(53, 97, 120))
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      contentDescription = "Test audio original ScalpAtlas; NU este semnal de tranzacționare"
      setOnClickListener {
        // Audible diagnostics only: no journal entry, direction change,
        // signal confirmation or trading action.
        playTestBip()
      }
    }
    // Optional broker-screen OVERLAY TEST controls, disabled by default.
    // These buttons update this overlay only; they never tap or interact
    // with Pocket Option's underlying buttons or send broker orders.
    // The broker's currency selector must remain visible above the test card.
    // In PROBĂ mode hide the live visualization and show only essential
    // controls; keep risky or seldom-used tests inside MAI MULT.
    var probeModeActive = false
    var extraTestControlsVisible = false
    var moreTestsToggle: TextView? = null
    var hiddenBody: View? = null
    var hiddenTrend: View? = null
    var hiddenNote: View? = null
    var moreTestsRow: View? = null
    val touchProbeToggle = TextView(this).apply {
      text = "PROBĂ"
      textSize = 9f
      gravity = Gravity.CENTER
      setTextColor(Color.rgb(68, 99, 126))
      contentDescription = "Arată sau ascunde testul BUY SELL pe suprapunere"
      setOnClickListener {
        val visible = touchProbeRow?.visibility != View.VISIBLE
        probeModeActive = visible
        extraTestControlsVisible = false
        moreTestsToggle?.text = "MAI MULT ▸"
        touchProbeRow?.visibility = if (visible) View.VISIBLE else View.GONE
        touchProbeCommandRow?.visibility = if (visible) View.VISIBLE else View.GONE
        touchProbeStatus?.visibility = if (visible) View.VISIBLE else View.GONE
        onePairEvalRow?.visibility = if (visible) View.VISIBLE else View.GONE
        // Keep the one pilot control visible when the diagnostic screen
        // is toggled, instead of silently cancelling the robot.
        autoDemoRow?.visibility = View.VISIBLE
        demoBrokerInspectionRow?.visibility = if (visible) View.VISIBLE else View.GONE
        moreTestsRow?.visibility = if (visible) View.VISIBLE else View.GONE
        calculatorTestRow?.visibility = View.GONE
        demoBrokerOrderRow?.visibility = View.GONE
        demoAmountCheckRow?.visibility = View.GONE
        // Hide the large candle/trend panel WHILE testing, instead of
        // covering the pair selector or underlying broker chart.
        hiddenBody?.visibility = if (visible) View.GONE else View.VISIBLE
        hiddenTrend?.visibility = if (visible) View.GONE else View.VISIBLE
        hiddenNote?.visibility = if (visible) View.GONE else View.VISIBLE
        if (!visible) {
          onePairEvalEnabled = false
          onePairEvalPair = null
          onePairEvalButton?.text = "AUTO SIM OFF"
          // Closing old PROBĂ controls is not the AUTO DEMO OFF action.
        }
        lastRobotConnectionDiagnostic = if (visible)
          TouchTestService.accessDiagnostic(this@ScalpOverlayService) else null
        touchProbeStatus?.text = lastRobotConnectionDiagnostic ?: ""
        if (visible) {
          // Shift the card upward if its expanded test controls would go
          // below the screen edge. This prevents tap-through at the edge.
          root.post {
            val window = overlayWindowParams ?: return@post
            // Keep test targets in the chart region, well above the
            // broker's bottom trade controls even if user dragged the card.
            val screenHeight = resources.displayMetrics.heightPixels
            // Keep the entire expanded test card below the broker asset
            // selector, and above the underlying broker BUY/SELL area.
            val freeAssetHeaderTop = (screenHeight * 0.20f).toInt()
            val maxTop = ((screenHeight * 0.76f).toInt() - root.height -
              dp(18)).coerceAtLeast(0)
            val targetTop = if (maxTop >= freeAssetHeaderTop)
              window.y.coerceIn(freeAssetHeaderTop, maxTop) else maxTop
            window.x = dp(8)
            window.y = targetTop
            try { windowManager.updateViewLayout(root, window) } catch (_: Throwable) {}
          }
        }
      }
    }
    header.addView(touchProbeToggle, LinearLayout.LayoutParams(dp(42), dp(28)))
    header.addView(testBipControl, LinearLayout.LayoutParams(dp(55), dp(28)))
    bellControl?.visibility = View.GONE // No ON/OFF controls on the floating status panel.
    header.addView(bellControl, LinearLayout.LayoutParams(dp(30), dp(28)))
    val minimizeToggle = TextView(this).apply {
      text = "+"
      textSize = 22f
      gravity = Gravity.CENTER
      setTextColor(Color.rgb(54, 92, 121))
      contentDescription = "Extinde Scalp Atlas"
    }
    header.addView(minimizeToggle, LinearLayout.LayoutParams(dp(28), dp(28)))
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
    val liveStatusRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      setPadding(0, dp(3), 0, 0)
    }
    liveCameraDot = View(this).apply {
      background = GradientDrawable(
        GradientDrawable.Orientation.TL_BR,
        intArrayOf(Color.rgb(213, 177, 255), Color.rgb(141, 73, 214))
      ).apply {
        shape = GradientDrawable.OVAL
        setStroke(dp(2), Color.rgb(206, 178, 244))
      }
      visibility = View.GONE
      contentDescription = "Lumină purpurie pulsatorie pentru captură LIVE"
    }
    liveStatusRow.addView(liveCameraDot, LinearLayout.LayoutParams(dp(13), dp(13)).apply {
      marginEnd = dp(4)
    })
    captureStatusText?.setPadding(0, 0, 0, 0)
    captureStatusText?.let { liveStatusRow.addView(it) }
    candleColumn.addView(liveStatusRow)
    body.addView(candleColumn, LinearLayout.LayoutParams(dp(79), dp(106)))
    val spacing = View(this)
    body.addView(spacing, LinearLayout.LayoutParams(dp(7), dp(1)))

    pulseRingDrawable = ShockPulseDrawable(dp(4).toFloat())
    signalRing = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      background = pulseRingDrawable
    }
    val shockHeader = TextView(this).apply {
      text = "ȘOC"
      textSize = 10f
      gravity = Gravity.CENTER
      setTextColor(Color.rgb(108, 121, 131))
      setTypeface(typeface, android.graphics.Typeface.BOLD)
    }
    qualityText = TextView(this).apply {
      text = "—%"
      setTextColor(Color.rgb(105, 120, 126))
      textSize = 23f
      gravity = Gravity.CENTER
      includeFontPadding = false
      setTypeface(typeface, android.graphics.Typeface.BOLD)
    }
    shockDurationText = TextView(this).apply {
      text = "— s"
      setTextColor(Color.rgb(90, 104, 114))
      textSize = 12f
      gravity = Gravity.CENTER
      includeFontPadding = false
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      maxLines = 1
    }
    signalText = TextView(this).apply {
      text = "AȘTEAPTĂ"
      setTextColor(Color.rgb(105, 120, 126))
      textSize = 11f
      gravity = Gravity.CENTER
      includeFontPadding = false
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      setPadding(0, 0, 0, 0)
      maxLines = 1
    }
    wickText = TextView(this).apply {
      text = "FITIL —%"
      setTextColor(Color.rgb(105, 120, 126))
      textSize = 10f
      gravity = Gravity.CENTER
      maxLines = 1
    }
    shockReasonText = TextView(this).apply {
      text = "URMĂRESC"
      textSize = 9f
      maxLines = 1
      gravity = Gravity.CENTER
      setTextColor(Color.rgb(105, 120, 126))
    }
    strategyHeaderText = shockHeader
    signalRing?.addView(shockHeader)
    signalRing?.addView(qualityText)
    // Put the direction at the visual CENTER, never along the bottom rim.
    signalRing?.addView(signalText)
    signalRing?.addView(shockDurationText)
    // FITIL and SUB-threshold labels stay in diagnostic logic,
    // never clutter the small circle.
    body.addView(signalRing, LinearLayout.LayoutParams(dp(109), dp(109)))
    root.addView(body)
    hiddenBody = body

    val trendRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(5), dp(2), dp(5), dp(2))
      background = rounded(Color.rgb(17, 31, 52), Color.rgb(50, 73, 99))
    }
    trendMiniView = MiniTrendView(this).also {
      trendRow.addView(it, LinearLayout.LayoutParams(dp(95), dp(42)))
    }
    val trendColumn = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(4), 0, 0, 0)
    }
    trendColumn.addView(TextView(this).apply {
      text = "PANTĂ TREND"
      textSize = 9f
      setTextColor(Color.rgb(190, 206, 225))
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      maxLines = 1
    })
    trendPercentLabel = TextView(this).apply {
      text = "—%"
      textSize = 17f
      setTextColor(Color.rgb(190, 206, 225))
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      maxLines = 1
    }.also {trendColumn.addView(it)}
    trendDirectionLabel = TextView(this).apply {
      text = "NECONFIRMAT"
      textSize = 9f
      setTextColor(Color.rgb(190, 206, 225))
      maxLines = 1
    }.also {trendColumn.addView(it)}
    trendRow.addView(trendColumn, LinearLayout.LayoutParams(0, dp(48), 1f))
    root.addView(trendRow)
    hiddenTrend = trendRow

    val note = TextView(this).apply {
      text = "ȘOC = RETRAGERE LUMÂNARE • NU WIN"
      setTextColor(Color.rgb(105, 111, 117))
      textSize = 8f
      gravity = Gravity.CENTER
      maxLines = 1
      setPadding(0, dp(4), 0, 0)
    }
    root.addView(note)
    hiddenNote = note
    signalGateNote = note

    // Android 350: opt-in virtual gestures sent exclusively to Scalp Atlas's
    // own visible overlay test targets. No broker-button coordinates, no
    // signal-driven execution, and no trade order transmission.
    val probeRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      visibility = View.GONE
      setPadding(0, dp(4), 0, 0)
    }
    val commandRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      visibility = View.GONE
      setPadding(0, dp(5), 0, 0)
    }
    val probeStatus = TextView(this).apply {
      text = "ROBOT OPRIT • TEST EXCLUSIV QT DEMO"
      textSize = 10f
      gravity = Gravity.CENTER
      visibility = View.GONE
      setTextColor(Color.rgb(97, 110, 117))
      maxLines = 3
      setPadding(dp(4), dp(4), dp(4), dp(3))
    }
    var pendingVirtualSide: String? = null
    var touchDownObserved = false
    fun localButton(label: String, color: Int): TextView =
      TextView(this).apply {
        text = label
        textSize = 10f
        gravity = Gravity.CENTER
        setTextColor(Color.WHITE)
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        background = rounded(color, color)
        contentDescription = "Zonă Scalp Atlas " + label + " de probă, fără ordine în broker"
      }
    val targetBuy = localButton("ZONĂ BUY", Color.rgb(17, 129, 76))
    val targetSell = localButton("ZONĂ SELL", Color.rgb(182, 48, 66))
    fun receivedProbeClick(side: String) {
      val virtual = pendingVirtualSide == side
      val automatic = onePairEvalAutoPending
      pendingVirtualSide = null
      onePairEvalAutoPending = false
      probeStatus.text = if (virtual)
        (if (automatic) "AUTO SIM " + side + " CONFIRMAT • FĂRĂ ORDIN"
        else "SUCCES: ATINGERE VIRTUALĂ " + side + " • FĂRĂ ORDIN")
      else "TEST MANUAL " + side + " • FĂRĂ ORDIN"
    }
    targetBuy.setOnTouchListener { _, event ->
      if (event.actionMasked == MotionEvent.ACTION_DOWN && pendingVirtualSide == "BUY") {
        touchDownObserved = true
        probeStatus.text = "BUY: GESTUL A AJUNS LA ZONĂ"
      }
      false
    }
    targetSell.setOnTouchListener { _, event ->
      if (event.actionMasked == MotionEvent.ACTION_DOWN && pendingVirtualSide == "SELL") {
        touchDownObserved = true
        probeStatus.text = "SELL: GESTUL A AJUNS LA ZONĂ"
      }
      false
    }
    targetBuy.setOnClickListener { receivedProbeClick("BUY") }
    targetSell.setOnClickListener { receivedProbeClick("SELL") }
    probeRow.addView(targetBuy,
      LinearLayout.LayoutParams(0, dp(31), 1f).apply { marginEnd = dp(5) })
    probeRow.addView(targetSell, LinearLayout.LayoutParams(0, dp(31), 1f))

    fun testVirtualTouch(side: String, target: TextView, automatic: Boolean = false) {
      val rootWindow = overlayView
      if (pendingVirtualSide != null) {
        probeStatus.text = "TEST ÎN CURS • NU DUBLA COMANDA"
        return
      }
      if (!TouchTestService.ready()) {
        probeStatus.text = TouchTestService.accessDiagnostic(this)
        lastRobotConnectionDiagnostic = probeStatus.text.toString()
        return
      }
      if (rootWindow == null || touchProbeRow?.visibility != View.VISIBLE) {
        probeStatus.text = "DESCHIDE PROBĂ PENTRU TESTUL ROBOTULUI"
        return
      }
      val diagnostic = TouchTestService.checkOverlayTarget(rootWindow, target)
      if (!diagnostic.ready) {
        probeStatus.text = diagnostic.reason
        return
      }
      pendingVirtualSide = side
      onePairEvalAutoPending = automatic
      touchDownObserved = false
      probeStatus.text = (if (automatic) "AUTO SIM " else "SIM ") +
        side + ": COMANDĂ PRIMITĂ"
      val accepted = TouchTestService.tapVisibleOwnOverlayTarget(rootWindow, target) { completed ->
        // dispatchGesture.onCompleted proves delivery to the touch layer,
        // NOT that the intended View received an onClick event. Allow
        // the UI event loop to process the click before declaring failure.
        if (!completed) {
          if (pendingVirtualSide == side) {
            pendingVirtualSide = null
            onePairEvalAutoPending = false
            probeStatus.text = "GEST ANULAT • REPETĂ TESTUL"
          }
        } else {
          mainHandler.postDelayed({
            if (pendingVirtualSide == side) {
              pendingVirtualSide = null
              onePairEvalAutoPending = false
              probeStatus.text = if (touchDownObserved)
                "GEST AJUNS LA " + side + ", DAR FĂRĂ CLICK"
              else "GEST TRIMIS, DAR FĂRĂ ATINGERE " + side
            }
          }, 500L)
        }
      }
      if (!accepted) {
        pendingVirtualSide = null
        onePairEvalAutoPending = false
        probeStatus.text = "GEST REFUZAT DE ANDROID • FĂRĂ ORDIN"
      }
    }
    fun testCommand(label: String, side: String, target: TextView, color: Int): TextView =
      localButton(label, color).apply {
        contentDescription = "Trimite un gest Android către zona de probă " + side + " Scalp Atlas"
        setOnClickListener { testVirtualTouch(side, target) }
      }
    commandRow.addView(testCommand("SIM BUY", "BUY", targetBuy, Color.rgb(19, 92, 66)),
      LinearLayout.LayoutParams(0, dp(31), 1f).apply { marginEnd = dp(5) })
    commandRow.addView(testCommand("SIM SELL", "SELL", targetSell, Color.rgb(122, 44, 61)),
      LinearLayout.LayoutParams(0, dp(31), 1f))
    root.addView(commandRow)
    root.addView(probeRow)
    // Explicit opt-in. Lock exactly one verified pair for automated SELF test.
    // Every confirmed new BIP is translated to one gesture on ZONĂ BUY/SELL.
    // No screen coordinates, broker buttons, or transaction APIs are used.
    val evaluationRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      visibility = View.GONE
      setPadding(0, dp(5), 0, 0)
    }
    val evaluationButton = localButton("AUTO SIM OFF", Color.rgb(63, 88, 109)).apply {
      textSize = 10f
      contentDescription = "Activează sau dezactivează testul automat pe o singură pereche fără ordine"
      setOnClickListener {
        if (onePairEvalEnabled) {
          onePairEvalEnabled = false
          onePairEvalPair = null
          text = "AUTO SIM OFF"
          probeStatus.text = "AUTO SIM OPRIT • FĂRĂ ORDINE"
        } else {
          val now = System.currentTimeMillis()
          val market = currentPair(now)
          when {
            autoDemoArmed ->
              probeStatus.text = "OPREȘTE AUTO DEMO ÎNAINTE DE AUTO SIM"
            !TouchTestService.ready() ->
              probeStatus.text = TouchTestService.accessDiagnostic(this@ScalpOverlayService)
            !pairReady(now) || market == "NEIDENTIFICAT" ->
              probeStatus.text = "AȘTEAPTĂ IDENTIFICAREA UNEI PERECHI STABILE"
            else -> {
              onePairEvalPair = market
              onePairEvalLastLockAt = lockedAt // do not replay earlier alerts
              onePairEvalEnabled = true
              text = "AUTO SIM ON"
              probeStatus.text = "TEST 1 PERECHE: " + market + " • FĂRĂ ORDINE"
            }
          }
        }
      }
    }
    evaluationRow.addView(evaluationButton, LinearLayout.LayoutParams(-1, dp(31)))
    root.addView(evaluationRow)
    onePairEvalButton = evaluationButton
    onePairEvalRow = evaluationRow
    onePairEvalTouch = { side ->
      testVirtualTouch(side, if (side == "BUY") targetBuy else targetSell, true)
    }

    // Read-only broker screen capability probe. Even if QT DEMO is detected,
    // this button cannot execute a broker order. No automatic broker taps.
    val brokerInspectionRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      visibility = View.GONE
      setPadding(0, dp(4), 0, 0)
    }
    val brokerInspectionButton = localButton(
      "VERIFICĂ QT DEMO", Color.rgb(66, 86, 120)
    ).apply {
      contentDescription = "Identifică doar contul demo și butoanele, fără atingere broker"
      setOnClickListener {
        probeStatus.text = TouchTestService.inspectDemoBrokerReadOnly()
      }
    }
    brokerInspectionRow.addView(brokerInspectionButton, LinearLayout.LayoutParams(-1, dp(31)))
    root.addView(brokerInspectionRow)
    demoBrokerInspectionRow = brokerInspectionRow

    // Secondary diagnostics stay folded so the currency selector and chart
    // are readable with PROBĂ open. This is NOT an automatic order switch.
    val moreRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      visibility = View.GONE
      setPadding(0, dp(4), 0, 0)
    }
    val moreTests = localButton("MAI MULT ▸", Color.rgb(84, 103, 120)).apply {
      contentDescription = "Arată sau ascunde teste avansate fără a atinge brokerul"
      setOnClickListener {
        extraTestControlsVisible = !extraTestControlsVisible
        text = if (extraTestControlsVisible) "MAI PUȚIN ▴" else "MAI MULT ▸"
        demoAmountCheckRow?.visibility =
          if (extraTestControlsVisible) View.VISIBLE else View.GONE
        demoBrokerOrderRow?.visibility =
          if (extraTestControlsVisible) View.VISIBLE else View.GONE
        // The robot button is independent of the legacy MORE submenu.
        autoDemoRow?.visibility = View.VISIBLE
        calculatorTestRow?.visibility =
          if (extraTestControlsVisible) View.VISIBLE else View.GONE
        // Any pending order confirmation times out after 8 seconds.
        // Folding detail rows never performs an order.
        root.post {
          val window = overlayWindowParams ?: return@post
          val height = resources.displayMetrics.heightPixels
          val freeHeader = (height * 0.20f).toInt()
          val maxTop = ((height * 0.76f).toInt() - root.height -
            dp(18)).coerceAtLeast(0)
          window.y = if (maxTop >= freeHeader)
            window.y.coerceIn(freeHeader, maxTop) else maxTop
          window.x = dp(8)
          try { windowManager.updateViewLayout(root, window) } catch (_: Throwable) {}
        }
      }
    }
    moreRow.addView(moreTests, LinearLayout.LayoutParams(-1, dp(30)))
    root.addView(moreRow)
    moreTestsRow = moreRow
    moreTestsToggle = moreTests

    // Manual two-step DEMO order probe. This is NOT connected to strategy
    // signals or AUTO SIM. Android refuses any order unless QT Demo, exactly
    // 1 USD, adequate demo balance, and a unique clickable trade button exist.
    // Verify account and exactly 1 USD without starting a transaction.
    // The current fail-closed error is shown verbatim to diagnose WebView nodes.
    val fxButton = localButton("ROTAȚIE DEMO • 30 S", Color.rgb(71, 88, 118))
    fxButton.contentDescription = "Pornește sau oprește rotația perechilor valutare QT Demo"
    val fxRotation = object {
      val visited = mutableSetOf<String>()
      var running = false
      var forward = true
      var task: Runnable? = null
      val rejectedPairs = mutableSetOf<String>()
      val scrollHistory = mutableSetOf<List<String>>()
      var reversed = false
      var newPass = false
      var originalOverlayY: Int? = null
      var dockedOverlayY: Int? = null

      fun restoreOverlay() {
        val originalY = originalOverlayY ?: return
        val dockedY = dockedOverlayY
        originalOverlayY = null
        dockedOverlayY = null
        val window = overlayWindowParams ?: return
        if (overlayView === root && !shuttingDown && window.y == dockedY) {
          window.y = originalY
          try { windowManager.updateViewLayout(root, window) } catch (_: Exception) {}
        }
      }

      fun stop(message: String) {
        running = false
        fxRotationNavigating = false
        task?.let { mainHandler.removeCallbacks(it) }
        task = null
        restoreOverlay()
        fxButton.text = message
      }

      fun tradeBusy(): Boolean =
        tradePositionGate.state() != TradePositionGate.State.READY ||
          closedHistoryInspectionInProgress ||
          listOf(autoShockAttemptPrefs, sell404TestPrefs).any { name ->
            getSharedPreferences(name, Context.MODE_PRIVATE).getBoolean("attempted", false)
          }

      fun after(delay: Long, work: () -> Unit) {
        val callback = Runnable {
          task = null
          if (!running || overlayView !== root || shuttingDown || mediaProjection == null)
            stop("ROTAȚIE DEMO • 30 S")
          else try {
            work()
          } catch (_: Exception) {
            stop("ROTAȚIE • SELECTOR NECONFIRMAT")
          }
        }
        task = callback
        mainHandler.postDelayed(callback, delay)
      }

      fun start() {
        val pair = TouchTestService.readVisibleDemoPair()
        val listOpen = TouchTestService.demoFxListVisible()
        if (mediaProjection == null || (pair == null && !listOpen)) {
          stop("ROTAȚIE • DESCHIDE QT DEMO")
          return
        }
        if (tradeBusy()) {
          stop("ROTAȚIE • AȘTEAPTĂ ÎNCHIDEREA")
          return
        }
        visited.clear()
        forward = true
        running = true
        if (listOpen) {
          beginNavigation()
          val current = pair ?: latestMarket.takeUnless { it == "NEIDENTIFICAT" }
          current?.let { visited.add(it) }
          after(if (dockForSelector()) 350L else 0L) { select(current) }
        } else {
          fxButton.text = "ROTAȚIE • VERIFIC M5"
          verifyChart(checkNotNull(pair), 24)
        }
      }

      fun beginNavigation() {
        rejectedPairs.clear()
        scrollHistory.clear()
        reversed = false
        newPass = false
        fxRotationNavigating = true
        autoDemoArmed = false
        autoDemoMarket = null
        autoDemoExpiry = 0L
        autoDemoLastPreflightAt = 0L
        clearOnInstrumentChange()
      }

      fun verifyChart(pair: String, checks: Int) {
        val now = System.currentTimeMillis()
        val payout = TouchTestService.readDemoFxChartPayout(pair)
        if (payout != null && payout < 92) {
          visited.add(pair)
          beginNavigation()
          fxButton.text = "$pair • $payout% • SAR PERECHEA"
          openList(pair, false)
          return
        }
        val chartReady = payout != null && pairReady(now) && currentPair(now) == pair &&
          selectedTimeframe == "M5" && !manualTfConflict &&
          (!tfAutomatic || (tfVerified && now - confirmedTfAt in 0L..TF_STALE_MS)) &&
          observedCandleAt > 0L && now - observedCandleAt in 0L..3500L
        if (!chartReady) {
          if (checks > 0) after(750L) { verifyChart(pair, checks - 1) }
          else stop(if (payout == null) "ROTAȚIE • PAYOUT NECITIT"
            else "ROTAȚIE • GRAFIC M5 NECONFIRMAT")
          return
        }
        if (fxRotationNavigating) clearOnInstrumentChange()
        fxRotationNavigating = false
        autoDemoEntryCycleStartedAt = now
        visited.add(pair)
        dwell(pair, android.os.SystemClock.elapsedRealtime() + 30_000L, 12)
      }

      fun dwell(pair: String, deadline: Long, retries: Int) {
        val waitingForBroker = tradeBusy()
        val openBadge = !waitingForBroker && TouchTestService.inspectVisibleDemoOpenBadgeReadOnly()
          .startsWith("QT DEMO • INDICATOR ")
        if (waitingForBroker || openBadge) {
          fxButton.text = if (openBadge || tradePositionGate.state() == TradePositionGate.State.OPEN)
            "ROTAȚIE • POZIȚIE DESCHISĂ" else "ROTAȚIE • AȘTEPT CONFIRMAREA ORDINULUI"
          after(1_000L) { dwell(pair, deadline, retries) }
          return
        }
        val remaining = deadline - android.os.SystemClock.elapsedRealtime()
        if (remaining > 0L) {
          fxButton.text = "$pair • ${(remaining + 999L) / 1000L} S"
          after(minOf(remaining, 1_000L)) { dwell(pair, deadline, retries) }
          return
        }
        val now = System.currentTimeMillis()
        val recentSignal = lockedAt > 0L && now - lockedAt in 0L..5000L
        val liveCandidate = candidateCount > 0 &&
          now - candidateLastSeenAt in 0L..CANDIDATE_EVIDENCE_GRACE_MS &&
          now - candidateStartedAt in 0L..CANDIDATE_MAX_AGE_MS
        if ((recentSignal || liveCandidate) && remaining > -5_000L) {
          after(750L) { dwell(pair, deadline, retries) }
          return
        }
        if (!pairReady(now) || currentPair(now) != pair ||
            TouchTestService.readVisibleDemoPair() != pair) {
          if (retries > 0) after(750L) { dwell(pair, deadline, retries - 1) }
          else stop("ROTAȚIE • PERECHE NECONFIRMATĂ")
          return
        }
        beginNavigation()
        fxButton.text = "ROTAȚIE • DESCHID VALUTE"
        openList(pair, false)
      }

      fun openList(pair: String, physicalOnly: Boolean) {
        if (tradeBusy()) {
          stop("ROTAȚIE • POZIȚIE NEVERIFICATĂ")
          return
        }
        if (dockForSelector()) {
          after(350L) { openList(pair, physicalOnly) }
          return
        }
        if (TouchTestService.demoFxListVisible()) {
          select(pair)
          return
        }
        if (!TouchTestService.reopenDemoFxList(pair, overlayBounds(), physicalOnly)) {
          stop("ROTAȚIE • SELECTOR BLOCAT")
          return
        }
        after(500L) { awaitList(pair, 6, physicalOnly) }
      }

      fun awaitList(pair: String, checks: Int, physicalOnly: Boolean) {
        if (TouchTestService.demoFxListVisible()) {
          select(pair)
        }
        else if (checks > 0) after(500L) { awaitList(pair, checks - 1, physicalOnly) }
        else if (!physicalOnly) openList(pair, true)
        else stop("ROTAȚIE • LISTA NU S-A DESCHIS")
      }

      fun dockForSelector(): Boolean {
        if (originalOverlayY != null) return false
        val window = overlayWindowParams ?: return false
        val screenHeight = resources.displayMetrics.heightPixels
        val targetY = screenHeight - root.height - dp(20)
        // The temporary position must clear the FX rows as well as the header.
        // Trading is already paused throughout selector navigation.
        if (targetY < screenHeight * .70f || overlayBounds().top >= screenHeight * .70f)
          return false
        originalOverlayY = window.y
        dockedOverlayY = targetY
        window.y = targetY
        windowManager.updateViewLayout(root, window)
        return true
      }

      fun overlayBounds(): Rect {
        val location = IntArray(2)
        root.getLocationOnScreen(location)
        return Rect(location[0], location[1], location[0] + root.width, location[1] + root.height)
      }

      fun confirmSelection(pair: String, previous: String?, retryTap: Boolean) {
        if (tradeBusy()) {
          stop("ROTAȚIE • POZIȚIE NEVERIFICATĂ")
          return
        }
        if (!TouchTestService.demoFxListVisible()) {
          restoreOverlay()
          verifyChart(pair, 24)
          return
        }
        val retry = if (retryTap) TouchTestService.navigateOpenDemoFxList(
          emptySet(), false, forward, overlayBounds(), pair) else null
        if (retry?.pair == pair) {
          after(1_250L) { confirmSelection(pair, previous, false) }
        } else {
          rejectedPairs.add(pair)
          fxButton.text = "ROTAȚIE • ÎNCERC ALTĂ PERECHE"
          after(500L) { select(previous) }
        }
      }

      fun select(previous: String?, rowChecks: Int = 5) {
        if (tradeBusy()) {
          stop("ROTAȚIE • POZIȚIE NEVERIFICATĂ")
          return
        }
        val result = TouchTestService.navigateOpenDemoFxList(
          visited + rejectedPairs, true, forward, overlayBounds(), scrollHistory = scrollHistory)
        val pair = result.pair
        when {
          pair != null -> {
            fxButton.text = "ROTAȚIE • VERIFIC $pair"
            after(1_250L) { confirmSelection(pair, previous, true) }
          }
          result.rejectedPair != null -> {
            rejectedPairs.add(result.rejectedPair)
            fxButton.text = "ROTAȚIE • ÎNCERC ALTĂ PERECHE"
            after(500L) { select(previous) }
          }
          result.message == "RÂNDURI VALUTE NECITITE" && rowChecks > 0 ->
            after(500L) { select(previous, rowChecks - 1) }
          result.scrolled -> after(750L) { select(previous) }
          result.endOfList && !reversed -> {
            reversed = true
            forward = !forward
            scrollHistory.clear()
            after(0L) { select(previous) }
          }
          result.endOfList && !newPass -> {
            newPass = true
            reversed = false
            visited.clear()
            previous?.let { visited.add(it) }
            scrollHistory.clear()
            after(0L) { select(previous) }
          }
          result.endOfList -> {
            // With no eligible alternative, return to the current chart if visible.
            val current = previous?.takeUnless { it in rejectedPairs }?.let {
              TouchTestService.navigateOpenDemoFxList(
                emptySet(), false, forward, overlayBounds(), it).pair
            }
            if (current == null || current != previous || current in rejectedPairs)
              stop("ROTAȚIE • NICIO ALTĂ PERECHE ≥92%")
            else after(1_250L) { confirmSelection(current, previous, false) }
          }
          else -> stop("ROTAȚIE • " + result.message)
        }
      }
    }
    fxButton.setOnClickListener {
      if (fxRotation.running) fxRotation.stop("ROTAȚIE DEMO • 30 S")
      else try { fxRotation.start() } catch (_: Exception) {
        fxRotation.stop("ROTAȚIE • SELECTOR NECONFIRMAT")
      }
    }
    root.addView(fxButton, LinearLayout.LayoutParams(-1, dp(26)))
    val amountCheckRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      visibility = View.GONE
      setPadding(0, dp(4), 0, 0)
    }
    val amountCheck = localButton("PREGĂTEȘTE DEMO 1$", Color.rgb(71, 88, 118)).apply {
      contentDescription = "Verifică QT Demo, perechea, suma 1 USD, soldul și payout-ul fără ordin"
      setOnClickListener {
        val now = System.currentTimeMillis()
        val pair = currentPair(now)
        probeStatus.text = if (!pairReady(now) || pair == "NEIDENTIFICAT")
          "BLOCAT: PERECHEA NU ESTE IDENTIFICATĂ STABIL"
        else TouchTestService.preflightOneDollarDemoOrder(pair)
      }
    }
    amountCheckRow.addView(amountCheck, LinearLayout.LayoutParams(-1, dp(31)))
    root.addView(amountCheckRow)
    demoAmountCheckRow = amountCheckRow

    val demoOrderRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      visibility = View.GONE
      setPadding(0, dp(5), 0, 0)
    }
    var armedDemoSide: String? = null
    var armedDemoMarket: String? = null
    var armedDemoAt = 0L
    fun confirmDemoOrder(side: String) {
      if (onePairEvalEnabled || autoDemoArmed) {
        probeStatus.text = "OPREȘTE AUTO SIM/AUTO DEMO ÎNAINTE DE PROBA MANUALĂ"
        return
      }
      val now = android.os.SystemClock.elapsedRealtime()
      if (armedDemoSide == side && now - armedDemoAt in 0L..8000L) {
        val expectedMarket = armedDemoMarket
        armedDemoSide = null
        armedDemoMarket = null
        armedDemoAt = 0L
        val marketNow = currentPair(System.currentTimeMillis())
        probeStatus.text = if (expectedMarket == null ||
            !pairReady(System.currentTimeMillis()) || marketNow != expectedMarket)
          "BLOCAT: PERECHEA S-A SCHIMBAT SAU NU ESTE CONFIRMATĂ"
        else TouchTestService.pressOneDollarDemoOrderOnce(side)
      } else {
        armedDemoSide = null
        armedDemoMarket = null
        armedDemoAt = 0L
        val marketNow = currentPair(System.currentTimeMillis())
        if (!pairReady(System.currentTimeMillis()) || marketNow == "NEIDENTIFICAT") {
          probeStatus.text = "BLOCAT: PERECHEA NU ESTE STABILĂ"
          return
        }
        val inspection = TouchTestService.previewOneDollarDemoOrder(side)
        if (!inspection.startsWith("GATA ")) {
          probeStatus.text = inspection
          return
        }
        armedDemoSide = side
        armedDemoMarket = marketNow
        armedDemoAt = now
        probeStatus.text = "CONFIRMĂ " + side + " " + marketNow + " • DEMO 1 USD"
      }
    }
    val demoBuy = localButton("DEMO BUY 1$", Color.rgb(16, 89, 62)).apply {
      contentDescription = "Două apăsări deliberate pentru ordin BUY de probă de 1 dolar doar în QT Demo"
      setOnClickListener { confirmDemoOrder("BUY") }
    }
    val demoSell = localButton("DEMO SELL 1$", Color.rgb(127, 43, 66)).apply {
      contentDescription = "Două apăsări deliberate pentru ordin SELL de probă de 1 dolar doar în QT Demo"
      setOnClickListener { confirmDemoOrder("SELL") }
    }
    demoOrderRow.addView(demoBuy, LinearLayout.LayoutParams(0, dp(31), 1f).apply { marginEnd = dp(5) })
    demoOrderRow.addView(demoSell, LinearLayout.LayoutParams(0, dp(31), 1f))
    root.addView(demoOrderRow)
    demoBrokerOrderRow = demoOrderRow

    // One explicit ON press arms at most ONE fresh SHOCK DEMO order.
    // Never starts automatically on launch. Real money is forbidden and
    // all strict verification gates remain mandatory before arming/clicking.
    val brokerAutoRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      visibility = View.VISIBLE
      setPadding(0, dp(5), 0, 0)
    }
    val brokerAutoButton = localButton("🤖 PORNEȘTE • ON", Color.rgb(88, 62, 115)).apply {
      textSize = 11f
      contentDescription = "Pornește roboțelul automat numai pentru QT Demo, un singur ordin cu suma aleasă în broker la ȘOC valid. Atinge din nou pentru oprire."
      setOnClickListener {
        try {
          if (autoDemoArmed) {
            autoDemoArmed = false
            autoDemoMarket = null
            autoDemoExpiry = 0L
            text = "🤖 PORNEȘTE • ON"
            probeStatus.text = "ROBOT OPRIT • FĂRĂ ORDINE NOI"
          } else {
            val wallNow = System.currentTimeMillis()
            val clockNow = android.os.SystemClock.elapsedRealtime()
            val pair = currentPair(wallNow)
            val condition = when {
              onePairEvalEnabled -> "BLOCAT: OPREȘTE AUTO SIM"
              !bellEnabled -> "BLOCAT: ACTIVEAZĂ BIPUL"
              !TouchTestService.ready() -> TouchTestService.accessDiagnostic(this@ScalpOverlayService)
              !pairReady(wallNow) || pair == "NEIDENTIFICAT" ->
                "BLOCAT: PERECHEA NU ESTE STABILĂ"
              else -> if (CHART_ONLY_DEMO_462) {
                if (TouchTestService.readBrokerDemoOrder476(pair) != null)
                  "PREGĂTIT AUTO DEMO"
                else "BLOCAT: MIZĂ / PAYOUT / TIMP QT DEMO NECONFIRMATE"
              } else TouchTestService.preflightOneDollarDemoOrder(pair)
            }
            if (!condition.startsWith("PREGĂTIT AUTO DEMO")) {
              autoDemoArmed = false
              autoDemoMarket = null
              autoDemoExpiry = 0L
              text = "🤖 PORNEȘTE • ON"
              probeStatus.text = condition
            } else {
              autoDemoArmed = true
              autoDemoMarket = pair
              autoDemoLockedAt = lockedAt // never replay a previous BIP
              autoDemoExpiry = clockNow + 10 * 60_000L
              text = "🤖 ROBOT ON • OPREȘTE"
              probeStatus.text = "ON QT DEMO • " + pair +
                " • 1 SINGUR ȘOC NOU • MIZĂ DIN BROKER • PAYOUT ≥92%"
            }
          }
        } catch (error: Exception) {
          autoDemoArmed = false
          autoDemoMarket = null
          autoDemoExpiry = 0L
          text = "🤖 PORNEȘTE • ON"
          // User-facing diagnostic contains only exception class, not
          // broker contents, balance, screen text or any account data.
          probeStatus.text = "BLOCAT: ANDROID (" +
            error.javaClass.simpleName.take(24) + ") • FĂRĂ ORDIN"
          android.util.Log.e("ScalpAtlasRobot", "AUTO DEMO one-tap preflight failed safely", error)
        }
      }
    }
    brokerAutoRow.addView(brokerAutoButton, LinearLayout.LayoutParams(-1, dp(31)))
    root.addView(brokerAutoRow)
    autoDemoRow = brokerAutoRow
    autoDemoButton = brokerAutoButton
    // One explicit, broker-independent cross-app test. Never triggered by
    // SHOCK/SCALP signals and never uses underlying Pocket Option coordinates.
    val calcRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      visibility = View.GONE
      setPadding(0, dp(4), 0, 0)
    }
    val calcOne = localButton("TEST CALCULATOR · 1", Color.rgb(43, 79, 114)).apply {
      contentDescription = "Testează apăsarea cifrei 1 numai în Calculator, fără ordine"
      setOnClickListener {
        if (pendingVirtualSide != null) {
          probeStatus.text = "FINALIZEAZĂ MAI ÎNTÂI TESTUL BUY/SELL"
        } else {
          probeStatus.text = TouchTestService.clickCalculatorDigitOne()
        }
      }
    }
    calcRow.addView(calcOne, LinearLayout.LayoutParams(-1, dp(31)))
    root.addView(calcRow)
    root.addView(probeStatus)
    // 451: ALWAYS visible even when the overlay is minimized. The number is
    // a preview at 92% payout, not an executed stake and not a broker balance.
    martingaleStatusText = TextView(this).apply {
      text = if (CHART_ONLY_DEMO_462) "MIZĂ SETATĂ ÎN BROKER" else "MIZĂ 1,00 USD • MG DEMO"
      textSize = 9f
      gravity = Gravity.CENTER
      maxLines = 1
      setTextColor(Color.rgb(75, 100, 121))
      setPadding(dp(3), dp(1), dp(3), dp(1))
      contentDescription = "Martingale demo: miză calculată, niciodată ordin confirmat"
    }
    martingaleStatusText?.let { root.addView(it) }
    // 430: The manual "TEST SELL DEMO 1$" control has been removed from
    // the overlay. SHOCK DEMO remains autonomous after the user starts LIVE.
    // Legacy previous-attempt preferences are deliberately retained so an
    // ambiguous earlier broker gesture cannot be retried or bypassed.
    calculatorTestRow = calcRow
    touchProbeCommandRow = commandRow
    touchProbeRow = probeRow
    touchProbeStatus = probeStatus

    // Start in an unobtrusive status-pill mode; all live monitoring and the
    // enabled/disabled bell continue to work. Opening the card is manual.
    var minimized = true
    fun applyCompactMode() {
      body.visibility = if (minimized || probeModeActive) View.GONE else View.VISIBLE
      trendRow.visibility = if (minimized || probeModeActive) View.GONE else View.VISIBLE
      note.visibility = if (minimized || probeModeActive) View.GONE else View.VISIBLE
      // Minimal autonomous overlay: only status and live indicators.
      // No manual SELL test button and no additional gesture controls.
      touchProbeToggle.visibility = View.GONE
      testBipControl.visibility = View.GONE
      brokerAutoRow.visibility = View.GONE // Session auto-arms after Android LIVE consent.
      probeStatus.visibility = View.VISIBLE
      probeStatus.textSize = if (minimized) 9f else 10f
      compactStatus.visibility = if (minimized) View.VISIBLE else View.GONE
      headerGap.visibility = if (minimized) View.GONE else View.VISIBLE
      if (minimized) {
        // Never leave Android gesture-test buttons exposed when compact.
        probeRow.visibility = View.GONE
        commandRow.visibility = View.GONE
        evaluationRow.visibility = View.GONE
        brokerInspectionRow.visibility = View.GONE
        demoOrderRow.visibility = View.GONE
        amountCheckRow.visibility = View.GONE
        autoDemoRow?.visibility = View.GONE
        moreRow.visibility = View.GONE
        probeModeActive = false
        extraTestControlsVisible = false
        moreTests.text = "MAI MULT ▸"
        armedDemoSide = null
        armedDemoMarket = null
        armedDemoAt = 0L
        calcRow.visibility = View.GONE
        // Display blocker and arming status even when the panel is small.
        probeStatus.visibility = View.VISIBLE
        onePairEvalEnabled = false
        onePairEvalPair = null
        evaluationButton.text = "AUTO SIM OFF"
        // Minimizing never disarms a correctly verified DEMO one-shot.
        // Expiry, user OFF, pair change, lost service or confirmed SHOCK
        // still disarm as before.
      }
      minimizeToggle.text = if (minimized) "+" else "−"
      minimizeToggle.visibility = View.GONE // One-button pilot: no extra UI controls.
      minimizeToggle.contentDescription = if (minimized)
        "Extinde panoul Scalp Atlas" else "Micșorează panoul Scalp Atlas"
      val window = overlayWindowParams ?: return
      window.width = dp(if (minimized) 176 else 224)
      val metrics = resources.displayMetrics
      window.x = window.x.coerceIn(0, (metrics.widthPixels - window.width).coerceAtLeast(0))
      root.post {
        window.y = window.y.coerceIn(0, (metrics.heightPixels - root.height - dp(16)).coerceAtLeast(0))
        try { windowManager.updateViewLayout(root, window) } catch (_: Throwable) {}
      }
    }
    minimizeToggle.setOnClickListener {
      minimized = !minimized
      applyCompactMode()
    }
    applyCompactMode()

    val params = WindowManager.LayoutParams(
      dp(176),
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
      y = (resources.displayMetrics.heightPixels * 0.205f).toInt()
      // Initial location stays below the broker currency selector.
    }

    // Drag the white card on its background; bell and X remain clickable.
    var startX = 0
    var startY = 0
    var touchX = 0f
    var touchY = 0f
    val dragListener = View.OnTouchListener { _, event ->
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
            .coerceIn(0, (metrics.widthPixels - params.width).coerceAtLeast(0))
          val limitBottom = if (touchProbeRow?.visibility == View.VISIBLE)
            (metrics.heightPixels * 0.76f).toInt()
            else metrics.heightPixels
          val maxTop = (limitBottom - root.height - dp(22)).coerceAtLeast(0)
          val minTop = if (touchProbeRow?.visibility == View.VISIBLE &&
              maxTop >= (metrics.heightPixels * 0.20f).toInt())
            (metrics.heightPixels * 0.20f).toInt() else 0
          params.y = (startY + (event.rawY - touchY).toInt())
            .coerceIn(minTop, maxTop)
          overlayView?.let { windowManager.updateViewLayout(it, params) }
          true
        }
        else -> false
      }
    }
    root.setOnTouchListener(dragListener)
    compactStatus.setOnTouchListener(dragListener)
    overlayView = root
    overlayWindowParams = params
    windowManager.addView(root, params)
    startNeonEdge434()
  }

  /**
   * 447: On Pocket Option HISTORY screens, the floating robot previously
   * covered the broker's upper-right "QT Demo" header (see G24 screenshots).
   * The CLOSED detail parser correctly requires that visible header for
   * account proof, so its own overlay made every legitimate receipt unreadable.
   *
   * Dock the compact indicator to the upper LEFT, clear of the account
   * header (right), history title/tabs (beneath) and order controls (bottom).
   * This is only a window layout change; NEVER use it to infer settlement
   * or permit BUY/SELL. The next independent OCR frames must see the
   * uncovered, genuine QT Demo header.
   */
  private fun dockOverlayForBrokerHistory447() {
    val view = overlayView ?: return
    val window = overlayWindowParams ?: return
    val metrics = resources.displayMetrics
    if (metrics.widthPixels < dp(240) ||
        metrics.heightPixels < dp(360)) return
    val safeHistoryTitleTop = (metrics.heightPixels * 0.135f).toInt()
    val targetX = dp(8)
    val targetY = minOf(
      dp(24),
      (safeHistoryTitleTop - view.height - dp(6)).coerceAtLeast(0)
    )
    if (window.x == targetX && window.y == targetY) return
    // 449: Pending DEMO history is allowed to uncover the account header
    // BEFORE history navigation; 447 required the page already opened.
    // Purely visual: no gesture, no account trust, no trade state reset.
    val safePendingReview449 = autoDemoSessionConsumed &&
      !lastBrokerAccountStatus.contains("QT REAL") &&
      TouchTestService.activeDemoExecutorPackageForReview() != null
    mainHandler.post {
      if (shuttingDown || overlayView !== view ||
          !(historyPageVisible433 || safePendingReview449)) return@post
      val current = overlayWindowParams ?: return@post
      // Do not let a user-expanded window invade the account banner.
      // Compacted mode is already the default; keep that geometry stable.
      current.x = targetX
      current.y = targetY
      try {
        windowManager.updateViewLayout(view, current)
      } catch (_: Throwable) {
        // No failure may change account verification or order locks.
      }
    }
  }

  /**
   * Keep the phone display on only while the user-authorized foreground
   * MediaProjection LIVE session is running. The 30-minute journal may end,
   * but the live 24-48h monitoring request should not turn off the screen.
   * This does NOT bypass Android capture consent, battery/thermal restrictions
   * or a manual power-button lock. Service shutdown clears the flag.
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
  /**
   * Two consistent on-screen OCR reads are mandatory even for cropped OCR.
   * An isolated "M5" observation is never enough to unlock analysis or BIP.
   */
  private fun recordVisibleTimeframe(found: String, at: Long, source: String) {
    // 433: No timeframe is identifiable on a broker history screen.
    if (historyPageVisible433) return
    if (found != "M5" && found != "M10" && found != "M15") return
    lastTfOcrSource = source + " " + found
    if (!tfAutomatic) {
      if (found == selectedTimeframe) {
        manualTfConflict = false
        manualTfMismatchCount = 0
        manualTfMismatchAt = 0L
      } else {
        if (at - manualTfMismatchAt > 9_000L) manualTfMismatchCount = 0
        manualTfMismatchCount += 1
        manualTfMismatchAt = at
        if (manualTfMismatchCount >= 2 && !manualTfConflict) {
          manualTfConflict = true
          clearOnInstrumentChange()
          updateOverlay("AȘTEAPTĂ", "TF diferit pe Pocket Option",
            "Selectat " + selectedTimeframe + " • detectat " + found + " • bip blocat")
        }
      }
      return
    }
    if (pendingTf != found || at - pendingTfAt > 9000L) {
      pendingTf = found
      pendingTfCount = 1
      pendingTfAt = at
      if (tfVerified && found != selectedTimeframe) {
        tfVerified = false
        clearOnInstrumentChange()
        marketStableAt = at
        updateOverlay("AȘTEAPTĂ", "AUTO • verific " + found,
          "Schimbare interval detectată • aștept confirmarea")
      }
    } else {
      pendingTfCount += 1
      pendingTfAt = at
      if (pendingTfCount >= 2 && tfAutomatic) {
        val changed = selectedTimeframe != found
        val recovered = !tfVerified
        selectedTimeframe = found
        tfVerified = true
        confirmedTfAt = at
        tfControl?.text = "TF AUTO " + found + " ▸"
        if (changed) {
          clearOnInstrumentChange()
          marketStableAt = at
          updateOverlay("AȘTEAPTĂ", "AUTO • " + found + " confirmat",
            "Schimbare reală de interval • reiau stabilizarea")
        } else if (recovered) {
          updateOverlay("AȘTEAPTĂ", "AUTO • " + found + " reconfirmat",
            "Păstrez stabilizarea perechii")
        }
      }
    }
  }

  /**
   * Targeted, enlarged OCR fallback for the small M5/M10/M15 caption at the
   * right edge of the broker chart. Only called when full-frame OCR missed TF.
   * No screenshot is stored, and a single read cannot enable a signal.
   */
  private fun scheduleRightAxisTfOcr(frame: Bitmap, now: Long) {
    if (tfCropBusy || now - lastTfCropAttemptAt < 2_700L) return
    if (frame.width < 240 || frame.height < 450) return
    lastTfCropAttemptAt = now
    val left = (frame.width * 0.63f).toInt()
    val right = (frame.width * 0.98f).toInt()
    val top = (frame.height * 0.23f).toInt()
    val bottom = (frame.height * 0.69f).toInt()
    if (right <= left + 20 || bottom <= top + 30) return
    val enlarged = try {
      val area = Bitmap.createBitmap(frame, left, top, right - left, bottom - top)
      val copy = Bitmap.createScaledBitmap(area, area.width * 2, area.height * 2, true)
      if (copy !== area) area.recycle()
      copy
    } catch (_: Throwable) {
      return
    }
    tfCropBusy = true
    tfCropOcrRecognizer.process(InputImage.fromBitmap(enlarged, 0))
      .addOnSuccessListener { result ->
        if (historyPageVisible433) return@addOnSuccessListener
        // The crop excludes the expiry controls, app header, and broker orders.
        // Require a line beginning with the exact broker TF caption.
        val pattern = Regex("""(?i)^\s*M\s*(5|10|15)(?:\s+\d{1,2}:\d{2})?\s*$""")
        val observations = result.textBlocks.flatMap { it.lines }.mapNotNull { line ->
          pattern.matchEntire(line.text.trim())?.groupValues?.getOrNull(1)?.let { "M" + it }
        }.distinct()
        if (observations.size == 1) {
          recordVisibleTimeframe(observations[0], System.currentTimeMillis(), "AXĂ")
        }
      }
      .addOnCompleteListener {
        enlarged.recycle()
        tfCropBusy = false
      }
  }

  /**
   * A broker pair is accepted only from its actual visible instrument selector.
   * Full-frame OCR and enlarged header OCR share this SAME two-sample gate.
   * Never reuse the previous selected pair after a switch, and never assume OTC.
   */
  private fun recordVisiblePair(foundPair: String, observedAt: Long) {
    // 433: Never accept a CLOSED trade row as the active market.
    if (historyPageVisible433) return
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
  }

  /**
   * 403: A separate 3x crop makes small three-letter OTC symbols legible on
   * Motorola G24 when full-screen ML Kit OCR misses "AED/CNY OTC".
   * This scans only the upper-left broker selector, never chart or trade UI.
   * It cannot click or arm anything by itself: recordVisiblePair still
   * requires two consistent independent screenshot observations.
   */
  private fun schedulePairHeaderOcr(frame: Bitmap, now: Long) {
    if (pairCropBusy || now - lastPairCropAttemptAt < OCR_INTERVAL_MS) return
    if (frame.width < 240 || frame.height < 450) return
    lastPairCropAttemptAt = now
    val left = (frame.width * 0.035f).toInt()
    val right = (frame.width * 0.57f).toInt()
    val top = (frame.height * 0.125f).toInt()
    val bottom = (frame.height * 0.27f).toInt()
    if (right <= left + 80 || bottom <= top + 35) return
    val enlarged = try {
      val region = Bitmap.createBitmap(frame, left, top, right - left, bottom - top)
      val scaled = Bitmap.createScaledBitmap(
        region, region.width * 3, region.height * 3, true
      )
      if (scaled !== region) region.recycle()
      scaled
    } catch (_: Throwable) { return }
    pairCropBusy = true
    pairCropOcrRecognizer.process(InputImage.fromBitmap(enlarged, 0))
      .addOnSuccessListener { textResult ->
        if (historyPageVisible433) return@addOnSuccessListener
        val labels = textResult.textBlocks.flatMap { it.lines }
          .sortedWith(compareBy({ it.boundingBox?.centerY() ?: 0 },
                              { it.boundingBox?.left ?: 0 }))
          .joinToString(" ") { it.text }
        val pattern = Regex("""(?i)\b([A-Z]{3})\s*/\s*([A-Z]{3})\b""")
        val otcPattern = Regex("""(?i)(?<![A-Z0-9])O\s*T\s*C(?![A-Z0-9])""")
        val instruments = pattern.findAll(labels).map { match ->
          val base = match.groupValues[1].uppercase() + "/" +
            match.groupValues[2].uppercase()
          val after = labels.substring(match.range.last + 1).take(22)
          if (otcPattern.containsMatchIn(after)) "$base OTC" else base
        }.distinct().toList()
        val accessibilityPair = TouchTestService.readVisibleDemoPair()
        if (instruments.size == 1 &&
            (accessibilityPair == null || accessibilityPair == instruments[0])) {
          recordVisiblePair(instruments[0], System.currentTimeMillis())
        }
      }
      .addOnCompleteListener {
        enlarged.recycle()
        pairCropBusy = false
      }
  }

  /**
   * 414: The selected Open tab in Pocket Option's dark theme has a blue
   * filled background; Inchis is blue instead when CLOSED is selected.
   * Sample multiple clean interior pixels, not OCR label text, to avoid
   * confusing "Deschis" (visible tab label) with "Deschis" (selected tab).
   * If the theme/layout differs or contrast is ambiguous, fail closed.
   */
  private fun selectedOpenTabVerifiedOnScreen(frame: Bitmap): Boolean {
    if (frame.width < 300 || frame.height < 600) return false
    fun medianLuminance(xs: FloatArray): Double {
      val values = ArrayList<Double>()
      val ys = floatArrayOf(0.183f, 0.198f, 0.207f)
      for (xRatio in xs) for (yRatio in ys) {
        val px = (frame.width * xRatio).toInt().coerceIn(0, frame.width - 1)
        val py = (frame.height * yRatio).toInt().coerceIn(0, frame.height - 1)
        val c = frame.getPixel(px, py)
        values.add(0.2126 * Color.red(c) +
          0.7152 * Color.green(c) + 0.0722 * Color.blue(c))
      }
      values.sort()
      return values[values.size / 2]
    }
    return try {
      val openFill = medianLuminance(floatArrayOf(0.10f, 0.14f, 0.38f, 0.42f))
      val closedFill = medianLuminance(floatArrayOf(0.58f, 0.62f, 0.87f, 0.91f))
      openFill > 43.0 && openFill - closedFill >= 16.0
    } catch (_: Throwable) { false }
  }

  /**
   * 425: Only read the visibly selected CLOSED history tab, never infer
   * selection from the mere existence of the Închis label.
   */
  private fun selectedClosedTabVerifiedOnScreen(frame: Bitmap): Boolean {
    if (frame.width < 300 || frame.height < 600) return false
    fun median(xs: FloatArray): Double {
      val values = ArrayList<Double>()
      for (x in xs) for (y in floatArrayOf(.183f, .198f, .207f)) {
        val pixel = frame.getPixel(
          (frame.width * x).toInt().coerceIn(0, frame.width - 1),
          (frame.height * y).toInt().coerceIn(0, frame.height - 1)
        )
        values.add(.2126 * Color.red(pixel) +
          .7152 * Color.green(pixel) + .0722 * Color.blue(pixel))
      }
      values.sort()
      return values[values.size / 2]
    }
    return try {
      val openFill = median(floatArrayOf(.10f, .14f, .38f, .42f))
      val closedFill = median(floatArrayOf(.58f, .62f, .87f, .91f))
      closedFill > 43.0 && closedFill - openFill >= 16.0
    } catch (_: Throwable) { false }
  }

  /**
   * 437: CLOSED broker detail OCR, not the ordinary list of past trades.
   * The app never guesses LOSS from a balance, elapsed candle or zero
   * open count. In-memory proof expires quickly and cannot outlive LIVE.
   */
  private fun exactMoneyCents437(source: String): Long? {
    val clean = source.trim().replace(Regex("""(?i)\s|USD|\$"""), "")
      .replace(',', '.')
    val m = Regex("""^([+-]?)([0-9]{1,5})(?:\.([0-9]{1,2}))?$""")
      .matchEntire(clean) ?: return null
    val frac = m.groupValues[3].padEnd(2, '0')
    val cents = (m.groupValues[2].toLongOrNull() ?: return null) * 100L +
      (frac.toLongOrNull() ?: return null)
    return if (m.groupValues[1] == "-") -cents else cents
  }

  private fun recordClosedDetailOcr437(
    result: com.google.mlkit.vision.text.Text,
    frame: Bitmap,
    observedAt: Long
  ) {
    val packageId = TouchTestService.activeDemoExecutorPackageForReview()
      ?: return
    // Real must NEVER become a fallback when the account cannot be read.
    if (packageId != verifiedDemoAccountPackage ||
        verifiedDemoAccountAt <= 0L ||
        android.os.SystemClock.elapsedRealtime() - verifiedDemoAccountAt !in 0L..90_000L)
      return
    // 440: The broker's QT Demo account banner is near y=0.06 of the
    // Motorola screen. The previous y>=0.07 OCR crop silently discarded
    // this REQUIRED identity proof from every individual CLOSED detail.
    // Read the broker account from its own upper-screen region, not from
    // historical row text or our overlay.
    val readable440 = result.textBlocks.flatMap { it.lines }.filter {
      val box = it.boundingBox
      box != null && box.centerY().toFloat() / frame.height in 0.035f..0.94f
    }
    val accountHeader440 = readable440.filter { line ->
      val box = line.boundingBox
      box != null && box.centerY().toFloat() / frame.height in 0.035f..0.135f
    }.joinToString(" ") { it.text.trim() }.replace(Regex("""\s+"""), " ")
    val lines = readable440.map { it.text.trim() }.filter { it.isNotBlank() }
    val content = lines.joinToString(" ").replace(Regex("""\s+"""), " ")
    if (!Regex("""(?i)\bQT\s*Demo\b""").containsMatchIn(accountHeader440) ||
        Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(accountHeader440))
      return
    // Require an individually opened detail sheet with its timestamps and
    // uniquely labelled full UUID. The historical LIST has no such fields.
    val ids = Regex("""(?i)\bOrdin\s*:\s*([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\b""")
      .findAll(content).map { it.groupValues[1].lowercase() }.distinct().toList()
    // 442: The CLOSED detail expands INLINE above older history rows.
    // A full screenshot normally includes OTHER pairs below it. Requiring
    // exactly one pair in the entire screenshot rejects a valid receipt.
    // Anchor the detail to its single UUID line, then choose the nearest
    // instrument row ABOVE that UUID and read payout from that SAME row.
    val uuidPattern442 =
      Regex("""(?i)\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b""")
    val idLocations442 = readable440.mapNotNull { line ->
      val box = line.boundingBox ?: return@mapNotNull null
      if (!uuidPattern442.containsMatchIn(line.text))
        return@mapNotNull null
      box.centerY().toFloat() / frame.height
    }
    if (ids.size != 1 || idLocations442.size != 1) return
    val idY442 = idLocations442.single()
    val pairsWithGeometry442 = readable440.mapNotNull { line ->
      val box = line.boundingBox ?: return@mapNotNull null
      val y = box.centerY().toFloat() / frame.height
      val x = box.centerX().toFloat() / frame.width
      if (y !in 0.21f..(idY442 - 0.02f) || x !in 0.03f..0.74f)
        return@mapNotNull null
      // 446: OCR may insert spaces around '/' in AUD / CHF OTC.
      // Store a canonical instrument ID for strict later comparison with
      // the independently persisted broker attempt.
      val match = Regex("""(?i)\b([A-Z]{3})\s*/\s*([A-Z]{3})\s+OTC\b""")
        .find(line.text) ?: return@mapNotNull null
      val parsed = match.groupValues[1].uppercase() + "/" +
        match.groupValues[2].uppercase() + " OTC"
      Pair(y, parsed)
    }
    val latestRowY442 = pairsWithGeometry442.maxOfOrNull { it.first }
      ?: return
    if (idY442 - latestRowY442 !in 0.045f..0.30f) return
    val pairs = pairsWithGeometry442
      .filter { kotlin.math.abs(it.first - latestRowY442) <= 0.020f }
      .map { it.second }.distinct()
    if (pairs.size != 1) return
    val pairRowText442 = readable440.mapNotNull { line ->
      val box = line.boundingBox ?: return@mapNotNull null
      if (kotlin.math.abs(box.centerY().toFloat() / frame.height -
          latestRowY442) > 0.027f)
        return@mapNotNull null
      Pair(box.left, line.text)
    }.sortedBy { it.first }.joinToString(" ") { it.second }
      .replace(Regex("""\s+"""), " ")
    val openLabel = Regex("""(?i)Ora\s+deschiderii\s*:\s*(\d{1,2}:\d{2}:\d{2}(?:\.\d{1,3})?)""")
      .find(content)?.groupValues?.getOrNull(1)
    val closeLabel = Regex("""(?i)Ora\s+(?:închiderii|inchiderii)\s*:\s*(\d{1,2}:\d{2}:\d{2}(?:\.\d{1,3})?)""")
      .find(content)?.groupValues?.getOrNull(1)
    val directionLabel437 = Regex("""(?i)\bPrognoza\s+ta\s*:\s*(VINDEȚI|SELL|CUMPĂRAȚI|BUY)""")
      .find(content)?.groupValues?.getOrNull(1) ?: return
    val side437 = if (directionLabel437.uppercase().startsWith("VINDE") ||
        directionLabel437.uppercase() == "SELL") "SELL" else "BUY"
    val netRaw = Regex("""(?i)\bProfit\s*:\s*([+-]\s*\$?\s*\d{1,5}(?:[.,]\d{1,2})?)""")
      .find(content)?.groupValues?.getOrNull(1)
    val paidRaw = Regex("""(?i)\bPlat[ăa]\s*:\s*(\$?\s*\d{1,5}(?:[.,]\d{1,2})?)""")
      .find(content)?.groupValues?.getOrNull(1)
    val stakeSources = lines.filter {
      Regex("""^\$[0-9]{1,5}(?:[.,][0-9]{1,2})?$""").matches(it)
    }.mapNotNull(::exactMoneyCents437).distinct()
    // 440: ML Kit can return "↘ $1" on the broker's CLOSED summary line,
    // rather than the exact isolated "$1". This is a READ-ONLY witness
    // restricted to the upper-left stake row, never payout/profit labels.
    val stakeRow440 = readable440.filter { line ->
      val rect = line.boundingBox
      rect != null && rect.centerX().toFloat() / frame.width in 0.015f..0.43f &&
        rect.centerY().toFloat() / frame.height in 0.25f..0.38f
    }.flatMap { line ->
      Regex("""(?:^|[^A-Za-z0-9])\$\s*([0-9]{1,5}(?:[.,][0-9]{1,2})?)(?![0-9])""")
        .findAll(line.text).mapNotNull { hit ->
          exactMoneyCents437(hit.groupValues[1])
        }.toList()
    }.distinct()
    if (ids.size != 1 || pairs.size != 1 ||
        openLabel == null || closeLabel == null ||
        netRaw == null || paidRaw == null) return
    val paid = exactMoneyCents437(paidRaw) ?: return
    val net = exactMoneyCents437(netRaw) ?: return
    // Pocket Option displays "$1", "$1.92", "+$0.92" together on a
    // detail header. Only the independently labelled payout MINUS the
    // signed profit can identify which visible amount was the stake.
    val stake = paid - net
    if (stakeSources.count { it == stake } != 1 &&
        !(stakeRow440.size == 1 && stakeRow440.single() == stake)) return
    val pair = pairs.single()
    // 446: Read the payout from the SAME instrument row. The instrument
    // and '+92%' may be separate ML Kit lines and spaces around '/' vary.
    // Never borrow a payout from another historical row.
    val rowPayout446 = Regex(
      """(?i)\b([A-Z]{3})\s*/\s*([A-Z]{3})\s+OTC\s*\+?(\d{2,3})\s*%"""
    )
    val payoutValues = rowPayout446.findAll(pairRowText442)
      .filter { hit ->
        hit.groupValues[1].uppercase() + "/" +
          hit.groupValues[2].uppercase() + " OTC" == pair
      }
      .mapNotNull { it.groupValues[3].toIntOrNull() }.distinct().toList()
    if (payoutValues.size != 1 || payoutValues.single() !in 92..100 ||
        stake <= 0L ||
        net !in -stake..((stake * payoutValues.single() + 99L) / 100L) ||
        paid != stake + net) return
    val opened = openLabel.split(':')
    val closed = closeLabel.split(':')
    if (opened.size != 3 || closed.size != 3) return
    val hh = opened[0].toIntOrNull() ?: return
    val mm = opened[1].toIntOrNull() ?: return
    val ss = opened[2].substringBefore('.').toIntOrNull() ?: return
    if (hh !in 0..23 || mm !in 0..59 || ss !in 0..59) return
    val openingSeconds = hh * 3600 + mm * 60 + ss
    val endedSeconds = run {
      val h = closed[0].toIntOrNull() ?: return
      val m = closed[1].toIntOrNull() ?: return
      val sc = closed[2].substringBefore('.').toIntOrNull() ?: return
      if (h !in 0..23 || m !in 0..59 || sc !in 0..59) return
      h * 3600 + m * 60 + sc
    }
    val elapsed = (endedSeconds - openingSeconds + 86400) % 86400
    if (elapsed !in 240..960) return // never mistake an old list row for an M5 close
    val candidate = ClosedDetail437(packageId, pair, ids.single(),
      stake, payoutValues.single(), net, side437, openingSeconds)
    // The broker's opened CLOSED-detail sheet is not a live price chart:
    // never turn its historical pair/candles into new SHOCK signals.
    historyPageVisible433 = true
    historyPageLastSeen433 = observedAt
    historyPageTab433 = "DETALIU ÎNCHIS"
    if (candidate == firstClosedDetail437 &&
        observedAt - firstClosedDetailAt437 in 1_500L..15_000L) {
      verifiedClosedDetail437 = candidate
      verifiedClosedDetailAt437 = observedAt
    } else {
      firstClosedDetail437 = candidate
      firstClosedDetailAt437 = observedAt
    }
  }

  /**
   * 438: On a visually selected CLOSED history tab, locate exactly ONE row
   * bearing the pending DEMO pair and payout. Two independent OCR frames are
   * required before a bounded navigation-only tap; row matching is NOT
   * settlement proof. A duplicate pair (or unreadable row) fails closed.
   */
  private fun recordClosedListRowOcr438(
    result: com.google.mlkit.vision.text.Text,
    frame: Bitmap,
    observedAt: Long
  ) {
    fun reset() {
      closedRowSamples438 = 0
      closedRowAt438 = 0L
      closedRowX438 = -1f
      closedRowY438 = -1f
    }
    val pkg = TouchTestService.activeDemoExecutorPackageForReview()
    val prior = getSharedPreferences(autoShockAttemptPrefs, Context.MODE_PRIVATE)
    val expectedPair = prior.getString("expectedPair429", null)
    val expectedPkg = prior.getString("expectedPackage429", null)
    val expectedPayout = prior.getInt("expectedPayout429", -1)
    val validPage = mediaProjection != null && pkg != null &&
      pkg == expectedPkg && pkg == verifiedDemoAccountPackage &&
      prior.getBoolean("attempted", false) &&
      !expectedPair.isNullOrBlank() && expectedPayout in 92..100 &&
      verifiedClosedDetail437 == null && historyPageVisible433 &&
      historyPageTab433 == "ÎNCHIS" &&
      selectedClosedTabVerifiedOnScreen(frame) &&
      lastClosedTabVisualPackage == pkg &&
      closedTabVisualConsecutive >= 2 &&
      observedAt - lastClosedTabVisualAt in 0L..6_000L
    if (!validPage) { reset(); return }
    val payoutRegex = Regex("""\+\s*""" + expectedPayout + """\s*%""")
    val fxRegex446 = Regex(
      """(?i)\b([A-Z]{3})\s*/\s*([A-Z]{3})(?:\s+(OTC))?\b"""
    )
    val lines = result.textBlocks.flatMap { it.lines }
    data class ClosedRow438(val x: Float, val y: Float, val closedMinute: Int?)
    val times = lines.mapNotNull { line ->
      val rect = line.boundingBox ?: return@mapNotNull null
      val x = rect.centerX().toFloat() / frame.width
      val y = rect.centerY().toFloat() / frame.height
      val value = line.text.trim()
      if (x !in 0.74f..0.99f || y !in 0.25f..0.86f ||
          !Regex("""^\d{1,2}:\d{2}$""").matches(value))
        return@mapNotNull null
      val hm = value.split(':').mapNotNull { it.toIntOrNull() }
      if (hm.size != 2 || hm[0] !in 0..23 || hm[1] !in 0..59)
        return@mapNotNull null
      Pair(y, hm[0] * 60 + hm[1])
    }
    // 446: ML Kit commonly returns the currency label, '+92%', and
    // closing clock as SEPARATE lines on a visually single CLOSED row.
    // The previous single-line payout requirement rejected those valid
    // history rows and caused a permanent navigation-only lock.
    // Build the row text from physically aligned lines (not the entire
    // screenshot), reject ambiguous second instruments/payouts, and keep
    // the broker OPEN/CLOSED UUID proof mandatory after navigation.
    val options = lines.mapNotNull { line ->
      val rect = line.boundingBox ?: return@mapNotNull null
      val x = rect.centerX().toFloat() / frame.width
      val y = rect.centerY().toFloat() / frame.height
      val label = line.text.trim()
      if (x !in 0.08f..0.72f || y !in 0.25f..0.86f ||
          !fxRegex446.containsMatchIn(label)) return@mapNotNull null
      val rowText446 = lines.mapNotNull siblingRow446@ { sibling ->
        val bounds = sibling.boundingBox ?: return@siblingRow446 null
        val siblingY = bounds.centerY().toFloat() / frame.height
        val siblingX = bounds.centerX().toFloat() / frame.width
        if (kotlin.math.abs(siblingY - y) > 0.019f ||
            siblingX !in 0.025f..0.985f) return@siblingRow446 null
        Pair(bounds.left, sibling.text)
      }.sortedBy { it.first }.joinToString(" ") { it.second }
        .replace(Regex("""\s+"""), " ").trim()
      val instruments446 = fxRegex446.findAll(rowText446)
        .map { match ->
          match.groupValues[1].uppercase() + "/" +
            match.groupValues[2].uppercase() +
            if (match.groupValues[3].isBlank()) "" else " OTC"
        }.distinct().toList()
      if (instruments446.size != 1 ||
          instruments446.single() != expectedPair!!.uppercase()) return@mapNotNull null
      // Require EXACTLY the pending payout on this row. An additional
      // different payout, or an unlabeled percent elsewhere, cannot count.
      val payoutValues446 = Regex("""\+\s*(\d{2,3})\s*%""")
        .findAll(rowText446).mapNotNull {
          it.groupValues[1].toIntOrNull()
        }.distinct().toList()
      if (payoutValues446.size != 1 ||
          payoutValues446.single() != expectedPayout ||
          !payoutRegex.containsMatchIn(rowText446)) return@mapNotNull null
      val sameRowTimes = times.filter {
        kotlin.math.abs(it.first - y) <= 0.019f
      }
      ClosedRow438(x, y,
        if (sameRowTimes.size == 1) sameRowTimes.single().second else null)
    }
    // The list may contain multiple historical orders for the same pair.
    // Prefer the unique CLOSE clock of the persisted 5-min attempt.
    // This clock is only a navigation hint; a later full UUID proof is still
    // mandatory and cannot be inferred from this list.
    val attemptedElapsed = prior.getLong("attemptedAt429", -1L)
    val age = android.os.SystemClock.elapsedRealtime() - attemptedElapsed
    val expectedCloseMinute = if (attemptedElapsed > 0L &&
        age in 300_000L..86_400_000L) {
      val cal = java.util.Calendar.getInstance(
        java.util.TimeZone.getTimeZone("GMT+03:00")
      ).apply { timeInMillis = System.currentTimeMillis() - age + 300_000L }
      cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 +
        cal.get(java.util.Calendar.MINUTE)
    } else null
    val timeMatched = if (expectedCloseMinute != null) options.filter { candidate ->
      val minute = candidate.closedMinute ?: return@filter false
      val gap = kotlin.math.abs(minute - expectedCloseMinute)
      minOf(gap, 1440 - gap) <= 3
    } else emptyList()
    val unique = if (timeMatched.size == 1) timeMatched
      else if (options.size == 1 && options.single().closedMinute == null)
        options
      else emptyList()
    if (unique.size != 1) { reset(); return }
    val selected438 = unique.single()
    val row = Pair(selected438.x, selected438.y)
    if (closedRowSamples438 > 0 &&
        observedAt - closedRowAt438 in 1_200L..12_000L &&
        kotlin.math.abs(row.first - closedRowX438) <= 0.035f &&
        kotlin.math.abs(row.second - closedRowY438) <= 0.025f) {
      closedRowSamples438 = (closedRowSamples438 + 1).coerceAtMost(3)
    } else {
      closedRowSamples438 = 1
    }
    closedRowX438 = row.first
    closedRowY438 = row.second
    closedRowAt438 = observedAt
  }

  /** A second independent OCR sample is mandatory; never use a chart screenshot
   * as evidence that a prior physical broker order is closed. */
  private fun recordExplicitEmptyOpenOcr(
    result: com.google.mlkit.vision.text.Text,
    frame: Bitmap,
    observedAt: Long
  ) {
    val lines = result.textBlocks.flatMap { it.lines }
    // 459: Pocket Option sometimes groups both tab labels into one OCR
    // line. Individual ML Kit text ELEMENTS retain each label's own
    // bounding rectangle. Use both sources, never infer empty positions.
    val words459 = lines.flatMap { it.elements }
    fun hasLine(lower: Float, upper: Float, regex: Regex): Boolean =
      lines.any { line ->
        val box = line.boundingBox ?: return@any false
        val centerY = box.centerY().toFloat() / frame.height
        centerY in lower..upper && regex.matches(line.text.trim())
      } || words459.any { element ->
        val box = element.boundingBox ?: return@any false
        val centerY = box.centerY().toFloat() / frame.height
        centerY in lower..upper && regex.matches(element.text.trim())
      }
    val title = hasLine(0.09f, 0.24f,
      Regex("""(?i)^(?:Tranzacții|Tranzactii|Transactions|Trades)$"""))
    val openTab = hasLine(0.15f, 0.30f,
      Regex("""(?i)^(?:Deschis|Open)$"""))
    val closedTab = hasLine(0.15f, 0.30f,
      Regex("""(?i)^(?:Închis|Inchis|Closed)$"""))
    // 454: On the G24 QT Demo screenshot the broker shows BOTH
    // "Deschis" and "Închis" tabs and a selected bottom "Tranzacții"
    // navigation item, but NO full-screen "Tranzacții" heading.
    // Require all these independent screen regions to recognize the page.
    // This is PAGE IDENTITY only; an OPEN-empty proof still needs an
    // explicit message, visually selected OPEN tab and 2 fresh reads.
    val transactionsFooter454 = hasLine(0.86f, 0.98f,
      Regex("""(?i)^(?:Tranzacții|Tranzactii|Transactions|Trades)$"""))
    // 457: On the photographed G24 history screen the bottom label can
    // be tiny in OCR. BOTH tab labels plus a dated history section identify
    // this as the HISTORY PAGE, never as a chart or settlement proof.
    val datedHistory457 = lines.any { line ->
      val y = line.boundingBox?.centerY()?.toFloat()?.div(frame.height)
        ?: return@any false
      y in 0.22f..0.86f &&
        Regex("""^20\d{2}-\d{2}-\d{2}$""").matches(line.text.trim())
    }
    val historyIdentity454 = title ||
      (openTab && closedTab && (transactionsFooter454 || datedHistory457))
    val body = lines.filter { line ->
      val box = line.boundingBox
      box != null && box.centerY().toFloat() / frame.height in 0.22f..0.89f
    }.joinToString(" ") { it.text }
      .replace(Regex("""\s+"""), " ").trim()
    val emptyMessage = Regex(
      """(?i)(?:Nu există tranzacții (?:plasate|deschise|active)|Nu exista tranzactii (?:plasate|deschise|active)|Nu sunt tranzacții deschise|Nu sunt tranzactii deschise|Nicio tranzacție (?:deschisă|activă)|Nicio tranzactie (?:deschisa|activa)|No trades placed|No open trades|No open positions)"""
    ).containsMatchIn(body)
    val pkg = TouchTestService.activeDemoExecutorPackageForReview()
    // 433: Page identity must come from actual history TITLE and both tabs,
    // not the chart footer "Tranzacții" or any historical FX row.
    val trueHistoryPage433 = historyIdentity454 && openTab && closedTab && pkg != null
    // 457: Bottom "Perspective" is a safe NON-ORDER navigation control.
    // Its coordinates must be found independently in two fresh OCR frames.
    val perspectiveLabels457 = if (trueHistoryPage433) lines.mapNotNull { line ->
      val rect = line.boundingBox ?: return@mapNotNull null
      val x = rect.centerX().toFloat() / frame.width
      val y = rect.centerY().toFloat() / frame.height
      if (x !in 0.20f..0.63f || y !in 0.84f..0.985f ||
          !Regex("""(?i)^(?:Perspective|Perspectiva|Perspectivă)$""")
            .matches(line.text.trim()))
        return@mapNotNull null
      Pair(x, y)
    } else emptyList()
    if (perspectiveLabels457.size == 1 && pkg != null) {
      val xy = perspectiveLabels457.single()
      if (perspectiveOcrSamples457 > 0 &&
          perspectiveOcrPackage457 == pkg &&
          observedAt - perspectiveOcrAt457 in 1_000L..12_000L &&
          kotlin.math.abs(xy.first - perspectiveOcrX457) <= 0.035f &&
          kotlin.math.abs(xy.second - perspectiveOcrY457) <= 0.025f)
        perspectiveOcrSamples457 = (perspectiveOcrSamples457 + 1).coerceAtMost(3)
      else perspectiveOcrSamples457 = 1
      perspectiveOcrX457 = xy.first
      perspectiveOcrY457 = xy.second
      perspectiveOcrAt457 = observedAt
      perspectiveOcrPackage457 = pkg
    } else {
      perspectiveOcrSamples457 = 0
      perspectiveOcrAt457 = 0L
      perspectiveOcrPackage457 = null
    }
    // 440: The broker WebView sometimes hides tab text from Android
    // Accessibility. Independently capture the exact visible "Deschis"
    // label twice; this is a navigation coordinate, not a position receipt.
    // Prefer word-level bounds where OCR grouped "Deschis Închis" in
    // one line. Otherwise use the whole-line bounds, as in versions 435+.
    val openWordLabels459 = if (trueHistoryPage433)
      words459.mapNotNull { element ->
        val rect = element.boundingBox ?: return@mapNotNull null
        val x = rect.centerX().toFloat() / frame.width
        val y = rect.centerY().toFloat() / frame.height
        if (x !in 0.08f..0.48f || y !in 0.15f..0.30f ||
            !Regex("""(?i)^(?:Deschis|Open)$""").matches(element.text.trim()))
          return@mapNotNull null
        Pair(x, y)
      }
    else emptyList()
    val openLineLabels440 = if (trueHistoryPage433) lines.mapNotNull { line ->
      val rect = line.boundingBox ?: return@mapNotNull null
      val x = rect.centerX().toFloat() / frame.width
      val y = rect.centerY().toFloat() / frame.height
      if (x !in 0.08f..0.48f || y !in 0.15f..0.30f ||
          !Regex("""(?i)^(?:Deschis|Open)$""").matches(line.text.trim()))
        return@mapNotNull null
      Pair(x, y)
    } else emptyList()
    val openLabels440 = if (openWordLabels459.isNotEmpty())
      openWordLabels459 else openLineLabels440
    if (openLabels440.size == 1 && pkg != null) {
      val xy = openLabels440.single()
      if (historyOpenOcrCount435 > 0 &&
          observedAt - historyOpenOcrAt435 in 1_000L..12_000L &&
          kotlin.math.abs(xy.first - historyOpenOcrX435) <= 0.035f &&
          kotlin.math.abs(xy.second - historyOpenOcrY435) <= 0.025f) {
        historyOpenOcrCount435 = (historyOpenOcrCount435 + 1).coerceAtMost(3)
      } else historyOpenOcrCount435 = 1
      historyOpenOcrX435 = xy.first
      historyOpenOcrY435 = xy.second
      historyOpenOcrAt435 = observedAt
    } else {
      historyOpenOcrCount435 = 0
      historyOpenOcrAt435 = 0L
    }
    if (trueHistoryPage433) {
      // 440: This is a VERIFIED history page, even when the currently
      // selected tab is CLOSED. A previous failed navigation must not
      // permanently claim "history doesn't open" on this screen. Never
      // infer that OPEN is selected or that a trade has settled.
      historyNavPending431 = false
      historyNavPendingAt431 = 0L
      historyNavFailed431 = 0
      historyNavStalled431 = false
      if (!historyPageVisible433) {
        // Invalidate only CHART analysis. Do not clear persisted broker
        // attempts, history receipts, trade gates or recovery accounting.
        tfVerified = false
        pendingTf = null
        pendingTfCount = 0
        marketVerified = false
        pendingMarket = null
        pendingMarketCount = 0
        clearOnInstrumentChange()
      }
      historyPageVisible433 = true
      historyPageLastSeen433 = observedAt
      // 447: The next MediaProjection+OCR frame must observe the real
      // QT Demo banner, not an area occluded by our own status pill.
      dockOverlayForBrokerHistory447()
      historyPageTab433 = when {
        selectedOpenTabVerifiedOnScreen(frame) -> "DESCHIS"
        selectedClosedTabVerifiedOnScreen(frame) -> "ÎNCHIS"
        else -> "FILA NECONFIRMATĂ"
      }
    } else if (historyPageVisible433 &&
               observedAt - historyPageLastSeen433 > 6_000L) {
      historyPageVisible433 = false
      historyPageTab433 = "NECUNOSCUT"
    }
    val selectedOpen429 = historyIdentity454 && openTab && closedTab &&
      selectedOpenTabVerifiedOnScreen(frame) && pkg != null
    if (selectedOpen429) {
      if (lastOpenTabVisualPackage429 == pkg &&
          observedAt - lastOpenTabVisualAt429 in 1000L..12000L)
        openTabVisualConsecutive429 = (openTabVisualConsecutive429 + 1).coerceAtMost(3)
      else openTabVisualConsecutive429 = 1
      lastOpenTabVisualAt429 = observedAt
      lastOpenTabVisualPackage429 = pkg
    } else {
      lastOpenTabVisualAt429 = 0L
      lastOpenTabVisualPackage429 = null
      openTabVisualConsecutive429 = 0
    }
    val qualified = historyIdentity454 && openTab && closedTab && emptyMessage &&
      selectedOpen429
    // CLOSED-tab proof is independent from OPEN-tab empty-state evidence.
    // The result amounts on a generic list are NOT proof of WIN/LOSS.
    val closedSelected = historyIdentity454 && openTab && closedTab &&
      selectedClosedTabVerifiedOnScreen(frame) && pkg != null
    if (closedSelected) {
      if (lastClosedTabVisualPackage == pkg &&
          observedAt - lastClosedTabVisualAt in 1000L..12000L) {
        closedTabVisualConsecutive = (closedTabVisualConsecutive + 1).coerceAtMost(3)
      } else {
        closedTabVisualConsecutive = 1
      }
      lastClosedTabVisualAt = observedAt
      lastClosedTabVisualPackage = pkg
    } else {
      lastClosedTabVisualAt = 0L
      lastClosedTabVisualPackage = null
      closedTabVisualConsecutive = 0
    }
    if (qualified) {
      if (lastEmptyOpenOcrPackage == pkg &&
          observedAt - lastEmptyOpenOcrAt in 1000L..12000L) {
        emptyOpenOcrConsecutive = (emptyOpenOcrConsecutive + 1).coerceAtMost(3)
      } else {
        emptyOpenOcrConsecutive = 1
      }
      lastEmptyOpenOcrAt = observedAt
      lastEmptyOpenOcrPackage = pkg
    } else {
      emptyOpenOcrConsecutive = 0
      lastEmptyOpenOcrAt = 0L
      lastEmptyOpenOcrPackage = null
    }
  }

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
        // Read-only broker history proof, never an order signal. Requires two
        // separate fresh frames and selected OPEN tab. This runs even though
        // no candle/timeframe can be detected on the Transactions screen.
        recordExplicitEmptyOpenOcr(result, copy, observedAt)
        // 437: read a uniquely identified CLOSED trade detail in two
        // independent frames. Does not itself rearm or submit an order.
        recordClosedDetailOcr437(result, copy, observedAt)
        recordClosedListRowOcr438(result, copy, observedAt)
        recordBrokerHistoryBottomLabelOcr432(result, copy, observedAt)
        // 433: On history, M5 and the active FX selector do not exist.
        // Continue the independent OPEN/CLOSED evidence checker above,
        // but NEVER parse past trade rows as live chart identity.
        if (historyPageVisible433) return@addOnSuccessListener
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
        // A second read-only sensor can see the header via Accessibility
        // when the floating panel has masked it in MediaProjection.
        val accessibilityPair = TouchTestService.readVisibleDemoPair()
        val visiblePairs = when {
          pairs.size == 1 && accessibilityPair != null &&
            accessibilityPair != pairs[0] -> emptyList()
          pairs.size == 1 -> pairs
          pairs.isEmpty() && accessibilityPair != null -> listOf(accessibilityPair)
          else -> emptyList()
        }
        // Reject conflicting instrument identities. If only the tiny header
        // was missed, try a 3x zoomed OCR of that same visible header.
        if (visiblePairs.size == 1) {
          recordVisiblePair(visiblePairs[0], observedAt)
        } else {
          // Retry the zoomed selector both when regular OCR sees no pair
          // and when it disagrees with the broker Accessibility OTC suffix.
          // Never choose either conflicting sensor without a fresh crop.
          if ((pairs.isEmpty() && accessibilityPair == null) ||
              (pairs.size == 1 && accessibilityPair != null &&
                pairs[0] != accessibilityPair))
            schedulePairHeaderOcr(copy, observedAt)
          if (marketVerified && observedAt - latestMarketAt > MARKET_STALE_MS) {
            marketVerified = false
            marketLabelAmbiguous = false
            pendingMarket = null
            pendingMarketCount = 0
            resetSignalState()
            updateOverlay("AȘTEAPTĂ", "Pereche neidentificată",
              "OCR nu a confirmat instrumentul • fără bip")
          }
        }

        if (values.size == 1) {
          // Primary full-frame OCR: still needs two consistent observations.
          recordVisibleTimeframe(values[0], observedAt, "ECRAN")
        } else if (values.isEmpty()) {
          // M5 is often too small at native right-edge text size; enlarge only
          // the axis caption, without lowering confirmation gates.
          scheduleRightAxisTfOcr(copy, observedAt)
        }

        if (values.size != 1 && tfAutomatic && tfVerified &&
            observedAt - confirmedTfAt > TF_STALE_MS) {
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
        // Android can revoke an ongoing screen capture when it is locked,
        // when an app-share ends or when the user stops sharing. A stopped
        // token is NOT reusable on Android 14. Keep the small panel visible
        // so the user knows WHY LIVE vanished, but never auto-resume capture
        // or attempt trades without a new explicit user consent.
        if (shuttingDown) return
        demoClickTestPending = false
        autoDemoSessionRequested = false
        autoDemoSessionConsumed = true
        autoDemoArmed = false
        autoDemoMarket = null
        autoDemoExpiry = 0L
        autoDemoButton?.text = "🤖 PORNEȘTE • ON"
        lockedDir = null
        lockedAt = 0L
        lockedUntil = 0L
        lastCapturedImageAt = 0L
        lastAnalysisResultAt = 0L
        resetSignalState()
        try { virtualDisplay?.release() } catch (_: Throwable) {}
        virtualDisplay = null
        try { imageReader?.close() } catch (_: Throwable) {}
        imageReader = null
        mediaProjection = null
        try { captureThread?.quitSafely() } catch (_: Throwable) {}
        captureThread = null
        captureHandler = null
        setKeepScreenForTest(false)
        updateOverlay("AȘTEAPTĂ", "CAPTURĂ OPRITĂ",
          "Repornește LIVE din Scalp Atlas; Android cere acord pentru o nouă captură")
        mainHandler.post {
          compactStatusText?.text = "LIVE OPRIT"
          captureStatusText?.text = "ECRAN?"
          touchProbeStatus?.text = "CAPTURĂ OPRITĂ • REVINO ÎN APLICAȚIE ȘI PORNEȘTE LIVE"
        }
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
      mainHandler.post { testStatusText?.text = "LIVE CONTINUU • ECRAN PORNIT" }
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
            // The 30-minute diagnostic journal expires, NOT the LIVE capture.
            // Keep the visible screen awake for continuous phone monitoring
            // only while the Android-authorized projection is still active.
            setKeepScreenForTest(mediaProjection != null &&
              virtualDisplay != null && !shuttingDown)
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
      // 433: The transaction-history screen is not a chart. Prevent all
      // new optical trade analysis until the chart is independently
      // re-identified after navigating back.
      if (historyPageVisible433 &&
          now - historyPageLastSeen433 in 0L..6_000L) {
        fullFrame.recycle()
        resetSignalState()
        if (now - lastTfStatusAt >= 2_000L) {
          lastTfStatusAt = now
          updateOverlay("AȘTEAPTĂ", "ISTORIC DEMO",
            "Fără semnale pe istoricul tranzacțiilor")
        }
        return
      }
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
    // Two independent DEMO detectors: SHOCK and M5 SCALP TREND.
    // Neither may use an unconfirmed direction, color alone, or broker orders.
    val rawSignal = result.optString("signal", "NONE")
    val rawStrategy = result.optString("strategy", "NONE")
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
      observedBodyPx = result.optInt("observedBodyHeightPx", 24).coerceIn(5, 200)
      observedUpperWickPx = result.optInt("observedTopWickPx", 8).coerceIn(0, 150)
      observedLowerWickPx = result.optInt("observedBottomWickPx", 8).coerceIn(0, 150)
    } else {
      observedCandleDirection = "NONE"
      observedOpticalQuality = 0
      observedCandleAt = 0L
    }
    if (fxRotationNavigating) return
    val timeframe = selectedTimeframe
    val tPoints = result.optJSONArray("trendVisualPoints")
    val trendMeasured = result.optBoolean("trendMeasured", false)
    observedTrendHistoryCount = if (detected)
      result.optInt("trendHistoryCount", 0).coerceIn(0, 3) else 0
    if (detected && trendMeasured && tPoints != null && tPoints.length() == 3) {
      observedTrendPoints = FloatArray(3) { i ->
        tPoints.optDouble(i, 50.0).coerceIn(0.0, 100.0).toFloat()
      }
      observedTrendStrengthPercent =
        result.optInt("trendStrengthPercent", 0).coerceIn(0,100)
      observedTrendMeasured = true
      observedTrendAt = now
    } else {
      observedTrendMeasured = false
      observedTrendPoints = floatArrayOf()
      observedTrendAt = 0L
    }
    val opticalGate = result.optBoolean("shockOpticalVerified", false)
    val shockSameCandle = result.optBoolean("shockSameCandle", false)
    val shockRetraced = result.optBoolean("shockRetraced", false)
    val shockRecovered = result.optBoolean("shockRecovered", false)
    val shockFrameFresh = result.optLong("shockFrameId", -1L) == result.optLong("frameId", -2L)
    val shockBodyPercent = result.optInt("shockRetracementPercent", 0).coerceIn(0, 100)
    val shockReboundPercent = result.optInt("shockRecoveryPercent", 0).coerceIn(0, 100)
    val shockDropDurationMs = result.optLong("shockDropDurationMs", -1L)
    val shockObservedDurationMs = result.optLong("shockObservedDurationMs", 0L)
    val trendDirection = result.optString("trendDirection", "NONE")
    observedTrendDirection = if (trendDirection == "BUY" || trendDirection == "SELL") trendDirection else "NONE"
    shockBlocker = result.optString("shockBlocker", "URMĂRESC")
    scalpBlocker = result.optString("scalpBlocker", "URMĂRESC")
    val wickMeasured = result.optInt("shockWickPercent", 0).coerceIn(0, 100)
    if (detected && (observed == "BUY" || observed == "SELL")) {
      observedWickPercent = wickMeasured
      observedWickAt = now
    } else {
      observedWickPercent = 0
      observedWickAt = 0L
    }
    if (detected && (observed == "BUY" || observed == "SELL") && shockBodyPercent > 0) {
      observedShockPercent = shockBodyPercent
      observedShockAt = now
      observedShockDurationMs = shockObservedDurationMs.coerceIn(0L, SHOCK_MAX_DROP_MS)
    } else {
      observedShockPercent = 0
      observedShockAt = 0L
      observedShockDurationMs = 0L
    }
    // 406: SHOCK FLEX on verified demo. Reject any missing candle, wick,
    // time, market, trend, second confirmation, or pair evidence.
    // Screen-relative percentages are not win probability.
    val rawDirectionValid = rawSignal == "BUY" || rawSignal == "SELL"
    // 450 SIMPLE: optical SHOCK needs the observed forming candle's
    // direction, two rebound frames, and real wick. The preceding three
    // candles are an optional veto ONLY if they show an opposite trend.
    // A missing trend is not invented and no longer suppresses the signal.
    val sameOpticalDirection = rawDirectionValid && detected &&
      observed == rawSignal
    val independentlyOppositeTrend = observedTrendMeasured &&
      observedTrendDirection != "NONE" &&
      observedTrendDirection != rawSignal
    val sameShockDirection = sameOpticalDirection &&
      !independentlyOppositeTrend
    val sameScalpDirection = sameOpticalDirection && observedTrendMeasured &&
      observedTrendDirection == rawSignal &&
      observedTrendStrengthPercent > SCALP_MIN_TREND
    val wickRejected = rawStrategy == "SHOCK" && rawDirectionValid &&
      !result.optBoolean("wickEntry", false)
    if (wickRejected) shockBlocker = if (rawSignal == "BUY")
      "BUY • AȘTEPT FITIL JOS" else "SELL • AȘTEPT FITIL SUS"
    val confirmedShock = rawStrategy == "SHOCK" && !wickRejected && quality >= 55 &&
      opticalGate && shockSameCandle && shockRetraced && shockRecovered &&
      shockFrameFresh && shockBodyPercent > SHOCK_MIN_DEPTH &&
      shockReboundPercent >= SHOCK_MIN_RECOVERY &&
      wickMeasured >= 1 && shockDropDurationMs in 300L..SHOCK_MAX_DROP_MS &&
      sameShockDirection && result.optString("shockDirection") == rawSignal
    val scalpGate = result.optBoolean("scalpOpticalVerified", false) &&
      result.optBoolean("scalpSameCandle", false)
    val scalpDepth = result.optInt("scalpRetracementPercent", 0).coerceIn(0, 100)
    val scalpRecovery = result.optInt("scalpRecoveryPercent", 0).coerceIn(0, 100)
    val scalpPullbackMs = result.optLong("scalpPullbackDurationMs", -1L)
    val confirmedScalp = rawStrategy == "SCALP_TREND" && timeframe == "M5" &&
      quality >= 55 && shockFrameFresh && scalpGate &&
      scalpDepth in 21..50 && scalpRecovery >= 35 &&
      scalpPullbackMs in 700L..15000L && sameScalpDirection &&
      result.optString("scalpDirection") == rawSignal
    // 428: A secondary SCALP M5 alert cannot consume the five-minute
    // demo SHOCK signal lock. The autonomous DEMO executor supports SHOCK
    // only; otherwise a non-executable SCALP BIP can block real SHOCK
    // candidates during the following five minutes.
    // 450: one strategy only in the compact robot overlay.
    // The legacy M5 SCALP classifier stays testable but cannot emit a
    // competing BUY/SELL signal or consume a fresh SHOCK alert.
    val scalpAlertAllowed = false
    val confirmedSignal = if (confirmedShock || scalpAlertAllowed) rawSignal else "NONE"
    val confirmedStrategy = if (confirmedShock) "SHOCK"
      else if (scalpAlertAllowed) "SCALP_TREND" else "NONE"
    val rejectionText = if (wickRejected) shockBlocker
      else if (rawStrategy == "SCALP_TREND")
      "SCALP TREND neconfirmat" else "ȘOC / SCALP în așteptare"
    val expiry = 5 // five-minute DEMO alert timer, not an automatic broker order
    val directionMax = result.optInt("directionMax", 0)
    val pattern = if (confirmedScalp) "SCALP TREND • M5" else "ȘOC • o lumânare"
    val reason = result.optString("reason", "")
    val opticalCount = if (opticalGate || scalpGate) 1 else 0

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
      activeStrategy = "NONE"
      lastConfirmedShockPercent = 0
      lastConfirmedScalpPercent = 0
      lastConfirmedShockDurationMs = 0L
      candidateDir = null
      candidateStrategy = null
      candidateCount = 0
      candidateLastAt = 0L
      candidateLastSeenAt = 0L
      candidateStartedAt = 0L
    }

    if (confirmedSignal != "BUY" && confirmedSignal != "SELL") {
      val candidateStillFresh =
        !wickRejected && candidateDir != null &&
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
      candidateStrategy = null
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
    if (candidateDir != confirmedSignal ||
        candidateStrategy != confirmedStrategy || candidateEvidenceExpired) {
      candidateDir = confirmedSignal
      candidateStrategy = confirmedStrategy
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
    // Both DEMO strategies run under one five-minute phone-wide signal lock.
    // A lock prevents opposite notifications; it is not a trade order.
    val lockMinutes = 5 // fixed five-minute display and direction lock
    // Publish expiry before direction so other callbacks cannot treat the
    // freshly published direction as an expired lock.
    lockedUntil = now + lockMinutes * 60_000L
    lockedAt = now
    lockedDir = confirmedSignal
    activeStrategy = confirmedStrategy
    lastShockQuality = quality // Internal optical quality, NOT displayed as win %
    lastConfirmedShockPercent = if (confirmedShock) shockBodyPercent else 0
    lastConfirmedScalpPercent = if (confirmedScalp) scalpDepth else 0
    lastConfirmedShockDurationMs = if (confirmedScalp) scalpPullbackMs else shockDropDurationMs
    candidateDir = null
    candidateStrategy = null
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
      pattern + " • direcție estimată " + if (directionMax > 0) directionMax.toString() + " min" else timeframe,
      entryFrameId = result.optLong("frameId", -1L)
    )
  }

  private fun formatSeconds(total: Long): String {
    val minutes = total / 60
    val seconds = total % 60
    return "%02d:%02d".format(minutes, seconds)
  }

  private fun playTestBip() {
    if (!bellEnabled) {
      Toast.makeText(this, "BIP dezactivat • apasă clopoțelul pentru activare", Toast.LENGTH_SHORT).show()
      return
    }
    // Use the exact original BUY BIP asset but do not alter signal state or
    // vibrate. This makes testing possible even when the market has no alerts.
    try {
      val player = MediaPlayer.create(this, R.raw.scalp_buy_bip)
      if (player == null) {
        Toast.makeText(this, "TEST BIP: fișier audio indisponibil", Toast.LENGTH_SHORT).show()
        return
      }
      player.setVolume(1f, 1f)
      player.setOnCompletionListener { it.release() }
      player.start()
      Toast.makeText(this, "TEST BIP redat • nu este semnal BUY/SELL", Toast.LENGTH_SHORT).show()
    } catch (_: Throwable) {
      Toast.makeText(this, "TEST BIP: eroare audio", Toast.LENGTH_SHORT).show()
    }
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

  private fun updateOverlay(
    signal: String, details: String, model: String, entryFrameId: Long = -1L
  ) {
    mainHandler.post {
      val now = System.currentTimeMillis()
      // The accessibility service can bind/unbind while LIVE is running.
      // Refresh only on state changes; never erase a SIM BUY/SELL test result.
      if (!autoDemoSessionRequested && !autoDemoSessionConsumed &&
          touchProbeStatus?.visibility == View.VISIBLE) {
        val diagnostic = TouchTestService.accessDiagnostic(this@ScalpOverlayService)
        if (diagnostic != lastRobotConnectionDiagnostic) {
          lastRobotConnectionDiagnostic = diagnostic
          touchProbeStatus?.text = diagnostic
        }
      }
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
      // Keep strategy identity visible when the SINGLE shared BIP is issued.
      strategyHeaderText?.text = if ((green || red) && activeStrategy == "SCALP_TREND")
        "SCALP TREND" else if (green || red) "ȘOC" else "ȘOC / SCALP"
      // Repaint the miniature and optical percentage for EVERY live result.
      // The arrow still shows BUY/SELL only after a confirmed SHOCK beep.
      candleGraphic?.direction = visualDirection
      // Repaint shape from most recent observed candle dimensions only.
      if (opticalFresh) candleGraphic?.updateObserved(
        observedBodyPx, observedUpperWickPx, observedLowerWickPx
      )
      if (signalChanged) {
        signalText?.text = when {
          green -> "↑ BUY"
          red -> "↓ SELL"
          else -> "AȘTEAPTĂ"
        }
        signalText?.textSize = if (green || red) 16f else 11f
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
      val trendFresh = brokerConnected && observedTrendMeasured &&
        observedTrendAt > 0L && now - observedTrendAt in 0L..3500L
      val candleFresh = opticalFresh &&
        (observedCandleDirection == "BUY" || observedCandleDirection == "SELL")
      // Trend of previous CLOSED candles may disagree with the current
      // forming candle. In that case DO NOT paint a green BUY indication
      // while the current market candle is red (or vice versa).
      val trendContradicted = trendFresh && candleFresh &&
        observedTrendDirection != "NONE" &&
        observedTrendDirection != observedCandleDirection
      val trendThresholdMet = trendFresh &&
        observedTrendStrengthPercent > SHOCK_MIN_TREND
      val trendAgrees = trendFresh && candleFresh &&
        observedTrendDirection != "NONE" && !trendContradicted && trendThresholdMet
      val trendDir = if (trendAgrees) observedTrendDirection else "NONE"
      val trendColor = when (trendDir) {
        "BUY" -> Color.rgb(35, 212, 116)
        "SELL" -> Color.rgb(242, 84, 91)
        else -> Color.rgb(180, 192, 206)
      }
      // Measured historical points remain visible in GREY on reversal.
      // Missing/stale candles show a blank guide instead of invented data.
      trendMiniView?.showData(
        if (trendFresh && candleFresh) observedTrendPoints else floatArrayOf(),
        trendDir
      )
      // Keep the measured percent visible even below the DEMO 50% entry gate;
      // grey means observation only and must not suggest a BUY/SELL alert.
      // Show the measured screen-relative movement even when the THREE
      // historical candles give no reliable BUY/SELL trend. Neutral text
      // is an observation only; entry gates remain unchanged.
      trendPercentLabel?.text = if (trendFresh && candleFresh)
        (when (observedTrendDirection) {
          "SELL" -> "−"
          "BUY" -> "+"
          else -> ""
        }) + observedTrendStrengthPercent.toString() + "%"
        else "—%"
      trendPercentLabel?.setTextColor(trendColor)
      trendDirectionLabel?.setTextColor(trendColor)
      trendDirectionLabel?.text = when {
        !candleFresh -> "LUMÂNARE NECITITĂ"
        !trendFresh -> "ISTORIC " + observedTrendHistoryCount + "/3"
        trendContradicted -> "CONTRA TREND"
        observedTrendDirection == "NONE" -> "LATERAL • FĂRĂ SEMNAL"
        !trendThresholdMet -> "PANTĂ ≤25%"
        trendDir == "BUY" -> "ASCENDENT"
        trendDir == "SELL" -> "DESCENDENT"
        else -> "NECONFIRMAT"
      }
      // A new BUY/SELL is displayed on the first confirmed analysis callback.
      // Animation is gated by a real, unexpired signal lock, never OCR colors.
      val activeSignal = if (brokerConnected && (green || red) &&
          lockedDir == signal && now < lockedUntil) signal else "NONE"
      // Single-pair pilot. Auto SIM runs only on a NEW confirmed BIP lock.
      // This is an own-app gesture test, NEVER an order in the broker.
      if (onePairEvalEnabled) {
        val trackedPair = onePairEvalPair
        val observedPair = currentPair(now)
        if (!pairReady(now) && latestMarketAt > 0L &&
            now - latestMarketAt > MARKET_STALE_MS) {
          onePairEvalEnabled = false
          onePairEvalPair = null
          onePairEvalButton?.text = "AUTO SIM OFF"
          touchProbeStatus?.text = "PERECHE PIERDUTĂ • AUTO SIM OPRIT"
        } else if (observedPair != "NEIDENTIFICAT" &&
            pairReady(now) && observedPair != trackedPair) {
          onePairEvalEnabled = false
          onePairEvalPair = null
          onePairEvalButton?.text = "AUTO SIM OFF"
          touchProbeStatus?.text = "ALTĂ PERECHE • AUTO SIM OPRIT"
        } else if (activeSignal != "NONE" && lockedAt > 0L &&
            lockedAt != onePairEvalLastLockAt &&
            trackedPair != null && observedPair == trackedPair &&
            onePairEvalRow?.visibility == View.VISIBLE &&
            touchProbeRow?.visibility == View.VISIBLE &&
            TouchTestService.ready()) {
          onePairEvalLastLockAt = lockedAt
          onePairEvalTouch?.invoke(activeSignal)
        }
      }
      // Test BUY is driven by its own foreground timer, independently of the
      // optical analyzer and updateOverlay() callbacks. No SHOCK gates here.
      // No ON/OFF button: the user explicitly starts Android screen capture
      // once in the app. Auto-arming uses EXACTLY the same QT Demo, 1 USD,
      // payout >=92%, visible-pair and unique BUY/SELL checks as the former button.
      // If Android/WebView cannot prove them, NO ORDER is sent.
      if (!fxRotationNavigating && autoDemoSessionRequested && !autoDemoSessionConsumed && !autoDemoArmed &&
          tradePositionGate.state() == TradePositionGate.State.READY &&
          !closedHistoryInspectionInProgress) {
        val nowClock = android.os.SystemClock.elapsedRealtime()
        if (nowClock >= autoDemoSessionEndAt) {
          autoDemoSessionRequested = false
          autoDemoSessionConsumed = true
          touchProbeStatus?.text = "SESIUNE ÎNCHEIATĂ • PORNEȘTE LIVE DIN NOU"
        } else if (nowClock - autoDemoLastPreflightAt >= 2500L ||
            autoDemoLastPreflightAt == 0L) {
          autoDemoLastPreflightAt = nowClock
          val pair = currentPair(now)
          val diagnostic = when {
            !TouchTestService.ready() -> "ACCESIBILITATE NECONECTATĂ"
            !pairReady(now) || pair == "NEIDENTIFICAT" ->
              if (pendingMarket != null)
                "PERECHE OCR: " + pendingMarket + " • " +
                  pendingMarketCount.coerceAtMost(MARKET_OCR_CONFIRMATIONS) +
                  "/" + MARKET_OCR_CONFIRMATIONS +
                  (if (marketVerified) " • STABILIZARE" else " • VERIFICARE")
              else "PERECHE OCR NECITITĂ • MĂRESC SELECTORUL"
            // Audible BIP is a preference, NOT an execution prerequisite.
            // A verified SHOCK may trigger the one-shot DEMO order with audio
            // muted; all visual, broker and position safety gates stay on.
            !tfReady -> "TF NECONFIRMAT"
            !brokerConnected -> "CADRE LIVE NECONFIRMATE"
            else -> try {
              val nextStake429 = if (CHART_ONLY_DEMO_462) null else desiredVerifiedDemoStake429(pair)
              when {
                CHART_ONLY_DEMO_462 ->
                  if (TouchTestService.readBrokerDemoOrder476(pair) != null)
                    "PREGĂTIT AUTO DEMO"
                  else "BLOCAT: MIZĂ / PAYOUT / TIMP QT DEMO NECONFIRMATE"
                nextStake429 == null -> "BLOCAT: REZULTAT / MIZĂ DEMO NECONFIRMATĂ"
                nextStake429 == 100L ->
                  TouchTestService.preflightOneDollarDemoOrder(pair)
                else -> TouchTestService.preflightVerifiedDemoStake429(pair, nextStake429)
              }
            } catch (error: Exception) {
              android.util.Log.e("ScalpAtlasRobot", "Auto start DEMO preflight failed", error)
              "EROARE ANDROID " + error.javaClass.simpleName.take(20)
            }
          }
          autoDemoLastPreflightReason = diagnostic.take(95)
          if (diagnostic.startsWith("PREGĂTIT AUTO DEMO")) {
            autoDemoLastPreflightReason = "PREGĂTIT"
            autoDemoArmed = true
            autoDemoMarket = pair
            // 453: Analyzer-confirmed BIP and broker preflight may complete
            // in the SAME overlay callback. 452 copied lockedAt here, making
            // the genuine just-emitted SHOCK look like an old signal; it was
            // silently skipped even though DEMO was already user-authorized.
            // Accept this fresh, current-cycle SHOCK once (<=4 seconds old).
            // Never replay a pre-capture BIP or one from a previously
            // unresolved trade. The gesture still needs ALL independent
            // broker/amount/payout/fresh-frame checks below.
            val freshJustConfirmedShock453 = activeSignal != "NONE" &&
              activeStrategy == "SHOCK" &&
              lockedAt > autoDemoEntryCycleStartedAt &&
              now - lockedAt in 0L..4_000L &&
              lastConfirmedShockPercent > SHOCK_MIN_DEPTH
            autoDemoLockedAt = if (freshJustConfirmedShock453)
              lockedAt - 1L else lockedAt
            autoDemoExpiry = autoDemoSessionEndAt
            touchProbeStatus?.text = "🤖 DEMO AUTO • MIZĂ VERIFICATĂ • AȘTEAPTĂ ȘOC"
          } else {
            touchProbeStatus?.text = "🤖 DEMO AȘTEAPTĂ: " + diagnostic
          }
        }
      }
      // One-shot DEMO order ONLY on a NEW analyzer-confirmed SHOCK lock (sound optional).
      // A five-minute signal display is never a fresh entry instruction.
      if (autoDemoArmed) {
        val expectedPair = autoDemoMarket
        val seenPair = currentPair(now)
        val nowClock = android.os.SystemClock.elapsedRealtime()
        val pairMismatch = expectedPair == null ||
          (seenPair != "NEIDENTIFICAT" && seenPair != expectedPair)
        val pairLostLong = seenPair == "NEIDENTIFICAT" &&
          latestMarketAt > 0L && now - latestMarketAt > MARKET_STALE_MS
        val uiClosed = overlayView == null || !autoDemoSessionRequested
        // A stale persisted order marker always wins over a fresh BIP.
        // Even a concurrently re-armed UI cannot submit a duplicate order.
        val previousDemoUnresolved453 =
          getSharedPreferences(autoShockAttemptPrefs, Context.MODE_PRIVATE)
            .getBoolean("attempted", false) ||
          getSharedPreferences(sell404TestPrefs, Context.MODE_PRIVATE)
            .getBoolean("attempted", false)
        val readyForDemo = !fxRotationNavigating && brokerConnected &&
          !autoDemoSessionConsumed && !previousDemoUnresolved453 &&
          tradePositionGate.state() == TradePositionGate.State.READY &&
          TouchTestService.ready() && pairReady(now) &&
          !pairMismatch && !pairLostLong &&
          seenPair == expectedPair &&
          lastCapturedImageAt > 0L &&
          now - lastCapturedImageAt in 0L..3500L &&
          !manualTfConflict &&
          (!tfAutomatic || (tfVerified &&
            now - confirmedTfAt in 0L..TF_STALE_MS))
        // A displayed signal lock must never replay an entry from an older frame.
        val entryFrameCurrent = entryFrameId > 0L && entryFrameId == frameCount &&
          now - lastFrameAt in 0L..MAX_ALERT_ANALYSIS_AGE_MS
        val newShock = activeSignal != "NONE" && entryFrameCurrent &&
          activeStrategy == "SHOCK" &&
          lastConfirmedShockPercent > SHOCK_MIN_DEPTH &&
          lockedAt > 0L && now - lockedAt in 0L..5000L &&
          lockedAt != autoDemoLockedAt
        // A transient OCR/capture gap must not cancel the whole arm.
        // Suspend while waiting for evidence; NEVER tap without fresh data.
        if (nowClock >= autoDemoExpiry || pairMismatch || pairLostLong ||
            uiClosed || !TouchTestService.ready()) {
          if (nowClock >= autoDemoExpiry || uiClosed) {
            autoDemoSessionRequested = false
            autoDemoSessionConsumed = true
          }
          autoDemoArmed = false
          autoDemoMarket = null
          autoDemoExpiry = 0L
          autoDemoButton?.text = "🤖 PORNEȘTE • ON"
          touchProbeStatus?.text =
            "AUTO DEMO OPRIT • PERECHE/SERVICIU/EXPIRARE"
        } else if (newShock) {
        // 408: A rejected optical/freshness check is NOT a broker order attempt.
        // Never replay this candle, but keep the DEMO session armed so the
        // next NEW verified SHOCK can be evaluated. No click in these paths.
        autoDemoLockedAt = lockedAt
        // 424 does not yet have a broker-verified dynamic-stake order path.
        // Never submit a new fixed-1USD order after a verified DEMO loss:
        // preparing the next stake field is NOT permission to trade it.
        if (closedHistoryInspectionInProgress) {
          touchProbeStatus?.text = "ISTORIC ÎNCHIS • VERIFICARE READ-ONLY • FĂRĂ ORDIN"
        } else if (!CHART_ONLY_DEMO_462 && demoRecoveryLedger.isRecovering429() &&
            desiredVerifiedDemoStake429(expectedPair ?: "NEIDENTIFICAT") == null) {
          touchProbeStatus?.text =
            "RECUPERARE DEMO • QUOTE / PAYOUT / SOLD NECONFIRMATE"
        } else if (!readyForDemo) {
          touchProbeStatus?.text =
            "FĂRĂ ORDIN • CADRU/TF NECONFIRMAT • AȘTEPT ALT ȘOC"
        } else {
          // 419: CRITICAL ORDERING FIX. In 418 the prior-attempt marker was
          // committed BEFORE the broker preflight. If WebView rejected an
          // amount, instrument or payout check, the application nonetheless
          // consumed the session and could remain locked indefinitely without
          // even requesting an Android gesture.
          //
          // A read-only broker preflight must succeed BEFORE beginAttempt()
          // or persistent attempted=true. The gesture function still performs
          // its own fresh preflight after the marker is safely committed.
          // A rejection before persistence never licenses an automatic retry
          // of the SAME SHOCK; only a different, new confirmed lock qualifies.
          val tradePair429 = expectedPair ?: "NEIDENTIFICAT"
          val manualOrder = if (CHART_ONLY_DEMO_462) try {
            TouchTestService.readBrokerDemoOrder476(tradePair429)
          } catch (_: Exception) { null } else null
          val stake429 = if (CHART_ONLY_DEMO_462) manualOrder?.first
            else desiredVerifiedDemoStake429(tradePair429)
          val payout429 = if (CHART_ONLY_DEMO_462) manualOrder?.second
            else if (stake429 != null)
            TouchTestService.readVerifiedDemoPayoutForStake429(tradePair429, stake429)
          else null
          val package429 = TouchTestService.activeDemoExecutorPackageForReview()
          val quoteMatches429 = stake429 != null && payout429 != null &&
            demoRecoveryLedger.quote(payout429).stakeCents == stake429
          val latestPreflight = try {
            when {
              CHART_ONLY_DEMO_462 && (manualOrder == null || package429 == null) ->
                "BLOCAT: MIZĂ / PAYOUT / BROKER NECONFIRMATE"
              CHART_ONLY_DEMO_462 &&
                !TouchTestService.confirmedFiveMinuteDemoExpiry465() ->
                "BLOCAT: TIMP QT DEMO NU ESTE 00:05:00"
              CHART_ONLY_DEMO_462 -> "PREGĂTIT AUTO DEMO"
              !quoteMatches429 || package429 == null ->
                "BLOCAT: MIZĂ / PAYOUT / BROKER NECONFIRMATE"
              stake429 == 100L ->
                TouchTestService.preflightOneDollarDemoOrder(tradePair429)
              else ->
                TouchTestService.preflightVerifiedDemoStake429(tradePair429, stake429!!)
            }
          } catch (error: Exception) {
            android.util.Log.e("ScalpAtlas429", "Dynamic DEMO read-only preflight", error)
            "BLOCAT: VERIFICARE ANDROID " + error.javaClass.simpleName.take(22)
          }
          if (!latestPreflight.startsWith("PREGĂTIT AUTO DEMO")) {
            autoDemoLastPreflightReason = latestPreflight.take(95)
            touchProbeStatus?.text =
              "FĂRĂ ORDIN • PREFLIGHT: " + latestPreflight.take(90)
          } else if (!tradePositionGate.beginAttempt()) {
            touchProbeStatus?.text =
              "FĂRĂ ORDIN NOU • POZIȚIE ANTERIOARĂ NECONFIRMATĂ"
          } else {
            // Once an actual gesture MAY be attempted, persist the global
            // one-shot marker first. A crash must NEVER duplicate a trade.
            val saved = getSharedPreferences(
              autoShockAttemptPrefs, Context.MODE_PRIVATE
            ).edit()
              .putBoolean("attempted", true)
              .putString("expectedPair429", tradePair429)
              .putString("expectedPackage429", package429)
              .putLong("expectedStakeCents429", stake429 ?: -1L)
              .putBoolean("brokerStake476", CHART_ONLY_DEMO_462)
              .putInt("expectedPayout429", payout429 ?: -1)
              .putString("expectedSide437", activeSignal)
              .putLong("attemptedAt429", android.os.SystemClock.elapsedRealtime())
              .putLong("attemptedWallAt454", System.currentTimeMillis())
              .commit()
            if (!saved) {
              tradePositionGate.cancelBeforeDispatch()
              touchProbeStatus?.text =
                "FĂRĂ ORDIN • NU POT SALVA BLOCAREA • AȘTEPT ALT ȘOC"
            } else {
              autoDemoSessionConsumed = true // only a persisted attempt consumes session
              autoDemoArmed = false
              autoDemoMarket = null
              autoDemoExpiry = 0L
              autoDemoButton?.text = "🤖 PORNEȘTE • ON"
              // The exact second preflight runs immediately before the
              // physical gesture. Its explicit PRECHECK_NO_GESTURE result
              // proves that no gesture helper was entered and no broker order
              // was possible. Only THIS case may safely undo a persisted
              // attempted marker, and never replay the old SHOCK lock.
              try {
                val result = if (CHART_ONLY_DEMO_462 && stake429 != 100L)
                  TouchTestService.pressVerifiedDemoStakeOnce429(
                    activeSignal, tradePair429, stake429!!, payout429!!
                  )
                else if (stake429 == 100L)
                  TouchTestService.pressAutoOneDollarDemoOrderOnce(
                    activeSignal, tradePair429
                  )
                else TouchTestService.pressVerifiedDemoStakeOnce429(
                  activeSignal, tradePair429, stake429!!
                )
                if (result.startsWith("PRECHECK_NO_GESTURE:")) {
                  val cleared = getSharedPreferences(
                    autoShockAttemptPrefs, Context.MODE_PRIVATE
                  ).edit().putBoolean("attempted", false).commit()
                  if (cleared && tradePositionGate.cancelBeforeDispatch()) {
                    autoDemoSessionConsumed = false
                    autoDemoArmed = false
                    autoDemoMarket = null
                    autoDemoExpiry = 0L
                    autoDemoLastPreflightAt = 0L
                    autoDemoLastPreflightReason =
                      result.removePrefix("PRECHECK_NO_GESTURE: ").take(95)
                    touchProbeStatus?.text =
                      "FĂRĂ GEST • " + autoDemoLastPreflightReason.take(82) +
                        " • AȘTEPT ALT ȘOC"
                  } else {
                    // Inability to persist the rollback is ambiguous: do
                    // NOT repeat any action until an explicit broker review.
                    tradePositionGate.uncertainResult()
                    touchProbeStatus?.text =
                      "BLOCAT: NU POT MEMORA ANULAREA • FĂRĂ REPETARE"
                  }
                } else {
                  // Any result from a physical gesture helper is uncertain
                  // even if Android reported cancellation or rejection.
                  tradePositionGate.uncertainResult()
                  touchProbeStatus?.text = result
                }
              } catch (error: Exception) {
                android.util.Log.e("ScalpAtlasRobot", "419 uncertain gesture", error)
                tradePositionGate.uncertainResult()
                touchProbeStatus?.text =
                  "GEST NECONFIRMAT • ANDROID " + error.javaClass.simpleName.take(22) +
                    " • VERIFICĂ ISTORIC"
              }
            }
          }
        }
      } else if (!readyForDemo) {
          // Diagnostic only; keeps the arm alive for the next fresh frame.
          touchProbeStatus?.text =
            "AUTO DEMO ARMAT • AȘTEAPTĂ CADRU/TF ACTUAL • FĂRĂ ORDIN"
        }
      }
      setPulseRing(activeSignal)
      setSignalBlink(activeSignal)
      val percentFromCandle = when {
        brokerConnected && (green || red) &&
          lockedDir == signal && now < lockedUntil &&
          activeStrategy == "SCALP_TREND" -> lastConfirmedScalpPercent
        brokerConnected && (green || red) &&
          lockedDir == signal && now < lockedUntil &&
          lastConfirmedShockPercent > SHOCK_MIN_DEPTH -> lastConfirmedShockPercent
        brokerConnected && observedShockAt > 0L &&
          now - observedShockAt in 0L..3000L -> observedShockPercent
        else -> 0
      }
      // A valid LIVE candle with no qualifying pullback means zero
      // DETECTED shock, not missing capture. Never portray 0% as entry.
      val shockObserved = brokerConnected && opticalFresh
      val shockDisplay = if (percentFromCandle > 0 || shockObserved)
        percentFromCandle.toString() + "%" else "—%"
      qualityText?.text = shockDisplay
      compactStatusText?.text = when (activeSignal) {
        "BUY", "SELL" -> activeSignal + " " + shockDisplay
        else -> "ȘOC " + shockDisplay
      }
      compactStatusText?.setTextColor(when (activeSignal) {
        "BUY" -> Color.rgb(13, 119, 69)
        "SELL" -> Color.rgb(174, 50, 65)
        else -> Color.rgb(74, 93, 106)
      })
      // The candle glyph may be red/green, but the percentage stays NEUTRAL
      // unless the engine emitted the corresponding confirmed signal.
      qualityText?.setTextColor(if (green || red) visualTone else Color.rgb(90, 104, 114))
      val measuredTime = when {
        brokerConnected && (green || red) && lockedDir == signal &&
          now < lockedUntil -> lastConfirmedShockDurationMs
        brokerConnected && observedShockAt > 0L &&
          now - observedShockAt in 0L..3000L -> observedShockDurationMs
        else -> 0L
      }
      shockDurationText?.text = if (measuredTime > 0L)
        ((measuredTime / 100f).roundToInt() / 10f).toString() + " s" else "— s"
      shockReasonText?.text = if (brokerConnected) {
        if (green || red) "BIP CONFIRMAT" else shockBlocker
      } else "FĂRĂ DATE LIVE"
      wickText?.text = if (brokerConnected && observedWickAt > 0L &&
        now-observedWickAt in 0L..3000L) "FITIL " + observedWickPercent + "%"
        else "FITIL —%"
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
            .putString("tfOcrSource", if (tfReady) lastTfOcrSource else "NECONFIRMAT")
            .putString("shockBlocker", if (brokerConnected) shockBlocker else "NECONFIRMAT")
            .putString("scalpBlocker", if (brokerConnected) scalpBlocker else "NECONFIRMAT")
            .putString("demoRecoveryPlan92ReadOnly", demoRecoveryLedger.diagnostic(92))
            .putLong("frames", frameCount)
            .putLong("results", resultCount)
            .putLong("errors", errorCount)
            .putInt("trendHistoryCount", if (opticalFresh) observedTrendHistoryCount else 0)
            .putBoolean("trendMeasured", trendFresh)
            .putInt("opticalQuality", if (opticalFresh) observedOpticalQuality else 0)
            .putString("candleDirection", if (opticalFresh) observedCandleDirection else "NONE")
            .putLong("updatedAt", now)
            .apply()
        } catch (_: Throwable) {
          // Diagnostics must never interrupt screen capture or SHOCK signals.
        }
      }
      // 451: Draw a read-only recovery quote in the always-visible compact
      // row. It comes from the SAME persisted broker-receipt ledger used by
      // the executor. The actual ORDER stake still needs fresh broker payout,
      // balance and amount-field read-back in the separate QT DEMO preflight.
      // Never infer a LOSS from candle colour, timer, empty OPEN tab or bip.
      val mgText451 = martingaleStatusText
      if (mgText451 != null) {
        val verifiedDemo451 =
          lastBrokerAccountStatus.contains("QT DEMO IDENTIFICAT") &&
          !lastBrokerAccountStatus.contains("QT REAL")
        val unresolvedOld451 = autoDemoSessionConsumed ||
          getSharedPreferences(autoShockAttemptPrefs, Context.MODE_PRIVATE)
            .getBoolean("attempted", false) ||
          getSharedPreferences(sell404TestPrefs, Context.MODE_PRIVATE)
            .getBoolean("attempted", false)
        val recoveryQuote451 = demoRecoveryLedger.quote(92) // preview only
        val recoveryCents451 = recoveryQuote451.stakeCents
        val recoveryActive451 = demoRecoveryLedger.isRecovering429()
        mgText451.text = when {
          CHART_ONLY_DEMO_462 -> "MIZĂ SETATĂ ÎN BROKER"
          !verifiedDemo451 -> "MG: DOAR QT DEMO"
          unresolvedOld451 || demoRecoveryLedger.verifiedOpenPositionId429() != null ->
            "MG BLOCAT • ORDIN NEVERIFICAT"
          demoRecoveryLedger.needsBaseStakeReset() ->
            "MG: RESET 1,00 USD • AȘTEPT"
          recoveryCents451 == null -> "MG STOP • " + recoveryQuote451.reason.take(17)
          recoveryActive451 ->
            "MG PLAN 92%: " +
              (recoveryCents451 / 100L).toString() + "," +
              (recoveryCents451 % 100L).toString().padStart(2, '0') + " USD"
          else -> "MIZĂ 1,00 USD • MG DEMO"
        }
        mgText451.setTextColor(
          if (verifiedDemo451 && !unresolvedOld451 &&
              recoveryCents451 != null && recoveryActive451)
            Color.rgb(39, 111, 79)
          else Color.rgb(97, 108, 119)
        )
      }
      // Reuse the existing narrow footer; no extra controls in compact mode.
      // Display a reason, not a false probability of winning.
      signalGateNote?.text = when {
        lastBrokerAccountStatus.contains("QT REAL IDENTIFICAT") ->
          "QT REAL • SCANARE LIVE • ORDINE BLOCATE"
        lastBrokerAccountStatus.contains("QT DEMO IDENTIFICAT") &&
          autoDemoArmed && !autoDemoSessionConsumed ->
          "🤖 ȘOC SIMPLU 30/20 + FITIL • " + if (activeStrategy == "SHOCK" &&
              activeSignal != "NONE") "ȘOC CONFIRMAT"
            else "ȘOC: " + shockBlocker.take(42)
        lastBrokerAccountStatus.contains("QT DEMO IDENTIFICAT") &&
          autoDemoSessionConsumed -> {
          val priorSellTest = getSharedPreferences(
            sell404TestPrefs, Context.MODE_PRIVATE
          ).getBoolean("attempted", false)
          if (priorSellTest)
            "🔒 ȘOC FLEX • ORDINE BLOCATE • TEST SELL ANTERIOR NECONFIRMAT"
          else "🔒 ȘOC FLEX • ORDINE BLOCATE • ÎNCHIDERE NEVERIFICATĂ"
        }
        lastBrokerAccountStatus.contains("QT DEMO IDENTIFICAT") ->
          if (autoDemoSessionRequested)
            "DEMO NEARMAT • " + autoDemoLastPreflightReason.take(65)
          else "DEMO AUTO OPRIT • " + autoDemoLastPreflightReason.take(65)
        lastBrokerAccountStatus.contains("BROKER NECONFIGURAT") -> {
          // 401: show the actual active Android package and SHOCK gate,
          // so a screenshot distinguishes Chrome/PWA/overlay from the
          // verified broker app without sending unsafe orders.
          val appId = lastBrokerAccountStatus
            .substringAfter("APP: ", "NECITIT")
            .substringBefore(" •").take(37)
          "APP: " + appId + "\n" +
            (if (activeSignal == "NONE") "FĂRĂ BUY/SELL: " +
              shockBlocker.take(42) else "SEMNAL • BROKER NECONFIGURAT")
        }
        tradePositionGate.state() == TradePositionGate.State.UNKNOWN ->
          "POZIȚIE NECONFIRMATĂ • VERIFICĂ BROKERUL"
        green || red -> "SEMNAL CONFIRMAT • NU EXECUTĂ ORDINE"
        scanStatus != "LIVE" -> "SCAN " + scanStatus + " • FĂRĂ SEMNAL"
        selectedTimeframe == "M5" && shockBlocker == "AȘTEAPTĂ ȘOC" ->
          "M5 • " + scalpBlocker
        else -> "ȘOC: " + shockBlocker + " • NU WIN"
      }
      // 402: compact card shows probeStatus (the note above is hidden in
      // minimized mode). Keep the exact SHOCK reason visible to the user
      // without opening PROBĂ and without inventing BUY/SELL orders.
      if (autoDemoSessionRequested && !autoDemoSessionConsumed &&
          lastBrokerAccountStatus.contains("QT DEMO IDENTIFICAT")) {
        touchProbeStatus?.text = when {
          // A real SCALP TREND alert may legitimately BIP on M5; only SHOCK
          // is permitted to submit a DEMO broker order in this build.
          activeSignal != "NONE" && activeStrategy == "SCALP_TREND" ->
            "🔔 " + activeSignal + " • SCALP M5 • FĂRĂ ORDIN: NU ESTE ȘOC"
          activeSignal != "NONE" && !autoDemoArmed ->
            "🔔 " + activeSignal + " • FĂRĂ ORDIN: " +
              autoDemoLastPreflightReason.take(47)
          autoDemoArmed && activeSignal == "NONE" ->
            if (scanStatus != "LIVE")
              "🤖 AUTO DEMO • SCAN " + scanStatus
            else "🤖 ȘOC FLEX 30/20/25 • " + shockBlocker.take(39)
          !autoDemoArmed ->
            "🤖 DEMO NEARMAT • " + autoDemoLastPreflightReason.take(62)
          else -> touchProbeStatus?.text?.toString().orEmpty()
        }
      }
      // Preserve the result of a user-triggered physical DEMO gesture pilot;
      // the frequent account monitor must not hide a possible broker order.
      if (autoDemoSessionConsumed &&
          lastBrokerAccountStatus.contains("QT DEMO IDENTIFICAT")) {
        touchProbeStatus?.text = when {
          demoEmptyReviewReads == 1 ->
            "🔒 DEMO • 0 POZIȚII 1/2 • AȘTEPT A DOUA CITIRE"
          // The 5-minute broker gesture cooldown is mandatory, even if an
          // apparently empty chart would otherwise appear executable.
          !TouchTestService.priorDemoGestureCooldownComplete() ->
            "🔒 DEMO • PAUZĂ DE SIGURANȚĂ 5 MINUTE"
          !TouchTestService.ready() ->
            "🔒 DEMO • ACCESIBILITATE NECONECTATĂ"
          verifiedClosedDetail437 != null &&
            now - verifiedClosedDetailAt437 in 0L..90_000L ->
            "📋 ÎNCHIS 2/2 • DESCHIDE TRANZACȚII > DESCHIS"
          firstClosedDetail437 != null &&
            now - firstClosedDetailAt437 in 0L..15_000L ->
            "📋 DETALIU ÎNCHIS 1/2 • CITES CEA DE-A DOUA DOVADĂ"
          // 440: Real navigation errors must be visible above the generic
          // old-ID lock. The lock is still mandatory and never auto-cleared
          // just because the page, pair or any price changed.
          lastAutoDemoHistoryNavStatus.isNotBlank() &&
            android.os.SystemClock.elapsedRealtime() - lastAutoDemoHistoryNavStatusAt in 0L..14_000L ->
            "🔒 DEMO • " + lastAutoDemoHistoryNavStatus.take(90)
          getSharedPreferences(autoShockAttemptPrefs, Context.MODE_PRIVATE)
            .let { prior ->
              prior.getBoolean("attempted", false) &&
                !prior.getString("expectedPair429", null).isNullOrBlank() &&
                demoRecoveryLedger.verifiedOpenPositionId429() == null &&
                android.os.SystemClock.elapsedRealtime() -
                  prior.getLong("attemptedAt429", -1L) !in 0L..110_000L
            } ->
            "🔒 DEMO • ID ORDIN ANTERIOR NECONFIRMAT • CAUT ÎNCHIS"
          activeSignal != "NONE" && activeStrategy == "SCALP_TREND" ->
            "🔒 BIP " + activeSignal + " • SCALP M5 • ȘOC NECONFIRMAT"
          activeSignal != "NONE" && activeStrategy == "SHOCK" ->
            "🔒 BIP " + activeSignal + " • ȘOC VALID • ORDIN BLOCAT: ISTORIC"
          else -> "🔒 DEMO • " + TouchTestService.demoEmptyReviewDiagnostic().take(72)
        }
      }
      // 433: Present a stable history-mode explanation, not the chart
      // errors "TF NECONFIRMAT" or "PERECHE OCR" when browsing old trades.
      // Important broker safety / verified-zero status must remain visible.
      if (historyPageVisible433 && now - historyPageLastSeen433 in 0L..6_000L) {
        val oldLabel433 = touchProbeStatus?.text?.toString().orEmpty()
        val chartOnlyMessage433 =
          oldLabel433.contains("TF NECONFIRMAT") ||
          oldLabel433.contains("PERECHE OCR") ||
          oldLabel433.contains("DEMO NEARMAT") ||
          oldLabel433.contains("SCAN TF") ||
          oldLabel433.contains("AȘTEAPTĂ ȘOC") ||
          oldLabel433.contains("LUMÂNARE?")
        if (chartOnlyMessage433) {
          touchProbeStatus?.text = "📋 ISTORIC DEMO • " +
            historyPageTab433 + " • FĂRĂ ANALIZĂ ȘOC"
        }
      }
      // The old manual SELL pilot must not overwrite current automatic
      // readiness or lock diagnostics. It is only shown while no automatic
      // DEMO workflow is in progress and no previous order remains pending.
      if (!autoDemoSessionRequested && !autoDemoSessionConsumed) {
        sell404Diagnostic?.let { touchProbeStatus?.text = it.take(120) }
      }
      captureStatusText?.text = scanStatus
      setLiveCameraDotActive(scanStatus == "LIVE")
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
    demoClickTestPending = false
    demoClickMonitorRunning = false
    brokerAccountMonitorRunning = false
    sell404Diagnostic = null
    autoDemoSessionRequested = false
    autoDemoSessionConsumed = true
    shuttingDown = true
    if (activeOverlayService === this) activeOverlayService = null
    mainHandler.post {
      stopLiveCameraDot()
      stopPulseRing()
      stopNeonEdge434()
      stopSignalBlink()
    }
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
    try { tfCropOcrRecognizer.close() } catch (_: Throwable) {}
    try { pairCropOcrRecognizer.close() } catch (_: Throwable) {}
    onePairEvalEnabled = false
    onePairEvalPair = null
    onePairEvalTouch = null
    onePairEvalButton = null
    onePairEvalRow = null
    demoBrokerInspectionRow = null
    demoBrokerOrderRow = null
    demoAmountCheckRow = null
    autoDemoArmed = false
    autoDemoMarket = null
    autoDemoExpiry = 0L
    autoDemoButton = null
    autoDemoRow = null
    martingaleStatusText = null
    onePairEvalAutoPending = false
    overlayWindowParams = null
    virtualDisplay = null
    imageReader = null
    mediaProjection = null

    try { captureThread?.quitSafely() } catch (_: Throwable) {}
    captureThread = null
    captureHandler = null

    mainHandler.post {
      rotatingBrainAnimator467?.cancel()
      rotatingBrainAnimator467 = null
      try { analyzerWebView?.destroy() } catch (_: Throwable) {}
      analyzerWebView = null
      try { overlayView?.let { windowManager.removeView(it) } } catch (_: Throwable) {}
      overlayView = null
    }

    super.onDestroy()
  }
}
