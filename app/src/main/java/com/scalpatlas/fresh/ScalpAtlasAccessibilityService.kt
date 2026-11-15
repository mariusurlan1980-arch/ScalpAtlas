package com.scalpatlas.fresh

import android.accessibilityservice.AccessibilityService
import android.os.Looper
import android.view.accessibility.AccessibilityEvent

class ScalpAtlasAccessibilityService : AccessibilityService() {
    private var brokerPackage: String? = null
    private var session: DemoBrokerSession? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        connected = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val activePackage = event?.packageName?.toString() ?: return
        if (activePackage !in supportedPackages) return
        val now = android.os.SystemClock.elapsedRealtime()
        if (now - lastDiagnosticAt < 1_000L) return
        lastDiagnosticAt = now
        val active = activeDemoSession()
        chartDiagnostic = when {
            active?.accountState() != BrokerAccount.DEMO -> ChartDiagnostic.DEMO_UNCONFIRMED
            active.readM5Chart() == null -> ChartDiagnostic.M5_UNAVAILABLE
            else -> ChartDiagnostic.M5_AVAILABLE
        }
    }

    internal enum class ChartDiagnostic { WAITING, DEMO_UNCONFIRMED, M5_UNAVAILABLE, M5_AVAILABLE }

    internal var chartDiagnostic = ChartDiagnostic.WAITING
        private set
    private var lastDiagnosticAt = -1_000L

    override fun onInterrupt() {
        session = null
        brokerPackage = null
        chartDiagnostic = ChartDiagnostic.WAITING
        lastDiagnosticAt = -1_000L
    }

    override fun onDestroy() {
        onInterrupt()
        if (connected === this) connected = null
        super.onDestroy()
    }

    // Called on the main thread by the local app bridge. The persistent
    // order gate is shared across supported broker packages.
    internal fun activeDemoSession(): DemoBrokerSession? {
        check(Looper.myLooper() == Looper.getMainLooper())
        val activePackage = rootInActiveWindow?.packageName?.toString()
        if (activePackage == null || activePackage !in supportedPackages) return null
        if (activePackage != brokerPackage) {
            session = DemoBrokerSession(this, activePackage)
            brokerPackage = activePackage
        }
        return session
    }

    companion object {
        private val supportedPackages = setOf("com.pocketoption.broker", "com.potradeweb")

        internal var connected: ScalpAtlasAccessibilityService? = null
            private set
    }
}
