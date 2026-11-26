package com.scalpatlas.app

/** A proposal is never permission to edit a stake or submit an order. */
internal object LiveMartingalePreview637 {
  val ladder = longArrayOf(109L,228L,475L,992L,2070L,4320L,9016L,18816L,39268L,81950L)
  data class Result(val pair: String, val net: Long, val win: Boolean, val draw:Boolean=false)
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
      val draw=Regex("""(?i)\bDRAW\b""").containsMatchIn(line)
      if (listOf(win,loss,draw).count{it}!=1) return@mapNotNull null
      val money=amountRegex.findAll(line).toList().singleOrNull() ?: return@mapNotNull null
      val whole=money.groupValues[2].toLongOrNull() ?: return@mapNotNull null
      val frac=money.groupValues[3].padEnd(2,'0').toLongOrNull() ?: return@mapNotNull null
      val value=whole*100+frac
      val net=if(money.groupValues[1]=="-") -value else value
      if (draw && net==0L) Result(pair,net,false,true)
      else if (loss && net == -stake) Result(pair,net,false)
      else if (win && net in (stake*92/100)..((stake*92+99)/100)) Result(pair,net,true)
      else null
    }.distinct()
    return candidates.singleOrNull()
  }
  fun next(stake: Long, result: Result): Long? {
    val index=ladder.indexOf(stake)
    if(index<0) return null
    if(result.draw) return stake
    if(result.win) return ladder.first()
    return ladder.getOrNull(index+1)
  }
  fun permitsEdit(previous:Long,target:Long?,current:Long?,balance:Long?,open:Int?,expectedBalance:Long):Boolean =
    previous in ladder && target != null && target in ladder &&
      current == previous && balance != null && balance == expectedBalance &&
      balance >= target && open == 0

  // Read-only OCR evidence. Deliberately separate from stake-edit authorization.
  data class VisualLabel(val text:String,val left:Float,val top:Float,val right:Float,val bottom:Float)
  fun readDisplayedStake(labels:List<VisualLabel>):Long? {
    val anchors=labels.filter {
      it.left in .43f.. .82f && it.top in .60f.. .83f &&
        it.right<=.95f && it.bottom-it.top<=.055f &&
        Regex("""(?i)^sum[ăa]\s*:?$""").matches(it.text.trim())
    }
    val anchor=anchors.singleOrNull() ?: return null
    val candidates=labels.filter {
      it.left in (anchor.left-.045f)..(anchor.left+.15f) &&
        it.top>=anchor.bottom-.005f && it.top<=anchor.bottom+.055f &&
        it.bottom<=anchor.bottom+.09f && it.right<=.93f &&
        it.bottom-it.top<=.05f
    }.mapNotNull {
      val m=Regex("""^\$?\s*(\d{1,5})[.,](\d{2})\s*(?:USD)?$""",RegexOption.IGNORE_CASE)
        .matchEntire(it.text.trim()) ?: return@mapNotNull null
      val cents=(m.groupValues[1].toLongOrNull() ?: return@mapNotNull null)*100+
        (m.groupValues[2].toLongOrNull() ?: return@mapNotNull null)
      cents.takeIf { it in 1L..10_000_000L }
    }.distinct()
    return candidates.singleOrNull()
  }

  data class PositionHint(val tabSeen:Boolean,val positive:Int?)
  fun readPositionHint(labels:List<VisualLabel>):PositionHint {
    val tabs=labels.filter {
      it.left in .01f.. .27f && it.top in .84f.. .96f && it.right<=.36f &&
      Regex("""(?i)^(?:tranzac[țţt]ii|transactions|trades)$""").matches(it.text.trim())
    }
    val tab=tabs.singleOrNull() ?: return PositionHint(false,null)
    val digits=labels.filter {
      it.left>=tab.left-.015f && it.right<=tab.right+.14f &&
      it.top>=tab.top-.065f && it.bottom<=tab.top+.012f &&
      it.right-it.left<=.06f && it.bottom-it.top<=.045f
    }.mapNotNull { it.text.trim().takeIf { s->s.matches(Regex("""[1-9]""")) }?.toIntOrNull() }.distinct()
    return PositionHint(true,digits.singleOrNull())
  }
  fun format(cents:Long):String = String.format(java.util.Locale.ROOT, "%d,%02d", cents/100L, cents%100L)
}
