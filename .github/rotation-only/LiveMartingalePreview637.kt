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
  // Balance is account-wide, not pair-wide. The actual order is bound to
  // the confirmed chart at entry, never to the last idle rotation chart.
  fun entryDebit(stake:Long?,before:Long?,after:Long?,age:Long,sameAccount:Boolean):Boolean =
    sameAccount && stake!=null && stake in ladder && before!=null && after!=null &&
      age in 0L..45_000L && before>=stake && before-after==stake

  // When one reader still exposes the exact pre-order balance, the other
  // may prove the debit. Never resolve unrelated conflicting amounts.
  // The caller must also prove the single active order; EntryLatch repeats it.
  fun entryBalance(before:Long,stake:Long,visual:Long?,android:Long?,single:Boolean):Long? {
    if(!single || stake !in ladder || before<stake)return null
    val expected=before-stake
    if(visual!=null && android!=null && visual!=android){
      if((visual==before && android==expected) || (android==before && visual==expected))
        return expected
      return null
    }
    return (visual ?: android)?.takeIf{it==expected}
  }
  // Keep the original, already-armed balance for the whole entry transition.
  // A missing OCR field is not an authorization; verify exact debit twice.
  class EntryLatch(val pkg:String,val stake:Long,val before:Long,val detectedAt:Long){
    private var firstAt:Long?=null
    private var firstPair:String?=null
    private var boundPair:String?=null
    private var invalid=false
    // Late OCR recovery is allowed only for an order identified early, with
    // the original pre-entry balance and the same single active DEMO position.
    fun verify(pair:String,account:String,visibleStake:Long?,balance:Long?,at:Long,single:Boolean,conflicting:Boolean=false):Boolean {
      val age=at-detectedAt
      if(conflicting || account!=pkg || (boundPair!=null && boundPair!=pair))invalid=true
      if(!invalid && boundPair==null && single && visibleStake==stake && age in 0L..45_000L)boundPair=pair
      if(invalid || boundPair!=pair || age !in 0L..270_000L || !single ||
        visibleStake!=stake || balance==null || before<stake || before-balance!=stake){
        firstAt=null;firstPair=null;return false
      }
      val previous=firstAt
      if(previous==null || firstPair!=pair || at-previous>10_000L){
        firstAt=at;firstPair=pair;return false
      }
      return at-previous>=1_000L
    }
  }
  // Requires an observed single entry debit, an unchanged account/pair and
  // independently repeated empty chart readings AFTER the full expiry.
  fun settledBalance(pair:String,stake:Long,before:Long,after:Long,age:Long,quiet:Boolean):Result? {
    if(stake !in ladder || age<300_000L || !quiet || before<stake || after<0L)return null
    val net=after-before
    return when {
      net == -stake -> Result(pair,net,false)
      net == 0L -> Result(pair,net,false,true)
      net in (stake*92/100)..((stake*92+99)/100) -> Result(pair,net,true)
      else -> null
    }
  }
  fun next(stake: Long, result: Result): Long? {
    val index=ladder.indexOf(stake)
    if(index<0) return null
    if(result.draw) return stake
    if(result.win) return ladder.first()
    return ladder.getOrNull(index+1)
  }
  // Calculator input is a broker-owned string, not Android's IME.
  // Refuse a sequence if a key produces anything other than its expected echo.
  data class CalculatorKey(val key:String,val before:String,val after:String)
  fun calculatorKeys(from:String,target:Long):List<CalculatorKey>? {
    if(!Regex("""\d{1,5}\.\d{2}""").matches(from) || target !in ladder)return null
    val desired=String.format(java.util.Locale.ROOT,"%d.%02d",target/100L,target%100L)
    val prefix=from.zip(desired).takeWhile{it.first==it.second}.size
    val steps=mutableListOf<CalculatorKey>()
    var current=from
    while(current.length>prefix){
      val next=current.dropLast(1)
      steps.add(CalculatorKey("DELETE",current,next))
      current=next
    }
    for(ch in desired.drop(prefix)){
      val next=current+ch
      steps.add(CalculatorKey(ch.toString(),current,next))
      current=next
    }
    return steps
  }
  fun permitsEdit(previous:Long,target:Long?,current:Long?,balance:Long?,open:Int?,expectedBalance:Long):Boolean =
    previous in ladder && target != null && target in ladder &&
      current == previous && balance != null && balance == expectedBalance &&
      balance >= target && open == 0

  // Read-only OCR evidence. Deliberately separate from stake-edit authorization.
  data class VisualLabel(val text:String,val left:Float,val top:Float,val right:Float,val bottom:Float)
  fun readDisplayedStake(labels:List<VisualLabel>, lineLabels:List<VisualLabel> = emptyList()):Long? {
    val anchors=labels.filter {
      it.left in .43f.. .82f && it.top in .60f.. .83f &&
        it.right<=.95f && it.bottom-it.top<=.055f &&
        Regex("""(?i)^sum[ăa]\s*:?$""").matches(it.text.trim())
    }
    val anchor=anchors.singleOrNull() ?: return null
    val candidates=(labels+lineLabels).filter {
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

  // Pause-only signal, never evidence of a closed trade or authorization to edit.
  // Blue circular transaction badge beside the bottom-left Trades tab.
  fun bluePositionBadge(width:Int,height:Int,pixel:(Int,Int)->Int):Boolean {
    if(width<300 || height<600)return false
    val step=(width/350).coerceAtLeast(1)
    val radius=(width*.013f).toInt().coerceAtLeast(4)
    fun blue(x:Int,y:Int):Boolean {
      val c=pixel(x,y)
      val r=(c shr 16) and 255;val g=(c shr 8) and 255;val b=c and 255
      return r<=55 && g in 65..160 && b in 125..230 && b-g>=28 && g-r>=35
    }
    // Exact bottom-left broker badge zone, calibrated against G24 captures.
    for(y in (height*.87f).toInt()..(height*.91f).toInt() step step){
      for(x in (width*.19f).toInt()..(width*.245f).toInt() step step){
        if(!blue(x-radius,y) || !blue(x+radius,y) ||
           !blue(x,y-radius) || !blue(x,y+radius))continue
        // Require a compact blue disk, not a horizontal price line or a large panel.
        if(blue(x-2*radius,y) || blue(x+2*radius,y) ||
           blue(x,y-2*radius) || blue(x,y+2*radius))continue
        var count=0
        for(dx in listOf(-radius/2,0,radius/2))for(dy in listOf(-radius/2,0,radius/2))
          if(blue(x+dx,y+dy))count++
        // Require light digit pixels inside the compact disk as well.
        var light=0
        for(dx in -radius/2..radius/2)for(dy in -radius..radius){
          val c=pixel(x+dx,y+dy)
          val r=(c shr 16) and 255;val g=(c shr 8) and 255;val b=c and 255
          if(minOf(r,g,b)>=130 && maxOf(r,g,b)-minOf(r,g,b)<65)light++
        }
        if(count>=5 && light>=maxOf(2, radius*radius/40))return true
      }
    }
    return false
  }

  // A matched disk with a light digit in the broker's exact badge region
  // can pause rotation. It cannot authorize a stake edit; entry debit and
  // settlement are independently checked. Unknown badge count is not one.
  fun confirmedVisualBadge(blue:Boolean,footerCount:Int?,chartMarker:Long?):Int? =
    if(!blue) null else footerCount?.takeIf{it>0} ?: chartMarker?.takeIf{it in ladder}?.let{1}
  fun shouldPauseForBadge(blue:Boolean):Boolean=blue
  fun readBadgeCount(labels:List<VisualLabel>):Int? {
    val numbers=labels.filter {
      it.left>=.185f && it.right<=.255f && it.top>=.865f && it.bottom<=.915f &&
        it.right-it.left<=.055f && it.bottom-it.top<=.04f
    }.mapNotNull{it.text.trim().takeIf{s->s.matches(Regex("""[1-9][0-9]?"""))}?.toIntOrNull()}.distinct()
    return numbers.singleOrNull()
  }
  // Asynchronous verification: never confuse a requested amount with a confirmed amount.
  class EditReadback(val target:Long,val started:Long){
    private var firstAt:Long?=null
    fun observe(value:Long?,at:Long,quiet:Boolean):Boolean{
      if(!quiet || value!=target || at-started !in 0L..12_000L){firstAt=null;return false}
      val first=firstAt
      if(first==null || at-first>4_000L){firstAt=at;return false}
      return at-first>=1_000L
    }
    fun expired(now:Long)=now-started>12_000L
  }

  // Active order amount printed beside the chart marker, not the input field.
  fun readActiveStake(labels:List<VisualLabel>, lineLabels:List<VisualLabel> = emptyList()):Long? {
    fun candidates(source:List<VisualLabel>)=source.filter{
      it.left>=.15f && it.right<=.83f && it.top>=.19f && it.bottom<=.69f &&
        it.bottom-it.top<=.055f
    }.mapNotNull{
      val m=Regex("""^[▲▼△▽↗↘]?\s*\$\s*(\d{1,5})[.,](\d{2})$""")
        .matchEntire(it.text.trim()) ?: return@mapNotNull null
      val whole=m.groupValues[1].toLongOrNull() ?: return@mapNotNull null
      val fraction=m.groupValues[2].toLongOrNull() ?: return@mapNotNull null
      (whole*100L+fraction).takeIf{it in ladder}
    }
    val values=candidates(labels)
    val lines=candidates(lineLabels)
    if(values.size>1 || lines.size>1)return null
    return (values+lines).distinct().singleOrNull()
  }

  fun isTradesFooter(text:String):Boolean {
    val folded=java.text.Normalizer.normalize(text.trim().lowercase(java.util.Locale.ROOT),
      java.text.Normalizer.Form.NFD).replace(Regex("""\p{M}"""),"")
    return Regex("""^(?:tranzactii|transactions|trades)(?:\s*[:·]?\s*[0-9]{1,3})?$""").matches(folded)
  }
  // Read only the account balance in the top-right broker header.
  // Require a decimal amount, never the overlay's old balance or a chart price.
  private fun moneyText(raw:String):String=raw.trim()
    .replace(Regex("""(?i)^USD\s*|\s*USD$"""),"").trim().removePrefix("$").trim()
    .replace(Regex("""\s*([,.])\s*"""),"$1")
    .replace(Regex("""[\u00a0\u202f]""")," ")
  private fun headerCents(raw:String):Long? {
    val value=moneyText(raw)
    val normalized=when {
      Regex("""^\d{1,3}(,\d{3})+\.\d{2}$""").matches(value)->value.replace(",","")
      Regex("""^\d{1,3}(\.\d{3})+,\d{2}$""").matches(value)->value.replace(".","").replace(",",".")
      Regex("""^\d{1,3}( \d{3})+[.,]\d{2}$""").matches(value)->value.replace(" ","").replace(",",".")
      Regex("""^\d{1,7}[.,]\d{2}$""").matches(value)->value.replace(",",".")
      else->return null
    }
    val parts=normalized.split(".")
    return (parts[0].toLongOrNull() ?: return null)*100L+
      (parts[1].toLongOrNull() ?: return null)
  }
  fun readHeaderBalance(labels:List<VisualLabel>, lineLabels:List<VisualLabel> = emptyList()):Long? {
    fun valid(l:VisualLabel)=l.left>=.48f && l.right<=.88f &&
      l.top>=.045f && l.bottom<=.135f && l.bottom-l.top<=.055f
    val lines=lineLabels.filter(::valid).mapNotNull{l->headerCents(l.text)?.let{l to it}}
    val elements=labels.filter(::valid).mapNotNull{l->headerCents(l.text)?.let{l to it}}
    // A complete line may include a smaller OCR element that is just its suffix
    // (for example 561.15 inside 1,561.15). Ignore only geometrically nested
    // literal fragments. Independent or conflicting full readings still block.
    val independent=elements.filterNot{(part,amount)->lines.any{(whole,total)->
      amount!=total && part.left>=whole.left-.005f && part.right<=whole.right+.005f &&
        part.top>=whole.top-.005f && part.bottom<=whole.bottom+.005f &&
        whole.right-whole.left>part.right-part.left+.008f &&
        moneyText(whole.text).contains(moneyText(part.text))
    }}
    return (lines+independent).map{it.second}.distinct().singleOrNull()
  }
  fun stableIdleSample(previousBalance:Long?,previousStake:Long?,balance:Long,stake:Long,
    age:Long,sameAccount:Boolean):Boolean =
    sameAccount && previousBalance==balance && previousStake==stake && age in 1_000L..15_000L

  data class PositionHint(val tabSeen:Boolean,val positive:Int?)
  fun readPositionHint(labels:List<VisualLabel>):PositionHint {
    val tabs=labels.filter {
      it.left in .01f.. .27f && it.top in .84f.. .96f && it.right<=.36f &&
      isTradesFooter(it.text)
    }
    val tab=tabs.firstOrNull() ?: return PositionHint(false,null)
    if(tabs.any{kotlin.math.abs(it.top-tab.top)>.025f || kotlin.math.abs(it.left-tab.left)>.05f})
      return PositionHint(false,null)
    val digits=labels.filter {
      it.left>=tab.left-.015f && it.right<=tab.right+.14f &&
      it.top>=tab.top-.065f && it.bottom<=tab.top+.012f &&
      it.right-it.left<=.06f && it.bottom-it.top<=.045f
    }.mapNotNull { it.text.trim().takeIf { s->s.matches(Regex("""[1-9]""")) }?.toIntOrNull() }.distinct()
    val attached=tabs.mapNotNull{Regex("""[1-9][0-9]{0,2}$""").find(it.text.trim())?.value?.toIntOrNull()}
    val positive=(digits+attached).distinct()
    return PositionHint(true,if(positive.isEmpty())null else positive.maxOrNull())
  }
  fun format(cents:Long):String = String.format(java.util.Locale.ROOT, "%d,%02d", cents/100L, cents%100L)
}
