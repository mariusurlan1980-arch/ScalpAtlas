package com.scalpatlas.fresh

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityNodeInfo
import java.util.ArrayDeque

internal data class AccessibleM5Frame(
    val activePair: String,
    val time: Long,
    val price: Double,
    val previousStart: Long,
    val previousOpen: Double,
    val previousClose: Double,
    val currentStart: Long,
    val currentOpen: Double,
)

internal class AccessibleM5Chart(
    private val service: AccessibilityService,
    private val brokerPackage: String,
    private val selector: DemoPairSelector,
) {
    fun read(): AccessibleM5Frame? {
        val pair = selector.readActiveChartPair() ?: return null
        val root = service.rootInActiveWindow ?: return null
        if (root.packageName?.toString() != brokerPackage) return null

        val queue = ArrayDeque<AccessibilityNodeInfo>()
        val labels = mutableSetOf<String>()
        queue.add(root)
        var scanned = 0
        while (queue.isNotEmpty() && scanned++ < 350) {
            val node = queue.removeFirst()
            if (node.packageName?.toString() != brokerPackage) continue
            if (node.isVisibleToUser) {
                labels.addAll(listOfNotNull(node.text, node.contentDescription)
                    .map { it.toString().trim() })
            }
            if (node.childCount > 100) return null
            for (index in 0 until node.childCount) node.getChild(index)?.let(queue::addLast)
        }
        if (queue.isNotEmpty()) return null
        return parse(labels, pair)?.takeIf {
            selector.readActiveChartPair() == pair &&
                service.rootInActiveWindow?.windowId == root.windowId
        }
    }

    private fun parse(labels: Set<String>, pair: String): AccessibleM5Frame? {
        // Only explicitly labelled chart values are accepted. Balances,
        // countdowns and axis values cannot be used as a candle.
        if ("M5" !in labels) return null
        fun field(name: String): String? = labels.mapNotNull { label ->
            val colon = label.indexOf(':')
            if (colon < 0 || !label.substring(0, colon).trim().equals(name, true)) null
            else label.substring(colon + 1).trim()
        }.distinct().singleOrNull()
        fun price(name: String): Double? =
            field(name)?.replace(',', '.')?.toDoubleOrNull()?.takeIf { it.isFinite() && it > 0 }

        val currentStart = field("Current candle start ms")?.toLongOrNull() ?: return null
        val previousStart = field("Previous candle start ms")?.toLongOrNull() ?: return null
        val sampledAt = System.currentTimeMillis()
        if (currentStart < 300_000 || currentStart % 300_000 != 0L ||
            previousStart != currentStart - 300_000 ||
            sampledAt - currentStart !in 0L until 300_000L) return null
        return AccessibleM5Frame(
            pair, sampledAt, price("Live price") ?: return null,
            previousStart, price("Previous candle open") ?: return null,
            price("Previous candle close") ?: return null,
            currentStart, price("Current candle open") ?: return null,
        )
    }
}
