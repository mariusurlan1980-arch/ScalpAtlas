"""Scalp Atlas v1.0.51 opt-in remote AI confirmation.
Modes:
  python3 this_file             patch native service/module AFTER v1049.
  python3 this_file --ui        patch generated React Native UI AFTER copy from templates.
No OpenAI keys are embedded in the application. Requires private HTTPS backend.
"""
from pathlib import Path
import sys

def replace_once(s,old,new,label):
    n=s.count(old)
    if n!=1:raise SystemExit(f"v1051 {label}: wanted 1, got {n}")
    return s.replace(old,new,1)

if "--ui" in sys.argv:
    p=Path("scalp-atlas-new/LiveAnalysisApp.tsx")
    s=p.read_text(encoding="utf-8")
    s=replace_once(s,
        "  const [showLanguagePicker, setShowLanguagePicker] = useState(false);\n",
        """  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  // Optional external AI service. Inactive by default, never embed provider API key.
  const [aiEditorOpen, setAiEditorOpen] = useState(false);
  const [aiEndpoint, setAiEndpoint] = useState('');
  const [aiAccessToken, setAiAccessToken] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android' || !NativeModules.ScalpOverlay?.aiVerifierStatus) return;
    void NativeModules.ScalpOverlay.aiVerifierStatus()
      .then((v: { enabled?: boolean; endpoint?: string }) => {
        setAiEnabled(!!v?.enabled);
        setAiEndpoint(String(v?.endpoint || ''));
      }).catch(() => {});
  }, []);
  const saveAiSettings = async (enabled: boolean) => {
    if (Platform.OS !== 'android' || !NativeModules.ScalpOverlay?.configureAiVerifier) return;
    try {
      await NativeModules.ScalpOverlay.configureAiVerifier(aiEndpoint.trim(), aiAccessToken.trim(), enabled);
      setAiEnabled(enabled);
      setAiAccessToken('');
      setMessage(enabled
        ? 'AI PORNIT: numai acordul ambelor motoare permite BIP. Dacă AI nu răspunde, NU se emite BIP.'
        : 'AI OPRIT: Scalp Atlas revine la motorul clasic. Semnalele rămân experimentale.');
    } catch (e) {
      setMessage('AI: ' + (e instanceof Error ? e.message : String(e)));
    }
  };
""",
        "state and settings action")
    s=replace_once(s,
        "              <Text style={styles.overlayHint}>După pornire, deschide graficul brokerului. Ține apăsat pe fereastra Scalp Atlas și trage pentru poziționare.</Text>\n",
        """              <Text style={styles.overlayHint}>După pornire, deschide graficul brokerului. Ține apăsat pe fereastra Scalp Atlas și trage pentru poziționare.</Text>
              <Pressable style={styles.overlayStopButton} onPress={() => setAiEditorOpen(v => !v)}>
                <Text style={styles.overlayStopButtonText}>AI EXTERN: {aiEnabled ? 'ACTIV' : 'NECONECTAT / OPRIT'} · CONFIGURARE</Text>
              </Pressable>
              {aiEditorOpen && (
                <View style={{ marginTop: 9, gap: 8 }}>
                  <Text style={styles.overlayHint}>Opțional: AI vizual prin server HTTPS privat. Necesită serviciu configurat separat. ChatGPT Plus nu include automat acces API.</Text>
                  <TextInput
                    value={aiEndpoint} onChangeText={setAiEndpoint}
                    placeholder="https://serverul-tau.example" placeholderTextColor="#76849b"
                    autoCapitalize="none" autoCorrect={false}
                    style={{ borderWidth: 1, borderColor: '#265f49', color: 'white', padding: 9, borderRadius: 7 }}
                  />
                  <TextInput
                    value={aiAccessToken} onChangeText={setAiAccessToken}
                    placeholder="Token privat al serverului (NU cheia OpenAI)" placeholderTextColor="#76849b"
                    secureTextEntry autoCapitalize="none" autoCorrect={false}
                    style={{ borderWidth: 1, borderColor: '#265f49', color: 'white', padding: 9, borderRadius: 7 }}
                  />
                  <View style={styles.overlayModeRow}>
                    <Pressable style={styles.overlayModeButton} onPress={() => void saveAiSettings(true)}>
                      <Text style={styles.overlayModeButtonText}>ACTIVEAZĂ AI</Text>
                    </Pressable>
                    <Pressable style={styles.overlayStopButton} onPress={() => void saveAiSettings(false)}>
                      <Text style={styles.overlayStopButtonText}>AI OFF</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.overlayHint}>AI activ: BIP doar dacă analiza locală și serverul AI confirmă ACEEAȘI direcție, în timp util. Dacă nu există server, nu activa AI.</Text>
                </View>
              )}
""",
        "add collapsed AI configuration in overlay card")
    p.write_text(s,encoding="utf-8")
    print("v1.0.51 optional AI setup UI (collapsed) applied")
    sys.exit(0)

