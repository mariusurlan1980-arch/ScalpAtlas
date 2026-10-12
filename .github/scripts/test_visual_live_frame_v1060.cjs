// Safety-contract check for frame-tagged, time-bounded VISUAL (screen) results.
// This is not OTC market performance validation or proof of live price access.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const native=fs.readFileSync('.github/native-overlay/ScalpOverlayService.kt','utf8');
const engine=fs.readFileSync('scalp-atlas-new/analysisEngine.ts','utf8');
let n=0;
function check(title,yes){assert.ok(yes,title);console.log('PASS',title);n++;}
check('numeric captured image ID exists in engine',
  engine.includes('function run(dataUrl,timeframe,frameId)'));
check('all engine results contain the originating frame ID',
  engine.includes('frameId:Number.isSafeInteger(frameId)?frameId:0'));
check('native JS visual-live request carries same frame ID',
  native.includes('+ submittedFrameId + ");"'));
check('native maintains the newest submitted frame ID',
  native.includes('latestSubmittedFrameId = submittedFrameId'));
check('native rejects RESULT before handling an older image',
  native.indexOf('if (!isFreshLiveFrameResponse(responseFrameId))')<
  native.indexOf('handleResult(result)'));
check('native fresh-frame gate checks matching sequence number',
  native.includes('frameId == latestSubmittedFrameId'));
check('native fresh-frame gate rejects late responses',
  native.includes('now - analysisStartedAt <= MAX_LIVE_RESULT_AGE_MS'));
check('late result does not unlock unrelated analysis in flight',
  native.includes('if (responseFrameId == latestSubmittedFrameId)'));
check('expired visual candidate is cleared, never reused',
  native.includes('clearVisualCandidateAfterExpiredFrame()'));
check('timeout and WebView error callback both tagged by frame',
  engine.includes("type:'ERROR',frameId") &&
  native.includes('val responseFrameId = payload.optLong("frameId", -1L)'));
check('we preserve existing sound and direction consistency guards',
  native.includes('playBip()') &&
  native.includes('directionConsistencyBlock(now, previewDir, rawSignal)'));
check('mode truthfully labeled visual rather than direct feed',
  native.includes('LIVE VIZUAL'));
check('no unsupported numeric feed claim',
  !native.includes('CONNECTED_TO_NUMERIC_POCKET_OPTION_TICKS'));
console.log('v1.0.60: '+n+' static integration checks. Native build still required.');
