package com.scalpatlas.shock.diagnostic

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.media.projection.MediaProjectionManager
import android.content.Context
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
 private var pendingOverlay = false
 private var captureStatus: TextView? = null
 private val captureRequestCode = 731
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
  captureStatus = TextView(this).apply {
   text = "CAPTURĂ ECRAN: NEAUTORIZATĂ"
   textSize = 14f
   setTextColor(Color.LTGRAY)
  }
  panel.addView(captureStatus)
  panel.addView(Button(this).apply {
   text = "SOLICITĂ CAPTURĂ ECRAN"
   setOnClickListener {
    val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    startActivityForResult(manager.createScreenCaptureIntent(), captureRequestCode)
   }
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
   pendingOverlay = true
   startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
   return
  }
  if (overlay != null) return
  val box = LinearLayout(this).apply {
   orientation = LinearLayout.VERTICAL
   gravity = Gravity.CENTER
   setPadding(26,18,26,18)
   setBackgroundColor(Color.rgb(25,33,41))
  }
  fun line(value: String, color: Int, size: Float) {
   box.addView(TextView(this).apply {
    text = value
    textSize = size
    setTextColor(color)
    gravity = Gravity.CENTER
   })
  }
  line("SCALPATLAS · SHOCK", Color.WHITE, 15f)
  line("│\n┃\n│", Color.rgb(160,168,178), 22f)
  line("◯  —%   ·   WAIT", Color.LTGRAY, 19f)
  line("♧ ALERTĂ: INACTIVĂ", Color.LTGRAY, 13f)
  line("O LUMÂNARE · DATE LIVE INDISPONIBILE", Color.LTGRAY, 11f)
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
 override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
  super.onActivityResult(requestCode, resultCode, data)
  if (requestCode == captureRequestCode) {
   if (resultCode == RESULT_OK && data != null) {
    val serviceIntent = Intent(this, CaptureService::class.java)
     .putExtra("resultCode", resultCode).putExtra("consent", data)
    startForegroundService(serviceIntent)
    captureStatus?.text = "CAPTURĂ PORNITĂ · ANALIZA NU ESTE ACTIVĂ"
   } else captureStatus?.text = "CAPTURĂ: REFUZATĂ"
  }
 }
 override fun onResume() {
  super.onResume()
  if (pendingOverlay && (Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this))) {
   pendingOverlay = false
   showOverlay()
  }
 }
 override fun onDestroy() {
  hideOverlay()
  super.onDestroy()
 }
}
