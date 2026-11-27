package com.scalpatlas.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.*
import android.view.*
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat

/** Independent rotation, live reader and guarded QT Demo stake edit. No orders. */
class ScalpOverlayService : Service() {
  companion object {
    const val ACTION_START = "com.scalpatlas.app.START_OVERLAY"
    const val ACTION_STOP = "com.scalpatlas.app.STOP_OVERLAY"
    const val EXTRA_RESULT_CODE = "resultCode"
    const val EXTRA_RESULT_DATA = "resultData"
    private const val CHANNEL = "scalp_atlas_overlay"
    private const val NOTIFICATION = 4816
    private const val DWELL_MS = 30_000L
  }

  private val handler = Handler(Looper.getMainLooper())
  private lateinit var wm: WindowManager
  private var projection: MediaProjection? = null
  private var panel: LinearLayout? = null
  private var status: TextView? = null
  private var liveStatus: TextView? = null
  private var liveReader: LivePageObserver637? = null
  private var liveEye: LiveWatchEye637? = null
  private var eyeDetail: TextView? = null
  private var eyeHealth = 1
  private var eyeFrameAt = 0L
  private var eyeStartedAt = 0L
  private var eyeMessage = "Aștept prima citire LIVE"
  private var eyeFailed = false
  private val eyeWatchdog = object: Runnable {
    override fun run() {
      if(stopped || panel==null)return
      refreshEye()
      handler.postDelayed(this,500L)
    }
  }
  private fun refreshEye() {
    val now=SystemClock.elapsedRealtime()
    val age=if(eyeFrameAt>0L) (now-eyeFrameAt).coerceAtLeast(0L) else -1L
    val stale=if(eyeFrameAt>0L) age>5_000L else now-eyeStartedAt>5_000L
    val state=if(eyeFailed || stale) 0 else eyeHealth
    liveEye?.setReadingState(state)
    if(eyeDetail?.visibility==View.VISIBLE){
      val name=when(state){2->"LIVE ACTIV";1->"VERIFICARE";else->"LIVE INDISPONIBIL"}
      val detail=if(eyeFailed)"Cititorul nu a pornit" else if(stale)"Nu există citiri recente" else eyeMessage
      eyeDetail?.text=name+" • "+(if(age>=0L) "ultima citire "+age/1000+" s" else "fără cadru")+"\n"+detail
    }
  }
  private val tradePause=TradePause637()
  private var wasTradePaused=false
  private var latestPositionFrame=0L
  private var latestQuietFrame=0L
  private data class QueuedMg(val pkg:String,val pair:String,val old:Long,val target:Long,val balance:Long)
  private var queuedMg:QueuedMg?=null
  private var verifyingMg:Pair<QueuedMg,LiveMartingalePreview637.EditReadback>?=null
  private var openingMg:Pair<QueuedMg,Long>?=null
  private var mgEditBlocked:String?=null
  private fun observeTrade(at:Long,positive:Boolean,quiet:Boolean=false){
    if(positive){
      queuedMg=null
      if(verifyingMg!=null || openingMg!=null){
        verifyingMg=null;openingMg=null;mgEditBlocked="MG • ORDIN NOU ÎN TIMPUL VERIFICĂRII"
        liveReader?.suspendMg(mgEditBlocked!!)
      }
    }
    if(at<latestPositionFrame && !positive)return
    latestPositionFrame=maxOf(at,latestPositionFrame)
    latestQuietFrame=if(!positive && quiet)at else 0L
    tradePause.observe(at,positive,quiet)
  }
  private var stopped = false
  private var pair: String? = null
  private var deadline = 0L
  private var pendingPair: String? = null
  private var pendingUntil = 0L
  private var pendingPhysicalRetry = false
  private var pendingChartReads = 0
  private var selectorAttempts = 0
  private var forward = true
  private var reversed = false
  private var cleanAccountReads = 0
  private val visited = linkedSetOf<String>()
  private val rejected = mutableSetOf<String>()
  private val scrollHistory = mutableSetOf<List<String>>()
  private val eligible = mutableSetOf<String>()
  private val views = mutableSetOf<List<String>>()

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(CHANNEL,"Scalp Atlas Rotație",NotificationManager.IMPORTANCE_LOW))
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }
    if (intent?.action != ACTION_START || projection != null) return START_NOT_STICKY
    val stopIntent = Intent(this,ScalpOverlayService::class.java).apply { action = ACTION_STOP }
    val stop = PendingIntent.getService(this,4827,stopIntent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = NotificationCompat.Builder(this,CHANNEL)
      .setSmallIcon(android.R.drawable.ic_menu_rotate)
      .setContentTitle("Scalp Atlas • Rotație")
      .setContentText("30 secunde • QT Demo • 92%")
      .addAction(android.R.drawable.ic_menu_close_clear_cancel,"Oprește",stop)
      .setOngoing(true).build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
      startForeground(NOTIFICATION,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
    else startForeground(NOTIFICATION,notification)
    val code = intent.getIntExtra(EXTRA_RESULT_CODE,0)
    @Suppress("DEPRECATION")
    val data = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(EXTRA_RESULT_DATA,Intent::class.java)
      else intent.getParcelableExtra<Intent>(EXTRA_RESULT_DATA)
    if (code == 0 || data == null) { stopSelf(); return START_NOT_STICKY }
    try {
      // Explicit Android consent is used for the independent local reader.
      val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      val p = manager.getMediaProjection(code,data) ?: run { stopSelf(); return START_NOT_STICKY }
      projection = p
      p.registerCallback(object : MediaProjection.Callback() {
        override fun onStop() { stopSelf() }
      },handler)
      createPanel()
      eyeStartedAt=SystemClock.elapsedRealtime()
      handler.post(eyeWatchdog)
      // Failure of the independent reader never stops the rotation loop.
      try {
        liveReader=LivePageObserver637(this,handler,
          render={value -> handler.post{ if(!stopped)liveStatus?.text=value }},
          health={state,at,detail -> handler.post{
            if(!stopped && projection===p && at>=eyeFrameAt){
              eyeHealth=state;eyeFrameAt=at;eyeMessage=detail;refreshEye()
            }
          }},
          position={at,positive,quiet ->
            if(Looper.myLooper()==handler.looper){
              if(!stopped && projection===p)observeTrade(at,positive,quiet)
            }else handler.post{if(!stopped && projection===p)observeTrade(at,positive,quiet)}
          },
          settlement={handler.post{if(!stopped && projection===p)tradePause.settle()}},
          stakeReadback={pkg,pair,value,balance,at,quiet ->
            val pending=verifyingMg
            if(!stopped && projection===p && pending!=null && Looper.myLooper()==handler.looper){
              val (request,check)=pending
              if(check.observe(value,at,quiet && pkg==request.pkg && pair==request.pair && balance==request.balance)){
                verifyingMg=null;mgEditBlocked=null
                val msg="MG CONFIRMAT "+LiveMartingalePreview637.format(request.target)
                liveReader?.reportEdit(msg);liveStatus?.text=msg
              }
            }
          },
          applyStake={pkg,pair,old,target,balance ->
            if(stopped || projection!==p) "MG • LIVE OPRIT"
            else if(mgEditBlocked!=null) "MG • OPRIT ÎN ACEASTĂ SESIUNE"
            else if(Looper.myLooper()!=handler.looper || !tradePause.isLocked()) "MG • FĂRĂ AUTORIZARE"
            else {
              queuedMg=QueuedMg(pkg,pair,old,target,balance)
              "MG • AȘTEPT DEBLOCAREA"
            }
          }).also{it.start(p)}
      }catch(_:Throwable){liveReader?.close();liveReader=null;liveStatus?.text="LIVE INDISPONIBIL";eyeFailed=true;refreshEye()}
      handler.post(loop)
    } catch (_: Throwable) { stopSelf() }
    return START_NOT_STICKY
  }

  private fun dp(n: Int): Int = (n * resources.displayMetrics.density + .5f).toInt()

  private fun createPanel() {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(8),dp(4),dp(8),dp(6))
      background = GradientDrawable().apply {
        setColor(Color.rgb(248,249,252))
        cornerRadius = dp(14).toFloat()
        setStroke(dp(2),Color.rgb(117,83,189))
      }
    }
    val header = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
    val title = TextView(this).apply {
      text = "ROTAȚIE • QT DEMO"
      setTextColor(Color.rgb(35,46,69))
      textSize = 11f
    }
    val close = TextView(this).apply {
      text = "×"; textSize = 22f; gravity = Gravity.CENTER
      setTextColor(Color.rgb(35,46,69))
      contentDescription = "Oprește rotația"
      setOnClickListener { stopSelf() }
    }
    header.addView(title,LinearLayout.LayoutParams(0,dp(26),1f))
    header.addView(close,LinearLayout.LayoutParams(dp(28),dp(26)))
    root.addView(header)
    val label = TextView(this).apply {
      text = "AȘTEPT GRAFICUL"
      textSize = 11f
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      setPadding(dp(4),dp(5),dp(4),dp(5))
      background = GradientDrawable().apply { setColor(Color.rgb(67,85,115)); cornerRadius=dp(9).toFloat() }
    }
    root.addView(label,LinearLayout.LayoutParams(-1,-2))
    val liveLabel=TextView(this).apply {
      text="LIVE • VERIFIC";textSize=10f
      setTextColor(Color.rgb(35,46,69));gravity=Gravity.CENTER
    }
    val liveRow=LinearLayout(this).apply { gravity=Gravity.CENTER_VERTICAL }
    val detail=TextView(this).apply {
      textSize=10f;setTextColor(Color.rgb(35,46,69));visibility=View.GONE
    }
    val eye=LiveWatchEye637(this).apply {
      isClickable=true
      isFocusable=true
      setOnClickListener {
        detail.visibility=if(detail.visibility==View.VISIBLE) View.GONE else View.VISIBLE
        refreshEye()
      }
    }
    liveRow.addView(eye,LinearLayout.LayoutParams(dp(44),dp(32)))
    liveRow.addView(liveLabel,LinearLayout.LayoutParams(0,-2,1f))
    root.addView(liveRow,LinearLayout.LayoutParams(-1,-2))
    root.addView(detail,LinearLayout.LayoutParams(-1,-2))
    liveStatus=liveLabel;liveEye=eye;eyeDetail=detail
    val params = WindowManager.LayoutParams(dp(180),-2,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      PixelFormat.TRANSLUCENT)
    params.gravity = Gravity.TOP or Gravity.START
    val display = android.util.DisplayMetrics()
    @Suppress("DEPRECATION")
    wm.defaultDisplay.getRealMetrics(display)
    params.x = (display.widthPixels - dp(190)).coerceAtLeast(0)
    params.y = (display.heightPixels - dp(150)).coerceAtLeast(0)
    var startX=0; var startY=0; var touchX=0f; var touchY=0f
    val drag = View.OnTouchListener { _, event ->
      when(event.actionMasked) {
        MotionEvent.ACTION_DOWN -> { startX=params.x; startY=params.y; touchX=event.rawX; touchY=event.rawY; true }
        MotionEvent.ACTION_MOVE -> {
          params.x=(startX+(event.rawX-touchX).toInt()).coerceIn(0,(display.widthPixels-root.width).coerceAtLeast(0))
          params.y=(startY+(event.rawY-touchY).toInt()).coerceIn(0,(display.heightPixels-root.height-dp(40)).coerceAtLeast(0))
          try { wm.updateViewLayout(root,params) } catch (_: Throwable) {}
          true
        }
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> true
        else -> false
      }
    }
    title.setOnTouchListener(drag); label.setOnTouchListener(drag)
    panel=root; status=label; wm.addView(root,params)
  }

  private fun say(value: String) { status?.text=value }
  private fun bounds(): Rect {
    val v=panel ?: return Rect()
    val xy=IntArray(2); v.getLocationOnScreen(xy)
    return Rect(xy[0],xy[1],xy[0]+v.width,xy[1]+v.height)
  }

  private val loop=object: Runnable {
    override fun run() {
      if (stopped || projection == null || panel == null) return
      val next = try { rotate() } catch (_: Throwable) {
        say("REVERIFIC SELECTORUL"); 3_000L
      }
      if (!stopped) handler.postDelayed(this,next)
    }
  }

  private fun rotate(): Long {
    if (!TouchTestService.ready()) {
      cleanAccountReads=0; say("AȘTEPT ACCESIBILITATE"); return 2_000L
    }
    // No permanent account stop: retry read-only until clean QT Demo returns.
    // Never navigate an ambiguous account or a REAL account.
    if (!TouchTestService.demoFxAccountInForeground() ||
        TouchTestService.realFxAccountInForeground() || TouchTestService.realFxAccountVisible()) {
      cleanAccountReads=0; say("AȘTEPT QT DEMO"); return 2_000L
    }
    if (cleanAccountReads < 2) {
      cleanAccountReads++; say("VERIFIC QT DEMO"); return 1_000L
    }
    val now=SystemClock.elapsedRealtime()
    // Check on every rotation tick, before any selector action.
    val openSnapshot=TouchTestService.readLiveSnapshot637()
    if(TouchTestService.positiveOpenBadge637()!=null || (openSnapshot?.openCount ?: 0)>0)
      observeTrade(now,true)
    val protection=tradePause.remaining(now)
    if(protection!=null){
      wasTradePaused=true
      val sec=(protection+999L)/1000L
      say(if(sec>0L) "TRADE ACTIV • "+String.format(java.util.Locale.ROOT,"%02d:%02d",sec/60L,sec%60L)
        else "AȘTEPT ÎNCHIDEREA CONFIRMATĂ")
      return 500L
    }
    if(wasTradePaused){
      wasTradePaused=false;deadline=0L;pendingPair=null;pendingChartReads=0;pendingPhysicalRetry=false
      val request=queuedMg;queuedMg=null
      if(tradePause.releasedWithoutResult){
        verifyingMg=null
        mgEditBlocked="MG OPRIT • "+(liveReader?.diagnostic() ?: "REZULTAT NECONFIRMAT")
        liveReader?.suspendMg(mgEditBlocked!!)
        say("REIAU ROTAȚIA • FĂRĂ MG")
        return 500L
      }
      // Only a verified settlement may reach the editor. Recheck open count
      // and the current graph independently immediately before a single edit.
      if(request!=null){
        val freshQuiet=latestQuietFrame>0L && now-latestQuietFrame in 0L..3_000L
        val result=if(!tradePause.isLocked() && freshQuiet &&
          TouchTestService.positiveOpenBadge637()==null &&
          TouchTestService.readLiveSnapshot637()?.let{it.openCount==null || it.openCount==0}==true)
          TouchTestService.applyVerifiedMg637(request.pkg,request.pair,request.old,request.target,request.balance,
            visualClosureVerified=true)
        else "MG • EDITARE BLOCATĂ"
        if(result=="MG • SET_TEXT TRIMIS"){
          verifyingMg=request to LiveMartingalePreview637.EditReadback(request.target,now)
        }else if(result=="MG • EDITOR DESCHIS"){
          openingMg=request to now
        }else{
          mgEditBlocked=result+" • ȚINTĂ "+LiveMartingalePreview637.format(request.target)
          liveReader?.suspendMg(mgEditBlocked!!)
        }
        liveStatus?.text=mgEditBlocked ?: result
        liveReader?.reportEdit(mgEditBlocked ?: result)
      }
      say(if(openingMg!=null)"MG • ACTIVEZ SUMA" else if(verifyingMg!=null)"MG • VERIFIC MIZA" else if(mgEditBlocked!=null)"MG • MIZĂ NECONFIRMATĂ" else "ÎNCHIDERE CONFIRMATĂ • REIAU ROTAȚIA")
      return 500L
    }
    val opening=openingMg
    if(opening!=null){
      val (request,started)=opening
      if(now-started<600L)return 500L
      val freshQuiet=latestQuietFrame>0L && now-latestQuietFrame in 0L..3_000L
      val result=if(!tradePause.isLocked() && freshQuiet &&
        TouchTestService.positiveOpenBadge637()==null)
        TouchTestService.applyVerifiedMg637(request.pkg,request.pair,request.old,request.target,request.balance,
          visualClosureVerified=true,allowOpen=false)
      else "MG • AȘTEPT EDITORUL"
      if(result=="MG • SET_TEXT TRIMIS"){
        openingMg=null
        verifyingMg=request to LiveMartingalePreview637.EditReadback(request.target,now)
        liveReader?.reportEdit(result)
      }else if(now-started>=8_000L){
        openingMg=null
        mgEditBlocked=result+" • ȚINTĂ "+LiveMartingalePreview637.format(request.target)
        liveReader?.suspendMg(mgEditBlocked!!)
        liveStatus?.text=mgEditBlocked
      }
      say("MG • VERIFIC EDITOR SUMĂ")
      return 500L
    }
    val verification=verifyingMg
    if(verification!=null){
      if(verification.second.expired(now)){
        verifyingMg=null
        mgEditBlocked="MG • MIZĂ NEVERIFICATĂ • ȚINTĂ "+LiveMartingalePreview637.format(verification.first.target)
        liveReader?.suspendMg(mgEditBlocked!!)
      }
      say("MG • VERIFIC MIZA");return 500L
    }
    // A failed MG edit disables further edits, not the navigation motor.
    if(mgEditBlocked!=null){liveStatus?.text=mgEditBlocked}
    // No new selector actions while LIVE has not supplied a recent position frame.
    if(latestPositionFrame==0L || now-latestPositionFrame>3_500L){
      say("AȘTEPT VERIFICAREA TRADE");return 500L
    }
    if (TouchTestService.fxListVisible(false)) {
      val requested=pendingPair
      if (requested != null) {
        if (now < pendingUntil) return 750L
        // ACTION_CLICK may report success while the currency selector remains open.
        // Retry the SAME verified 92% row once via the guarded row gesture.
        if (!pendingPhysicalRetry) {
          pendingPhysicalRetry=true
          val retry=TouchTestService.navigateOpenFxList(emptySet(),false,forward,bounds(),
            onlyPair=requested,realAccount=false)
          if (retry.pair==requested) {
            pendingUntil=now+8_000L
            say("RECONFIRM "+requested)
            return 1_250L
          }
        }
        rejected.add(requested)
        pendingPair=null; pendingPhysicalRetry=false; pendingChartReads=0
      }
      if (visited.size >= 10) {
        val previous=pair
        visited.clear(); rejected.clear(); eligible.clear(); views.clear(); scrollHistory.clear()
        previous?.let { rejected.add(it) }; reversed=false; forward=true
      }
      val result=TouchTestService.navigateOpenFxList(visited+rejected,true,forward,bounds(),
        scrollHistory=scrollHistory,observedEligible=eligible,observedViewports=views,realAccount=false)
      if (result.pair != null) {
        pendingPair=result.pair; pendingUntil=now+8_000L
        pendingPhysicalRetry=false; pendingChartReads=0
        say("VERIFIC "+result.pair); return 1_250L
      }
      if (result.rejectedPair != null) {
        rejected.add(result.rejectedPair); return 500L
      }
      if (result.scrolled) return 750L
      if (result.endOfList) {
        if (!reversed) { reversed=true; forward=!forward; scrollHistory.clear(); return 500L }
        // Recycle only after a full two-direction sweep. Never claim ten
        // distinct pairs if the broker made fewer available.
        val last=pair
        visited.clear(); rejected.clear(); scrollHistory.clear(); eligible.clear(); views.clear()
        last?.let { rejected.add(it) }; forward=true; reversed=false
        if (TouchTestService.fxListVisible(false)) TouchTestService.closeVisibleFxList506(false)
        deadline=0L; say("REIAU LISTA 92%"); return 2_000L
      }
      say("VERIFIC LISTA VALUTE"); return 2_000L
    }
    val current=TouchTestService.readVisibleFxPair(false)
    if (current == null) { say("AȘTEPT GRAFICUL QT DEMO"); return 2_000L }
    val payout=TouchTestService.readFxChartPayout(current,false)
    if (payout == null) {
      // A temporarily missing quote is not a signal to reopen the selector.
      pendingChartReads=0
      say("PAYOUT NECITIT"); return 2_000L
    }
    val eligiblePair=TouchTestService.isPreferredFxPair517(current) && payout==92
    var selectedConfirmed=false
    val requested=pendingPair
    if (requested != null) {
      if (current==requested && eligiblePair) {
        pendingChartReads++
        if (pendingChartReads<2) {
          say("CONFIRM GRAFIC "+current); return 1_000L
        }
        selectedConfirmed=true
      } else {
        pendingChartReads=0
        if (now < pendingUntil) {
          say("AȘTEPT GRAFIC "+requested); return 750L
        }
        rejected.add(requested)
      }
      pendingPair=null; pendingPhysicalRetry=false; pendingChartReads=0; selectorAttempts=0
    }
    if (selectedConfirmed || current != pair || deadline==0L) {
      pair=current
      if (eligiblePair) {
        // The complete 30 seconds begin ONLY after the selected chart is confirmed.
        visited.add(current); deadline=now+DWELL_MS
      } else deadline=now
      selectorAttempts=0
      scrollHistory.clear(); forward=true; reversed=false
    }
    val remaining=deadline-now
    if (eligiblePair && remaining>0L) {
      say(current+" • "+((remaining+999)/1000)+" S • "+visited.size+"/10")
      return minOf(1_000L,remaining)
    }
    // No trading controls or history actions are reachable from this controller.
    say("ROTAȚIE • VALUTE 92%")
    val opened=when(selectorAttempts++ % 3) {
      0 -> TouchTestService.reopenFxList(current,bounds(),false,false)
      1 -> TouchTestService.reopenFxList(current,bounds(),false,false,alternateClickable519=true)
      else -> TouchTestService.tapVerifiedDemoFxSelector515(current,bounds())
    }
    return if (opened) 1_000L else 3_000L
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    if (projection == null) stopSelf()
  }
  override fun onDestroy() {
    stopped=true; handler.removeCallbacksAndMessages(null)
    try { panel?.let { wm.removeView(it) } } catch (_: Throwable) {}
    liveReader?.close();liveReader=null;liveStatus=null
    liveEye=null;eyeDetail=null
    panel=null; status=null
    try { projection?.stop() } catch (_: Throwable) {}
    projection=null
    super.onDestroy()
  }
}
