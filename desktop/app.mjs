import engineHtml from './engine.mjs';
import { selectChart } from './select.mjs';

const find = (id) => document.getElementById(id);
const preview = find('preview');
const previewContext = preview.getContext('2d');
const video = document.createElement('video');
video.muted = true;
const sample = document.createElement('canvas');
const sampleContext = sample.getContext('2d');
const charts = Array.from({ length: 6 }, (_, index) => {
  const number = index + 1;
  find('slot').add(new Option(String(number), String(index)));
  const card = document.createElement('section');
  card.className = 'chart';
  const label = document.createElement('label');
  label.textContent = number + ' · ';
  const input = document.createElement('input');
  input.placeholder = 'Ex. EUR/USD OTC';
  input.maxLength = 32;
  label.append(input);
  const status = document.createElement('p');
  card.append(label, status);
  find('charts').append(card);
  const analyzer = document.createElement('iframe');
  const bridge = "<script>window.AndroidBridge={postMessage(raw){parent.postMessage(JSON.parse(raw),parent.location.origin)}}</script>";
  // A srcdoc frame inherits the parent origin and gets its own analyzer history.
  analyzer.srcdoc = engineHtml.replace('<body>', '<body>' + bridge);
  const chart = { card, input, status, analyzer, epoch: 0 };
  input.addEventListener('input', () => invalidate(chart));
  document.body.append(analyzer);
  return chart;
});
let stream;
let captureCallback;
let frameId = 0;
let lastSampleAt = -Infinity;
let dragStart;
let dragEnd;

function invalidate(chart) {
  chart.epoch++;
  chart.result = undefined;
  chart.pending = undefined;
}

window.addEventListener('message', ({ source, origin, data }) => {
  if (origin !== location.origin || !data) return;
  const chart = charts.find(({ analyzer }) => analyzer.contentWindow === source);
  if (!chart?.pending) return;
  const { id, at } = chart.pending;
  if (data.type === 'ERROR' && data.frameId === id) {
    invalidate(chart);
    return;
  }
  if (data.type !== 'RESULT' || data.result.frameId !== id
      || data.result.marketEpoch !== chart.epoch) return;
  chart.pending = undefined;
  chart.result = data.result;
  chart.capturedAt = at;
});

function stop() {
  if (captureCallback !== undefined) video.cancelVideoFrameCallback(captureCallback);
  captureCallback = undefined;
  dragStart = dragEnd = undefined;
  video.pause();
  stream?.getTracks().forEach(track => track.stop());
  stream = undefined;
  video.srcObject = null;
  for (const chart of charts) invalidate(chart);
  previewContext.clearRect(0, 0, preview.width, preview.height);
  find('start').disabled = false;
  find('stop').disabled = true;
  find('status').textContent = 'Captură oprită.';
}

find('start').onclick = async () => {
  find('start').disabled = true;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 6 }, audio: false });
    lastSampleAt = -Infinity;
    stream.getVideoTracks()[0].addEventListener('ended', stop, { once: true });
    for (const chart of charts) chart.crop = undefined;
    video.srcObject = stream;
    await video.play();
    find('stop').disabled = false;
    find('status').textContent = 'Captură activă. Selectează zonele graficelor.';
    captureCallback = video.requestVideoFrameCallback(capture);
  } catch (error) {
    stop();
    find('status').textContent = 'Captura nu a pornit. Folosește Chrome sau Edge și permite partajarea ecranului.';
  }
};
find('stop').onclick = stop;

function point(event) {
  const bounds = preview.getBoundingClientRect();
  const clamp = value => Math.max(0, Math.min(1, value));
  return { x: clamp((event.clientX - bounds.left) / bounds.width),
    y: clamp((event.clientY - bounds.top) / bounds.height) };
}

preview.onpointerdown = event => {
  if (!stream || event.button !== 0) return;
  preview.setPointerCapture(event.pointerId);
  dragStart = dragEnd = point(event);
};
preview.onpointermove = event => {
  if (dragStart) dragEnd = point(event);
};
preview.onpointercancel = () => { dragStart = dragEnd = undefined; };
preview.onpointerup = event => {
  if (!dragStart) return;
  const crop = rectangle(dragStart, point(event));
  const chart = charts[Number(find('slot').value)];
  if (crop.width * video.videoWidth >= 160 && crop.height * video.videoHeight >= 100) {
    chart.crop = crop;
    invalidate(chart);
  }
  preview.onpointercancel();
};

function rectangle(first, second) {
  return { x: Math.min(first.x, second.x), y: Math.min(first.y, second.y),
    width: Math.abs(first.x - second.x), height: Math.abs(first.y - second.y) };
}

function outline(crop, label) {
  const { width, height } = preview;
  const x = crop.x * width;
  const y = crop.y * height;
  previewContext.strokeStyle = '#42edbb';
  previewContext.lineWidth = 2;
  previewContext.strokeRect(x, y, crop.width * width, crop.height * height);
  previewContext.fillStyle = '#42edbb';
  previewContext.font = '18px system-ui';
  previewContext.fillText(label, x + 4, y + 20);
}

function capture(now) {
  if (!stream) return;
  captureCallback = video.requestVideoFrameCallback(capture);
  if (now - lastSampleAt < 450 || !video.videoWidth) return;
  lastSampleAt = now;
  const width = video.videoWidth;
  const height = video.videoHeight;
  const previewHeight = Math.round(preview.width * height / width);
  if (preview.height !== previewHeight) preview.height = previewHeight;
  previewContext.drawImage(video, 0, 0, preview.width, preview.height);
  charts.forEach((chart, index) => {
    if (!chart.crop) return;
    outline(chart.crop, String(index + 1));
    const pair = chart.input.value.trim();
    const analyze = chart.analyzer.contentWindow.ScalpAtlasAnalyze;
    if (!pair || !analyze) return;
    if (chart.pending && now - chart.pending.at < 1500) return;
    if (chart.pending) invalidate(chart);
    const { x, y, width: w, height: h } = chart.crop;
    sample.width = Math.min(520, Math.round(w * width));
    sample.height = Math.round(h * height * sample.width / (w * width));
    sampleContext.drawImage(video, x * width, y * height, w * width, h * height,
      0, 0, sample.width, sample.height);
    const id = ++frameId;
    chart.pending = { id, at: now };
    analyze(sample.toDataURL('image/jpeg', 0.88), 'M5', id, pair, chart.epoch);
  });
  if (dragStart) outline(rectangle(dragStart, dragEnd), '');
}

setInterval(() => {
  const now = performance.now();
  const winner = stream && selectChart(charts, now);
  for (const chart of charts) {
    chart.card.classList.toggle('winner', chart === winner);
    const recent = chart.result && now - chart.capturedAt <= 1500;
    const status = !stream ? 'Captură oprită' : !chart.crop ? 'Selectează zona graficului'
      : !chart.input.value.trim() ? 'Introdu perechea'
        : recent ? chart.result.reason : 'Aștept date recente';
    if (chart.status.textContent !== status) chart.status.textContent = status;
  }
  const summary = winner
    ? winner.result.brokerPair + ' · ' + winner.result.signal + ' · ȘOC ' + winner.result.shockRetracementPercent + '%'
    : 'Aștept un ȘOC confirmat';
  if (find('selection').textContent !== summary) find('selection').textContent = summary;
}, 250);
