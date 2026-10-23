package com.scalpatlas.app

/** Observational shock detector for a sequence of timestamped normalized
 * price positions. y increases downwards. Not a trading signal.
 * Reset when the symbol/timeframe/chart scale changes.
 */
internal class LiveShockTracker(
  private val minExcursion: Double = 0.015,
  private val minRecoveryRatio: Double = 0.70,
  private val maxWindowMs: Long = 8_000L
) {
  private data class Point(val at: Long, val y: Double)
  private val points = ArrayDeque<Point>()
  private var context = ""
  private var lastReportedAt = -1L

  fun observe(symbol: String, timeframe: String, at: Long, y: Double): String? {
    if (!y.isFinite() || y !in 0.0..1.0 || at <= 0L) return null
    val key = symbol + "|" + timeframe
    if (context != key) {
      context = key
      points.clear()
      lastReportedAt = -1L
    }
    if (points.isNotEmpty() && at <= points.last().at) return null
    points.addLast(Point(at, y))
    while (points.isNotEmpty() && at - points.first().at > maxWindowMs) points.removeFirst()
    if (points.size < 3) return null
    val current = points.last()
    for (i in 0 until points.size - 2) {
      val start = points.elementAt(i)
      for (j in i + 1 until points.size - 1) {
        val extreme = points.elementAt(j)
        val downSpike = extreme.y - start.y
        val upSpike = start.y - extreme.y
        val upwardRecovery = extreme.y - current.y
        val downwardRecovery = current.y - extreme.y
        val bullish = downSpike >= minExcursion && upwardRecovery >= downSpike * minRecoveryRatio
        val bearish = upSpike >= minExcursion && downwardRecovery >= upSpike * minRecoveryRatio
        if ((bullish || bearish) && extreme.at != lastReportedAt) {
          lastReportedAt = extreme.at
          return if (bullish) "ȘOC JOS → RECUPERARE SUS (observație)" else "ȘOC SUS → RECUPERARE JOS (observație)"
        }
      }
    }
    return null
  }
}
