package com.scalpatlas.app

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.os.SystemClock
import android.view.View
import kotlin.math.sin

/** Interactive radar readout only. No broker actions or order permissions. */
internal class LiveWatchEye637(context:Context):View(context) {
  private val paint=Paint(Paint.ANTI_ALIAS_FLAG)
  private val shape=Path()
  private val arc=RectF()
  private var state=1
  init { contentDescription="Ochi radar LIVE, verificare. Atinge pentru detalii." }
  fun setReadingState(value:Int) {
    if(state==value)return
    state=value
    contentDescription="Ochi radar LIVE, "+when(state){2->"activ";1->"verificare";else->"indisponibil"}+". Atinge pentru detalii."
    invalidate()
  }
  override fun onDraw(canvas:Canvas) {
    super.onDraw(canvas)
    canvas.save()
    val scale=minOf(width/48f,height/34f)
    if(scale<=0f){canvas.restore();return}
    canvas.translate((width-48f*scale)/2f,(height-34f*scale)/2f)
    canvas.scale(scale,scale)
    val now=SystemClock.elapsedRealtime()
    val tint=when(state){2->Color.rgb(38,215,65);1->Color.rgb(184,110,14);else->Color.rgb(190,52,66)}
    // A slow radar sweep (8 seconds per turn), subtle gaze and occasional blink.
    val blinkPhase=now%7_600L
    val aperture=if(state==2 && blinkPhase<260L)
      1.2f+12.8f*kotlin.math.abs(blinkPhase-130L)/130f else 14f
    shape.reset()
    shape.moveTo(2.5f,17f)
    shape.quadTo(24f,17f-2f*aperture,45.5f,17f)
    shape.quadTo(24f,17f+2f*aperture,2.5f,17f)
    shape.close()
    paint.shader=null;paint.style=Paint.Style.FILL;paint.color=Color.rgb(13,32,25)
    canvas.drawPath(shape,paint)
    paint.style=Paint.Style.STROKE;paint.strokeWidth=2.4f;paint.color=tint
    canvas.drawPath(shape,paint)
    if(aperture>2f){
      canvas.save();canvas.clipPath(shape)
      val x=24f+if(state==2) 1.8f*sin(now/1500.0).toFloat() else 0f
      val y=17f
      paint.style=Paint.Style.FILL
      paint.shader=RadialGradient(x,y,12f,intArrayOf(Color.rgb(6,34,15),tint,Color.rgb(7,25,16)),floatArrayOf(0f,.72f,1f),Shader.TileMode.CLAMP)
      canvas.drawCircle(x,y,12f,paint)
      paint.shader=null
      paint.style=Paint.Style.STROKE;paint.strokeWidth=.7f;paint.color=tint
      canvas.drawCircle(x,y,10f,paint)
      canvas.drawCircle(x,y,7.5f,paint)
      canvas.drawLine(x-11f,y,x+11f,y,paint)
      canvas.drawLine(x,y-11f,x,y+11f,paint)
      if(state==2){
        val angle=(now%8_000L)*360f/8_000f
        arc.set(x-11.6f,y-11.6f,x+11.6f,y+11.6f)
        paint.style=Paint.Style.FILL;paint.color=Color.argb(125,141,255,62)
        canvas.drawArc(arc,angle-32f,32f,true,paint)
        paint.style=Paint.Style.STROKE;paint.strokeWidth=1.1f;paint.color=Color.rgb(181,255,96)
        val rad=Math.toRadians(angle.toDouble())
        canvas.drawLine(x,y,x+11.6f*kotlin.math.cos(rad).toFloat(),y+11.6f*kotlin.math.sin(rad).toFloat(),paint)
      }
      paint.style=Paint.Style.FILL;paint.color=Color.rgb(4,18,11)
      canvas.drawCircle(x,y,4.8f,paint)
      paint.color=Color.WHITE;canvas.drawCircle(x-1.7f,y-1.9f,1.5f,paint)
      canvas.restore()
    }
    canvas.restore()
    if(state==2 && isAttachedToWindow)postInvalidateDelayed(65L)
  }
}
