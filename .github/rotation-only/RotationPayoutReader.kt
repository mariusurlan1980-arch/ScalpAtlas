package com.scalpatlas.app

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.graphics.Path
import android.accessibilityservice.GestureDescription
import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo
import android.content.Context
import java.util.Locale

/** Strict QT Demo chart reads and one verified stake-field edit; no order gestures. */
object RotationPayoutReader {
  private data class Item(val node: AccessibilityNodeInfo, val value: String, val rect: Rect)
  private data class Chart(
    val root: AccessibilityNodeInfo, val pkg: String, val w: Int, val h: Int,
    val labels: List<Item>
  )

  private fun readChart(svc: AccessibilityService, realAccount: Boolean = false): Pair<Chart?, String> {
    val root = svc.rootInActiveWindow ?: return null to "BROKER NECONFIRMAT"
    val pkg = root.packageName?.toString().orEmpty()
    if (!BrokerAdapterRegistry.hasDemoExecutor(pkg))
      return null to "BLOCAT: BROKER NECUNOSCUT/REAL"
    val metrics = android.util.DisplayMetrics()
    try {
      val manager = svc.getSystemService(Context.WINDOW_SERVICE)
        as android.view.WindowManager
      @Suppress("DEPRECATION")
      manager.defaultDisplay.getRealMetrics(metrics)
    } catch (_: Throwable) {
      return null to "BLOCAT: ECRAN NECONFIRMAT"
    }
    val w = metrics.widthPixels
    val h = metrics.heightPixels
    if (w < 300 || h < 650) return null to "BLOCAT: ECRAN NECONFIRMAT"
    val labels = ArrayList<Item>()
    val nodes = ArrayDeque<AccessibilityNodeInfo>()
    nodes.add(root)
    var seen = 0
    while (nodes.isNotEmpty() && seen++ < 350) {
      val node = nodes.removeFirst()
      if (node.packageName?.toString() == pkg && node.isVisibleToUser) {
        val rect = Rect()
        node.getBoundsInScreen(rect)
        if (!rect.isEmpty && rect.left >= 0 && rect.right <= w &&
            rect.top >= 0 && rect.bottom <= h) {
          val txt = node.text?.toString()?.trim().orEmpty()
          val description = node.contentDescription?.toString()?.trim().orEmpty()
          if (txt.isNotBlank()) labels.add(Item(node, txt.take(120), Rect(rect)))
          if (description.isNotBlank() && description != txt)
            labels.add(Item(node, description.take(120), Rect(rect)))
        }
      }
      for (i in 0 until node.childCount.coerceAtMost(35))
        node.getChild(i)?.let(nodes::addLast)
    }
    val demo = labels.any { it.rect.centerY() < h * 0.28 &&
      Regex("""(?i)\bQT\s*Demo\b""").containsMatchIn(it.value) }
    val real = labels.any {
      Regex("""(?i)\bQT\s*Real\b""").containsMatchIn(it.value)
    }
    if (if (realAccount) !real || demo else !demo || real)
      return null to "BLOCAT: CONTUL QT NU ESTE CONFIRMAT"

    return Chart(root, pkg, w, h, labels) to "QT DEMO"
  }

