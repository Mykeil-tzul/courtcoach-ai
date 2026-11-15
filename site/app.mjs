import {buildPlan,parseTime,topics,validReview} from "./coach.mjs";

const $=id=>document.getElementById(id);
const form=$("profile-form");
let demo=false, plan=null, detectorPromise;
const completed=new Set();
const storeKey="courtcoach.practice.v1";

function node(tag,value,cls) {
  const element=document.createElement(tag);
  if (value!==undefined) element.textContent=value;
  if (cls) element.className=cls;
  return element;
}

function clipTime(t) {
  return Math.floor(t/60)+":"+String(Math.floor(t%60)).padStart(2,"0");
}

function options(select) {
  for (const [key,value] of Object.entries(topics)) select.add(new Option(value.name,key));
}

options($("goal"));
const clips=Array.from({length:3},(_,i)=>{
  const template=$("clip-template").content.cloneNode(true);
  const element=template.querySelector("article");
  const get=selector=>element.querySelector(selector);
  const fields=Object.fromEntries(["file","who","time","skill","note","kind","confirmed","mark","pose","pose-status","pose-options","empty","cue"].map(key=>[key,get("."+key)]));
  const item={i,element,fields,video:get("video"),canvas:get("canvas"),url:null,ready:false,loading:false};
  get(".clip-title").textContent="Clip "+(i+1);
  options(fields.skill);
  fields.cue.textContent=topics[fields.skill.value].cue;
  fields.file.addEventListener("change",()=>loadClip(item));
  fields.mark.addEventListener("click",()=>{
    fields.time.value=item.video.currentTime.toFixed(2);
    changed(item);
  });
  fields.pose.addEventListener("click",()=>inspectPose(item));
  for (const key of ["who","time","skill","note","kind","confirmed"]) fields[key].addEventListener("input",()=>{
    if (key==="skill") fields.cue.textContent=topics[fields.skill.value].cue;
    if (key==="confirmed") updateCount();
    else changed(item);
  });
  item.video.addEventListener("seeked",()=>clearPose(item));
  $("clip-grid").append(element);
  return item;
});

function clearPose(item) {
  item.canvas.hidden=true;
  item.fields["pose-options"].replaceChildren();
}

function unload(item) {
  item.ready=false;
  item.video.pause();
  item.video.removeAttribute("src");
  item.video.load();
  if (item.url) URL.revokeObjectURL(item.url);
  item.url=null;
  item.video.hidden=true;
  item.fields.empty.hidden=false;
  item.fields.mark.disabled=item.fields.pose.disabled=true;
  item.fields["pose-status"].textContent="";
  clearPose(item);
}

function loadClip(item) {
  if (demo) {
    demo=false;
    for (const clip of clips) {
      for (const key of ["who","time","note"]) clip.fields[key].value="";
      clip.fields.confirmed.checked=false;
      clip.fields.empty.textContent="Choose a basketball clip to start.";
    }
    $("demo-status").hidden=true;
  }
  unload(item);
  for (const key of ["who","time","note"]) item.fields[key].value="";
  changed(item);
  const file=item.fields.file.files[0];
  if (!file) return;
  if (file.size>120*1024*1024) {
    item.fields["pose-status"].textContent="Choose a file under 120 MB.";
    return;
  }
  item.url=URL.createObjectURL(file);
  item.video.onloadeddata=()=>{
    item.ready=Number.isFinite(item.video.duration) && item.video.duration>=1 && item.video.duration<=60;
    item.fields.mark.disabled=item.fields.pose.disabled=!item.ready;
    item.fields["pose-status"].textContent=item.ready ? "Clip ready." : "Use a clip between 1 and 60 seconds.";
    changed(item);
  };
  item.video.onerror=()=>{
    if (!item.url) return;
    item.ready=false;
    item.fields.mark.disabled=item.fields.pose.disabled=true;
    item.fields["pose-status"].textContent="This clip could not play. Try an H.264 MP4.";
    changed(item);
  };
  item.video.src=item.url;
  item.video.hidden=false;
  item.fields.empty.hidden=true;
}

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise=import("./pose.mjs").then(async module=>({detector:await module.openPose(),links:module.links}))
      .catch(error=>{detectorPromise=null;throw error;});
  }
  return detectorPromise;
}
const visible=p=>p && (p.visibility ?? 0)>=0.55;

