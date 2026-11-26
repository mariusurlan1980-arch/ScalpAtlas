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
              inspect(result.textBlocks.map{it.text},labels,captured)
            }
          }
          .addOnCompleteListener{
            bitmap.recycle(); handler.post{busy=false}
          }
      }catch(_:Throwable){bitmap.recycle();busy=false}
    },handler)
  }

  private fun inspect(blocks:List<String>, labels:List<LiveMartingalePreview637.VisualLabel>, captured:Long) {
    if(closed || SystemClock.elapsedRealtime()-captured !in 0L..2_500L)return
    val snap=TouchTestService.readLiveSnapshot637()
    val pair=TouchTestService.readVisibleFxPair(false)
    if(snap==null || pair==null){
      health(1,captured,"Grafic QT Demo sau payout 92% neconfirmat")
      render(reported ?: "LIVE • AȘTEPT GRAFICUL")
      return
    }
    val stake=snap.stake
    val bal=snap.balance
    // Eye state is diagnostic only: it cannot grant stake or rotation permission.
    val screenText=blocks.joinToString(" ").uppercase(java.util.Locale.ROOT)
    val compact=screenText.replace(Regex("""[\s()]"""),"")
    val pairText=pair.uppercase(java.util.Locale.ROOT).replace(Regex("""[\s()]"""),"")
    val chartText=compact.contains("QTDEMO") && compact.contains(pairText)
    val visualStake=if(chartText) LiveMartingalePreview637.readDisplayedStake(labels) else null
    // Reject conflicting sources. OCR alone is a display reading, not an editable field.
    val displayedStake=if(stake!=null && visualStake!=null && stake!=visualStake) null else stake ?: visualStake
    val freshChart=chartText && displayedStake!=null && bal!=null
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
      if(snap.openCount==0 && stake!=null && bal!=null && stake in LiveMartingalePreview637.ladder){
        val current=Sample(pair,snap.pkg,stake,bal)
        baseline=current;baselineAt=captured
      }else if(snap.openCount==1 && stake!=null && bal!=null){
        val previous=baseline
        if(previous!=null && previous.pkg==snap.pkg && previous.pair==pair && previous.stake==stake &&
            now-baselineAt in 1L..45_000L && previous.balance-bal==stake){
          attempt=Attempt(previous,now)
          candidate=null;candidateAt=0;confirmedResult=false;zeroAt=0;reported=null
        }
        baseline=null
      }else if(snap.openCount!=0)baseline=null
      val detail="LIVE • MIZĂ "+(displayedStake?.let(fmt)?:"?")+" • SOLD "+(bal?.let(fmt)?:"?")
      render(reported ?: if(attempt!=null) "LIVE • TRADE OBSERVAT" else detail)
      return
    }
    if(pending.baseline.pkg!=snap.pkg || snap.openCount?.let{it>1}==true || now-pending.opened>420_000L){
      attempt=null;baseline=null;candidate=null;zeroAt=0
      reported="MG • REZULTAT NECONFIRMAT"
      render(reported!!);return
    }
    if(now-pending.opened !in 240_000L..360_000L){
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
    // Retain two matching receipt samples while reading two independent
    // zero-open balances. Missing OCR never counts as a receipt.
    val verified=candidate
    if(confirmedResult && verified!=null){
      val before=pending.baseline.balance
      if(snap.openCount==0 && bal!=null && bal-before==verified.net){
        if(zeroAt==0L)zeroAt=captured
        else if(captured-zeroAt>=1_000L){
          val next=LiveMartingalePreview637.next(pending.baseline.stake,verified)
          // Consume this observation before the single edit. No delayed retry.
          attempt=null;baseline=null;candidate=null;zeroAt=0;confirmedResult=false
          val editStatus=if(next==null) "MG STOP • LIMITĂ 10"
            else if(!LiveMartingalePreview637.permitsEdit(pending.baseline.stake,next,
              stake,bal,snap.openCount,before+verified.net)) "MG • MIZĂ NESCHIMBATĂ"
            else try { applyStake(snap.pkg,pair,pending.baseline.stake,next,bal) }
              catch(_:Throwable) { "MG • EDITARE NEVERIFICATĂ" }
          reported=(if(verified.win)"WIN" else "LOSS")+" • "+editStatus
          render(reported!!);return
        }
      }else zeroAt=0
    }
    render("LIVE • AȘTEPT DOVADĂ WIN/LOSS")
  }

  fun close(){
    closed=true
    try{reader?.setOnImageAvailableListener(null,null)}catch(_:Throwable){}
    try{display?.release()}catch(_:Throwable){}
    try{reader?.close()}catch(_:Throwable){}
    try{recognizer.close()}catch(_:Throwable){}
    try{worker.quitSafely()}catch(_:Throwable){}
  }
}
