import test from "node:test";
import assert from "node:assert/strict";
import {buildPlan,parseTime,validReview} from "../site/coach.mjs";

const profile={player:"Sample",role:"Wing",level:"Intermediate",style:"Shooter",goal:"shooting",minutes:25,equipment:[]};
const reviews=[1,2,3].map((clip,i)=>({clip,player:"No. 4",time:i+1,skill:i===2?"shooting":"defense",
  kind:i===2?"strength":"improve",note:"Confirmed observation.",confirmed:true}));

test("requires three distinct, confirmed, timestamped observations",()=>{
  assert.throws(()=>buildPlan(profile,reviews.slice(0,2)),/three clips/);
  assert.throws(()=>buildPlan(profile,[...reviews.slice(0,2),reviews[1]]),/three clips/);
  assert.equal(validReview({...reviews[0],confirmed:false}),false);
  assert.equal(validReview({...reviews[0],time:NaN}),false);
});
test("links the plan to evidence and stays within the time budget",()=>{
  const plan=buildPlan(profile,reviews);
  assert.equal(plan.priority,"defense");
  assert.deepEqual(plan.support,[1,2]);
  assert.equal(plan.days.length,7);
  assert.ok(plan.days.every(day=>day.minutes<=25));
  assert.deepEqual(plan.days.filter(d=>d.skill==="shooting").map(d=>d.drill),["Shot preparation shadow reps","Shot preparation shadow reps"]);
});
test("adapts exercises to actual equipment",()=>{
  const plan=buildPlan({...profile,equipment:["ball","hoop"]},reviews);
  assert.equal(plan.days[1].drill,"Catch-ready shooting");
  assert.equal(plan.days[2].skill,null);
});
test("parses seconds and valid minute offsets",()=>{
  assert.equal(parseTime("1:08.5"),68.5);
  assert.equal(parseTime("0.5"),0.5);
  assert.ok(Number.isNaN(parseTime("0:68")));
});
