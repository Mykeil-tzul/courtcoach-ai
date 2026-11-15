export const topics = {
  shooting: {name:"Shooting", cue:"Were your feet and hands ready before the catch?", why:"Getting set early gives you time to shoot or attack the closeout.",
    drills:[
      ["Catch-ready shooting", "ball,hoop", "Start one step outside your spot. Step in on a self-toss or partner pass, then shoot. Count makes and catches with your feet set."],
      ["Shot preparation shadow reps", "none", "Start one step away from a floor mark. Step into an athletic stance with your hands ready and freeze. Count balanced stops out of ten."]],
  },
  handle: {name:"Ball handling", cue:"When you changed pace, did you keep your eyes up and protect the ball?", why:"A change of pace creates separation while a protected dribble leaves you options.",
    drills:[
      ["Change-of-pace attack", "ball", "Set two floor marks. Walk into the first, then accelerate past the second using one protected dribble pattern. Alternate hands and count clean trips."],
      ["Pace and footwork", "none", "Walk, pause, then burst for two steps around a floor mark. Alternate directions and record controlled stops."]],
  },
  finishing: {name:"Finishing", cue:"Did the defender's position influence your takeoff or finishing hand?", why:"Choosing a takeoff and release around the defender can create a clearer path to the rim.",
    drills:[
      ["Inside-hand finishes", "ball,hoop", "Start at the wing, take two dribbles, and finish with your inside hand. Switch sides and count makes out of ten."],
      ["Two-step finish footwork", "none", "Mark a takeoff spot and rehearse both left- and right-side two-step sequences. Keep the last step controlled and count clean sequences."]],
  },
  defense: {name:"Defense", cue:"Did you arrive balanced enough to contest and contain the next drive?", why:"A controlled closeout keeps you in position to contest and respond to a drive.",
    drills:[
      ["Closeout and contain", "none", "Set a start and closeout mark. Approach with quick steps, shorten the last steps, then slide left or right. Record balanced stops out of ten."]],
  },
  spacing: {name:"Positioning", cue:"Where were you relative to the ball, the driving lane, and the nearest defender?", why:"Useful spacing gives the ball handler a wider driving lane and a clear passing target.",
    drills:[
      ["Drive-and-relocate walk-through", "none", "Mark the wing and corner. Imagine the ball being driven from the wing and move into the next open passing window. Alternate strong and weak sides."]],
  },
  reads: {name:"Decision-making", cue:"Before the catch, what did you see the defender or help defender do?", why:"Scanning before the catch gives you more time to choose a shot, drive, or pass.",
    drills:[
      ["Read the closeout", "partner", "Have a partner call short closeout or hard closeout as you move into a catch position. Respond with your shooting stance or first driving step."],
      ["Scan, call, react", "none", "Shuffle a short list of shot, drive and pass cues. Say the cue before stepping into a catch position and rehearse the matching decision."]],
  }
};

const roleSkill = {Guard:"handle",Wing:"shooting",Big:"finishing"};
const roleContext = {
  Guard:"Start each rep from the top or slot, where a guard often initiates.",
  Wing:"Start from the wing or corner, then work both sides.",
  Big:"Start near the elbow or short corner and rehearse both directions."
};
const styleCue = {
  "Slasher":"Use a deliberate change of pace before the first attacking step.",
  "Shooter":"Prepare your feet and hands before moving into your spot.",
  "Playmaker":"Call out your first read before starting the repetition.",
  "Two-way":"Finish each repetition in a balanced position, ready for the next action."
};

export function validReview(review) {
  return Object.hasOwn(topics,review.skill) &&
    ["strength","improve"].includes(review.kind) && Number.isFinite(review.time) && review.time >= 0 &&
    !!review.player?.trim() && !!review.note?.trim() && review.confirmed === true;
}

export function buildPlan(profile,reviews) {
  const usable=reviews.filter(validReview);
  if (usable.length!==3 || new Set(usable.map(r=>r.clip)).size!==3) throw Error("Confirm one observation for each of the three clips.");
  const goals=Object.keys(topics);
  if (!goals.includes(profile.goal) || !Object.hasOwn(roleSkill,profile.role) ||
      !Object.hasOwn(styleCue,profile.style) || !["Beginner","Intermediate","Advanced"].includes(profile.level) ||
      !Number.isInteger(profile.minutes) || profile.minutes<15 || profile.minutes>90) throw Error("Complete the player profile first.");
  const scores=new Map(goals.map(skill=>[skill,Number(skill===profile.goal)*2]));
  for (const item of usable) if (item.kind==="improve") scores.set(item.skill,scores.get(item.skill)+3);
  const priority=[...scores].sort((a,b)=>b[1]-a[1])[0][0];
  const alternate=[profile.goal,roleSkill[profile.role],...usable.map(r=>r.skill),...goals].find(skill=>skill!==priority);
  const support=usable.filter(r=>r.skill===priority && r.kind==="improve").map(r=>r.clip);
  const equipment=new Set(profile.equipment);
  if (!equipment.has("ball")) equipment.delete("hoop");
  const drillFor=skill=>topics[skill].drills.find(item=>item[1]==="none" || item[1].split(",").every(x=>equipment.has(x)));
  const reps=profile.level==="Beginner" ? "Start with six controlled attempts per side." :
    profile.level==="Advanced" ? "After the first set, change the starting angle or cue." : "Switch sides after each set of eight attempts.";
  const focus=["Build the pattern","Apply the read","Review film","Add a constraint","Revisit a strength","Retest the focus","Review the week"];
  const strength=usable.find(r=>r.kind==="strength")?.skill ?? alternate;
  const skills=[priority,alternate,null,priority,strength,priority,null];
  const days=focus.map((title,i)=>{
    if (!skills[i]) return {title,minutes:Math.min(profile.minutes,15),skill:null,drill:"Film and journal",
      tasks:[["Review", "Replay the confirmed clip moments and write down one cue you want to carry into the next session."],
        ["Log",i===6 ? "Compare the first and final attempts and note what felt repeatable." : "Choose one moment to re-create during your next workout."]]};
    const [drill,,description]=drillFor(skills[i]);
    const warm=Math.min(8,Math.floor(profile.minutes/4));
    const record=3;
    return {title,minutes:profile.minutes,skill:skills[i],drill,tasks:[
      [warm+" min", "Ease into the movement with controlled, low-speed repetitions."],
      [(profile.minutes-warm-record)+" min", description+" "+roleContext[profile.role]+" "+styleCue[profile.style]+" "+reps],
      [record+" min",i===5 ? "Repeat your first-session test and record the result using the same setup." : "Write down clean attempts and one thing to repeat next time."]
    ]};
  });
  return {profile, reviews:usable, priority, support, days};
}

export function parseTime(value) {
  const text=value.trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  const match=/^(\d+):([0-5]\d(?:\.\d+)?)$/.exec(text);
  return match ? Number(match[1])*60+Number(match[2]) : NaN;
}
