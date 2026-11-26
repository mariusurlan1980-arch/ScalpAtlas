package com.scalpatlas.app

/** Locks all broker mutations until minimum duration and verified settlement. */
internal class TradePause637 {
  private var started:Long?=null
  private var lastPositive=0L
  private var quietSince:Long?=null
  private var lastQuiet=0L
  private var settled=false
  fun isLocked():Boolean=started!=null
  fun observe(now:Long, positive:Boolean, clearHint:Boolean=false) {
    if(positive){
      if(started==null){started=now}
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
      started=null;quietSince=null;settled=false
      return null
    }
    // Never release on elapsed time or missing badge alone.
    return (300_000L-age).coerceAtLeast(0L)
  }
}
