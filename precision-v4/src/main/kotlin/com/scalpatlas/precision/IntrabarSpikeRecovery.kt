package com.scalpatlas.precision

/** Tracks a price shock and recovery inside ONE still-forming candle.
 * Requires timestamped price samples from the same candle, not screenshots
 * whose capture interval is too slow to observe the movement.
 * This detector is observational: it never authorizes an order or beep.
 */
data class TickSample(val timestampMs: Long, val candleOpenTimeMs: Long, val price: Double)
enum class RecoveryKind { BULLISH, BEARISH }
data class RecoveryObservation(
    val kind: RecoveryKind,
    val shockPercent: Double,
    val recoveryFraction: Double,
    val candleOpenTimeMs: Long
)
class IntrabarSpikeRecovery(
    private val minShockFraction: Double = 0.0005,
    private val minRecoveryFraction: Double = 0.75,
    private val maxShockDurationMs: Long = 3000L,
    private val maxRecoveryDurationMs: Long = 6000L
) {
    private val samples = ArrayDeque<TickSample>()
    fun observe(sample: TickSample, trend: Direction): RecoveryObservation? {
        if (!sample.price.isFinite() || sample.price <= 0 || sample.timestampMs <= 0) return null
        if (samples.isNotEmpty() && sample.candleOpenTimeMs != samples.last().candleOpenTimeMs) samples.clear()
        if (samples.isNotEmpty() && sample.timestampMs <= samples.last().timestampMs) return null
        samples.addLast(sample)
        while (samples.size > 200 || (samples.isNotEmpty() && sample.timestampMs - samples.first().timestampMs > 12000L)) samples.removeFirst()
        if (trend != Direction.BUY && trend != Direction.SELL) return null
        val points = samples.toList()
        for (i in 0 until points.size - 2) {
            for (j in i + 1 until points.size - 1) {
                val a = points[i]; val b = points[j]; val end = points.last()
                if (b.timestampMs - a.timestampMs > maxShockDurationMs) break
                if (end.timestampMs - b.timestampMs > maxRecoveryDurationMs) continue
                val shock = if (trend == Direction.BUY) a.price - b.price else b.price - a.price
                if (shock < a.price * minShockFraction) continue
                val recovered = if (trend == Direction.BUY) end.price - b.price else b.price - end.price
                val fraction = recovered / shock
                if (fraction >= minRecoveryFraction) {
                    return RecoveryObservation(
                        if (trend == Direction.BUY) RecoveryKind.BULLISH else RecoveryKind.BEARISH,
                        100.0 * shock / a.price, fraction, sample.candleOpenTimeMs
                    )
                }
            }
        }
        return null
    }
}