function drawPose(item,poses,links,active=-1) {
  const {canvas,video}=item;
  canvas.width=Math.min(video.videoWidth,900);
  canvas.height=Math.max(1,Math.round(video.videoHeight/video.videoWidth*canvas.width));
  const context=canvas.getContext("2d");
  context.drawImage(video,0,0,canvas.width,canvas.height);
  poses.forEach((pose,i)=>{
    context.strokeStyle=context.fillStyle=i===active ? "#a8f8a1" : "#ffad67";
    context.lineWidth=2;
    for (const {start,end} of links) {
      const a=pose[start],b=pose[end];
      if (!visible(a) || !visible(b)) continue;
      context.beginPath();
      context.moveTo(a.x*canvas.width,a.y*canvas.height);
      context.lineTo(b.x*canvas.width,b.y*canvas.height);
      context.stroke();
    }
    const center=pose.find((p,n)=>[11,12,23,24].includes(n) && visible(p));
    if (center) {
      context.font="bold 17px system-ui";
      context.fillText(String(i+1),center.x*canvas.width,center.y*canvas.height);
    }
  });
  canvas.hidden=false;
}

async function inspectPose(item) {
  if (!item.ready || item.loading) return;
  const current=item.url;
  item.video.pause();
  item.loading=true;
  item.fields.pose.disabled=true;
  item.fields["pose-status"].textContent="Loading pose landmarks…";
  try {
    const {detector,links}=await getDetector();
    if (item.url!==current) return;
    const poses=detector.detect(item.video).landmarks.filter(pose=>[11,12,23,24].some(n=>visible(pose[n])));
    clearPose(item);
    if (!poses.length) {
      item.fields["pose-status"].textContent="No clear pose in this frame. Try a closer, unobstructed moment.";
      return;
    }
    drawPose(item,poses,links);
    item.fields["pose-status"].textContent=poses.length+" pose"+(poses.length===1 ? "" : "s")+" detected in this frame. Select your marker.";
    const time=item.video.currentTime;
    const choices=poses.map((_,i)=>{
      const button=node("button","Player "+(i+1),"secondary");
      button.type="button";
      button.setAttribute("aria-pressed","false");
      button.onclick=()=>{
        if (Math.abs(time-item.video.currentTime)>0.01) return;
        for (const item of choices) item.setAttribute("aria-pressed",String(item===button));
        drawPose(item,poses,links,i);
        const marker="Player "+(i+1)+" in AI frame";
        const previous=item.fields.who.value.trim().replace(/^Player \d+ in AI frame(?: · )?/,"");
        item.fields.who.value=(marker+(previous ? " · "+previous : "")).slice(0,90);
        item.fields.time.value=time.toFixed(2);
        changed(item);
      };
      return button;
    });
    item.fields["pose-options"].replaceChildren(...choices);
  } catch {
    if (item.url===current) item.fields["pose-status"].textContent="Pose model unavailable. You can still identify yourself and confirm the observation manually.";
  } finally {
    item.loading=false;
    item.fields.pose.disabled=!item.ready;
  }
}

function review(item) {
  const f=item.fields,time=parseTime(f.time.value);
  return {clip:item.i+1,player:f.who.value,time,skill:f.skill.value,note:f.note.value,kind:f.kind.value,
    confirmed:f.confirmed.checked && (demo || (item.ready && time<item.video.duration))};
}

function updateCount() {
  const count=clips.filter(item=>validReview(review(item))).length;
  $("review-count").textContent=count+" / 3 confirmed";
  if (plan) resetPlan("Film observations changed. Generate a new plan to use your edits.");
}

function changed(item) {
  item.fields.confirmed.checked=false;
  updateCount();
}

