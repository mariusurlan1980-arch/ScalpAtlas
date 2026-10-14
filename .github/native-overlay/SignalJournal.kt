package com.scalpatlas.app

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Private, device-local, observation-only LIVE signal journal.
 *
 * Neither a beep nor a later screenshot determines a WIN/LOSS. There is no
 * verified OHLC feed. The follow-up frame only helps a human review the chart.
 * No broker buttons, orders, account actions or cloud uploads are performed.
 */
internal class SignalJournal(private val context: Context) {
  private val dir = File(context.filesDir, "signal_journal")
  private val index = File(dir, "index.json")
  private val maxRecords = 50
  private val entries = JSONArray()

  init {
    dir.mkdirs()
    try {
      if (index.isFile) {
        val saved = JSONArray(index.readText(Charsets.UTF_8))
        val start = (saved.length() - maxRecords).coerceAtLeast(0)
        for (i in start until saved.length()) {
          saved.optJSONObject(i)?.let { entries.put(it) }
        }
      }
    } catch (_: Throwable) {
      // A damaged report must never stop market analysis or the overlay.
    }
  }

  fun size(): Int = synchronized(this) { entries.length() }

  private fun persist() {
    val temporary = File(dir, "index.tmp")
    temporary.writeText(entries.toString(2), Charsets.UTF_8)
    if (!temporary.renameTo(index)) {
      index.writeText(entries.toString(2), Charsets.UTF_8)
      temporary.delete()
    }
  }

  @Synchronized
  fun record(
    timestamp: Long,
    direction: String,
    timeframe: String,
    market: String,
    score: Int,
    pattern: String,
    frame: ByteArray?
  ): Int {
    if (direction != "BUY" && direction != "SELL") return size()
    val id = timestamp.toString() + "_" + entries.length()
    val obj = JSONObject()
      .put("id", id)
      .put("timestamp", timestamp)
      .put("direction", direction)
      .put("timeframe", timeframe)
      .put("market", market)
      .put("scoreOrientativ", score)
      .put("pattern", pattern.take(150))
      .put("status", "ASTEPTARE_T_PLUS_5_MIN")
      .put("followupAt", JSONObject.NULL)
      .put("outcome", "NEVERIFICAT")
    if (frame != null && frame.isNotEmpty()) {
      val photo = "start_" + id + ".jpg"
      File(dir, photo).writeBytes(frame)
      obj.put("startImage", photo)
    }

    if (entries.length() >= maxRecords) {
      val old = entries.optJSONObject(0)
      for (field in listOf("startImage", "followupImage")) {
        val oldName = old?.optString(field, "") ?: ""
        if (oldName.isNotEmpty()) File(dir, oldName).delete()
      }
      val remaining = JSONArray()
      for (i in 1 until entries.length()) remaining.put(entries.getJSONObject(i))
      while (entries.length() > 0) entries.remove(0)
      for (i in 0 until remaining.length()) entries.put(remaining.getJSONObject(i))
    }
    entries.put(obj)
    persist()
    return entries.length()
  }

  /**
   * Capture only a follow-up screenshot of the SAME recognised pair and TF.
   * A picture is not a verified price quote or a broker settlement.
   */
  @Synchronized
  fun followUp(now: Long, market: String, tf: String, frame: ByteArray?) {
    if (entries.length() == 0 || frame == null || frame.isEmpty()) return
    var changed = false
    for (i in 0 until entries.length()) {
      val item = entries.optJSONObject(i) ?: continue
      if (item.optString("status") != "ASTEPTARE_T_PLUS_5_MIN") continue
      val elapsed = now - item.optLong("timestamp")
      if (elapsed < 5 * 60_000L) continue
      // If the broker changed during the signal, do not fake an outcome.
      if (item.optString("market") == "NEIDENTIFICAT" ||
          market != item.optString("market") ||
          tf != item.optString("timeframe")) {
        if (elapsed > 7 * 60_000L) {
          item.put("status", "FARA_CAPTURA_COMPARABILA")
          changed = true
        }
        continue
      }
      val name = "dupa_5m_" + item.optString("id") + ".jpg"
      File(dir, name).writeBytes(frame)
      item.put("followupImage", name)
      item.put("followupAt", now)
      item.put("status", "CAPTURI_DISPONIBILE")
      item.put("outcome", "NEVERIFICAT")
      changed = true
    }
    if (changed) persist()
  }

  private fun stamp(ms: Long): String = SimpleDateFormat(
    "yyyy-MM-dd HH:mm:ss", Locale.ROOT
  ).apply { timeZone = TimeZone.getDefault() }.format(Date(ms))

  @Synchronized
  fun buildReport(): String = buildString {
    appendLine("SCALP ATLAS LIVE • JURNAL SEMNALE")
    appendLine("Observații fără tranzacționare automată")
    appendLine("IMPORTANT: NICIUN SEMNAL NU ESTE WIN/LOSS VERIFICAT.")
    appendLine("Scorurile sunt euristice, nu probabilități de câștig.")
    appendLine("Perechea si intervalul din imagini trebuie reverificate manual.")
    appendLine("Capturile la 5 minute NU certifică pretul de intrare/iesire.")
    appendLine("Inregistrari: ${entries.length()}")
    appendLine()
    for (i in 0 until entries.length()) {
      val item = entries.optJSONObject(i) ?: continue
      appendLine("${i + 1}. ${stamp(item.optLong("timestamp"))} • " +
        "${item.optString("market")} • ${item.optString("timeframe")} • ${item.optString("direction")}")
      appendLine("   Scor orientativ: ${item.optInt("scoreOrientativ")}; " +
        "model: ${item.optString("pattern")} ")
      appendLine("   T+5m: ${item.optString("status")} • rezultat: NEVERIFICAT")
      if (!item.isNull("followupAt")) {
        appendLine("   Captura T+5m: ${stamp(item.optLong("followupAt"))}")
      }
    }
    appendLine()
    appendLine("Nu utiliza acest raport pentru a calcula rata de castig fara preturi OHLC comparabile.")
  }

  /**
   * Explicit tap on JURNAL: a local ZIP is offered to the Android share sheet.
   * Nothing is sent automatically to a third party or broker.
   */
  fun share() {
    val outDir = File(context.cacheDir, "signal_journal_exports")
    outDir.mkdirs()
    val archive = File(outDir, "ScalpAtlas-Jurnal-LIVE.zip")
    synchronized(this) {
      ZipOutputStream(FileOutputStream(archive)).use { zip ->
        zip.putNextEntry(ZipEntry("Jurnal-semne.txt"))
        zip.write(buildReport().toByteArray(Charsets.UTF_8))
        zip.closeEntry()
        for (i in 0 until entries.length()) {
          val obj = entries.optJSONObject(i) ?: continue
          for (key in listOf("startImage", "followupImage")) {
            val name = obj.optString(key, "")
            val file = File(dir, name)
            if (name.isEmpty() || !file.isFile) continue
            zip.putNextEntry(ZipEntry("capturi/" + name))
            file.inputStream().use { it.copyTo(zip) }
            zip.closeEntry()
          }
        }
      }
    }
    val uri = FileProvider.getUriForFile(
      context, context.packageName + ".journalfiles", archive
    )
    val send = Intent(Intent.ACTION_SEND).apply {
      type = "application/zip"
      putExtra(Intent.EXTRA_STREAM, uri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    val chooser = Intent.createChooser(send, "Trimite jurnalul SCALP ATLAS").apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(chooser)
  }
}
