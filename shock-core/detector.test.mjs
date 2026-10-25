import test from "node:test";import assert from "node:assert/strict";import {ShockDetector} from "./detector.mjs";
const b={verified:true,market:"EUR/USD",timeframe:"M5",candleStart:300000,observedAt:300100,open:100,high:100,low:100,close:100};
test("BUY shock followed by recovery",()=>{const d=new ShockDetector();d.ingest(b);d.ingest({...b,observedAt:301100,low:98,close:98});const r=d.ingest({...b,observedAt:302100,low:98,close:99.5});assert.equal(r.state,"BUY");assert.equal(r.alert,true);});
test("SELL shock followed by retracement",()=>{const d=new ShockDetector();d.ingest(b);d.ingest({...b,observedAt:301100,high:102,close:102});const r=d.ingest({...b,observedAt:302100,high:102,close:100.5});assert.equal(r.state,"SELL");});
test("no duplicate alert on same candle",()=>{const d=new ShockDetector();d.ingest(b);d.ingest({...b,observedAt:301100,low:98,close:98});d.ingest({...b,observedAt:302100,low:98,close:99.5});assert.equal(d.ingest({...b,observedAt:303100,low:98,close:99.7}).alert,false);});
test("reject unverified frames",()=>{const d=new ShockDetector();assert.equal(d.ingest({...b,verified:false}).alert,false);});
test("reject inconsistent OHLC",()=>{const d=new ShockDetector();d.ingest(b);assert.equal(d.ingest({...b,observedAt:301100,low:101,close:101}).alert,false);});
