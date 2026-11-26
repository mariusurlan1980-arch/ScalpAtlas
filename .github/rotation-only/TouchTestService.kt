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
      if (ready()) return "ACCESIBILITATE CONECTATĂ"
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
    fun readVisibleDemoPair(): String? = readVisibleFxPair(false)

    fun readVisibleFxPair(realAccount: Boolean): String? {
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
      if (if (realAccount) !real || demo else !demo || real) return null
      val pattern = Regex("""(?i)(?<![A-Z])([A-Z]{3})\s*/\s*([A-Z]{3})\b(?:\s*\(?\s*(OTC)\s*\)?)?""")
      // 548 G24: Some broker WebViews expose "EUR/RUB" and "OTC" as
      // separate accessibility labels on the SAME instrument button.
      // Join an explicit adjacent OTC token only in the upper-left selector;
      // never infer OTC from a chart candle or transactions history.
      val otcOnly548 = Regex("""(?i)^\s*\(?\s*O\s*T\s*C\s*\)?\s*$""")
      val otcTokens548 = labels.filter { (text, r) ->
        otcOnly548.matches(text) &&
          r.centerY() in (metrics.heightPixels * .105f).toInt()..
            (metrics.heightPixels * .33f).toInt() &&
          r.centerX() < metrics.widthPixels * .70f
      }.map { it.second }
      val instruments = labels.mapNotNull { (value, bounds) ->
        if (bounds.centerY() !in
          (metrics.heightPixels * 0.105f).toInt()..(metrics.heightPixels * 0.33f).toInt() ||
          bounds.centerX() > metrics.widthPixels * 0.70f ||
          value.length > 46) return@mapNotNull null
        val match = pattern.find(value) ?: return@mapNotNull null
        val adjacentOtc548 = otcTokens548.any { token ->
          kotlin.math.abs(token.centerY() - bounds.centerY()) <=
            maxOf(bounds.height(), token.height(), (metrics.heightPixels * .024f).toInt()) &&
            token.left >= bounds.left - (metrics.widthPixels * .015f).toInt() &&
            token.left <= bounds.right + (metrics.widthPixels * .075f).toInt()
        }
        val suffix = if (match.groupValues[3].isNotBlank() || adjacentOtc548)
          " OTC" else ""
        match.groupValues[1].uppercase() + "/" + match.groupValues[2].uppercase() + suffix
      }.distinct()
      // 551: The same broker header may expose parent/child labels as
      // "EUR/RUB" and "EUR/RUB OTC". Honor an explicitly visible OTC
      // suffix only when EVERY other label shares exactly that base pair.
      // No pair, mismatching pairs, or absent QT Demo proof still block orders.
      val soleOtc551 = instruments.filter { it.endsWith(" OTC") }.singleOrNull()
      return when {
        instruments.size == 1 -> instruments.single()
        soleOtc551 != null &&
          instruments.all { it == soleOtc551 || it == soleOtc551.removeSuffix(" OTC") } ->
            soleOtc551
        else -> null
      }
    }

    private fun activeRotationNodes(
      cachedDemoVerifiedOnChart: Boolean, realAccount: Boolean = false,
      foregroundOnly: Boolean = false
    ): Triple<TouchTestService, AccessibilityNodeInfo, List<Pair<AccessibilityNodeInfo, Rect>>>? {
      val svc = connected ?: return null
      // 443: Collect READ-ONLY broker labels from the same visible,
      // allowlisted application window even if Android focuses SystemUI.
      // Every navigation/gesture helper independently requires the active
      // foreground broker root before any ACTION_CLICK/dispatchGesture.
      // Never treat this fallback as authorization for BUY/SELL.
      val root = (if (foregroundOnly) svc.rootInActiveWindow else readOnlyBrokerRoot(svc))
        ?: return null
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
            val inAccountTile = rect.centerX() >= display.widthPixels * .42f &&
              rect.centerX() <= display.widthPixels * .90f &&
              rect.centerY() < display.heightPixels * .19f &&
              rect.width() <= display.widthPixels * .62f &&
              rect.height() <= display.heightPixels * .15f
            val accountHeader = if (foregroundOnly) inAccountTile
              else rect.centerY() < display.heightPixels * .29f
            if (accountHeader) {
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
      if (realAccount) {
        // A visible Real label is enough to STOP, including mixed account menus.
        if (!seenReal) return null
      } else if (seenReal || (!seenDemo && !cachedDemoVerifiedOnChart)) return null
      return Triple(svc, root, result)
    }

    data class DemoFxQuote(val pair: String, val payout: Int)

    private data class DemoFxRow(val quote: DemoFxQuote, val node: AccessibilityNodeInfo, val bounds: Rect)
    data class DemoFxNavigation(val pair: String? = null, val scrolled: Boolean = false,
      val endOfList: Boolean = false, val rejectedPair: String? = null, val message: String)

    private val fxPairLabel = Regex("""(?i)\b([A-Z]{3})\s*/\s*([A-Z]{3})\b(?:\s*\(?\s*(OTC)\s*\)?)?""")
    private val fxPayoutLabel = Regex("""(?<![\d.,-])\+?\s*(\d{1,3})\s*%""")
    private val fiatCodes by lazy {
      java.util.Currency.getAvailableCurrencies().map { it.currencyCode }.toSet() -
        setOf("XAU", "XAG", "XPD", "XPT", "XTS", "XXX")
    }

    // Accept recognized fiat pairs. Verify availability and payout on each broker row.
    fun isPreferredFxPair517(pair: String): Boolean {
      val matched = fxPairLabel.matchEntire(pair.trim()) ?: return false
      val base = matched.groupValues[1].uppercase(java.util.Locale.ROOT)
      val quote = matched.groupValues[2].uppercase(java.util.Locale.ROOT)
      return base != quote && base in fiatCodes && quote in fiatCodes
    }

    fun realFxAccountVisible(): Boolean = activeRotationNodes(false, true) != null

    fun realFxAccountInForeground(): Boolean =
      activeRotationNodes(false, realAccount = true, foregroundOnly = true) != null

    fun demoFxAccountInForeground(): Boolean =
      activeRotationNodes(false, foregroundOnly = true) != null

    internal fun positiveOpenBadge637():Int? {
      val svc=connected ?: return null
      if(!demoFxAccountInForeground() || realFxAccountVisible() || fxListVisible(false))return null
      return RotationPayoutReader.positiveOpenBadge637(svc)
    }

    internal fun readLiveSnapshot637(): RotationPayoutReader.LiveSnapshot? {
      val svc=connected ?: return null
      if (!demoFxAccountInForeground() || realFxAccountVisible() || fxListVisible(false)) return null
      return RotationPayoutReader.readLiveSnapshot637(svc)
    }

    internal fun applyVerifiedMg637(pkg:String,pair:String,previous:Long,target:Long,balance:Long,visualClosureVerified:Boolean=false):String {
      val svc=connected ?: return "MG • ACCESIBILITATE INDISPONIBILĂ"
      val allowed={
        connected===svc && demoFxAccountInForeground() &&
          !realFxAccountInForeground() && !realFxAccountVisible() &&
          !fxListVisible(false) && readVisibleFxPair(false)==pair
      }
      if(!allowed())return "MG • QT DEMO NECONFIRMAT"
      return RotationPayoutReader.editVerifiedStake637(svc,pkg,previous,target,balance,visualClosureVerified,allowed)
    }

    fun readFxChartPayout(pair: String, realAccount: Boolean): Int? {
      val svc = connected ?: return null
      if (readVisibleFxPair(realAccount) != pair || fxListVisible(realAccount)) return null
      val payout = RotationPayoutReader.readRotationPayout(svc, realAccount) ?: return null
      return payout.takeIf { connected === svc && readVisibleFxPair(realAccount) == pair }
    }

    fun fxListVisible(realAccount: Boolean): Boolean {
      val (_, _, labels) = activeRotationNodes(false, realAccount) ?: return false
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
      }?.second
      // Some WebViews omit the accessible column title but expose the quotes.
      // Use the chart width only to locate the column, never to infer a payout.
      val screenWidth = connected?.resources?.displayMetrics?.widthPixels ?: return emptyList()
      val payoutColumnX = payoutHeader?.centerX() ?: (screenWidth * .68f).toInt()
      val payoutColumnLeft = payoutHeader?.let { it.left - it.width() / 2 }
        ?: payoutColumnX
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
        if (bounds.centerX() >= payoutColumnX) return@mapNotNull null
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
            rect.centerX() >= payoutColumnLeft
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
    fun reopenFxList(pair: String, overlayBounds: Rect, physicalOnly: Boolean, realAccount: Boolean,
      alternateClickable519: Boolean = false): Boolean {
      if (realAccount || realFxAccountVisible() ||
          readVisibleFxPair(realAccount) != pair) return false
      val (svc, root, labels) = activeRotationNodes(false, realAccount, foregroundOnly = true) ?: return false
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
            match != null &&
              // 515: QT WebView may prefix this SAME selector label
              // with flag emoji. Only a short non-alphanumeric prefix
              // is allowed; never consume a balance or account label.
              label.substring(0, match.range.first).let { prefix ->
                prefix.length <= 12 && prefix.none { it.isLetterOrDigit() }
              } &&
              selectorSuffix.matches(label.substring(match.range.last + 1)) && pair.equals(
              match.groupValues[1] + "/" + match.groupValues[2] +
                if (match.groupValues[3].isNotEmpty()) " OTC" else "", true
            )
          }
      }
      // 508 DEMO account safety: the previous fallback tapped raw screen
      // coordinates in the broker header. When the WebView changed layout,
      // that could hit the account chooser instead of the FX selector.
      // No physical header tap, no broad clickable ancestor, no QT Real.
      // 509: QT WebView can duplicate the SAME pair label across nodes, and
      // several nested ancestors may report ACTION_CLICK. These do NOT mean
      // several different currency selectors. De-duplicate matching bounds,
      // then prefer the smallest eligible clickable control on the pair path.
      // Never fall back to physical tapping in the broker account header.
      if (realAccount || physicalOnly || realFxAccountVisible()) return false
      val distinctBounds = matches.map { it.second }.distinct()
      // 510: Android WebView often exposes the SAME pair as nested text and
      // selector nodes with slightly different overlapping bounds. Reject
      // separate/nonoverlapping labels, but do not reject one verified control.
      val bounds = distinctBounds.minByOrNull {
        it.width().toLong() * it.height().toLong()
      } ?: return false
      if (distinctBounds.any { other ->
          !Rect.intersects(bounds, other) ||
            kotlin.math.abs(bounds.centerY() - other.centerY()) > height * .030f ||
            other.right > width * .53f
        }) return false
      val action = AccessibilityNodeInfo.ACTION_CLICK
      val candidates = matches.flatMap { (pairNode, _) ->
        generateSequence(pairNode) { it.parent }.take(6).toList()
      }.distinct().filter { candidate ->
          val rect = Rect()
          candidate.getBoundsInScreen(rect)
          val values = listOfNotNull(
            candidate.text?.toString(), candidate.contentDescription?.toString()
          )
          candidate.isVisibleToUser && candidate.isEnabled &&
            candidate.isClickable && candidate.packageName == root.packageName &&
            candidate.actionList.any { it.id == action } &&
            !rect.isEmpty && rect.contains(bounds.centerX(), bounds.centerY()) &&
            rect.centerX() in 1 until (width * .50f).toInt() &&
            rect.left >= width * .03f && rect.right <= width * .53f &&
            rect.centerY() in headerTop..headerBottom &&
            rect.width() <= width * .48f &&
            rect.height() <= height * .065f &&
            values.none { Regex("""(?i)\bQT\s*(?:Demo|Real)\b""").containsMatchIn(it) }
        }
      // 519: WebView may acknowledge ACTION_CLICK on the smallest text node
      // but never open Valute. Retry ONE other independently clickable
      // ancestor for the SAME verified FX label, not a physical screen tap.
      val ranked = candidates.sortedBy { candidate ->
        val rect = Rect()
        candidate.getBoundsInScreen(rect)
        rect.width().toLong() * rect.height().toLong()
      }
      if (overlayBounds.contains(bounds.centerX(), bounds.centerY()) ||
          svc.rootInActiveWindow != root) return false
      // Re-read visible account identity immediately before a broker click.
      val fresh = activeRotationNodes(false, foregroundOnly = true) ?: return false
      if (fresh.first !== svc || fresh.second != root ||
          fresh.third.any { (node, _) ->
            listOfNotNull(node.text, node.contentDescription).any {
              Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(it.toString())
            }
          }) return false
      // The pair selector can sit below the account label or to its left.
      // Keep a gap and reject any ancestor covering the account dropdown.
      val demoHeaders = fresh.third.filter { (node, rect) ->
        rect.centerX() >= width * .42f && rect.centerX() <= width * .90f &&
          rect.centerY() < height * .19f &&
          rect.width() <= width * .62f && rect.height() <= height * .15f &&
          listOfNotNull(node.text?.toString(), node.contentDescription?.toString()).any {
            Regex("""(?i)\bQT\s*Demo\b""").containsMatchIn(it)
          }
      }
      if (demoHeaders.isEmpty()) return false
      val accountGap = (height * .008f).toInt()
      val horizontalGap = (width * .025f).toInt()
      val safeTargets = ranked.filter { candidate ->
        val candidateBounds = Rect()
        candidate.getBoundsInScreen(candidateBounds)
        demoHeaders.all { (_, accountBounds) ->
            candidateBounds.top >= accountBounds.bottom + accountGap ||
              candidateBounds.right + horizontalGap <= accountBounds.left
          } &&
          candidateBounds.right <= width * .53f &&
          !Rect.intersects(candidateBounds, overlayBounds)
      }
      val target = safeTargets.getOrNull(if (alternateClickable519) 1 else 0)
        ?: return false
      return !realFxAccountVisible() && svc.rootInActiveWindow == root &&
        target.performAction(action)
    }

    /**
     * 506: If a two-way selector sweep still leaves known eligible rows
     * unvisited, use its verified SEARCH input instead of cycling forever.
     * This mutates ONLY the currency-list search text, not stake, expiration,
     * trading controls or chart. It is unavailable unless QT Demo/Real
     * identity, list header and ONE editable input are independently proven.
     */
    fun searchVisibleFxPair506(pair: String, realAccount: Boolean): Boolean {
      if (!isPreferredFxPair517(pair)) return false
      return setVisibleFxSearchText(
        pair.removeSuffix(" OTC").replace("/", "").lowercase(java.util.Locale.ROOT), realAccount)
    }

    fun clearVisibleFxSearch(realAccount: Boolean): Boolean =
      setVisibleFxSearchText("", realAccount)

    private fun setVisibleFxSearchText(text: String, realAccount: Boolean): Boolean {
      if (realAccount || realFxAccountVisible()) return false
      val (svc, root, labels) = activeRotationNodes(false, realAccount) ?: return false
      if (svc.rootInActiveWindow != root) return false
      val header = labels.firstOrNull { (node, _) -> hasFxCurrencyHeader(node) }
        ?.second ?: return false
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return false }
      val w = metrics.widthPixels
      val h = metrics.heightPixels
      // The selector screenshot has SEARCH above "Valute"; all order
      // controls and the amount editor are below the list. Require a
      // uniquely isolated editable input inside THIS verified search band.
      val bandTop = (h * .12f).toInt()
      val bandBottom = header.top
      if (bandBottom <= bandTop) return false
      val queue = ArrayDeque<AccessibilityNodeInfo>()
      val inputs = ArrayList<AccessibilityNodeInfo>()
      queue.add(root)
      var nodes = 0
      while (queue.isNotEmpty() && nodes++ < 350) {
        val node = queue.removeFirst()
        if (node.packageName == root.packageName &&
            node.isVisibleToUser && node.isEnabled && node.isEditable &&
            node.actionList.any { it.id == AccessibilityNodeInfo.ACTION_SET_TEXT }) {
          val rect = Rect()
          node.getBoundsInScreen(rect)
          if (!rect.isEmpty &&
              rect.centerY() in bandTop until bandBottom &&
              // 507: QT WebView often makes its SEARCH box span nearly
              // the full selector width. The OLD .68 right edge wrongly
              // rejected that uniquely editable field. Keep it ABOVE the
              // independently verified currency header, never near trades.
              rect.left >= (w * .03f).toInt() &&
              rect.right <= (w * .96f).toInt() &&
              rect.height() <= h * .085f) inputs.add(node)
        }
        for (i in 0 until node.childCount.coerceAtMost(35))
          node.getChild(i)?.let { queue.addLast(it) }
      }
      val input = inputs.distinct().singleOrNull() ?: return false
      if (svc.rootInActiveWindow != root) return false
      val args = android.os.Bundle().apply {
        putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
          text)
      }
      return input.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    /**
     * 515: One narrow fallback after an accessibility ACTION_CLICK on the
     * exact currency selector did NOT visibly open "Valute". Unlike the
     * removed 508 blind header tap, this uses the freshly located instrument
     * label, requires its non-overlapping QT Demo account header ABOVE it,
     * and rejects ambiguous bounds or QT Real. Visual navigation only.
     */
    fun tapVerifiedDemoFxSelector515(pair: String, overlayBounds: Rect): Boolean {
      if (pair.isBlank() || readVisibleFxPair(false) != pair ||
          realFxAccountVisible()) return false
      val (svc, root, labels) = activeRotationNodes(false, false) ?: return false
      if (svc.rootInActiveWindow != root ||
          labels.any { (node, _) -> hasFxCurrencyHeader(node) }) return false
      val metrics = android.util.DisplayMetrics()
      try {
        val wm = svc.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
      } catch (_: Throwable) { return false }
      val w = metrics.widthPixels
      val h = metrics.heightPixels
      if (w < 300 || h < 650) return false
      fun labelsFor(node: AccessibilityNodeInfo): List<String> =
        listOfNotNull(node.text?.toString(), node.contentDescription?.toString())
          .map { it.trim() }.distinct()
      val demoHeader = labels.filter { (node, bounds) ->
        bounds.centerY() < h * .16f &&
          labelsFor(node).any {
            Regex("""(?i)\bQT\s*Demo\b""").containsMatchIn(it)
          }
      }
      if (demoHeader.isEmpty() || labels.any { (node, _) ->
          labelsFor(node).any {
            Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(it)
          }
        }) return false
      val accountBottom = demoHeader.maxOf { it.second.bottom }
      val suffix = Regex("""\s*(?:\+?\d{1,3}\s*%\s*)?[⌄▾▼]?\s*""")
      val pairLabels = labels.filter { (node, bounds) ->
        bounds.centerY() in (h * .12f).toInt()..(h * .27f).toInt() &&
          bounds.top >= accountBottom + (h * .014f).toInt() &&
          bounds.left >= (w * .025f).toInt() &&
          bounds.right <= (w * .52f).toInt() &&
          bounds.width() in 20..(w * .49f).toInt() &&
          bounds.height() in 14..(h * .070f).toInt() &&
          labelsFor(node).any { label ->
            val match = fxPairLabel.find(label)
            match != null &&
              label.substring(0, match.range.first).let { prefix ->
                prefix.length <= 12 && prefix.none { it.isLetterOrDigit() }
              } &&
              suffix.matches(label.substring(match.range.last + 1)) &&
              pair.equals(
                match.groupValues[1].uppercase(java.util.Locale.ROOT) + "/" +
                match.groupValues[2].uppercase(java.util.Locale.ROOT) +
                (if (match.groupValues[3].isNotEmpty()) " OTC" else ""),
                ignoreCase = true
              )
          }
      }
      val rects = pairLabels.map { it.second }.distinct()
      val target = rects.minByOrNull { it.width().toLong() * it.height().toLong() }
        ?: return false
      // Separate nonoverlapping controls are not a valid unique selector.
      if (rects.any { other ->
          !Rect.intersects(target, other) ||
            kotlin.math.abs(target.centerY() - other.centerY()) > h * .035f
        }) return false
      val x = target.exactCenterX()
      val y = target.exactCenterY()
      if (x !in (w * .07f)..(w * .50f) ||
          y !in (h * .12f)..(h * .27f) ||
          overlayBounds.contains(x.toInt(), y.toInt())) return false
      // Check the same exact currency control in the foreground QT Demo
      // tree AGAIN immediately before the gesture. Never click from OCR.
      val fresh = activeRotationNodes(false, false) ?: return false
      if (fresh.first !== svc || fresh.second != root ||
          svc.rootInActiveWindow != root ||
          readVisibleFxPair(false) != pair || realFxAccountVisible() ||
          fresh.third.none { (node, bounds) ->
            bounds.contains(x.toInt(), y.toInt()) &&
              labelsFor(node).any { value ->
                fxPairLabel.find(value)?.let { match ->
                  val normalized = match.groupValues[1].uppercase(java.util.Locale.ROOT) +
                    "/" + match.groupValues[2].uppercase(java.util.Locale.ROOT) +
                    (if (match.groupValues[3].isNotEmpty()) " OTC" else "")
                  normalized.equals(pair, ignoreCase = true)
                } == true
              }
          }) return false
      val path = Path().apply { moveTo(x, y) }
      val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 70L)).build()
      return try {
        svc.rootInActiveWindow == root &&
          svc.dispatchGesture(gesture, null, Handler(Looper.getMainLooper()))
      } catch (_: Throwable) { false }
    }

    /** 506: exit a verified broker currency selector without a broker trade. */
    fun closeVisibleFxList506(realAccount: Boolean): Boolean {
      val (svc, root, labels) = activeRotationNodes(false, realAccount) ?: return false
      if (svc.rootInActiveWindow != root ||
          labels.none { (node, _) -> hasFxCurrencyHeader(node) }) return false
      return svc.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
    }

    /** A single selector action. The caller must verify the resulting chart. */
    fun navigateOpenFxList(
      excluded: Set<String>, allowScroll: Boolean, forward: Boolean, overlayBounds: Rect,
      onlyPair: String? = null, scrollHistory: MutableSet<List<String>>? = null,
      // 505: retain what was ACTUALLY seen in the selector during this round.
      // These are diagnostics/round-completion evidence, never trade signals.
      observedEligible: MutableSet<String>? = null,
      observedViewports: MutableSet<List<String>>? = null,
      realAccount: Boolean,
      allowSearchVariant: Boolean = false
    ): DemoFxNavigation {
      val (svc, root, labels) = activeRotationNodes(false, realAccount)
        ?: return DemoFxNavigation(message = "CONT QT NECONFIRMAT")
      if (svc.rootInActiveWindow != root)
        return DemoFxNavigation(message = "BROKERUL NU ESTE ÎN FAȚĂ")
      if (realAccount || realFxAccountVisible() || labels.none { (node, _) -> hasFxCurrencyHeader(node) })
        return DemoFxNavigation(message = "LISTĂ QT DEMO NECONFIRMATĂ")
      val rows = visibleDemoFxRows(labels)
      if (rows.isEmpty()) return DemoFxNavigation(message = "RÂNDURI VALUTE NECITITE")
      // 505: distinguish several genuinely different selector viewports
      // from the SAME five currencies reopened over and over. No assumed
      // total list length, and no automatic resetting of an incomplete pass.
      observedViewports?.add(rows.map { it.quote.pair })
      rows.filter { it.quote.payout == 92 && isPreferredFxPair517(it.quote.pair) }.forEach {
        observedEligible?.add(it.quote.pair)
      }
      val next = rows.firstOrNull {
        it.quote.payout == 92 && isPreferredFxPair517(it.quote.pair) && it.quote.pair !in excluded &&
          (onlyPair == null || onlyPair == it.quote.pair ||
            (allowSearchVariant && onlyPair.removeSuffix(" OTC") == it.quote.pair.removeSuffix(" OTC")))
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
        // 509: allow a verified FX row slightly above the old 32% cutoff,
        // but only BELOW the independently observed "Valute" list header.
        // Re-read the active QT Demo list before any physical row gesture:
        // a stale row coordinate must NEVER become an account-header tap.
        val currentList = activeRotationNodes(false, false)
          ?: return DemoFxNavigation(message = "CONT DEMO NECONFIRMAT")
        if (currentList.first !== svc || currentList.second != root ||
            !currentList.third.any { (node, _) -> hasFxCurrencyHeader(node) })
          return DemoFxNavigation(message = "LISTA VALUTELOR NU MAI ESTE DESCHISĂ")
        val freshRow = visibleDemoFxRows(currentList.third)
          .singleOrNull { it.quote == next.quote }
          ?: return DemoFxNavigation(message = "RÂND VALUTAR NECONFIRMAT")
        val headerBottom = currentList.third.firstOrNull { (node, _) ->
          hasFxCurrencyHeader(node)
        }?.second?.bottom ?: return DemoFxNavigation(message = "ANTET VALUTE NECONFIRMAT")
        if (kotlin.math.abs(freshRow.bounds.centerX() - x) > metrics.widthPixels * .015f ||
            kotlin.math.abs(freshRow.bounds.centerY() - y) > metrics.heightPixels * .012f ||
            x !in (metrics.widthPixels * .15f).toInt()..(metrics.widthPixels * .65f).toInt() ||
            y <= headerBottom || y < (metrics.heightPixels * .28f).toInt() ||
            y > (metrics.heightPixels * .70f).toInt())
          return DemoFxNavigation(rejectedPair = next.quote.pair, message = "RÂND VALUTAR ÎN AFARA ZONEI SIGURE")
        if (overlayBounds.contains(x, y))
          return DemoFxNavigation(rejectedPair = next.quote.pair, message = "PANOU PESTE PERECHE")
        val path = Path().apply { moveTo(x.toFloat(), y.toFloat()) }
        val gesture = GestureDescription.Builder()
          .addStroke(GestureDescription.StrokeDescription(path, 0L, 75L)).build()
        return if (svc.rootInActiveWindow == root &&
            svc.dispatchGesture(gesture, null, Handler(Looper.getMainLooper())))
          DemoFxNavigation(pair = next.quote.pair, message = "VERIFIC PERECHEA")
        else DemoFxNavigation(rejectedPair = next.quote.pair, message = "ANDROID A REFUZAT SELECTAREA")
      }
      if (!allowScroll) return DemoFxNavigation(message = "PERECHE ELIGIBILĂ NEVIZIBILĂ")
      val end = DemoFxNavigation(endOfList = true, message = "CAPĂT LISTĂ VALUTE")
      val viewport = rows.map { it.quote.pair }
      if (scrollHistory?.add(viewport) == false) return end
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
      }
      if (svc.rootInActiveWindow != root)
        return DemoFxNavigation(message = "BROKERUL NU ESTE ÎN FAȚĂ")
      if (scroll?.performAction(action) == true)
        return DemoFxNavigation(scrolled = true, message = "VERIFIC LISTA DERULATĂ")

      // Some WebViews do not expose an accessibility scroll action.
      // Swipe only inside the confirmed list, between recognized FX rows.
      val x = first.bounds.centerX()
      val top = first.bounds.centerY()
      val bottom = last.bounds.centerY()
      val metrics = svc.resources.displayMetrics
      if (x !in (metrics.widthPixels * .15f).toInt()..(metrics.widthPixels * .65f).toInt() ||
          top < metrics.heightPixels * .25f || bottom > metrics.heightPixels * .70f ||
          bottom - top < metrics.heightPixels * .08f ||
          (x in overlayBounds.left until overlayBounds.right &&
            top < overlayBounds.bottom && bottom >= overlayBounds.top)) return end
      val from = if (forward) bottom else top
      val distance = (bottom - top) * .70f
      val to = if (forward) from - distance else from + distance
      val path = Path().apply {
        moveTo(x.toFloat(), from.toFloat())
        lineTo(x.toFloat(), to)
      }
      val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 450L)).build()
      return if (svc.rootInActiveWindow == root &&
          svc.dispatchGesture(gesture, null, Handler(Looper.getMainLooper())))
        DemoFxNavigation(scrolled = true, message = "VERIFIC LISTA DERULATĂ")
      else DemoFxNavigation(message = "DERULARE NECONFIRMATĂ")
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
