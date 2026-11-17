export const maxClipSeconds = 120;
export const metricNames = {
  elbow:"Elbow angle at release", knee:"Knee angle at gather", lift:"Gather to release"
};
export function angle(a,b,c,width,height) {
  if (![a,b,c].every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))) return null;
  const u = [(a.x-b.x)*width,(a.y-b.y)*height];
  const v = [(c.x-b.x)*width,(c.y-b.y)*height];
  const denominator = Math.hypot(...u)*Math.hypot(...v);
  if (!Number.isFinite(denominator) || denominator <= 1e-6) return null;
  return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/denominator)))*180/Math.PI;
}
export function measurePose(landmarks, side, width, height) {
  const indices = side === "left" ? [11,13,15,23,25,27] : [12,14,16,24,26,28];
  if (!["left","right"].includes(side) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const points = indices.map(index => landmarks?.[index]);
  const valid = group => group.every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1 &&
    Number.isFinite(point.visibility) && point.visibility >= .65);
  const elbow = valid(points.slice(0,3)) ? angle(...points.slice(0,3),width,height) : null;
  const knee = valid(points.slice(3),width,height) ? angle(...points.slice(3),width,height) : null;
  if (elbow === null && knee === null) return null;
  return {elbow, knee, side};
}
export function summary(shots) {
  return Object.fromEntries(Object.keys(metricNames).map(key => {
    const values = shots.map(shot => key === "lift" ? shot.release.time - shot.gather.time : key === "knee" ? shot.gather.knee : shot.release.elbow);
    const mean = values.reduce((a,b)=>a+b,0)/values.length;
    const sd = Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0)/values.length);
    return [key,{mean: values.length ? mean : null, sd: values.length ? sd : null, count:values.length}];
  }));
}
function validMark(mark) {
  return mark && Number.isFinite(mark.time) && mark.time >= 0 && mark.time <= maxClipSeconds &&
    ["elbow","knee"].every(key => mark[key] === null || Number.isFinite(mark[key]) && mark[key] >= 0 && mark[key] <= 180);
}
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date=new Date(value+"T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value;
}
export function validSession(session) {
  return session && typeof session.id === "string" && session.id.length <= 100 &&
    typeof session.setup === "string" && session.setup.trim().length > 0 && session.setup.length <= 120 &&
    validDate(session.date) &&
    ["left","right"].includes(session.side) && Array.isArray(session.shots) &&
    session.shots.length >= 1 && session.shots.length <= 100 &&
    session.shots.every(shot => validMark(shot.gather) && validMark(shot.release) &&
      shot.release.time > shot.gather.time && shot.release.time - shot.gather.time <= 5 &&
      Number.isFinite(shot.gather.knee) && Number.isFinite(shot.release.elbow) &&
      ["made","missed","unrecorded"].includes(shot.outcome));
}
export function compatible(a,b) { return a.side === b.side && a.setup.trim().toLowerCase() === b.setup.trim().toLowerCase(); }
export function compareSessions(baseline,current) {
  if (!validSession(baseline) || !validSession(current) || !compatible(baseline,current)) return null;
  const base = summary(baseline.shots); const next = summary(current.shots);
  return Object.fromEntries(Object.keys(metricNames).map(key => [key, {
    meanChange:next[key].mean-base[key].mean, spreadChange:next[key].sd-base[key].sd
  }]));
}
export const exampleSession = {
  id:"synthetic-example", setup:"Example only · side-on tripod", date:"2026-01-01", side:"right",
  shots:Array.from({length:6},(_,i)=>({
    gather:{time:0,elbow:78,knee:[111,115,113,120,114,112][i]},
    release:{time:[.48,.52,.50,.62,.51,.49][i],elbow:[153,158,155,146,156,154][i],knee:163},
    outcome:"unrecorded"
  }))
};
