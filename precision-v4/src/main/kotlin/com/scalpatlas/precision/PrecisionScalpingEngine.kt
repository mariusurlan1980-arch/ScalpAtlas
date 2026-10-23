package com.scalpatlas.precision

/** Pure signal decision logic. Wire to the existing Android chart extractor and alert service. */
enum class Direction { BUY, SELL, WAIT }
enum class CandleColor { GREEN, RED, DOJI }
data class ClosedCandle(val closeTimeMs: Long, val color: CandleColor, val isClosed: Boolean)
data class MarketSnapshot(
    val symbol: String,
    val timeframeMinutes: Int,
    val imageReadable: Boolean,
    val candles: List<ClosedCandle>,
    val trend: Direction,
    val structureConfirmed: Boolean,
    val pullbackConfirmed: Boolean,
    val impulseConfirmed: Boolean
)
data class Decision(val direction: Direction, val reason: String, val signalKey: String? = null)

class PrecisionScalpingEngine {
    fun evaluate(s: MarketSnapshot): Decision {
        fun wait(reason: String) = Decision(Direction.WAIT, reason)
        if (s.timeframeMinutes !in setOf(5, 10, 15)) return wait("TIMEFRAME_UNKNOWN")
        if (!s.imageReadable) return wait("IMAGE_UNREADABLE")
        if (s.candles.size < 2) return wait("INSUFFICIENT_CANDLES")
        val last = s.candles.takeLast(2)
        if (last.any { !it.isClosed }) return wait("CANDLE_STILL_OPEN")
        if (last[0].closeTimeMs >= last[1].closeTimeMs) return wait("INVALID_CANDLE_TIMESTAMPS")
        val direction = when {
            last.all { it.color == CandleColor.GREEN } -> Direction.BUY
            last.all { it.color == CandleColor.RED } -> Direction.SELL
            else -> return wait("TWO_CANDLES_NOT_ALIGNED")
        }
        if (s.trend != direction) return wait("TREND_NOT_ALIGNED")
        if (!s.structureConfirmed) return wait("STRUCTURE_UNCONFIRMED")
        if (!s.pullbackConfirmed) return wait("PULLBACK_UNCONFIRMED")
        if (!s.impulseConfirmed) return wait("IMPULSE_UNCONFIRMED")
        val key = listOf(s.symbol.trim().uppercase(), s.timeframeMinutes, last[1].closeTimeMs, direction).joinToString(":")
        return Decision(direction, "CONFIRMED", key)
    }
}

/** One alert per confirmed setup; persist emitted keys across service restarts in production. */
class SignalAlertGate {
    private val emitted = mutableSetOf<String>()
    fun shouldBeep(decision: Decision, bellEnabled: Boolean): Boolean {
        val key = decision.signalKey ?: return false
        if (!bellEnabled || decision.direction == Direction.WAIT) return false
        return emitted.add(key)
    }
}
