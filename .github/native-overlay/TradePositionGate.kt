package com.scalpatlas.app

/**
 * Conservative position-state machine used by Scalp Atlas 398.
 * The controller does not place orders or access a broker.
 *
 * Each position must be confirmed closed by the broker before the
 * next signal can be considered eligible for execution.
 */
class TradePositionGate {
  enum class State { READY, SUBMITTING, OPEN, UNKNOWN }
  private var state: State = State.READY
  private var currentId: String? = null

  @Synchronized
  fun state(): State = state

  @Synchronized
  fun beginAttempt(): Boolean {
    if (state != State.READY) return false
    state = State.SUBMITTING
    return true
  }

  @Synchronized
  fun accepted(positionId: String?): Boolean {
    if (state != State.SUBMITTING) return false
    if (positionId.isNullOrBlank()) {
      state = State.UNKNOWN
      return false
    }
    currentId = positionId
    state = State.OPEN
    return true
  }

  /** No broker call happened, and persistence failed before dispatch.
   * This is the ONLY case where a SUBMITTING attempt can be rolled back.
   */
  @Synchronized
  fun cancelBeforeDispatch(): Boolean {
    if (state != State.SUBMITTING) return false
    currentId = null
    state = State.READY
    return true
  }

  @Synchronized
  fun uncertainResult() {
    if (state != State.READY) state = State.UNKNOWN
  }

  /** A previously attempted gesture has no position ID. Only permit
   * an UNKNOWN state to be resolved after the broker itself has EXPLICITLY
   * shown zero open DEMO positions in two independently sampled reads.
   * Never reset a known OPEN position without its matching broker receipt.
   */
  @Synchronized
  fun brokerVerifiedEmptyDemoReview(twoIndependentReads: Boolean): Boolean {
    if (!twoIndependentReads) return false
    if (state != State.UNKNOWN && state != State.READY) return false
    currentId = null
    state = State.READY
    return true
  }

  @Synchronized
  fun brokerConfirmedClosed(positionId: String, noOpenPositions: Boolean): Boolean {
    if (state != State.OPEN || currentId != positionId || !noOpenPositions) return false
    currentId = null
    state = State.READY
    return true
  }

  /**
   * 464: BOUNDED QT DEMO-ONLY testing after an unverified Android tap.
   * This is deliberately NOT broker proof of closure, not an accounting
   * settlement, and not a way to clear a known OPEN position. It only
   * permits the unknown-gesture pilot to continue at fixed $1 after the
   * caller checked the recorded 5-minute test window plus a safety buffer.
   * The caller enforces the finite attempt cap and fresh QT Demo preflight.
   */
  @Synchronized
  fun releaseUnknownGestureForExpiredDemoPilot464(
    elapsedWindowVerified: Boolean,
    freshDemoPreflightVerified: Boolean,
    limitedPilotCapacityAvailable: Boolean
  ): Boolean {
    if (!elapsedWindowVerified || !freshDemoPreflightVerified ||
        !limitedPilotCapacityAvailable ||
        state == State.SUBMITTING || state == State.OPEN) return false
    // UNKNOWN means Android's physical tap was attempted but no broker ID
    // was captured. Never turn this into a WIN, LOSS or broker CLOSED proof.
    currentId = null
    state = State.READY
    return true
  }

  /**
   * 471: a QT DEMO broker-rendered CLOSED-trade notification was matched to
   * the one saved gesture via two separate fresh screenshots. This is NOT
   * a timeout release or a shortcut for a known broker OPEN ID.
   * An unknown Android gesture is the only state this can resolve.
   */
  @Synchronized
  fun chartDemoClosedNoticeVerified471(twoBrokerFramesVerified: Boolean): Boolean {
    if (!twoBrokerFramesVerified || state != State.UNKNOWN ||
        currentId != null) return false
    state = State.READY
    return true
  }

  @Synchronized
  fun resetOnNewVerifiedAccount() {
    currentId = null
    state = State.UNKNOWN
  }
}
