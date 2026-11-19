import {measurePose, summary, validSession, compareSessions, exampleSession, metricNames, maxClipSeconds} from "./shotdna-core.mjs";
import {practiceClips} from "./shotdna-clips.mjs";
const $ = selector => document.querySelector(selector);
const video = $("#shot-video");
const canvas = $("#shot-canvas");
const context = canvas.getContext("2d");
const key = "courtcoach-shotdna-v1";
let model;
let connections = [];
let poses = [];
let selected = 0;
let poseTime = null;
let gather = null;
let release = null;
let shots = [];
let sessions = [];
let objectUrl;
let generation = 0;
let example = false;
let busy = false;
let analyzedFrame = null;
let sessionSaved = false;
$("#session-date").value = new Date().toLocaleDateString("en-CA");
try {
  const saved = JSON.parse(localStorage.getItem(key) ?? "[]");
  if (!Array.isArray(saved) || saved.length > 100 || !saved.every(validSession) || new Set(saved.map(s=>s.id)).size !== saved.length) throw Error();
  sessions = saved;
} catch { $("#journal-status").textContent = "Saved measurements could not load. Import an exported journal to restore your sessions."; }

function persist() {
  try { localStorage.setItem(key,JSON.stringify(sessions)); return true; }
  catch { $("#journal-status").textContent = "Browser storage is unavailable. Download the journal before closing this tab."; return false; }
}
function currentMeasurement() {
  if (poseTime === null || Math.abs(video.currentTime-poseTime) > .025 || !video.paused) return null;
  return measurePose(poses[selected],$("#hand").value,canvas.width,canvas.height);
}
function updateMarkButtons() {
  const measured = currentMeasurement();
  $("#mark-gather").disabled = busy || !Number.isFinite(measured?.knee);
  $("#mark-release").disabled = busy || !Number.isFinite(measured?.elbow);
}
function clearFrame() {
  poses=[]; poseTime=null; analyzedFrame=null;
  $("#people").replaceChildren(); $("#measurements").textContent=""; canvas.hidden=true;
  updateMarkButtons();
}
function resetMarks() {
  gather=release=null;
  $("#gather-mark").textContent="Choose the lowest gather frame.";
  $("#release-mark").textContent="Choose the frame where the ball leaves the hand.";
  $("#add-shot").disabled=true;
}
function drawPose() {
  context.clearRect(0,0,canvas.width,canvas.height);
  if (analyzedFrame) context.drawImage(analyzedFrame,0,0);
  const points=poses[selected];
  context.lineWidth=Math.max(2,canvas.width/220);
  context.strokeStyle="#a6e4de"; context.fillStyle="#ff9c58";
  for (const {start,end} of connections) {
    const a=points?.[start], b=points?.[end];
    if (!a || !b || a.visibility<.65 || b.visibility<.65) continue;
    context.beginPath(); context.moveTo(a.x*canvas.width,a.y*canvas.height); context.lineTo(b.x*canvas.width,b.y*canvas.height); context.stroke();
  }
  for (const p of points ?? []) {
    if (p.visibility<.65) continue;
    context.beginPath(); context.arc(p.x*canvas.width,p.y*canvas.height,Math.max(3,canvas.width/150),0,2*Math.PI); context.fill();
  }
  canvas.hidden=false;
  const measured=currentMeasurement();
  const value = number => Number.isFinite(number) ? number.toFixed(1)+"°" : "not visible enough";
  $("#measurements").textContent="Selected player "+(selected+1)+" · Elbow "+value(measured?.elbow)+" · Knee "+value(measured?.knee);
  updateMarkButtons();
}
function setBusy(value) {
  busy=value;
  $("#detect").disabled=value || video.readyState<2;
  $("#shot-file").disabled=value;
  document.querySelectorAll("[data-practice-clip]").forEach(button=>button.disabled=value);
  $("#frame-back").disabled=value || video.readyState<2;
  $("#frame-forward").disabled=value || video.readyState<2;
  $("#hand").disabled=value || shots.length>0;
  updateMarkButtons();
}
function loadClip(source,setupName="") {
  if (shots.length && !example && !sessionSaved && !confirm("Open a different video and discard the unsaved attempts? Save the session first if you want to keep them.")) return false;
  document.querySelectorAll("#practice-clips video").forEach(clip=>clip.pause());
  shots=[]; example=false; sessionSaved=false;
  $("#setup").readOnly=false;
  if(setupName) $("#setup").value=setupName;
  renderReport();
  generation++;
  video.pause();
  clearFrame(); resetMarks();
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl=null; }
  video.src=source; video.load();
  $("#pose-feedback").textContent="Loading clip…";
  setBusy(false);
  return true;
}
$("#shot-file").addEventListener("change", event => {
  const file=event.target.files[0]; event.target.value="";
  if (!file) return;
  if (file.size>120*1024*1024) { $("#pose-feedback").textContent="Choose a clip smaller than 120 MB."; return; }
  const url=URL.createObjectURL(file);
  if(loadClip(url)) objectUrl=url;
  else URL.revokeObjectURL(url);
});
for (const clip of practiceClips) {
  const card=document.createElement("article");
  card.className="practice-card";
  const preview=document.createElement("video");
  preview.controls=true; preview.muted=true; preview.playsInline=true; preview.preload="metadata";
  preview.src=clip.src; preview.poster=clip.poster;
  preview.setAttribute("aria-label",clip.title+" full practice recording");
  const title=document.createElement("h3"); title.textContent=clip.title;
  const detail=document.createElement("p"); detail.textContent=clip.detail;
  const button=document.createElement("button");
  button.type="button"; button.className="primary"; button.dataset.practiceClip=clip.id;
  button.textContent="Analyze this clip";
  button.setAttribute("aria-label","Analyze "+clip.title);
  button.addEventListener("click",()=>{
    if(loadClip(clip.src,clip.setup)) {
      video.poster=clip.poster;
      $("#shooting-lab").scrollIntoView({behavior:"smooth",block:"start"});
    }
  });
  const play=document.createElement("button");
  play.type="button"; play.className="secondary"; play.textContent="▶ Play video";
  play.setAttribute("aria-label","Play "+clip.title);
  const playbackStatus=document.createElement("p");
  playbackStatus.className="hint"; playbackStatus.setAttribute("role","status");
  const open=document.createElement("a");
  open.href=clip.src; open.target="_blank"; open.rel="noopener";
  open.textContent="Open video full screen ↗";
  open.className="practice-open";
  play.addEventListener("click",async()=>{
    if (!preview.paused) { preview.pause(); return; }
    playbackStatus.textContent="Loading video…";
    try {
      await preview.play();
      playbackStatus.textContent="";
    } catch {
      playbackStatus.textContent="Tap the video’s play control, or use Open video full screen.";
    }
  });
  preview.addEventListener("playing",()=>{
    play.textContent="Ⅱ Pause video";
    play.setAttribute("aria-label","Pause "+clip.title);
    playbackStatus.textContent="";
  });
  preview.addEventListener("pause",()=>{
    play.textContent="▶ Play video"; play.setAttribute("aria-label","Play "+clip.title);
  });
  preview.addEventListener("ended",()=>{
    play.textContent="↻ Replay video"; play.setAttribute("aria-label","Replay "+clip.title);
  });
  preview.addEventListener("error",()=>{
    playbackStatus.textContent="This preview could not load. Try Open video full screen.";
  });
  preview.addEventListener("play",()=>{
    document.querySelectorAll("#practice-clips video").forEach(other=>{if(other!==preview) other.pause()});
    video.pause();
  });
  const actions=document.createElement("div");
  actions.className="actions"; actions.append(play,button);
  card.append(preview,title,detail,actions,playbackStatus,open);
  $("#practice-clips").append(card);
}
video.addEventListener("loadedmetadata", () => {
  if (!Number.isFinite(video.duration) || video.duration<1 || video.duration>maxClipSeconds) {
    video.removeAttribute("src"); video.load(); setBusy(false);
    $("#pose-feedback").textContent="Trim your clip to between 1 and 120 seconds, then choose it again."; return;
  }
  $("#pose-feedback").textContent="Pause at the gather, analyze the frame, then choose your player.";
});
video.addEventListener("loadeddata", () => setBusy(false));
video.addEventListener("error", () => {
  setBusy(false);
  $("#pose-feedback").textContent="This video could not be decoded. Try an H.264 MP4 or another browser.";
});
video.addEventListener("seeking",clearFrame);
video.addEventListener("play",clearFrame);
for (const [id,amount] of [["#frame-back",-.05],["#frame-forward",.05]]) {
  $(id).addEventListener("click", () => { video.pause(); video.currentTime=Math.max(0,Math.min(video.duration-.01,video.currentTime+amount)); });
}
$("#hand").addEventListener("change", () => { resetMarks(); if (poses.length) drawPose(); });
$("#detect").addEventListener("click", async () => {
  if (busy || video.readyState<2) return;
  video.pause(); clearFrame();
  const token=generation;
  const time=video.currentTime;
  const frame=document.createElement("canvas");
  const scale=Math.min(1,960/video.videoWidth);
  frame.width=Math.round(video.videoWidth*scale); frame.height=Math.round(video.videoHeight*scale);
  frame.getContext("2d").drawImage(video,0,0,frame.width,frame.height);
  setBusy(true);
  $("#pose-feedback").textContent="Loading pose analysis. The first use downloads the model…";
  try {
    if (!model) {
      const module=await import("./pose.mjs");
      model=await module.openPose(); connections=module.links;
    }
    if (token!==generation || Math.abs(time-video.currentTime)>.025 || !video.paused) throw Error("The frame changed. Pause and analyze the frame again.");
    const result=model.detect(frame);
    poses=result.landmarks;
    if (!poses.length) throw Error("No clear body pose found. Try a closer, side-on frame with your whole body visible.");
    analyzedFrame=frame; poseTime=time; selected=0;
    canvas.width=frame.width; canvas.height=frame.height;
    $("#people").replaceChildren();
    poses.forEach((_,index) => {
      const button=document.createElement("button");
      button.type="button"; button.className="secondary"; button.textContent="Player "+(index+1);
      button.setAttribute("aria-pressed",String(index===0));
      button.addEventListener("click", () => {
        selected=index;
        $("#people").querySelectorAll("button").forEach((b,i)=>b.setAttribute("aria-pressed",String(i===index)));
        drawPose();
      });
      $("#people").append(button);
    });
    drawPose();
    $("#pose-feedback").textContent="Frame "+time.toFixed(2)+"s · "+poses.length+" pose(s). Check the highlighted body, choose your player, and mark the moment.";
  } catch(error) {
    $("#pose-feedback").textContent=error.message.includes("frame") || error.message.includes("pose") ? error.message : "Pose analysis could not load. Check your internet connection, then try Analyze paused frame again.";
  } finally { setBusy(false); }
});
for (const kind of ["gather","release"]) {
  $("#mark-"+kind).addEventListener("click", () => {
    const measured=currentMeasurement();
    if (!measured || !Number.isFinite(measured[kind==="gather" ? "knee" : "elbow"])) return;
    const mark={time:poseTime,elbow:measured.elbow,knee:measured.knee};
    if (kind==="gather") gather=mark; else release=mark;
    $("#"+kind+"-mark").textContent=poseTime.toFixed(2)+"s · "+(kind==="gather" ? "knee "+mark.knee.toFixed(1) : "elbow "+mark.elbow.toFixed(1))+"°";
    $("#add-shot").disabled=!gather || !release || release.time<=gather.time || release.time-gather.time>5;
    $("#shot-feedback").textContent=gather && release && $("#add-shot").disabled ? "Release must follow the gather by no more than 5 seconds. Check both frames." : "Confirm this is the same shooter in both frames.";
  });
}
$("#reset-marks").addEventListener("click",resetMarks);
$("#add-shot").addEventListener("click", () => {
  if (!gather || !release || $("#add-shot").disabled) return;
  if (shots.length>=100) { $("#shot-feedback").textContent="Save this session before starting another. Limit 100 attempts."; return; }
  if (!$("#setup").value.trim()) { $("#setup").reportValidity(); return; }
  if (example) { shots=[]; example=false; }
  shots.push({gather:{...gather},release:{...release},outcome:$("#outcome").value});
  sessionSaved=false;
  resetMarks(); renderReport(); $("#hand").disabled=true; $("#setup").readOnly=true;
  $("#shot-feedback").textContent="Shot added. Mark another attempt or save your session.";
});
const svgNS="http://www.w3.org/2000/svg";
function chart() {
  const svg=$("#shot-chart"); svg.replaceChildren(); svg.hidden=!shots.length;
  if (!shots.length) return;
  const text=(x,y,value) => {
    const node=document.createElementNS(svgNS,"text"); node.setAttribute("x",x); node.setAttribute("y",y); node.setAttribute("fill","#b7bdc9"); node.setAttribute("font-size",12); node.textContent=value; svg.append(node);
  };
  for (const angle of [0,90,180]) text(6,165-angle/180*135,angle+"°");
  const points=shots.map((shot,i)=>[55+i/Math.max(1,shots.length-1)*610,160-shot.release.elbow/180*135]);
  const line=document.createElementNS(svgNS,"polyline");
  line.setAttribute("points",points.map(point=>point.join(",")).join(" "));
  line.setAttribute("fill","none"); line.setAttribute("stroke","#a6e4de"); line.setAttribute("stroke-width",3); svg.append(line);
  points.forEach(([x,y],i)=>{
    const node=document.createElementNS(svgNS,"circle"); node.setAttribute("cx",x); node.setAttribute("cy",y); node.setAttribute("r",4); node.setAttribute("fill","#ff9c58"); svg.append(node);
    if (shots.length<=20) text(x-4,183,i+1);
  });
}
function renderReport() {
  const metrics=summary(shots);
  $("#metrics").replaceChildren(); $("#attempts").replaceChildren();
  for (const [key,label] of Object.entries(metricNames)) {
    const card=document.createElement("article"); card.className="evidence";
    const title=document.createElement("h3"); title.textContent=label;
    const value=document.createElement("strong");
    value.textContent=shots.length ? metrics[key].mean.toFixed(key==="lift"?2:1)+(key==="lift"?" s":"°") : "—";
    const spread=document.createElement("p");
    spread.textContent=shots.length>=3 ? "Spread (SD) "+metrics[key].sd.toFixed(key==="lift"?2:1)+(key==="lift"?" s":"°") : "Add at least 3 attempts to inspect consistency.";
    card.append(title,value,spread); $("#metrics").append(card);
  }
  shots.forEach((shot,i)=>{
    const tr=document.createElement("tr");
    for (const value of [i+1,shot.release.elbow.toFixed(1)+"°",shot.gather.knee.toFixed(1)+"°",(shot.release.time-shot.gather.time).toFixed(2)+"s",shot.outcome]) {
      const cell=tr.insertCell(); cell.textContent=value;
    }
    const button=document.createElement("button"); button.type="button"; button.className="secondary"; button.textContent="Remove";
    button.setAttribute("aria-label","Remove attempt "+(i+1));
    button.addEventListener("click",()=>{
      shots.splice(i,1); sessionSaved=false; if (!shots.length) { example=false; $("#setup").readOnly=false; $("#hand").disabled=false; }
      renderReport();
    });
    tr.insertCell().append(button); $("#attempts").append(tr);
  });
  $("#report-status").textContent=example ? "ILLUSTRATIVE EXAMPLE · Six synthetic attempts show how this report works. These are example numbers." :
    shots.length ? shots.length+" measured attempt(s). Outcomes are entered by you." : "Add measured attempts to build your shooting baseline.";
  $("#save-session").disabled=example || !shots.length || sessionSaved;
  $("#motion-note").textContent=shots.length>=3 ? "Use the spread to choose a repeatable checkpoint with your coach. Compare under the same camera and drill setup. More consistent angles alone do not establish a better shot." : "";
  chart();
}
$("#example").addEventListener("click",()=>{
  if (shots.length && !example && !confirm("Replace the current unsaved attempts with an illustrative example?")) return;
  example=true; shots=structuredClone(exampleSession.shots); sessionSaved=false;
  resetMarks(); $("#setup").readOnly=false; $("#hand").disabled=false;
  renderReport(); $("#report-panel").scrollIntoView({behavior:"smooth"});
});
$("#save-session").addEventListener("click",()=>{
  const session={id:crypto.randomUUID(),setup:$("#setup").value.trim(),date:$("#session-date").value,side:$("#hand").value,shots:structuredClone(shots)};
  if (example || !validSession(session) || sessions.length>=100) { $("#shot-feedback").textContent="Enter a date and setup name. The journal holds up to 100 sessions."; return; }
  sessions.push(session); const stored=persist(); sessionSaved=true;
  renderJournal(); $("#followup").value=session.id; renderComparison(); renderReport();
  $("#journal-status").textContent=stored ? "Session saved. Export your journal to keep a backup." : "Saved in this tab only. Download your journal before closing.";
  // Start another session explicitly, so saved measurements never change with later edits.
});
const newSession=document.createElement("button");
newSession.type="button"; newSession.className="secondary"; newSession.textContent="Start new session";
$("#save-session").after(newSession);
newSession.addEventListener("click",()=>{
  if (shots.length && !example && !sessionSaved && !confirm("Start a new session and discard unsaved attempts?")) return;
  shots=[]; example=false; sessionSaved=false; resetMarks(); renderReport();
  $("#setup").readOnly=false; $("#hand").disabled=false;
});
function renderComparison() {
  const a=sessions.find(s=>s.id===$("#baseline").value), b=sessions.find(s=>s.id===$("#followup").value);
  if (!a || !b || a.id===b.id) { $("#comparison").textContent="Save two sessions to compare the same drill and camera setup."; return; }
  if (b.date<a.date) { $("#comparison").textContent="Choose a follow-up on or after the baseline date."; return; }
  const comparison=compareSessions(a,b);
  if (!comparison) { $("#comparison").textContent="Choose sessions with the same setup name and shooting hand."; return; }
  const signed=(n,digits)=>(n>0?"+":"")+n.toFixed(digits);
  $("#comparison").textContent=Object.entries(comparison).map(([key,result])=>metricNames[key]+": average change "+signed(result.meanChange,key==="lift"?2:1)+(key==="lift"?"s":"°")+
    (a.shots.length>=3 && b.shots.length>=3 ? ", spread change "+signed(result.spreadChange,key==="lift"?2:1)+(key==="lift"?"s":"°") : ", at least 3 attempts in each session needed for consistency comparison")).join(". ");
}
function renderJournal() {
  const oldA=$("#baseline").value, oldB=$("#followup").value;
  $("#sessions").replaceChildren(); $("#baseline").replaceChildren(); $("#followup").replaceChildren();
  const ordered=[...sessions].sort((a,b)=>a.date.localeCompare(b.date));
  for (const session of ordered) {
    const label=session.date+" · "+session.setup+" · "+session.shots.length+" shots · "+session.side;
    for (const select of [$("#baseline"),$("#followup")]) select.add(new Option(label,session.id));
    const li=document.createElement("li"); const name=document.createElement("span"); name.textContent=label+" ";
    const remove=document.createElement("button"); remove.type="button"; remove.className="secondary"; remove.textContent="Delete";
    remove.addEventListener("click",()=>{
      if (!confirm("Delete this session? Export first if you want a backup.")) return;
      sessions=sessions.filter(s=>s.id!==session.id); persist(); renderJournal();
    });
    li.append(name,remove); $("#sessions").append(li);
  }
  if (ordered.some(s=>s.id===oldA)) $("#baseline").value=oldA;
  $("#followup").value=ordered.some(s=>s.id===oldB) ? oldB : ordered.at(-1)?.id ?? "";
  renderComparison();
}
$("#baseline").addEventListener("change",renderComparison); $("#followup").addEventListener("change",renderComparison);
$("#export-shots").addEventListener("click",()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,sessions},null,2)],{type:"application/json"}));
  const a=document.createElement("a"); a.href=url; a.download="shotdna-journal.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("#import-shots").addEventListener("change",async event=>{
  const file=event.target.files[0]; event.target.value=""; if (!file) return;
  try {
    if (file.size>5_000_000) throw Error();
    const data=JSON.parse(await file.text());
    if (data.version!==1 || !Array.isArray(data.sessions) || !data.sessions.every(validSession) || data.sessions.length>100 ||
      new Set(data.sessions.map(s=>s.id)).size!==data.sessions.length) throw Error();
    if (!confirm("Replace this browser’s shooting journal with this backup?")) return;
    sessions=data.sessions; const stored=persist(); renderJournal();
    if (stored) $("#journal-status").textContent="Journal imported.";
  } catch { $("#journal-status").textContent="Could not import that file. Choose a journal exported from ShotDNA."; }
});
window.addEventListener("pagehide",()=>{ model?.close(); if (objectUrl) URL.revokeObjectURL(objectUrl); });
renderReport(); renderJournal();
