package com.scalpatlas.fresh

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityNodeInfo
import java.util.ArrayDeque

internal enum class DemoClickResult { BLOCKED, SENT_UNCONFIRMED, UNKNOWN }

internal class DemoOrderButton(
    private val service: AccessibilityService,
    private val brokerPackage: String,
) {
    private val account = ForegroundBrokerAccount(service, brokerPackage)

    // Call on the main thread. A dispatched click is never an order receipt.
    fun submit(pair: String, side: String): DemoClickResult {
        val buttonLabel = when (side) {
            "BUY" -> Regex("""CUMPĂRAȚI\s+(\d{1,3})\s*%""", RegexOption.IGNORE_CASE)
            "SELL" -> Regex("""VINDEȚI\s+(\d{1,3})\s*%""", RegexOption.IGNORE_CASE)
            else -> return DemoClickResult.BLOCKED
        }
        if (!Regex("""[A-Z]{3}/[A-Z]{3}(?: OTC)?""").matches(pair) ||
            account.read() != BrokerAccount.DEMO) return DemoClickResult.BLOCKED

        val root = service.rootInActiveWindow ?: return DemoClickResult.BLOCKED
        if (root.packageName?.toString() != brokerPackage) return DemoClickResult.BLOCKED
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        val targets = mutableListOf<AccessibilityNodeInfo>()
        var pairVisible = false
        var expiryVisible = false
        var scanned = 0
        while (queue.isNotEmpty() && scanned++ < 350) {
            val node = queue.removeFirst()
            if (node.packageName?.toString() != brokerPackage) continue
            if (node.isVisibleToUser) {
                val labels = listOfNotNull(node.text, node.contentDescription)
                    .map { it.toString().trim() }.distinct()
                pairVisible = pairVisible || labels.any { it == pair }
                expiryVisible = expiryVisible || labels.any { it == "00:05:00" }
                if (node.isEnabled && node.isClickable && labels.any { label ->
                    val payout = buttonLabel.matchEntire(label)?.groupValues?.get(1)?.toIntOrNull()
                    payout != null && payout in 92..100
                }) targets.add(node)
            }
            for (index in 0 until node.childCount.coerceAtMost(35)) {
                node.getChild(index)?.let(queue::addLast)
            }
        }

        val target = targets.singleOrNull() ?: return DemoClickResult.BLOCKED
        if (queue.isNotEmpty() || !pairVisible || !expiryVisible ||
            account.read() != BrokerAccount.DEMO ||
            service.rootInActiveWindow?.windowId != root.windowId ||
            !target.refresh() || !target.isVisibleToUser || !target.isEnabled ||
            !target.isClickable) return DemoClickResult.BLOCKED
        val stillMatches = listOfNotNull(target.text, target.contentDescription).any {
            val payout = buttonLabel.matchEntire(it.toString().trim())
                ?.groupValues?.get(1)?.toIntOrNull()
            payout != null && payout in 92..100
        }
        if (!stillMatches) return DemoClickResult.BLOCKED
        return if (target.performAction(AccessibilityNodeInfo.ACTION_CLICK))
            DemoClickResult.SENT_UNCONFIRMED else DemoClickResult.UNKNOWN
    }
}
