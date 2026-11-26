package com.scalpatlas.app

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
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

  internal data class LiveSnapshot(val pkg:String,val stake:Long?,val balance:Long?,val openCount:Int?,val tradesFooterSeen:Boolean=false)

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

  internal fun readLiveSnapshot637(svc:AccessibilityService):LiveSnapshot? {
    val chart=readChart(svc,false).first ?: return null
    if(readChartPayout(chart).first != 92) return null
    val (_,pkg,w,h,labels)=chart
    val captions=labels.filter {
      it.rect.centerX()>w*.46f && it.rect.centerY() in (h*.62f).toInt()..(h*.88f).toInt() &&
        Regex("""(?i)^Sum[ăa]\s*:?$""").matches(it.value)
    }
    val anchor=captions.firstOrNull()
    val stakes=if(anchor==null || captions.any{
      kotlin.math.abs(it.rect.centerY()-anchor.rect.centerY())>h*.035f
    }) emptyList() else labels.filter{
      it.node.isEnabled && it.node.actionList.any{a->a.id==AccessibilityNodeInfo.ACTION_SET_TEXT} &&
      it.rect.centerX()>=anchor.rect.left-w*.04f && it.rect.centerX()<=anchor.rect.right+w*.18f &&
      it.rect.centerY()>=anchor.rect.bottom-h*.015f && it.rect.centerY()<=anchor.rect.bottom+h*.065f
    }.mapNotNull{exactCents637(it.value)}.distinct()
    val balances=labels.filter{
      it.rect.centerX() in (w*.48f).toInt()..(w*.86f).toInt() && it.rect.centerY()<h*.17f
    }.mapNotNull{exactCents637(it.value)}.distinct()
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
    return LiveSnapshot(pkg,stakes.singleOrNull(),balances.singleOrNull(),open,footer)
  }


  // One exact input edit, only after independently observed settlement.
  internal fun editVerifiedStake637(
    svc:AccessibilityService, expectedPackage:String, previous:Long, target:Long,
    expectedBalance:Long, visualClosureVerified:Boolean, stillAuthorized:()->Boolean
  ):String {
    if(!stillAuthorized())return "MG • CONT NECONFIRMAT"
    val chart=readChart(svc,false).first ?: return "MG • GRAFIC NECITIT"
    if(chart.pkg!=expectedPackage || readChartPayout(chart).first!=92)
      return "MG • CONT/PAYOUT NECONFIRMAT"
    val snap=readLiveSnapshot637(svc) ?: return "MG • DATE NECITITE"
    val open=snap.openCount ?: if(visualClosureVerified && positiveOpenBadge637(svc)==null)0 else null
    if(snap.stake==null)return "MG • CÂMP SUMĂ FĂRĂ EDITARE"
    if(snap.pkg!=expectedPackage ||
        !LiveMartingalePreview637.permitsEdit(previous,target,snap.stake,snap.balance,open,expectedBalance))
      return "MG • MIZĂ NESCHIMBATĂ"
    val (_,_,w,h,labels)=chart
    val anchors=labels.filter {
      it.rect.centerX()>w*.46f && it.rect.centerY() in (h*.62f).toInt()..(h*.88f).toInt() &&
      it.rect.width()<=w*.48f && Regex("""(?i)^Sum[ăa]\s*:?$""").matches(it.value)
    }
    val anchor=anchors.firstOrNull() ?: return "MG • ETICHETĂ SUMĂ NECITITĂ"
    if(anchors.any { kotlin.math.abs(it.rect.centerY()-anchor.rect.centerY())>h*.035f ||
      kotlin.math.abs(it.rect.centerX()-anchor.rect.centerX())>w*.15f })
      return "MG • MAI MULTE CÂMPURI SUMĂ"
    val inputs=labels.filter {
      it.node.isEnabled && it.node.isVisibleToUser &&
      it.node.packageName?.toString()==expectedPackage &&
      it.rect.centerX()>=anchor.rect.left-w*.04f && it.rect.centerX()<=anchor.rect.right+w*.18f &&
      it.rect.centerY()>=anchor.rect.bottom-h*.015f && it.rect.centerY()<=anchor.rect.bottom+h*.065f &&
      it.rect.height()<=h*.09f && exactCents637(it.value)==previous &&
      it.node.actionList.any { a->a.id==AccessibilityNodeInfo.ACTION_SET_TEXT }
    }.distinctBy { it.rect.toShortString() }
    val input=inputs.singleOrNull() ?: return "MG • CÂMP SUMĂ NECONFIRMAT"
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
