package com.scalpatlas.shock.diagnostic

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
 private lateinit var wm: WindowManager
 private var overlay: View? = null
 private var params: WindowManager.LayoutParams? = null
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  wm = getSystemService(WINDOW_SERVICE) as WindowManager
  val panel = LinearLayout(this).apply {
   orientation = LinearLayout.VERTICAL
   gravity = Gravity.CENTER
   setPadding(40,40,40,40)
   setBackgroundColor(Color.rgb(20,25,32))
  }
  panel.addView(TextView(this).apply {
   text = "SCALPATLAS SHOCK"
   textSize = 24f
   setTextColor(Color.WHITE)
  })
  panel.addView(TextView(this).apply {
   text = "OVERLAY TEST — WAIT"
   textSize = 19f
   setTextColor(Color.LTGRAY)
  })
  panel.addView(TextView(this).apply {
   text = "Test only. No live chart analysis, BUY/SELL signals, sound or trades."
   textSize = 16f
   setTextColor(Color.LTGRAY)
  })
  panel.addView(Button(this).apply {
   text = "SHOW WAIT OVERLAY"
   setOnClickListener { showOverlay() }
  })
  panel.addView(Button(this).apply {
   text = "HIDE OVERLAY"
   setOnClickListener { hideOverlay() }
  })
  setContentView(panel)
 }
 private fun showOverlay() {
  if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(this)) {
   startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
   return
  }
  if (overlay != null) return
  val box = TextView(this).apply {
   text = "SHOCK  ·  WAIT\nNO LIVE DATA"
   textSize = 15f
   setTextColor(Color.WHITE)
   setPadding(25,18,25,18)
   setBackgroundColor(Color.rgb(25,33,41))
  }
  val lp = WindowManager.LayoutParams(
   WindowManager.LayoutParams.WRAP_CONTENT,
   WindowManager.LayoutParams.WRAP_CONTENT,
   WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
   WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
   PixelFormat.TRANSLUCENT
  )
  lp.gravity = Gravity.TOP or Gravity.START
  lp.x = 40
  lp.y = 180
  var startX = 0
  var startY = 0
  var touchX = 0f
  var touchY = 0f
  box.setOnTouchListener { _: View, event: MotionEvent ->
   when (event.actionMasked) {
    MotionEvent.ACTION_DOWN -> {
     startX = lp.x; startY = lp.y; touchX = event.rawX; touchY = event.rawY; true
    }
    MotionEvent.ACTION_MOVE -> {
     lp.x = startX + (event.rawX - touchX).toInt()
     lp.y = startY + (event.rawY - touchY).toInt()
     wm.updateViewLayout(box, lp)
     true
    }
    else -> true
   }
  }
  wm.addView(box, lp)
  overlay = box
  params = lp
 }
 private fun hideOverlay() {
  overlay?.let { wm.removeView(it) }
  overlay = null
  params = null
 }
 override fun onDestroy() {
  hideOverlay()
  super.onDestroy()
 }
}
