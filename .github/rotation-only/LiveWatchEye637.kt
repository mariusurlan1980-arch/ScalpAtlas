package com.scalpatlas.app

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.os.SystemClock
import android.view.View
import kotlin.math.sin

/** An interactive visual readout. No broker actions or order permissions. */
internal class LiveWatchEye637(context:Context):View(context) {
  private val paint=Paint(Paint.ANTI_ALIAS_FLAG)
  private val shape=Path()
  private var state=1
  init { contentDescription="Ochi LIVE, verificare. Atinge pentru detalii." }
  fun setReadingState(value:Int) {
    if(state==value)return
    state=value
    contentDescription="Ochi LIVE, "+when(state){2->"activ";1->"verificare";else->"indisponibil"}+". Atinge pentru detalii."
    invalidate()
  }
  override fun onDraw(canvas:Canvas) {
    super.onDraw(canvas)
    canvas.save()
    canvas.scale(width/32f,height/26f)
    val now=SystemClock.elapsedRealtime()
    val tint=when(state){2->Color.rgb(15,142,92);1->Color.rgb(184,110,14);else->Color.rgb(190,52,66)}
    // Blink and sweep only while a verified live chart is being read.
    val phase=now%4_600L
    val aperture=if(state==2 && phase<170L) 1f+6f*kotlin.math.abs(phase-85L)/85f else 7f
    shape.reset()
    shape.moveTo(2f,13f)
    shape.quadTo(16f,13f-2f*aperture,30f,13f)
    shape.quadTo(16f,13f+2f*aperture,2f,13f)
    shape.close()
    paint.style=Paint.Style.FILL;paint.color=Color.WHITE
    canvas.drawPath(shape,paint)
    paint.style=Paint.Style.STROKE;paint.strokeWidth=1.6f;paint.color=tint
    canvas.drawPath(shape,paint)
    if(aperture>3f){
      canvas.save();canvas.clipPath(shape)
      val x=16f+if(state==2) 4f*sin(now/360.0).toFloat() else 0f
      paint.style=Paint.Style.FILL;paint.color=tint
      canvas.drawCircle(x,13f,4.5f,paint)
      paint.color=Color.rgb(20,37,45);canvas.drawCircle(x,13f,2.2f,paint)
      paint.color=Color.WHITE;canvas.drawCircle(x-1.3f,11.4f,1.1f,paint)
      canvas.restore()
    }
    canvas.restore()
    if(state==2 && isAttachedToWindow)postInvalidateDelayed(65L)
  }
}