  private fun readChartPayout(chart: Chart): Pair<Int?, String> {
    val (_, _, w, h, labels) = chart
    val actionLabels = labels.filter {
      it.rect.centerY() > h * .76f && it.rect.centerY() < h * .97f &&
        Regex("""(?i)^(?:CUMPĂRAȚI|CUMPARATI|VINDEȚI|VINDETI)(?:\s+\d{1,3}\s*%)?$""")
          .matches(it.value.replace('\n', ' ').trim())
    }
    if (!actionLabels.any { it.rect.centerX() < w * .49f } ||
        !actionLabels.any { it.rect.centerX() > w * .51f })
      return null to "BLOCAT: BUTOANE BUY/SELL NEIDENTIFICATE"
    val payoutPattern = Regex("""(?<!\d)(\d{1,3})\s*%(?!\d)""")
    fun pct(isBuy: Boolean) = labels.filter {
      it.rect.centerY() > h * .75f && it.rect.centerY() < h * .97f &&
        (if (isBuy) it.rect.centerX() < w * .49f
         else it.rect.centerX() > w * .51f)
    }.mapNotNull { payoutPattern.find(it.value)?.groupValues?.getOrNull(1)?.toIntOrNull() }
      .distinct().singleOrNull()
    val buyPayout = pct(true)
    val sellPayout = pct(false)
    if (buyPayout == null || buyPayout != sellPayout || buyPayout !in 0..100)
      return null to "BLOCAT: PAYOUT BUY/SELL NECONFIRMAT"

    return buyPayout to "QT DEMO"
  }

  fun readRotationPayout(svc: AccessibilityService, realAccount: Boolean = false): Int? {
    val chart = readChart(svc, realAccount).first ?: return null
    val payout = readChartPayout(chart).first ?: return null
    return payout.takeIf { svc.rootInActiveWindow == chart.root }
  }

  internal data class LiveSnapshot(val pkg:String,val stake:Long?,val balance:Long?,val openCount:Int?,val tradesFooterSeen:Boolean=false,val payout:Int=92)

  private fun exactCents637(raw:String):Long? {
    val clean=raw.trim().replace(Regex("""(?i)^USD\s*|\s*USD$"""),"").trim().removePrefix("$").trim()
    val normalized=when {
      Regex("""^\d{1,3}(,\d{3})+\.\d{2}$""").matches(clean)->clean.replace(",","")
      Regex("""^\d{1,3}(\.\d{3})+,\d{2}$""").matches(clean)->clean.replace(".","").replace(",",".")
      Regex("""^\d{1,7}(?:[.,]\d{1,2})?$""").matches(clean)->clean.replace(",",".")
      else -> return null
    }
    val parts=normalized.split(".")
    return (parts[0].toLongOrNull() ?: return null)*100+
      (parts.getOrNull(1).orEmpty().padEnd(2,'0').toLongOrNull() ?: return null)
  }

  private fun stakeFieldItems(chart:Chart):List<Item> {
    val (_,_,w,h,labels)=chart
    val captions=labels.filter {
      it.rect.centerX()>w*.46f && it.rect.centerY() in (h*.62f).toInt()..(h*.88f).toInt() &&
      it.rect.width()<=w*.48f && Regex("""(?i)^Sum[ăa]\s*:?$""").matches(it.value)
    }
    val anchor=captions.firstOrNull() ?: return emptyList()
    if(captions.any{kotlin.math.abs(it.rect.centerY()-anchor.rect.centerY())>h*.035f ||
      kotlin.math.abs(it.rect.left-anchor.rect.left)>w*.06f})return emptyList()
    val sellTop=labels.filter{it.rect.centerX()>w*.51f &&
      Regex("""(?i)^(?:VINDEȚI|VINDETI)(?:\s+\d{1,3}\s*%)?$""").matches(it.value.replace('\n',' ').trim())}
      .minOfOrNull{it.rect.top} ?: return emptyList()
    return labels.filter{it.node.isEnabled && it.rect.left>=w*.48f && it.rect.right<=w*.96f &&
      it.rect.top>=anchor.rect.bottom-h*.008f && it.rect.bottom<sellTop &&
      it.rect.centerY()<=anchor.rect.bottom+h*.065f &&
      it.rect.height()<=h*.075f && exactCents637(it.value)!=null}
  }

