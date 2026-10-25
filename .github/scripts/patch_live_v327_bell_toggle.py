from pathlib import Path
p = Path(".github/native-overlay/ScalpOverlayService.kt")
s = p.read_text(encoding="utf-8")
needle = "  private fun playBip(direction: String) {"
assert s.count(needle) == 1, "playBip function not found exactly once"
guard = '    if (!bellEnabled) return'
start = s.index(needle)
end = s.find("\n  }", start)
assert end > start, "playBip end not found"
if guard not in s[start:end]:
    s = s[:start + len(needle)] + "\n" + guard + s[start + len(needle):]
assert "getSharedPreferences(bellPrefsName, Context.MODE_PRIVATE)" in s, "persisted bell setting missing"
assert "bellEnabled = !bellEnabled" in s, "bell toggle missing"
p.write_text(s, encoding="utf-8")
print("PASS: existing single bell controls original beep; no duplicate widget")