p=Path(".github/native-overlay/ScalpOverlayModule.kt")
s=p.read_text(encoding="utf-8")
needle="  @ReactMethod\n  fun stopOverlayMode(promise: Promise) {\n"
replacement="""  // Store only the private gateway access token; NEVER the OpenAI provider key.
  @ReactMethod
  fun configureAiVerifier(endpoint: String, accessToken: String, enabled: Boolean, promise: Promise) {
    val url = endpoint.trim().trimEnd('/')
    if (enabled && (!url.startsWith("https://") || url.contains("@") ||
         url.length !in 13..250 || accessToken.isBlank() && !reactContext
           .getSharedPreferences("scalp_atlas_ai_v1051", Context.MODE_PRIVATE)
           .contains("clientToken"))) {
      promise.reject("AI_NOT_CONFIGURED", "Introdu adresa HTTPS și tokenul privat al serverului AI.")
      return
    }
    val prefs = reactContext.getSharedPreferences("scalp_atlas_ai_v1051", Context.MODE_PRIVATE)
    val save = prefs.edit().putBoolean("enabled", enabled)
    if (url.isNotBlank()) save.putString("endpoint", url)
    if (accessToken.isNotBlank()) save.putString("clientToken", accessToken.trim())
    if (!save.commit()) {
      promise.reject("AI_SAVE_FAILED", "Nu pot salva configurarea AI.")
      return
    }
    promise.resolve(if (enabled) "AI_ENABLED" else "AI_DISABLED")
  }

  @ReactMethod
  fun aiVerifierStatus(promise: Promise) {
    val p = reactContext.getSharedPreferences("scalp_atlas_ai_v1051", Context.MODE_PRIVATE)
    val status = com.facebook.react.bridge.Arguments.createMap()
    status.putBoolean("enabled", p.getBoolean("enabled", false))
    status.putString("endpoint", p.getString("endpoint", "") ?: "")
    promise.resolve(status) // Never send the access token back to the JavaScript UI.
  }

"""
s=replace_once(s,needle,replacement+needle,"module methods")
p.write_text(s,encoding="utf-8")

p=Path(".github/native-overlay/ScalpOverlayService.kt")
s=p.read_text(encoding="utf-8")
s=replace_once(s,
    "import org.json.JSONObject\n",
    """import org.json.JSONObject
import java.net.URL
import java.net.HttpURLConnection
import java.util.UUID
""",
    "network imports")
s=replace_once(s,
    "  private var analyzerWebView: WebView? = null\n",
    """  // AI SECOND-OPINION GATE v1.0.51 (optional, server-side vision).
  @Volatile private var lastChartJpeg: String? = null
  @Volatile private var lastChartAt: Long = 0L
  @Volatile private var aiPendingKey: String? = null
  @Volatile private var aiApprovedKey: String? = null
  @Volatile private var aiApprovedAt = 0L
  @Volatile private var aiRejectedKey: String? = null
  private var analyzerWebView: WebView? = null
""",
    "native state")

s=replace_once(s,
    "      val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)\n",
    """      val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
      lastChartJpeg = base64
      lastChartAt = now
""",
    "save last chart crop only")