  internal fun readLiveSnapshot637(svc:AccessibilityService,readOnlyAnyPayout:Boolean=false):LiveSnapshot? {
    val chart=readChart(svc,false).first ?: return null
    val payout=readChartPayout(chart).first ?: return null
    // Non-92 snapshots are diagnostics/navigation evidence only.
    if(!readOnlyAnyPayout && payout!=92)return null
    val (_,pkg,w,h,labels)=chart
    // Read the displayed amount even when the broker exposes it as a
    // clickable label rather than an editable Android input.
    val stakes=stakeFieldItems(chart).mapNotNull{exactCents637(it.value)}.distinct()
    val headerLabels=labels.map{
      LiveMartingalePreview637.VisualLabel(it.value,it.rect.left.toFloat()/w,
        it.rect.top.toFloat()/h,it.rect.right.toFloat()/w,it.rect.bottom.toFloat()/h)
    }
    val balance=LiveMartingalePreview637.readHeaderBalance(headerLabels)
    val countPattern=Regex("""(?i)^(?:open (?:positions|trades)|poziții deschise|pozitii deschise|tranzacții deschise|tranzactii deschise)\s*:\s*(\d{1,4})$""")
    val counts=labels.mapNotNull{
      countPattern.matchEntire(it.value.trim())?.groupValues?.get(1)?.toIntOrNull()
    }.distinct()
    if(svc.rootInActiveWindow!=chart.root) return null
    val footer=labels.any{
      it.rect.centerX()<w*.36f && it.rect.centerY()>h*.83f &&
        LiveMartingalePreview637.isTradesFooter(it.value)
    }
    val footerCounts=labels.filter{
      it.rect.centerX()<w*.36f && it.rect.centerY()>h*.83f &&
        LiveMartingalePreview637.isTradesFooter(it.value)
    }.mapNotNull{Regex("[1-9][0-9]{0,2}$").find(it.value.trim())?.value?.toIntOrNull()}
    val open=(counts+footerCounts).filter{it>0}.maxOrNull() ?: counts.singleOrNull()
    return LiveSnapshot(pkg,stakes.singleOrNull(),balance,open,footer,payout)
  }


