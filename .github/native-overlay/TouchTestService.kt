package com.scalpatlas.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.ComponentName
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.graphics.Path
import android.graphics.Rect
import android.view.View
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo

/** A user-invoked read-only broker-label probe and isolated test gestures. No broker orders. */
class TouchTestService : AccessibilityService() {
  companion object {
    @Volatile private var connected: TouchTestService? = null
    fun ready(): Boolean = connected != null
    @Volatile private var demoEmptyReviewStatus = "DESCHIDE TRANZACȚII > DESCHIS"
    fun demoEmptyReviewDiagnostic(): String = demoEmptyReviewStatus

    // 446 diagnostic: Android 14 may focus SystemUI while Pocket Option
    // remains visibly underneath. Report only package/window visibility,
    // never a screenshot, account balance, UUID or an order instruction.
    // Diagnostic readings NEVER authorize broker gestures.
    fun brokerWindowDiagnostic446(): String {
      val svc = connected ?: return "ACC:OFF"
      val activePackage = try {
        svc.rootInActiveWindow?.packageName?.toString().orEmpty()
      } catch (_: Throwable) { "" }
      val windows = try { svc.windows.orEmpty() } catch (_: Throwable) {
        emptyList<AccessibilityWindowInfo>()
      }
      val appWindows = windows.filter {
        it.type == AccessibilityWindowInfo.TYPE_APPLICATION
      }
      val foundBrokerWindow = appWindows.any {
        try {
          BrokerAdapterRegistry.hasDemoExecutor(it.root?.packageName?.toString().orEmpty())
        } catch (_: Throwable) { false }
      }
      val readableBroker = try { readOnlyBrokerRoot(svc) != null }
        catch (_: Throwable) { false }
      val app = when {
        activePackage.isBlank() -> "NUL"
        BrokerAdapterRegistry.hasDemoExecutor(activePackage) -> "BROKER"
        activePackage == svc.packageName -> "SCALP"
        activePackage.contains("systemui", ignoreCase = true) -> "SYSTEMUI"
        else -> activePackage.substringAfterLast('.').take(16)
      }
      return "ACT:" + app + " W:" + windows.size +
        " B:" + (if (foundBrokerWindow) "DA" else "NU") +
        " R:" + (if (readableBroker) "DA" else "NU")
    }

    /**
     * 411: Android may temporarily focus com.android.systemui while the
     * Pocket Option chart remains visibly underneath screen-share UI.
     * Read-only probes may inspect the visible, verified broker application
     * window. NEVER use this fallback to dispatch gestures or place orders:
     * the order path still requires rootInActiveWindow and all fresh checks.
     */
    private fun readOnlyBrokerRoot(svc: TouchTestService): AccessibilityNodeInfo? {
      val foreground = svc.rootInActiveWindow
      val foregroundPkg = foreground?.packageName?.toString().orEmpty()
      if (BrokerAdapterRegistry.hasDemoExecutor(foregroundPkg)) return foreground

      val metrics = android.util.DisplayMetrics()
      try {
        val manager = svc.getSystemService(Context.WINDOW_SERVICE)
          as android.view.WindowManager
        @Suppress("DEPRECATION")
        manager.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return null }
      if (metrics.widthPixels < 300 || metrics.heightPixels < 600) return null

      return try {
        svc.windows.orEmpty().asSequence()
          .filter { it.type == AccessibilityWindowInfo.TYPE_APPLICATION }
          .filter { window ->
            val bounds = Rect()
            window.getBoundsInScreen(bounds)
            bounds.width() >= metrics.widthPixels * 0.60f &&
              bounds.height() >= metrics.heightPixels * 0.50f
          }
          .mapNotNull { it.root }
          .firstOrNull { node ->
            val pkg = node.packageName?.toString().orEmpty()
            if (!BrokerAdapterRegistry.hasDemoExecutor(pkg)) return@firstOrNull false
            if (node.isVisibleToUser) return@firstOrNull true
            // 443: On Android 14 a broker WebView can have a non-visible
            // ROOT while its actual child controls are visibly rendered.
            // Read-only detection may use a visible descendant of that same
            // full-size, allowlisted broker window. Gestures still require
            // the independently checked active foreground broker root.
            val queue = ArrayDeque<AccessibilityNodeInfo>()
            queue.add(node)
            var scanned = 0
            var visibleBrokerChild = false
            while (queue.isNotEmpty() && scanned++ < 100 &&
                   !visibleBrokerChild) {
              val candidate = queue.removeFirst()
              if (candidate !== node &&
                  candidate.packageName?.toString() == pkg &&
                  candidate.isVisibleToUser) {
                val b = Rect()
                candidate.getBoundsInScreen(b)
                visibleBrokerChild = !b.isEmpty &&
                  b.left >= 0 && b.top >= 0 &&
                  b.right <= metrics.widthPixels &&
                  b.bottom <= metrics.heightPixels
              }
              if (!visibleBrokerChild)
                for (i in 0 until candidate.childCount.coerceAtMost(25))
                  candidate.getChild(i)?.let(queue::addLast)
            }
            visibleBrokerChild
          }
      } catch (_: Throwable) { null }
    }

    /**
     * Distinguish the user-granted Android accessibility setting from the
     * live service binding. Enabling a service is exclusively Android's job.
     * No gesture is allowed unless the service is genuinely bound.
     */
    fun accessDiagnostic(context: Context): String {
      if (ready()) return "ROBOT CONECTAT • APASĂ SIM BUY SAU SIM SELL"
      return try {
        val manager = context.getSystemService(Context.ACCESSIBILITY_SERVICE)
          as AccessibilityManager
        val enabled = manager.getEnabledAccessibilityServiceList(
          AccessibilityServiceInfo.FEEDBACK_ALL_MASK
        ).any { info ->
          val serviceInfo = info.resolveInfo?.serviceInfo
          serviceInfo?.packageName == context.packageName &&
            serviceInfo.name == TouchTestService::class.java.name
        }
        // Some OEMs omit a stopped or failed accessibility binding from
        // the active feedback list even though the user enabled it. Read the
        // documented setting too, without changing it or granting access.
        val enabledSetting = Settings.Secure.getString(
          context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ).orEmpty().split(':').any { flat ->
          val component = ComponentName.unflattenFromString(flat.trim())
          component?.packageName == context.packageName &&
            component?.className == TouchTestService::class.java.name
        }
        if (enabled || enabledSetting)
          "ACCES DEJA PERMIS • SERVICIUL ANDROID NU ESTE CONECTAT"
        else
          "ACCES OPRIT ÎN ANDROID • VERIFICĂ ACCESIBILITATE"
      } catch (_: Throwable) {
        "NU POT CITI STAREA SERVICIULUI ANDROID"
      }
    }
    /**
     * 399: Read-only REAL/DEMO identification from the broker's VISIBLE header.
     * Never performs gestures or infers a REAL account from prices/balance.
     * Unknown brokers remain analysis-only until an adapter is validated.
     */
    fun inspectBrokerAccountReadOnly(): String {
      val svc = connected ?: return "ACCESIBILITATE NECONECTATĂ • NUMAI SCANARE"
      val root = readOnlyBrokerRoot(svc)
        ?: return "BROKER INVIZIBIL • " + brokerWindowDiagnostic446() +
          " • FĂRĂ ORDIN"
      val pkg = root.packageName?.toString().orEmpty()
      val adapter = BrokerAdapterRegistry.forPackage(pkg)
      if (adapter.id == "unrecognized") {
        return "BROKER NECONFIGURAT • APP: " + pkg.take(55) + " • FĂRĂ ORDINE"
      }
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Exception) {
        return "ECRAN NECONFIRMAT • FĂRĂ ORDINE"
      }
      val labels = ArrayList<String>()
      val queue = ArrayDeque<AccessibilityNodeInfo>()
      queue.add(root)
      var visited = 0
      while (queue.isNotEmpty() && visited++ < 250) {
        val node = queue.removeFirst()
        if (node.packageName?.toString() == pkg && node.isVisibleToUser) {
          val rect = Rect()
          node.getBoundsInScreen(rect)
          if (!rect.isEmpty && rect.top >= 0 &&
              rect.bottom <= metrics.heightPixels &&
              rect.centerY() < metrics.heightPixels * 0.29f) {
            node.text?.toString()?.trim()?.takeIf { it.isNotBlank() }?.let {
              labels.add(it.take(100))
            }
            node.contentDescription?.toString()?.trim()?.takeIf { it.isNotBlank() }?.let {
              labels.add(it.take(100))
            }
          }
        }
        for (i in 0 until node.childCount.coerceAtMost(30))
          node.getChild(i)?.let(queue::addLast)
      }
      val observed = BrokerAdapterRegistry.observeAccount(pkg, labels)
      return when (observed.account) {
        BrokerAdapterRegistry.Account.REAL ->
          "QT REAL IDENTIFICAT • SCANARE ȘOC • EXECUȚIE REAL BLOCATĂ"
        BrokerAdapterRegistry.Account.DEMO ->
          "QT DEMO IDENTIFICAT • SCANARE ȘOC • TEST DEMO DISPONIBIL"
        BrokerAdapterRegistry.Account.UNKNOWN ->
          "CONT NECLAR • SCANARE ȘOC • FĂRĂ ORDINE"
      }
    }

    /**
     * READ-ONLY validation of the visible broker interface for a future
     * explicit DEMO-only test. The service never clicks, dispatches gestures,
     * or captures text/screenshot in this method.
     *
     * In particular, DEMO cannot be inferred from a balance or a screenshot
     * pattern; the Accessibility tree must explicitly expose "QT Demo".
     */

    /**
     * Read-only FX pair from the currently visible QT Demo broker header.
     * Returns just one unambiguous instrument label, otherwise null.
     * This never clicks broker buttons or submits orders.
     */
    fun readVisibleDemoPair(): String? {
      val svc = connected ?: return null
      val root = readOnlyBrokerRoot(svc) ?: return null
      val pkg = root.packageName?.toString().orEmpty()
      if (pkg.isBlank() || pkg == svc.packageName ||
          pkg.startsWith("com.android.settings") ||
          pkg.contains("calculator", ignoreCase = true)) return null
      val metrics = android.util.DisplayMetrics()
      try {
        val manager = svc.getSystemService(Context.WINDOW_SERVICE)
          as android.view.WindowManager
        @Suppress("DEPRECATION")
        manager.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return null }
      if (metrics.heightPixels < 650) return null
      val labels = ArrayList<Pair<String, Rect>>()
      val queue = ArrayDeque<AccessibilityNodeInfo>()
      queue.add(root)
      var visited = 0
      while (queue.isNotEmpty() && visited++ < 300) {
        val node = queue.removeFirst()
        if (node.packageName?.toString() == pkg && node.isVisibleToUser) {
          val bounds = Rect()
          node.getBoundsInScreen(bounds)
          if (!bounds.isEmpty && bounds.top >= 0 &&
              bounds.bottom <= metrics.heightPixels &&
              bounds.left >= 0 && bounds.right <= metrics.widthPixels) {
            val text = node.text?.toString()?.trim().orEmpty()
            val desc = node.contentDescription?.toString()?.trim().orEmpty()
            if (text.isNotEmpty()) labels.add(text.take(90) to Rect(bounds))
            if (desc.isNotEmpty() && desc != text)
              labels.add(desc.take(90) to Rect(bounds))
          }
        }
        for (i in 0 until node.childCount.coerceAtMost(35))
          node.getChild(i)?.let { queue.addLast(it) }
      }
      val all = labels.map { it.first }
      val demo = all.any { Regex("""(?i)\bQT\s*Demo\b""").containsMatchIn(it) }
      val real = all.any { Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(it) }
      if (!demo || real) return null
      val pattern = Regex("""(?i)(?<![A-Z])([A-Z]{3})\s*/\s*([A-Z]{3})\b(?:\s*\(?\s*(OTC)\s*\)?)?""")
      val instruments = labels.mapNotNull { (value, bounds) ->
        if (bounds.centerY() !in
          (metrics.heightPixels * 0.105f).toInt()..(metrics.heightPixels * 0.33f).toInt() ||
          bounds.centerX() > metrics.widthPixels * 0.70f ||
          value.length > 46) return@mapNotNull null
        val match = pattern.find(value) ?: return@mapNotNull null
        val suffix = if (match.groupValues[3].isNotBlank()) " OTC" else ""
        match.groupValues[1].uppercase() + "/" + match.groupValues[2].uppercase() + suffix
      }.distinct()
      return instruments.singleOrNull()
    }

    /**
     * 405: read-only, broker-specific open-position hint for Pocket Option
     * DEMO. The blue "Tranzacții 1" badge is evidence of an open item,
     * but its ABSENCE is NEVER proof of closure. Never place orders here.
     *
     * The history panel's position ID + an explicit closed receipt will be
     * needed before the separate order gate can be safely rearmed. Other
     * broker applications remain scan-only until validated independently.
     */
    /**
     * 409: A POSITIVE read-only confirmation that the user has opened the
     * broker's Transactions > Open tab and that Pocket Option explicitly
     * states there are NO placed transactions. Missing a small counter badge
     * on the chart is NOT enough. This does not click or submit an order.
     *
     * Must be polled on two separate checks by ScalpOverlayService; each
     * check independently identifies QT Demo and the broker package.
     */
    // 410: The transaction-history screen can hide the QT Demo account header.
    // Only a fresh, same-package QT Demo proof from the chart may substitute
    // for that header while READING an explicitly empty Open tab. Actual order
    // preflight still independently requires QT Demo on the visible chart.
    fun activeDemoExecutorPackageForReview(): String? {
      val svc = connected ?: return null
      val pkg = readOnlyBrokerRoot(svc)?.packageName?.toString().orEmpty()
      return pkg.takeIf { BrokerAdapterRegistry.hasDemoExecutor(it) }
    }

    // 417: Navigation is restricted to NON-ORDER controls of the already
    // active, recognized QT Demo broker. The old uncertain order can be
    // rearmed only by the independent 2/2 explicit empty-Open verification.
    // 427: Two separate, stable CLOSED receipt reads. IDs/P&L stay in
    // memory only; neither a colour nor the empty OPEN tab proves LOSS.
    private var closedCandidateKey427: String? = null
    private var closedCandidateFirstAt427 = 0L
    @Volatile private var closedEvidenceDiagnostic427 = "ÎNCHIS • AȘTEPT DATE EXPLICITE"
    fun closedEvidenceDiagnostic427(): String = closedEvidenceDiagnostic427
    @Volatile private var demoHistoryNavigationStatus = "ISTORIC NECONSULTAT"
    // 456: A gesture can be accepted, completed or cancelled by Android.
    // None of these states proves that Pocket Option changed pages.
    @Volatile private var demoNavGestureFeedback456 = "GEST NEÎNCERCAT"
    fun demoHistoryNavigationDiagnostic(): String =
      if (demoHistoryNavigationStatus.contains("GEST TRIMIS") ||
          demoHistoryNavigationStatus.contains("DESCHID TRANZACȚII"))
        demoHistoryNavigationStatus + " • " + demoNavGestureFeedback456
      else demoHistoryNavigationStatus

    private fun activeDemoHistoryNodes(
      cachedDemoVerifiedOnChart: Boolean
    ): Triple<TouchTestService, AccessibilityNodeInfo, List<Pair<AccessibilityNodeInfo, Rect>>>? {
      val svc = connected ?: return null
      // 443: Collect READ-ONLY broker labels from the same visible,
      // allowlisted application window even if Android focuses SystemUI.
      // Every navigation/gesture helper independently requires the active
      // foreground broker root before any ACTION_CLICK/dispatchGesture.
      // Never treat this fallback as authorization for BUY/SELL.
      val root = readOnlyBrokerRoot(svc) ?: return null
      val pkg = root.packageName?.toString().orEmpty()
      if (!BrokerAdapterRegistry.hasDemoExecutor(pkg)) return null
      val display = android.util.DisplayMetrics()
      try {
        val manager = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        manager.defaultDisplay.getRealMetrics(display)
      } catch (_: Throwable) { return null }
      if (display.widthPixels < 300 || display.heightPixels < 600) return null
      val result = ArrayList<Pair<AccessibilityNodeInfo, Rect>>()
      val queue = ArrayDeque<AccessibilityNodeInfo>()
      queue.add(root)
      var checked = 0
      var seenDemo = false
      var seenReal = false
      while (queue.isNotEmpty() && checked++ < 350) {
        val node = queue.removeFirst()
        if (node.packageName?.toString() == pkg && node.isVisibleToUser) {
          val rect = Rect()
          node.getBoundsInScreen(rect)
          if (!rect.isEmpty && rect.left >= 0 && rect.top >= 0 &&
              rect.right <= display.widthPixels && rect.bottom <= display.heightPixels) {
            val texts = listOfNotNull(node.text?.toString(), node.contentDescription?.toString())
            if (rect.centerY() < display.heightPixels * 0.29f) {
              if (texts.any { Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(it) })
                seenReal = true
              if (texts.any { Regex("""(?i)\bQT\s*Demo\b""").containsMatchIn(it) })
                seenDemo = true
            }
            if (texts.isNotEmpty()) result.add(node to Rect(rect))
          }
        }
        for (i in 0 until node.childCount.coerceAtMost(35))
          node.getChild(i)?.let(queue::addLast)
      }
      if (seenReal || (!seenDemo && !cachedDemoVerifiedOnChart)) return null
      return Triple(svc, root, result)
    }

    data class DemoFxQuote(val pair: String, val payout: Int)

    private data class DemoFxRow(val quote: DemoFxQuote, val node: AccessibilityNodeInfo, val bounds: Rect)
    data class DemoFxNavigation(val pair: String? = null, val scrolled: Boolean = false,
      val message: String)

    private val fxPairLabel = Regex("""(?i)\b([A-Z]{3})\s*/\s*([A-Z]{3})\b(?:\s*\(?\s*(OTC)\s*\)?)?""")
    private val fxPayoutLabel = Regex("""(?<![\d.,-])\+?\s*(\d{1,3})\s*%""")
    private val fiatCodes by lazy {
      java.util.Currency.getAvailableCurrencies().map { it.currencyCode }.toSet() -
        setOf("XAU", "XAG", "XPD", "XPT", "XTS", "XXX")
    }

    fun readDemoFxChartPayout(pair: String): Int? {
      val svc = connected ?: return null
      if (readVisibleDemoPair() != pair || demoFxListVisible()) return null
      val payout = DemoStakeEditor.readRotationPayout(svc) ?: return null
      return payout.takeIf { connected === svc && readVisibleDemoPair() == pair }
    }

