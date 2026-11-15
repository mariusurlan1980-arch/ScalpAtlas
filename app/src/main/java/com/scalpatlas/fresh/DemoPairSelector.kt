package com.scalpatlas.fresh

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityNodeInfo
import java.util.ArrayDeque

internal class DemoPairSelector(
    private val service: AccessibilityService,
    private val brokerPackage: String,
    private val account: ForegroundBrokerAccount,
) {
    private val pairFormat = Regex("""[A-Z]{3}/[A-Z]{3}(?: OTC)?""")
    private val listTitles = setOf("valute", "currencies", "forex")

    // Operates on an already visible list. The next frame confirms selection.
    fun selectVisiblePair(pair: String, activePair: String? = null): Boolean {
        if (!pairFormat.matches(pair) || account.read() != BrokerAccount.DEMO) return false
        val root = service.rootInActiveWindow ?: return false
        if (root.packageName?.toString() != brokerPackage) return false
        val nodes = ArrayDeque<AccessibilityNodeInfo>()
        val matches = mutableListOf<AccessibilityNodeInfo>()
        val chartSelectors = mutableListOf<AccessibilityNodeInfo>()
        var listVisible = false
        nodes.add(root)
        var scanned = 0
        while (nodes.isNotEmpty() && scanned++ < 350) {
            val node = nodes.removeFirst()
            if (node.packageName?.toString() != brokerPackage) continue
            if (node.isVisibleToUser) {
                val labels = labels(node)
                listVisible = listVisible || labels.any { it.lowercase() in listTitles }
                if (node.isEnabled && node.isClickable && pair in labels) matches.add(node)
                if (activePair != null && activePair in labels &&
                    node.isEnabled && node.isClickable && isChartSelector(node, root)) {
                    chartSelectors.add(node)
                }
            }
            for (index in 0 until node.childCount) node.getChild(index)?.let(nodes::addLast)
        }

        if (nodes.isNotEmpty()) return false
        val targetPair = if (listVisible) pair else activePair
        if (targetPair == null || !pairFormat.matches(targetPair) ||
            (!listVisible && targetPair == pair)) return false
        val target = (if (listVisible) matches else chartSelectors).singleOrNull() ?: return false
        if (account.read() != BrokerAccount.DEMO ||
            service.rootInActiveWindow?.windowId != root.windowId ||
            !target.refresh() || !target.isVisibleToUser || !target.isEnabled ||
            !target.isClickable || targetPair !in labels(target) ||
            (!listVisible && !isChartSelector(target, root))) return false
        return target.performAction(AccessibilityNodeInfo.ACTION_CLICK)
    }

    fun readActiveChartPair(): String? {
        if (account.read() != BrokerAccount.DEMO) return null
        val root = service.rootInActiveWindow ?: return null
        if (root.packageName?.toString() != brokerPackage) return null
        val nodes = ArrayDeque<AccessibilityNodeInfo>()
        val pairs = mutableSetOf<String>()
        nodes.add(root)
        var scanned = 0
        while (nodes.isNotEmpty() && scanned++ < 350) {
            val node = nodes.removeFirst()
            if (node.packageName?.toString() != brokerPackage) continue
            if (node.isVisibleToUser) {
                val text = labels(node)
                if (text.any { it.lowercase() in listTitles }) return null
                if (node.isEnabled && node.isClickable && isChartSelector(node, root)) {
                    pairs.addAll(text.filter(pairFormat::matches))
                }
            }
            if (node.childCount > 100) return null
            for (index in 0 until node.childCount) node.getChild(index)?.let(nodes::addLast)
        }
        if (nodes.isNotEmpty() || account.read() != BrokerAccount.DEMO ||
            service.rootInActiveWindow?.windowId != root.windowId) return null
        return pairs.singleOrNull()
    }

    private fun isChartSelector(node: AccessibilityNodeInfo, root: AccessibilityNodeInfo): Boolean {
        val window = android.graphics.Rect()
        val bounds = android.graphics.Rect()
        root.getBoundsInScreen(window)
        node.getBoundsInScreen(bounds)
        if (window.isEmpty || bounds.isEmpty || !window.contains(bounds)) return false
        val y = (bounds.exactCenterY() - window.top) / window.height()
        return y in 0.12f..0.30f &&
            bounds.right <= window.left + window.width() * .53f &&
            bounds.height() <= window.height() * .10f
    }

    private fun labels(node: AccessibilityNodeInfo): List<String> =
        listOfNotNull(node.text, node.contentDescription).map { it.toString().trim() }
}
