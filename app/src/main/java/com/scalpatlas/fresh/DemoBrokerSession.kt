package com.scalpatlas.fresh

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.os.Looper

internal enum class DemoOrderStatus { IDLE, AWAITING_BROKER_ID, AWAITING_CLOSE, CLOSED }

// Owned by the Android service for the lifetime of its connection.
// The caller supplies the exact package bound to the broker adapter.
internal class DemoBrokerSession(
    service: AccessibilityService,
    brokerPackage: String,
) {
    private val account = ForegroundBrokerAccount(service, brokerPackage)
    private val gate = DemoOrderGate(
        service.getSharedPreferences("scalpatlas_demo_orders", Context.MODE_PRIVATE),
        DemoOrderButton(service, brokerPackage),
        account,
    )
    private val pairSelector = DemoPairSelector(service, brokerPackage, account)
    private val chartReader = AccessibleM5Chart(service, brokerPackage, pairSelector)
    private val reconciler = DemoOrderReconciler(gate)
    private val receiptReader = ForegroundDemoReceipt(service, brokerPackage, account)

    fun accountState(): BrokerAccount = account.read()

    fun selectVisiblePair(pair: String, activePair: String?): Boolean {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (gate.pendingAttempt() != null) return false
        return pairSelector.selectVisiblePair(pair, activePair)
    }

    fun readActiveChartPair(): String? = pairSelector.readActiveChartPair()

    fun readM5Chart(): AccessibleM5Frame? = chartReader.read()

    fun pendingAttempt(): PendingDemoAttempt? = gate.pendingAttempt()

    fun submit(attemptId: String, pair: String, side: String, expiryMinutes: Int): DemoClickResult {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (expiryMinutes != 5) return DemoClickResult.BLOCKED
        return gate.submit(attemptId, pair, side)
    }

    fun recordVerifiedOpen(attemptId: String, brokerOrderId: String): Boolean =
        gate.bindVerifiedOpenOrder(attemptId, brokerOrderId)

    // This is a candidate, since pair and side alone cannot identify the
    // submission. The caller must independently correlate it before binding.
    fun readVisibleOpenCandidate(): BrokerOrderRow? {
        check(Looper.myLooper() == Looper.getMainLooper())
        val attempt = pendingAttempt() ?: return null
        if (attempt.brokerOrderId != null) return null
        return receiptReader.readOpen()?.takeIf {
            it.pair == attempt.pair && it.side == attempt.side
        }
    }

    fun pollOrderStatus(): DemoOrderStatus {
        check(Looper.myLooper() == Looper.getMainLooper())
        val attempt = pendingAttempt() ?: return DemoOrderStatus.IDLE
        val orderId = attempt.brokerOrderId ?: return DemoOrderStatus.AWAITING_BROKER_ID
        val row = receiptReader.readClosed()
        if (row?.id != orderId || !reconciler.reconcile(listOf(row))) {
            return DemoOrderStatus.AWAITING_CLOSE
        }
        return DemoOrderStatus.CLOSED
    }
}