    fun demoFxListVisible(): Boolean {
      val (_, _, labels) = activeDemoHistoryNodes(false) ?: return false
      return labels.any { (node, _) -> hasFxCurrencyHeader(node) }
    }

    private fun hasFxCurrencyHeader(node: AccessibilityNodeInfo): Boolean =
      listOfNotNull(node.text, node.contentDescription).any {
        val label = it.toString().trim()
        label.equals("Valute", true) || label.equals("Currencies", true)
      }

    private fun visibleDemoFxRows(
      labels: List<Pair<AccessibilityNodeInfo, Rect>>
    ): List<DemoFxRow> {
      fun rowTexts(node: AccessibilityNodeInfo): List<String> =
        listOfNotNull(node.text?.toString(), node.contentDescription?.toString())
          .map(String::trim).distinct()
      val currencyHeader = labels.firstOrNull { (node, _) ->
        hasFxCurrencyHeader(node)
      }?.second ?: return emptyList()
      val payoutHeader = labels.firstOrNull { (node, rect) ->
        rect.centerX() > currencyHeader.centerX() &&
          kotlin.math.abs(rect.centerY() - currencyHeader.centerY()) <=
            maxOf(currencyHeader.height(), rect.height()) / 2 &&
          rowTexts(node).any {
            Regex("""(?i)^(?:Venit|Payout)\s*[⌄▾▼▲△▽]?$""").matches(it)
          }
      }?.second ?: return emptyList()
      val listBottom = labels.filter { (node, rect) ->
        rect.top > currencyHeader.bottom && rowTexts(node).any {
          it.equals("Timp", true) || it.equals("Time", true) ||
            it.equals("Suma", true) || it.equals("Sumă", true) || it.equals("Amount", true)
        }
      }.minOfOrNull { it.second.top } ?: Int.MAX_VALUE
      val listLabels = labels.filter { (_, rect) ->
        rect.centerY() in currencyHeader.bottom until listBottom
      }
      val quotes = listLabels.mapNotNull { (node, bounds) ->
        if (bounds.centerX() >= payoutHeader.centerX()) return@mapNotNull null
        val values = listOfNotNull(node.text?.toString(), node.contentDescription?.toString())
          .map(String::trim).filter { it.length in 1..75 }.distinct()
        val pairs = values.flatMap { value ->
          fxPairLabel.findAll(value).map { match ->
            val (_, base, quote, otc) = match.groupValues
            Triple(base.uppercase(java.util.Locale.ROOT), quote.uppercase(java.util.Locale.ROOT), otc.isNotEmpty())
          }.toList()
        }.distinct()
        val (base, quote, otc) = pairs.singleOrNull() ?: return@mapNotNull null
        if (base == quote || base !in fiatCodes || quote !in fiatCodes)
          return@mapNotNull null
        // Pocket Option exposes the pair and payout in separate columns.
        // Restrict the match to that row and to the payout column.
        val rowValues = values + listLabels.filter { (_, rect) ->
          kotlin.math.abs(rect.centerY() - bounds.centerY()) <=
            maxOf(bounds.height(), rect.height()) / 2 &&
            rect.centerX() > bounds.centerX() &&
            rect.centerX() >= payoutHeader.left - payoutHeader.width() / 2
        }.flatMap { (payoutNode, _) ->
          rowTexts(payoutNode).filter { fxPayoutLabel.matches(it) }
        }
        val payout = rowValues.flatMap { value ->
          fxPayoutLabel.findAll(value).mapNotNull { it.groupValues[1].toIntOrNull() }.toList()
        }.distinct().singleOrNull()?.takeIf { it in 0..100 } ?: return@mapNotNull null
        DemoFxRow(DemoFxQuote("$base/$quote" + if (otc) " OTC" else "", payout), node, bounds)
      }
      return quotes.groupBy { it.quote.pair }.values.mapNotNull { rows ->
        if (rows.map { it.quote.payout }.distinct().size != 1) null
        else rows.minByOrNull { it.bounds.height() }?.takeIf { narrow ->
          rows.all { it.bounds.contains(narrow.bounds.centerX(), narrow.bounds.centerY()) }
        }
      }.sortedBy { it.bounds.top }
    }

