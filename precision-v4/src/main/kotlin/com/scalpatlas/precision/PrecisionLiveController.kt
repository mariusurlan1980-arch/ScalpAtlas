package com.scalpatlas.precision

/**
 * Android-independent adapter between the live chart reader and the v4 engine.
 * The host app must provide real closed candles, trend, and structure values.
 * Never synthesize confirmations from an unreadable screenshot.
 */
interface LiveChartReader {
    fun readSnapshot(): MarketSnapshot?
}
interface OriginalBipPlayer {
    fun playOriginalBip()
}
interface SignalUi {
    fun show(decision: Decision)
}
class PrecisionLiveController(
    private val reader: LiveChartReader,
    private val ui: SignalUi,
    private val sound: OriginalBipPlayer,
    private val engine: PrecisionScalpingEngine = PrecisionScalpingEngine(),
    private val alertGate: SignalAlertGate = SignalAlertGate()
) {
    var bellEnabled: Boolean = true

    fun analyzeFrame(): Decision {
        val snapshot = reader.readSnapshot()
        val decision = if (snapshot == null) {
            Decision(Direction.WAIT, "CHART_NOT_READABLE")
        } else {
            engine.evaluate(snapshot)
        }
        ui.show(decision)
        if (alertGate.shouldBeep(decision, bellEnabled)) {
            sound.playOriginalBip()
        }
        return decision
    }
}
