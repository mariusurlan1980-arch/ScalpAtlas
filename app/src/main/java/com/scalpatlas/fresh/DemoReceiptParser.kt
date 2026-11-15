package com.scalpatlas.fresh

// Pass labels from one order detail, together with the state of the verified tab.
internal object DemoReceiptParser {
    private val id = Regex(
        """^(?:Ordin\s*:\s*|(?:Order|Trade|Position|Tranzacție|Tranzactie)\s*(?:ID|Nr\.?|#)\s*[:#]?\s*)([A-Z0-9_-]{6,64})$""",
        RegexOption.IGNORE_CASE,
    )
    private val pair = Regex("""^[A-Z]{3}\s*/\s*[A-Z]{3}(?:\s+OTC)?$""")
    private val direction = Regex(
        """^(?:(?:Direcție|Directie|Direction)\s*:\s*)?(BUY|SELL)$""",
        RegexOption.IGNORE_CASE,
    )

    fun parse(labels: List<String>, tab: BrokerOrderState): BrokerOrderRow? {
        val values = labels.map(String::trim)
        val orderId = values.mapNotNull { id.matchEntire(it)?.groupValues?.get(1) }
            .distinct().singleOrNull() ?: return null
        val instrument = values.map(String::uppercase).filter(pair::matches)
            .map { it.replace(Regex("""\s*/\s*"""), "/").replace(Regex("""\s+"""), " ") }
            .distinct().singleOrNull() ?: return null
        val side = values.mapNotNull { direction.matchEntire(it)?.groupValues?.get(1)?.uppercase() }
            .distinct().singleOrNull() ?: return null
        return BrokerOrderRow(orderId, instrument, side, tab)
    }
}
