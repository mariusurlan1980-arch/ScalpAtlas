package com.scalpatlas.fresh

internal enum class BrokerOrderState { OPEN, CLOSED }

internal data class BrokerOrderRow(
    val id: String,
    val pair: String,
    val side: String,
    val state: BrokerOrderState,
)

// Rows must be read from the current, verified QT Demo order view.
internal class DemoOrderReconciler(private val gate: DemoOrderGate) {
    fun reconcile(rows: List<BrokerOrderRow>): Boolean {
        val pending = gate.pendingAttempt() ?: return false
        val orderId = pending.brokerOrderId ?: return false
        val row = rows.singleOrNull { it.id == orderId } ?: return false
        if (row.pair != pending.pair || row.side != pending.side ||
            row.state != BrokerOrderState.CLOSED) return false

        return gate.resolveVerifiedClose(orderId)
    }
}
