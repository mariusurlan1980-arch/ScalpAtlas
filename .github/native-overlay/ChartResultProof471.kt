package com.scalpatlas.app

/**
 * 471 QT DEMO ONLY: candidate for a broker-rendered CLOSED-trade notice
 * while the broker PRICE CHART is still visible. This is NOT a candle,
 * projected price, timer, Android gesture result, account balance change,
 * or the user's Scalp Atlas overlay.
 *
 * Only caller-verified live-chart OCR is accepted. The caller must further
 * confirm two different fresh screenshot captures, the saved attempt, the
 * broker account, and the 5-minute expiry before booking a DEMO result.
 * If Pocket Option does not show the complete closed-trade notice on-chart,
 * return null and leave recovery blocked. Never fabricate a WIN/LOSS.
 */
object ChartResultProof471 {
  data class Candidate(val netProfitCents: Long, val fingerprint: String)

  private fun moneyCents(raw: String): Long? {
    val m = Regex("""^([+-]?)[ ]*(?:USD[ ]*)?[$]?[ ]*([0-9]{1,5})(?:[.,]([0-9]{1,2}))?[ ]*(?:USD)?$""",
      RegexOption.IGNORE_CASE).matchEntire(raw.trim()) ?: return null
    val whole = m.groupValues[2].toLongOrNull() ?: return null
    val fractional = m.groupValues[3].padEnd(2, '0').toLongOrNull() ?: return null
    val cents = whole * 100L + fractional
    return if (m.groupValues[1] == "-") -cents else cents
  }

  /**
   * Require all of: explicit broker completion notice, a single uniquely
   * stated invested stake, a single signed net P/L, and the expected pair.
   * Generic "Profit 92%" BUY/SELL buttons are deliberately not sufficient.
   */
  fun extract(
    capturedBrokerLines: List<String>,
    expectedPair: String,
    expectedStakeCents: Long,
    expectedPayoutPercent: Int
  ): Candidate? {
    if (expectedPair.isBlank() || expectedStakeCents !in 100L..3964L ||
        expectedPayoutPercent !in 92..100) return null
    val lines = capturedBrokerLines.map { it.trim().replace(Regex("""\s+"""), " ") }
      .filter { it.isNotBlank() && it.length <= 180 }
    if (lines.isEmpty() || lines.size > 140) return null
    val all = lines.joinToString(" ")
    if (Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(all)) return null
    val canonical = all.uppercase().replace(Regex("""\s+"""), "")
    val pairKey = expectedPair.uppercase().replace(Regex("""\s+"""), "")
    if (!canonical.contains(pairKey)) return null

    // Pocket Option "Tooltips" can show the completed trade directly on
    // the price chart as "TRADE AMOUNT: $1.00 / RESULT: +$1.92".
    // RESULT here is the GROSS RETURN, not net profit. A $1.00 trade with
    // 92% payout yields a $1.92 RESULT but only $0.92 NET profit.
    // This distinct TWO-FIELD popup is already a completed-trade notice;
    // never confuse it with the BUY/SELL potential payout quote.
    val moneyPattern = """([+-]?\s*(?:USD\s*)?[$]?\s*\d{1,5}(?:[.,]\d{1,2})?\s*(?:USD)?)"""
    val popupAmountRx = Regex(
      """(?i)(?:TRADE\s+AMOUNT|TRANSACTION\s+AMOUNT|SUMA\s+TRANZAC[TȚ]IEI|SUMĂ\s+TRANZAC[TȚ]IEI)\s*:\s*""" + moneyPattern)
    val popupResultRx = Regex(
      """(?i)(?:RESULT|REZULTAT)\s*:\s*""" + moneyPattern)
    val popupStakes = popupAmountRx.findAll(all)
      .mapNotNull { moneyCents(it.groupValues[1]) }.distinct().toList()
    val popupReturns = popupResultRx.findAll(all)
      .mapNotNull { moneyCents(it.groupValues[1]) }.distinct().toList()
    if (popupStakes.isNotEmpty() || popupReturns.isNotEmpty()) {
      if (popupStakes.size != 1 || popupStakes.single() != expectedStakeCents ||
          popupReturns.size != 1) return null
      val shown = popupReturns.single()
      val expectedNet = (expectedStakeCents * expectedPayoutPercent + 99L) / 100L
      // Accept a full-loss result (0 gross or -stake net), a gross payout
      // equal to stake + expected net, or explicitly reported net profit.
      // No guessed payout and no breakeven interpretation.
      val net = when {
        shown == 0L || shown == -expectedStakeCents -> -expectedStakeCents
        shown in (expectedStakeCents + expectedNet - 1L)..
          (expectedStakeCents + expectedNet) -> shown - expectedStakeCents
        shown in (expectedNet - 1L)..expectedNet -> shown
        else -> return null
      }
      return Candidate(net, listOf("QT_DEMO_TOOLTIPS", pairKey,
        expectedStakeCents, expectedPayoutPercent, net).joinToString("|"))
    }

    // A selected history tab labeled "Închis" is NOT a closed-trade notice.
    val closedNotice = Regex(
      """(?i)(?:tranzac[tț]i[ae]|ordin(?:ul)?|trade|order|position|pozi[tț]i[ae])\s+.{0,26}?(?:closed|completed|settled|expired|finalizat[ăa]?|[iî]nchis[ăa]?|[iî]ncheiat[ăa]?|expirat[ăa]?)"""
    ).containsMatchIn(all)
    if (!closedNotice) return null

    val stakeRx = Regex(
      """(?i)(?:Miză|Miza|Stake|Investment|Investiție|Investitie|Suma|Sumă)\s*:\s*""" + moneyPattern)
    val profitRx = Regex(
      """(?i)(?:Net\s+Profit|P/L|Profit|Rezultat|Result|Câștig|Castig)\s*:\s*""" + moneyPattern)
    val lossRx = Regex("""(?i)(?:Loss|Pierdere)\s*:\s*""" + moneyPattern)
    val stakes = stakeRx.findAll(all).mapNotNull { moneyCents(it.groupValues[1]) }
      .distinct().toList()
    if (stakes.size != 1 || stakes[0] != expectedStakeCents) return null

    val pnlCandidates = profitRx.findAll(all)
      .mapNotNull { moneyCents(it.groupValues[1]) }.toList()
    val lossCandidates = lossRx.findAll(all)
      .mapNotNull { moneyCents(it.groupValues[1])?.let { cents ->
        if (cents < 0) cents else -cents
      } }.toList()
    val amounts = (pnlCandidates + lossCandidates).distinct()
    if (amounts.size != 1) return null
    val pnl = amounts.single()
    val maxProfit = (expectedStakeCents * expectedPayoutPercent + 99L) / 100L
    // Exact full loss or explicit positive payout; reject green 92% quotes.
    if (!(pnl == -expectedStakeCents ||
          (pnl > 0 && pnl in (maxProfit - 1L)..maxProfit))) return null

    return Candidate(pnl, listOf(pairKey, expectedStakeCents,
      expectedPayoutPercent, pnl).joinToString("|"))
  }
}
