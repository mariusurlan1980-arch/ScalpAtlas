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

  @Synchronized
  fun uncertainResult() {
    if (state != State.READY) state = State.UNKNOWN
  }

  @Synchronized
  fun brokerConfirmedClosed(positionId: String, noOpenPositions: Boolean): Boolean {
    if (state != State.OPEN || currentId != positionId || !noOpenPositions) return false
    currentId = null
    state = State.READY
    return true
  }

  @Synchronized
  fun resetOnNewVerifiedAccount() {
    currentId = null
    state = State.UNKNOWN
  }
}
