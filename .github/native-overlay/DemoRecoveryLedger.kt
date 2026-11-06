package com.scalpatlas.app

import android.content.SharedPreferences

/**
 * Scalp Atlas 422: DEMO-only recovery accounting for proposed $82.72 bankroll. This class NEVER touches
 * broker controls. It cannot infer WIN/LOSS from SHOCK %, a gesture callback,
 * a timer, or an empty Open tab.
 *
 * A verified opening receipt and a matching, unique CLOSED receipt are
 * prerequisites before any accumulated loss can change. The broker adapter
 * must independently authenticate these receipts before calling the methods.
 * Recovery is capped; it is neither guaranteed nor available on QT Real.
 */
class DemoRecoveryLedger(private val prefs: SharedPreferences) {
  data class Quote(
    val stakeCents: Long?,
    val lossCents: Long,
    val reason: String
  )

  companion object {
    const val BASE_STAKE_CENTS = 100L
    const val TARGET_PROFIT_CENTS = 92L
    const val PROPOSED_DEMO_BANKROLL_CENTS = 8272L // Hypothetical DEMO bankroll; not broker funding
    const val MAX_CYCLE_LOSS_CENTS = 8272L // Never assume broker balance is verified
    const val MAX_SINGLE_STAKE_CENTS = 3964L // Sixth step only, never 82.72 USD seventh step
    const val MAX_CYCLE_TRADES = 6 // After six losses, $100 cannot fund step seven
    const val MIN_PAYOUT_PERCENT = 92
  }

  /**
   * Ceil((unrecovered losses + desired net profit) / payout).
   * For 92%: 1.00 LOSS -> 2.09, then 4.36, then 9.10.
   * Stop BEFORE submitting a stake that could breach the cycle risk limit.
   */
  @Synchronized
  fun quote(payoutPercent: Int): Quote {
    val lost = prefs.getLong("unrecoveredLossCents", 0L)
    val completed = prefs.getInt("completedCycleTrades", 0)
    val profitRemaining = prefs.getLong("remainingProfitTargetCents", 0L)
    if (prefs.getString("pendingPositionId", null) != null)
      return Quote(null, lost, "REZULTATUL POZIȚIEI ESTE NECONFIRMAT")
    if (prefs.getBoolean("pendingBaseStakeReset", false))
      return Quote(null, lost, "RESET 1 USD NECONFIRMAT PE BROKER")
    if (prefs.getBoolean("halted", false) || completed >= MAX_CYCLE_TRADES)
      return Quote(null, lost, "RECUPERARE OPRITĂ • MAXIMUM 6 TRANZACȚII")
    if (payoutPercent !in MIN_PAYOUT_PERCENT..100)
      return Quote(null, lost, "PAYOUT NECONFIRMAT ≥92%")
    if (lost !in 0L..MAX_CYCLE_LOSS_CENTS)
      return Quote(null, lost, "PIERDERE NECONFORMĂ • OPRIT")
    if (profitRemaining !in 0L..TARGET_PROFIT_CENTS)
      return Quote(null, lost, "PROFITUL ȚINTĂ NECONFORM • OPRIT")
    val outstanding = lost + profitRemaining
    val stake = if (outstanding == 0L) BASE_STAKE_CENTS
      else ((outstanding * 100L + payoutPercent - 1L) / payoutPercent)
        .coerceAtLeast(BASE_STAKE_CENTS)
    if (stake > MAX_SINGLE_STAKE_CENTS || lost + stake > PROPOSED_DEMO_BANKROLL_CENTS)
      return Quote(null, lost, "SOLD IPOTETIC 82,72 USD INSUFICIENT • NU MĂRESC MIZA")
    return Quote(stake, lost, "CALCUL DEMO • NECESITĂ DOVADĂ DE LA BROKER")
  }

  /**
   * Records ONLY a uniquely identified, broker-verified QT Demo open receipt.
   * This is not wired to an Android gesture: gesture dispatch != acceptance.
   */
  @Synchronized
  fun onVerifiedDemoOpened(
    brokerAccountKey: String,
    positionId: String,
    stakeCents: Long,
    payoutPercent: Int,
    receiptIndependentlyVerified: Boolean
  ): Boolean {
    if (!receiptIndependentlyVerified ||
        !brokerAccountKey.startsWith("QT_DEMO:") ||
        brokerAccountKey.length < 10 || positionId.isBlank())
      return false
    val oldAccount = prefs.getString("accountKey", null)
    if (oldAccount != null && oldAccount != brokerAccountKey) return false
    if (quote(payoutPercent).stakeCents != stakeCents) return false
    return prefs.edit()
      .putString("accountKey", brokerAccountKey)
      .putString("pendingPositionId", positionId)
      .putLong("pendingStakeCents", stakeCents)
      .putInt("pendingPayoutPercent", payoutPercent)
      .commit()
  }

