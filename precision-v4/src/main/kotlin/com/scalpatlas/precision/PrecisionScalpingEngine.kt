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
data class Decision(val direction: Direction, val reason: String, val signalKey: String? = null, val diagnostics: List<String> = emptyList())

class PrecisionScalpingEngine {
    fun evaluate(s: MarketSnapshot): Decision {
        fun wait(reason: String) = Decision(Direction.WAIT, reason)
        if (s.timeframeMinutes !in setOf(5, 10, 15)) return wait("TIMEFRAME_UNKNOWN")
        if (!s.imageReadable) return wait("IMAGE_UNREADABLE")
        if (s.symbol.isBlank()) return wait("SYMBOL_UNKNOWN")
        if (s.candles.size < 2) return wait("INSUFFICIENT_CANDLES")
        val last = s.candles.takeLast(2)
        if (last.any { !it.isClosed }) return wait("CANDLE_STILL_OPEN")
        if (last[0].closeTimeMs <= 0L || last[0].closeTimeMs >= last[1].closeTimeMs) return wait("INVALID_CANDLE_TIMESTAMPS")
        val intervalMs = s.timeframeMinutes * 60_000L
        if (last[1].closeTimeMs - last[0].closeTimeMs != intervalMs) return wait("CANDLE_INTERVAL_MISMATCH")
        val direction = when {
            last.all { it.color == CandleColor.GREEN } -> Direction.BUY
            last.all { it.color == CandleColor.RED } -> Direction.SELL
            else -> return wait("TWO_CANDLES_NOT_ALIGNED")
        }
        val failures = mutableListOf<String>()
        if (s.trend != direction) failures.add("TREND_NOT_ALIGNED")
        if (!s.structureConfirmed) failures.add("STRUCTURE_UNCONFIRMED")
        if (!s.pullbackConfirmed) failures.add("PULLBACK_UNCONFIRMED")
        if (!s.impulseConfirmed) failures.add("IMPULSE_UNCONFIRMED")
        if (failures.isNotEmpty()) return Decision(Direction.WAIT, failures.first(), diagnostics = failures)
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
