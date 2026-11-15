package com.scalpatlas.fresh

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityNodeInfo
import java.util.ArrayDeque

internal class ForegroundDemoReceipt(
    private val service: AccessibilityService,
    private val brokerPackage: String,
    private val account: ForegroundBrokerAccount,
) {
    private val titles = setOf("tranzacții", "tranzactii", "transactions", "trades")
    private val closedLabels = setOf("închis", "inchis", "closed", "închise", "closed trades")
    private val openLabels = setOf("deschis", "deschise", "open", "open trades")

    fun readClosed(): BrokerOrderRow? = read(BrokerOrderState.CLOSED)

    fun readOpen(): BrokerOrderRow? = read(BrokerOrderState.OPEN)

    private fun read(expectedState: BrokerOrderState): BrokerOrderRow? {
        if (account.read() != BrokerAccount.DEMO) return null
        val root = service.rootInActiveWindow ?: return null
        if (root.packageName?.toString() != brokerPackage) return null

        val nodes = ArrayDeque<AccessibilityNodeInfo>()
        nodes.add(root)
        val labels = mutableListOf<String>()
        var closedSelected = false
        var openSelected = false
        var visited = 0
        while (nodes.isNotEmpty() && visited++ < 350) {
            val node = nodes.removeFirst()
            if (node.packageName?.toString() != brokerPackage) continue
            if (node.isVisibleToUser) {
                val text = listOfNotNull(node.text, node.contentDescription)
                    .map { it.toString().trim() }.filter(String::isNotEmpty)
                labels.addAll(text)
                if (node.isSelected || (node.isCheckable && node.isChecked)) {
                    closedSelected = closedSelected || text.any { it.lowercase() in closedLabels }
                    openSelected = openSelected || text.any { it.lowercase() in openLabels }
                }
            }
            for (index in 0 until node.childCount.coerceAtMost(35)) {
                node.getChild(index)?.let(nodes::addLast)
            }
        }

        val expectedTabSelected = when (expectedState) {
            BrokerOrderState.CLOSED -> closedSelected && !openSelected
            BrokerOrderState.OPEN -> openSelected && !closedSelected
        }
        if (nodes.isNotEmpty() || !expectedTabSelected ||
            labels.none { it.lowercase() in titles }) return null
        val row = DemoReceiptParser.parse(labels, expectedState) ?: return null
        if (account.read() != BrokerAccount.DEMO ||
            service.rootInActiveWindow?.windowId != root.windowId) return null
        return row
    }
}
