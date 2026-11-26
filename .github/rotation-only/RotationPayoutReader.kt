package com.scalpatlas.app

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo
import android.content.Context
import java.util.Locale

/**
 * 423 - DEMO-only exact stake input editor. NO BUY, SELL, navigation, or
 * broker order gestures. Must be called ONLY after an independently verified
 * closed-trade receipt; currently the application does not have such a reader.
 *
 * Aborts on QT Real, unknown broker, uncertain amount, payout, pair or balance.
 * No coordinates are tapped: ACTION_SET_TEXT targets a verified editable node.
 */
object RotationPayoutReader {
  private data class Item(val node: AccessibilityNodeInfo, val value: String, val rect: Rect)
  private data class Chart(
    val root: AccessibilityNodeInfo, val pkg: String, val w: Int, val h: Int,
    val labels: List<Item>
  )

  private fun readChart(svc: AccessibilityService, realAccount: Boolean = false): Pair<Chart?, String> {
    val root = svc.rootInActiveWindow ?: return null to "BROKER NECONFIRMAT"
    val pkg = root.packageName?.toString().orEmpty()
    if (!BrokerAdapterRegistry.hasDemoExecutor(pkg))
      return null to "BLOCAT: BROKER NECUNOSCUT/REAL"
    val metrics = android.util.DisplayMetrics()
    try {
      val manager = svc.getSystemService(Context.WINDOW_SERVICE)
        as android.view.WindowManager
      @Suppress("DEPRECATION")
      manager.defaultDisplay.getRealMetrics(metrics)
    } catch (_: Throwable) {
      return null to "BLOCAT: ECRAN NECONFIRMAT"
    }
    val w = metrics.widthPixels
    val h = metrics.heightPixels
    if (w < 300 || h < 650) return null to "BLOCAT: ECRAN NECONFIRMAT"
    val labels = ArrayList<Item>()
    val nodes = ArrayDeque<AccessibilityNodeInfo>()
    nodes.add(root)
    var seen = 0
    while (nodes.isNotEmpty() && seen++ < 350) {
      val node = nodes.removeFirst()
      if (node.packageName?.toString() == pkg && node.isVisibleToUser) {
        val rect = Rect()
        node.getBoundsInScreen(rect)
        if (!rect.isEmpty && rect.left >= 0 && rect.right <= w &&
            rect.top >= 0 && rect.bottom <= h) {
          val txt = node.text?.toString()?.trim().orEmpty()
          val description = node.contentDescription?.toString()?.trim().orEmpty()
          if (txt.isNotBlank()) labels.add(Item(node, txt.take(120), Rect(rect)))
          if (description.isNotBlank() && description != txt)
            labels.add(Item(node, description.take(120), Rect(rect)))
        }
      }
      for (i in 0 until node.childCount.coerceAtMost(35))
        node.getChild(i)?.let(nodes::addLast)
    }
    val demo = labels.any { it.rect.centerY() < h * 0.28 &&
      Regex("""(?i)\bQT\s*Demo\b""").containsMatchIn(it.value) }
    val real = labels.any {
      Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(it.value)
    }
    if (if (realAccount) !real || demo else !demo || real)
      return null to "BLOCAT: CONTUL QT NU ESTE CONFIRMAT"

    return Chart(root, pkg, w, h, labels) to "QT DEMO"
  }

  private fun readChartPayout(chart: Chart): Pair<Int?, String> {
    val (_, _, w, h, labels) = chart
    val actionLabels = labels.filter {
      it.rect.centerY() > h * .76f && it.rect.centerY() < h * .97f &&
        Regex("""(?i)^(?:CUMPĂRAȚI|CUMPARATI|VINDEȚI|VINDETI)(?:\s+\d{1,3}\s*%)?$""")
          .matches(it.value.replace('\n', ' ').trim())
    }
    if (!actionLabels.any { it.rect.centerX() < w * .49f } ||
        !actionLabels.any { it.rect.centerX() > w * .51f })
      return null to "BLOCAT: BUTOANE BUY/SELL NEIDENTIFICATE"
    val payoutPattern = Regex("""(?<!\d)(\d{1,3})\s*%(?!\d)""")
    fun pct(isBuy: Boolean) = labels.filter {
      it.rect.centerY() > h * .75f && it.rect.centerY() < h * .97f &&
        (if (isBuy) it.rect.centerX() < w * .49f
         else it.rect.centerX() > w * .51f)
    }.mapNotNull { payoutPattern.find(it.value)?.groupValues?.getOrNull(1)?.toIntOrNull() }
      .distinct().singleOrNull()
    val buyPayout = pct(true)
    val sellPayout = pct(false)
    if (buyPayout == null || buyPayout != sellPayout || buyPayout !in 0..100)
      return null to "BLOCAT: PAYOUT BUY/SELL NECONFIRMAT"

    return buyPayout to "QT DEMO"
  }

  fun readRotationPayout(svc: AccessibilityService, realAccount: Boolean = false): Int? {
    val chart = readChart(svc, realAccount).first ?: return null
    val payout = readChartPayout(chart).first ?: return null
    return payout.takeIf { svc.rootInActiveWindow == chart.root }
  }
}
