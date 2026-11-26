package com.scalpatlas.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

/** Independent observer with one verified demo stake edit after settlement. */
internal class LivePageObserver637(
  private val context:Context,
  private val main:Handler,
  private val render:(String)->Unit,
  private val health:(Int,Long,String)->Unit,
  private val position:(Long,Boolean,Boolean)->Unit,
  private val settlement:()->Unit,
  private val applyStake:(String,String,Long,Long,Long)->String
) {
  private val worker=HandlerThread("ScalpLiveRead637")
  private var reader:ImageReader?=null
  private var display:VirtualDisplay?=null
  private val recognizer=TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  @Volatile private var closed=false
  private var busy=false
  private var lastFrame=0L
  private data class Sample(val pair:String,val pkg:String,val stake:Long,val balance:Long)
  private data class Attempt(val baseline:Sample,val opened:Long)
  private var baseline:Sample?=null
  private var baselineAt=0L
  private var attempt:Attempt?=null
  private var candidate:LiveMartingalePreview637.Result?=null
  private var candidateAt=0L
  private var confirmedResult=false
  private var zeroAt=0L
  private var zeroLastAt=0L
  private var zeroResult:LiveMartingalePreview637.Result?=null
  private var reported:String?=null

  fun start(projection:MediaProjection) {
    val m=context.resources.displayMetrics
    worker.start()
    val handler=Handler(worker.looper)
    val images=ImageReader.newInstance(m.widthPixels,m.heightPixels,PixelFormat.RGBA_8888,2)
    reader=images
    display=projection.createVirtualDisplay("ScalpAtlasLiveReader",m.widthPixels,m.heightPixels,m.densityDpi,
      DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,images.surface,null,handler)
    images.setOnImageAvailableListener({ source ->
      val image=try{source.acquireLatestImage()}catch(_:Throwable){null} ?: return@setOnImageAvailableListener
      if(closed || busy || SystemClock.elapsedRealtime()-lastFrame<1_200L){
        image.close();return@setOnImageAvailableListener
      }
      lastFrame=SystemClock.elapsedRealtime()
      val captured=lastFrame
      val bitmap=try{
        val plane=image.planes[0]
        val padded=plane.rowStride/plane.pixelStride
        val raw=Bitmap.createBitmap(padded,image.height,Bitmap.Config.ARGB_8888)
        raw.copyPixelsFromBuffer(plane.buffer)
        val crop=Bitmap.createBitmap(raw,0,0,image.width,image.height)
        if(crop!==raw)raw.recycle()
        crop
      }catch(_:Throwable){null}finally{image.close()}
      if(bitmap==null)return@setOnImageAvailableListener
      busy=true
      val visualBadge=try{LiveMartingalePreview637.bluePositionBadge(bitmap.width,bitmap.height,bitmap::getPixel)}
        catch(_:Throwable){false}
      // Immediate positive signal even if OCR is slow or the selector is open.
      if(visualBadge)main.post{
        if(!closed && TouchTestService.demoFxAccountInForeground() &&
           !TouchTestService.realFxAccountVisible())position(captured,true,false)
      }
      try{
        recognizer.process(InputImage.fromBitmap(bitmap,0))
          .addOnSuccessListener{ result ->
            if(!closed) {
              val labels=result.textBlocks.flatMap{block->block.lines.flatMap{line->line.elements}}
                .mapNotNull{element ->
                  val rect=element.boundingBox ?: return@mapNotNull null
                  LiveMartingalePreview637.VisualLabel(element.text,
                    rect.left.toFloat()/bitmap.width,rect.top.toFloat()/bitmap.height,
                    rect.right.toFloat()/bitmap.width,rect.bottom.toFloat()/bitmap.height)
                }
              inspect(result.textBlocks.map{it.text},labels,captured,visualBadge)
            }
          }
          .addOnCompleteListener{
            bitmap.recycle(); handler.post{busy=false}
          }
      }catch(_:Throwable){bitmap.recycle();busy=false}
    },handler)
  }

  private fun inspect(blocks:List<String>, labels:List<LiveMartingalePreview637.VisualLabel>, captured:Long,visualBadge:Boolean) {
    if(closed || SystemClock.elapsedRealtime()-captured !in 0L..2_500L)return
    val screenText=blocks.joinToString(" ").uppercase(java.util.Locale.ROOT)
    val compact=screenText.replace(Regex("""[\s()]"""),"")
    val hint=LiveMartingalePreview637.readPositionHint(labels)
    val demoFrame=compact.contains("QTDEMO") && !compact.contains("QTREAL")
    val badge=if(demoFrame) TouchTestService.positiveOpenBadge637() ?: hint.positive
      ?: if(visualBadge)1 else null else null
    // Positive badge must be processed BEFORE requiring a chart snapshot.
    if(demoFrame && badge!=null && TouchTestService.demoFxAccountInForeground() &&
       !TouchTestService.realFxAccountVisible())position(captured,true,false)
    val snap=TouchTestService.readLiveSnapshot637()
    val pair=TouchTestService.readVisibleFxPair(false)
    if(snap==null || pair==null){
      if(badge==null)position(captured,false,false)
      zeroAt=0L;zeroLastAt=0L;zeroResult=null
      health(1,captured,if(badge!=null)"Trade activ • selector deschis" else "Grafic QT Demo sau payout 92% neconfirmat")
      render(if(badge!=null)"LIVE • TRADE ACTIV • ÎNCHIDE LISTA" else reported ?: "LIVE • AȘTEPT GRAFICUL")
      return
    }
    val stake=snap.stake
    val bal=snap.balance
    // Eye state is diagnostic only: it cannot grant stake or rotation permission.
    val pairText=pair.uppercase(java.util.Locale.ROOT).replace(Regex("""[\s()]"""),"")
    val chartText=compact.contains("QTDEMO") && compact.contains(pairText)
    val visualStake=if(chartText) LiveMartingalePreview637.readDisplayedStake(labels) else null
    // Reject conflicting sources. OCR alone is a display reading, not an editable field.
    val displayedStake=if(stake!=null && visualStake!=null && stake!=visualStake) null else stake ?: visualStake
    val freshChart=chartText && displayedStake!=null && bal!=null
    val positive=(snap.openCount ?: 0)>0 || badge!=null || visualBadge
    val visualQuiet=chartText && hint.tabSeen && badge==null && !visualBadge && (snap.openCount==null || snap.openCount==0)
    position(captured,positive,visualQuiet || (snap.openCount==0 && !positive))
    val stakeDetail=when {
      displayedStake==null -> "necunoscută"
      stake==null -> "OCR (doar citire)"
      else -> "accesibilitate"
    }
    health(if(freshChart)2 else 1,captured,
      "Pereche: "+pair+" • sumă: "+stakeDetail+
        " • sold: "+(if(bal!=null)"citit" else "necunoscut")+
        " • poziții: "+(snap.openCount?.toString()?:"necunoscute"))
    val fmt=LiveMartingalePreview637::format
    val now=SystemClock.elapsedRealtime()
    val pending=attempt
    if(pending==null){
      val previous=baseline
      // A debit is precautionary evidence for pausing rotation, not permission to edit.
      val debit=previous!=null && displayedStake!=null && bal!=null &&
        previous.pkg==snap.pkg && previous.pair==pair && previous.stake==displayedStake &&
        now-baselineAt in 1L..45_000L && previous.balance-bal==displayedStake
      if(debit)position(captured,true,false)
      if(positive || debit){
        if(debit && previous!=null && (snap.openCount==1 || badge==1)){
          attempt=Attempt(previous,now)
          candidate=null;candidateAt=0;confirmedResult=false;zeroAt=0;zeroLastAt=0;zeroResult=null;reported=null
          baseline=null
        }
      }else if((snap.openCount==0 || visualQuiet) && displayedStake!=null && bal!=null &&
          displayedStake in LiveMartingalePreview637.ladder){
        baseline=Sample(pair,snap.pkg,displayedStake,bal);baselineAt=captured
      }else baseline=null
      val detail="LIVE • MIZĂ "+(displayedStake?.let(fmt)?:"?")+" • SOLD "+(bal?.let(fmt)?:"?")
      render(if(attempt!=null || positive || debit) "LIVE • TRADE OBSERVAT • "+(bal?.let(fmt)?:"?") else reported ?: detail)
      return
    }
    if(pending.baseline.pkg!=snap.pkg || pair!=pending.baseline.pair || snap.openCount?.let{it>1}==true || badge?.let{it>1}==true || now-pending.opened>420_000L){
      attempt=null;baseline=null;candidate=null;zeroAt=0
      reported="MG • REZULTAT NECONFIRMAT"
      render(reported!!);return
    }
    if(now-pending.opened !in 285_000L..420_000L){
      render("LIVE • AȘTEPT REZULTAT");return
    }
    val result=LiveMartingalePreview637.parse(blocks,pending.baseline.pair,pending.baseline.stake)
    if(result!=null){
      if(candidate!=null && candidate!=result){
        attempt=null;baseline=null;candidate=null;reported="MG • DATE CONTRADICTORII"
        render(reported!!);return
      }
      if(candidate==null){candidate=result;candidateAt=captured}
      else if(captured-candidateAt>=1_000L) confirmedResult=true
    }
    // No ephemeral receipt is required if the one observed debit and stable
    // post-expiry balance agree exactly and the visible Trades badge is gone.
    val before=pending.baseline.balance
    val quiet=chartText && !positive && (snap.openCount==0 || visualQuiet)
    val inferred=bal?.let{LiveMartingalePreview637.settledBalance(pair,pending.baseline.stake,before,it,
      now-pending.opened,quiet)}
    val verified=if(inferred!=null && (candidate==null || candidate==inferred)) inferred else null
    if(verified!=null && displayedStake==pending.baseline.stake && bal!=null && bal-before==verified.net){
      if(zeroResult!=verified || zeroAt==0L || captured-zeroLastAt>4_000L){
        zeroResult=verified;zeroAt=captured
      }
      zeroLastAt=captured
      if(captured-zeroAt>=3_000L){
        val next=LiveMartingalePreview637.next(pending.baseline.stake,verified)
        val old=pending.baseline.stake
        // Consume this trade once. The overlay performs one edit only after
        // releasing the existing five-minute protection.
        attempt=null;baseline=null;candidate=null;zeroAt=0;zeroLastAt=0;zeroResult=null;confirmedResult=false
        val editStatus=if(verified.draw) "MG • MIZĂ PĂSTRATĂ"
          else if(next==null) "MG STOP • LIMITĂ 10"
          else if(!LiveMartingalePreview637.permitsEdit(old,next,displayedStake,bal,0,before+verified.net))
            "MG • MIZĂ NESCHIMBATĂ"
          else try { applyStake(snap.pkg,pair,old,next,bal) }
            catch(_:Throwable) { "MG • EDITARE NEVERIFICATĂ" }
        settlement()
        reported=(if(verified.draw)"DRAW" else if(verified.win)"WIN" else "LOSS")+" • "+editStatus
        render(reported!!);return
      }
    }else {zeroAt=0;zeroLastAt=0;zeroResult=null}
    render(if(positive)"LIVE • TRADE ACTIV" else "LIVE • VERIFIC SOLD FINAL")
  }

  fun reportEdit(value:String){reported=value;render(value)}

  fun close(){
    closed=true
    try{reader?.setOnImageAvailableListener(null,null)}catch(_:Throwable){}
    try{display?.release()}catch(_:Throwable){}
    try{reader?.close()}catch(_:Throwable){}
    try{recognizer.close()}catch(_:Throwable){}
    try{worker.quitSafely()}catch(_:Throwable){}
  }
}