function resetPlan(message) {
  plan=null;
  completed.clear();
  $("report").replaceChildren();
  $("days").replaceChildren();
  $("export").disabled=true;
  $("plan-intro").textContent=message;
  $("plan-status").textContent="";
}

form.addEventListener("input",()=>{
  if (plan) resetPlan("Profile changed. Generate a new plan to use your edits.");
});

function jumpToReview(item) {
  item.element.scrollIntoView({block:"center"});
  if (item.ready) {
    item.video.pause();
    item.video.currentTime=review(item).time;
  } else item.fields.note.focus({preventScroll:true});
}

function drawPlan() {
  const {profile,reviews,priority,support,days}=plan;
  $("plan-intro").textContent=profile.player+" · "+profile.role+" · "+profile.level+" · "+profile.minutes+" minutes per workout";
  const selected=topics[priority];
  const explanation=support.length ? "Confirmed in "+support.map(n=>"Clip "+n).join(", ")+". " : "Based on your selected goal. ";
  const headline=node("p","Weekly focus · "+selected.name+". "+explanation+selected.why,"priority");
  const evidence=node("div",undefined,"report-grid");
  for (const r of reviews) {
    const item=node("article",undefined,"evidence");
    const button=node("button",(demo ? "Review example " : "Replay clip ")+r.clip+" · "+clipTime(r.time),"secondary");
    button.onclick=()=>jumpToReview(clips[r.clip-1]);
    item.append(node("h3",(r.kind==="strength" ? "Strength · " : "Build · ")+topics[r.skill].name),
      node("p",r.player+" · "+r.note),node("p",topics[r.skill].why),button);
    evidence.append(item);
  }
  $("report").replaceChildren(headline,evidence);
  $("days").replaceChildren(...days.map((day,i)=>{
    const item=node("article",undefined,"day");
    const list=node("ul");
    for (const [label,desc] of day.tasks) list.append(node("li",label+" · "+desc));
    const check=node("input");
    check.type="checkbox";
    check.onchange=()=>{if(check.checked) completed.add(i); else completed.delete(i);};
    const label=node("label","Mark day "+(i+1)+" complete");
    label.prepend(check);
    item.append(node("p","DAY "+(i+1)+" · "+day.minutes+" MIN","eyebrow"),node("h3",day.title),node("p",day.drill),list,label);
    return item;
  }));
  $("export").disabled=false;
  $("video-search").href="https://www.youtube.com/results?search_query="+encodeURIComponent("basketball "+selected.name+" "+profile.role+" drills");
}

function generate() {
  if (!form.reportValidity()) return;
  const values=new FormData(form);
  const profile=Object.fromEntries(values);
  profile.player=profile.player.trim();
  profile.minutes=Number(profile.minutes);
  profile.equipment=values.getAll("equipment");
  try {
    if (!profile.player) throw Error("Enter a player name or nickname.");
    plan=buildPlan(profile,clips.map(review));
    completed.clear();
    drawPlan();
    $("plan-status").textContent="Plan built from three confirmed observations.";
    $("plan").scrollIntoView({block:"start"});
  } catch (error) {
    $("plan-status").textContent=error.message;
  }
}

$("generate").onclick=generate;
form.onsubmit=event=>{event.preventDefault();generate();};

const example=[
  ["handle","improve","No. 7, ball handler at the slot","I sped up before the defender shifted and lost control with my left hand.",5],
  ["reads","improve","No. 7, right wing","I looked at the rim first and missed the corner pass when the low defender stepped up.",8],
  ["shooting","strength","No. 7, left corner","I had my feet and hands ready before the pass arrived and got into my shot without an extra step.",12]
];

