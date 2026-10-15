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
  // Accept only screenshots from the real T+5m window, not 10-20 minutes later.
  private val targetFollowupMs = 5L * 60_000L
  private val followupToleranceMs = 45_000L
  private val entries = JSONArray()
  // Small, bounded, device-only diagnostics sampled once every 15 seconds.
  private val diagnosticIndex = File(dir, "diagnostics.json")
  private val maxObservations = 100
  private val observations = JSONArray()
  private var lastObservedAt = 0L
  private var lastDiagnosticImageAt = 0L

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
      if (diagnosticIndex.isFile) {
        val saved = JSONArray(diagnosticIndex.readText(Charsets.UTF_8))
        val start = (saved.length() - maxObservations).coerceAtLeast(0)
        for (i in start until saved.length()) {
          saved.optJSONObject(i)?.let { observations.put(it) }
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

  /**
   * Records WHY the engine emitted WAIT or considered an optical candidate.
   * Sampling once per 15 seconds avoids degrading the LIVE chart loop.
   * Never treats an optical score as statistical win probability.
   */
  @Synchronized
  fun observe(
    now: Long,
    timeframe: String,
    market: String,
    rawSignal: String,
    accepted: Boolean,
    score: Int,
    quality: Int,
    opticalGate: Boolean,
    opticalCount: Int,
    reason: String,
    screenshot: ByteArray?,
    marketRegime: String
  ) {
    if (now - lastObservedAt < 15_000L) return
    lastObservedAt = now
    val classification = when {
      accepted -> "CANDIDAT_OPTIC"
      quality < 55 -> "CALITATE_IMAGINE"
      rawSignal == "NONE" -> "STRUCTURA_SAU_IMPULS_NECLAR"
      !opticalGate -> "BLOCAJ_LUMANARI"
      score < 70 -> "SCOR_SUB_PRAG"
      else -> "FARA_DIRECTIE"
    }
    val record = JSONObject()
      .put("timestamp", now)
      .put("timeframe", timeframe.take(10))
      .put("market", market.take(24))
      .put("marketRegime", marketRegime.take(30))
      .put("signal", rawSignal.take(6))
      .put("classification", classification)
      .put("scoreOrientativ", score)
      .put("quality", quality)
      .put("opticalGate", opticalGate)
      .put("opticalCount", opticalCount)
      .put("reason", reason.take(180))

    // Approximately one diagnostic chart screenshot every two minutes.
    // Export only when JURNAL is explicitly tapped.
    if (screenshot != null && screenshot.isNotEmpty() &&
        (lastDiagnosticImageAt == 0L || now - lastDiagnosticImageAt >= 120_000L)) {
      val photo = "diag_" + now + ".jpg"
      File(dir, photo).writeBytes(screenshot)
      record.put("snapshot", photo)
      lastDiagnosticImageAt = now
    }
    if (observations.length() >= maxObservations) {
      val old = observations.optJSONObject(0)
      val name = old?.optString("snapshot", "") ?: ""
      if (name.isNotBlank()) File(dir, name).delete()
      observations.remove(0)
    }
    observations.put(record)
    diagnosticIndex.writeText(observations.toString(2), Charsets.UTF_8)
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
      if (elapsed < targetFollowupMs) continue
      // Reject an overdue frame even when the SAME pair/TF returns much later.
      // The old journal called a 10-20 minute image a T+5m screenshot.
      if (elapsed > targetFollowupMs + followupToleranceMs) {
        item.put("status", "FARA_CAPTURA_COMPARABILA")
        item.put("followupReason", "CAPTURA_INTARZIATA")
        item.put("followupDelaySeconds", elapsed / 1000L)
        changed = true
        continue
      }
      // If the broker changed, wait briefly for a comparable frame, never
      // substitute a screenshot from a different instrument/timeframe.
      if (item.optString("market") == "NEIDENTIFICAT" ||
          market != item.optString("market") ||
          tf != item.optString("timeframe")) {
        continue
      }
      val name = "dupa_5m_" + item.optString("id") + ".jpg"
      File(dir, name).writeBytes(frame)
      item.put("followupImage", name)
      item.put("followupAt", now)
      item.put("followupDelaySeconds", elapsed / 1000L)
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
    appendLine("Observatii diagnostic: ${observations.length()} (esantionare ~15 sec)")
    appendLine()
    appendLine("TEST LIVE AUTOMAT 30 MINUTE:")
    try {
      val reportFile = File(dir, "live_test_sessions.json")
      if (reportFile.isFile) {
        val tests = JSONArray(reportFile.readText(Charsets.UTF_8))
        val begin = (tests.length() - 3).coerceAtLeast(0)
        for (i in begin until tests.length()) {
          val test = tests.optJSONObject(i) ?: continue
          appendLine(
            stamp(test.optLong("startedAt")) + " • " + test.optString("status") +
            " • durata planificata " + test.optInt("targetMinutes") + " min"
          )
          appendLine(
            "  Cadre capturate: " + test.optLong("capturedFrames") +
            " | Analize complete: " + test.optLong("analyzedFrames") +
            " | Erori: " + test.optLong("errors")
          )
          appendLine(
            "  BIP BUY: " + test.optInt("buyBips") +
            " | BIP SELL: " + test.optInt("sellBips")
          )
          val events = test.optJSONObject("events")
          if (events != null) {
            val keys = events.keys()
            while (keys.hasNext()) {
              val key = keys.next()
              appendLine("  " + key + ": " + events.optInt(key))
            }
          }
        }
      } else {
        appendLine("  Nicio sesiune de test LIVE inregistrata.")
      }
    } catch (_: Throwable) {
      appendLine("  Raportul testului LIVE nu poate fi citit.")
    }
    appendLine()
    appendLine("PROFILURI PE PERECHE SI TIMEFRAME (NUMARARI, NU WIN/LOSS):")
    val profiles = linkedMapOf<String, JSONObject>()
    fun marketProfile(market: String, tf: String): JSONObject {
      val key = market + " • " + tf
      return profiles.getOrPut(key) {
        JSONObject().put("samples", 0).put("opticalCandidates", 0)
          .put("buyBips", 0).put("sellBips", 0).put("regimes", JSONObject())
      }
    }
    for (i in 0 until observations.length()) {
      val row = observations.optJSONObject(i) ?: continue
      val profile = marketProfile(row.optString("market"), row.optString("timeframe"))
      profile.put("samples", profile.optInt("samples") + 1)
      if (row.optString("classification") == "CANDIDAT_OPTIC") {
        profile.put("opticalCandidates", profile.optInt("opticalCandidates") + 1)
      }
      val regimes = profile.optJSONObject("regimes") ?: continue
      val regime = row.optString("marketRegime", "NEDETERMINAT")
      regimes.put(regime, regimes.optInt(regime) + 1)
    }
    for (i in 0 until entries.length()) {
      val row = entries.optJSONObject(i) ?: continue
      val profile = marketProfile(row.optString("market"), row.optString("timeframe"))
      val key = if (row.optString("direction") == "BUY") "buyBips" else "sellBips"
      profile.put(key, profile.optInt(key) + 1)
    }
    if (profiles.isEmpty()) appendLine("  Nu exista inca date.")
    for ((pair, profile) in profiles) {
      appendLine(
        pair + " | observații: " + profile.optInt("samples") +
        " | candidate: " + profile.optInt("opticalCandidates") +
        " | BIP BUY: " + profile.optInt("buyBips") +
        " | BIP SELL: " + profile.optInt("sellBips")
      )
      val regimes = profile.optJSONObject("regimes")
      if (regimes != null) appendLine("  Regimuri vizuale: " + regimes.toString())
    }
    appendLine()
    appendLine("MOTIVE DE RESPINGERE / OBSERVATII MOTOR:")
    val counts = linkedMapOf<String, Int>()
    for (i in 0 until observations.length()) {
      val item = observations.optJSONObject(i) ?: continue
      val key = item.optString("classification", "NEIDENTIFICAT")
      counts[key] = (counts[key] ?: 0) + 1
    }
    for ((reason, count) in counts) appendLine("  " + reason + ": " + count)
    appendLine()
    appendLine("SEMNALE AUDIO:")
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
      if (!item.isNull("followupDelaySeconds")) {
        appendLine("   Interval real de la BIP: ${item.optLong("followupDelaySeconds")} sec")
      }
      if (item.optString("followupReason") == "CAPTURA_INTARZIATA") {
        appendLine("   NOTĂ: captură prea târzie; comparația la 5 minute este invalidă.")
      }
    }
    appendLine()
    appendLine("OBSERVATII LIVE: ora | pereche | TF | regim | semnal brut | scor | calitate | lumânări | blocaj")
    for (i in 0 until observations.length()) {
      val o = observations.optJSONObject(i) ?: continue
      appendLine(
        stamp(o.optLong("timestamp")) + " | " + o.optString("market") +
        " | " + o.optString("timeframe") +
        " | " + o.optString("marketRegime", "NEDETERMINAT") +
        " | " + o.optString("signal") +
        " | " + o.optInt("scoreOrientativ") +
        " | " + o.optInt("quality") +
        " | " + o.optInt("opticalCount") +
        " | " + o.optString("classification") +
        " | " + o.optString("reason").replace("\\n", " ").take(100)
      )
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
        val sessions = File(dir, "live_test_sessions.json")
        if (sessions.isFile) {
          zip.putNextEntry(ZipEntry("Test-LIVE-sesiuni.json"))
          sessions.inputStream().use { it.copyTo(zip) }
          zip.closeEntry()
        }
        val exportedNames = mutableSetOf<String>()
        fun writeFile(name: String) {
          if (name.isEmpty() || !name.matches(Regex("[a-zA-Z0-9_.-]+")) ||
              !exportedNames.add(name)) return
          val file = File(dir, name)
          if (!file.isFile) return
          zip.putNextEntry(ZipEntry("capturi/" + name))
          file.inputStream().use { it.copyTo(zip) }
          zip.closeEntry()
        }
        for (i in 0 until entries.length()) {
          val obj = entries.optJSONObject(i) ?: continue
          for (key in listOf("startImage", "followupImage")) {
            writeFile(obj.optString(key, ""))
          }
        }
        for (i in 0 until observations.length()) {
          val obj = observations.optJSONObject(i) ?: continue
          writeFile(obj.optString("snapshot", ""))
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
