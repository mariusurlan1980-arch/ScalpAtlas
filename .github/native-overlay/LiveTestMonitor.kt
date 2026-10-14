package com.scalpatlas.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * An explicitly visible, automatic, observation-only 30-minute study.
 * Starts only after a real Android MediaProjection is created.
 * Never trades, never infers wins from screenshot pixels, and never uploads.
 */
internal class LiveTestMonitor(context: Context) {
  private val file = File(File(context.filesDir, "signal_journal").apply { mkdirs() },
    "live_test_sessions.json")
  private val history = JSONArray()
  private var active: JSONObject? = null
  private var lastHealthAt = 0L
  private var lastClassifierAt = 0L
  private var lastSavedAt = 0L
  private var startFrames = 0L
  private var startResults = 0L
  private var startErrors = 0L

  init {
    try {
      if (file.isFile) {
        val saved = JSONArray(file.readText(Charsets.UTF_8))
        val offset = (saved.length() - 8).coerceAtLeast(0)
        for (i in offset until saved.length()) {
          val item = saved.optJSONObject(i) ?: continue
          if (item.optString("status") == "IN_DESFASURARE") {
            item.put("status", "INTRERUPT")
            item.put("note", "Aplicatia a fost inchisa sau capturarea a fost intrerupta.")
          }
          history.put(item)
        }
        persist()
      }
    } catch (_: Throwable) {
      // An inaccessible journal must not stop video capture.
    }
  }

  @Synchronized
  fun begin(now: Long, frames: Long, results: Long, errors: Long) {
    if (active != null) return
    startFrames = frames
    startResults = results
    startErrors = errors
    lastHealthAt = 0L
    lastClassifierAt = 0L
    lastSavedAt = 0L
    val test = JSONObject()
      .put("id", now)
      .put("startedAt", now)
      .put("targetMinutes", 30)
      .put("scheduledEndAt", now + 30L * 60_000L)
      .put("status", "IN_DESFASURARE")
      .put("finishedAt", JSONObject.NULL)
      .put("capturedFrames", 0)
      .put("analyzedFrames", 0)
      .put("errors", 0)
      .put("buyBips", 0)
      .put("sellBips", 0)
      .put("events", JSONObject())
    if (history.length() >= 8) history.remove(0)
    history.put(test)
    active = test
    persist()
  }

  private fun increment(test: JSONObject, event: String) {
    val events = test.optJSONObject("events") ?: JSONObject().also {
      test.put("events", it)
    }
    events.put(event, events.optInt(event, 0) + 1)
  }

  @Synchronized
  fun onClassifier(now: Long, signal: String, tentative: String, score: Int,
                   quality: Int, opticalGate: Boolean, opticalCount: Int) {
    val test = active ?: return
    if (now >= test.optLong("scheduledEndAt")) return
    if (now - lastClassifierAt < 15_000L) return
    lastClassifierAt = now
    val reason = when {
      signal == "BUY" || signal == "SELL" -> "CANDIDAT_VALIDAT_OPTIC"
      quality < 55 -> "IMAGINE_NECONCLUDENTA"
      tentative == "BUY" || tentative == "SELL" -> "BLOCAT_LUMANARI"
      score < 70 -> "SCOR_SAU_STRUCTURA_INSUFICIENTA"
      opticalCount < 3 -> "PREA_PUTINE_LUMANARI"
      !opticalGate -> "BLOCAT_ANALIZA"
      else -> "FARA_DIRECTIE_CLARA"
    }
    increment(test, reason)
  }

  @Synchronized
  fun onBeep(now: Long, direction: String) {
    val test = active ?: return
    if (now >= test.optLong("scheduledEndAt")) return
    val field = if (direction == "BUY") "buyBips" else if (direction == "SELL")
      "sellBips" else return
    test.put(field, test.optInt(field, 0) + 1)
    persist()
  }

  /** Poll every ~6s; only event categories are sampled (not each video frame). */
  @Synchronized
  fun tick(now: Long, frames: Long, results: Long, errors: Long, tfVerified: Boolean,
           captureFresh: Boolean, analyzedFresh: Boolean): String {
    val test = active ?: return "TEST LIVE • încheiat • JURNAL"
    test.put("capturedFrames", (frames - startFrames).coerceAtLeast(0))
    test.put("analyzedFrames", (results - startResults).coerceAtLeast(0))
    test.put("errors", (errors - startErrors).coerceAtLeast(0))
    if (now - lastHealthAt >= 10_000L && now < test.optLong("scheduledEndAt")) {
      lastHealthAt = now
      increment(test, when {
        !captureFresh -> "FLUX_ECRAN_INACTIV"
        !tfVerified -> "TF_NECONFIRMAT"
        !analyzedFresh -> "FARA_REZULTAT_RECENT"
        else -> "ANALIZA_LIVE_ACTIVA"
      })
    }
    val remainingMs = test.optLong("scheduledEndAt") - now
    if (remainingMs <= 0L) {
      end(now, frames, results, errors, true)
      return "TEST 30m FINALIZAT • apasă JURNAL"
    }
    if (now - lastSavedAt >= 15_000L) {
      lastSavedAt = now
      persist()
    }
    val remainingSeconds = (remainingMs / 1000L).coerceAtLeast(0)
    return "TEST LIVE " + "%02d:%02d".format(
      remainingSeconds / 60L, remainingSeconds % 60L
    ) + " • BIP " + (test.optInt("buyBips") + test.optInt("sellBips"))
  }

  @Synchronized
  fun end(now: Long, frames: Long, results: Long, errors: Long, completed: Boolean) {
    val test = active ?: return
    test.put("capturedFrames", (frames - startFrames).coerceAtLeast(0))
    test.put("analyzedFrames", (results - startResults).coerceAtLeast(0))
    test.put("errors", (errors - startErrors).coerceAtLeast(0))
    test.put("finishedAt", now)
    test.put("status", if (completed) "FINALIZAT" else "INTRERUPT")
    active = null
    persist()
  }

  private fun persist() {
    val temporary = File(file.parentFile, "live_test_sessions.tmp")
    temporary.writeText(history.toString(2), Charsets.UTF_8)
    if (!temporary.renameTo(file)) {
      file.writeText(history.toString(2), Charsets.UTF_8)
      temporary.delete()
    }
  }
}
