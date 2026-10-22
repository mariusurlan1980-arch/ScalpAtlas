from pathlib import Path
p=Path(".github/native-overlay/ScalpOverlayService.kt")
s=p.read_text(encoding="utf-8")
needle="    header.addView(title, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))"
assert s.count(needle)==1
insert='''    val soundPrefs = getSharedPreferences("scalp_atlas_sound", MODE_PRIVATE)
    val bell = TextView(this).apply {
      textSize = 18f
      gravity = Gravity.CENTER
      setPadding(dp(8), 0, dp(8), 0)
      fun refresh() {
        val enabled = soundPrefs.getBoolean("bip_enabled", true)
        text = if (enabled) "🔔" else "🔕"
        contentDescription = if (enabled) "Dezactivează bipul" else "Activează bipul"
        setTextColor(if (enabled) Color.rgb(70, 220, 235) else Color.LTGRAY)
      }
      refresh()
      setOnClickListener {
        soundPrefs.edit().putBoolean("bip_enabled", !soundPrefs.getBoolean("bip_enabled", true)).apply()
        refresh()
      }
    }

'''
s=s.replace(needle,insert+needle+"\n    header.addView(bell)")
needle="  private fun playBip(direction: String) {"
assert s.count(needle)==1
s=s.replace(needle,needle+'\n    if (!getSharedPreferences("scalp_atlas_sound", MODE_PRIVATE).getBoolean("bip_enabled", true)) return')
p.write_text(s,encoding="utf-8")
print("PASS: persistent ON/OFF bell controls existing beep")
