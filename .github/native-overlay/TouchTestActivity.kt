package com.scalpatlas.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.graphics.Color
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Visible test surface inside Scalp Atlas; never a trading screen. */
class TouchTestActivity : Activity() {
  private lateinit var status: TextView
  private var waitingFor: String? = null

  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

  private fun button(label: String, color: Int): Button = Button(this).apply {
    text = label
    isAllCaps = false
    textSize = 15f
    setTextColor(Color.WHITE)
    setBackgroundColor(color)
  }
  private fun textView(value: String): TextView = TextView(this).apply {
    text = value
    textSize = 16f
    setTextColor(Color.WHITE)
    gravity = Gravity.CENTER
    setPadding(dp(4), dp(8), dp(4), dp(8))
  }
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(18), dp(22), dp(18), dp(18))
      setBackgroundColor(Color.rgb(14, 19, 26))
    }
    val scroll = ScrollView(this)
    scroll.addView(root)
    setContentView(scroll)

    fun add(v: View, height: Int = 55) {
      root.addView(v, LinearLayout.LayoutParams(-1, dp(height)).apply {
        bottomMargin = dp(9)
      })
    }

    add(textView("TEST ATINGERE VIRTUALĂ · SCALP ATLAS"), 80)
    add(textView("NUMAI ECRANUL DE PROBĂ. Fără ordine și fără acces la broker."), 85)
    val settings = button("DESCHIDE ACCESIBILITATE (FĂRĂ SUPRAPUNERE)", Color.rgb(43, 76, 104))
    add(settings, 66)
    settings.setOnClickListener {
      // Android's security screen must not be obscured by our own floating card.
      stopService(Intent(this, ScalpOverlayService::class.java))
      status.text = "LIVE oprit. Android controlează activarea serviciului."
      startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }
    val appInfo = button("INFORMAȚII APLICAȚIE (SETĂRI ANDROID)", Color.rgb(54, 76, 95))
    add(appInfo, 55)
    appInfo.setOnClickListener {
      stopService(Intent(this, ScalpOverlayService::class.java))
      val info = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
        Uri.parse("package:" + packageName))
      startActivity(info)
    }
    status = textView("Verific dacă serviciul de test este conectat…")
    add(status, 102)

    val requestBuy = button("SIMULEAZĂ ATINGERE BUY", Color.rgb(8, 122, 71))
    val requestSell = button("SIMULEAZĂ ATINGERE SELL", Color.rgb(155, 33, 58))
    add(requestBuy, 52)
    add(requestSell, 52)

    add(textView("ZONE DE TEST ÎN ACEASTĂ APLICAȚIE"), 48)
    val buy = button("ZONA TEST BUY", Color.rgb(4, 67, 40))
    val sell = button("ZONA TEST SELL", Color.rgb(92, 19, 35))
    add(buy, 75)
    add(sell, 75)
    buy.setOnClickListener { received("BUY") }
    sell.setOnClickListener { received("SELL") }
    requestBuy.setOnClickListener { simulate("BUY", buy) }
    requestSell.setOnClickListener { simulate("SELL", sell) }
    add(textView("Dezactivează serviciul din Setări după probă."), 70)
  }

  override fun onResume() {
    super.onResume()
    status.postDelayed({
      if (!isFinishing) {
        status.text = if (TouchTestService.ready())
          "CONECTAT: gesturile de test pot fi trimise doar în Scalp Atlas."
        else
          "NECONECTAT: Android nu a autorizat atingerea virtuală. Dacă opțiunea este gri, nu forța; verifică Informații aplicație."
      }
    }, 350L)
  }

  private fun received(direction: String) {
    status.text = if (waitingFor == direction) "SUCCES: atingere virtuală $direction recepționată."
      else "Atingere manuală în zona $direction."
    waitingFor = null
  }

  private fun simulate(direction: String, target: View) {
    if (!TouchTestService.ready() || !hasWindowFocus()) {
      status.text = "Activează Accesibilitate și revino la ecranul de test."
      return
    }
    if (waitingFor != null) {
      status.text = "Există deja o atingere în curs."
      return
    }
    waitingFor = direction
    val screen = IntArray(2)
    target.getLocationOnScreen(screen)
    val x = screen[0] + target.width / 2f
    val y = screen[1] + target.height / 2f
    status.text = "Trimit atingerea de probă: $direction…"
    val sent = TouchTestService.tryTestTap(x, y) { completed ->
      if (waitingFor == direction && !completed) {
        waitingFor = null
        status.text = "Gest anulat de Android."
      }
    }
    if (!sent) {
      waitingFor = null
      status.text = "Gestul nu a pornit: verifică permisiunea și ecranul activ."
    }
  }
}
