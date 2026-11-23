import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../workflows/build-native-robot-safe-preflight-379.yml',import.meta.url),'utf8');
const monitor=service.split('private fun startBrokerAccountMonitor()')[1].split('private fun startDemoClickMonitor()')[0];
const guard=monitor.split('val unknownBaseEligible454 = ')[1].split('val unknownBaseCleared454 = ')[0];
test('607 unknown baseline accepts only 1.00 and 1.09 after independent 0 OPEN 2/2',()=>{
 for(const x of ['!demoAutoStakePlan565.isEnabled()','!demoAutoStakePlan565.isRiskStopped()','verifiedClosedDetail437 == null','demoRecoveryLedger.verifiedOpenPositionId429() == null','!demoRecoveryLedger.isRecovering429()','demoRecoveryLedger.quote(92).stakeCents in setOf(100L,109L)','expectedStake429 in setOf(100L,109L)','reviewPackage == verifiedDemoAccountPackage','TouchTestService.priorDemoGestureCooldownComplete()'])assert.ok(guard.includes(x),x);
 assert.doesNotMatch(guard,/onVerifiedClosed|brokerConfirmedClosed|onVerifiedDemoClosed/);
});
test('607 never infers WIN LOSS MG from broker EMPTY OPEN',()=>{
 const a=monitor.split('if (explicitZero) {')[1].split('val unknownBaseEligible454 = ')[0];
 assert.match(a,/demoEmptyReviewReads >= 2/);
 assert.match(a,/tradePositionGate\.brokerVerifiedEmptyDemoReview\(true\)/);
 assert.match(monitor,/if \(unknownBaseCleared454\) \{\s+pendingReceipt429 = false\s+historyReviewRequestedAt610 = 0L/);
 assert.match(monitor,/val normalRearm581 = !pendingReceipt429 &&/);
 assert.match(monitor,/FĂRĂ MG RETROACTIV/);
 assert.match(service,/val readyForDemo = demoAutoStakePlan565\.isEnabled\(\)/);
 assert.match(service,/private const val CHART_ONLY_DEMO_462 = true/);
});
test('607 strict Demo and original outcome guards remain',()=>{
 assert.match(monitor,/reviewPackage != null && reviewPackage == verifiedDemoAccountPackage/);
 assert.match(service,/QT REAL DETECTAT • ROBOT OPRIT/);
 assert.match(service,/demoAutoStakePlan565\.onVerifiedClosed\(/);
});
test('607 signed Motorola build',()=>{
 assert.match(workflow,/versionCode'\]=611/);
 assert.match(workflow,/ScalpAtlas-611-OVERLAY-QT-DEMO-G24\.apk/);
 assert.match(workflow,/test_607_base109_safe_rearm\.mjs/);
});
