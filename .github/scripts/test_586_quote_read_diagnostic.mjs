import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync('.github/native-overlay/ScalpOverlayService.kt','utf8');
const workflow=readFileSync('.github/workflows/build-native-robot-safe-preflight-379.yml','utf8');

test('586: compact overlay relocates out of SELL before confirming broker amount',()=>{
 const s=service.split('private fun maybeApplyVerifiedDemoStake565(')[1]
   .split('private fun brokerHistoryClockSeconds582(')[0];
 const a=s.indexOf('if(liftOverlayOffDemoOrderButtons557())');
 const b=s.indexOf('TouchTestService.readVisibleDemoPair()!=pair');
 const c=s.indexOf('val confirmedQuote584=try');
 assert.ok(a>=0 && a<b && b<c);
 assert.match(s,/PANOU MUTAT • REVERIFIC SUMĂ\/PAYOUT/);
 assert.match(s,/getBoolean\("attempted",false\)/);
 assert.match(s,/tradePositionGate\.state\(\)!=TradePositionGate\.State\.READY/);
});
test('586: separate unreadable broker quote from genuine stake-plan mismatch',()=>{
 const s=service.split('val order565=TouchTestService.readBrokerDemoOrder476(pair)')[1].split('CHART_ONLY_DEMO_462 ->')[0];
 const p=s.indexOf('if (order565 == null)');
 const q=s.indexOf('preflightReason583(');
 assert.ok(p>=0 && q>p);
 assert.match(s,/TouchTestService\.inspectBrokerDemoOrder488\(/);
 assert.match(s,/demoAutoStakePlan565\.permitsFreshDemoOrder/);
});
test('586: relocation does not authorize trades or change Martingale state',()=>{
 const s=service.split('private fun liftOverlayOffDemoOrderButtons557()')[1].split('private fun updateOverlay(')[0];
 assert.match(s,/QT DEMO IDENTIFICAT/);
 assert.match(s,/realAccountSafetyStop517/);
 assert.match(s,/updateViewLayout/);
 assert.doesNotMatch(s,/beginAttempt|pressVerifiedDemoStakeOnce429|rebindVerifiedBasePair|onVerifiedClosed/);
});
test('586: signed Android workflow includes exact new build and test',()=>{
 assert.match(workflow,/versionCode'\]=586/);
 assert.match(workflow,/ScalpAtlas-586-QUOTE-DIAG-G24\.apk/);
 assert.match(workflow,/test_586_quote_read_diagnostic\.mjs/);
});