helper="""  // AI can be enabled only after the user configures an HTTPS backend.
  // If enabled, missing, stale, contradictory or late AI never falls back to BIP.
  private fun aiSecondOpinionBlock(now: Long, proposed: String): String? {
    val prefs = getSharedPreferences("scalp_atlas_ai_v1051", Context.MODE_PRIVATE)
    if (!prefs.getBoolean("enabled", false)) return null // Original Scalp Atlas mode.
    val endpoint = (prefs.getString("endpoint", "") ?: "").trim().trimEnd('/')
    val token = prefs.getString("clientToken", "") ?: ""
    if (!endpoint.startsWith("https://") || token.isBlank()) {
      return "AI neconectat • BIP blocat • configurează serverul"
    }

    val candleMs = if (currentTimeframe == "M5") 300_000L else if (currentTimeframe == "M10") 600_000L else 0L
    val pair = currentPair.trim().uppercase()
    if (candleMs == 0L || pair.isBlank() || pair == "—" || pair == "UNKNOWN") {
      return "AI așteaptă perechea și timeframe-ul confirmate"
    }
    val candleStart = (now / candleMs) * candleMs
    val key = pair + "|" + currentTimeframe + "|" + candleStart + "|" + proposed
    if (key == aiRejectedKey) return "AI nu a confirmat această lumânare • FĂRĂ BIP"
    if (key == aiApprovedKey && now - aiApprovedAt in 0L..8000L) return null
    if (key == aiPendingKey) return "AI verifică imaginea • fără BIP până la rezultat"

    val image = lastChartJpeg
    if (image.isNullOrBlank() || now - lastChartAt !in 0L..4500L) {
      return "AI nu are imagine recentă • FĂRĂ BIP"
    }
    // Do not send private header, account balance or order history.
    val reqId = UUID.randomUUID().toString().replace("-", "")
    aiPendingKey = key
    val payload = JSONObject()
      .put("requestId", reqId)
      .put("pair", pair)
      .put("timeframe", currentTimeframe)
      .put("direction", proposed)
      .put("sentAt", now)
      .put("image", "data:image/jpeg;base64," + image)
      .toString()
    Thread({
      var connection: HttpURLConnection? = null
      try {
        connection = (URL(endpoint + "/v1/confirm").openConnection() as HttpURLConnection).apply {
          requestMethod = "POST"
          connectTimeout = 3300
          readTimeout = 6200
          doOutput = true
          setRequestProperty("Content-Type", "application/json")
          setRequestProperty("Authorization", "Bearer " + token)
          setRequestProperty("Cache-Control", "no-store")
        }
        connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
        val responseText = if (connection.responseCode == 200) {
          connection.inputStream.bufferedReader().use { it.readText().take(16_384) }
        } else ""
        val response = if (responseText.isNotBlank()) JSONObject(responseText) else JSONObject()
        val matches = response.optString("requestId") == reqId &&
          response.optString("direction") == proposed &&
          getSharedPreferences("scalp_atlas_ai_v1051", Context.MODE_PRIVATE).getBoolean("enabled", false) &&
          System.currentTimeMillis() - now <= 9_000L &&
          currentPair.trim().uppercase() == pair &&
          currentTimeframe == payloadTimeframeForKey(key)
        if (matches && aiPendingKey == key) {
          aiApprovedKey = key
          aiApprovedAt = System.currentTimeMillis()
        } else {
          aiRejectedKey = key
        }
      } catch (_: Exception) {
        aiRejectedKey = key
      } finally {
        try { connection?.disconnect() } catch (_: Exception) {}
        if (aiPendingKey == key) aiPendingKey = null
      }
    }, "ScalpAtlasAiConfirm").start()
    return "AI verifică direcția • FĂRĂ BIP până la confirmare"
  }

  private fun payloadTimeframeForKey(key: String): String =
    key.split('|').getOrNull(1) ?: "AUTO"

"""
s=replace_once(s,"  private fun handleResult(result: JSONObject) {\n",helper+"  private fun handleResult(result: JSONObject) {\n","AI HTTP gate")
# Dedupe writing follows this call, so rejected AI never burns the one-alert-per-bar key.
anchor="    // ONE-ALERT-PER-M10-BAR v1.0.45:\n"
gate="""    // AI vote happens only once LOCAL confirmation is already satisfied.
    // No sound is emitted until both independent reviewers agree.
    val aiBlock = aiSecondOpinionBlock(now, rawSignal)
    if (aiBlock != null) {
      updateOverlay(
        "AȘTEAPTĂ",
        "$currentPair • $currentTimeframe • MOTOR LOCAL CONFIRMAT • NU INTRA",
        aiBlock
      )
      return
    }

"""
s=replace_once(s,anchor,gate+anchor,"insert before dedupe/sound")

s=replace_once(s,
    "      signalText?.text = signal\n",
    """      signalText?.text = signal
      // The overlay visibly indicates whether network AI is participating.
      val aiOn = getSharedPreferences("scalp_atlas_ai_v1051", Context.MODE_PRIVATE)
        .getBoolean("enabled", false)
      if (aiOn && !details.contains("AI")) {
        detailText?.text = details + " • AI activ"
      }
""",
    "AI status shown, no layout changes")
# Original detailText assignment overwrites above; patch it.
s=replace_once(s,
    "      detailText?.text = details\n",
    """      detailText?.text = if (aiOn && !details.contains("AI")) details + " • AI activ" else details
""",
    "AI status proper detail")
# Delete the redundant early assignment.
s=replace_once(s,
    """      if (aiOn && !details.contains("AI")) {
        detailText?.text = details + " • AI activ"
      }
""",
    "",
    "no redundant assignment")

if "AI SECOND-OPINION GATE v1.0.51" not in s or s.count("aiSecondOpinionBlock(now, rawSignal)")!=1:
    raise SystemExit("v1051 AI native gate missing")
p.write_text(s,encoding="utf-8")
print("v1.0.51 optional server AI: protected config and BIP gate applied")
