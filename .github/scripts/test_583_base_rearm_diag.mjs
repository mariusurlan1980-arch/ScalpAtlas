import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const service=readFileSync('.github/native-overlay/ScalpOverlayService.kt','utf8');
const plan=readFileSync('.github/native-overlay/DemoAutoStakePlan565.kt','utf8');
const workflow=readFileSync('.github/workflows/build-native-robot-safe-preflight-379.yml','utf8');

test('583 can attempt base-pair rebind only after independent current-pair 1.09 / 92 broker quote',()=>{
  assert.match(service,/readVisibleDemoPair\(\)!=pair/);
  assert.match(service,/readVerifiedDemoPayoutForPair\(pair\)!=92/);
  assert.match(service,/val baseQuote583=try \{\s*TouchTestService\.readBrokerDemoOrder476\(pair\)==\(109L to 92\)/);
  assert.match(service,/if\(baseQuote583 &&\s*demoAutoStakePlan565\.rebindVerifiedBasePair\(key,pair\)\)/);
  assert.match(plan,/prefs\.getInt\("losses",-1\) != 0/);
  assert.match(plan,/val pendingBase = prefs\.getLong\("pendingStake",-1L\) == 109L/);
  assert.match(plan,/val confirmedBase = prefs\.getLong\("pendingStake",-1L\) == 0L &&\s*prefs\.getLong\("confirmedStake",-1L\) == 109L/);
});

test('583 keeps existing recovery and order protections after rebind',()=>{
  assert.match(service,/rebindPendingRecoveryPair581\(key,pair\)/);
  assert.match(service,/!getSharedPreferences\(autoShockAttemptPrefs,Context\.MODE_PRIVATE\)/);
  assert.match(service,/tradePositionGate\.state\(\)!=TradePositionGate\.State\.READY/);
  assert.match(service,/demoAutoStakePlan565\.confirmEdited\(key,pair,amount,true\)/);
  assert.match(service,/demoAutoStakePlan565\.permitsFreshDemoOrder\(key,pair,amount\)/);
  assert.match(plan,/if\(!isEnabled\(\) \|\| isRiskStopped\(\)/);
});

test('583 preflight reasons diagnose but never grant permissions',()=>{
  const reason=plan.split('fun preflightReason583(')[1].split('fun permitsFreshDemoOrder(')[0];
  assert.match(reason,/PERECHE PLAN DIFERITĂ/);
  assert.match(reason,/MIZĂ ÎN AȘTEPTARE/);
  assert.match(reason,/SUMĂ BROKER DIFERITĂ/);
  assert.doesNotMatch(reason,/putBoolean|\.commit\(|rebindVerifiedBasePair|onVerifiedClosed/);
  assert.match(service,/BLOCAT: 583 •/);
});

test('583 pipeline builds APK with increased Android code',()=>{
  assert.match(workflow,/expo\['android'\]\['versionCode'\]=583/);
  assert.match(workflow,/ScalpAtlas-583-BASE-REARM-DEMO-G24\.apk/);
  assert.match(workflow,/test_583_base_rearm_diag\.mjs/);
});
