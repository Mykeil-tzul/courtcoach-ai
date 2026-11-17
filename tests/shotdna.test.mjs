import test from "node:test";
import assert from "node:assert/strict";
import {angle,measurePose,summary,validSession,compareSessions,exampleSession} from "../site/shotdna-core.mjs";
test("image-plane angle respects aspect ratio and rejects zero-length segments",()=>{
  assert.equal(angle({x:0,y:1},{x:0,y:0},{x:1,y:0},1920,1080),90);
  const result=angle({x:1,y:0},{x:0,y:0},{x:1,y:1},200,100);
  assert.ok(Math.abs(result-26.565)<.001);
  assert.equal(angle({x:0,y:0},{x:0,y:0},{x:1,y:1},200,100),null);
});
test("hidden, cropped or missing joints cannot produce confident measurements",()=>{
  const pose=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));
  Object.assign(pose[12],{x:.2,y:.4}); Object.assign(pose[14],{x:.4,y:.4}); Object.assign(pose[16],{x:.4,y:.2});
  assert.equal(measurePose(pose,"right",400,400).elbow,90);
  pose[16].visibility=.2;
  assert.equal(measurePose(pose,"right",400,400),null);
  pose[16].visibility=1; pose[16].x=1.1;
  assert.equal(measurePose(pose,"right",400,400),null);
  assert.equal(measurePose(pose,"middle",400,400),null);
  assert.equal(measurePose(pose,"right",0,400),null);
});
test("session validation excludes reversed, unavailable and nonfinite measurements",()=>{
  assert.ok(validSession(exampleSession));
  assert.equal(validSession({...exampleSession,date:"2026-02-30"}),false);
  const longer=structuredClone(exampleSession);
  longer.shots[0].gather.time=61; longer.shots[0].release.time=61.5;
  assert.ok(validSession(longer));
  longer.shots[0].release.time=121;
  assert.equal(validSession(longer),false);
  const bad=structuredClone(exampleSession); bad.shots[0].release.time=0;
  assert.equal(validSession(bad),false);
  bad.shots[0].release.time=1; bad.shots[0].gather.knee=null;
  assert.equal(validSession(bad),false);
  bad.shots[0].gather.knee=90; bad.shots[0].release.elbow=NaN;
  assert.equal(validSession(bad),false);
  assert.equal(validSession({...exampleSession,shots:[]}),false);
});
test("summaries use marked gather-to-release time and exclude incompatible setups",()=>{
  const before=structuredClone(exampleSession);
  const after=structuredClone(exampleSession);
  after.shots.forEach(s=>{s.release.elbow+=5;s.release.time+=.1});
  const changes=compareSessions(before,after);
  assert.equal(changes.elbow.meanChange,5);
  assert.ok(Math.abs(changes.lift.meanChange-.1)<1e-10);
  after.side="left"; assert.equal(compareSessions(before,after),null);
  after.side="right"; after.setup="Front camera"; assert.equal(compareSessions(before,after),null);
  assert.equal(summary([]).elbow.mean,null);
  assert.equal(summary([before.shots[0]]).elbow.sd,0);
});
