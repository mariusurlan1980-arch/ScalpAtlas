package com.scalpatlas.app

import android.accessibilityservice.AccessibilityService

/**
 * 563: staged QT DEMO stake-field edit after an independently proven LOSS.
 *
 * IMPORTANT:
 * - This class is not called by the currently installed robot and does NOT
 *   turn a SHOCK/MINMAX signal into an order.
 * - Caller must provide independently verified OPEN/CLOSED receipts and two
 *   independent ZERO-OPEN checks; neither a 5m timer nor Android click counts.
 * - Editing a field is NOT BUY/SELL and cannot authorize a new order.
 * - Keep the 561 three-LOSS risk-stop and legacy safe stake ceiling, even
 *   though the separate 562 simulator describes theoretical ten-step losses.
 */
internal object DemoLossStakeEditor563 {
  private val theoreticalStakeCents = longArrayOf(
    109L, 228L, 475L, 992L, 2070L, 4320L, 9016L, 18816L, 39268L, 81950L
  )
  private const val MAX_STAKE_CENTS_SAFE = 3964L
  // Planning ceiling, NOT a broker balance confirmation.
  private const val ALLOCATED_DEMO_BUDGET_CENTS_564 = 157044L
  private const val MAX_LOSSES_BEFORE_RISK_STOP = 3
  private const val MAX_PROOF_AGE_MS = 5_000L

  data class VerifiedDemoLoss563(
    val brokerAccountKey: String,
    val pair: String,
    val positionId: String,
    val uniqueClosedReceiptId: String,
    val stakeCents: Long,
    val netCents: Long,
    val payoutPercent: Int,
    val expiryMinutes: Int,
    val openedProofVerified: Boolean,
    val closedProofReadTwice: Boolean,
    val zeroOpenReadTwice: Boolean
  )

  data class StakeDecision563(
    val nextStakeCents: Long?,
    val reason: String
  )

  /**
   * Ordered verified LOSS receipts in ONE martingale series. If the first
   * trade wasn't exactly 1.09 USD, the ten-level 562 quote cannot be used.
   */
  fun decideNextStake(
    losses: List<VerifiedDemoLoss563>,
    expectedBrokerAccountKey: String,
    proofAtMs: Long,
    nowMs: Long,
    riskPause561: Boolean
  ): StakeDecision563 {
    fun block(reason: String) = StakeDecision563(null, "FĂRĂ MODIFICARE • " + reason)
    if (riskPause561) return block("PAUZĂ RISC 561")
    if (expectedBrokerAccountKey.isBlank() ||
        !expectedBrokerAccountKey.startsWith("QT_DEMO:"))
      return block("CONTUL DEMO NECONFIRMAT")
    if (nowMs < proofAtMs || proofAtMs <= 0L ||
        nowMs - proofAtMs > MAX_PROOF_AGE_MS)
      return block("DOVADĂ EXPIRATĂ")
    if (losses.isEmpty()) return block("NU EXISTĂ LOSS CONFIRMAT")
    if (losses.size >= MAX_LOSSES_BEFORE_RISK_STOP)
      return block("TREI LOSS CONSECUTIVE • STOP")

    val seenPositions = HashSet<String>()
    val seenClosed = HashSet<String>()
    for (i in losses.indices) {
      val r = losses[i]
      if (r.brokerAccountKey != expectedBrokerAccountKey ||
          r.pair.isBlank() || r.positionId.isBlank() ||
          r.uniqueClosedReceiptId.isBlank() ||
          !seenPositions.add(r.positionId) ||
          !seenClosed.add(r.uniqueClosedReceiptId) ||
          !r.openedProofVerified || !r.closedProofReadTwice ||
          !r.zeroOpenReadTwice ||
          r.payoutPercent != 92 || r.expiryMinutes != 5 ||
          r.stakeCents != theoreticalStakeCents[i] ||
          r.netCents != -r.stakeCents)
        return block("REZULTAT LOSS / MIZĂ / ID NECONFIRMAT")
    }
    val next = theoreticalStakeCents[losses.size]
    // 564: do not attempt to consume more than the user's planned DEMO budget.
    // Actual broker balance is independently checked by DemoStakeEditor.inspect.
    val accumulatedLosses = losses.sumOf { it.stakeCents }
    if (accumulatedLosses + next > ALLOCATED_DEMO_BUDGET_CENTS_564)
      return block("BUGET PLANIFICAT 1.570,44 USD INSUFICIENT")
    if (next !in 100L..MAX_STAKE_CENTS_SAFE)
      return block("MIZĂ DEPĂȘEȘTE LIMITA ANDROID 39,64 USD")
    return StakeDecision563(next, "MIZĂ QT DEMO DUPĂ LOSS • NUMAI EDITARE, FĂRĂ ORDIN")
  }

  /**
   * Exact broker amount editor is ALREADY implemented in DemoStakeEditor.
   * This helper is intentionally not wired to an automatic Android callback:
   * a verified broker proof adapter and explicit opt-in UI are still needed.
   */
  @Synchronized
  fun editAfterVerifiedLossOnly(
    svc: AccessibilityService,
    losses: List<VerifiedDemoLoss563>,
    expectedBrokerAccountKey: String,
    pairSelected: String,
    proofAtMs: Long,
    nowMs: Long,
    riskPause561: Boolean,
    stillSameDemoPair: () -> Boolean,
    stillZeroOpenProven: () -> Boolean
  ): String {
    val decision = decideNextStake(
      losses, expectedBrokerAccountKey, proofAtMs, nowMs, riskPause561
    )
    val amount = decision.nextStakeCents ?: return decision.reason
    if (pairSelected.isBlank() || !stillSameDemoPair() || !stillZeroOpenProven())
      return "FĂRĂ MODIFICARE • PERECHEA SAU ZERO DESCHISE NECONFIRMATE"
    return DemoStakeEditor.setExactDemoStake(svc, {
      stillSameDemoPair() && stillZeroOpenProven()
    }, amount)
  }
}
