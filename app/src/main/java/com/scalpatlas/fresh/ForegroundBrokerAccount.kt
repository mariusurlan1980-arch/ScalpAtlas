package com.scalpatlas.fresh

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import java.util.ArrayDeque

internal enum class BrokerAccount { DEMO, REAL, UNKNOWN }

internal class ForegroundBrokerAccount(
    private val service: AccessibilityService,
    private val brokerPackage: String,
) {
    private val demoLabel = Regex("""^QT\s*Demo(?:\s+[A-Z]{3})?$""", RegexOption.IGNORE_CASE)
    private val realLabel = Regex("""\bQT\s*Real\b""", RegexOption.IGNORE_CASE)

    fun read(): BrokerAccount {
        val root = service.rootInActiveWindow ?: return BrokerAccount.UNKNOWN
        if (root.packageName?.toString() != brokerPackage) return BrokerAccount.UNKNOWN

        val window = Rect()
        root.getBoundsInScreen(window)
        if (window.isEmpty) return BrokerAccount.UNKNOWN

        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var demo = false
        var real = false
        var scanned = 0
        while (queue.isNotEmpty() && scanned++ < 350) {
            val node = queue.removeFirst()
            if (node.packageName?.toString() != brokerPackage) continue

            val bounds = Rect()
            node.getBoundsInScreen(bounds)
            if (node.isVisibleToUser && inAccountHeader(bounds, window)) {
                for (label in listOfNotNull(node.text, node.contentDescription)) {
                    val text = label.toString().trim()
                    demo = demo || demoLabel.matches(text)
                    real = real || realLabel.containsMatchIn(text)
                }
            }

            for (index in 0 until node.childCount.coerceAtMost(35)) {
                node.getChild(index)?.let(queue::addLast)
            }
        }

        val active = service.rootInActiveWindow ?: return BrokerAccount.UNKNOWN
        if (active.windowId != root.windowId || active.packageName?.toString() != brokerPackage ||
            queue.isNotEmpty() || demo == real) return BrokerAccount.UNKNOWN
        return if (demo) BrokerAccount.DEMO else BrokerAccount.REAL
    }

    private fun inAccountHeader(bounds: Rect, window: Rect): Boolean {
        if (bounds.isEmpty || !window.contains(bounds)) return false
        val x = (bounds.exactCenterX() - window.left) / window.width()
        val y = (bounds.exactCenterY() - window.top) / window.height()
        return x in 0.42f..0.90f && y < 0.19f &&
            bounds.width() <= window.width() * 0.62f &&
            bounds.height() <= window.height() * 0.15f
    }
}
