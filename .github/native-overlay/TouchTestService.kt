package com.scalpatlas.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.view.accessibility.AccessibilityManager
import android.graphics.Path
import android.graphics.Rect
import android.view.View
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/** A user-invoked read-only broker-label probe and isolated test gestures. No broker orders. */
class TouchTestService : AccessibilityService() {
  companion object {
    @Volatile private var connected: TouchTestService? = null
    fun ready(): Boolean = connected != null

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
        if (enabled)
          "ACCES DEJA PERMIS • SERVICIUL ANDROID NU ESTE CONECTAT"
        else
          "ACCES OPRIT ÎN ANDROID • VERIFICĂ ACCESIBILITATE"
      } catch (_: Throwable) {
        "NU POT CITI STAREA SERVICIULUI ANDROID"
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
      val root = svc.rootInActiveWindow ?: return null
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
      val reason: String
    )
    private const val DEMO_TEST_LOCK_MS = 300_000L

    private fun checkOneDollarDemoTarget(side: String): DemoOrderCheck {
      val svc = connected ?: return DemoOrderCheck(reason = "ROBOT NECONECTAT")
      if (side != "BUY" && side != "SELL") return DemoOrderCheck(reason = "DIRECȚIE INVALIDĂ")
      val root = svc.rootInActiveWindow ?: return DemoOrderCheck(reason = "BROKERUL NU ESTE ACTIV")
      val pkg = root.packageName?.toString().orEmpty()
      // Known official Android app identifiers; never click a browser, unknown
      // app, copycat or Scalp Atlas's own overlay.
      if (pkg != "com.pocketoption.broker" && pkg != "com.potradeweb")
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
      val amountCaptions = labels.filter {
        it.rect.centerX() > w * 0.46 &&
        it.rect.centerY() in (h * 0.62).toInt()..(h * 0.88).toInt() &&
        Regex("""(?i)^\s*Suma\s*:?\s*$""").matches(it.value)
      }.distinctBy { it.rect.toShortString() }
      if (amountCaptions.size != 1)
        return DemoOrderCheck(reason = "BLOCAT: ETICHETA SUMĂ NU ESTE IDENTIFICATĂ UNIC")
      val caption = amountCaptions.single()
      val nearby = labels.filter {
        val x = it.rect.centerX()
        val y = it.rect.centerY()
        x >= caption.rect.left - (w * 0.03f).toInt() &&
          x <= (w * 0.95).toInt() &&
          y >= caption.rect.top - (h * 0.015f).toInt() &&
          y <= caption.rect.bottom + (h * 0.10f).toInt()
      }.distinctBy { it.rect.toShortString() + ":" + it.value.trim() }
      // Accept ONLY a literal one-dollar value, with an optional decimal
      // fraction of zeros. Do not guess from a screenshot or similar "10".
      val strictOne = Regex("""(?i)^\s*(?:USD\s*|\$\s*)?1(?:[.,]0{1,2})?(?:\s*(?:USD|\$))?\s*$""")
      val amountNumber = Regex("""(?i)^\s*(?:(?:USD|\$)\s*)?\d+(?:[.,]\d{1,2})?(?:\s*(?:USD|\$))?\s*$""")
      val amountValues = nearby.filter { amountNumber.matches(it.value) }
      // Some WebViews expose a single multiline "Suma 1" parent label.
      val inlineOne = nearby.any {
        Regex("""(?i)^\s*Suma\s*:?\s*(?:USD\s*|\$\s*)?1(?:[.,]0{1,2})?(?:\s*(?:USD|\$))?\s*$""")
          .matches(it.value)
      }
      val hasOneDollar = (amountValues.size == 1 &&
        strictOne.matches(amountValues.single().value)) ||
        (amountValues.isEmpty() && inlineOne)
      if (!hasOneDollar)
        return DemoOrderCheck(reason = if (amountValues.isEmpty())
          "BLOCAT: ANDROID NU POATE CITI VALOAREA SUMEI"
          else "BLOCAT: SUMA NU ESTE CONFIRMATĂ CA 1 USD")

      // Validate that demo balance is visible in the narrow account region;
      // the chart quotes have more decimal places and cannot count as balance.
      val balanceValues = labels.filter {
        it.rect.centerX() in (w * 0.48).toInt()..(w * 0.86).toInt() &&
        it.rect.centerY() < h * 0.17
      }.mapNotNull {
        Regex("""(?<!\d)(\d{1,5}[.,]\d{2})(?!\d)""").find(it.value)
          ?.groupValues?.getOrNull(1)?.replace(',', '.')?.toDoubleOrNull()
      }.distinct()
      if (balanceValues.size != 1 || balanceValues[0] < 1.0)
        return DemoOrderCheck(reason = "BLOCAT: SOLD DEMO NECONFIRMAT SAU SUB 1 USD")

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
      if (svc.rootInActiveWindow?.packageName?.toString() != pkg)
        return DemoOrderCheck(reason = "BLOCAT: APLICAȚIA ACTIVĂ S-A SCHIMBAT")
      return DemoOrderCheck(DemoOrderTarget(candidates[0].first, pkg),
        "GATA " + side + " • QT DEMO • 1 USD")
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

    fun previewOneDollarDemoOrder(side: String): String {
      val svc = connected ?: return "ROBOT NECONECTAT"
      val at = android.os.SystemClock.elapsedRealtime()
      val last = svc.getSharedPreferences("scalp_demo_order_safety", Context.MODE_PRIVATE)
        .getLong("lastAcceptedAt", 0L)
      if (last > 0L && at - last in 0 until DEMO_TEST_LOCK_MS)
        return "BLOCAT: O SINGURĂ PROBĂ LA 5 MINUTE"
      return checkOneDollarDemoTarget(side).reason
    }

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
