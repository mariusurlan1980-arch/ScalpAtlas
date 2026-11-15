package com.scalpatlas.fresh

import android.os.Looper

/** Entry point for the in-app engine. All broker access stays on the main thread. */
internal class LiveOrderBridge {
    fun pollOrderStatus(): String {
        checkMainThread()
        val session = activeDemoSession() ?: return "DEMO_UNAVAILABLE"
        return session.pollOrderStatus().name
    }

    fun readActiveChartPair(): String? {
        checkMainThread()
        return activeDemoSession()?.readActiveChartPair()
    }

    fun readM5Chart(): AccessibleM5Frame? {
        checkMainThread()
        return activeDemoSession()?.readM5Chart()
    }

    fun selectPairOnVerifiedDemo(pair: String, activePair: String?): Boolean {
        checkMainThread()
        return activeDemoSession()?.selectVisiblePair(pair, activePair) ?: false
    }

    fun submitOrderOnVerifiedDemo(
        attemptId: String,
        pair: String,
        side: String,
        expiryMinutes: Int,
        confirmedAt: Long,
    ): DemoClickResult {
        checkMainThread()
        val now = System.currentTimeMillis()
        if (confirmedAt <= 0 || confirmedAt > now || now - confirmedAt > 3_500) {
            return DemoClickResult.BLOCKED
        }

        val session = activeDemoSession() ?: return DemoClickResult.BLOCKED
        return session.submit(attemptId, pair, side, expiryMinutes)
    }

    private fun activeDemoSession(): DemoBrokerSession? =
        ScalpAtlasAccessibilityService.connected?.activeDemoSession()
            ?.takeIf { it.accountState() == BrokerAccount.DEMO }

    private fun checkMainThread() {
        check(Looper.myLooper() == Looper.getMainLooper())
    }
}
