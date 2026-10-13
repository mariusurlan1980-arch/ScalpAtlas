package com.scalpatlas.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Build
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Executes a confirmed Scalp Atlas signal only on a visibly identified QT Demo screen.
 * The feature is fail-closed: missing account text, missing button, disabled toggle or
 * an unavailable accessibility service all result in no click.
 */
class ScalpAutoDemoAccessibilityService : AccessibilityService() {
  companion object {
    private const val PREFS = "scalp_atlas_auto_demo"
    private const val ENABLED = "enabled"
    private const val MIN_CLICK_INTERVAL_MS = 60_000L

    @Volatile private var instance: ScalpAutoDemoAccessibilityService? = null
    @Volatile private var lastClickAt = 0L

    fun isConnected(): Boolean = instance != null

    fun isEnabled(service: android.content.Context): Boolean =
      service.getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(ENABLED, false)

    fun setEnabled(service: android.content.Context, enabled: Boolean) {
      service.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(ENABLED, enabled).apply()
    }

    // Read-only test: long press AUTO DEMO in the original overlay.
    // NEVER submits an order from this method.
    fun checkDemoReadiness(): String {
      val service = instance ?: return "SERVICIU ACCESIBILITATE OPRIT"
      if (!isEnabled(service)) return "AUTO DEMO OPRIT"
      val root = service.findTradeWindow() ?: return "BLOCAT: ECRAN DEMO INACCESIBIL"
      val text = buildString { service.collectText(root, this) }.uppercase()
      if (!text.contains("QT DEMO")) return "BLOCAT: QT DEMO NEDETECTAT"
      if (text.contains("REAL ACCOUNT") || text.contains("CONT REAL")) {
        return "BLOCAT: CONT REAL DETECTAT"
      }
      val buy = service.findButton(root, listOf("CUMPĂRAȚI", "CUMPARATI", "BUY"))
      val sell = service.findButton(root, listOf("VINDEȚI", "VINDETI", "SELL"))
      if (buy == null || sell == null) return "BLOCAT: BUTOANE BUY/SELL INVIZIBILE"
      return "TEST OK • BUTOANE VIZIBILE • FĂRĂ CLICK"
    }

    fun requestDemoTrade(direction: String): String {
      val service = instance ?: return "SERVICIU ACCESIBILITATE OPRIT"
      if (!isEnabled(service)) return "AUTO DEMO OPRIT"
      if (direction != "BUY" && direction != "SELL") return "DIRECȚIE INVALIDĂ"
      val now = SystemClock.elapsedRealtime()
      if (now - lastClickAt < MIN_CLICK_INTERVAL_MS) return "BLOCAT: PAUZĂ 60 SEC"

      // Do not click the Scalp Atlas overlay: it also displays the words QT DEMO.
      val root = service.findTradeWindow() ?: return "BLOCAT: ECRAN DEMO INACCESIBIL"
      val allText = buildString { service.collectText(root, this) }.uppercase()
      if (!allText.contains("QT DEMO")) return "BLOCAT: QT DEMO NEDETECTAT"
      if (allText.contains("REAL ACCOUNT") || allText.contains("CONT REAL")) {
        return "BLOCAT: CONT REAL DETECTAT"
      }

      val labels = if (direction == "BUY") {
        listOf("CUMPĂRAȚI", "CUMPARATI", "BUY")
      } else {
        listOf("VINDEȚI", "VINDETI", "SELL")
      }
      val target = service.findButton(root, labels) ?: return "BLOCAT: BUTON NEDETECTAT"
      val clicked = service.clickNodeOrCenter(target)
      if (!clicked) return "BLOCAT: APĂSARE EȘUATĂ"
      lastClickAt = now
      return "APĂSARE TRIMISĂ " + direction + " • VERIFICĂ ISTORICUL DEMO"
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit
  override fun onInterrupt() = Unit

  override fun onDestroy() {
    if (instance === this) instance = null
    super.onDestroy()
  }

  private fun findTradeWindow(): AccessibilityNodeInfo? {
    val roots = mutableListOf<AccessibilityNodeInfo>()
    rootInActiveWindow?.let { roots.add(it) }
    try {
      for (window in windows) window.root?.let { roots.add(it) }
    } catch (_: Throwable) {
      // Some devices do not expose every underlying Android window.
    }
    // Exclude our own overlay even if it says "QT DEMO".
    // Only a separately accessible broker/browser window can authorize a demo click.
    for (candidate in roots) {
      val pkg = candidate.packageName?.toString() ?: continue
      if (pkg == packageName) continue
      val all = buildString { collectText(candidate, this) }.uppercase()
      if (all.contains("QT DEMO")) return candidate
    }
    return roots.firstOrNull {
      val pkg = it.packageName?.toString()
      pkg != null && pkg != packageName
    }
  }

  private fun collectText(node: AccessibilityNodeInfo, out: StringBuilder) {
    node.text?.let { out.append(' ').append(it) }
    node.contentDescription?.let { out.append(' ').append(it) }
    for (i in 0 until node.childCount) node.getChild(i)?.let { collectText(it, out) }
  }

  private fun findButton(node: AccessibilityNodeInfo, labels: List<String>): AccessibilityNodeInfo? {
    val own = ((node.text?.toString() ?: "") + " " +
      (node.contentDescription?.toString() ?: "")).uppercase()
    if (labels.any { own.contains(it) }) return node
    for (i in 0 until node.childCount) {
      val match = node.getChild(i)?.let { findButton(it, labels) }
      if (match != null) return match
    }
    return null
  }

  private fun clickNodeOrCenter(node: AccessibilityNodeInfo): Boolean {
    var clickable: AccessibilityNodeInfo? = node
    while (clickable != null) {
      if (clickable.isClickable && clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
      clickable = clickable.parent
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false
    val bounds = android.graphics.Rect()
    node.getBoundsInScreen(bounds)
    if (bounds.isEmpty) return false
    val path = Path().apply { moveTo(bounds.exactCenterX(), bounds.exactCenterY()) }
    val gesture = GestureDescription.Builder()
      .addStroke(GestureDescription.StrokeDescription(path, 0, 80))
      .build()
    return dispatchGesture(gesture, null, null)
  }
}
