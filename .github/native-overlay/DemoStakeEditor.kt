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
 * 566: accepts larger DEMO-only stake amounts up to $819.50, but requires
 * fresh broker UI payout=92%, QT DEMO balance >= stake, and exact readback.
 * A higher editor limit does NOT bypass the planned $1572.44 risk ledger.
 * No coordinates are tapped: ACTION_SET_TEXT targets a verified editable node.
 */
object DemoStakeEditor {
  private data class Item(val node: AccessibilityNodeInfo, val value: String, val rect: Rect)
  private data class Screen(
    val pkg: String,
    val input: Item,
    val payout: Int,
    val balanceCents: Long
  )

  private fun centsOf(value: String): Long? {
    val cleaned = value.trim().replace(" ", "")
      .replace("$", "").replace("USD", "", ignoreCase = true)
    val match = Regex("""^(\d{1,5})(?:[.,](\d{1,2}))?$""").matchEntire(cleaned)
      ?: return null
    val whole = match.groupValues[1].toLongOrNull() ?: return null
    val fraction = match.groupValues[2]
    val two = when (fraction.length) {
      0 -> 0L
      1 -> fraction.toLong() * 10L
      else -> fraction.toLong()
    }
    return whole * 100 + two
  }

  /**
   * 567: Pocket Option may show QT DEMO USD 1,572.68 (US thousands), while
   * some locales show 1.572,68. Parse the WHOLE amount, never a suffix
   * like 572.68 from a 1,572.68 balance. All ambiguous inputs fail closed.
   * This is used only for the HEADER BALANCE, not the editable stake.
   */
  private fun brokerBalanceCents567(raw: String): Long? {
    val candidate = raw.trim()
    val normalized = when {
      Regex("""^\d{1,3}(?:,\d{3})+\.\d{2}$""").matches(candidate) ->
        candidate.replace(",", "")
      Regex("""^\d{1,3}(?:\.\d{3})+,\d{2}$""").matches(candidate) ->
        candidate.replace(".", "").replace(',', '.')
      Regex("""^\d{1,5}[.,]\d{2}$""").matches(candidate) ->
        candidate.replace(',', '.')
      else -> return null
    }
    return centsOf(normalized)
  }

  /**
   * 579: shared STRICT parser for a balance from the independently proven
   * QT Demo header tile. The order preflight had a second parser which
   * rejected 1,572.68 and 1.572,68, silently blocking BUY/SELL even with
   * an already-confirmed 1.09 stake. Never accept a numeric suffix alone.
   *
   * Callers must independently verify QT Demo (and no QT Real), the
   * bounded account header tile, and a unique positive USD balance.
   * This function does not authorize a broker gesture.
   */
  internal fun demoBalanceFromVerifiedHeader579(raw: String): Long? {
    val compact = raw.trim().replace(Regex("""\s+"""), " ")
    // Accept the literal account label only at the BEGINNING, not embedded
    // elsewhere in a price, chart label, or unrelated user-visible text.
    val withoutHeader = compact.replace(
      Regex("""(?i)^QT\s+Demo\b\s*"""), ""
    )
    val numeric = withoutHeader
      .replace(Regex("""(?i)^(?:USD\s*|\$\s*)"""), "")
      .replace(Regex("""(?i)\s*(?:USD|\$)$"""), "")
      .trim()
    // Retain the older broker format for small Demo balances (e.g. "20"
    // or "20.5") while supporting exact grouped "1,572.68" / "1.572,68".
    // Never parse a suffix of a malformed thousands grouping.
    val plain = Regex("""^(\d{1,5})(?:[.,](\d{1,2}))?$""")
      .matchEntire(numeric)
    if (plain != null) {
      val whole = plain.groupValues[1].toLongOrNull() ?: return null
      val part = plain.groupValues[2]
      val cents = when (part.length) {
        0 -> 0L
        1 -> (part.toLongOrNull() ?: return null) * 10L
        else -> part.toLongOrNull() ?: return null
      }
      return whole * 100L + cents
    }
    return brokerBalanceCents567(numeric)
  }