  /**
   * No change to losses based solely on zero open positions. CLOSED receipt
   * must exactly match the position, account and uniquely verified receipt ID.
   */
  @Synchronized
  fun onVerifiedDemoClosed(
    brokerAccountKey: String,
    positionId: String,
    closedReceiptId: String,
    netProfitCents: Long,
    receiptIndependentlyVerified: Boolean
  ): Boolean {
    if (!receiptIndependentlyVerified ||
        brokerAccountKey != prefs.getString("accountKey", null) ||
        positionId != prefs.getString("pendingPositionId", null) ||
        positionId.isBlank() || closedReceiptId.isBlank())
      return false
    val seen = prefs.getStringSet("seenClosedReceipts", emptySet()).orEmpty()
    if (closedReceiptId in seen) return false
    val stake = prefs.getLong("pendingStakeCents", -1L)
    val payout = prefs.getInt("pendingPayoutPercent", -1)
    if (stake <= 0 || payout !in MIN_PAYOUT_PERCENT..100) return false
    // Fixed-risk binary option receipt sanity limits; fail on implausible P/L.
    if (netProfitCents < -stake ||
        netProfitCents > (stake * payout + 99L) / 100L)
      return false
    val priorLoss = prefs.getLong("unrecoveredLossCents", 0L)
    val priorTarget = prefs.getLong("remainingProfitTargetCents", 0L)
    if (priorTarget !in 0L..TARGET_PROFIT_CENTS) return false
    val wasRecovering = priorLoss > 0L || priorTarget > 0L
    val newLoss = if (netProfitCents < 0L) priorLoss - netProfitCents
      else (priorLoss - netProfitCents).coerceAtLeast(0L)
    // The first LOSS starts a new recovery cycle with a net-positive target.
    // A WIN must repay the actual accumulated deficit FIRST; only its
    // remainder is available to satisfy the 92-cent target. Break-even
    // is not a profit and MUST NOT reset the stake to one dollar.
    val targetBeforeSettlement = if (netProfitCents < 0L && !wasRecovering)
      TARGET_PROFIT_CENTS else priorTarget
    val excessProfit = if (netProfitCents > 0L)
      (netProfitCents - priorLoss).coerceAtLeast(0L) else 0L
    val remainingTarget = (targetBeforeSettlement - excessProfit).coerceAtLeast(0L)
    val fullyRecovered = wasRecovering && netProfitCents > 0L &&
      newLoss == 0L && remainingTarget == 0L
    val resetRequired = prefs.getBoolean("pendingBaseStakeReset", false) ||
      fullyRecovered
    val completed = if (fullyRecovered || (!wasRecovering && netProfitCents > 0L)) 0
      else prefs.getInt("completedCycleTrades", 0) + 1
    val seenUpdated = (seen + closedReceiptId).toList().takeLast(100).toSet()
    return prefs.edit()
      .putLong("unrecoveredLossCents", newLoss)
      .putLong("remainingProfitTargetCents", remainingTarget)
      .putInt("completedCycleTrades", completed)
      .putBoolean("halted", newLoss >= MAX_CYCLE_LOSS_CENTS || completed >= MAX_CYCLE_TRADES)
      .putBoolean("pendingBaseStakeReset", resetRequired)
      .remove("pendingPositionId")
      .remove("pendingStakeCents")
      .remove("pendingPayoutPercent")
      .putStringSet("seenClosedReceipts", seenUpdated)
      .commit()
  }

  /**
   * A confirmed profitable CLOSED receipt has repaid the net cycle deficit.
   * The DEMO broker field must then be read back as exactly $1.00 before
   * the cycle is considered restored. Never infer this from a gesture.
   */
  @Synchronized
  fun needsBaseStakeReset(): Boolean =
    prefs.getBoolean("pendingBaseStakeReset", false) &&
      prefs.getString("pendingPositionId", null) == null &&
      prefs.getLong("unrecoveredLossCents", 0L) == 0L &&
      prefs.getLong("remainingProfitTargetCents", 0L) == 0L &&
      !prefs.getBoolean("halted", false)

  @Synchronized
  fun acknowledgeVerifiedBaseStakeReset(brokerReadBackOneDollar: Boolean): Boolean {
    if (!brokerReadBackOneDollar || !needsBaseStakeReset()) return false
    return prefs.edit().putBoolean("pendingBaseStakeReset", false).commit()
  }

  @Synchronized
  fun diagnostic(payoutPercent: Int): String {
    if (needsBaseStakeReset())
      return "RECUPERARE CONFIRMATĂ • RESTABILESC SUMA DEMO 1 USD"
    val next = quote(payoutPercent)
    return if (next.stakeCents == null)
      "RECUPERARE DEMO OPRITĂ: " + next.reason
    else "RECUPERARE DEMO PLAN: " +
      (next.stakeCents / 100L) + "." +
      (next.stakeCents % 100L).toString().padStart(2, '0') +
      " USD • PASUL " + (prefs.getInt("completedCycleTrades", 0) + 1) +
      "/6 • PIERDERI " + next.lossCents + " cenți • PROFIT ȚINTĂ RĂMAS " +
      prefs.getLong("remainingProfitTargetCents", 0L) +
      " cenți • NUMAI CU RECEIPT"
  }
}