function loadDemo() {
  if (!demo && clips.some(c=>c.url || c.fields.note.value.trim()) && !confirm("Replace the clips and notes on this page with the sample review?")) return;
  demo=true;
  for (const [key,value] of Object.entries({player:"Jordan · sample player",role:"Guard",level:"Intermediate",style:"Playmaker",goal:"handle",minutes:30})) {
    form.elements.namedItem(key).value=value;
  }
  form.elements.namedItem("age").value="";
  form.elements.namedItem("height").value="";
  for (const check of form.querySelectorAll('[name="equipment"]')) check.checked=check.value!=="partner";
  clips.forEach((item,i)=>{
    unload(item);
    item.fields.file.value="";
    const [skill,kind,who,note,time]=example[i];
    for (const [key,value] of Object.entries({skill,kind,who,note,time})) item.fields[key].value=value;
    item.fields.cue.textContent=topics[skill].cue;
    item.fields.confirmed.checked=true;
    item.fields.empty.textContent="Illustrative film note · no video attached";
  });
  $("demo-status").hidden=false;
  $("demo-status").textContent="Sample review loaded. These fictional notes demonstrate the coaching workflow. Add your own clips to start a real review.";
  updateCount();
  generate();
}

$("demo").onclick=loadDemo;
$("demo-hero").onclick=loadDemo;
$("export").onclick=()=>{
  if (!plan) return;
  const {profile,priority,reviews,days}=plan;
  const text=["CourtCoach AI · "+profile.player,"Focus: "+topics[priority].name,"",
    ...reviews.map(r=>"Clip "+r.clip+" at "+clipTime(r.time)+" · "+r.player+" · "+r.note),"",
    ...days.flatMap((d,i)=>["Day "+(i+1)+": "+d.title+" ("+d.minutes+" min)"+(completed.has(i)?" · completed":""),
      ...d.tasks.map(task=>task.join(" · ")),""])
  ].join("\n");
  const url=URL.createObjectURL(new Blob([text],{type:"text/plain"}));
  const link=node("a");
  link.href=url;
  link.download="courtcoach-training-plan.txt";
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};

function readLog() {
  try {
    const data=JSON.parse(localStorage.getItem(storeKey)||"[]");
    return Array.isArray(data) ? data.filter(item=>item && typeof item.drill==="string" && typeof item.date==="string" && Number.isFinite(item.clean) && item.total>0) : [];
  } catch {return [];}
}
let log=readLog();
function renderLog() {
  const byDrill=new Map();
  const items=log.map(item=>{
    const key=item.drill.toLowerCase();
    const rate=Math.round(100*item.clean/item.total);
    const previous=byDrill.get(key);
    byDrill.set(key,rate);
    const change=previous===undefined ? "" : " · "+(rate>=previous ? "+" : "−")+Math.abs(rate-previous)+" pp vs. last";
    return node("li",item.date+" · "+item.drill+" · "+item.clean+"/"+item.total+" ("+rate+"%)"+change);
  }).reverse();
  $("log-list").replaceChildren(...items);
  $("clear-log").disabled=!log.length;
}
$("log-form").onsubmit=event=>{
  event.preventDefault();
  const data=new FormData(event.target);
  const drill=data.get("drill").trim(),clean=Number(data.get("clean")),total=Number(data.get("total"));
  if (!drill || clean>total) {
    $("log-status").textContent="Enter a drill and a clean count no greater than total attempts.";
    return;
  }
  const next=[...log,{drill,clean,total,date:new Date().toLocaleDateString()}].slice(-100);
  try {
    localStorage.setItem(storeKey,JSON.stringify(next));
    log=next;
    renderLog();
    $("log-status").textContent="Result saved on this device.";
    event.target.reset();
  } catch {$("log-status").textContent="This browser blocked local storage.";}
};
$("clear-log").onclick=()=>{
  if (!confirm("Clear the practice log on this browser?")) return;
  try {localStorage.removeItem(storeKey);log=[];renderLog();$("log-status").textContent="Log cleared.";}
  catch {$("log-status").textContent="Unable to clear local storage.";}
};
$("resource-form").onsubmit=event=>{
  event.preventDefault();
  const place=new FormData(event.target).get("place").trim();
  if (!place) return;
  $("resource-links").replaceChildren(...["Basketball courts","Basketball gyms","Basketball trainers"].map(label=>{
    const anchor=node("a",label+" ↗","button secondary");
    anchor.href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(label+" near "+place);
    anchor.target="_blank";
    anchor.rel="noopener noreferrer";
    return anchor;
  }));
};
renderLog();
