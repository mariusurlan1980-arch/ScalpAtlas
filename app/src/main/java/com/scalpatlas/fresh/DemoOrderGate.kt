package com.scalpatlas.fresh

import android.content.SharedPreferences
import android.os.Looper

internal data class PendingDemoAttempt(
    val id: String,
    val pair: String?,
    val side: String?,
    val submittedAtMillis: Long?,
    val brokerOrderId: String?,
)

internal class DemoOrderGate(
    private val preferences: SharedPreferences,
    private val button: DemoOrderButton,
    private val account: ForegroundBrokerAccount,
) {
    private val pendingKey = "pending_demo_attempt"
    private val pairKey = "pending_demo_pair"
    private val sideKey = "pending_demo_side"
    private val timeKey = "pending_demo_submitted_at"
    private val brokerOrderKey = "pending_demo_broker_order"

    fun pendingAttempt(): PendingDemoAttempt? {
        val id = preferences.getString(pendingKey, null) ?: return null
        return PendingDemoAttempt(
            id,
            preferences.getString(pairKey, null),
            preferences.getString(sideKey, null),
            preferences.getLong(timeKey, 0).takeIf { it > 0 },
            preferences.getString(brokerOrderKey, null),
        )
    }

    fun submit(attemptId: String, pair: String, side: String): DemoClickResult {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (attemptId.isBlank() || pendingAttempt() != null ||
            account.read() != BrokerAccount.DEMO) return DemoClickResult.BLOCKED

        if (!preferences.edit()
                .putString(pendingKey, attemptId)
                .putString(pairKey, pair)
                .putString(sideKey, side)
                .putLong(timeKey, System.currentTimeMillis())
                .commit()
        ) return DemoClickResult.BLOCKED

        val result = button.submit(pair, side)
        if (result == DemoClickResult.BLOCKED) clearPending()
        return result
    }

    // The broker reader must independently correlate this open receipt to
    // the submission before binding its broker ID.
    fun bindVerifiedOpenOrder(attemptId: String, brokerOrderId: String): Boolean {
        check(Looper.myLooper() == Looper.getMainLooper())
        val pending = pendingAttempt() ?: return false
        if (pending.id != attemptId || brokerOrderId.isBlank() ||
            account.read() != BrokerAccount.DEMO) return false
        if (pending.brokerOrderId != null) return pending.brokerOrderId == brokerOrderId
        return preferences.edit().putString(brokerOrderKey, brokerOrderId).commit()
    }

    fun resolveVerifiedClose(brokerOrderId: String): Boolean {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (brokerOrderId.isBlank() || pendingAttempt()?.brokerOrderId != brokerOrderId ||
            account.read() != BrokerAccount.DEMO) return false
        return clearPending()
    }

    // Only an explicit rejection correlated to the submission can resolve
    // an unbound attempt. A missing open order is insufficient evidence.
    fun resolveVerifiedRejection(attemptId: String): Boolean {
        check(Looper.myLooper() == Looper.getMainLooper())
        val pending = pendingAttempt() ?: return false
        if (pending.id != attemptId || pending.brokerOrderId != null ||
            account.read() != BrokerAccount.DEMO) return false
        return clearPending()
    }

    private fun clearPending(): Boolean = preferences.edit()
        .remove(pendingKey)
        .remove(pairKey)
        .remove(sideKey)
        .remove(timeKey)
        .remove(brokerOrderKey)
        .commit()
}
