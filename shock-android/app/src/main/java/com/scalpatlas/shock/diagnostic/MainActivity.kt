package com.scalpatlas.shock.diagnostic
import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
class MainActivity : Activity() {
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  val panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(36,36,36,36); setBackgroundColor(Color.rgb(20,25,32)) }
  panel.addView(TextView(this).apply { text = "SCALPATLAS SHOCK"; textSize=23f; setTextColor(Color.WHITE) })
  panel.addView(TextView(this).apply { text = "DIAGNOSTIC ONLY — WAIT"; textSize=20f; setTextColor(Color.LTGRAY) })
  panel.addView(TextView(this).apply { text = "No live chart analysis, BUY/SELL, beep or automatic trades. This build only checks Android installation."; textSize=16f; setTextColor(Color.LTGRAY) })
  setContentView(panel)
 }
}
