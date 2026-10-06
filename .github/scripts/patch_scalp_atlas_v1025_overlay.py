from pathlib import Path

LIVE = Path("scalp-atlas-new/LiveAnalysisApp.tsx")
BRIDGE = Path("scalp-atlas-new/screenOverlay.ts")

def once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.")
    return text.replace(old, new, 1)

bridge = r'''import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export type PocketOverlayFrame = {
  base64: string;
  uri: string;
  width: number;
  height: number;
  timestamp: number;
};

const NativeOverlay = NativeModules.ScalpOverlay;
export const pocketOverlayAvailable = Platform.OS === 'android' && !!NativeOverlay;

export async function hasPocketOverlayPermission(): Promise<boolean> {
  if (!pocketOverlayAvailable) return false;
  return !!(await NativeOverlay.hasOverlayPermission());
}

export async function requestPocketOverlayPermission(): Promise<void> {
  if (!pocketOverlayAvailable) return;
  await NativeOverlay.requestOverlayPermission();
}

export async function startPocketOverlay(): Promise<void> {
  if (!pocketOverlayAvailable) throw new Error('Pocket Overlay este disponibil numai pe Android.');
  await NativeOverlay.start();
}

export async function stopPocketOverlay(): Promise<void> {
  if (!pocketOverlayAvailable) return;
  await NativeOverlay.stop();
}

export async function updatePocketOverlay(payload: {
  signal: 'BUY' | 'SELL' | 'WAIT' | 'NONE';
  probability: number;
  timeframe: string;
  state?: string;
}): Promise<void> {
  if (!pocketOverlayAvailable) return;
  await NativeOverlay.update(
    payload.signal,
    Number(payload.probability || 0),
    payload.timeframe || 'AUTO',
    payload.state || ''
  );
}

export function addPocketOverlayFrameListener(listener: (frame: PocketOverlayFrame) => void): () => void {
  if (!pocketOverlayAvailable) return () => {};
  const emitter = new NativeEventEmitter(NativeOverlay);
  const sub = emitter.addListener('ScalpOverlayFrame', listener);
  return () => sub.remove();
}
'''
BRIDGE.write_text(bridge, encoding="utf-8")

app = LIVE.read_text(encoding="utf-8")

app = once(
    app,
    "  View,\n} from 'react-native';",
    "  View,\n  Platform,\n} from 'react-native';",
    "import Platform",
)

app = once(
    app,
    "import { SCALP_ATLAS_COUNT } from './atlas';",
    "import { SCALP_ATLAS_COUNT } from './atlas';\nimport {\n  addPocketOverlayFrameListener,\n  hasPocketOverlayPermission,\n  pocketOverlayAvailable,\n  requestPocketOverlayPermission,\n  startPocketOverlay,\n  stopPocketOverlay,\n  updatePocketOverlay,\n  type PocketOverlayFrame,\n} from './screenOverlay';",
    "import screenOverlay",
)

app = once(
    app,
    "  const marketRef = useRef<string | null>(null);",
    "  const marketRef = useRef<string | null>(null);\n  const overlayRunningRef = useRef(false);\n  const overlayInvalidFramesRef = useRef(0);",
    "overlay refs",
)

app = once(
    app,
    "  const [live, setLive] = useState(false);",
    "  const [live, setLive] = useState(false);\n  const [overlayRunning, setOverlayRunning] = useState(false);",
    "overlay state",
)