    /** Reopen the selector from the verified chart's instrument control. */
    fun reopenDemoFxList(pair: String, overlayBounds: Rect, physicalOnly: Boolean = false): Boolean {
      if (readVisibleDemoPair() != pair) return false
      val (svc, root, labels) = activeDemoHistoryNodes(false) ?: return false
      if (svc.rootInActiveWindow != root ||
          labels.any { (node, _) -> hasFxCurrencyHeader(node) }) return false
      val display = android.util.DisplayMetrics()
      val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
      @Suppress("DEPRECATION")
      wm.defaultDisplay.getRealMetrics(display)
      val height = display.heightPixels
      val width = display.widthPixels
      val headerTop = (height * .105f).toInt()
      val headerBottom = (height * .33f).toInt()
      val headerRight = (width * .60f).toInt()
      val selectorSuffix = Regex("""\s*(?:\+?\d{1,3}\s*%\s*)?[⌄▾▼]?\s*""")
      val matches = labels.filter { (node, bounds) ->
        bounds.centerY() in headerTop..headerBottom &&
          bounds.centerX() in 1..headerRight &&
          bounds.height() <= height * .075f &&
          listOfNotNull(node.text, node.contentDescription).any { text ->
            val label = text.toString().trim()
            val match = fxPairLabel.find(label)
            match != null && match.range.first == 0 &&
              selectorSuffix.matches(label.substring(match.range.last + 1)) && pair.equals(
              match.groupValues[1] + "/" + match.groupValues[2] +
                if (match.groupValues[3].isNotEmpty()) " OTC" else "", true
            )
          }
      }
      val bounds = matches.map { it.second }.distinct().singleOrNull() ?: return false
      val action = AccessibilityNodeInfo.ACTION_CLICK
      val targets = matches.mapNotNull { (node, _) ->
        generateSequence(node) { it.parent }.take(4).firstOrNull { candidate ->
          val rect = Rect()
          candidate.getBoundsInScreen(rect)
          candidate.isVisibleToUser && candidate.isEnabled && candidate.isClickable &&
            candidate.packageName == root.packageName &&
            rect.width() <= width * .65f && rect.height() <= height * .09f &&
            rect.centerY() in headerTop..headerBottom &&
            rect.centerX() in 1..headerRight &&
            candidate.actionList.any { it.id == action }
        }
      }.distinct()
      if (targets.size > 1 || svc.rootInActiveWindow != root) return false
      if (!physicalOnly && targets.singleOrNull()?.performAction(action) == true) return true

      // Some Pocket Option WebViews expose an exact pair label with no click action.
      // Only the uniquely identified header label may receive a physical tap.
      val x = bounds.centerX()
      val y = bounds.centerY()
      if (overlayBounds.contains(x, y) || svc.rootInActiveWindow != root) return false
      val path = Path().apply { moveTo(x.toFloat(), y.toFloat()) }
      val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 75L)).build()
      return svc.dispatchGesture(gesture, null, Handler(Looper.getMainLooper()))
    }

    /** A single selector action. The caller must verify the resulting chart. */
    fun navigateOpenDemoFxList(
      excluded: Set<String>, allowScroll: Boolean, forward: Boolean, overlayBounds: Rect,
      onlyPair: String? = null
    ): DemoFxNavigation {
      val (svc, root, labels) = activeDemoHistoryNodes(false)
        ?: return DemoFxNavigation(message = "QT DEMO NECONFIRMAT")
      if (svc.rootInActiveWindow != root)
        return DemoFxNavigation(message = "BROKERUL NU ESTE ÎN FAȚĂ")
      val rows = visibleDemoFxRows(labels)
      if (rows.isEmpty()) return DemoFxNavigation(message = "RÂNDURI VALUTE NECITITE")
      val next = rows.firstOrNull {
        it.quote.payout >= 92 && it.quote.pair !in excluded &&
          (onlyPair == null || onlyPair == it.quote.pair)
      }
      if (next != null) {
        val action = AccessibilityNodeInfo.ACTION_CLICK
        // A row label can be nested inside a clickable row. Limit the search
        // to ancestors contained in the same vertical band as the row.
        val target = generateSequence(next.node) { it.parent }.take(5).firstOrNull { node ->
          val rect = Rect()
          node.getBoundsInScreen(rect)
          node.isVisibleToUser && node.isEnabled && node.isClickable &&
            node.packageName == root.packageName &&
            rect.top >= next.bounds.top - next.bounds.height() &&
            rect.bottom <= next.bounds.bottom + next.bounds.height() &&
            node.actionList.any { it.id == action }
        }
        if (svc.rootInActiveWindow != root)
          return DemoFxNavigation(message = "BROKERUL NU ESTE ÎN FAȚĂ")
        if (onlyPair == null && target?.performAction(action) == true)
          return DemoFxNavigation(pair = next.quote.pair, message = "VERIFIC PERECHEA")
        val x = next.bounds.centerX()
        val y = next.bounds.centerY()
        val metrics = svc.resources.displayMetrics
        if (x !in (metrics.widthPixels * .15f).toInt()..(metrics.widthPixels * .65f).toInt() ||
            y !in (metrics.heightPixels * .25f).toInt()..(metrics.heightPixels * .70f).toInt())
          return DemoFxNavigation(message = "RÂND VALUTAR ÎN AFARA ZONEI SIGURE")
        if (overlayBounds.contains(x, y))
          return DemoFxNavigation(message = "PANOU PESTE PERECHE")
        val path = Path().apply { moveTo(x.toFloat(), y.toFloat()) }
        val gesture = GestureDescription.Builder()
          .addStroke(GestureDescription.StrokeDescription(path, 0L, 75L)).build()
        return if (svc.rootInActiveWindow == root &&
            svc.dispatchGesture(gesture, null, Handler(Looper.getMainLooper())))
          DemoFxNavigation(pair = next.quote.pair, message = "VERIFIC PERECHEA")
        else DemoFxNavigation(message = "ANDROID A REFUZAT SELECTAREA")
      }
      if (!allowScroll) return DemoFxNavigation(message = "LIMITĂ TEST DERULARE")
      val action = if (forward) AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
        else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
      val first = rows.first()
      val last = rows.last()
      val scroll = generateSequence(first.node) { it.parent }.take(8).firstOrNull { node ->
        val rect = Rect()
        node.getBoundsInScreen(rect)
        node.isVisibleToUser && node.isScrollable && node.packageName == root.packageName &&
          rect.top <= first.bounds.top && rect.bottom >= last.bounds.bottom &&
          node.actionList.any { it.id == action } &&
          generateSequence(last.node) { it.parent }.take(8).any { it == node }
      } ?: return DemoFxNavigation(message = "NICIO ALTĂ PERECHE VERIFICATĂ LA ≥92%")
      return if (svc.rootInActiveWindow == root && scroll.performAction(action))
        DemoFxNavigation(scrolled = true, message = "VERIFIC LISTA DERULATĂ")
      else DemoFxNavigation(message = "DERULARE NECONFIRMATĂ")
    }

    // 454: Pocket Option's Motorola history layout can omit the page
    // title entirely, while showing the Open/Closed tabs AND the selected
    // bottom "Tranzacții" navigation. This identifies the HISTORY PAGE,
    // never proves that any position is closed or permits BUY/SELL.
    private fun historyPageIdentity454(
      labels: List<Pair<AccessibilityNodeInfo, Rect>>,
      heightPixels: Int
    ): Boolean {
      fun at(label: Regex, low: Float, high: Float): Boolean =
        labels.any { (node, rect) ->
          rect.centerY() in (heightPixels * low).toInt()..
            (heightPixels * high).toInt() &&
            listOfNotNull(node.text?.toString(), node.contentDescription?.toString())
              .any { label.matches(it.replace(Regex("""\s+"""), " ").trim()) }
        }
      val pageHeading = at(
        Regex("""(?i)^(?:Tranzacții|Tranzactii|Transactions|Trades)$"""),
        .09f, .24f)
      val footer = at(
        Regex("""(?i)^(?:Tranzacții|Tranzactii|Transactions|Trades)$"""),
        .86f, .985f)
      val open = at(Regex("""(?i)^(?:Deschis|Open)$"""), .15f, .31f)
      val closed = at(
        Regex("""(?i)^(?:Închis|Inchis|Closed)$"""), .15f, .31f)
      return pageHeading || (footer && open && closed)
    }

    private fun clickExactDemoNavigationLabel(
      svc: TouchTestService,
      root: AccessibilityNodeInfo,
      labels: List<Pair<AccessibilityNodeInfo, Rect>>,
      name: Regex,
      xMin: Float, xMax: Float, yMin: Float, yMax: Float
    ): Boolean {
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return false }
      val w = metrics.widthPixels
      val h = metrics.heightPixels
      val candidates = labels.filter { (node, r) ->
        r.centerX() in (w * xMin).toInt()..(w * xMax).toInt() &&
          r.centerY() in (h * yMin).toInt()..(h * yMax).toInt() &&
          r.width() > 12 && r.height() > 12 &&
          r.width() < w * 0.42f && r.height() < h * 0.13f &&
          listOfNotNull(node.text?.toString(), node.contentDescription?.toString()).any {
            name.matches(it.replace(Regex("""\s+"""), " ").trim())
          }
      }
      if (candidates.isEmpty()) return false
      val chosen = candidates.minByOrNull { (_, r) -> r.width() * r.height() }
        ?: return false
      // Reject different physical controls with similar labels.
      if (candidates.any { (_, r) ->
          kotlin.math.abs(r.centerX() - chosen.second.centerX()) > w * 0.085f ||
          kotlin.math.abs(r.centerY() - chosen.second.centerY()) > h * 0.035f
        }) return false
      if (svc.rootInActiveWindow?.packageName?.toString() != root.packageName?.toString())
        return false
      // 456 SIMPLE: one verified footer/tab label -> one physical tap.
      // Avoid WebView ACTION_CLICK and ancestor scans: they can report success
      // without ever changing the Pocket Option page. No arbitrary coordinates.
      // This is navigation ONLY; the caller must visually confirm the new page.
      val rect = chosen.second
      if (svc.rootInActiveWindow?.packageName?.toString() != root.packageName?.toString())
        return false
      val path = Path().apply { moveTo(rect.exactCenterX(), rect.exactCenterY()) }
      val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 80L)).build()
      return try {
        demoNavGestureFeedback456 = "GEST CERUT • AȘTEPT RĂSPUNS ANDROID"
        val submitted = svc.dispatchGesture(
          gesture,
          object : AccessibilityService.GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
              demoNavGestureFeedback456 =
                "GEST FINALIZAT ANDROID • PAGINA ÎNCĂ NECONFIRMATĂ"
            }
            override fun onCancelled(gestureDescription: GestureDescription?) {
              demoNavGestureFeedback456 = "GEST ANULAT DE ANDROID • FĂRĂ ORDIN"
            }
          },
          Handler(Looper.getMainLooper())
        )
        if (!submitted) demoNavGestureFeedback456 = "GEST REFUZAT ANDROID"
        submitted
      } catch (error: Throwable) {
        demoNavGestureFeedback456 = "EROARE GEST ANDROID"
        false
      }
    }

    // A successful dispatchGesture only means Android accepted a touch;
    // it NEVER proves the broker opened the Transactions page. Check the
    // actual page title AND Open tab in the same verified QT Demo package.
    // This diagnostic cannot unlock a prior attempt or authorize BUY/SELL.
    fun confirmedDemoHistoryPageReadOnly431(
      cachedDemoVerifiedOnChart: Boolean
    ): Boolean {
      val info = activeDemoHistoryNodes(cachedDemoVerifiedOnChart) ?: return false
      val (_, root, labels) = info
      val svc = connected ?: return false
      if (svc.rootInActiveWindow?.packageName?.toString() != root.packageName?.toString())
        return false
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return false }
      val h = metrics.heightPixels
      val title = labels.any { (node, rect) ->
        rect.centerY() in (h * .09f).toInt()..(h * .24f).toInt() &&
          listOfNotNull(node.text?.toString(), node.contentDescription?.toString()).any {
            Regex("""(?i)^(Tranzacții|Tranzactii|Transactions|Trades)$""").matches(it.trim())
          }
      }
      val open = labels.any { (node, rect) ->
        rect.centerY() in (h * .15f).toInt()..(h * .31f).toInt() &&
          listOfNotNull(node.text?.toString(), node.contentDescription?.toString()).any {
            Regex("""(?i)^(Deschis|Open)$""").matches(it.trim())
          }
      }
      return (title || historyPageIdentity454(labels, h)) && open
    }

    // 432: The broker draws the bottom "Tranzacții" label in a WebView
    // that may not export any clickable Accessibility child. This narrow
    // fallback may touch ONLY the coordinates of that text, independently
    // read from two fresh screen OCR frames. It is not a BUY/SELL executor.
    // A gesture being accepted cannot resolve prior positions: the caller
    // must re-read and confirm the real Transactions page after this tap.
    fun tapVerifiedDemoHistoryOcr432(
      expectedBrokerPackage: String,
      centerXFraction: Float,
      centerYFraction: Float,
      cachedDemoVerifiedOnChart: Boolean
    ): Boolean {
      // 441: The Pocket Option WebView often has no accessible QT Demo
      // text. The independently verified, fresh same-package DEMO proof
      // permits NAVIGATION ONLY. The 2-frame OCR of the bottom-left
      // Transactions label is still required and this never places orders.
      if (!cachedDemoVerifiedOnChart) return false
      val info = activeDemoHistoryNodes(cachedDemoVerifiedOnChart) ?: return false
      val (svc, root, _) = info
      if (root.packageName?.toString() != expectedBrokerPackage ||
          svc.rootInActiveWindow?.packageName?.toString() != expectedBrokerPackage ||
          !BrokerAdapterRegistry.hasDemoExecutor(expectedBrokerPackage) ||
          !centerXFraction.isFinite() || !centerYFraction.isFinite() ||
          centerXFraction !in 0.02f..0.35f ||
          centerYFraction !in 0.84f..0.975f) return false
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return false }
      if (metrics.widthPixels < 300 || metrics.heightPixels < 600) return false
      // Never aim the OCR fallback near the chart trade buttons: only the
      // bottom-left Transactions navigation label is eligible.
      val x = metrics.widthPixels * centerXFraction
      val y = metrics.heightPixels * centerYFraction
      if (svc.rootInActiveWindow?.packageName?.toString() != expectedBrokerPackage)
        return false
      val path = Path().apply { moveTo(x, y) }
      val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 75L)).build()
      return try {
        svc.dispatchGesture(gesture, null, Handler(Looper.getMainLooper()))
      } catch (_: Throwable) { false }
    }

    // 435: Only when the broker's actual Transactions page and BOTH tabs
    // have been identified in two independent MediaProjection OCR frames,
    // tap the visible "Deschis" tab. This never touches order controls and
    // does not unlock a position without an independent zero-OPEN receipt.
    fun tapVerifiedDemoOpenTabOcr435(
      expectedBrokerPackage: String,
      centerXFraction: Float,
      centerYFraction: Float,
      cachedDemoVerifiedOnChart: Boolean
    ): Boolean {
      val info = activeDemoHistoryNodes(cachedDemoVerifiedOnChart) ?: return false
      val (svc, root, _) = info
      if (root.packageName?.toString() != expectedBrokerPackage ||
          svc.rootInActiveWindow?.packageName?.toString() != expectedBrokerPackage ||
          !BrokerAdapterRegistry.hasDemoExecutor(expectedBrokerPackage) ||
          !centerXFraction.isFinite() || !centerYFraction.isFinite() ||
          centerXFraction !in 0.08f..0.48f ||
          centerYFraction !in 0.15f..0.31f) return false
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return false }
      if (metrics.widthPixels < 300 || metrics.heightPixels < 600) return false
      val x = metrics.widthPixels * centerXFraction
      val y = metrics.heightPixels * centerYFraction
      if (svc.rootInActiveWindow?.packageName?.toString() != expectedBrokerPackage)
        return false
      val path = Path().apply { moveTo(x, y) }
      return try {
        val gesture = GestureDescription.Builder()
          .addStroke(GestureDescription.StrokeDescription(path, 0L, 75L)).build()
        svc.dispatchGesture(gesture, null, Handler(Looper.getMainLooper()))
      } catch (_: Throwable) { false }
    }

    /**
     * 457: Return to the broker chart using ONLY the "Perspective" footer
     * discovered in two independent OCR frames of an identified history page.
     * This is NAVIGATION ONLY. A touch can never reconcile, settle, or
     * re-arm any prior broker order.
     */
    fun tapVerifiedDemoPerspectiveFooter457(
      expectedBrokerPackage: String,
      centerXFraction: Float,
      centerYFraction: Float,
      cachedDemoVerifiedOnChart: Boolean,
      ocrConfirmedHistoryPage: Boolean
    ): Boolean {
      if (!ocrConfirmedHistoryPage || !cachedDemoVerifiedOnChart) return false
      val info = activeDemoHistoryNodes(cachedDemoVerifiedOnChart) ?: return false
      val (svc, root, _) = info
      if (root.packageName?.toString() != expectedBrokerPackage ||
          svc.rootInActiveWindow?.packageName?.toString() != expectedBrokerPackage ||
          !BrokerAdapterRegistry.hasDemoExecutor(expectedBrokerPackage) ||
          !centerXFraction.isFinite() || !centerYFraction.isFinite() ||
          centerXFraction !in 0.20f..0.63f ||
          centerYFraction !in 0.84f..0.985f) return false
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return false }
      if (metrics.widthPixels < 300 || metrics.heightPixels < 600) return false
      val x = metrics.widthPixels * centerXFraction
      val y = metrics.heightPixels * centerYFraction
      if (svc.rootInActiveWindow?.packageName?.toString() != expectedBrokerPackage)
        return false
      val path = Path().apply { moveTo(x, y) }
      val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 80L)).build()
      return try {
        demoNavGestureFeedback456 = "PERSPECTIVE • GEST CERUT ANDROID"
        val sent = svc.dispatchGesture(
          gesture,
          object : AccessibilityService.GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
              demoNavGestureFeedback456 =
                "PERSPECTIVE • GEST FINALIZAT • GRAFIC NECONFIRMAT"
            }
            override fun onCancelled(gestureDescription: GestureDescription?) {
              demoNavGestureFeedback456 = "PERSPECTIVE • GEST ANULAT"
            }
          }, Handler(Looper.getMainLooper())
        )
        if (!sent) demoNavGestureFeedback456 = "PERSPECTIVE • GEST REFUZAT"
        sent
      } catch (_: Throwable) {
        demoNavGestureFeedback456 = "PERSPECTIVE • EROARE GEST"
        false
      }
    }

    /**
     * 438: Navigation ONLY. Open a CLOSED history list row selected from two
     * consistent MediaProjection OCR frames. This tap is not an order,
     * a receipt, or permission to clear a pending DEMO gesture.
     */
    fun tapVerifiedDemoClosedRowOcr438(
      expectedBrokerPackage: String,
      centerXFraction: Float,
      centerYFraction: Float
    ): Boolean {
      val info = activeDemoHistoryNodes(true) ?: return false
      val (svc, root, _) = info
      if (root.packageName?.toString() != expectedBrokerPackage ||
          svc.rootInActiveWindow?.packageName?.toString() != expectedBrokerPackage ||
          !BrokerAdapterRegistry.hasDemoExecutor(expectedBrokerPackage) ||
          !centerXFraction.isFinite() || !centerYFraction.isFinite() ||
          centerXFraction !in 0.08f..0.72f ||
          centerYFraction !in 0.25f..0.86f) return false
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return false }
      if (metrics.widthPixels < 300 || metrics.heightPixels < 600) return false
      if (svc.rootInActiveWindow?.packageName?.toString() != expectedBrokerPackage)
        return false
      val path = Path().apply {
        moveTo(metrics.widthPixels * centerXFraction,
          metrics.heightPixels * centerYFraction)
      }
      return try {
        val gesture = GestureDescription.Builder()
          .addStroke(GestureDescription.StrokeDescription(path, 0L, 75L)).build()
        svc.dispatchGesture(gesture, null, Handler(Looper.getMainLooper()))
      } catch (_: Throwable) { false }
    }

    /**
     * 440: The Pocket Option CLOSED detail expands inline in Transactions,
     * so Android BACK can leave the history page entirely. Once the detail
     * UUID was independently verified twice, navigate ONLY through the
     * explicitly labelled "Deschis" tab, never BACK or order controls.
     * A successful click is just navigation, NOT zero open-position proof.
     */
    fun returnFromVerifiedDemoClosedDetail438(expectedBrokerPackage: String): Boolean {
      val info = activeDemoHistoryNodes(true) ?: return false
      val (svc, root, labels) = info
      if (root.packageName?.toString() != expectedBrokerPackage ||
          !BrokerAdapterRegistry.hasDemoExecutor(expectedBrokerPackage) ||
          svc.rootInActiveWindow?.packageName?.toString() != expectedBrokerPackage)
        return false
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return false }
      val pageTitle = labels.any { (node, rect) ->
        rect.centerY() in (metrics.heightPixels * .09f).toInt()..
          (metrics.heightPixels * .24f).toInt() &&
          listOfNotNull(node.text?.toString(), node.contentDescription?.toString()).any {
            Regex("""(?i)^(?:Tranzacții|Tranzactii|Transactions|Trades)$""")
              .matches(it.trim())
          }
      }
      if (!pageTitle && !historyPageIdentity454(labels, metrics.heightPixels))
        return false
      return clickExactDemoNavigationLabel(svc, root, labels,
        Regex("""(?i)^(?:Deschis|Open)$"""), .08f, .48f, .15f, .31f)
    }

    fun advanceDemoHistoryReviewNavigation(
      cachedDemoVerifiedOnChart: Boolean
    ): String {
      val info = activeDemoHistoryNodes(cachedDemoVerifiedOnChart)
        ?: return "ISTORIC BLOCAT • " + brokerWindowDiagnostic446() +
          " • FĂRĂ ORDIN"
      val (svc, root, labels) = info
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return "ISTORIC AUTO • ECRAN NECUNOSCUT" }
      val title = labels.any { (node, r) ->
        r.centerY() in (metrics.heightPixels * 0.09f).toInt()..
          (metrics.heightPixels * 0.24f).toInt() &&
          listOfNotNull(node.text?.toString(), node.contentDescription?.toString()).any {
            Regex("""(?i)^(?:Tranzacții|Tranzactii|Transactions|Trades)$""").matches(it.trim())
          }
      }
      val historyPage454 = title || historyPageIdentity454(
        labels, metrics.heightPixels
      )
      val success = if (historyPage454) {
        clickExactDemoNavigationLabel(svc, root, labels,
          Regex("""(?i)^(?:Deschis|Open)$"""), 0.08f, 0.48f, 0.15f, 0.30f)
      } else {
        clickExactDemoNavigationLabel(svc, root, labels,
          Regex("""(?i)^(?:Tranzacții|Tranzactii|Transactions|Trades)$"""),
          0.01f, 0.36f, 0.84f, 0.98f)
      }
      demoHistoryNavigationStatus = if (!success)
        "ISTORIC AUTO • CONTROL NECONFIRMAT • FĂRĂ ORDIN"
      else if (historyPage454)
        "ISTORIC AUTO • FILA DESCHIS • GEST TRIMIS • AȘTEPT PAGINA"
      else
        "ISTORIC AUTO • DESCHID TRANZACȚII • GEST TRIMIS • AȘTEPT PAGINA"
      return demoHistoryNavigationStatus
    }

    /**
     * 425: Navigate only to the broker's labelled CLOSED history tab.
     * The method never touches BUY/SELL or changes a monetary amount.
     */
    fun advanceDemoClosedHistoryNavigation(
      cachedDemoVerifiedOnChart: Boolean
    ): String {
      val info = activeDemoHistoryNodes(cachedDemoVerifiedOnChart)
        ?: return "ÎNCHIS • QT DEMO/FEREASTRĂ NECONFIRMATĂ"
      val (svc, root, labels) = info
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE)
          as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return "ÎNCHIS • ECRAN NECUNOSCUT" }
      val title = labels.any { (node, rect) ->
        rect.centerY() in (metrics.heightPixels * .09f).toInt()..
          (metrics.heightPixels * .24f).toInt() &&
          listOfNotNull(node.text?.toString(), node.contentDescription?.toString()).any {
            Regex("""(?i)^(?:Tranzacții|Tranzactii|Transactions|Trades)$""")
              .matches(it.trim())
          }
      }
      if (!title) return "ÎNCHIS • PAGINA TRANZACȚII NU ESTE DESCHISĂ"
      val clicked = clickExactDemoNavigationLabel(
        svc, root, labels,
        Regex("""(?i)^(?:Închis|Inchis|Closed)$"""),
        .50f, .96f, .15f, .31f
      )
      return if (clicked) "ISTORIC DEMO • DESCHID FILA ÎNCHIS"
        else "ISTORIC DEMO • FILA ÎNCHIS NECONFIRMATĂ"
    }

    /**
     * Strictly read-only inspection of CLOSED trades. Never infer WIN/LOSS
     * from an empty Open tab, a green color, or a balance delta. The broker
     * must expose a unique order ID and unambiguous result on a selected
     * CLOSED tab before a future version can connect this data to the ledger.
     *
     * In 425 it ONLY returns counts/diagnostics, never IDs or user balances.
     */
    fun inspectDemoClosedTradeEvidenceReadOnly(
      cachedDemoVerifiedOnChart: Boolean,
      visuallySelectedClosedTab: Boolean
    ): String {
      val info = activeDemoHistoryNodes(cachedDemoVerifiedOnChart)
        ?: return "ÎNCHIS • QT DEMO NECONFIRMAT • FĂRĂ WIN/LOSS"
      val (svc, root, labels) = info
      val dimensions = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE)
          as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(dimensions)
      } catch (_: Throwable) { return "ÎNCHIS • ECRAN NECUNOSCUT" }
      val w = dimensions.widthPixels
      val h = dimensions.heightPixels
      if (w < 300 || h < 600) return "ÎNCHIS • ECRAN NECONFIRMAT"

      data class Visible(val value: String, val rect: Rect, val selected: Boolean)
      val readable = labels.flatMap { (node, rect) ->
        val texts = listOfNotNull(node.text?.toString(),
          node.contentDescription?.toString()).map { it.trim() }
          .filter { it.isNotBlank() }.distinct()
        texts.map { Visible(it.take(120), rect, node.isSelected || node.isChecked) }
      }.distinctBy { it.rect.toShortString() + "|" + it.value }
      val realVisible = readable.any {
        Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(it.value)
      }
      if (realVisible || svc.rootInActiveWindow?.packageName != root.packageName)
        return "ÎNCHIS • CONT REAL/NECUNOSCUT • FĂRĂ REZULTAT"

      val title = readable.any {
        it.rect.centerY() in (h * .09f).toInt()..(h * .24f).toInt() &&
          Regex("""(?i)^(?:Tranzacții|Tranzactii|Transactions|Trades)$""")
            .matches(it.value)
      }
      val closed = readable.filter {
        it.rect.centerY() in (h * .15f).toInt()..(h * .31f).toInt() &&
          it.rect.centerX() > w * .48f &&
          Regex("""(?i)^(?:Închis|Inchis|Closed)$""").matches(it.value)
      }
      if (!title || closed.isEmpty()) return "ÎNCHIS • FILA TRANZACȚII LIPSEȘTE"
      if (!visuallySelectedClosedTab && closed.none { it.selected })
        return "ÎNCHIS • SELECTAREA FILEI NU ESTE CONFIRMATĂ"

      // Count exact-field evidence only. The unlabelled green payout and
      // $0 rows on Pocket Option are NOT unambiguous WIN/LOSS receipts.
      val body = readable.filter { it.rect.centerY() in
        (h * .29f).toInt()..(h * .91f).toInt() }
      val fx = Regex("""(?i)\b[A-Z]{3}\s*/\s*[A-Z]{3}\b""")
      val identifiedPairs = body.filter { fx.containsMatchIn(it.value) }
      // 436: Pocket Option detail uses "Ordin: " followed by a 36-char
      // UUID (e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). The older
      // 6..30-character ID expression silently rejected a real receipt.
      // Keep the ID anchored and require a visible label, never accept a
      // bare number, pair, broker balance or order-button text as an ID.
      val idRx = Regex("""(?i)^(?:Ordin\s*:\s*|(?:Order|Trade|Position|Tranzacție|Tranzactie)\s*(?:ID|Nr\.?|#)\s*[:#]?\s*)([A-Z0-9_-]{6,64})$""")
      val ids = body.mapNotNull { idRx.matchEntire(it.value)?.groupValues?.getOrNull(1) }
        .distinct()
      val stakeRx = Regex("""(?i)^(?:Stake|Amount|Investment|Investiție|Investitie|Miză|Miza|Sumă|Suma)\s*:?\s*(?:USD\s*)?\$?\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:USD)?$""")
      val stakes = body.mapNotNull {
        stakeRx.matchEntire(it.value)?.groupValues?.getOrNull(1)
      }.distinct()
      val resultRx = Regex("""(?i)^(?:P/L|Net Profit|Profit|Rezultat|Result)\s*:?\s*([+-]\s*(?:USD\s*)?\$?\s*[0-9]+(?:[.,][0-9]{1,2})?)\s*(?:USD)?$""")
      val results = body.mapNotNull {
        resultRx.matchEntire(it.value)?.groupValues?.getOrNull(1)
      }.distinct()
      val counts = "ÎNCHIS DEMO • PERECHI " + identifiedPairs.size +
        " • ID " + ids.size + " • MIZE " + stakes.size +
        " • P/L " + results.size
      // Require EXACTLY one independently labelled ID, stake and signed
      // net P/L on the same visible CLOSED item; multiple orders or
      // missing monetary sign are ambiguous, never a recoverable LOSS.
      fun strictCents(source: String): Long? {
        val cleaned = source.replace(Regex("""(?i)USD|\$|\s+"""), "")
          .replace(',', '.')
        val parsed = Regex("""^([+-]?)([0-9]{1,7})(?:\.([0-9]{1,2}))?$""")
          .matchEntire(cleaned) ?: return null
        val dollars = parsed.groupValues[2].toLongOrNull() ?: return null
        val decimal = parsed.groupValues[3].padEnd(2, '0').toLongOrNull() ?: return null
        val cents = dollars * 100L + decimal
        return if (parsed.groupValues[1] == "-") -cents else cents
      }
      val idItems = body.filter { idRx.matches(it.value) }
      val stakeItems = body.filter { stakeRx.matches(it.value) }
      val pnlItems = body.filter { resultRx.matches(it.value) }
      val singleCandidate = if (ids.size == 1 && stakes.size == 1 &&
          results.size == 1 && idItems.size == 1 && stakeItems.size == 1 &&
          pnlItems.size == 1 &&
          identifiedPairs.mapNotNull { fx.find(it.value)?.value }.distinct().size <= 1) {
        val id = idRx.matchEntire(idItems[0].value)?.groupValues?.getOrNull(1)
        val stakeRaw = stakeRx.matchEntire(stakeItems[0].value)?.groupValues?.getOrNull(1)
        val pnlRaw = resultRx.matchEntire(pnlItems[0].value)?.groupValues?.getOrNull(1)
        val stake = stakeRaw?.let(::strictCents)
        val pnl = pnlRaw?.let(::strictCents)
        val ys = listOf(idItems[0].rect.centerY(),
          stakeItems[0].rect.centerY(), pnlItems[0].rect.centerY())
        if (id != null && stake != null && pnl != null &&
            stake in 100L..3964L && pnl in -stake..stake &&
            (ys.maxOrNull()!! - ys.minOrNull()!!) <= (h * 0.16f).toInt())
          listOf(root.packageName?.toString().orEmpty(), id,
            stake.toString(), pnl.toString()).joinToString("|")
        else null
      } else null
      val tick = android.os.SystemClock.elapsedRealtime()
      if (singleCandidate == null) {
        closedCandidateKey427 = null
        closedCandidateFirstAt427 = 0L
        closedEvidenceDiagnostic427 = counts + " • DATE AMBIGUE • FĂRĂ RECUPERARE"
      } else if (singleCandidate != closedCandidateKey427 ||
          tick - closedCandidateFirstAt427 !in 1200L..15_000L) {
        closedCandidateKey427 = singleCandidate
        closedCandidateFirstAt427 = tick
        closedEvidenceDiagnostic427 = counts + " • DOVADĂ 1/2 • FĂRĂ RECUPERARE"
      } else {
        val netCents = singleCandidate.substringAfterLast('|').toLongOrNull()
        closedEvidenceDiagnostic427 = counts + when {
          netCents == null -> " • REZULTAT NECLAR • FĂRĂ RECUPERARE"
          netCents < 0L -> " • PIERDERE CITITĂ 2/2 • OPEN ID NECONECTAT • FĂRĂ RECUPERARE"
          netCents > 0L -> " • PROFIT CITIT 2/2 • OPEN ID NECONECTAT • FĂRĂ RECUPERARE"
          else -> " • REZULTAT 0 CITIT 2/2 • OPEN ID NECONECTAT • FĂRĂ RECUPERARE"
        }
      }
      return closedEvidenceDiagnostic427
    }


    /**
     * 429: A verified receipt is a real, visible ID + amount on a SELECTED
     * broker history tab, observed identically in two separate reads.
     * No inference from green UI, changed balance, a touch or elapsed time.
     * No broker credentials, amounts or IDs are logged or displayed.
     */
    data class DemoTradeReceipt429(
      val brokerPackage: String,
      val pair: String,
      val positionId: String,
      val stakeCents: Long,
      val netProfitCents: Long?
    )
    private var openReceiptKey429: String? = null
    private var openReceiptAt429 = 0L
    private var closedReceiptKey429: String? = null
    private var closedReceiptAt429 = 0L
    @Volatile private var receiptStatus429 = "ISTORIC • AȘTEPT ID ȘI MIZĂ"
    fun receiptStatus429(): String = receiptStatus429

    private fun parseExactCents429(text: String, signed: Boolean): Long? {
      val compact = text.trim().replace(Regex("""(?i)USD|\$|\s+"""), "")
        .replace(',', '.')
      val expr = if (signed)
        Regex("""^([+-])([0-9]{1,5})(?:\.([0-9]{1,2}))?$""")
      else Regex("""^([0-9]{1,5})(?:\.([0-9]{1,2}))?$""")
      val match = expr.matchEntire(compact) ?: return null
      val sign = if (signed && match.groupValues[1] == "-") -1L else 1L
      val baseIndex = if (signed) 2 else 1
      val whole = match.groupValues[baseIndex].toLongOrNull() ?: return null
      val fractional = match.groupValues[baseIndex + 1]
      val cents = when (fractional.length) {
        0 -> 0L
        1 -> fractional.toLongOrNull()?.times(10L) ?: return null
        else -> fractional.toLongOrNull() ?: return null
      }
      return sign * (whole * 100L + cents)
    }

    fun readDoubleVerifiedDemoReceipt429(
      expectedPair: String,
      cachedDemoVerifiedOnChart: Boolean,
      closed: Boolean,
      selectedTabVerifiedVisually: Boolean
    ): DemoTradeReceipt429? {
      val info = activeDemoHistoryNodes(cachedDemoVerifiedOnChart)
        ?: return null.also { receiptStatus429 = "BROKER DEMO NECONFIRMAT" }
      val (svc, root, labels) = info
      val display = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(display)
      } catch (_: Throwable) { return null }
      val w = display.widthPixels
      val h = display.heightPixels
      if (w < 300 || h < 650 ||
          expectedPair.isBlank() || expectedPair == "NEIDENTIFICAT" ||
          svc.rootInActiveWindow?.packageName != root.packageName)
        return null
      data class TextRect(val value: String, val rect: Rect, val selected: Boolean)
      val visible = labels.flatMap { (node, rect) ->
        listOfNotNull(node.text?.toString(), node.contentDescription?.toString())
          .map { it.replace(Regex("""\s+"""), " ").trim().take(120) }
          .filter { it.isNotBlank() }
          .map { TextRect(it, rect, node.isSelected || node.isChecked) }
      }.distinctBy { it.value + "@" + it.rect.toShortString() }
      if (visible.any { Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(it.value) })
        return null.also { receiptStatus429 = "CONT REAL • FĂRĂ RECUPERARE" }
      if (visible.none { it.rect.centerY() in (h * .09f).toInt()..(h * .24f).toInt() &&
        Regex("""(?i)^(Tranzacții|Tranzactii|Transactions|Trades)$""").matches(it.value) })
        return null
      val selected = visible.any {
        it.rect.centerY() in (h * .15f).toInt()..(h * .31f).toInt() &&
        it.rect.centerX() in (if (closed) (w * .48f).toInt()..w
          else 0..(w * .52f).toInt()) &&
        Regex(if (closed) """(?i)^(Închis|Inchis|Closed)$"""
          else """(?i)^(Deschis|Open)$""").matches(it.value) &&
        it.selected
      }
      if (!selected && !selectedTabVerifiedVisually)
        return null.also { receiptStatus429 = "FILA ISTORICULUI NU ESTE SELECTATĂ" }

      val rows = visible.filter { it.rect.centerY() in (h * .29f).toInt()..(h * .91f).toInt() }
      // A history page may list several positions. Without row-to-field
      // grouping we deliberately reject such a screen rather than pick one.
      val idRx = Regex("""(?i)^(?:Ordin\s*:\s*|(?:Order|Trade|Position|Tranzacție|Tranzactie)\s*(?:ID|Nr\.?|#)\s*[:#]?\s*)([A-Z0-9_-]{6,64})$""")
      val stakeRx = Regex("""(?i)^(?:Stake|Amount|Investment|Investiție|Investitie|Miză|Miza|Sumă|Suma)\s*:?\s*((?:USD\s*)?\$?\s*[0-9]+(?:[.,][0-9]{1,2})?\s*(?:USD)?)$""")
      val resultRx = Regex("""(?i)^(?:P/L|Net Profit|Profit|Rezultat|Result)\s*:?\s*([+-]\s*(?:USD\s*)?\$?\s*[0-9]+(?:[.,][0-9]{1,2})?\s*(?:USD)?)$""")
      val ids = rows.filter { idRx.matches(it.value) }
      val stakes = rows.filter { stakeRx.matches(it.value) }
      val pnls = rows.filter { resultRx.matches(it.value) }
      // On the single-order details screen, the stake may be a lone
      // "$1" beside separate "Ora deschiderii", "Plată", and "Profit"
      // labels, rather than a combined "Miză: $1" accessibility node.
      // This fallback is accepted ONLY with one uniquely labelled order ID
      // and an independently visible broker detail context. A multi-order
      // summary cannot supply a recovery receipt this way.
      val detailPage436 = rows.any {
        Regex("""(?i)^Ora\s+deschiderii\s*:?$""").matches(it.value)
      } && rows.any {
        Regex("""(?i)^Ora\s+închiderii\s*:?$""").matches(it.value)
      } && rows.any {
        Regex("""(?i)^Plată\s*:?\s*.*$""").matches(it.value)
      } && ids.size == 1 && closed
      val bareStake436 = if (detailPage436 && stakes.isEmpty()) rows.filter {
        Regex("""^\$[0-9]{1,5}(?:[.,][0-9]{1,2})?$""").matches(it.value)
      } else emptyList()
      val bareProfit436 = if (detailPage436 && pnls.isEmpty() &&
          rows.any { Regex("""(?i)^Profit\s*:?$""").matches(it.value) })
        rows.filter {
          Regex("""^[+-]\s*\$[0-9]{1,5}(?:[.,][0-9]{1,2})?$""")
            .matches(it.value)
        } else emptyList()
      val fx = Regex("""(?i)\b[A-Z]{3}\s*/\s*[A-Z]{3}(?:\s+OTC)?\b""")
      val pairs = rows.mapNotNull { fx.find(it.value)?.value?.uppercase() }.distinct()
      val verifiedStake436 = if (stakes.size == 1) stakes.single()
        else bareStake436.singleOrNull()
      val verifiedProfit436 = if (pnls.size == 1) pnls.single()
        else bareProfit436.singleOrNull()
      if (ids.size != 1 || verifiedStake436 == null ||
          (if (closed) verifiedProfit436 == null else pnls.isNotEmpty()) ||
          pairs.size != 1 || pairs.single().replace(Regex("""\s+"""), " ") !=
          expectedPair.uppercase().replace(Regex("""\s+"""), " ")) {
        receiptStatus429 = "ID/MIZĂ/P-L/PERECHE NECONFIRMATE • FĂRĂ RECUPERARE"
        return null
      }
      val id = idRx.matchEntire(ids.single().value)?.groupValues?.getOrNull(1)
        ?: return null
      val stakeText436 = if (stakes.size == 1)
        stakeRx.matchEntire(stakes.single().value)?.groupValues?.getOrNull(1)
      else bareStake436.singleOrNull()?.value
      val stakeValue = stakeText436?.let { parseExactCents429(it, false) } ?: return null
      val pnlText436 = if (pnls.size == 1)
        resultRx.matchEntire(pnls.single().value)?.groupValues?.getOrNull(1)
      else bareProfit436.singleOrNull()?.value
      val pnlValue = if (closed)
        pnlText436?.let { parseExactCents429(it, true) } ?: return null
        else null
      if (stakeValue !in 100L..DemoRecoveryLedger.MAX_SINGLE_STAKE_CENTS ||
          (pnlValue != null && (pnlValue < -stakeValue || pnlValue > stakeValue))) {
        receiptStatus429 = "SUMĂ/P-L NECONFORMĂ • FĂRĂ RECUPERARE"
        return null
      }
      val coordinates = listOf(ids.single().rect.centerY(), verifiedStake436.rect.centerY()) +
        (if (closed) listOf(verifiedProfit436!!.rect.centerY()) else emptyList())
      // A uniquely identified CLOSED detail sheet may distribute fields
      // vertically. Keep the narrow same-row check for summary/list pages;
      // only a verified detail with explicit broker labels may be taller.
      if (!detailPage436 &&
          coordinates.maxOrNull()!! - coordinates.minOrNull()!! > (h * .16f).toInt())
        return null
      val key = listOf(root.packageName?.toString(), expectedPair, closed,
        id, stakeValue, pnlValue).joinToString("|")
      val now = android.os.SystemClock.elapsedRealtime()
      val priorKey = if (closed) closedReceiptKey429 else openReceiptKey429
      val priorAt = if (closed) closedReceiptAt429 else openReceiptAt429
      if (key != priorKey || now - priorAt !in 1_500L..15_000L) {
        if (closed) { closedReceiptKey429 = key; closedReceiptAt429 = now }
        else { openReceiptKey429 = key; openReceiptAt429 = now }
        receiptStatus429 = if (closed) "ÎNCHIS: ID ȘI P/L 1/2" else "DESCHIS: ID ȘI SUMĂ 1/2"
        return null
      }
      receiptStatus429 = if (closed) "ÎNCHIS: ID ȘI P/L VERIFICATE 2/2"
        else "DESCHIS: ID ȘI SUMĂ VERIFICATE 2/2"
      return DemoTradeReceipt429(root.packageName?.toString().orEmpty(),
        expectedPair, id, stakeValue, pnlValue)
    }

    fun returnToDemoChartAfterVerifiedEmptyReview(
      cachedDemoVerifiedOnChart: Boolean,
      ocrVerifiedHistoryPage: Boolean = false
    ): String {
      val info = activeDemoHistoryNodes(cachedDemoVerifiedOnChart)
        ?: return "REVINO LA GRAFIC • FEREASTRA DEMO NECONFIRMATĂ"
      val (svc, root, labels) = info
      if (svc.rootInActiveWindow?.packageName?.toString() != root.packageName?.toString())
        return "REVINO LA GRAFIC • BROKERUL NU ESTE ACTIV"
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return "REVINO LA GRAFIC • ECRAN NECUNOSCUT" }
      // Do not confuse the bottom navigation "Tranzacții" with the actual
      // history PAGE TITLE. No automatic Back from a live trade chart.
      val isHistory = labels.any { (node, bounds) ->
        bounds.centerY() in (metrics.heightPixels * 0.09f).toInt()..
          (metrics.heightPixels * 0.24f).toInt() &&
          listOfNotNull(node.text?.toString(), node.contentDescription?.toString()).any {
            Regex("""(?i)^(?:Tranzacții|Tranzactii|Transactions|Trades)$""").matches(it.trim())
          }
      }
      // 454: A two-frame visually verified page with both broker tabs
      // and footer is safe for BACK navigation even when the WebView
      // exposes no Accessibility title or clickable children.
      // The caller supplies this only from fresh same-package OCR history
      // evidence; no broker order or trade-status change follows this BACK.
      if (!isHistory && !historyPageIdentity454(labels, metrics.heightPixels) &&
          !ocrVerifiedHistoryPage)
        return "GRAFIC • VERIFICARE BROKER NECESARĂ"
      val accepted = try {
        svc.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
      } catch (_: Throwable) { false }
      return if (accepted)
        "✅ LISTĂ GOALĂ 2/2 • REVIN LA GRAFIC • AȘTEPT ȘOC"
      else "✅ LISTĂ GOALĂ 2/2 • REVINO LA GRAFIC"
    }

    fun inspectExplicitEmptyOpenDemoTabReadOnly(
      cachedDemoVerifiedOnChart: Boolean = false,
      ocrVerifiedEmptyOpenTab: Boolean = false
    ): Boolean {
      demoEmptyReviewStatus = "VERIFICARE LISTĂ DESCHIS"
      val svc = connected ?: run {
        demoEmptyReviewStatus = "ACCESIBILITATE DECONECTATĂ"
        return false
      }
      val root = readOnlyBrokerRoot(svc) ?: run {
        demoEmptyReviewStatus = "FEREASTRA BROKERULUI NU POATE FI CITITĂ"
        return false
      }
      val pkg = root.packageName?.toString().orEmpty()
      if (!BrokerAdapterRegistry.hasDemoExecutor(pkg)) {
        demoEmptyReviewStatus = "BROKER NEIDENTIFICAT"
        return false
      }
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return false }
      val w = metrics.widthPixels
      val h = metrics.heightPixels
      if (w < 300 || h < 600) return false

      data class VisibleLabel(val text: String, val bounds: Rect)
      val labels = ArrayList<VisibleLabel>()
      val queue = ArrayDeque<AccessibilityNodeInfo>()
      queue.add(root)
      var visited = 0
      while (queue.isNotEmpty() && visited++ < 350) {
        val node = queue.removeFirst()
        if (node.packageName?.toString() == pkg && node.isVisibleToUser) {
          val rect = Rect()
          node.getBoundsInScreen(rect)
          if (!rect.isEmpty && rect.left >= 0 && rect.right <= w &&
              rect.top >= 0 && rect.bottom <= h) {
            node.text?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let {
              labels.add(VisibleLabel(it.take(120), Rect(rect)))
            }
            node.contentDescription?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let {
              if (it != node.text?.toString()?.trim())
                labels.add(VisibleLabel(it.take(120), Rect(rect)))
            }
          }
        }
        for (i in 0 until node.childCount.coerceAtMost(35)) {
          node.getChild(i)?.let(queue::addLast)
        }
      }
      val header = labels.filter { it.bounds.centerY() < h * 0.25f }
      val demo = header.any {
        Regex("""(?i)\bQT\s*Demo\b""").containsMatchIn(it.text)
      }
      val real = header.any {
        Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(it.text)
      }
      // A REAL marker always rejects the review. Without a Demo header,
      // the caller must have verified QT Demo recently in this same package.
      if (real || (!demo && !cachedDemoVerifiedOnChart)) {
        demoEmptyReviewStatus = "QT DEMO NECONFIRMAT • REVINO LA GRAFIC"
        return false
      }

      // Require the full-screen Transactions page, not the chart footer.
      val pageTitle = labels.any {
        it.bounds.centerY() in (h * 0.095f).toInt()..(h * 0.22f).toInt() &&
          Regex("""(?i)^(?:Tranzacții|Tranzactii|Transactions|Trades)$""")
            .matches(it.text)
      }
      val openTab = labels.any {
        it.bounds.centerY() in (h * 0.15f).toInt()..(h * 0.30f).toInt() &&
          Regex("""(?i)^(?:Deschis|Open)$""").matches(it.text)
      }
      val closedTab454 = labels.any {
        it.bounds.centerY() in (h * 0.15f).toInt()..(h * 0.30f).toInt() &&
          Regex("""(?i)^(?:Închis|Inchis|Closed)$""").matches(it.text)
      }
      val footer454 = labels.any {
        it.bounds.centerY() in (h * 0.86f).toInt()..(h * 0.985f).toInt() &&
          Regex("""(?i)^(?:Tranzacții|Tranzactii|Transactions|Trades)$""")
            .matches(it.text)
      }
      val fullHistoryIdentity454 = pageTitle || (footer454 && openTab && closedTab454)
      // 412: Localized broker UI can express the same EXPLICIT empty
      // OPEN-position state in several exact phrases. Do not infer closure
      // from a missing count, a zero price, or chart-only OCR.
      // 413: On Motorola the empty message may be vertically centered below
      // half-height, not just in the top half. Require a full broker page,
      // its Open tab, and an EXPLICIT no-open-trades message; never infer
      // closure from a blank screen, absent counter or expired timer.
      val emptyPattern = Regex("""(?i)^(?:Nu există tranzacții plasate|Nu exista tranzactii plasate|Nu există tranzacții deschise|Nu exista tranzactii deschise|Nu există tranzacții active|Nu exista tranzactii active|Nu sunt tranzacții deschise|Nu sunt tranzactii deschise|Nicio tranzacție deschisă|Nicio tranzactie deschisa|Nicio tranzacție activă|Nicio tranzactie activa|No trades placed|No open trades|No open positions)$""")
      val explicitEmpty = labels.any {
        it.bounds.centerY() in (h * 0.20f).toInt()..(h * 0.88f).toInt() &&
          emptyPattern.matches(
            it.text.replace(Regex("""\s+"""), " ").trim().trimEnd('.')
          )
      }
      // 414: An independent MediaProjection+ML Kit sensor can prove a
      // full broker Transactions page, explicitly NO OPEN positions, and
      // the visually selected OPEN tab. Its caller requires two independent
      // fresh screen reads and the SAME verified Pocket Option DEMO package.
      // This fallback never works on chart view or with uncertain tab state.
      val confirmedByAccessibility =
        fullHistoryIdentity454 && openTab && explicitEmpty
      val confirmedByOcr = ocrVerifiedEmptyOpenTab && cachedDemoVerifiedOnChart
      demoEmptyReviewStatus = when {
        confirmedByAccessibility -> "LISTĂ GOALĂ CITITĂ • ACCESIBILITATE 1/2"
        confirmedByOcr -> "LISTĂ GOALĂ CITITĂ • ECRAN OCR 1/2"
        !fullHistoryIdentity454 -> "NU IDENTIFIC PAGINA TRANZACȚII"
        !openTab -> "NU IDENTIFIC FILA DESCHIS"
        else -> "MESAJUL LISTĂ GOALĂ NU ESTE CITIT"
      }
      return confirmedByAccessibility || confirmedByOcr
    }

    /** A persistent 5-minute guard still applies after any Android gesture.
     * A missing/ambiguous Android uptime value cannot authorize recovery.
     */
    fun priorDemoGestureCooldownComplete(): Boolean {
      val svc = connected ?: return false
      val prior = svc.getSharedPreferences("scalp_demo_order_safety", Context.MODE_PRIVATE)
        .getLong("lastAcceptedAt", 0L)
      if (prior == 0L) return true
      val uptime = android.os.SystemClock.elapsedRealtime()
      val elapsed = uptime - prior
      // 454: Android elapsedRealtime() resets on Motorola reboot, while
      // SharedPreferences retains the previous boot's absolute uptime.
      // A negative difference is NEVER evidence the old cooldown passed;
      // require at least five minutes since THIS boot AND the independent
      // broker ZERO-OPEN 2/2 proof before any DEMO rearm.
      return if (elapsed < 0L) uptime >= 5 * 60_000L
        else elapsed >= 5 * 60_000L
    }

    fun inspectVisibleDemoOpenBadgeReadOnly(): String {
      val svc = connected ?: return "CONT NECUNOSCUT • ACCESIBILITATE OPRITĂ"
      val root = readOnlyBrokerRoot(svc)
        ?: return "CONT NECUNOSCUT • FEREASTRĂ INDISPONIBILĂ"
      val pkg = root.packageName?.toString().orEmpty()
      if (!BrokerAdapterRegistry.hasDemoExecutor(pkg))
        return "BROKER NECUNOSCUT • SCANARE FĂRĂ ORDINE"
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) {
        return "POZIȚIE NECUNOSCUTĂ • ECRAN NECONFIRMAT"
      }
      val w = metrics.widthPixels
      val h = metrics.heightPixels
      if (w < 300 || h < 600)
        return "POZIȚIE NECUNOSCUTĂ • DIMENSIUNI ECRAN"
      data class LabelOnScreen(val value: String, val rect: Rect)
      val labels = ArrayList<LabelOnScreen>()
      val queue = ArrayDeque<AccessibilityNodeInfo>()
      queue.add(root)
      var visited = 0
      while (queue.isNotEmpty() && visited++ < 320) {
        val node = queue.removeFirst()
        if (node.packageName?.toString() == pkg && node.isVisibleToUser) {
          val rect = Rect()
          node.getBoundsInScreen(rect)
          if (!rect.isEmpty && rect.top >= 0 && rect.bottom <= h &&
              rect.left >= 0 && rect.right <= w) {
            node.text?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let {
              if (it.length <= 55) labels.add(LabelOnScreen(it, Rect(rect)))
            }
            node.contentDescription?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let {
              if (it.length <= 55) labels.add(LabelOnScreen(it, Rect(rect)))
            }
          }
        }
        for (i in 0 until node.childCount.coerceAtMost(40))
          node.getChild(i)?.let(queue::addLast)
      }
      // Require QT Demo explicitly in the upper header and no QT Real marker.
      val header = labels.filter { it.rect.centerY() < h * 0.28f }
      val demo = header.any {
        Regex("""(?i)\bQT\s*Demo\b""").containsMatchIn(it.value)
      }
      val real = header.any {
        Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(it.value)
      }
      if (!demo || real) return "QT DEMO NECONFIRMAT • NU ARMEZ ORDINE"

      val tradeLabels = labels.filter {
        it.rect.centerX() < w * 0.36f && it.rect.centerY() > h * 0.83f &&
          Regex("""(?i)^(?:Tranzacții|Tranzactii|Transactions|Trades)$""")
            .matches(it.value.replace(Regex("""\s+"""), " ").trim())
      }
      if (tradeLabels.isEmpty())
        return "QT DEMO • ISTORICUL NU ESTE VIZIBIL • ÎNCHIDERE NECONFIRMATĂ"
      // 407: only read a genuine SMALL single-digit badge immediately
      // adjacent to the "Tranzacții" bottom-navigation tab. The wide 92%
      // BUY/SELL payout buttons occupy the panel just ABOVE this nav strip,
      // and were incorrectly reported as 92 OPEN TRADES in 405/406.
      // This hint is never authoritative proof that a trade has CLOSED.
      val positives = labels.filter { item ->
        item.value.matches(Regex("""^[1-9]$""")) &&
          item.rect.width() > 0 && item.rect.height() > 0 &&
          item.rect.width() <= w * 0.08f &&
          item.rect.height() <= h * 0.045f &&
          tradeLabels.any { tab ->
            kotlin.math.abs(item.rect.centerX() - tab.rect.centerX()) < w * 0.14f &&
              item.rect.centerY() >= tab.rect.centerY() - h * 0.065f &&
              item.rect.centerY() <= tab.rect.centerY() + h * 0.015f
          }
      }.mapNotNull { it.value.toIntOrNull() }.distinct()
      return if (positives.size == 1)
        "QT DEMO • INDICATOR " + positives[0] + " LÂNGĂ TRANZACȚII • ÎNCHIDERE NEVERIFICATĂ"
      else "QT DEMO • NR. TRANZACȚII NEVERIFICAT • NU DUBLEZ"
    }

    fun inspectDemoBrokerReadOnly(): String {
      val svc = connected ?: return "ROBOT NECONECTAT • FĂRĂ ACCES LA BROKER"
      val root = svc.rootInActiveWindow
        ?: return "FEREASTRA BROKERULUI NU ESTE DISPONIBILĂ"
      val packageName = root.packageName?.toString() ?: ""
      if (packageName == svc.packageName ||
          packageName.startsWith("com.android.settings") ||
          packageName.contains("calculator", ignoreCase = true))
        return "DESCHIDE POCKET OPTION • VERIFICARE FĂRĂ CLIC"

      // Explicit bounded, ephemeral read; do not store accessibility contents.
      val queue = ArrayDeque<AccessibilityNodeInfo>()
      val labels = ArrayList<String>()
      queue.add(root)
      var visited = 0
      while (queue.isNotEmpty() && visited < 240) {
        val node = queue.removeFirst()
        visited += 1
        val text = node.text?.toString()?.trim().orEmpty()
        val description = node.contentDescription?.toString()?.trim().orEmpty()
        if (text.isNotEmpty()) labels.add(text.take(100))
        if (description.isNotEmpty() && description != text)
          labels.add(description.take(100))
        for (i in 0 until node.childCount.coerceAtMost(30)) {
          node.getChild(i)?.let { queue.addLast(it) }
        }
      }

      val visible = labels.joinToString(" ").replace(Regex("""\s+"""), " ")
      val real = Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(visible)
      val demo = Regex("""(?i)\bQT\s*Demo\b""").containsMatchIn(visible)
      val buy = Regex("""(?i)(CUMPĂRAȚI|CUMPARATI|BUY)""").containsMatchIn(visible)
      val sell = Regex("""(?i)(VINDEȚI|VINDETI|SELL)""").containsMatchIn(visible)

      // Conservative: false-negative means diagnostics only, never a tap.
      return when {
        real -> "BLOCAT: QT REAL DETECTAT • FĂRĂ ATINGERI"
        !demo -> "QT DEMO NECONFIRMAT ÎN ACCESIBILITATE"
        !buy || !sell -> "QT DEMO VIZIBIL • BUTOANE BUY/SELL NECONFIRMATE"
        else -> "QT DEMO + BUY/SELL IDENTIFICATE • NUMAI CITIRE"
      }
    }


    /**
     * An explicitly confirmed, single BUY/SELL *DEMO* order pilot.
     * Fails closed on unknown apps, mixed Demo/Real markers, stale controls,
     * ambiguous targets, insufficient balance, or unverified 1 USD amount.
     *
     * No signal callback ever calls this; only a deliberate double press in
     * Scalp Atlas can call it. ACTION_CLICK only reports Android acceptance,
     * NOT broker execution: the human verifies the DEMO transaction log.
     */
    private data class DemoOrderTarget(
      val node: AccessibilityNodeInfo,
      val activePackage: String
    )
    private data class DemoOrderCheck(
      val target: DemoOrderTarget? = null,
      val reason: String,
      val payoutPercent: Int? = null,
      val stakeCents: Long? = null
    )
    private const val DEMO_TEST_LOCK_MS = 300_000L

    private fun checkOneDollarDemoTarget(
      side: String,
      requirePayout92: Boolean = false,
      expectedStakeCents: Long? = 100L
    ): DemoOrderCheck {
      if (expectedStakeCents != null &&
          expectedStakeCents !in 100L..DemoRecoveryLedger.MAX_SINGLE_STAKE_CENTS)
        return DemoOrderCheck(reason = "BLOCAT: MIZĂ PESTE LIMITA DEMO")

      val svc = connected ?: return DemoOrderCheck(reason = "ROBOT NECONECTAT")
      if (side != "BUY" && side != "SELL") return DemoOrderCheck(reason = "DIRECȚIE INVALIDĂ")
      val root = svc.rootInActiveWindow ?: return DemoOrderCheck(reason = "BROKERUL NU ESTE ACTIV")
      val pkg = root.packageName?.toString().orEmpty()
      // Known official Android app identifiers; never click a browser, unknown
      // app, copycat or Scalp Atlas's own overlay.
      if (!BrokerAdapterRegistry.hasDemoExecutor(pkg))
        return DemoOrderCheck(reason = "APLICAȚIE NECONFIRMATĂ: " + pkg.take(36))
      // Accessibility bounds are absolute SCREEN coordinates, including the
      // status/navigation regions. resources.displayMetrics.heightPixels may
      // EXCLUDE them on Motorola and was cutting off the visible amount.
      val realMetrics = android.util.DisplayMetrics()
      try {
        val manager = svc.getSystemService(Context.WINDOW_SERVICE)
          as android.view.WindowManager
        @Suppress("DEPRECATION")
        manager.defaultDisplay.getRealMetrics(realMetrics)
      } catch (_: Throwable) {
        return DemoOrderCheck(reason = "BLOCAT: DIMENSIUNILE ECRANULUI SUNT INDISPONIBILE")
      }
      val w = realMetrics.widthPixels
      val h = realMetrics.heightPixels
      if (w < 300 || h < 650) return DemoOrderCheck(reason = "ECRAN NEIDENTIFICAT")
      data class VisibleLabel(val node: AccessibilityNodeInfo, val value: String, val rect: Rect)
      val labels = ArrayList<VisibleLabel>()
      val queue = ArrayDeque<AccessibilityNodeInfo>()
      queue.add(root)
      var visited = 0
      while (queue.isNotEmpty() && visited < 350) {
        val node = queue.removeFirst()
        visited++
        if (node.packageName?.toString() == pkg && node.isVisibleToUser) {
          val bounds = Rect()
          node.getBoundsInScreen(bounds)
          if (bounds.width() > 0 && bounds.height() > 0 &&
              bounds.left >= 0 && bounds.right <= w &&
              bounds.top >= 0 && bounds.bottom <= h) {
            val content = node.text?.toString()?.trim().orEmpty()
            val description = node.contentDescription?.toString()?.trim().orEmpty()
            if (content.isNotEmpty()) labels.add(VisibleLabel(node, content.take(120), Rect(bounds)))
            if (description.isNotEmpty() && description != content)
              labels.add(VisibleLabel(node, description.take(120), Rect(bounds)))
          }
        }
        for (i in 0 until node.childCount.coerceAtMost(35))
          node.getChild(i)?.let(queue::addLast)
      }
      val demo = labels.any { it.rect.centerY() < h * 0.28 &&
        Regex("""(?i)\bQT\s*Demo\b""").containsMatchIn(it.value) }
      val real = labels.any { Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(it.value) }
      if (real) return DemoOrderCheck(reason = "BLOCAT: QT REAL PE ECRAN")
      if (!demo) return DemoOrderCheck(reason = "BLOCAT: QT DEMO NECONFIRMAT")

      // Match the amount to the actual "Suma" caption, NOT to a global
      // screen-height band. Android can exclude status/navigation regions
      // from DisplayMetrics, so the old 69–82% crop missed a visible "1".
      // Android WebView may expose the same physical Suma caption twice:
      // once as text and once as contentDescription, with slightly different
      // rectangles. A strict "exactly one node" check blocked the legitimate
      // 1 USD QT Demo field even though only one caption was visible.
      // Treat nearby copies as one PHYSICAL caption, never accept physically
      // distant labels, and accept both "Suma" and "Sumă".
      val rawAmountCaptions = labels.filter {
        it.rect.centerX() > w * 0.46 &&
        it.rect.centerY() in (h * 0.62).toInt()..(h * 0.88).toInt() &&
        it.rect.width() <= (w * 0.48f).toInt() &&
        it.rect.height() <= (h * 0.075f).toInt() &&
        Regex("""(?i)^\s*Sum[ăa]\s*:?\s*$""").matches(it.value)
      }
      val bestCaption = rawAmountCaptions.minByOrNull {
        it.rect.width().toLong() * it.rect.height().toLong()
      }
      if (bestCaption == null)
        return DemoOrderCheck(reason = "BLOCAT: SUMĂ • 0 ETICHETE ANDROID")
      val separateCaptions = rawAmountCaptions.filter {
        kotlin.math.abs(it.rect.centerX() - bestCaption.rect.centerX()) >
          (w * 0.15f).toInt() ||
        kotlin.math.abs(it.rect.centerY() - bestCaption.rect.centerY()) >
          (h * 0.035f).toInt()
      }
      if (separateCaptions.isNotEmpty())
        return DemoOrderCheck(reason = "BLOCAT: SUMĂ • " +
          rawAmountCaptions.size + " ETICHETE ÎN POZIȚII DIFERITE")
      val caption = bestCaption
      // The 92% payout labels sit directly underneath the amount input on
      // Motorola G24, and were incorrectly collected as a second "amount".
      // Find the first actual broker BUY/SELL action text and NEVER inspect
      // numeric nodes at or underneath that action region as amount values.
      val brokerActionLabels = labels.filter {
        it.rect.centerY() >= h * 0.77 &&
        it.rect.centerY() <= h * 0.96 &&
        Regex("""(?i)^\s*(?:CUMPĂRAȚI|CUMPARATI|VINDEȚI|VINDETI)(?:\s+\d{1,3}\s*%)?\s*$""")
          .matches(it.value.replace('\n', ' ').replace(Regex("""\s+"""), " ").trim())
      }
      val actionTop = brokerActionLabels.map { it.rect.top }
        .filter { it > caption.rect.bottom + (h * 0.015f).toInt() }
        .minOrNull()
        ?: return DemoOrderCheck(
          reason = "BLOCAT: LIMITA CÂMPULUI SUMĂ NU ESTE CONFIRMATĂ"
        )
      // The amount field is DIRECTLY BELOW the "Suma" caption on Moto G24.
      // The previous ±10%-of-screen vertical band could include text from
      // unrelated controls (payout/time/price) as if it were the amount.
      // Only examine compact accessibility nodes in the same input column,
      // beneath that caption. Never read a full-screen WebView parent as a
      // monetary value, and NEVER infer "1" from the chart or a screenshot.
      val nearby = labels.filter {
        val x = it.rect.centerX()
        val y = it.rect.centerY()
        val narrowColumnLeft = caption.rect.left - (w * 0.04f).toInt()
        val narrowColumnRight = minOf(
          (w * 0.83f).toInt(), caption.rect.right + (w * 0.18f).toInt()
        )
        val fieldTop = caption.rect.bottom - (h * 0.015f).toInt()
        // Exclude both BUY/SELL payout values: they are not amount nodes.
        // Margin leaves a gap above broker controls on different DP scales.
        val fieldBottom = minOf(
          caption.rect.bottom + (h * 0.060f).toInt(),
          actionTop - (h * 0.012f).toInt()
        )
        x >= narrowColumnLeft && x <= narrowColumnRight &&
          y in fieldTop..fieldBottom &&
          it.rect.width() <= (w * 0.55f).toInt() &&
          it.rect.height() <= (h * 0.105f).toInt()
      }.distinctBy { it.rect.toShortString() + ":" + it.value.trim() }
      // Keep only an unambiguous value. Android WebViews may duplicate
      // the exact same visible amount as parent and child accessibility
      // nodes, so deduplicate EQUAL numeric values; never choose among
      // conflicting numbers or infer a value from pixels.
      val strictOne = Regex("""(?i)^\s*(?:USD\s*|\$\s*)?1(?:[.,]0{1,2})?(?:\s*(?:USD|\$))?\s*$""")
      val amountNumber = Regex("""(?i)^\s*(?:(?:USD|\$)\s*)?\d+(?:[.,]\d{1,2})?(?:\s*(?:USD|\$))?\s*$""")
      fun canonicalAmount(v: String): String {
        val cleaned = v.uppercase().replace("USD", "").replace("\$", "")
          .replace(",", ".").trim()
        return cleaned.toDoubleOrNull()?.let {
          if (it.isFinite()) "%.2f".format(java.util.Locale.ROOT, it) else cleaned
        } ?: cleaned
      }
      val numericNearby = nearby.filter { amountNumber.matches(it.value) }
      // First choice: a uniquely identified editable text field is the
      // actual monetary input; ordinary sibling labels are not.
      val editableValues = numericNearby.filter {
        it.node.isEditable ||
          it.node.className?.toString()?.contains("EditText", ignoreCase = true) == true
      }.map { canonicalAmount(it.value) }.distinct()

      // Motorola WebView can expose payout as a bare numeric sibling ("79")
      // within the broad amount column. Do NOT discard arbitrary numbers:
      // only a DIFFERENT, non-editable number that matches both independently
      // visible BUY and SELL percentages can be classified as a payout echo.
      val percentRx = Regex("""(?<!\d)(\d{1,3})\s*%(?!\d)""")
      fun sidePayout(buy: Boolean): Int? {
        val sideNumbers = labels.filter {
          it.rect.centerY() >= actionTop - (h * 0.020f).toInt() &&
            it.rect.centerY() <= h * 0.96f &&
            (if (buy) it.rect.centerX() < w * 0.49f
             else it.rect.centerX() > w * 0.51f)
        }.mapNotNull {
          percentRx.find(it.value)?.groupValues?.getOrNull(1)?.toIntOrNull()
        }.distinct()
        return sideNumbers.singleOrNull()
      }
      val buyPercent = sidePayout(true)
      val sellPercent = sidePayout(false)
      val verifiedPayout = if (buyPercent != null && buyPercent == sellPercent)
        buyPercent else null
      // "92" can be exposed both as a number near the Suma field and
      // as a separate child of the broker's BUY/SELL payout control.
      // Only discard the numeric echo when BOTH button percentages confirm
      // the same payout AND its accessibility bounds belong to the clickable
      // BUY/SELL control. Never discard a conflicting editable amount.
      val payoutButtonRects = brokerActionLabels.mapNotNull { label ->
        var clickable: AccessibilityNodeInfo? = label.node
        var depth = 0
        while (clickable != null && !clickable.isClickable && depth++ < 4) {
          clickable = clickable.parent
        }
        val r = Rect()
        clickable?.getBoundsInScreen(r)
        if (r.width() > 0 && r.height() > 0 &&
            r.centerY() >= (h * 0.76f).toInt() &&
            r.centerY() <= (h * 0.97f).toInt() &&
            r.width() <= (w * 0.58f).toInt()) r else null
      }
      val payoutValue = verifiedPayout?.let {
        "%.2f".format(java.util.Locale.ROOT, it.toDouble())
      }
      val provenPayoutEchoes = numericNearby.filter { candidate ->
        payoutValue != null && canonicalAmount(candidate.value) == payoutValue &&
          !candidate.node.isEditable &&
          candidate.node.className?.toString()?.contains("EditText", ignoreCase = true) != true &&
          payoutButtonRects.any { area ->
            area.contains(candidate.rect.centerX(), candidate.rect.centerY())
          }
      }
      val amountOnlyNumbers = numericNearby.filterNot { candidate ->
        provenPayoutEchoes.any { it.node === candidate.node &&
          it.rect == candidate.rect && it.value == candidate.value }
      }
      val allAmountValues = amountOnlyNumbers.map {
        canonicalAmount(it.value)
      }.distinct()
      val exactOneNodes = amountOnlyNumbers.filter {
        canonicalAmount(it.value) == "1.00"
      }
      val otherNodes = amountOnlyNumbers.filter {
        canonicalAmount(it.value) != "1.00"
      }
      val earliestOneY = exactOneNodes.minOfOrNull { it.rect.centerY() }
      // Formatter %.2f requires floating-point input, not an Int.
      // This regression caused IllegalFormatConversionException on Moto G24
      // when the broker duplicated the 92% payout beside the 1 USD input.
      // Motorola WebView can assign the payout number ("92") the SAME
      // accessibility row/bounds as the amount ("1") even though the actual
      // visible payout is inside both BUY and SELL buttons. The older test
      // required the 92 node to be lower and therefore blocked valid QT Demo
      // screens with "SUMĂ AMBIGUĂ: 1.00/92.00 • ECHO PAYOUT 0".
      // Only resolve that one exact ambiguity when:
      //  - the ONE value is anchored directly under the unique "Suma" caption;
      //  - both visible broker buttons independently show the SAME payout >=92;
      //  - every other nearby non-editable number equals THAT payout;
      //  - no editable field disagrees with 1 USD.
      // All other ambiguous combinations remain BLOCKED; QT REAL still blocks.
      val echoFromLowerButtons = editableValues.isEmpty() &&
        exactOneNodes.isNotEmpty() && otherNodes.isNotEmpty() &&
        earliestOneY != null && verifiedPayout != null &&
        verifiedPayout in 92..100 &&
        exactOneNodes.any {
          it.rect.centerY() >= caption.rect.bottom - (h * 0.015f).toInt() &&
            it.rect.centerY() <= actionTop - (h * 0.012f).toInt() &&
            it.rect.centerX() >= caption.rect.left - (w * 0.04f).toInt() &&
            !it.node.isEditable
        } &&
        otherNodes.all {
          !it.node.isEditable &&
            it.node.className?.toString()?.contains("EditText", ignoreCase = true) != true &&
            canonicalAmount(it.value) == payoutValue
        }
      // If payout cannot be independently established, if the extra number
      // is in the same input row, or if editable data conflicts: BLOCK.
      val amountValues = when {
        editableValues.isNotEmpty() -> editableValues
        echoFromLowerButtons -> listOf("1.00")
        else -> allAmountValues
      }
      // A parent may expose both caption and amount as a single label;
      // use that only if no separate numeric amount value exists.
      val inlineOne = nearby.any {
        Regex("""(?i)^\s*Sum[ăa]\s*:?\s*(?:USD\s*|\$\s*)?1(?:[.,]0{1,2})?(?:\s*(?:USD|\$))?\s*$""")
          .matches(it.value)
      }
      val observedStakeCents = amountValues.singleOrNull()?.replace(".", "")?.toLongOrNull()
        ?: if (amountValues.isEmpty() && inlineOne) 100L else null
      val verifiedStakeCents = expectedStakeCents ?: observedStakeCents
        ?: return DemoOrderCheck(reason = "BLOCAT: SUMĂ DEMO NECONFIRMATĂ")
      val expectedFormatted = String.format(java.util.Locale.ROOT, "%d.%02d",
        verifiedStakeCents / 100L, verifiedStakeCents % 100L)
      // A stake >1 USD is allowed ONLY from one unique, real editable input.
      // Never use label-only 1 USD fallback or payout echo for larger stakes.
      val hasDynamicStake = verifiedStakeCents > 100L &&
        editableValues.size == 1 && editableValues.single() == expectedFormatted &&
        amountValues.size == 1 && amountValues.single() == expectedFormatted &&
        try { DemoStakeEditor.verifiedExactDemoStakeReadOnly(svc, verifiedStakeCents) }
        catch (_: Throwable) { false }
      val hasOneDollar = if (expectedStakeCents == null) verifiedStakeCents > 0L
        else hasDynamicStake || (verifiedStakeCents == 100L &&
        ((amountValues.size == 1 && strictOne.matches(amountValues.single())) ||
        (amountValues.isEmpty() && inlineOne)))
      if (!hasOneDollar)
        return DemoOrderCheck(reason = when {
          amountValues.size > 1 ->
            "BLOCAT: SUMĂ AMBIGUĂ • " + amountValues.size +
              " VALORI: " + amountValues.take(3).joinToString("/") { it.take(6) } +
              " • ECHO PAYOUT " + provenPayoutEchoes.size +
              " • PAYOUT " + (verifiedPayout?.toString() ?: "NECONFIRMAT") +
              "% • FĂRĂ ORDIN"
          amountValues.isEmpty() ->
            "BLOCAT: SUMA NU E VIZIBILĂ ÎN ARBORELE ANDROID"
          else -> "BLOCAT: VALOAREA CITITĂ " + amountValues.single().take(7) +
            " NU ESTE 1 USD"
        })

      // Validate that demo balance is visible in the narrow account region;
      // the chart quotes have more decimal places and cannot count as balance.
      val balanceValues = labels.filter {
        it.rect.centerX() in (w * 0.48).toInt()..(w * 0.86).toInt() &&
        it.rect.centerY() < h * 0.17
      }.mapNotNull {
        Regex("""(?<!\d)(\d{1,5}[.,]\d{2})(?!\d)""").find(it.value)
          ?.groupValues?.getOrNull(1)?.replace(',', '.')?.toDoubleOrNull()
      }.distinct()
      if (balanceValues.size != 1 || balanceValues[0] < verifiedStakeCents / 100.0)
        return DemoOrderCheck(reason = "BLOCAT: SOLD DEMO NECONFIRMAT SAU INSUFICIENT")

      val expression = if (side == "BUY")
        Regex("""(?i)^\s*(?:CUMPĂRAȚI|CUMPARATI)(?:\s+\d{1,3}\s*%)?\s*$""")
      else Regex("""(?i)^\s*(?:VINDEȚI|VINDETI)(?:\s+\d{1,3}\s*%)?\s*$""")
      val candidates = labels.filter {
        expression.matches(it.value.replace('\n',' ').trim()) &&
        it.rect.centerY() >= h * 0.77 &&
        it.rect.centerY() <= h * 0.94 &&
        (if (side == "BUY") it.rect.centerX() < w * 0.50
         else it.rect.centerX() > w * 0.50)
      }.mapNotNull { matching ->
        var node: AccessibilityNodeInfo? = matching.node
        var steps = 0
        while (node != null && !node.isClickable && steps++ < 4)
          node = node.parent
        if (node == null || !node.isEnabled || !node.isVisibleToUser ||
            node.packageName?.toString() != pkg) null
        else {
          val bounds = Rect()
          node.getBoundsInScreen(bounds)
          if (bounds.isEmpty || bounds.top < h * 0.76 ||
              bounds.bottom > h * 0.96 ||
              (if (side == "BUY") bounds.centerX() >= w * 0.51
               else bounds.centerX() <= w * 0.49)) null
          else Pair(node, bounds.toShortString())
        }
      }.distinctBy { it.second }
      if (candidates.size != 1)
        return DemoOrderCheck(reason = "BLOCAT: BUTONUL " + side + " NU ESTE UNIC ȘI APĂSABIL")
      if (requirePayout92) {
        // Payout must be visible INSIDE the intended button, not elsewhere
        // on the chart. Never guess 92% from a different currency pair.
        val buttonBounds = Rect()
        candidates.single().first.getBoundsInScreen(buttonBounds)
        val payoutPattern = Regex("""(?<![0-9])(\d{1,3})\s*%(?![0-9])""")
        val payoutValues = labels.filter {
          it.rect.centerX() in buttonBounds.left..buttonBounds.right &&
          it.rect.centerY() in buttonBounds.top..buttonBounds.bottom &&
          it.rect.width() <= buttonBounds.width()
        }.flatMap { label ->
          payoutPattern.findAll(label.value).mapNotNull { match ->
            match.groupValues[1].toIntOrNull()
          }.toList()
        }.distinct()
        if (payoutValues.size != 1 || payoutValues[0] !in 92..100)
          return DemoOrderCheck(
            reason = "BLOCAT: PAYOUT " + side + " NECONFIRMAT ≥92%"
          )
      }
      if (svc.rootInActiveWindow?.packageName?.toString() != pkg)
        return DemoOrderCheck(reason = "BLOCAT: APLICAȚIA ACTIVĂ S-A SCHIMBAT")
      return DemoOrderCheck(DemoOrderTarget(candidates[0].first, pkg),
        "GATA " + side + " • QT DEMO • SUMĂ VERIFICATĂ", verifiedPayout, verifiedStakeCents)
    }

    // 429: No dependency on an editable amount field for the FIRST $1 order.
    // Payout must agree on BOTH physically verified BUY and SELL buttons.
    fun readVerifiedDemoPayoutForStake429(
      expectedPair: String, expectedStakeCents: Long
    ): Int? {
      if (readVisibleDemoPair() != expectedPair) return null
      val buy = checkOneDollarDemoTarget("BUY", true, expectedStakeCents)
      val sell = checkOneDollarDemoTarget("SELL", true, expectedStakeCents)
      val bp = buy.payoutPercent
      val sp = sell.payoutPercent
      if (buy.target == null || sell.target == null || bp == null ||
          bp != sp || bp !in 92..100 || readVisibleDemoPair() != expectedPair)
        return null
      return bp
    }

    /**
     * 424: Check broker DEMO payout for the current confirmed pair, twice.
     * This never edits fields or submits a transaction.
     */
    fun readVerifiedDemoPayoutForPair(expectedPair: String): Int? {
      val svc = connected ?: return null
      if (expectedPair.isBlank() || expectedPair == "NEIDENTIFICAT")
        return null
      if (readVisibleDemoPair() != expectedPair) return null
      val payout = DemoStakeEditor.verifiedDemoPayoutReadOnly(svc)
        ?: return null
      if (connected !== svc || readVisibleDemoPair() != expectedPair)
        return null
      return payout
    }

    /**
     * 423: Secure DEMO stake-field editing only, never an order.
     * Call ONLY after the matching broker CLOSED receipt is independently
     * verified by a future history adapter and the ledger authorizes a quote.
     * Currently no unverified visual signal or timer can invoke this method.
     */
    fun setVerifiedDemoRecoveryStakeOnBroker(
      expectedPair: String,
      stakeCents: Long
    ): String {
      val svc = connected ?: return "ACCESIBILITATE NECONECTATĂ • FĂRĂ MODIFICARE"
      if (expectedPair.isBlank() || expectedPair == "NEIDENTIFICAT")
        return "PERECHE NECONFIRMATĂ • FĂRĂ MODIFICARE"
      val matches = {
        try {
          connected === svc && readVisibleDemoPair() == expectedPair &&
            BrokerAdapterRegistry.hasDemoExecutor(
              svc.rootInActiveWindow?.packageName?.toString().orEmpty()
            )
        } catch (_: Throwable) { false }
      }
      return DemoStakeEditor.setExactDemoStake(svc, matches, stakeCents)
    }

    /**
     * Read-only diagnostic for the amount widget. It only reports if Android
     * exposes the exact 1 USD value; never returns the user's account data or
     * performs any action. The same validation gates are used by the pilot.
     */
    fun diagnoseOneDollarAmount(side: String = "BUY"): String {
      val result = checkOneDollarDemoTarget(side)
      return when {
        result.target != null -> "SUMĂ 1 USD CONFIRMATĂ • QT DEMO • TEST PREGĂTIT"
        result.reason.contains("SUMĂ", ignoreCase = true) ->
          "DIAG SUMĂ: " + result.reason.removePrefix("BLOCAT: ")
        else -> result.reason
      }
    }

    /**
     * Standalone 387 test for the user's explicit "any pair" instruction:
     * no SHOCK condition and no currency pair lookup. Still fail-closed on
     * broker app package, account QT Demo, 1 USD, balance, payout 92% and
     * exactly one BUY/Sell widget exposed through Android Accessibility.
     */
    fun preflightAnyPairDemoBuy(): String {
      val svc = connected ?: return "BLOCAT: ACCESIBILITATE NECONECTATĂ"
      val now = android.os.SystemClock.elapsedRealtime()
      val last = svc.getSharedPreferences("scalp_demo_order_safety", Context.MODE_PRIVATE)
        .getLong("lastAcceptedAt", 0L)
      if (last > 0L && now - last in 0 until DEMO_TEST_LOCK_MS)
        return "BLOCAT: O PROBĂ DEMO ÎN ULTIMELE 5 MINUTE"
      val buy = checkOneDollarDemoTarget("BUY", true)
      if (buy.target == null) return buy.reason
      val sell = checkOneDollarDemoTarget("SELL", true)
      if (sell.target == null) return sell.reason
      return "GATA TEST BUY QT DEMO • 1 USD • ORICE PERECHE • PAYOUT ≥92%"
    }

    /**
     * Explicit one-shot QT Demo BUY gesture pilot.
     *
     * AccessibilityNodeInfo.ACTION_CLICK can return true on a WebView
     * wrapper without delivering a real pointer event to its trade button.
     * This test instead sends one short Android touch at the center of the
     * strictly verified BUY button. No arbitrary broker coordinates.
     *
     * We NEVER interpret gesture acceptance/completion as a confirmed order:
     * confirmation belongs to the Pocket Option DEMO Open/Closed history.
     * Global once-only lock is persisted BEFORE dispatch; no automatic retry.
     */

    /**
     * 397: A standalone, once-only SELL trial after the user starts LIVE.
     * Requires official QT Demo, 1 USD, readable Demo balance and >=92% payout.
     * Never permits QT Real or trades from an unknown application.
     */
    fun preflightAnyPairDemoSell(): String {
      val svc = connected ?: return "BLOCAT: ACCESIBILITATE NECONECTATĂ"
      val now = android.os.SystemClock.elapsedRealtime()
      val last = svc.getSharedPreferences("scalp_demo_order_safety", Context.MODE_PRIVATE)
        .getLong("lastAcceptedAt", 0L)
      if (last > 0L && now - last in 0 until DEMO_TEST_LOCK_MS)
        return "BLOCAT: O PROBĂ DEMO ÎN ULTIMELE 5 MINUTE"
      val sell = checkOneDollarDemoTarget("SELL", true)
      if (sell.target == null) return sell.reason
      val buy = checkOneDollarDemoTarget("BUY", true)
      if (buy.target == null) return buy.reason
      return "GATA TEST SELL QT DEMO • 1 USD • ORICE PERECHE • PAYOUT ≥92%"
    }

    @Synchronized
    fun pressAnyPairDemoBuyOnce(onResult: (String) -> Unit): String {
      val svc = connected ?: return "BLOCAT: ACCESIBILITATE NECONECTATĂ"
      val now = android.os.SystemClock.elapsedRealtime()
      val store = svc.getSharedPreferences("scalp_demo_order_safety", Context.MODE_PRIVATE)
      val last = store.getLong("lastAcceptedAt", 0L)
      if (last > 0L && now - last in 0 until DEMO_TEST_LOCK_MS)
        return "BLOCAT: LIMITĂ 5 MINUTE • FĂRĂ GEST"
      // Freshly verify exact broker package, QT Demo and absence of QT Real,
      // readable 1 USD, sufficient Demo balance, payout >=92% and unique BUY.
      val check = checkOneDollarDemoTarget("BUY", true)
      val target = check.target ?: return check.reason
      // Also require a separately identifiable SELL button before a live tap.
      val sell = checkOneDollarDemoTarget("SELL", true)
      if (sell.target == null) return sell.reason
      if (svc.rootInActiveWindow?.packageName?.toString() != target.activePackage)
        return "BLOCAT: BROKERUL NU MAI ESTE ACTIV"
      val bounds = Rect()
      target.node.getBoundsInScreen(bounds)
      val metrics = android.util.DisplayMetrics()
      try {
        val manager = svc.getSystemService(Context.WINDOW_SERVICE)
          as android.view.WindowManager
        @Suppress("DEPRECATION")
        manager.defaultDisplay.getRealMetrics(metrics)
      } catch (error: Exception) {
        return "BLOCAT: ECRAN ANDROID NECONFIRMAT"
      }
      val x = bounds.exactCenterX()
      val y = bounds.exactCenterY()
      if (bounds.width() < 65 || bounds.height() < 35 ||
          bounds.left < 0 || bounds.top < (metrics.heightPixels * 0.76f).toInt() ||
          bounds.bottom > (metrics.heightPixels * 0.96f).toInt() ||
          bounds.right > metrics.widthPixels ||
          x >= metrics.widthPixels * 0.50f ||
          y <= 0f || y >= metrics.heightPixels.toFloat())
        return "BLOCAT: CENTRUL BUY NU ESTE CONFIRMAT"
      // Persist the allowance even when Android rejects a gesture, because
      // a double tap could result in two broker orders.
      if (!store.edit().putLong("lastAcceptedAt", now).commit())
        return "BLOCAT: NU POT SALVA LIMITA GESTULUI"
      if (svc.rootInActiveWindow?.packageName?.toString() != target.activePackage)
        return "BLOCAT: BROKERUL S-A SCHIMBAT • FĂRĂ GEST"
      val path = Path().apply { moveTo(x, y) }
      val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 85L))
        .build()
      return try {
        val submitted = svc.dispatchGesture(gesture, object : GestureResultCallback() {
          override fun onCompleted(gestureDescription: GestureDescription?) {
            onResult("GEST BUY TRIMIS • VERIFICĂ TRANZACȚII > DESCHIS")
          }
          override fun onCancelled(gestureDescription: GestureDescription?) {
            onResult("GEST BUY ANULAT DE ANDROID • FĂRĂ REPETARE")
          }
        }, Handler(Looper.getMainLooper()))
        if (submitted) "GEST BUY ACCEPTAT DE ANDROID • FĂRĂ CONFIRMARE TRADE"
        else "GEST BUY REFUZAT DE ANDROID • FĂRĂ REPETARE"
      } catch (error: Exception) {
        android.util.Log.e("ScalpAtlasDemo392", "One-shot DEMO gesture rejected", error)
        "GEST BUY BLOCAT: " + error.javaClass.simpleName.take(22)
      }
    }

    /** 397: one physical SELL gesture, with the same strict DEMO checks as BUY. */
    @Synchronized
    fun pressAnyPairDemoSellOnce(onResult: (String) -> Unit): String {
      val svc = connected ?: return "BLOCAT: ACCESIBILITATE NECONECTATĂ"
      val now = android.os.SystemClock.elapsedRealtime()
      val store = svc.getSharedPreferences("scalp_demo_order_safety", Context.MODE_PRIVATE)
      val last = store.getLong("lastAcceptedAt", 0L)
      if (last > 0L && now - last in 0 until DEMO_TEST_LOCK_MS)
        return "BLOCAT: LIMITĂ 5 MINUTE • FĂRĂ GEST"
      // Freshly verify exact broker package, QT Demo and absence of QT Real,
      // readable 1 USD, sufficient Demo balance, payout >=92% and unique SELL.
      val check = checkOneDollarDemoTarget("SELL", true)
      val target = check.target ?: return check.reason
      // Also require a separately identifiable SELL button before a live tap.
      val buy = checkOneDollarDemoTarget("BUY", true)
      if (buy.target == null) return buy.reason
      if (svc.rootInActiveWindow?.packageName?.toString() != target.activePackage)
        return "BLOCAT: BROKERUL NU MAI ESTE ACTIV"
      val bounds = Rect()
      target.node.getBoundsInScreen(bounds)
      val metrics = android.util.DisplayMetrics()
      try {
        val manager = svc.getSystemService(Context.WINDOW_SERVICE)
          as android.view.WindowManager
        @Suppress("DEPRECATION")
        manager.defaultDisplay.getRealMetrics(metrics)
      } catch (error: Exception) {
        return "BLOCAT: ECRAN ANDROID NECONFIRMAT"
      }
      val x = bounds.exactCenterX()
      val y = bounds.exactCenterY()
      if (bounds.width() < 65 || bounds.height() < 35 ||
          bounds.left < 0 || bounds.top < (metrics.heightPixels * 0.76f).toInt() ||
          bounds.bottom > (metrics.heightPixels * 0.96f).toInt() ||
          bounds.right > metrics.widthPixels ||
          x <= metrics.widthPixels * 0.50f ||
          y <= 0f || y >= metrics.heightPixels.toFloat())
        return "BLOCAT: CENTRUL SELL NU ESTE CONFIRMAT"
      // Persist the allowance even when Android rejects a gesture, because
      // a double tap could result in two broker orders.
      if (!store.edit().putLong("lastAcceptedAt", now).commit())
        return "BLOCAT: NU POT SALVA LIMITA GESTULUI"
      if (svc.rootInActiveWindow?.packageName?.toString() != target.activePackage)
        return "BLOCAT: BROKERUL S-A SCHIMBAT • FĂRĂ GEST"
      val path = Path().apply { moveTo(x, y) }
      val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 85L))
        .build()
      return try {
        val submitted = svc.dispatchGesture(gesture, object : GestureResultCallback() {
          override fun onCompleted(gestureDescription: GestureDescription?) {
            onResult("GEST SELL TRIMIS • VERIFICĂ TRANZACȚII > DESCHIS")
          }
          override fun onCancelled(gestureDescription: GestureDescription?) {
            onResult("GEST SELL ANULAT DE ANDROID • FĂRĂ REPETARE")
          }
        }, Handler(Looper.getMainLooper()))
        if (submitted) "GEST SELL ACCEPTAT DE ANDROID • FĂRĂ CONFIRMARE TRADE"
        else "GEST SELL REFUZAT DE ANDROID • FĂRĂ REPETARE"
      } catch (error: Exception) {
        android.util.Log.e("ScalpAtlasDemo392", "One-shot DEMO gesture rejected", error)
        "GEST SELL BLOCAT: " + error.javaClass.simpleName.take(22)
      }
    }

    /**
     * READ ONLY: verify exactly one USD balance in the header of the active
     * official QT Demo app. This is an observation, not an order receipt.
     * Never accept QT Real, an unknown app, or multiple balance candidates.
     */
    fun readVerifiedDemoBalance(): Double? {
      val svc = connected ?: return null
      val root = svc.rootInActiveWindow ?: return null
      val pkg = root.packageName?.toString().orEmpty()
      if (pkg != "com.pocketoption.broker" && pkg != "com.potradeweb") return null
      val metrics = android.util.DisplayMetrics()
      try {
        val manager = svc.getSystemService(Context.WINDOW_SERVICE)
          as android.view.WindowManager
        @Suppress("DEPRECATION")
        manager.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Exception) {
        return null
      }
      val labels = ArrayList<Pair<String, Rect>>()
      val queue = ArrayDeque<AccessibilityNodeInfo>()
      queue.add(root)
      var visited = 0
      while (queue.isNotEmpty() && visited < 350) {
        val node = queue.removeFirst()
        visited++
        if (node.packageName?.toString() == pkg && node.isVisibleToUser) {
          val rect = Rect()
          node.getBoundsInScreen(rect)
          if (!rect.isEmpty && rect.left >= 0 &&
              rect.right <= metrics.widthPixels &&
              rect.top >= 0 && rect.bottom <= metrics.heightPixels) {
            val value = node.text?.toString()?.trim().orEmpty()
            val description = node.contentDescription?.toString()?.trim().orEmpty()
            if (value.isNotEmpty()) labels.add(value.take(110) to Rect(rect))
            if (description.isNotEmpty() && value != description)
              labels.add(description.take(110) to Rect(rect))
          }
        }
        for (i in 0 until node.childCount.coerceAtMost(35)) {
          node.getChild(i)?.let { queue.addLast(it) }
        }
      }
      if (labels.any {
          Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(it.first)
        }) return null
      if (!labels.any {
          it.second.centerY() < metrics.heightPixels * 0.28f &&
            Regex("""(?i)\bQT\s*Demo\b""").containsMatchIn(it.first)
        }) return null
      val values = labels.filter {
        it.second.centerX() in
          (metrics.widthPixels * 0.48f).toInt()..(metrics.widthPixels * 0.86f).toInt() &&
        it.second.centerY() < metrics.heightPixels * 0.17f
      }.mapNotNull {
        Regex("""(?<!\d)(\d{1,5}[.,]\d{2})(?!\d)""").find(it.first)
          ?.groupValues?.getOrNull(1)?.replace(',', '.')?.toDoubleOrNull()
      }.distinct()
      return values.singleOrNull()
    }

    /**
     * A SECOND one-shot QT Demo SELL only after the configured 5-minute BUY
     * has had at least 35 additional seconds to expire. The starting balance
     * and a distinct immediate 1 USD debit must be captured after BUY.
     * This is balance evidence, not a broker trade receipt. Re-check live
     * QT Demo, same pair, at least 1 USD available and payout >=92%.
     * No followup before 5m30s or after 7m30s; no retries or QT Real.
     */
    @Synchronized
    fun pressVerifiedFollowupDemoSell(
      firstBalance: Double,
      balanceAfterBuy: Double,
      expectedPair: String,
      onResult: (String) -> Unit
    ): String {
      val svc = connected ?: return "SELL BLOCAT: ACCESIBILITATE NECONECTATĂ"
      if (expectedPair.isBlank() || readVisibleDemoPair() != expectedPair)
        return "SELL BLOCAT: PERECHE QT DEMO NECONFIRMATĂ"
      if (kotlin.math.abs((firstBalance - balanceAfterBuy) - 1.0) > 0.03)
        return "SELL BLOCAT: BUY NU A DEBITAT 1 USD DUPĂ ATINGERE"
      val balanceNow = readVerifiedDemoBalance()
        ?: return "SELL BLOCAT: SOLD QT DEMO NECITIT"
      if (balanceNow < 1.0)
        return "SELL BLOCAT: SOLD DEMO SUB 1 USD"
      // Additional debit during the wait suggests another position or a
      // changed account. Do not create overlapping positions automatically.
      if (balanceNow < balanceAfterBuy - 0.03)
        return "SELL BLOCAT: SOLDUL A SCĂZUT DIN NOU • POSIBIL TRADE ACTIV"
      val now = android.os.SystemClock.elapsedRealtime()
      val store = svc.getSharedPreferences("scalp_demo_order_safety", Context.MODE_PRIVATE)
      val prior = store.getLong("lastAcceptedAt", 0L)
      if (prior <= 0L || now - prior !in 330_000L..450_000L)
        return "SELL BLOCAT: 5 MINUTE + MARJĂ NU S-AU ÎNCHEIAT"
      val check = checkOneDollarDemoTarget("SELL", true)
      val target = check.target ?: return check.reason
      val buyAgain = checkOneDollarDemoTarget("BUY", true)
      if (buyAgain.target == null) return buyAgain.reason
      if (svc.rootInActiveWindow?.packageName?.toString() != target.activePackage ||
          readVisibleDemoPair() != expectedPair)
        return "SELL BLOCAT: ECRANUL BROKERULUI S-A SCHIMBAT"
      val metrics = android.util.DisplayMetrics()
      try {
        val manager = svc.getSystemService(Context.WINDOW_SERVICE)
          as android.view.WindowManager
        @Suppress("DEPRECATION")
        manager.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Exception) {
        return "SELL BLOCAT: DIMENSIUNI ECRAN NECONFIRMATE"
      }
      val rect = Rect()
      target.node.getBoundsInScreen(rect)
      val x = rect.exactCenterX()
      val y = rect.exactCenterY()
      if (rect.width() < 65 || rect.height() < 35 || rect.left < 0 ||
          rect.top < metrics.heightPixels * 0.76f ||
          rect.bottom > metrics.heightPixels * 0.96f ||
          rect.right > metrics.widthPixels ||
          x <= metrics.widthPixels * 0.50f ||
          y <= 0f || y >= metrics.heightPixels)
        return "SELL BLOCAT: ȚINTA NU ESTE VIZIBILĂ"
      // A second gesture may not be retried even if Android cancels it.
      if (!store.edit().putLong("lastAcceptedAt", now).commit())
        return "SELL BLOCAT: LIMITA ORDINULUI NU POATE FI SALVATĂ"
      if (svc.rootInActiveWindow?.packageName?.toString() != target.activePackage)
        return "SELL BLOCAT: BROKERUL NU MAI ESTE ACTIV"
      val path = Path().apply { moveTo(x, y) }
      val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 85L))
        .build()
      return try {
        val submitted = svc.dispatchGesture(gesture, object : GestureResultCallback() {
          override fun onCompleted(gestureDescription: GestureDescription?) {
            onResult("SELL TRIMIS • VERIFICĂ TRANZACȚII DEMO > DESCHIS")
          }
          override fun onCancelled(gestureDescription: GestureDescription?) {
            onResult("SELL ANULAT DE ANDROID • FĂRĂ REPETARE")
          }
        }, Handler(Looper.getMainLooper()))
        if (submitted) "SELL TRANSMIS CĂTRE ANDROID • VERIFICĂ ISTORICUL"
        else "SELL REFUZAT DE ANDROID • FĂRĂ REPETARE"
      } catch (error: Exception) {
        android.util.Log.e("ScalpAtlasDemo395", "Second verified gesture rejected", error)
        "SELL BLOCAT: " + error.javaClass.simpleName.take(22)
      }
    }

    /**
     * READ ONLY: checks current QT Demo pair, 1 USD, broker BUY/SELL controls,
     * balance, and >=92% payout. No ACTION_CLICK, orders, or AUTO SIM here.
     */
    /**
     * 465: read the visible QT DEMO expiry field without clicking it.
     * This only establishes what duration is currently configured; it
     * does NOT establish that a previous broker order closed successfully.
     * If the timer is obscured or the broker theme changed, do not rearm.
     */
    fun confirmedFiveMinuteDemoExpiry465(): Boolean {
      val svc = connected ?: return false
      val root = readOnlyBrokerRoot(svc) ?: return false
      val pkg = root.packageName?.toString().orEmpty()
      if (!BrokerAdapterRegistry.hasDemoExecutor(pkg)) return false
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE)
          as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return false }
      val w = metrics.widthPixels
      val h = metrics.heightPixels
      if (w < 300 || h < 650) return false
      data class Item(val value: String, val rect: Rect)
      val labels = ArrayList<Item>()
      val queue = ArrayDeque<AccessibilityNodeInfo>()
      queue.add(root)
      var scanned = 0
      while (queue.isNotEmpty() && scanned++ < 350) {
        val node = queue.removeFirst()
        if (node.packageName?.toString() == pkg && node.isVisibleToUser) {
          val box = Rect()
          node.getBoundsInScreen(box)
          if (!box.isEmpty && box.left >= 0 && box.top >= 0 &&
              box.right <= w && box.bottom <= h) {
            val text = node.text?.toString()?.trim().orEmpty()
            val desc = node.contentDescription?.toString()?.trim().orEmpty()
            if (text.isNotBlank()) labels.add(Item(text.take(90), Rect(box)))
            if (desc.isNotBlank() && desc != text)
              labels.add(Item(desc.take(90), Rect(box)))
          }
        }
        for (index in 0 until node.childCount.coerceAtMost(35))
          node.getChild(index)?.let(queue::addLast)
      }
      if (labels.any { it.rect.centerY() < h * .30f &&
          Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(it.value) })
        return false
      if (labels.none { it.rect.centerY() < h * .28f &&
          Regex("""(?i)\bQT\s*Demo\b""").containsMatchIn(it.value) })
        return false
      val captions = labels.filter {
        it.rect.centerX() < w * .49f &&
        it.rect.centerY() in (h * .63f).toInt()..(h * .83f).toInt() &&
        Regex("""(?i)^(?:Timp|Time)\s*:?$""").matches(it.value)
      }.distinctBy { it.rect.centerX() / 12 to it.rect.centerY() / 12 }
      if (captions.isEmpty()) return false
      val values = labels.filter { label ->
        label.rect.centerX() < w * .50f &&
        label.rect.centerY() in (h * .65f).toInt()..(h * .85f).toInt() &&
        Regex("""^\s*\d{2}:\d{2}:\d{2}\s*$""").matches(label.value) &&
        captions.any { caption ->
          label.rect.centerY() >= caption.rect.centerY() &&
          label.rect.centerY() <= caption.rect.centerY() + h * .085f &&
          kotlin.math.abs(label.rect.centerX() - caption.rect.centerX()) < w * .30f
        }
      }.map { it.value.trim() }.distinct()
      return values.size == 1 && values.single() == "00:05:00"
    }

    fun readBrokerDemoOrder476(expectedPair: String): Pair<Long, Int>? {
      if (!priorDemoGestureCooldownComplete() ||
          !confirmedFiveMinuteDemoExpiry465() ||
          readVisibleDemoPair() != expectedPair) return null
      val buy = checkOneDollarDemoTarget("BUY", true, null)
      val sell = checkOneDollarDemoTarget("SELL", true, null)
      val stake = buy.stakeCents ?: return null
      val payout = buy.payoutPercent ?: return null
      if (buy.target == null || sell.target == null ||
          sell.stakeCents != stake || sell.payoutPercent != payout ||
          buy.target.activePackage != sell.target.activePackage ||
          readVisibleDemoPair() != expectedPair) return null
      return stake to payout
    }

    fun preflightOneDollarDemoOrder(expectedPair: String): String {
      // 465: the previous broker attempt can remain open if the user
      // switches the expiry. Only the explicitly displayed 5-minute
      // QT DEMO field may authorize the continuous $1 pilot.
      if (!confirmedFiveMinuteDemoExpiry465())
        return "BLOCAT: TIMP QT DEMO 00:05:00 NECONFIRMAT"
      // The readiness button MUST use the exact same Qt Demo / 1 USD /
      // payout >= 92% validators as the automatic one-shot click.
      // An optimistic preview must never claim that AUTO DEMO is ready
      // while the broker button would reject the same amount or payout.
      val buy = previewAutoOneDollarDemoOrder("BUY", expectedPair)
      if (!buy.startsWith("GATA AUTO DEMO BUY")) return buy
      val sell = previewAutoOneDollarDemoOrder("SELL", expectedPair)
      if (!sell.startsWith("GATA AUTO DEMO SELL")) return sell
      return "PREGĂTIT AUTO DEMO • QT DEMO • " + expectedPair +
        " • 1 USD • BUY/SELL PAYOUT ≥92% • FĂRĂ ORDIN"
    }

    fun previewAutoOneDollarDemoOrder(side: String, expectedPair: String): String {
      // Android may invalidate a live Accessibility/WebView node mid-scan.
      // Fail closed and show the failing stage; never bypass a missing tree.
      val observedPair = try {
        readVisibleDemoPair()
      } catch (error: Exception) {
        android.util.Log.e("ScalpAtlasRobot", "read-only pair lookup failed", error)
        return "BLOCAT: CITIRE PERECHE ANDROID (" +
          error.javaClass.simpleName.take(24) + ") • FĂRĂ ORDIN"
      }
      if (expectedPair.isBlank() || expectedPair == "NEIDENTIFICAT" ||
          observedPair != expectedPair)
        return "BLOCAT: PERECHEA QT DEMO NU ESTE CONFIRMATĂ"
      val svc = connected ?: return "ROBOT NECONECTAT"
      val now = android.os.SystemClock.elapsedRealtime()
      val last = svc.getSharedPreferences("scalp_demo_order_safety", Context.MODE_PRIVATE)
        .getLong("lastAcceptedAt", 0L)
      if (last > 0L && now - last in 0 until DEMO_TEST_LOCK_MS)
        return "BLOCAT: TRADE DEMO RECENT • AȘTEAPTĂ 5 MINUTE"
      val check = try {
        checkOneDollarDemoTarget(side, true)
      } catch (error: Exception) {
        android.util.Log.e("ScalpAtlasRobot", "read-only " + side + " validation failed", error)
        return "BLOCAT: VERIFICARE " + side + " ANDROID (" +
          error.javaClass.simpleName.take(24) + ") • FĂRĂ ORDIN"
      }
      return if (check.target == null) check.reason
        else "GATA AUTO DEMO " + side + " • 1 USD • PAYOUT ≥92%"
    }

    /**
     * The PRECHECK_NO_GESTURE prefix is emitted ONLY before entering the
     * physical Android gesture helper. These are provably read-only rejects
     * and may safely release ScalpOverlayService's attempt guard. Any return
     * from pressAnyPairDemo* is uncertain because its guard may have already
     * persisted an Android gesture token: never automatically retry those.
     */
    @Synchronized
    fun pressAutoOneDollarDemoOrderOnce(side: String, expectedPair: String): String {
      // 400: physical gesture follows the verified Qt Demo broker controls.
      // A WebView ACTION_CLICK may be accepted without placing a trade.
      // No gesture is ever permitted on QT Real or unknown broker packages.
      if (side != "BUY" && side != "SELL")
        return "PRECHECK_NO_GESTURE: DIRECȚIE INVALIDĂ"
      if (expectedPair.isBlank() || expectedPair == "NEIDENTIFICAT" ||
          readVisibleDemoPair() != expectedPair)
        return "PRECHECK_NO_GESTURE: PERECHEA QT DEMO S-A SCHIMBAT"
      // Both buttons, exact 1 USD and payout >=92% must pass again.
      val preview = preflightOneDollarDemoOrder(expectedPair)
      if (!preview.startsWith("PREGĂTIT AUTO DEMO"))
        return "PRECHECK_NO_GESTURE: " + preview
      if (readVisibleDemoPair() != expectedPair)
        return "PRECHECK_NO_GESTURE: PERECHEA S-A SCHIMBAT ÎNAINTE DE GEST"
      // The existing functions perform another complete preflight, persist
      // a 5-minute broker gesture lock, and dispatch a single physical tap.
      // This is not proof of broker acceptance; closure must be validated
      // from a separate broker order receipt before any further attempt.
      return if (side == "BUY") {
        pressAnyPairDemoBuyOnce { callback ->
          android.util.Log.i("ScalpAtlas400", callback)
        }
      } else {
        pressAnyPairDemoSellOnce { callback ->
          android.util.Log.i("ScalpAtlas400", callback)
        }
      }
    }


    /**
     * 429: Dynamic DEMO order preflight. Only the ledger's exact quoted amount
     * is eligible; the caller must prove the matching OPEN/CLOSED receipts.
     * No assumption about WIN/LOSS or trade acceptance is made here.
     */
    fun preflightVerifiedDemoStake429(
      expectedPair: String,
      stakeCents: Long
    ): String {
      if (stakeCents !in 100L..DemoRecoveryLedger.MAX_SINGLE_STAKE_CENTS)
        return "BLOCAT: MIZĂ ÎN AFARA LIMITELOR"
      if (readVisibleDemoPair() != expectedPair)
        return "BLOCAT: PERECHE DEMO DIFERITĂ"
      val svc = connected ?: return "BLOCAT: ACCESIBILITATE"
      val at = android.os.SystemClock.elapsedRealtime()
      val last = svc.getSharedPreferences("scalp_demo_order_safety", Context.MODE_PRIVATE)
        .getLong("lastAcceptedAt", 0L)
      if (last > 0L && at - last in 0 until DEMO_TEST_LOCK_MS)
        return "BLOCAT: COOLDOWN 5 MIN"
      val buy = checkOneDollarDemoTarget("BUY", true, stakeCents)
      if (buy.target == null) return buy.reason
      val sell = checkOneDollarDemoTarget("SELL", true, stakeCents)
      if (sell.target == null) return sell.reason
      if (stakeCents > 100L && !DemoStakeEditor.verifiedExactDemoStakeReadOnly(svc, stakeCents))
        return "BLOCAT: SUMĂ DINAMICĂ NECONFIRMATĂ"
      return "PREGĂTIT AUTO DEMO • MIZĂ VERIFICATĂ " + stakeCents + " CENȚI"
    }

    /**
     * Exactly one physical QT DEMO BUY/SELL tap. The caller must first persist
     * the attempted order + expected amount + payout; a crash cannot repeat
     * this order. A gesture response is NOT an OPEN receipt.
     */
    @Synchronized
    fun pressVerifiedDemoStakeOnce429(
      side: String,
      expectedPair: String,
      stakeCents: Long,
      brokerPayout: Int? = null
    ): String {
      if (side != "BUY" && side != "SELL")
        return "PRECHECK_NO_GESTURE: DIRECȚIE INVALIDĂ"
      val preflight = if (brokerPayout == null)
        preflightVerifiedDemoStake429(expectedPair, stakeCents)
      else if (readBrokerDemoOrder476(expectedPair) == (stakeCents to brokerPayout))
        "PREGĂTIT AUTO DEMO"
      else "BLOCAT: SUMĂ / PAYOUT / TIMP DEMO SCHIMBATE"
      if (!preflight.startsWith("PREGĂTIT AUTO DEMO"))
        return "PRECHECK_NO_GESTURE: " + preflight
      val svc = connected ?: return "PRECHECK_NO_GESTURE: ACCESIBILITATE"
      val check = checkOneDollarDemoTarget(side, true, stakeCents.takeIf { brokerPayout == null })
      val target = check.target
        ?: return "PRECHECK_NO_GESTURE: " + check.reason
      val other = checkOneDollarDemoTarget(
        if (side == "BUY") "SELL" else "BUY", true, stakeCents.takeIf { brokerPayout == null })
      if (other.target == null)
        return "PRECHECK_NO_GESTURE: " + other.reason
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return "PRECHECK_NO_GESTURE: ECRAN NECONFIRMAT" }
      val rect = Rect()
      target.node.getBoundsInScreen(rect)
      val x = rect.exactCenterX()
      val y = rect.exactCenterY()
      if (rect.width() < 65 || rect.height() < 35 || rect.left < 0 ||
          rect.top < (metrics.heightPixels * .76f).toInt() ||
          rect.bottom > (metrics.heightPixels * .96f).toInt() ||
          rect.right > metrics.widthPixels ||
          (if (side == "BUY") x >= metrics.widthPixels * .50f
            else x <= metrics.widthPixels * .50f))
        return "PRECHECK_NO_GESTURE: ȚINTĂ NECONFIRMATĂ"
      if (svc.rootInActiveWindow?.packageName?.toString() != target.activePackage ||
          readVisibleDemoPair() != expectedPair ||
          (brokerPayout != null && (check.stakeCents != stakeCents ||
            other.stakeCents != stakeCents || check.payoutPercent != brokerPayout ||
            other.payoutPercent != brokerPayout || !confirmedFiveMinuteDemoExpiry465())) ||
          (brokerPayout == null && stakeCents > 100L &&
            !DemoStakeEditor.verifiedExactDemoStakeReadOnly(svc, stakeCents)))
        return "PRECHECK_NO_GESTURE: BROKER / SUMĂ SCHIMBATĂ"
      val store = svc.getSharedPreferences("scalp_demo_order_safety", Context.MODE_PRIVATE)
      val tick = android.os.SystemClock.elapsedRealtime()
      val last = store.getLong("lastAcceptedAt", 0L)
      if (last > 0L && tick - last in 0 until DEMO_TEST_LOCK_MS)
        return "PRECHECK_NO_GESTURE: COOLDOWN 5 MIN"
      if (!store.edit().putLong("lastAcceptedAt", tick).commit())
        return "PRECHECK_NO_GESTURE: BLOCARE NESALVATĂ"
      // The attempt is consumed even when Android rejects the gesture.
      if (svc.rootInActiveWindow?.packageName?.toString() != target.activePackage)
        return "GEST NECONFIRMAT • BROKER SCHIMBAT • FĂRĂ REPETARE"
      val path = Path().apply { moveTo(x, y) }
      val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 85L)).build()
      return try {
        val submitted = svc.dispatchGesture(gesture, null, Handler(Looper.getMainLooper()))
        if (submitted) "GEST QT DEMO " + side + " TRANSMIS • AȘTEPT ID OPEN"
        else "GEST ANDROID RESPINS • REZULTAT NECONFIRMAT"
      } catch (_: Throwable) {
        "GEST ANDROID NECONFIRMAT • FĂRĂ REPETARE"
      }
    }

    fun previewOneDollarDemoOrder(side: String): String {
      val svc = connected ?: return "ROBOT NECONECTAT"
      val at = android.os.SystemClock.elapsedRealtime()
      val last = svc.getSharedPreferences("scalp_demo_order_safety", Context.MODE_PRIVATE)
        .getLong("lastAcceptedAt", 0L)
      if (last > 0L && at - last in 0 until DEMO_TEST_LOCK_MS)
        return "BLOCAT: O SINGURĂ PROBĂ LA 5 MINUTE"
      return checkOneDollarDemoTarget(side).reason
    }

    @Synchronized
    fun pressOneDollarDemoOrderOnce(side: String): String {
      val svc = connected ?: return "ROBOT NECONECTAT"
      val at = android.os.SystemClock.elapsedRealtime()
      val store = svc.getSharedPreferences("scalp_demo_order_safety", Context.MODE_PRIVATE)
      val last = store.getLong("lastAcceptedAt", 0L)
      if (last > 0L && at - last in 0 until DEMO_TEST_LOCK_MS)
        return "BLOCAT: EXISTĂ O PROBĂ ÎN ULTIMELE 5 MINUTE"
      val check = checkOneDollarDemoTarget(side)
      val target = check.target ?: return check.reason
      // Set the lock BEFORE sending a potentially irreversible screen click.
      if (!store.edit().putLong("lastAcceptedAt", at).commit())
        return "BLOCAT: NU POT SALVA BLOCAREA COMENZII"
      if (svc.rootInActiveWindow?.packageName?.toString() != target.activePackage)
        return "BLOCAT: BROKERUL NU MAI ESTE ACTIV"
      val accepted = target.node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
      return if (accepted)
        "DEMO " + side + ": CLIC ACCEPTAT • VERIFICĂ TRANZACȚIA"
      else "DEMO " + side + ": ANDROID A REFUZAT CLICUL"
    }

    @Volatile private var lastCalculatorTestAt = 0L

    /**
     * Cross-app capability proof with one harmless key only: digit 1 in the
     * Google/AOSP Calculator. Never targets broker apps, screen coordinates
     * or financial actions. A user must explicitly press the TEST CALC button.
     *
     * ACTION_CLICK is not a physical screen gesture and its boolean result
     * is NOT proof that the Calculator display changed. Verify visually.
     */
    fun clickCalculatorDigitOne(): String {
      val svc = connected ?: return "CALC: ACCESIBILITATE NECONECTATĂ"
      val now = android.os.SystemClock.elapsedRealtime()
      if (now - lastCalculatorTestAt < 3000L)
        return "CALC: O SINGURĂ PROBĂ LA 3 SECUNDE"
      val root = svc.rootInActiveWindow ?: return "CALC: FEREASTRĂ ACTIVĂ INDISPONIBILĂ"
      val activePackage = root.packageName?.toString() ?: ""
      val allowed = activePackage == "com.google.android.calculator" ||
        activePackage == "com.android.calculator2"
      if (!allowed) return "CALC: DESCHIDE CALCULATOR, NU BROKERUL"
      val matches = root.findAccessibilityNodeInfosByText("1")
        .filter { node ->
          node.packageName?.toString() == activePackage &&
            (node.text?.toString()?.trim() == "1" ||
              node.contentDescription?.toString()?.trim() == "1") &&
            node.isClickable && node.isEnabled && node.isVisibleToUser
        }
      // An ambiguous UI must never result in a random click.
      if (matches.size != 1) return "CALC: CIFRA 1 NU ESTE IDENTIFICATĂ UNIC"
      val button = matches[0]
      val bounds = Rect()
      button.getBoundsInScreen(bounds)
      if (bounds.width() < 15 || bounds.height() < 15 ||
          bounds.left < 0 || bounds.top < 0 ||
          bounds.right > svc.resources.displayMetrics.widthPixels ||
          bounds.bottom > svc.resources.displayMetrics.heightPixels)
        return "CALC: BUTONUL 1 NU ESTE VIZIBIL COMPLET"
      // Double-check the foreground package immediately before the click.
      if (svc.rootInActiveWindow?.packageName?.toString() != activePackage)
        return "CALC: APLICAȚIA ACTIVĂ S-A SCHIMBAT"
      lastCalculatorTestAt = now
      val accepted = button.performAction(AccessibilityNodeInfo.ACTION_CLICK)
      return if (accepted)
        "CALC: COMANDĂ 1 ACCEPTATĂ • VERIFICĂ AFIȘAJUL"
        else "CALC: ANDROID A REFUZAT CLICK 1"
    }
    /**
     * Dispatch a demonstration gesture ONLY into a visible target that belongs
     * to Scalp Atlas's floating window. No arbitrary screen coordinates accepted.
     * The calling Service passes its own overlay root and target View.
     */
    data class OverlayTargetCheck(
      val reason: String,
      val x: Float = 0f,
      val y: Float = 0f
    ) {
      val ready: Boolean get() = reason == "PREGĂTIT"
    }

    /**
     * Fail-closed diagnostics for an OWN-APP test target only. Do not pass
     * broker coordinates, a generic package name, or another app's views.
     */
    fun checkOverlayTarget(overlay: View, target: View): OverlayTargetCheck {
      val svc = connected ?: return OverlayTargetCheck("ACCESIBILITATE NECONECTATĂ")
      if (!overlay.isAttachedToWindow || !overlay.isShown)
        return OverlayTargetCheck("FEREASTRA NU ESTE VIZIBILĂ")
      if (!target.isAttachedToWindow || !target.isShown || !target.isClickable)
        return OverlayTargetCheck("ZONA DE TEST NU ESTE ACTIVĂ")
      if (overlay.windowToken == null || overlay.windowToken != target.windowToken ||
          overlay.context.packageName != svc.packageName ||
          target.context.packageName != svc.packageName)
        return OverlayTargetCheck("ȚINTA NU APARȚINE SUPRAPUNERII")

      // getGlobalVisibleRect is already in global coordinates on some
      // Android versions. Adding getLocationOnScreen again doubles offsets.
      // Use one coordinate space exclusively: absolute screen pixels.
      val rootScreen = IntArray(2)
      val targetScreen = IntArray(2)
      overlay.getLocationOnScreen(rootScreen)
      target.getLocationOnScreen(targetScreen)
      val rootBounds = Rect(
        rootScreen[0], rootScreen[1],
        rootScreen[0] + overlay.width, rootScreen[1] + overlay.height
      )
      val targetBounds = Rect(
        targetScreen[0], targetScreen[1],
        targetScreen[0] + target.width, targetScreen[1] + target.height
      )
      if (rootBounds.isEmpty || targetBounds.isEmpty)
        return OverlayTargetCheck("FEREASTRA DE TEST NU ARE DIMENSIUNI")
      if (targetBounds.width() < 24 || targetBounds.height() < 20 ||
          !rootBounds.contains(targetBounds))
        return OverlayTargetCheck("ZONA DE TEST ESTE PARTIAL ASCUNSA")

      val x = targetBounds.exactCenterX()
      val y = targetBounds.exactCenterY()
      val width = svc.resources.displayMetrics.widthPixels
      val height = svc.resources.displayMetrics.heightPixels
      if (x < 0f || y < 0f || x >= width || y >= height)
        return OverlayTargetCheck("ZONA DE TEST ESTE IN AFARA ECRANULUI")

      // Limit Android gesture tests to the upper, chart-only area.
      // Never allow the gesture near the underlying trade buttons.
      val safeChartBottom = (height * 0.73f).toInt()
      if (targetBounds.bottom >= safeChartBottom)
        return OverlayTargetCheck("ZONĂ PREA JOS • MUTĂ SUPRAPUNEREA SUS")
      if (!overlay.getGlobalVisibleRect(Rect()) ||
          !target.getGlobalVisibleRect(Rect()))
        return OverlayTargetCheck("ZONA ESTE ASCUNSĂ")

      return OverlayTargetCheck("PREGĂTIT", x, y)
    }

    /** Gesture goes only to the verified OWN overlay test target. */
    fun tapVisibleOwnOverlayTarget(
      overlay: View,
      target: View,
      callback: (Boolean) -> Unit
    ): Boolean {
      val svc = connected ?: return false
      val check = checkOverlayTarget(overlay, target)
      if (!check.ready) return false
      val path = Path().apply { moveTo(check.x, check.y) }
      val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 85L))
        .build()
      return svc.dispatchGesture(gesture, object: GestureResultCallback() {
        override fun onCompleted(gestureDescription: GestureDescription?) {
          callback(true)
        }
        override fun onCancelled(gestureDescription: GestureDescription?) {
          callback(false)
        }
      }, Handler(Looper.getMainLooper()))
    }

    fun tryTestTap(x: Float, y: Float, callback: (Boolean) -> Unit): Boolean {
      val svc = connected ?: return false
      val active = svc.rootInActiveWindow?.packageName?.toString()
      if (active != svc.packageName || x < 0f || y < 0f) return false
      val path = Path().apply { moveTo(x, y) }
      val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 80L))
        .build()
      return svc.dispatchGesture(gesture, object: GestureResultCallback() {
        override fun onCompleted(gestureDescription: GestureDescription?) {
          callback(true)
        }
        override fun onCancelled(gestureDescription: GestureDescription?) {
          callback(false)
        }
      }, Handler(Looper.getMainLooper()))
    }
  }
  override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
  override fun onInterrupt() {}
  override fun onServiceConnected() {
    super.onServiceConnected()
    connected = this
  }
  override fun onUnbind(intent: android.content.Intent?): Boolean {
    if (connected === this) connected = null
    return super.onUnbind(intent)
  }
  override fun onDestroy() {
    if (connected === this) connected = null
    super.onDestroy()
  }
}