  private val brokerBalanceToken567 = Regex(
    """(?<![\d.,])(?:\d{1,3}(?:,\d{3})+\.\d{2}|\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,5}[.,]\d{2})(?![\d.,])"""
  )

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
    // 579: AccessibilityService may return a FRESH wrapper object for the
    // same active QT Demo window; object equality rejected valid FX quotes.
    // Use stable package identity, with the caller's pair rechecked both
    // BEFORE and AFTER this read. Account Demo/Real and BUY/SELL payout
    // remain independently validated by readChart/readChartPayout.
    return payout.takeIf {
      svc.rootInActiveWindow?.packageName?.toString() == chart.pkg
    }
  }

  private fun inspect(svc: AccessibilityService): Pair<Screen?, String> {
    val (chart, chartReason) = readChart(svc)
    if (chart == null) return null to chartReason
    val (_, pkg, w, h, labels) = chart
    val captions = labels.filter {
      it.rect.centerX() > w * .46f &&
      it.rect.centerY() in (h * .62).toInt()..(h * .88).toInt() &&
      it.rect.width() <= w * .48f &&
      Regex("""(?i)^Sum[ăa]\s*:?$""").matches(it.value)
    }
    val anchor = captions.firstOrNull() ?: return null to "BLOCAT: ETICHETA SUMĂ LIPSEȘTE"
    if (captions.any {
        kotlin.math.abs(it.rect.centerY() - anchor.rect.centerY()) > h * .035f ||
          kotlin.math.abs(it.rect.centerX() - anchor.rect.centerX()) > w * .15f
      }) return null to "BLOCAT: MAI MULTE CÂMPURI SUMĂ"

    val editable = labels.filter {
      it.node.isEditable && it.node.isEnabled &&
      it.rect.centerX() >= anchor.rect.left - w * .04f &&
      it.rect.centerX() <= anchor.rect.right + w * .18f &&
      it.rect.centerY() >= anchor.rect.bottom - h * .015f &&
      it.rect.centerY() <= anchor.rect.bottom + h * .065f &&
      it.rect.height() <= h * .09f &&
      centsOf(it.value) != null
    }.distinctBy { it.rect.toShortString() }
    if (editable.size != 1)
      return null to "BLOCAT: CÂMP SUMĂ EDITABIL NEIDENTIFICAT"
    val input = editable.single()
    if (input.node.actionList.none {
        it.id == AccessibilityNodeInfo.ACTION_SET_TEXT
      }) return null to "BLOCAT: CÂMPUL SUMĂ NU SUPORTĂ SET_TEXT"

    val (buyPayout, payoutReason) = readChartPayout(chart)
    if (buyPayout == null) return null to payoutReason
    if (buyPayout != 92) return null to "BLOCAT: PAYOUT BUY/SELL DIFERIT DE 92%"

    val balance = labels.filter {
      it.rect.centerX() in (w * .48f).toInt()..(w * .86f).toInt() &&
      it.rect.centerY() < h * .17f
    }.flatMap { item ->
      brokerBalanceToken567.findAll(item.value).mapNotNull {
        brokerBalanceCents567(it.value)
      }.toList()
    }.distinct()
    if (balance.size != 1)
      return null to "BLOCAT: SOLD QT DEMO NECONFIRMAT"
    if (svc.rootInActiveWindow?.packageName?.toString() != pkg)
      return null to "BLOCAT: BROKER SCHIMBAT"
    return Screen(pkg, input, buyPayout, balance.single()) to "PREGĂTIT"
  }

  /**
   * Read-only actual QT Demo payout. We do not assume a fixed 92 percent
   * when selecting the next stake: broker payout can change with the pair.
   */
  fun verifiedDemoPayoutReadOnly(svc: AccessibilityService): Int? {
    // 576: payout read is independent from the editable Sumă field and
    // header-balance parser. Earlier inspect() called all three at once and
    // rejected a genuine 92% when only the stake node was unavailable.
    // Still require the actual broker QT Demo screen, BOTH actual visible
    // BUY/SELL payouts at exactly 92%, and a stable foreground package.
    // This read ONLY reports a verified quote: it cannot edit or order.
    val (chart, _) = readChart(svc)
    if (chart == null) return null
    val (payout, _) = readChartPayout(chart)
    if (payout != 92) return null
    if (svc.rootInActiveWindow?.packageName?.toString() != chart.pkg)
      return null
    return payout
  }

  /**
   * 429: Read back the current QT Demo stake, payout and actual balance.
   * Never authorizes a gesture; returns false on missing/ambiguous nodes.
   */
  fun verifiedExactDemoStakeReadOnly(
    svc: AccessibilityService,
    stakeCents: Long
  ): Boolean {
    if (stakeCents !in 100L..81950L) return false
    val (screen, _) = inspect(svc)
    return screen != null &&
      centsOf(screen.input.value) == stakeCents &&
      screen.balanceCents >= stakeCents &&
      screen.payout == 92
  }

  /**
   * Called only by a trusted, broker-receipt-verified recovery workflow.
   * This method does NOT authorize an order. It fails closed on any ambiguity.
   */
  @Synchronized
  fun setExactDemoStake(
    svc: AccessibilityService,
    expectedPairMatches: () -> Boolean,
    stakeCents: Long
  ): String {
    if (!expectedPairMatches() || stakeCents !in 100L..81950L)
      return "BLOCAT: PERECHE SAU MIZĂ NECONFIRMATĂ"
    val (before, reason) = inspect(svc)
    if (before == null) return reason
    if (before.balanceCents < stakeCents)
      return "BLOCAT: SOLD DEMO INSUFICIENT"
    if (!expectedPairMatches()) return "BLOCAT: PERECHE SCHIMBATĂ ÎNAINTE DE EDITARE"
    val old = centsOf(before.input.value) ?: return "BLOCAT: SUMĂ VECHE NECITITĂ"
    val formatted = String.format(Locale.ROOT, "%d.%02d", stakeCents / 100, stakeCents % 100)
    if (old != stakeCents) {
      val bundle = Bundle()
      bundle.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, formatted)
      val didSet = try {
        before.input.node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, bundle)
      } catch (_: Throwable) { false }
      if (!didSet) return "BLOCAT: ANDROID NU A ACCEPTAT SET_TEXT"
    }
    // Never trust Android's boolean alone; the fresh broker UI must echo cents.
    val (after, postReason) = inspect(svc)
    if (after == null) return "SUMĂ NECONFIRMATĂ DUPĂ EDITARE • " + postReason
    if (!expectedPairMatches() || after.pkg != before.pkg ||
        after.payout != before.payout ||
        centsOf(after.input.value) != stakeCents)
      return "SUMĂ NECONFIRMATĂ DUPĂ EDITARE • FĂRĂ ORDIN"
    return "SUMĂ QT DEMO CONFIRMATĂ " + formatted + " USD • FĂRĂ ORDIN"
  }
}
