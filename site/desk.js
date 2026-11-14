"use strict";
const el = id => document.getElementById(id);
const percent = n => (100 * n).toFixed(1) + "%";
const state = { rows: [], feeds: {}, report: {}, queue: [], reviews: new Map() };
const config = {
  model: { score: "model_score", min: .35, max: .85, step: .001 },
  rule: { score: "rule_score", min: .2, max: 2.5, step: .01 },
};
function configure() {
  const method = el("detector").value;
  const limits = config[method];
  const input = el("threshold");
  input.min = limits.min; input.max = limits.max; input.step = limits.step;
  input.value = method === "model" ? state.report.model_threshold : 1;
  renderQueue();
}
function renderQueue() {
  const score = config[el("detector").value].score;
  const cutoff = Number(el("threshold").value);
  const flags = state.rows.filter(row => row[score] >= cutoff).sort((a,b) => b[score] - a[score]);
  state.queue = flags;
  const tp = flags.filter(row => row.scenario !== "Routine").length;
  const fp = flags.length - tp;
  const cards = [
    ["Held-out games", state.rows.length.toLocaleString()], ["Alerts", flags.length],
    ["Precision", percent(tp / (flags.length || 1))], ["Recall", percent(tp / state.report.injected)],
  ];
  el("metrics").replaceChildren(...cards.map(([name, value]) => {
    const card = document.createElement("div"); card.className = "panel";
    const strong = document.createElement("strong"); strong.className = "value"; strong.textContent = value;
    card.append(name, strong); return card;
  }));
  el("cutoff").textContent = cutoff.toFixed(3);
  el("queue").textContent = `${fp} false alerts at this cutoff. Decisions are kept for this visit.`;
  const previous = el("case").value;
  el("case").replaceChildren(...flags.map(row => new Option(`${row.game_date} · ${row.game_id}`, row.game_id)));
  if (flags.some(row => row.game_id === previous)) el("case").value = previous;
  el("example").disabled = !flags.some(row => row.scenario === "Routine");
  renderCase();
}
function renderCase() {
  const row = state.queue.find(item => item.game_id === el("case").value);
  el("truth").open = false;
  for (const id of ["tick", "notes", "follow", "dismiss"]) el(id).disabled = !row;
  el("case-title").textContent = row ? `Game ${row.game_id}` : "No alerts at this cutoff";
  el("context").textContent = row ? `${row.game_date} · Real game context · ${row.appearances} appearances · ${row.combined_points} combined box-score points` : "";
  el("signals").textContent = row ? `Largest move: ${row.max_move.toFixed(2)} · Largest feed gap: ${row.max_gap.toFixed(2)} · Oldest update: ${row.max_age.toFixed(1)} s` : "";
  el("label").textContent = row?.scenario ?? "";
  const decision = row && state.reviews.get(row.game_id);
  el("notes").value = decision?.notes ?? "";
  el("review").textContent = decision?.status ?? "";
  draw(row);
}
function draw(row) {
  const svg = el("chart");
  svg.replaceChildren();
  el("tick-details").textContent = "";
  if (!row) return;
  const {primary, reference, age} = state.feeds[row.game_id];
  const low = Math.floor(Math.min(...primary, ...reference)) - 1;
  const high = Math.ceil(Math.max(...primary, ...reference)) + 1;
  const x = i => 45 + 535 * i / 17;
  const y = v => 214 - 185 * (v-low)/(high-low);
  const graphic = (tag, attrs, value) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, val);
    if (value !== undefined) node.textContent = value;
    svg.append(node);
  };
  for (let i=0;i<=4;i++) {
    const value = low + (high-low)*i/4;
    graphic("line",{x1:45,x2:580,y1:y(value),y2:y(value),stroke:"#526079"});
    graphic("text",{x:1,y:y(value)+4,fill:"#c0c9da","font-size":12},value.toFixed(1));
  }
  for (const [series, color] of [[primary,"#ffad87"],[reference,"#6ce2d0"]]) {
    graphic("polyline",{points:series.map((v,i)=>`${x(i)},${y(v)}`).join(" "),fill:"none",stroke:color,"stroke-width":3});
  }
  const tick = Number(el("tick").value);
  graphic("line",{x1:x(tick),x2:x(tick),y1:25,y2:218,stroke:"#eee", "stroke-dasharray":"4 4"});
  el("tick-details").textContent = `Tick ${tick + 1} of 18 · Primary ${primary[tick].toFixed(2)} · Reference ${reference[tick].toFixed(2)} · Update age ${age[tick].toFixed(1)} s`;
}
function review(status) {
  const key = el("case").value;
  if (!key) return;
  state.reviews.set(key,{status,notes:el("notes").value});
  el("review").textContent = status;
}
el("detector").onchange = configure;
el("threshold").oninput = renderQueue;
el("case").onchange = renderCase;
el("tick").oninput = () => draw(state.queue.find(row => row.game_id === el("case").value));
el("example").onclick = () => {
  const routine = state.queue.find(row => row.scenario === "Routine");
  if (routine) { el("case").value = routine.game_id; renderCase(); }
};
el("follow").onclick = () => review("Marked for follow-up");
el("dismiss").onclick = () => review("Dismissed");
(async () => {
  try {
    const load = async name => {
      const response = await fetch(name);
      if (!response.ok) throw new Error(name);
      return response.json();
    };
    const [rows, feeds, report] = await Promise.all(["holdout.json", "feeds.json", "report.json"].map(load));
    Object.assign(state,{rows,feeds,report});
    el("split").textContent = `${report.training_rows} earlier games for fitting · ${report.test_rows} later games for evaluation · ${report.injected} injected events`;
    for (const [name, result] of [["Threshold rules",report.rules],["Isolation Forest",report.model]]) {
      const tr = document.createElement("tr");
      for (const value of [name,percent(result.precision),percent(result.recall),result.fp]) {
        const td = document.createElement("td"); td.textContent = value; tr.append(td);
      }
      el("compare").append(tr);
    }
    configure();
    el("desk").hidden = false;
    el("loading").hidden = true;
  } catch {
    el("loading").textContent = "The demo data did not load. Refresh to retry.";
  }
})();