  // One exact input edit, only after independently observed settlement.
  internal fun editVerifiedStake637(
    svc:AccessibilityService, expectedPackage:String, previous:Long, target:Long,
    expectedBalance:Long, visualClosureVerified:Boolean, allowOpen:Boolean, overlayBounds:Rect, stillAuthorized:()->Boolean, startupRepair:Boolean=false
  ):String {
    if(!stillAuthorized())return "MG • CONT NECONFIRMAT"
    val chart=readChart(svc,false).first ?: return "MG • GRAFIC NECITIT"
    if(chart.pkg!=expectedPackage || readChartPayout(chart).first!=92)
      return "MG • CONT/PAYOUT NECONFIRMAT"
    val snap=readLiveSnapshot637(svc) ?: return "MG • DATE NECITITE"
    val open=snap.openCount ?: if(visualClosureVerified && positiveOpenBadge637(svc)==null)0 else null
    if(snap.stake==null)return "MG • CÂMP SUMĂ FĂRĂ EDITARE"
    val permitted=if(startupRepair)LiveMartingalePreview637.permitsStartupRepair(previous,target,snap.stake,snap.balance,open,expectedBalance)
      else LiveMartingalePreview637.permitsEdit(previous,target,snap.stake,snap.balance,open,expectedBalance)
    if(snap.pkg!=expectedPackage || !permitted)
      return "MG • MIZĂ NESCHIMBATĂ"
    val (_,_,w,h,labels)=chart
    val amounts=stakeFieldItems(chart).filter{exactCents637(it.value)==previous}
    val inputs=amounts.filter{
      it.node.isEnabled && it.node.isVisibleToUser &&
      it.node.packageName?.toString()==expectedPackage &&
      it.node.actionList.any { a->a.id==AccessibilityNodeInfo.ACTION_SET_TEXT }
    }.distinctBy{it.rect.toShortString()}
    if(inputs.size>1)return "MG • MAI MULTE CÂMPURI SUMĂ"
    val input=inputs.singleOrNull()
    if(input==null){
      if(!allowOpen)return "MG • EDITOR SUMĂ NEIDENTIFICAT"
      // Open only the existing amount control, never a coordinate or a
      // trade button. The exact displayed amount and account were verified above.
      val sellTop=labels.filter{it.rect.centerX()>w*.51f &&
        Regex("""(?i)^(?:VINDEȚI|VINDETI)(?:\s+\d{1,3}\s*%)?$""").matches(it.value.replace('\n',' ').trim())}
        .minOfOrNull{it.rect.top} ?: return "MG • LIMITĂ SUMĂ NECONFIRMATĂ"
      val targets=amounts.mapNotNull{item->
        var n:AccessibilityNodeInfo?=item.node
        var found:AccessibilityNodeInfo?=null
        for(depth in 0..2){
          val candidate=n ?: break
          val r=Rect();candidate.getBoundsInScreen(r)
          if(candidate.packageName?.toString()!=expectedPackage || !candidate.isEnabled ||
            !candidate.isVisibleToUser || r.left<w*.48f || r.right>w*.96f ||
            r.top<item.rect.top-h*.025f || r.bottom>=sellTop || r.height()>h*.075f ||
            !r.contains(item.rect))break
          if(candidate.actionList.any{it.id==AccessibilityNodeInfo.ACTION_CLICK}){
            found=candidate;break
          }
          n=candidate.parent
        }
        found
      }.distinctBy{val r=Rect();it.getBoundsInScreen(r);r.toShortString()}
      if(targets.size>1)return "MG • MAI MULTE CONTROALE SUMĂ"
      val control=targets.singleOrNull()
      if(!stillAuthorized() || svc.rootInActiveWindow!=chart.root || positiveOpenBadge637(svc)!=null)
        return "MG • GRAFIC SCHIMBAT"
      val opened=if(control!=null)try{control.performAction(AccessibilityNodeInfo.ACTION_CLICK)}catch(_:Throwable){false}
        else {
          val field=amounts.map{it.rect}.distinct().singleOrNull()
            ?:return "MG • CONTROL SUMĂ NEIDENTIFICAT"
          // The exact observed amount label is above SELL, not a fixed coordinate.
          if(field.bottom>=sellTop || field.left<w*.48f)return "MG • CONTROL SUMĂ NEIDENTIFICAT"
          tapAmountPoint637(svc,chart,field.centerX(),field.centerY(),overlayBounds,stillAuthorized)
        }
      return if(opened)"MG • EDITOR DESCHIS" else "MG • DESCHIDERE REFUZATĂ"
    }
    if(!stillAuthorized() || svc.rootInActiveWindow!=chart.root || positiveOpenBadge637(svc)!=null)
      return "MG • GRAFIC SCHIMBAT"
    if(previous!=target){
      val payload=Bundle()
      payload.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
        String.format(Locale.ROOT,"%d.%02d",target/100L,target%100L))
      val sent=try{input.node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,payload)}catch(_:Throwable){false}
      if(!sent)return "MG • EDITARE REFUZATĂ"
    }
    // The broker's UI may update asynchronously. The caller verifies two
    // fresh, matching chart readings before allowing rotation to resume.
    return "MG • SET_TEXT TRIMIS"
  }


  private fun tapAmountPoint637(svc:AccessibilityService,chart:Chart,x:Int,y:Int,
    overlay:Rect,allowed:()->Boolean):Boolean {
    if(x !in 1 until chart.w || y !in 1 until chart.h || overlay.contains(x,y) ||
      !allowed() || svc.rootInActiveWindow!=chart.root || positiveOpenBadge637(svc)!=null)return false
    val path=Path().apply{moveTo(x.toFloat(),y.toFloat())}
    val gesture=GestureDescription.Builder().addStroke(GestureDescription.StrokeDescription(path,0L,70L)).build()
    return try{svc.dispatchGesture(gesture,null,null)}catch(_:Throwable){false}
  }

  internal class CalculatorSession(val previous:Long,val target:Long){
    var steps=LiveMartingalePreview637.calculatorKeys(
      String.format(Locale.ROOT,"%d.%02d",previous/100L,previous%100L),target).orEmpty()
    var startupPrepared=false
    var index=0
    var sentAt=0L
    var retriedIndex=-1
    var closing=false
  }

  internal fun calculatorStep637(svc:AccessibilityService,expectedPackage:String,expectedBalance:Long,
    session:CalculatorSession,now:Long,overlay:Rect,visual:LiveMartingalePreview637.CalculatorFrame?,allowed:()->Boolean):String {
    if(!allowed())return "MG • CONT NECONFIRMAT"
    val chart=readChart(svc,false).first ?: return "MG • CALCULATOR NECITIT"
    if(chart.pkg!=expectedPackage || readChartPayout(chart).first!=92 ||
      positiveOpenBadge637(svc)!=null)return "MG • CONT/PAYOUT/ORDIN NECONFIRMAT"
    val (_,_,w,h,labels)=chart
    val header=labels.map{LiveMartingalePreview637.VisualLabel(it.value,it.rect.left.toFloat()/w,
      it.rect.top.toFloat()/h,it.rect.right.toFloat()/w,it.rect.bottom.toFloat()/h)}
    val balance=LiveMartingalePreview637.readHeaderBalance(header)
    if((balance!=null && balance!=expectedBalance) || (balance==null && visual?.balance!=expectedBalance) || expectedBalance<session.target)return "MG • SOLD NECONFIRMAT"
    if((readLiveSnapshot637(svc)?.openCount ?: 0)>0)return "MG • ORDIN ACTIV"
    val accessible=LiveMartingalePreview637.calculatorLayout(header)
    val optical=visual?.takeIf{now-it.at in 0L..2_500L && it.at>session.sentAt}?.layout
    if(visual!=null && optical==null && session.sentAt>0L)return "MG • AȘTEPT CITIREA CIFREI"
    if(accessible!=null && optical!=null && !LiveMartingalePreview637.calculatorEcho(accessible.raw,optical.raw))
      return "MG • CITIRI CALCULATOR DIFERITE"
    val layout=optical ?: accessible
    if(layout==null){
      val panelVisible=labels.any{it.value.equals("Calculator",true)}
      if(LiveMartingalePreview637.calculatorReadyForReadback(
          session.closing,session.steps.isNotEmpty() && session.index==session.steps.size,
          panelVisible,visual!=null,readLiveSnapshot637(svc)?.stake,session.target))
        return "MG • SET_TEXT TRIMIS"
      return "MG • TASTE CALCULATOR NECONFIRMATE"
    }
    val raw=layout.raw
    if(session.previous==100L && session.target==109L && !session.startupPrepared){
      session.steps=LiveMartingalePreview637.startupCalculatorKeys(raw)
        ?: return "MG • VALOARE INIȚIALĂ DIFERITĂ"
      session.startupPrepared=true
    }
    val desired=String.format(Locale.ROOT,"%d.%02d",session.target/100L,session.target%100L)
    if(session.closing)return "MG • AȘTEPT ÎNCHIDERE CALCULATOR"
    if(session.sentAt>0L){
      val last=session.steps.getOrNull(session.index-1) ?: return "MG • STARE CALCULATOR INVALIDĂ"
      // Even when two adjacent input states render the same numeric value,
      // wait for a new observation and the UI to settle before the next key.
      if(now-session.sentAt<900L)return "MG • AȘTEPT CIFRA"
      val cleared=LiveMartingalePreview637.keysAfterVerifiedClear(raw,last.key,session.target)
      if(cleared!=null){
        session.steps=cleared
        session.index=0
        session.retriedIndex=-1
      }else if(!LiveMartingalePreview637.calculatorStepEcho(raw,last)){
        if(LiveMartingalePreview637.calculatorBeforeEcho(raw,last) && now-session.sentAt<4_000L)
          return "MG • AȘTEPT CIFRA"
        if(LiveMartingalePreview637.canRetryUnchangedKey(raw,last,now-session.sentAt,
            session.retriedIndex==session.index-1,optical!=null)){
          val point=layout.keys[last.key] ?: return "MG • TASTĂ NECITITĂ"
          val x=(point.x*w).toInt();val y=(point.y*h).toInt()
          if(point.y<=layout.top || point.y>=layout.bottom ||
            !tapAmountPoint637(svc,chart,x,y,overlay,allowed))return "MG • TASTĂ REFUZATĂ"
          session.retriedIndex=session.index-1
          session.sentAt=now
          return "MG • REÎNCERC TASTA "+last.key+" • ȚINTĂ "+desired
        }
        return "MG • CIFRĂ NECONFIRMATĂ • "+last.key+" • VĂD "+raw+" • AȘTEPT "+last.after
      }
      session.sentAt=0L
    }
    if(session.index==session.steps.size){
      if(!LiveMartingalePreview637.calculatorEcho(raw,desired))return "MG • SUMĂ CALCULATOR DIFERITĂ"
      val fields=labels.filter{exactCents637(it.value)==session.target &&
        it.rect.left>=w*.48f && it.rect.centerY() in (h*.73f).toInt()..(h*.78f).toInt() &&
        it.rect.bottom<h*.783f}.map{it.rect}.distinct()
      val field=fields.singleOrNull() ?: return "MG • SUMĂ FINALĂ NECONFIRMATĂ"
      if(!tapAmountPoint637(svc,chart,field.centerX(),field.centerY(),overlay,allowed))
        return "MG • ÎNCHIDERE CALCULATOR REFUZATĂ"
      session.closing=true
      return "MG • AȘTEPT ÎNCHIDERE CALCULATOR"
    }
    val step=session.steps[session.index]
    if(!LiveMartingalePreview637.calculatorBeforeEcho(raw,step))
      return "MG • VALOARE INIȚIALĂ DIFERITĂ • VĂD "+raw+" • AȘTEPT "+step.before
    val point=layout.keys[step.key] ?: return "MG • TASTĂ NECITITĂ"
    val x=(point.x*w).toInt(); val y=(point.y*h).toInt()
    if(point.y<=layout.top || point.y>=layout.bottom ||
      !tapAmountPoint637(svc,chart,x,y,overlay,allowed))return "MG • TASTĂ REFUZATĂ"
    session.index++
    session.sentAt=now
    return "MG • VERIFIC CIFRA"
  }

  // Positive badge only. Its absence cannot authorize a stake edit.
  internal fun positiveOpenBadge637(svc:AccessibilityService):Int? {
    val chart=readChart(svc,false).first ?: return null
    val (_,_,w,h,labels)=chart
    val tabs=labels.filter {
      it.rect.centerX()<w*.36f && it.rect.centerY()>h*.83f &&
      Regex("""(?i)^(?:Tranzac[țţt]ii|Transactions|Trades)$""").matches(it.value.trim())
    }
    val positives=labels.filter { item ->
      item.value.matches(Regex("""[1-9]""")) &&
      item.rect.width()<=w*.08f && item.rect.height()<=h*.045f &&
      tabs.any { tab ->
        kotlin.math.abs(item.rect.centerX()-tab.rect.centerX())<w*.15f &&
        item.rect.centerY()>=tab.rect.centerY()-h*.065f &&
        item.rect.centerY()<=tab.rect.centerY()+h*.015f
      }
    }.mapNotNull{it.value.toIntOrNull()}.distinct()
    return positives.singleOrNull().takeIf{svc.rootInActiveWindow==chart.root}
  }

}
