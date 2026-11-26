package com.scalpatlas.app

/** A proposal is never permission to edit a stake or submit an order. */
internal object LiveMartingalePreview637 {
  val ladder = longArrayOf(109L,228L,475L,992L,2070L,4320L,9016L,18816L,39268L,81950L)
  data class Result(val pair: String, val net: Long, val win: Boolean)
  private fun canonical(value: String) = value.uppercase(java.util.Locale.ROOT)
    .replace(Regex("""[\s()]"""),"")
  fun parse(blocks: List<String>, pair: String, stake: Long): Result? {
    if (stake !in ladder) return null
    val pairRegex = Regex("""(?i)\b[A-Z]{3}\s*/\s*[A-Z]{3}\b(?:\s*\(?\s*OTC\s*\)?)?""")
    val amountRegex = Regex("""(?i)\b(?:Net Profit|P/L|Profit net|Rezultat)\s*:\s*([+-])\s*\$?\s*(\d{1,5})(?:[.,](\d{1,2}))?(?![\d.,])""")
    val candidates = blocks.mapNotNull { raw ->
      val line = raw.replace(Regex("""\s+""")," ").trim()
      if (pairRegex.findAll(line).map { canonical(it.value) }.distinct().toList() != listOf(canonical(pair))) return@mapNotNull null
      val win=Regex("""(?i)\bWIN\b""").containsMatchIn(line)
      val loss=Regex("""(?i)\bLOSS\b""").containsMatchIn(line)
      if (win==loss) return@mapNotNull null
      val money=amountRegex.findAll(line).toList().singleOrNull() ?: return@mapNotNull null
      val whole=money.groupValues[2].toLongOrNull() ?: return@mapNotNull null
      val frac=money.groupValues[3].padEnd(2,'0').toLongOrNull() ?: return@mapNotNull null
      val value=whole*100+frac
      val net=if(money.groupValues[1]=="-") -value else value
      if (loss && net == -stake) Result(pair,net,false)
      else if (win && net in (stake*92/100)..((stake*92+99)/100)) Result(pair,net,true)
      else null
    }.distinct()
    return candidates.singleOrNull()
  }
  fun next(stake: Long, result: Result): Long? {
    val index=ladder.indexOf(stake)
    if(index<0) return null
    if(result.win) return ladder.first()
    return ladder.getOrNull(index+1)
  }
  fun permitsEdit(previous:Long,target:Long?,current:Long?,balance:Long?,open:Int?,expectedBalance:Long):Boolean =
    previous in ladder && target != null && target in ladder &&
      current == previous && balance != null && balance == expectedBalance &&
      balance >= target && open == 0
  fun format(cents:Long):String = String.format(java.util.Locale.ROOT, "%d,%02d", cents/100L, cents%100L)
}