anchor = "  const startLive = () => {"
overlay_logic = r'''
  const analyzePocketFrame = async (frame: PocketOverlayFrame) => {
    if (!overlayRunningRef.current || !engineReadyRef.current || !analyzerRef.current) return;
    if (captureBusyRef.current || !frame?.base64 || !frame?.uri) return;

    captureBusyRef.current = true;

    try {
      let activeTf = timeframeRef.current;
      let currentFrameIsChart = false;

      try {
        const ocr = await recognizeText(frame.uri);
        const ocrText = ocr?.text || '';
        currentFrameIsChart = detectChartEvidence(ocrText);
        const brokerTf = detectBrokerTimeframe(ocrText);
        const brokerMarket = detectBrokerPair(ocrText);

        const marketChanged = !!brokerMarket && !!marketRef.current && brokerMarket !== marketRef.current;
        const timeframeChanged = !!brokerTf && !!timeframeRef.current && brokerTf !== timeframeRef.current;
        if (marketChanged || timeframeChanged) {
          signalCandidateRef.current = { dir: null, count: 0, lastStepAt: 0 };
          signalLockRef.current = { dir: null, until: 0 };
          setDirectionRemainingSeconds(0);
          setDirectionWindowSeconds(0);
          setAnalysis(null);
        }

        if (brokerMarket) marketRef.current = brokerMarket;
        if (brokerTf) {
          activeTf = brokerTf;
          timeframeRef.current = brokerTf;
          setDetectedTimeframe(brokerTf);
        }
      } catch {
        currentFrameIsChart = false;
      }

      if (!currentFrameIsChart) {
        overlayInvalidFramesRef.current += 1;
        captureBusyRef.current = false;

        // Două cadre consecutive sunt necesare înainte de a declara graficul invalid.
        // Evită clipirea rezultatului când OCR ratează un singur cadru.
        if (overlayInvalidFramesRef.current < 2) {
          void updatePocketOverlay({
            signal: 'WAIT',
            probability: Number(analysis?.probability || 0),
            timeframe: timeframeRef.current || 'AUTO',
            state: 'SCANEZ',
          });
          return;
        }

        timeframeRef.current = null;
        marketRef.current = null;
        setDetectedTimeframe(null);
        signalCandidateRef.current = { dir: null, count: 0, lastStepAt: 0 };
        signalLockRef.current = { dir: null, until: 0 };
        setDirectionRemainingSeconds(0);
        setDirectionWindowSeconds(0);
        setAnalysis({
          signal: 'NONE',
          state: 'INVALID',
          bias: null,
          pattern: '—',
          probability: 0,
          expiry: null,
          reason: t('chartMissing'),
          atlasCount: SCALP_ATLAS_COUNT,
          quality: 0,
          directionMin: null,
          directionMax: null,
        });
        setMessage(t('chartMissing'));
        void updatePocketOverlay({
          signal: 'WAIT',
          probability: 0,
          timeframe: 'AUTO',
          state: 'GRAFIC?',
        });
        return;
      }

      overlayInvalidFramesRef.current = 0;
      const engineTf = activeTf || 'M15';
      if (!activeTf) setMessage(t('chartDetected'));

      analyzerRef.current.postMessage(JSON.stringify({
        type: 'ANALYZE',
        dataUrl: `data:image/jpeg;base64,${frame.base64}`,
        timeframe: engineTf,
      }));
    } catch (error) {
      captureBusyRef.current = false;
      setMessage(t('captureFailed', { error: error instanceof Error ? error.message : 'error' }));
      void updatePocketOverlay({
        signal: 'WAIT',
        probability: 0,
        timeframe: timeframeRef.current || 'AUTO',
        state: 'EROARE',
      });
    }
  };

  useEffect(() => {
    if (!pocketOverlayAvailable) return;
    return addPocketOverlayFrameListener((frame) => {
      if (overlayRunningRef.current) void analyzePocketFrame(frame);
    });
  }, [languageCode]);

  const startPocketMode = async () => {
    if (!pocketOverlayAvailable) {
      setMessage('Pocket Overlay este disponibil numai pe Android.');
      return;
    }
    if (!engineReadyRef.current) {
      setMessage(`${t('engine')}: ${t('initializing')}`);
      return;
    }

    try {
      const allowed = await hasPocketOverlayPermission();
      if (!allowed) {
        await requestPocketOverlayPermission();
        setMessage('Activează „Afișare peste alte aplicații” pentru SCALP ATLAS, apoi revino și apasă din nou POCKET OVERLAY.');
        return;
      }

      if (liveRef.current) pauseLive();

      overlayRunningRef.current = true;
      overlayInvalidFramesRef.current = 0;
      setOverlayRunning(true);
      captureBusyRef.current = false;
      signalCandidateRef.current = { dir: null, count: 0, lastStepAt: 0 };
      signalLockRef.current = { dir: null, until: 0 };
      setMessage('Pocket Overlay pornește. Acceptă capturarea ecranului, apoi deschide Pocket Option.');
      await startPocketOverlay();
      setMessage('POCKET OVERLAY ACTIV • deschide Pocket Option. Fereastra SCALP ATLAS poate fi mutată cu degetul.');
    } catch (error) {
      overlayRunningRef.current = false;
      setOverlayRunning(false);
      captureBusyRef.current = false;
      setMessage(`Pocket Overlay nu a pornit: ${error instanceof Error ? error.message : 'eroare'}`);
    }
  };

  const stopPocketMode = async () => {
    overlayRunningRef.current = false;
    overlayInvalidFramesRef.current = 0;
    setOverlayRunning(false);
    captureBusyRef.current = false;
    signalCandidateRef.current = { dir: null, count: 0, lastStepAt: 0 };
    signalLockRef.current = { dir: null, until: 0 };
    setDirectionRemainingSeconds(0);
    setDirectionWindowSeconds(0);
    try {
      await stopPocketOverlay();
    } catch {}
    setMessage('Pocket Overlay oprit.');
  };

'''
app = once(app, anchor, overlay_logic + anchor, "overlay logic")

