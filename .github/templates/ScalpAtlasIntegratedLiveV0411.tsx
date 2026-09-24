import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { recognizeText } from 'expo-ocr-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { ANALYSIS_ENGINE_HTML } from './analysisEngine';
import { SCALP_ATLAS_COUNT } from './atlas';

type Signal = 'BUY' | 'SELL' | 'NONE';
type Bias = 'BUY' | 'SELL' | null;
type Screen = 'LIVE' | 'HISTORY' | 'STATS' | 'JOURNAL';
type Outcome = 'PENDING' | 'WIN' | 'LOSS';

type AnalysisResult = {
  signal: Signal;
  state?: 'SIGNAL' | 'WAIT' | 'NONE' | 'INVALID';
  bias?: Bias;
  pattern: string;
  probability: number;
  expiry: number | null;
  reason: string;
  atlasCount: number;
  quality: number;
  directionMin?: number | null;
  directionMax?: number | null;
  trendStrength?: number | null;
  volatility?: number | null;
  anchorX?: number | null;
  anchorY?: number | null;
  channelType?: string | null;
  channelPosition?: string | null;
  channelQuality?: number | null;
  trendLines?: Array<{
    kind: 'support' | 'resistance' | 'confirmation' | 'channelUpper' | 'channelLower' | 'channelMid' | string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>;
};

type HistoryItem = {
  id: string;
  createdAt: number;
  signal: 'BUY' | 'SELL' | 'WAIT';
  bias: Bias;
  pattern: string;
  probability: number;
  expiry: number | null;
  directionMin?: number | null;
  directionMax?: number | null;
  timeframe: string;
  reason: string;
  outcome: Outcome;
  amount: string;
  note: string;
};

const VALID_TIMEFRAMES = ['M1', 'M2', 'M3', 'M5', 'M10', 'M15', 'M30', 'H1'];
const SCAN_INTERVAL_MS = 2000;

const detectBrokerTimeframe = (ocrText: string): string | null => {
  const text = String(ocrText || '').toUpperCase();
  const patterns: Array<[string, RegExp]> = [
    ['M30', /(?:^|[^A-Z0-9])M\s*3[0O](?:[^A-Z0-9]|$)/],
    ['M15', /(?:^|[^A-Z0-9])M\s*[1I][5S](?:[^A-Z0-9]|$)/],
    ['M10', /(?:^|[^A-Z0-9])M\s*[1I][0O](?:[^A-Z0-9]|$)/],
    ['M5',  /(?:^|[^A-Z0-9])M\s*[5S](?:[^A-Z0-9]|$)/],
    ['M3',  /(?:^|[^A-Z0-9])M\s*3(?:[^A-Z0-9]|$)/],
    ['M2',  /(?:^|[^A-Z0-9])M\s*2(?:[^A-Z0-9]|$)/],
    ['M1',  /(?:^|[^A-Z0-9])M\s*[1I](?:[^A-Z0-9]|$)/],
    ['H1',  /(?:^|[^A-Z0-9])H\s*[1I](?:[^A-Z0-9]|$)/],
  ];
  for (const [tf, pattern] of patterns) {
    if (pattern.test(text) && VALID_TIMEFRAMES.includes(tf)) return tf;
  }
  return null;
};
const HISTORY_KEY = 'scalpAtlas.live.history.v1';

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleString('ro-RO', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function LiveAnalysisApp() {
  const cameraRef = useRef<CameraView | null>(null);
  const analyzerRef = useRef<WebView>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRef = useRef(false);
  const captureBusyRef = useRef(false);
  const engineReadyRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const lockedRef = useRef(false);
  const timeframeRef = useRef<string | null>(null);
  const signalCandidateRef = useRef<{ dir: 'BUY' | 'SELL' | null; count: number }>({ dir: null, count: 0 });
  const pulseAnim = useRef(new Animated.Value(0.35)).current;
  const buyAlertPlayer = useAudioPlayer(require('./assets/buy-alert.wav'));
  const sellAlertPlayer = useAudioPlayer(require('./assets/sell-alert.wav'));

  const [permission, requestPermission] = useCameraPermissions();
  const [screen, setScreen] = useState<Screen>('LIVE');
  const [cameraReady, setCameraReady] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [live, setLive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [detectedTimeframe, setDetectedTimeframe] = useState<string | null>(null);
  const [cameraSize, setCameraSize] = useState({ width: 0, height: 0 });
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [message, setMessage] = useState('Poziționează camera pe grafic și apasă CAMERA LIVE.');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [directionRemainingSeconds, setDirectionRemainingSeconds] = useState(0);
  const [directionWindowSeconds, setDirectionWindowSeconds] = useState(0);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!live) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0.35);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [live, pulseAnim]);

  useEffect(() => {
    engineReadyRef.current = engineReady;
  }, [engineReady]);

  useEffect(() => {
    cameraReadyRef.current = cameraReady;
  }, [cameraReady]);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setHistory(parsed.slice(0, 100));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      liveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (directionWindowSeconds <= 0) return;
    const interval = setInterval(() => {
      setDirectionRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [directionWindowSeconds]);

  const saveHistory = (next: HistoryItem[]) => {
    const trimmed = next.slice(0, 100);
    setHistory(trimmed);
    void AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  };

  const recordResult = (result: AnalysisResult) => {
    const isWait = result.state === 'WAIT' || (result.signal === 'NONE' && !!result.bias);
    if (result.signal === 'NONE' && !isWait) return;

    const signal: HistoryItem['signal'] = isWait ? 'WAIT' : result.signal as 'BUY' | 'SELL';
    const now = Date.now();
    const first = history[0];
    const activeTf = timeframeRef.current || 'AUTO';
    const signature = [signal, result.bias || '', result.pattern || '', activeTf].join('|');
    const firstSignature = first
      ? [first.signal, first.bias || '', first.pattern || '', first.timeframe].join('|')
      : '';

    if (first && signature === firstSignature && now - first.createdAt < 45000) return;

    const item: HistoryItem = {
      id: `live_${now}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      signal,
      bias: result.bias || null,
      pattern: result.pattern || '—',
      probability: Number(result.probability || 0),
      expiry: result.expiry || null,
      directionMin: result.directionMin || null,
      directionMax: result.directionMax || null,
      timeframe: activeTf,
      reason: result.reason || '',
      outcome: 'PENDING',
      amount: '',
      note: '',
    };
    saveHistory([item, ...history]);
  };

  const updateRecord = (id: string, patch: Partial<HistoryItem>) => {
    const next = history.map((item) => item.id === id ? { ...item, ...patch } : item);
    saveHistory(next);
  };

  const clearHistory = () => {
    saveHistory([]);
  };

  const scheduleNext = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!liveRef.current) return;
    timerRef.current = setTimeout(() => {
      void captureAndAnalyze(false);
    }, SCAN_INTERVAL_MS);
  };

  const captureAndAnalyze = async (manual: boolean) => {
    if (!manual && !liveRef.current) return;
    if (!lockedRef.current || !cameraReadyRef.current || !engineReadyRef.current || !cameraRef.current || !analyzerRef.current) {
      setMessage('Camera, cadrul sau motorul Atlas nu este încă pregătit.');
      if (!manual) scheduleNext();
      return;
    }
    if (captureBusyRef.current) return;

    captureBusyRef.current = true;
    setScanning(true);
    setMessage(manual ? 'Scanare manuală în curs…' : 'Analizez cadrul LIVE…');

    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.42,
        base64: true,
        skipProcessing: true,
        shutterSound: false,
      });

      if (!picture?.base64) {
        captureBusyRef.current = false;
        setScanning(false);
        setMessage('Cadrul nu a putut fi citit. Reiau automat.');
        if (!manual) scheduleNext();
        return;
      }

      let activeTf = timeframeRef.current;
      try {
        const ocr = await recognizeText(picture.uri);
        const brokerTf = detectBrokerTimeframe(ocr?.text || '');
        if (brokerTf) {
          activeTf = brokerTf;
          timeframeRef.current = brokerTf;
          setDetectedTimeframe(brokerTf);
        }
      } catch {
        // Păstrăm ultimul timeframe detectat; nu ghicim unul nou.
      }

      // Semnalul/pattern-ul nu este blocat dacă OCR-ul nu citește timeframe-ul din primul cadru.
      // Folosim M15 numai intern pentru rularea motorului; expirarea este ascunsă până la TF real.
      const engineTf = activeTf || 'M15';
      if (!activeTf) {
        setMessage('Timeframe AUTO se citește în continuare. Analiza structurii rămâne activă.');
      }

      analyzerRef.current.postMessage(JSON.stringify({
        type: 'ANALYZE',
        dataUrl: `data:image/jpeg;base64,${picture.base64}`,
        timeframe: engineTf,
      }));
    } catch (error) {
      captureBusyRef.current = false;
      setScanning(false);
      setMessage(`Camera nu a putut captura cadrul: ${error instanceof Error ? error.message : 'eroare'}`);
      if (!manual) scheduleNext();
    }
  };

  const startLive = () => {
    if (!cameraReadyRef.current || !engineReadyRef.current) {
      setMessage('Camera sau motorul Atlas încă se pregătește.');
      return;
    }
    lockedRef.current = true;
    setLocked(true);
    liveRef.current = true;
    setLive(true);
    setMessage('CAMERA LIVE activă. Graficul este urmărit automat.');
    void captureAndAnalyze(false);
  };

  const pauseLive = () => {
    liveRef.current = false;
    setLive(false);
    setScanning(false);
    captureBusyRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage('LIVE este în pauză. Camera rămâne poziționată.');
  };

  const stopLive = () => {
    liveRef.current = false;
    setLive(false);
    setScanning(false);
    captureBusyRef.current = false;
    signalCandidateRef.current = { dir: null, count: 0 };
    if (timerRef.current) clearTimeout(timerRef.current);
    lockedRef.current = false;
    setLocked(false);
    setAnalysis(null);
    setDirectionRemainingSeconds(0);
    setDirectionWindowSeconds(0);
    setMessage('CAMERA LIVE oprită. Repoziționează telefonul dacă este necesar.');
  };

  const changeScreen = (next: Screen) => {
    if (next !== 'LIVE' && liveRef.current) pauseLive();
    setScreen(next);
  };

  const toggleLock = () => {
    if (liveRef.current) return;
    const next = !lockedRef.current;
    lockedRef.current = next;
    setLocked(next);
    setMessage(next
      ? 'Grafic fixat. Poți porni LIVE sau SCANEAZĂ ACUM.'
      : 'Blocarea a fost eliberată. Repoziționează camera.');
  };

  const playConfirmedAlert = (direction: 'BUY' | 'SELL') => {
    const player = direction === 'BUY' ? buyAlertPlayer : sellAlertPlayer;

    void (async () => {
      try {
        await player.seekTo(0);
        player.play();
      } catch {
        // Semnalul rămâne valid chiar dacă sunetul nu poate fi redat.
      }

      try {
        await Haptics.notificationAsync(
          direction === 'BUY'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning
        );
      } catch {
        // Vibrația este opțională și nu blochează analiza LIVE.
      }
    })();
  };

  const onAnalyzerMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || '{}');
      if (payload.type === 'READY') {
        const ok = payload.atlasCount === SCALP_ATLAS_COUNT;
        setEngineReady(ok);
        engineReadyRef.current = ok;
        if (!ok) setMessage('Motorul Atlas nu a încărcat toate cele 70 de modele.');
        return;
      }

      if (payload.type === 'RESULT') {
        const rawResult = payload.result as AnalysisResult;
        let result: AnalysisResult = timeframeRef.current
          ? rawResult
          : { ...rawResult, expiry: null, directionMin: null, directionMax: null };

        // v0.4.5 — ANTI-FLICKER LIVE.
        // Un BUY/SELL direct trebuie văzut de 2 ori consecutiv înainte de afișare.
        // La 2 secunde/cadru înseamnă aproximativ 4 secunde de consistență.
        if (rawResult.signal === 'BUY' || rawResult.signal === 'SELL') {
          const dir = rawResult.signal;
          const candidate = signalCandidateRef.current;
          const nextCount = candidate.dir === dir ? candidate.count + 1 : 1;
          signalCandidateRef.current = { dir, count: nextCount };

          if (nextCount < 2) {
            setDirectionRemainingSeconds(0);
            setDirectionWindowSeconds(0);
            result = {
              ...result,
              signal: 'NONE',
              state: 'WAIT',
              bias: dir,
              expiry: null,
              directionMin: null,
              directionMax: null,
              reason: `Confirmare LIVE ${nextCount}/2 pentru ${dir}. Aștept consistența semnalului înainte de confirmare.`,
            };
          } else if (nextCount === 2) {
            // Alertă o singură dată la confirmarea 2/2; nu repetăm la 3/2, 4/2 etc.
            playConfirmedAlert(dir);
            const maxMinutes = Number(result.directionMax || 0);
            if (maxMinutes > 0 && timeframeRef.current) {
              const totalSeconds = Math.max(60, Math.round(maxMinutes * 60));
              setDirectionWindowSeconds(totalSeconds);
              setDirectionRemainingSeconds(totalSeconds);
            }
          }
        } else {
          // WAIT/NONE întrerupe seria; nu păstrăm o direcție veche.
          signalCandidateRef.current = { dir: null, count: 0 };
          setDirectionRemainingSeconds(0);
          setDirectionWindowSeconds(0);
        }

        setAnalysis(result);
        captureBusyRef.current = false;
        setScanning(false);
        recordResult(result);

        const isWait = result.state === 'WAIT' || (result.signal === 'NONE' && !!result.bias);
        if (isWait) {
          const candidateCount = signalCandidateRef.current.dir === result.bias ? signalCandidateRef.current.count : 0;
          const suffix = candidateCount > 0 && candidateCount < 2 ? ` • ${candidateCount}/2` : '';
          setMessage(`AȘTEAPTĂ CONFIRMARE${result.bias ? ' ' + result.bias : ''}${suffix}. Urmărirea continuă.`);
        } else if (result.signal === 'BUY' || result.signal === 'SELL') {
          setMessage(`${result.signal} CONFIRMAT • ${result.pattern} • ${result.probability}%`);
        } else {
          setMessage(result.reason || 'Fără semnal clar. Urmărirea continuă.');
        }

        if (liveRef.current) scheduleNext();
        return;
      }

      if (payload.type === 'ERROR') {
        captureBusyRef.current = false;
        setScanning(false);
        setMessage(`Analiza nu a reușit: ${payload.message || 'eroare necunoscută'}`);
        if (liveRef.current) scheduleNext();
      }
    } catch {
      captureBusyRef.current = false;
      setScanning(false);
      setMessage('Motorul Atlas a returnat un răspuns invalid.');
      if (liveRef.current) scheduleNext();
    }
  };

  const stats = useMemo(() => {
    const buy = history.filter((x) => x.signal === 'BUY').length;
    const sell = history.filter((x) => x.signal === 'SELL').length;
    const wait = history.filter((x) => x.signal === 'WAIT').length;
    const decided = history.filter((x) => x.signal !== 'WAIT');
    const avg = decided.length
      ? Math.round(decided.reduce((sum, x) => sum + x.probability, 0) / decided.length)
      : 0;
    const wins = history.filter((x) => x.outcome === 'WIN').length;
    const losses = history.filter((x) => x.outcome === 'LOSS').length;
    const patterns: Record<string, number> = {};
    const frames: Record<string, number> = {};
    history.forEach((x) => {
      patterns[x.pattern] = (patterns[x.pattern] || 0) + 1;
      frames[x.timeframe] = (frames[x.timeframe] || 0) + 1;
    });
    const topPattern = Object.entries(patterns).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const topTf = Object.entries(frames).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    return { total: history.length, buy, sell, wait, avg, wins, losses, topPattern, topTf };
  }, [history]);

  const isWait = analysis?.state === 'WAIT' || (analysis?.signal === 'NONE' && !!analysis?.bias);
  const resultTitle = analysis
    ? isWait
      ? `AȘTEAPTĂ CONFIRMARE${analysis.bias ? ' ' + analysis.bias : ''}`
      : analysis.signal === 'NONE'
        ? 'FĂRĂ SEMNAL CLAR'
        : analysis.signal
    : 'ÎN AȘTEPTARE';

  const resultTone =
    analysis?.signal === 'BUY' || (isWait && analysis?.bias === 'BUY')
      ? styles.buy
      : analysis?.signal === 'SELL' || (isWait && analysis?.bias === 'SELL')
        ? styles.sell
        : isWait
          ? styles.wait
          : styles.neutral;


  const scoreValue = Math.max(0, Math.min(100, Number(analysis?.probability || 0)));
  const scoreColor = scoreValue >= 75
    ? '#38d996'
    : scoreValue >= 60
      ? '#ffd34d'
      : '#ff6464';

  const directionProgress = directionWindowSeconds > 0
    ? Math.max(0, Math.min(100, directionRemainingSeconds / directionWindowSeconds * 100))
    : 0;
  const directionRemainingLabel = useMemo(() => {
    const minutes = Math.floor(directionRemainingSeconds / 60);
    const seconds = directionRemainingSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [directionRemainingSeconds]);


  const confirmationBadgeStyle = useMemo(() => {
    if (!isWait || !cameraSize.width || !cameraSize.height) return null;
    const line = analysis?.trendLines?.find((item) => item.kind === 'confirmation');
    const nx = line ? (line.x1 + line.x2) / 2 : (analysis?.anchorX ?? 0.72);
    const ny = line ? (line.y1 + line.y2) / 2 : (analysis?.anchorY ?? 0.50);
    const badgeW = 112;
    const badgeH = 28;
    const rawLeft = nx * cameraSize.width - badgeW / 2;
    const rawTop = analysis?.bias === 'SELL'
      ? ny * cameraSize.height + 8
      : ny * cameraSize.height - badgeH - 8;
    return {
      left: Math.max(8, Math.min(cameraSize.width - badgeW - 8, rawLeft)),
      top: Math.max(46, Math.min(cameraSize.height - badgeH - 8, rawTop)),
      width: badgeW,
    };
  }, [analysis, isWait, cameraSize]);

  const renderScalpLine = (line: NonNullable<AnalysisResult['trendLines']>[number], index: number) => {
    if (!cameraSize.width || !cameraSize.height) return null;
    const x1 = line.x1 * cameraSize.width;
    const y1 = line.y1 * cameraSize.height;
    const x2 = line.x2 * cameraSize.width;
    const y2 = line.y2 * cameraSize.height;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (!Number.isFinite(length) || length < 2) return null;
    const angle = Math.atan2(dy, dx) + 'rad';
    const middleX = (x1 + x2) / 2;
    const middleY = (y1 + y2) / 2;

    const tone =
      line.kind === 'support'
        ? styles.scalpSupport
        : line.kind === 'resistance'
          ? styles.scalpResistance
          : line.kind === 'confirmation'
            ? styles.scalpConfirmation
            : line.kind === 'channelMid'
              ? styles.scalpChannelMid
              : styles.scalpChannel;

    return (
      <View
        key={`scalp-line-${line.kind}-${index}`}
        pointerEvents="none"
        style={[
          styles.scalpLine,
          tone,
          {
            width: length,
            left: middleX - length / 2,
            top: middleY - 1,
            transform: [{ rotate: angle }],
          },
        ]}
      />
    );
  };

  const nav = (
    <View style={styles.nav}>
      {(['LIVE', 'HISTORY', 'STATS', 'JOURNAL'] as Screen[]).map((item) => (
        <Pressable key={item} onPress={() => changeScreen(item)} style={[styles.navButton, screen === item && styles.navActive]}>
          <Text style={[styles.navText, screen === item && styles.navTextActive]}>
            {item === 'HISTORY' ? 'ISTORIC' : item === 'STATS' ? 'STATISTICI' : item === 'JOURNAL' ? 'JURNAL' : 'LIVE'}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const historyRow = (item: HistoryItem, journal = false) => (
    <View key={item.id} style={styles.historyCard}>
      <View style={styles.historyTop}>
        <Text style={[
          styles.historySignal,
          item.signal === 'BUY' ? styles.buy : item.signal === 'SELL' ? styles.sell : styles.wait,
        ]}>
          {item.signal === 'WAIT' ? `AȘTEAPTĂ${item.bias ? ' ' + item.bias : ''}` : item.signal}
        </Text>
        <Text style={styles.historyTime}>{formatTime(item.createdAt)}</Text>
      </View>
      <Text style={styles.historyLine}>{item.pattern} • {item.probability}% • {item.timeframe}</Text>
      <Text style={styles.historySmall}>Expirare: {item.expiry ? `${item.expiry} min` : '—'}</Text>
      <Text style={styles.historySmall}>Direcție estimată: {item.directionMin && item.directionMax ? `${item.directionMin}–${item.directionMax} min` : '—'}</Text>
      {!!item.reason && <Text style={styles.historySmall}>{item.reason}</Text>}

      {journal && item.signal !== 'WAIT' && (
        <>
          <View style={styles.outcomeRow}>
            {(['WIN', 'LOSS', 'PENDING'] as Outcome[]).map((outcome) => (
              <Pressable
                key={outcome}
                onPress={() => updateRecord(item.id, { outcome })}
                style={[
                  styles.outcomeButton,
                  item.outcome === outcome && styles.outcomeSelected,
                  outcome === 'WIN' && item.outcome === outcome && styles.outcomeWin,
                  outcome === 'LOSS' && item.outcome === outcome && styles.outcomeLoss,
                ]}
              >
                <Text style={styles.outcomeText}>{outcome === 'PENDING' ? 'NEEVALUAT' : outcome}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={item.amount}
            onChangeText={(amount) => updateRecord(item.id, { amount })}
            placeholder="Rezultat sumă (opțional)"
            placeholderTextColor="#56667a"
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <TextInput
            value={item.note}
            onChangeText={(note) => updateRecord(item.id, { note })}
            placeholder="Notă jurnal"
            placeholderTextColor="#56667a"
            style={styles.input}
          />
        </>
      )}
    </View>
  );

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            <Text style={styles.titleCyan}>SC</Text>
            <Text style={styles.titleViolet}>ALP </Text>
            <Text style={styles.titleMagenta}>ATLAS</Text>
          </Text>
          <Text style={styles.subtitle}>LIVE • {SCALP_ATLAS_COUNT} modele • 2 dispozitive</Text>
        </View>
        <View style={[styles.livePill, live ? styles.liveOn : styles.liveOff]}>
          <Animated.View
            style={[
              styles.headerLed,
              live ? styles.headerLedOn : styles.headerLedOff,
              live && {
                opacity: pulseAnim,
                transform: [{ scale: pulseAnim.interpolate({ inputRange: [0.35, 1], outputRange: [0.9, 1.18] }) }],
              },
            ]}
          />
          <Text style={styles.liveText}>{live ? 'LIVE' : 'OFF'}</Text>
        </View>
      </View>

      {nav}

      {screen === 'LIVE' && (
        <ScrollView contentContainerStyle={styles.page}>
          {!permission ? (
            <View style={styles.permissionCard}>
              <ActivityIndicator />
              <Text style={styles.neutral}>Inițializez camera…</Text>
            </View>
          ) : !permission.granted ? (
            <View style={styles.permissionCard}>
              <Text style={styles.help}>Camera este necesară pentru analiza LIVE a graficului de pe al doilea dispozitiv.</Text>
              <Pressable style={styles.primaryButton} onPress={() => void requestPermission()}>
                <Text style={styles.primaryText}>PERMITE CAMERA</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View
                style={styles.cameraWrap}
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  setCameraSize({ width, height });
                }}
              >
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  animateShutter={false}
                  onCameraReady={() => {
                    cameraReadyRef.current = true;
                    setCameraReady(true);
                  }}
                />
                <View pointerEvents="none" style={[styles.scanFrame, locked && styles.scanFrameLocked]}>
                  <Text style={styles.frameLabel}>{locked ? 'GRAFIC FIXAT' : 'ÎNCADREAZĂ GRAFICUL AICI'}</Text>
                </View>

                {!!analysis?.trendLines?.length && (
                  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    {analysis.trendLines.map(renderScalpLine)}
                  </View>
                )}

                {confirmationBadgeStyle && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.confirmationBadge,
                      confirmationBadgeStyle,
                      analysis?.bias === 'BUY'
                        ? styles.confirmationBuy
                        : analysis?.bias === 'SELL'
                          ? styles.confirmationSell
                          : styles.confirmationNeutral,
                    ]}
                  >
                    <Text
                      style={[
                        styles.confirmationText,
                        analysis?.bias === 'BUY'
                          ? styles.buy
                          : analysis?.bias === 'SELL'
                            ? styles.sell
                            : styles.wait,
                      ]}
                    >
                      {analysis?.bias ? `CONFIRMARE ${analysis.bias}` : 'CONFIRMARE'}
                    </Text>
                  </View>
                )}
                <View style={styles.overlayTop}>
                  <Text style={styles.overlayText}>
                    {live ? 'URMĂRIRE ACTIVĂ' : locked ? 'GATA DE LIVE' : 'POZIȚIONEAZĂ CAMERA'}
                  </Text>
                </View>
                <View style={styles.tfAutoBadge}>
                  <Text style={styles.tfAutoLabel}>TIMEFRAME AUTO</Text>
                  <Text style={styles.tfAutoValue}>{detectedTimeframe || '—'}</Text>
                </View>
              </View>

              <Pressable
                onPress={live ? stopLive : startLive}
                style={[
                  styles.cameraLiveButton,
                  live && styles.cameraLiveButtonOn,
                  (!cameraReady || !engineReady) && !live && styles.disabled,
                ]}
              >
                <View style={[styles.cameraLiveLed, live ? styles.cameraLiveLedOn : styles.cameraLiveLedOff]} />
                <View>
                  <Text style={styles.cameraLiveTitle}>CAMERA LIVE</Text>
                  <Text style={styles.cameraLiveSub}>
                    {live ? 'ACTIVĂ • ANALIZĂ AUTOMATĂ' : 'APASĂ PENTRU PORNIRE'}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.resultCard}>
                <Text style={styles.resultLabel}>REZULTAT LIVE • {detectedTimeframe || 'TF AUTO'}</Text>
                <Text style={[styles.resultTitle, resultTone]}>{resultTitle}</Text>
                {analysis ? (
                  <>
                    <Text style={styles.resultLine}>Model: {analysis.pattern || '—'}</Text>
                    <View style={styles.scoreHeader}>
                      <Text style={styles.resultLine}>Scor: {analysis.probability}%</Text>
                      <Text style={[styles.scorePercent, { color: scoreColor }]}>{analysis.probability}%</Text>
                    </View>
                    <View style={styles.scoreTrack}>
                      <View
                        style={[
                          styles.scoreFill,
                          {
                            width: `${scoreValue}%` as `${number}%`,
                            backgroundColor: scoreColor,
                            shadowColor: scoreColor,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.resultLine}>Expirare recomandată: {analysis.expiry ? `${analysis.expiry} min` : detectedTimeframe ? '—' : 'după detectarea timeframe-ului'}</Text>
                    <Text style={styles.resultLine}>
                      Durată estimată direcție: {analysis.signal !== 'NONE' && analysis.directionMin && analysis.directionMax
                        ? `${analysis.directionMin}–${analysis.directionMax} min`
                        : isWait
                          ? 'după confirmarea 2/2'
                          : detectedTimeframe
                            ? '—'
                            : 'după detectarea timeframe-ului'}
                    </Text>
                    {analysis.signal !== 'NONE' && directionWindowSeconds > 0 && (
                      <View style={styles.directionBox}>
                        <View style={styles.directionHeader}>
                          <Text style={styles.directionLabel}>FEREASTRĂ DIRECȚIE</Text>
                          <Text style={[styles.directionTime, resultTone]}>{directionRemainingLabel}</Text>
                        </View>
                        <View style={styles.directionTrack}>
                          <View
                            style={[
                              styles.directionFill,
                              {
                                width: `${directionProgress}%` as `${number}%`,
                                backgroundColor: analysis.signal === 'BUY' ? '#38d996' : '#ff6464',
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.directionHint}>
                          Estimare recalculată din timeframe, trend, consens, volatilitate și claritatea modelului.
                        </Text>
                      </View>
                    )}
                    {!!analysis.channelType && (
                      <Text style={styles.channelInfo}>
                        Scalp: {analysis.channelType}{analysis.channelPosition ? ` • ${analysis.channelPosition}` : ''}{analysis.channelQuality ? ` • ${analysis.channelQuality}%` : ''}
                      </Text>
                    )}
                    <Text style={styles.reason}>{analysis.reason}</Text>
                  </>
                ) : (
                  <Text style={styles.reason}>{message}</Text>
                )}
                <Text style={styles.status}>
                  Cameră: {cameraReady ? 'PREGĂTITĂ' : 'INIȚIALIZARE'} • Motor: {engineReady ? 'PREGĂTIT' : 'INIȚIALIZARE'} • TF: {detectedTimeframe || 'AUTO'} • Scanare: ~2 sec • Confirmare: 2 cadre • Alarmă: ON
                </Text>
              </View>

              <View style={styles.messageBar}>
                <Text style={styles.messageText}>{message}</Text>
              </View>
            </>
          )}
        </ScrollView>
      )}

      {screen === 'HISTORY' && (
        <ScrollView contentContainerStyle={styles.listPage}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>ISTORIC LIVE</Text>
              <Text style={styles.sectionSub}>{history.length} înregistrări locale • maxim 100</Text>
            </View>
            <Pressable onPress={clearHistory} style={styles.clearButton}>
              <Text style={styles.clearText}>ȘTERGE</Text>
            </Pressable>
          </View>
          {history.length ? history.map((item) => historyRow(item)) : <Text style={styles.empty}>Nu există încă analize LIVE salvate.</Text>}
        </ScrollView>
      )}

      {screen === 'STATS' && (
        <ScrollView contentContainerStyle={styles.listPage}>
          <Text style={styles.sectionTitle}>STATISTICI LIVE</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}><Text style={styles.statValue}>{stats.total}</Text><Text style={styles.statLabel}>TOTAL</Text></View>
            <View style={styles.statCard}><Text style={[styles.statValue, styles.buy]}>{stats.buy}</Text><Text style={styles.statLabel}>BUY</Text></View>
            <View style={styles.statCard}><Text style={[styles.statValue, styles.sell]}>{stats.sell}</Text><Text style={styles.statLabel}>SELL</Text></View>
            <View style={styles.statCard}><Text style={[styles.statValue, styles.wait]}>{stats.wait}</Text><Text style={styles.statLabel}>AȘTEAPTĂ</Text></View>
            <View style={styles.statCard}><Text style={styles.statValue}>{stats.avg}%</Text><Text style={styles.statLabel}>SCOR MEDIU</Text></View>
            <View style={styles.statCard}><Text style={styles.statValue}>{stats.wins}/{stats.losses}</Text><Text style={styles.statLabel}>WIN / LOSS</Text></View>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailLabel}>MODEL CEL MAI FRECVENT</Text>
            <Text style={styles.detailValue}>{stats.topPattern}</Text>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailLabel}>TIMEFRAME CEL MAI FOLOSIT</Text>
            <Text style={styles.detailValue}>{stats.topTf}</Text>
          </View>
          <Text style={styles.disclaimer}>Statisticile sunt calculate numai din istoricul local al aplicației și nu reprezintă o promisiune de profit.</Text>
        </ScrollView>
      )}

      {screen === 'JOURNAL' && (
        <ScrollView contentContainerStyle={styles.listPage}>
          <Text style={styles.sectionTitle}>JURNAL TRANZACȚII</Text>
          <Text style={styles.sectionSub}>Marchează manual rezultatul semnalelor BUY/SELL și adaugă sumă/notă.</Text>
          {history.filter((x) => x.signal !== 'WAIT').length
            ? history.filter((x) => x.signal !== 'WAIT').map((item) => historyRow(item, true))
            : <Text style={styles.empty}>Nu există încă semnale BUY/SELL pentru jurnal.</Text>}
        </ScrollView>
      )}

      <WebView
        ref={analyzerRef}
        source={{ html: ANALYSIS_ENGINE_HTML }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        onMessage={onAnalyzerMessage}
        style={styles.hiddenAnalyzer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#070b12' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: 0.8, textShadowColor: 'rgba(139,92,255,0.36)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 7 },
  titleCyan: { color: '#31d8ee' },
  titleViolet: { color: '#8b5cff' },
  titleMagenta: { color: '#ff4fd8' },
  subtitle: { color: '#7f8b9e', fontSize: 10, marginTop: 2 },
  help: { color: '#b6c2d1', textAlign: 'center', lineHeight: 20 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, transform: [{ translateY: 18 }] },
  liveOn: { borderColor: '#ff405b', backgroundColor: 'rgba(65,18,28,0.55)' },
  liveOff: { borderColor: '#39465a', backgroundColor: '#101722' },
  headerLed: { width: 10, height: 10, borderRadius: 5 },
  headerLedOn: { backgroundColor: '#ff263f', shadowColor: '#ff263f', shadowOpacity: 0.95, shadowRadius: 8, elevation: 8 },
  headerLedOff: { backgroundColor: '#536174' },
  liveText: { color: '#f7f9fc', fontSize: 11, fontWeight: '900' },

  nav: { flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingTop: 2, paddingBottom: 7 },
  navButton: { flex: 1, borderWidth: 1, borderColor: '#27344a', borderRadius: 8, paddingVertical: 7, alignItems: 'center', backgroundColor: '#0b111a' },
  navActive: { borderColor: '#38d996', backgroundColor: '#123a2b' },
  navText: { color: '#718197', fontSize: 9, fontWeight: '900' },
  navTextActive: { color: '#71f0b3' },

  page: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  listPage: { padding: 12, paddingBottom: 30, gap: 10 },
  permissionCard: { minHeight: 360, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
  cameraWrap: { width: '100%', aspectRatio: 4 / 3, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: '#263247', backgroundColor: '#0d131d' },
  scanFrame: { position: 'absolute', left: '5%', right: '5%', top: '10%', bottom: '10%', borderWidth: 2, borderColor: '#ffd34d', borderRadius: 12 },
  scanFrameLocked: { borderColor: '#38d996', borderWidth: 3 },
  frameLabel: { position: 'absolute', top: 6, alignSelf: 'center', color: '#fff', fontSize: 10, fontWeight: '900', backgroundColor: 'rgba(0,0,0,0.58)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  overlayTop: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.58)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  overlayText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  tfAutoBadge: { position: 'absolute', top: 8, right: 8, minWidth: 86, alignItems: 'center', borderWidth: 1, borderColor: '#31d8ee', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: 'rgba(4,12,20,0.76)' },
  tfAutoLabel: { color: '#7f9bb1', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  tfAutoValue: { color: '#f7fbff', fontSize: 16, fontWeight: '900', marginTop: 1 },
  scalpLine: { position: 'absolute', height: 2, borderRadius: 2, zIndex: 20 },
  scalpSupport: { backgroundColor: '#38d996', opacity: 0.96, height: 2 },
  scalpResistance: { backgroundColor: '#ff6464', opacity: 0.96, height: 2 },
  scalpConfirmation: { backgroundColor: '#ffd34d', opacity: 0.92, height: 2 },
  scalpChannel: { backgroundColor: '#63a8ff', opacity: 0.88, height: 2 },
  scalpChannelMid: { backgroundColor: '#63a8ff', opacity: 0.48, height: 1 },
  confirmationBadge: { position: 'absolute', zIndex: 35, minHeight: 28, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: 'rgba(7,12,18,0.93)' },
  confirmationBuy: { borderColor: '#38d996' },
  confirmationSell: { borderColor: '#ff6464' },
  confirmationNeutral: { borderColor: '#ffd34d' },
  confirmationText: { fontSize: 10, lineHeight: 13, fontWeight: '900', textAlign: 'center', letterSpacing: 0.15 },

  cameraLiveButton: { marginTop: 10, minHeight: 72, borderWidth: 2, borderColor: '#4a596d', borderRadius: 18, paddingHorizontal: 20, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13, backgroundColor: '#101722' },
  cameraLiveButtonOn: { borderColor: '#ff405b', backgroundColor: '#24131a' },
  cameraLiveLed: { width: 15, height: 15, borderRadius: 8, borderWidth: 2 },
  cameraLiveLedOn: { backgroundColor: '#ff263f', borderColor: '#ff8797', shadowColor: '#ff263f', shadowOpacity: 0.9, shadowRadius: 7, elevation: 7 },
  cameraLiveLedOff: { backgroundColor: '#4b5969', borderColor: '#718197' },
  cameraLiveTitle: { color: '#f7f9fc', fontSize: 19, fontWeight: '900', letterSpacing: 0.9 },
  cameraLiveSub: { color: '#9aabba', fontSize: 9, fontWeight: '900', marginTop: 2, letterSpacing: 0.4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  lockButton: { flexGrow: 1, minWidth: 130, borderWidth: 1, borderColor: '#ffd34d', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  lockButtonActive: { borderColor: '#38d996', backgroundColor: 'rgba(13,55,40,0.42)' },
  primaryButton: { flexGrow: 1, minWidth: 105, backgroundColor: '#eaf1f8', borderRadius: 10, paddingVertical: 10, alignItems: 'center', paddingHorizontal: 10 },
  pauseButton: { flexGrow: 1, minWidth: 80, borderWidth: 1, borderColor: '#ffd34d', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  scanButton: { flexGrow: 1, minWidth: 110, borderWidth: 1, borderColor: '#31d8ee', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  stopButton: { flexGrow: 1, minWidth: 75, borderWidth: 1, borderColor: '#ff6464', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  disabled: { opacity: 0.4 },
  actionText: { color: '#eef3f8', fontWeight: '900', fontSize: 10 },
  primaryText: { color: '#0b1017', fontWeight: '900', fontSize: 10 },

  resultCard: { marginTop: 9, borderWidth: 1, borderColor: '#253044', borderRadius: 14, padding: 12, backgroundColor: '#0e151f' },
  resultLabel: { color: '#7f8b9e', fontSize: 10, fontWeight: '800' },
  resultTitle: { fontSize: 21, fontWeight: '900', marginTop: 3, marginBottom: 5 },
  resultLine: { color: '#dce5f0', fontSize: 12, lineHeight: 18 },
  scoreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  scorePercent: { fontSize: 12, fontWeight: '900' },
  scoreTrack: { height: 12, borderRadius: 7, overflow: 'hidden', backgroundColor: '#1a2330', borderWidth: 1, borderColor: '#303b4d', marginTop: 4, marginBottom: 7 },
  scoreFill: { height: '100%', minWidth: 2, borderRadius: 7, shadowOpacity: 0.85, shadowRadius: 7, elevation: 5 },
  channelInfo: { color: '#78b7ff', fontSize: 11, lineHeight: 17, fontWeight: '800', marginTop: 2 },
  directionBox: { marginTop: 5, gap: 5 },
  directionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  directionLabel: { color: '#92a3b8', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  directionTime: { fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  directionTrack: { height: 8, borderRadius: 7, overflow: 'hidden', backgroundColor: '#172233', borderWidth: 1, borderColor: '#25344a' },
  directionFill: { height: '100%', minWidth: 2, borderRadius: 7 },
  directionHint: { color: '#718197', fontSize: 9, lineHeight: 13 },
  reason: { color: '#a9b7c9', fontSize: 10, lineHeight: 15, marginTop: 4 },
  status: { color: '#65758a', fontSize: 9, marginTop: 6 },
  messageBar: { marginTop: 7, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#0b111a' },
  messageText: { color: '#8ea0b6', fontSize: 10, lineHeight: 14 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { color: '#edf3f9', fontSize: 18, fontWeight: '900' },
  sectionSub: { color: '#77879b', fontSize: 10, marginTop: 2 },
  clearButton: { borderWidth: 1, borderColor: '#ff6464', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  clearText: { color: '#ff8a8a', fontSize: 9, fontWeight: '900' },
  empty: { color: '#718197', textAlign: 'center', paddingVertical: 40 },

  historyCard: { borderWidth: 1, borderColor: '#202c3e', borderRadius: 12, padding: 11, backgroundColor: '#0d141e', gap: 5 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historySignal: { fontSize: 16, fontWeight: '900' },
  historyTime: { color: '#617188', fontSize: 9 },
  historyLine: { color: '#e1e8f1', fontSize: 12, fontWeight: '700' },
  historySmall: { color: '#8190a4', fontSize: 10, lineHeight: 14 },

  outcomeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  outcomeButton: { flex: 1, borderWidth: 1, borderColor: '#344158', borderRadius: 7, paddingVertical: 7, alignItems: 'center' },
  outcomeSelected: { backgroundColor: '#182233' },
  outcomeWin: { borderColor: '#38d996', backgroundColor: '#123a2b' },
  outcomeLoss: { borderColor: '#ff6464', backgroundColor: '#421c25' },
  outcomeText: { color: '#e4eaf2', fontSize: 9, fontWeight: '900' },
  input: { borderWidth: 1, borderColor: '#27344a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#eef3f8', backgroundColor: '#080d14', fontSize: 11 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: { width: '47.5%', borderWidth: 1, borderColor: '#202c3e', borderRadius: 12, padding: 14, backgroundColor: '#0d141e' },
  statValue: { color: '#eef3f8', fontSize: 23, fontWeight: '900' },
  statLabel: { color: '#6d7d92', fontSize: 9, fontWeight: '800', marginTop: 3 },
  detailCard: { borderWidth: 1, borderColor: '#202c3e', borderRadius: 12, padding: 13, backgroundColor: '#0d141e' },
  detailLabel: { color: '#6d7d92', fontSize: 9, fontWeight: '900' },
  detailValue: { color: '#e8eef6', fontSize: 15, fontWeight: '800', marginTop: 4 },
  disclaimer: { color: '#5d6b7e', fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 4 },

  buy: { color: '#38d996' },
  sell: { color: '#ff6464' },
  wait: { color: '#ffd34d' },
  neutral: { color: '#dce3ed' },
  hiddenAnalyzer: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -20, top: -20 },
});
