package com.scalpatlas.app

/** Navigation lock. An unverified release never authorizes a stake edit. */
internal class TradePause637 {
  private var started:Long?=null
  private var lastPositive=0L
  private var quietSince:Long?=null
  private var lastQuiet=0L
  private var settled=false
  var releasedWithoutResult=false
    private set
  fun isLocked():Boolean=started!=null
  fun observe(now:Long, positive:Boolean, clearHint:Boolean=false) {
    if(positive){
      if(started==null){started=now;releasedWithoutResult=false}
      settled=false
      lastPositive=now;quietSince=null
    }else if(started!=null){
      if(clearHint){if(quietSince==null || now-lastQuiet>5_000L)quietSince=now;lastQuiet=now}
      else quietSince=null
    }
  }
  fun settle(){if(started!=null)settled=true}
  fun remaining(now:Long):Long? {
    val at=started ?: return null
    val age=(now-at).coerceAtLeast(0L)
    val quiet=quietSince?.let{now-it>=2_000L}==true && now-lastPositive>=2_000L && now-lastQuiet in 0L..5_000L
    if(age>=300_000L && quiet && settled){
      releasedWithoutResult=false
      started=null;quietSince=null;settled=false
      return null
    }
    // Navigation alone may resume after sustained, fresh clear-chart evidence.
    // This path must discard any queued edit and disable MG for this session.
    val sustainedQuiet=quiet && quietSince?.let{now-it>=10_000L}==true
    if(age>=315_000L && sustainedQuiet && !settled){
      releasedWithoutResult=true
      started=null;quietSince=null;settled=false
      return null
    }
    // Never release on time alone or a single missing badge.
    return (300_000L-age).coerceAtLeast(0L)
  }
}