app = once(
    app,
    "        setAnalysis(result);\n        captureBusyRef.current = false;\n        recordResult(result);",
    """        setAnalysis(result);
        captureBusyRef.current = false;
        recordResult(result);

        if (overlayRunningRef.current) {
          const overlayWait = result.state === 'WAIT' || (result.signal === 'NONE' && !!result.bias);
          void updatePocketOverlay({
            signal: overlayWait ? 'WAIT' : result.signal,
            probability: Number(result.probability || 0),
            timeframe: timeframeRef.current || 'AUTO',
            state: overlayWait && result.bias ? `WAIT ${result.bias}` : result.pattern || '',
          });
        }""",
    "overlay result update",
)

app = once(
    app,
    "          {!permission ? (",
    """          {Platform.OS === 'android' && (
            <Pressable
              onPress={() => void (overlayRunning ? stopPocketMode() : startPocketMode())}
              style={[styles.pocketOverlayButton, overlayRunning && styles.pocketOverlayButtonOn]}
            >
              <View style={[styles.pocketOverlayLed, overlayRunning && styles.pocketOverlayLedOn]} />
              <View style={styles.pocketOverlayCopy}>
                <Text style={styles.pocketOverlayTitle}>POCKET OVERLAY</Text>
                <Text style={styles.pocketOverlaySub}>
                  {overlayRunning ? 'ACTIV • DESCHIDE POCKET OPTION' : 'UN SINGUR TELEFON • ANALIZĂ PE ECRAN'}
                </Text>
              </View>
              <Text style={styles.pocketOverlayState}>{overlayRunning ? 'ON' : 'START'}</Text>
            </Pressable>
          )}

          {!permission ? (""",
    "overlay button",
)

app = once(
    app,
    "  cameraLiveButton: { marginTop: 10,",
    """  pocketOverlayButton: { marginBottom: 10, minHeight: 62, borderWidth: 1.5, borderColor: '#31d8ee', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0b1620' },
  pocketOverlayButtonOn: { borderColor: '#38d996', backgroundColor: '#10251d' },
  pocketOverlayLed: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#526477', borderWidth: 1, borderColor: '#718197' },
  pocketOverlayLedOn: { backgroundColor: '#38d996', borderColor: '#8affc6', shadowColor: '#38d996', shadowOpacity: 0.9, shadowRadius: 7, elevation: 7 },
  pocketOverlayCopy: { flex: 1 },
  pocketOverlayTitle: { color: '#f2f7fb', fontSize: 15, fontWeight: '900', letterSpacing: 0.7 },
  pocketOverlaySub: { color: '#8196aa', fontSize: 8, fontWeight: '800', marginTop: 2 },
  pocketOverlayState: { color: '#31d8ee', fontSize: 11, fontWeight: '900' },

  cameraLiveButton: { marginTop: 10,""",
    "overlay styles",
)

app = app.replace(
    "LIVE • {SCALP_ATLAS_COUNT} {t('models')} • v1.0.2 CLEAN VIEW",
    "LIVE • {SCALP_ATLAS_COUNT} {t('models')} • v1.0.25 OVERLAY",
)
app = app.replace(
    "<Text style={styles.guideVersion}>v1.0.2 CLEAN VIEW</Text>",
    "<Text style={styles.guideVersion}>v1.0.25 OVERLAY</Text>",
)

LIVE.write_text(app, encoding="utf-8")
print("Scalp Atlas v1.0.25: bridge JS + mod Pocket Overlay adăugate.")
