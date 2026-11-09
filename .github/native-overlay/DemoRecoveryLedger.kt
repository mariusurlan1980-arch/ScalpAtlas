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
    // 474: In FIXED $1 QT DEMO mode, prior experimental Martingale losses
    // remain historical data, never permission to raise the broker stake.
    // A pending broker OPEN ID still blocks before reaching this branch.
    if (prefs.getBoolean("fixedOneDollarMode474", false)) {
      if (payoutPercent !in MIN_PAYOUT_PERCENT..100)
        return Quote(null, 0L, "PAYOUT DEMO NECONFIRMAT")
      return Quote(BASE_STAKE_CENTS, 0L, "MIZĂ FIXĂ DEMO 1 USD • FĂRĂ MG")
    }
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
   * Broker-chart settlement 475: verified two-frame notice only.
   * This never infers outcome from price direction or elapsed time.
   */
  @Synchronized
  fun settleExplicitChartResult471(
    brokerAccountKey: String,
    localAttemptKey: String,
    stakeCents: Long,
    payoutPercent: Int,
    netProfitCents: Long,
    twoFreshMatchingBrokerResultScreens: Boolean
  ): Boolean {
    if (!twoFreshMatchingBrokerResultScreens ||
        !brokerAccountKey.startsWith("QT_DEMO:") ||
        brokerAccountKey.length < 10 ||
        localAttemptKey.length !in 15..180 ||
        prefs.getString("pendingPositionId", null) != null ||
        stakeCents !in BASE_STAKE_CENTS..MAX_SINGLE_STAKE_CENTS ||
        payoutPercent !in MIN_PAYOUT_PERCENT..100) return false
    val account = prefs.getString("accountKey", null)
    if (account != null && account != brokerAccountKey) return false
    val receipt = "CHART471:" + localAttemptKey
    val seen = prefs.getStringSet("seenClosedReceipts", emptySet()).orEmpty()
    // Idempotent retry after a crash between ledger commit and gesture
    // marker cleanup. Never book the same screenshot result twice.
    if (seen.contains(receipt)) return true

    val maxWin = (stakeCents * payoutPercent + 99L) / 100L
    if (!(netProfitCents == -stakeCents ||
          (netProfitCents > 0 &&
            netProfitCents in (maxWin - 1L)..maxWin))) return false
    if (quote(payoutPercent).stakeCents != stakeCents) return false

    val oldLoss = prefs.getLong("unrecoveredLossCents", 0L)
    val oldTarget = prefs.getLong("remainingProfitTargetCents", 0L)
    val wasRecovering = oldLoss > 0L || oldTarget > 0L
    if (oldTarget !in 0L..TARGET_PROFIT_CENTS) return false
    val newLoss = if (netProfitCents < 0L) oldLoss - netProfitCents
      else (oldLoss - netProfitCents).coerceAtLeast(0L)
    val targetBefore = if (netProfitCents < 0L && !wasRecovering)
      TARGET_PROFIT_CENTS else oldTarget
    val excessProfit = if (netProfitCents > 0L)
      (netProfitCents - oldLoss).coerceAtLeast(0L) else 0L
    val remainingTarget = (targetBefore - excessProfit).coerceAtLeast(0L)
    val fullyRecovered = wasRecovering && netProfitCents > 0L &&
      newLoss == 0L && remainingTarget == 0L
    val completed = if (fullyRecovered || (!wasRecovering && netProfitCents > 0L)) 0
      else prefs.getInt("completedCycleTrades", 0) + 1
    return prefs.edit()
      .putString("accountKey", brokerAccountKey)
      .putLong("unrecoveredLossCents", newLoss)
      .putLong("remainingProfitTargetCents", remainingTarget)
      .putInt("completedCycleTrades", completed)
      .putBoolean("halted", newLoss >= MAX_CYCLE_LOSS_CENTS ||
        completed >= MAX_CYCLE_TRADES)
      .putBoolean("pendingBaseStakeReset",
        prefs.getBoolean("pendingBaseStakeReset", false) || fullyRecovered)
      .putStringSet("seenClosedReceipts",
        (seen + receipt).toList().takeLast(100).toSet())
      .commit()
  }

  /**
   * 437: Strict reconciliation for a previous DEMO gesture whose OPEN
   * accessibility receipt could not be captured before its 5-minute close.
   * CLOSED proof alone is insufficient: the caller must separately verify
   * the same broker account, matching pair/stake/payout, the opening time
   * against the persisted original gesture, two independent matching
   * detail reads and two explicit NO-OPEN history reads.
   * No shortcut for QT REAL or for a stale/unknown attempt.
   */
  @Synchronized
  fun reconcileSettledDemoWithMissingOpen437(
    brokerAccountKey: String,
    positionId: String,
    stakeCents: Long,
    payoutPercent: Int,
    netProfitCents: Long,
    uniqueClosedDetailReadTwice: Boolean,
    zeroOpenReadTwice: Boolean,
    exactPriorGestureTimeMatched: Boolean
  ): Boolean {
    if (!uniqueClosedDetailReadTwice || !zeroOpenReadTwice ||
        !exactPriorGestureTimeMatched ||
        !brokerAccountKey.startsWith("QT_DEMO:") ||
        positionId.isBlank() ||
        prefs.getString("pendingPositionId", null) != null ||
        prefs.getStringSet("seenClosedReceipts", emptySet()).orEmpty()
          .contains(positionId + ":CLOSED") ||
        quote(payoutPercent).stakeCents != stakeCents)
      return false
    val savedOpen = onVerifiedDemoOpened(
      brokerAccountKey, positionId, stakeCents, payoutPercent,
      receiptIndependentlyVerified = true
    )
    if (!savedOpen) return false
    // Only a fully verified matching CLOSED receipt may change the next
    // stake. If persistence fails, keep the pending OPEN ID and block.
    return onVerifiedDemoClosed(
      brokerAccountKey, positionId, positionId + ":CLOSED", netProfitCents,
      receiptIndependentlyVerified = true
    )
  }

  /**
   * 444: Idempotent recovery from a partial two-store commit. Settlement can
   * be successfully written to THIS ledger before the distinct persisted
   * Android-attempt flag is cleared. Retrying must not book WIN/LOSS twice.
   * Caller MUST independently prove the exact original gesture, CLOSED
   * detail twice and empty OPEN tab twice before consulting this check.
   * A previously recorded UUID is NOT permission to submit an order.
   */
  @Synchronized
  fun alreadySettledClosedReceipt444(
    brokerAccountKey: String,
    positionId: String
  ): Boolean {
    if (!brokerAccountKey.startsWith("QT_DEMO:") ||
        brokerAccountKey != prefs.getString("accountKey", null) ||
        positionId.isBlank() ||
        prefs.getString("pendingPositionId", null) != null)
      return false
    val seen = prefs.getStringSet("seenClosedReceipts", emptySet()).orEmpty()
    return seen.contains(positionId + ":CLOSED")
  }

  /**
   * Trusted receipt correlation only. These are persisted by the ledger,
   * not guessed from a gesture, the clock or a changed demo balance.
   */
  @Synchronized
  fun verifiedOpenPositionId429(): String? =
    prefs.getString("pendingPositionId", null)

  @Synchronized
  fun verifiedOpenStakeCents429(): Long? =
    if (verifiedOpenPositionId429() != null)
      prefs.getLong("pendingStakeCents", -1L).takeIf { it > 0L }
    else null

  @Synchronized
  fun isRecovering429(): Boolean =
    !prefs.getBoolean("fixedOneDollarMode474", false) &&
      (prefs.getLong("unrecoveredLossCents", 0L) > 0L ||
        prefs.getLong("remainingProfitTargetCents", 0L) > 0L)

  @Synchronized
  fun isFixedOneDollarMode474(): Boolean =
    prefs.getBoolean("fixedOneDollarMode474", false)

  /**
   * 474: Explicitly retire the *stake progression* persisted by 468-472.
   * Requires same-screen verified QT DEMO and successful READ-ONLY 1 USD
   * broker preflight; no known broker OPEN ID may be pending.
   * Does NOT alter the separate attempted gesture marker, gate state,
   * broker order history, position ID, or Android cooldown.
   */
  @Synchronized
  fun retireExperimentalMartingale474(
    verifiedQtDemo: Boolean,
    brokerPreflightOneDollar: Boolean
  ): Boolean {
    if (!verifiedQtDemo || !brokerPreflightOneDollar ||
        prefs.getString("pendingPositionId", null) != null)
      return false
    if (isFixedOneDollarMode474()) return true
    return prefs.edit()
      .putBoolean("fixedOneDollarMode474", true)
      .putLong("unrecoveredLossCents", 0L)
      .putLong("remainingProfitTargetCents", 0L)
      .putInt("completedCycleTrades", 0)
      .putBoolean("pendingBaseStakeReset", false)
      .putBoolean("halted", false)
      .commit()
  }

  /**
   * Opt back into DEMO-only experimental MG after 474 fixed-stake migration.
   * Only at a clean cycle boundary and after verified broker $1 preflight.
   * Never clear pending broker IDs or old Android-gesture markers here.
   */
  @Synchronized
  fun enableVerifiedDemoMartingale475(
    verifiedQtDemo: Boolean,
    verifiedOneDollarPreflight: Boolean,
    noUnresolvedGesture: Boolean
  ): Boolean {
    if (!verifiedQtDemo || !verifiedOneDollarPreflight ||
        !noUnresolvedGesture ||
        prefs.getString("pendingPositionId", null) != null ||
        isRecovering429()) return false
    if (!prefs.getBoolean("fixedOneDollarMode474", false)) return true
    return prefs.edit()
      .putBoolean("fixedOneDollarMode474", false)
      .putLong("unrecoveredLossCents", 0L)
      .putLong("remainingProfitTargetCents", 0L)
      .putInt("completedCycleTrades", 0)
      .putBoolean("pendingBaseStakeReset", false)
      .putBoolean("halted", false)
      .commit()
  }

  /**
   * A confirmed profitable CLOSED receipt has repaid the net cycle deficit.
   * The DEMO broker field must then be read back as exactly $1.00 before
   * the cycle is considered restored. Never infer this from a gesture.
   */
  @Synchronized
  fun needsBaseStakeReset(): Boolean =
    !prefs.getBoolean("fixedOneDollarMode474", false) &&
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
