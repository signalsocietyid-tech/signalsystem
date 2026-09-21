/* ============================================================
   SIGNAL SYSTEM · Views — every module renders from Store.
   No business data is hardcoded here; all via SignalStore.
   ============================================================ */
window.Views = (function () {
  const S = () => window.SignalStore;
  const U = () => window.UI;
  const C = () => window.SignalConfig;

  const head = (title, sub, actions) => `
    <div class="flex flex-wrap items-end justify-between gap-3 mb-5 fade-up">
      <div><h1 class="text-[1.35rem] font-extrabold tracking-tight">${title}</h1>
      ${sub ? `<p class="text-[.82rem] text-zinc-500 mt-0.5">${sub}</p>` : ""}</div>
      <div class="flex items-center gap-2">${actions || ""}</div>
    </div>`;

  // honest sparkline: flat history ending at the real current value (no fake demo history)
  const trend = (v) => { const n = +v || 0; return [0, 0, 0, 0, n * 0.6, n]; };

  const kpi = (label, value, sub, sparkPts, accent) => `
    <div class="card p-4">
      <div class="kpi-label">${label}</div>
      <div class="text-[1.45rem] font-extrabold tracking-tight font-num mt-1">${value}</div>
      <div class="flex items-end justify-between gap-2 mt-1">
        <div class="text-[.72rem] text-zinc-500">${sub || ""}</div>
        ${sparkPts ? U().spark(sparkPts, accent ? "#FF6600" : "#111113") : ""}
      </div>
    </div>`;

  const secTitle = (t, link, linkLabel) => `
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-[.72rem] font-bold tracking-[.1em] text-zinc-400">${t}</h2>
      ${link ? `<a href="${link}" class="text-[.75rem] font-semibold text-zinc-500 hover:text-black">${linkLabel || "View all →"}</a>` : ""}
    </div>`;

  const healthDot = (h) => {
    const c = h === "Healthy" ? "#16A34A" : h === "At Risk" ? "#D97706" : "#DC2626";
    return `<span class="inline-flex items-center gap-1.5 text-[.76rem] font-semibold" style="color:${c}"><span class="dot" style="background:${c}"></span>${h}</span>`;
  };

  /* ---------------- DASHBOARD ---------------- */
  function dashboard() {
    const s = S(), u = U();
    const h = new Date().getHours();
    const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const active = s.list("projects").filter((p) => p.status === "Active");
    const openT = s.list("tasks").filter((t) => t.status !== "Done");
    const pipe = s.pipelineValue();
    const fin = s.financeTotals();
    const monthRev = s.list("transactions").filter((t) => t.type === "Income" && (t.date || "").slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((a, t) => a + (+t.amount || 0), 0);
    const att = s.attention();
    const campActive = s.list("campaigns").filter((c) => c.status === "Active");
    const wkStarts = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (5 - i) * 7); return d.toISOString().slice(0, 10); });
    const wkSums = wkStarts.map((ws) => { const e = new Date(ws + "T12:00:00"); e.setDate(e.getDate() + 6); const we = e.toISOString().slice(0, 10); return s.list("transactions").filter((t) => t.type === "Income" && t.date >= ws && t.date <= we).reduce((a, t) => a + (+t.amount || 0), 0); });
    const wkLabels = wkStarts.map((ws) => { const d = new Date(ws + "T12:00:00"); return d.getDate() + "/" + (d.getMonth() + 1); });

    const attHTML = att.length ? att.map((a) => `
      <a href="${a.link}" class="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF8] border-b border-[#F4F4F2] last:border-0 transition">
        <span class="dot" style="background:#FF6600"></span>
        <span class="text-[.82rem] font-semibold">${u.esc(a.label)}</span>
        <span class="ml-auto text-[.75rem] text-zinc-400">Open →</span>
      </a>`).join("") : `<div class="px-4 py-6 text-[.82rem] text-zinc-500">All clear. Nothing needs attention right now.</div>`;

    const projRows = active.slice(0, 6).map((p) => {
      const prog = s.projectProgress(p);
      return `<tr class="cursor-pointer" data-go="#/project/${p.id}">
        <td><div class="font-semibold">${u.esc(p.name)}</div><div class="text-[.7rem] text-zinc-400">${u.esc(s.clientName(p.client_id))}</div></td>
        <td>${u.svcTag(p.service_key)}</td>
        <td>${u.pill(p.status)}</td>
        <td style="min-width:130px"><div class="flex items-center gap-2"><div class="prog ${prog > 60 ? "acc" : ""} flex-1"><div style="width:${prog}%"></div></div><span class="text-[.72rem] font-bold font-num">${prog}%</span></div></td>
        <td>${healthDot(s.projectHealth(p))}</td>
        <td class="text-zinc-500 font-num text-[.78rem]">${u.fmtDate(p.deadline)} <span class="text-zinc-400">· ${u.rel(p.deadline)}</span></td>
      </tr>`;
    }).join("");

    const pipeByStage = C().pipelineStages.map((st) => {
      const ls = s.list("leads").filter((l) => l.stage === st);
      const v = ls.reduce((a, l) => a + (+l.deal_value || 0), 0);
      return { st, n: ls.length, v };
    });

    return `
    ${head(`${greet}, Signal Society.`, "Here's what needs your attention.", `
      <button class="btn-g" data-action="cmdk">⌘K Search</button>
      <button class="btn-a" data-action="quick">+ Quick create</button>`)}
    <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
      ${kpi("Active projects", active.length, s.list("projects").length + " total", trend(active.length))}
      ${kpi("Open tasks", openT.length, s.list("tasks").filter((t) => t.status !== "Done" && s.isOverdue(t.due_date)).length + " overdue", trend(openT.length))}
      ${kpi("Pipeline value", u.money(pipe), s.list("leads").filter((l) => !["Won", "Lost"].includes(l.stage)).length + " open leads", trend(pipe / 1000), true)}
      ${kpi("Monthly revenue", u.money(monthRev), "this month", trend(Math.max(monthRev / 1000, 0.001)), true)}
      ${kpi("Outstanding", u.money(fin.outstanding), s.list("invoices").filter((i) => i.status === "Overdue").length + " overdue")}
      ${kpi("Campaigns live", campActive.length, "across " + new Set(campActive.flatMap((c) => c.platforms || [])).size + " channels")}
    </div>
    <div class="grid lg:grid-cols-3 gap-4 mb-6">
      <div class="card overflow-hidden">
        <div class="card-h"><span class="font-bold text-[.85rem]">Attention</span><span class="chip">${att.length} signals</span></div>
        <div>${attHTML}</div>
      </div>
      <div class="card p-4 lg:col-span-2">
        ${secTitle("SALES PIPELINE", "#/pipeline")}
        <div class="grid grid-cols-4 md:grid-cols-8 gap-2">
          ${pipeByStage.map((p) => `<a href="#/pipeline" class="rounded-lg border border-[#EFEFED] bg-[#FAFAF9] p-2.5 hover:border-zinc-900 transition">
            <div class="text-[.62rem] font-bold uppercase tracking-wide text-zinc-400 truncate">${u.esc(p.st)}</div>
            <div class="text-[1.05rem] font-extrabold font-num">${p.n}</div>
            <div class="text-[.68rem] text-zinc-500 font-num">${u.money(p.v)}</div></a>`).join("")}
        </div>
        <div class="mt-4">${secTitle("CASH FLOW · LAST 6 WEEKS")}${wkSums.some((v) => v > 0) ? u.bars(wkSums, wkLabels) : u.empty("No income yet.", "Cash flow builds as you record payments.")}</div>
      </div>
    </div>
    <div class="card overflow-hidden mb-6">
      <div class="card-h"><span class="font-bold text-[.85rem]">Active projects</span><a href="#/projects" class="text-[.75rem] font-semibold text-zinc-500 hover:text-black">View all →</a></div>
      <div class="overflow-x-auto"><table class="tbl w-full min-w-[760px]">
        <thead><tr><th>Project</th><th>Service</th><th>Status</th><th>Progress</th><th>Health</th><th>Deadline</th></tr></thead>
        <tbody>${projRows || `<tr><td colspan="6">${u.empty("No active projects yet.", "", `<button class="btn-a" data-action="new-project">+ Create Project</button>`)}</td></tr>`}</tbody>
      </table></div>
    </div>`;
  }

  /* ---------------- PROJECTS ---------------- */
  function projects() {
    const s = S(), u = U();
    const f = window._filter?.projects || { q: "", status: "All" };
    let rows = s.list("projects");
    if (f.status !== "All") rows = rows.filter((p) => p.status === f.status);
    if (f.q) rows = rows.filter((p) => (p.name + s.clientName(p.client_id)).toLowerCase().includes(f.q.toLowerCase()));
    const counts = Object.fromEntries(C().projectStatuses.map((st) => [st, s.list("projects").filter((p) => p.status === st).length]));
    return `
    ${head("Projects", `${rows.length} projects · ${s.list("projects").filter((p) => p.status === "Active").length} active`, `<button class="btn-a" data-action="new-project">+ New project</button>`)}
    <div class="flex flex-wrap items-center gap-2 mb-4">
      ${["All", ...C().projectStatuses].map((st) => `<button class="seg ${f.status === st ? "active" : ""}" data-pf="${st}">${st}${st !== "All" ? ` · ${counts[st] || 0}` : ""}</button>`).join("")}
      <input id="pq" class="inp !w-56 ml-auto" placeholder="Search projects…" value="${u.esc(f.q)}"/>
    </div>
    <div class="card overflow-hidden"><div class="overflow-x-auto"><table class="tbl w-full min-w-[820px]">
      <thead><tr><th>Project</th><th>Service</th><th>Status</th><th>Progress</th><th>Health</th><th>Budget</th><th>Deadline</th><th></th></tr></thead>
      <tbody>${rows.map((p) => { const prog = s.projectProgress(p); return `<tr class="cursor-pointer" data-go="#/project/${p.id}">
        <td><div class="font-semibold">${u.esc(p.name)}</div><div class="text-[.7rem] text-zinc-400">${u.esc(s.clientName(p.client_id))} · ${u.esc(p.owner || "")}</div></td>
        <td>${u.svcTag(p.service_key)}</td><td>${u.pill(p.status)}</td>
        <td style="min-width:120px"><div class="flex items-center gap-2"><div class="prog ${prog > 60 ? "acc" : ""} flex-1"><div style="width:${prog}%"></div></div><span class="text-[.72rem] font-bold font-num">${prog}%</span></div></td>
        <td>${healthDot(s.projectHealth(p))}</td>
        <td class="font-num font-semibold">${u.money(p.budget)}</td>
        <td class="text-zinc-500 font-num text-[.78rem]">${u.fmtDate(p.deadline)}</td>
        <td><button class="btn-g !px-2 !py-1" data-edit-project="${p.id}">Edit</button></td></tr>`; }).join("") || `<tr><td colspan="8">${u.empty("No projects here.", "Create one from a service template in seconds.")}</td></tr>`}</tbody>
    </table></div></div>`;
  }

  function projectDetail(id) {
    const s = S(), u = U();
    const p = s.get("projects", id);
    if (!p) return head("Project not found", "", `<a href="#/projects" class="btn-g">← Back</a>`);
    const tab = window._ptab || "Overview";
    const ts = s.projectTasks(id);
    const prog = s.projectProgress(p);
    const cost = s.actualCost(id);
    const ms = s.list("milestones").filter((m) => m.project_id === id);
    const invs = s.list("invoices").filter((i) => i.project_id === id);
    const notes = s.list("notes").filter((n) => n.linked_kind === "project" && n.linked_id === id);
    const files = s.list("files").filter((f) => f.linked_kind === "project" && f.linked_id === id);
    const tabs = ["Overview", "Tasks", "Timeline", "Calendar", "Files", "Notes", "Communication", "Finance", "Deliverables", "Activity"];
    let body = "";
    if (tab === "Overview") body = `
      <div class="grid lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 space-y-4">
          <div class="card p-5"><div class="kpi-label mb-1">Summary</div><p class="text-[.86rem] leading-relaxed text-zinc-700">${u.esc(p.description || "No summary yet.")}</p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              ${[["Progress", prog + "%"], ["Health", s.projectHealth(p)], ["Budget used", Math.round((cost / (p.budget || 1)) * 100) + "%"], ["Open tasks", ts.filter((t) => t.status !== "Done").length]].map((x) => `<div class="rounded-lg bg-[#FAFAF9] border border-[#F1F1EF] p-3"><div class="kpi-label">${x[0]}</div><div class="font-extrabold text-[1rem]">${x[1]}</div></div>`).join("")}
            </div></div>
          <div class="card p-5"><div class="font-bold text-[.85rem] mb-3">Milestones</div>
            ${ms.map((m) => { const mt = ts.filter((t) => t.milestone_id === m.id); const done = mt.filter((t) => t.status === "Done").length; const pc = mt.length ? Math.round((done / mt.length) * 100) : (m.status === "Done" ? 100 : 0);
              return `<div class="flex items-center gap-3 py-2.5 border-b border-[#F4F4F2] last:border-0"><div class="flex-1"><div class="text-[.83rem] font-semibold">${u.esc(m.name)}</div><div class="text-[.7rem] text-zinc-400">${done}/${mt.length} tasks · due ${u.fmtDate(m.deadline)}</div></div><div class="prog w-28"><div style="width:${pc}%"></div></div>${u.pill(m.status)}</div>`; }).join("") || u.empty("No milestones yet.", "", `<button class="btn-g" data-action="new-milestone" data-id="${p.id}">+ Add milestone</button>`)}</div>
          <div class="card p-5"><div class="font-bold text-[.85rem] mb-2">Upcoming tasks</div>
            ${ts.filter((t) => t.status !== "Done").slice(0, 5).map((t) => `<div class="flex items-center gap-3 py-2 border-b border-[#F4F4F2] last:border-0 cursor-pointer hover:bg-[#FAFAF8]" data-task="${t.id}">${u.pill(t.status)}<span class="text-[.83rem] font-medium flex-1">${u.esc(t.title)}</span>${u.avatar(t.assignee)}<span class="text-[.72rem] text-zinc-400 font-num">${u.fmtDate(t.due_date)}</span></div>`).join("") || `<p class="text-[.8rem] text-zinc-500">Nothing upcoming.</p>`}</div>
        </div>
        <div class="space-y-4">
          <div class="card p-5"><div class="font-bold text-[.85rem] mb-3">Budget</div>
            <div class="text-[1.5rem] font-extrabold font-num">${u.money(p.budget - cost)} <span class="text-[.72rem] font-medium text-zinc-400">remaining</span></div>
            <div class="prog acc mt-2"><div style="width:${Math.min(100, Math.round((cost / (p.budget || 1)) * 100))}%"></div></div>
            <div class="text-[.75rem] text-zinc-500 mt-2 font-num">Contract ${u.money(p.contract_value)} · Cost ${u.money(cost)} · Profit ${u.money((p.contract_value || 0) - cost)}</div></div>
          <div class="card p-5"><div class="font-bold text-[.85rem] mb-3">Client</div>
            <div class="text-[.85rem] font-semibold">${u.esc(s.clientName(p.client_id))}</div>
            <a href="#/customer/${p.client_id}" class="text-[.76rem] font-semibold mt-1 inline-block" style="color:#FF6600">Open customer →</a></div>
          <div class="card p-5"><div class="font-bold text-[.85rem] mb-2">Recent activity</div>
            ${s.list("activities").slice(0, 5).map((a) => `<div class="text-[.76rem] py-1.5 border-b border-[#F4F4F2] last:border-0"><b>${u.esc(a.actor_name)}</b> ${u.esc(a.action)} — <span class="text-zinc-500">${u.esc(a.entity_label)}</span></div>`).join("")}</div>
        </div>
      </div>`;
    else if (tab === "Tasks") body = taskBoard(ts, p.id);
    else if (tab === "Finance") body = `
      <div class="grid md:grid-cols-4 gap-3 mb-4">
        ${kpi("Contract", u.money(p.contract_value))}${kpi("Est. cost", u.money(p.estimated_cost))}${kpi("Actual cost", u.money(cost))}${kpi("Profit", u.money((p.contract_value || 0) - cost))}</div>
      <div class="card overflow-hidden"><div class="card-h"><span class="font-bold text-[.85rem]">Invoices</span><button class="btn-g" data-action="new-invoice">+ Invoice</button></div>
      <table class="tbl w-full"><thead><tr><th>Number</th><th>Issue</th><th>Due</th><th>Total</th><th>Status</th></tr></thead><tbody>
      ${invs.map((i) => `<tr><td class="font-semibold font-num">${u.esc(i.number)}</td><td class="font-num">${u.fmtDate(i.issue_date)}</td><td class="font-num">${u.fmtDate(i.due_date)}</td><td class="font-num font-bold">${u.money(i.total)}</td><td>${u.pill(i.status)}</td></tr>`).join("") || `<tr><td colspan="5">${u.empty("No invoices yet.")}</td></tr>`}</tbody></table></div>`;
    else if (tab === "Files") body = fileList(files, "project", id);
    else if (tab === "Notes") body = notesList(notes, "project", id);
    else if (tab === "Timeline") body = timelineView(ts, ms);
    else if (tab === "Calendar") body = miniCalendar(ts);
    else if (tab === "Communication") body = `<div class="card p-5"><div class="font-bold text-[.85rem] mb-2">Communication log</div>${notesList(notes, "project", id)}</div>`;
    else if (tab === "Deliverables") body = `<div class="card p-5">${u.empty("No deliverables yet.", "Attach deliverables as files or links.")}</div>`;
    else if (tab === "Activity") body = `<div class="card p-5">${s.list("activities").slice(0, 20).map((a) => `<div class="text-[.8rem] py-2 border-b border-[#F4F4F2] last:border-0"><b>${u.esc(a.actor_name)}</b> ${u.esc(a.action)} — <span class="text-zinc-500">${u.esc(a.entity_label)}</span><div class="text-[.7rem] text-zinc-400">${u.fmtDT(a.created_at)}</div></div>`).join("")}</div>`;

    return `
    <a href="#/projects" class="text-[.76rem] font-semibold text-zinc-500 hover:text-black">← All projects</a>
    <div class="card p-5 mt-2 mb-4 fade-up">
      <div class="flex flex-wrap items-start gap-4">
        <div class="flex-1 min-w-[220px]">
          <div class="flex items-center gap-2 flex-wrap">${u.svcTag(p.service_key)} ${u.pill(p.status)} ${healthDot(s.projectHealth(p))}</div>
          <h1 class="text-[1.4rem] font-extrabold tracking-tight mt-1.5">${u.esc(p.name)}</h1>
          <p class="text-[.8rem] text-zinc-500">${u.esc(s.clientName(p.client_id))} · Owner ${u.esc(p.owner || "—")} · Due ${u.fmtDate(p.deadline)}</p>
        </div>
        <div class="w-52"><div class="flex justify-between text-[.72rem] font-bold mb-1"><span>PROGRESS</span><span class="font-num">${prog}%</span></div><div class="prog acc"><div style="width:${prog}%"></div></div>
        <div class="flex gap-2 mt-3"><button class="btn-g" data-edit-project="${p.id}">Edit</button><button class="btn-p" data-action="new-task" data-id="${p.id}">+ Task</button></div></div>
      </div>
    </div>
    <div class="flex overflow-x-auto border-b border-[#E8E8E6] mb-4">${tabs.map((t) => `<button class="tabbtn ${tab === t ? "active" : ""}" data-ptab="${t}">${t}</button>`).join("")}</div>
    ${body}`;
  }

  function taskBoard(ts, projectId) {
    const u = U();
    const cols = C().taskStatuses;
    return `<div class="flex gap-3 overflow-x-auto pb-4">
      ${cols.map((st) => { const items = ts.filter((t) => t.status === st); return `
      <div class="kanban-col p-2.5 flex-shrink-0 w-[260px]" data-col="${st}">
        <div class="flex items-center justify-between px-1.5 py-1 mb-2"><span class="text-[.7rem] font-bold uppercase tracking-wide text-zinc-500">${st}</span><span class="chip font-num">${items.length}</span></div>
        <div class="space-y-2 min-h-[60px]" data-drop="${st}">
        ${items.map((t) => taskCard(t)).join("")}
        </div>
        <button class="w-full text-[.75rem] font-semibold text-zinc-400 hover:text-black py-2" data-action="new-task" data-id="${projectId || ""}" data-status="${st}">+ Add</button>
      </div>`; }).join("")}
    </div>`;
  }
  function taskCard(t) {
    const u = U(), s = S();
    const od = t.status !== "Done" && s.isOverdue(t.due_date);
    return `<div class="kanban-card" draggable="true" data-task="${t.id}" data-drag="${t.id}">
      <div class="flex items-center gap-1.5 mb-1.5">${u.pill(t.priority)}${od ? `<span class="chip" style="color:#DC2626;border-color:#DC262633">overdue</span>` : ""}<span class="ml-auto text-[.65rem] text-zinc-400 font-num">${u.fmtDate(t.due_date)}</span></div>
      <div class="text-[.8rem] font-semibold leading-snug">${u.esc(t.title)}</div>
      <div class="flex items-center gap-2 mt-2"><span class="text-[.65rem] text-zinc-400">${u.esc(s.projectName(t.project_id))}</span><span class="ml-auto">${u.avatar(t.assignee, 22)}</span></div>
    </div>`;
  }

  /* ---------------- GLOBAL TASKS ---------------- */
  function tasks() {
    const s = S(), u = U();
    const view = window._taskview || "Kanban";
    const q = (window._filter?.tasks || "").toLowerCase();
    let ts = s.list("tasks");
    if (q) ts = ts.filter((t) => (t.title + (t.assignee || "")).toLowerCase().includes(q));
    return `
    ${head("Tasks", `${ts.filter((t) => t.status !== "Done").length} open · ${ts.filter((t) => t.status !== "Done" && s.isOverdue(t.due_date)).length} overdue`, `
      <input id="tq" class="inp !w-52" placeholder="Search tasks…" value="${u.esc(window._filter?.tasks || "")}"/>
      ${["List", "Kanban", "Calendar"].map((v) => `<button class="seg ${view === v ? "active" : ""}" data-tview="${v}">${v}</button>`).join("")}
      <button class="btn-a" data-action="new-task">+ New task</button>`)}
    ${view === "Kanban" ? taskBoard(ts) : view === "List" ? `
    <div class="card overflow-hidden"><table class="tbl w-full min-w-[760px]"><thead><tr><th>Task</th><th>Project</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th></tr></thead><tbody>
      ${ts.map((t) => `<tr class="cursor-pointer" data-task="${t.id}"><td class="font-semibold">${u.esc(t.title)}</td><td class="text-zinc-500">${u.esc(s.projectName(t.project_id))}</td><td>${u.pill(t.status)}</td><td>${u.pill(t.priority)}</td><td><span class="flex items-center gap-2">${u.avatar(t.assignee, 22)}<span class="text-[.76rem]">${u.esc(t.assignee || "—")}</span></span></td><td class="font-num text-[.78rem] ${s.isOverdue(t.due_date) && t.status !== "Done" ? "text-red-600 font-bold" : "text-zinc-500"}">${u.fmtDate(t.due_date)}</td></tr>`).join("")}
    </tbody></table></div>` : miniCalendar(ts)}`;
  }

  function miniCalendar(ts) {
    const u = U();
    const now = window._calCursor ? new Date(window._calCursor) : new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(`<div class="cal-cell bg-[#FAFAF9]"></div>`);
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const items = ts.filter((t) => t.due_date === key);
      cells.push(`<div class="cal-cell"><div class="text-[.68rem] font-bold ${key === new Date().toISOString().slice(0, 10) ? "text-white bg-[#FF6600] w-5 h-5 rounded-full flex items-center justify-center" : "text-zinc-400"}">${d}</div>
        ${items.slice(0, 3).map((t) => `<div class="evt bg-[#FFF1E8] text-[#9A3B00]" style="border-color:#FF6600" data-task="${t.id}">${u.esc(t.title)}</div>`).join("")}
        ${items.length > 3 ? `<div class="text-[.62rem] text-zinc-400">+${items.length - 3} more</div>` : ""}</div>`);
    }
    return `<div class="card overflow-hidden">
      <div class="card-h"><button class="btn-g" data-cal="-1">←</button><span class="font-bold text-[.85rem]">${now.toLocaleString("en-US", { month: "long", year: "numeric" })}</span><button class="btn-g" data-cal="1">→</button></div>
      <div class="grid grid-cols-7 text-[.65rem] font-bold text-zinc-400 uppercase tracking-wide px-1 py-2">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<div class="text-center">${d}</div>`).join("")}</div>
      <div class="grid grid-cols-7 border-t border-l border-[#F1F1EF] ml-2 mr-2 mb-2">${cells.join("")}</div></div>`;
  }

  function timelineView(ts, ms) {
    const u = U();
    const items = [...ts].sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")).slice(0, 12);
    return `<div class="card p-5"><div class="font-bold text-[.85rem] mb-4">Timeline</div>
      <div class="relative pl-5 border-l-2 border-[#EFEFED] space-y-4">
      ${items.map((t) => `<div class="relative"><span class="absolute -left-[27px] top-1 dot" style="background:${t.status === "Done" ? "#16A34A" : "#FF6600"}"></span>
        <div class="text-[.8rem] font-semibold cursor-pointer hover:underline" data-task="${t.id}">${u.esc(t.title)}</div>
        <div class="text-[.7rem] text-zinc-400">${u.fmtDate(t.due_date)} · ${u.esc(t.assignee || "Unassigned")} · ${t.status}</div></div>`).join("") || u.empty("Nothing scheduled.")}
      </div></div>`;
  }

  /* ---------------- CALENDARS ---------------- */
  function projectCalendar() {
    const s = S();
    return head("Project Calendar", "Deadlines, milestones and task due dates.", `<button class="btn-a" data-action="new-task">+ New task</button>`) + miniCalendar(s.list("tasks"));
  }

  function marketingCalendar() {
    const s = S(), u = U();
    const view = window._mktview || "Month";
    const evts = s.list("marketingEvents");
    const stColor = { Planned: "#71717A", Active: "#FF6600", Paused: "#D97706", Completed: "#16A34A", Cancelled: "#A1A1AA" };
    const listHTML = evts.map((e) => `
      <tr class="cursor-pointer" data-mktevt="${e.id}"><td class="font-semibold">${u.esc(e.title)}<div class="text-[.68rem] font-normal text-zinc-400">${u.esc(e.channel || "")} · ${u.esc(s.clientName(e.client_id))}</div></td>
      <td class="font-num text-[.78rem]">${u.fmtDate(e.start_date)} → ${u.fmtDate(e.end_date)}</td><td>${u.pill(e.status)}</td><td class="text-[.78rem]">${u.esc(e.owner || "—")}</td></tr>`).join("");
    return head("Marketing Calendar", "Launches, promotions, campaigns and key dates.", `
      ${["Month", "Week", "Timeline"].map((v) => `<button class="seg ${view === v ? "active" : ""}" data-mktview="${v}">${v}</button>`).join("")}
      <button class="btn-a" data-action="new-mktevent">+ New event</button>`) + `
    <div class="grid lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2">${view === "Timeline" ? `
        <div class="card p-5"><div class="space-y-3">${evts.map((e) => `<div class="flex items-center gap-3 cursor-pointer" data-mktevt="${e.id}">
          <span class="dot" style="background:${stColor[e.status]}"></span>
          <div class="flex-1"><div class="text-[.83rem] font-semibold">${u.esc(e.title)}</div><div class="text-[.7rem] text-zinc-400 font-num">${u.fmtDate(e.start_date)} → ${u.fmtDate(e.end_date)}</div></div>${u.pill(e.status)}</div>`).join("")}</div></div>`
        : miniCalendar(s.list("marketingEvents").map((e) => ({ ...e, title: e.title, due_date: e.start_date, project_id: null })))}</div>
      <div class="card overflow-hidden"><div class="card-h"><span class="font-bold text-[.85rem]">All events</span></div>
        <table class="tbl w-full"><tbody>${listHTML}</tbody></table></div>
    </div>`;
  }

  function contentCalendar() {
    const s = S(), u = U();
    const view = window._contentview || "Kanban";
    let items = s.list("content");
    const cols = C().contentStatuses;
    const platColor = { Instagram: "#E1306C", TikTok: "#111113", LinkedIn: "#0A66C2", Facebook: "#1877F2", Website: "#FF6600", YouTube: "#DC2626", Other: "#71717A" };
    const card = (c) => `<div class="kanban-card" draggable="true" data-content="${c.id}" data-drag-content="${c.id}">
      <div class="flex items-center gap-1.5 mb-1.5"><span class="dot" style="background:${platColor[c.platform] || "#71717A"}"></span><span class="text-[.65rem] font-bold text-zinc-500">${u.esc(c.platform)} · ${u.esc(c.content_type)}</span><span class="ml-auto text-[.62rem] text-zinc-400 font-num">${u.fmtDate(c.publish_date)}</span></div>
      <div class="text-[.8rem] font-semibold leading-snug">${u.esc(c.title)}</div>
      <div class="flex items-center gap-2 mt-2"><span class="text-[.65rem] text-zinc-400">${u.esc(s.clientName(c.client_id))}</span><span class="ml-auto">${u.avatar(c.assignee, 22)}</span></div></div>`;
    return head("Content Calendar", "Production pipeline — drag cards to reschedule status.", `
      ${["Kanban", "List", "Calendar"].map((v) => `<button class="seg ${view === v ? "active" : ""}" data-contentview="${v}">${v}</button>`).join("")}
      <button class="btn-a" data-action="new-content">+ New content</button>`) + (
      view === "Kanban" ? `<div class="flex gap-3 overflow-x-auto pb-4">${cols.map((st) => `<div class="kanban-col p-2.5 w-[250px] flex-shrink-0" data-col="${st}">
        <div class="flex items-center justify-between px-1.5 py-1 mb-2"><span class="text-[.7rem] font-bold uppercase tracking-wide text-zinc-500">${st}</span><span class="chip font-num">${items.filter((c) => c.status === st).length}</span></div>
        <div class="space-y-2 min-h-[60px]" data-drop-content="${st}">${items.filter((c) => c.status === st).map(card).join("")}</div></div>`).join("")}</div>`
      : view === "List" ? `<div class="card overflow-hidden"><table class="tbl w-full min-w-[820px]"><thead><tr><th>Title</th><th>Platform</th><th>Type</th><th>Client</th><th>Status</th><th>Publish</th><th>Owner</th></tr></thead><tbody>
        ${items.map((c) => `<tr class="cursor-pointer" data-content="${c.id}"><td class="font-semibold">${u.esc(c.title)}</td><td><span class="dot" style="background:${platColor[c.platform]}"></span> ${u.esc(c.platform)}</td><td class="text-zinc-500">${u.esc(c.content_type)}</td><td class="text-zinc-500">${u.esc(s.clientName(c.client_id))}</td><td>${u.pill(c.status)}</td><td class="font-num text-[.78rem]">${u.fmtDate(c.publish_date)}</td><td>${u.avatar(c.assignee, 22)}</td></tr>`).join("")}</tbody></table></div>`
      : miniCalendar(items.map((c) => ({ id: c.id, title: c.title, due_date: c.publish_date, project_id: null }))));
  }

  /* ---------------- CAMPAIGNS ---------------- */
  function campaigns() {
    const s = S(), u = U();
    return head("Campaigns", `${s.list("campaigns").filter((c) => c.status === "Active").length} active`, `<button class="btn-a" data-action="new-campaign">+ New campaign</button>`) + `
    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      ${s.list("campaigns").map((c) => { const pct = c.budget ? Math.round(((c.spend || 0) / c.budget) * 100) : 0;
        const items = s.list("content").filter((x) => x.campaign_id === c.id);
        return `<div class="card p-5 cursor-pointer hover:border-zinc-900 transition fade-up" data-go="#/campaign/${c.id}">
        <div class="flex items-center gap-2 mb-2">${u.pill(c.status)}<span class="ml-auto text-[.7rem] text-zinc-400 font-num">${u.fmtDate(c.start_date)} → ${u.fmtDate(c.end_date)}</span></div>
        <div class="font-extrabold text-[1rem] tracking-tight">${u.esc(c.name)}</div>
        <div class="text-[.76rem] text-zinc-500">${u.esc(s.clientName(c.client_id))} · ${(c.platforms || []).join(" · ")}</div>
        <div class="flex justify-between text-[.72rem] font-bold mt-4 mb-1"><span class="text-zinc-400">SPEND</span><span class="font-num">${u.money(c.spend)} / ${u.money(c.budget)}</span></div>
        <div class="prog acc"><div style="width:${Math.min(100, pct)}%"></div></div>
        <div class="flex items-center gap-2 mt-3 text-[.72rem] text-zinc-500"><span>${items.length} content pieces</span><span class="ml-auto font-semibold" style="color:#FF6600">${u.esc(c.kpi || "").split("·")[0]}</span></div>
      </div>`; }).join("")}
    </div>`;
  }

  function campaignDetail(id) {
    const s = S(), u = U();
    const c = s.get("campaigns", id);
    if (!c) return head("Not found", "", `<a class="btn-g" href="#/campaigns">← Back</a>`);
    const items = s.list("content").filter((x) => x.campaign_id === id);
    return `<a href="#/campaigns" class="text-[.76rem] font-semibold text-zinc-500">← All campaigns</a>
    <div class="card p-5 mt-2 mb-4"><div class="flex flex-wrap gap-4 items-start"><div class="flex-1">${u.pill(c.status)}
      <h1 class="text-[1.4rem] font-extrabold tracking-tight mt-1">${u.esc(c.name)}</h1>
      <p class="text-[.8rem] text-zinc-500">${u.esc(c.objective || "")} · ${u.esc(s.clientName(c.client_id))}</p>
      <div class="text-[.76rem] text-zinc-500 mt-1">Audience: ${u.esc(c.audience || "—")} · KPI: ${u.esc(c.kpi || "—")}</div></div>
      <div class="flex gap-2"><button class="btn-g" data-edit-campaign="${c.id}">Edit</button><button class="btn-a" data-action="new-content">+ Content</button></div></div></div>
    <div class="card overflow-hidden"><div class="card-h"><span class="font-bold text-[.85rem]">Content (${items.length})</span></div>
    <table class="tbl w-full"><thead><tr><th>Title</th><th>Platform</th><th>Status</th><th>Publish</th></tr></thead><tbody>
    ${items.map((x) => `<tr class="cursor-pointer" data-content="${x.id}"><td class="font-semibold">${u.esc(x.title)}</td><td>${u.esc(x.platform)}</td><td>${u.pill(x.status)}</td><td class="font-num">${u.fmtDate(x.publish_date)}</td></tr>`).join("") || `<tr><td colspan="4">${u.empty("No content linked yet.")}</td></tr>`}</tbody></table></div>`;
  }

  /* ---------------- CLIENTS / CRM ---------------- */
  function customers() {
    const s = S(), u = U();
    const q = (window._filter?.customers || "").toLowerCase();
    let rows = s.list("clients");
    if (q) rows = rows.filter((c) => (c.company_name + c.contact_person + (c.email || "")).toLowerCase().includes(q));
    return head("Customers", `${rows.length} companies · ${u.money(rows.reduce((a, c) => a + (+c.lifetime_value || 0), 0))} lifetime value`, `<button class="btn-a" data-action="new-client">+ New customer</button>`) + `
    <div class="card p-3 mb-4 flex gap-2"><input id="cq" class="inp" placeholder="Search company, contact, email…" value="${u.esc(window._filter?.customers || "")}"/></div>
    <div class="card overflow-hidden"><div class="overflow-x-auto"><table class="tbl w-full min-w-[900px]"><thead><tr><th>Company</th><th>Contact</th><th>Status</th><th>Industry</th><th>Lifetime</th><th>Manager</th><th></th></tr></thead><tbody>
    ${rows.map((c) => { const projs = s.list("projects").filter((p) => p.client_id === c.id); return `<tr class="cursor-pointer" data-go="#/customer/${c.id}">
      <td><div class="font-semibold">${u.esc(c.company_name)}</div><div class="text-[.68rem] text-zinc-400">${projs.length} projects</div></td>
      <td><div class="text-[.8rem]">${u.esc(c.contact_person || "—")}</div><div class="text-[.68rem] text-zinc-400">${u.esc(c.email || "")}</div></td>
      <td>${u.pill(c.status)}</td><td class="text-zinc-500 text-[.78rem]">${u.esc(c.industry || "—")}</td>
      <td class="font-num font-bold">${u.money(c.lifetime_value)}</td><td><span class="flex items-center gap-2">${u.avatar(c.account_manager, 22)}<span class="text-[.76rem]">${u.esc(c.account_manager || "—")}</span></span></td>
      <td><button class="btn-g !px-2.5 !py-1" data-chat-client="${c.id}">Chat</button></td></tr>`; }).join("")}
    </tbody></table></div></div>`;
  }

  function customerDetail(id) {
    const s = S(), u = U();
    const c = s.get("clients", id);
    if (!c) return head("Not found", "", `<a class="btn-g" href="#/customers">← Back</a>`);
    const tab = window._ctab || "Overview";
    const projs = s.list("projects").filter((p) => p.client_id === id);
    const invs = s.list("invoices").filter((i) => i.client_id === id);
    const camps = s.list("campaigns").filter((x) => x.client_id === id);
    const outstanding = invs.filter((i) => ["Sent", "Viewed", "Partially Paid", "Overdue"].includes(i.status)).reduce((a, i) => a + (i.total - (i.amount_paid || 0)), 0);
    const tabs = ["Overview", "Projects", "Contacts", "Invoices", "Transactions", "Campaigns", "Notes", "Files", "Activity"];
    let body = "";
    if (tab === "Overview") body = `<div class="grid md:grid-cols-4 gap-3 mb-4">
      ${kpi("Lifetime value", u.money(c.lifetime_value))}${kpi("Projects", projs.length, projs.filter((p) => p.status === "Active").length + " active")}${kpi("Outstanding", u.money(outstanding), invs.filter((i) => i.status === "Overdue").length + " overdue")}${kpi("Campaigns", camps.length)}</div>
      <div class="card p-5"><div class="kpi-label mb-1">Notes</div><p class="text-[.85rem] text-zinc-700">${u.esc("Key account. Prefers concise updates on Fridays.")}</p>
      <div class="grid sm:grid-cols-2 gap-3 mt-4 text-[.8rem]">${[["Email", c.email], ["Phone", c.phone], ["Website", c.website], ["Industry", c.industry], ["Size", c.company_size], ["Source", c.source], ["Address", c.address], ["Manager", c.account_manager]].map((x) => `<div class="rounded-lg bg-[#FAFAF9] border border-[#F1F1EF] p-3"><div class="kpi-label">${x[0]}</div><div class="font-semibold mt-0.5">${u.esc(x[1] || "—")}</div></div>`).join("")}</div></div>`;
    else if (tab === "Projects") body = `<div class="card overflow-hidden"><table class="tbl w-full"><thead><tr><th>Project</th><th>Service</th><th>Status</th><th>Progress</th></tr></thead><tbody>${projs.map((p) => `<tr class="cursor-pointer" data-go="#/project/${p.id}"><td class="font-semibold">${u.esc(p.name)}</td><td>${u.svcTag(p.service_key)}</td><td>${u.pill(p.status)}</td><td class="font-num">${s.projectProgress(p)}%</td></tr>`).join("")}</tbody></table></div>`;
    else if (tab === "Invoices") body = `<div class="card overflow-hidden"><table class="tbl w-full"><thead><tr><th>Number</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead><tbody>${invs.map((i) => `<tr><td class="font-num font-semibold">${u.esc(i.number)}</td><td class="font-num">${u.money(i.total)}</td><td class="font-num">${u.money(i.amount_paid)}</td><td>${u.pill(i.status)}</td></tr>`).join("")}</tbody></table></div>`;
    else if (tab === "Campaigns") body = `<div class="grid md:grid-cols-2 gap-3">${camps.map((x) => `<div class="card p-4 cursor-pointer" data-go="#/campaign/${x.id}"><div class="font-bold">${u.esc(x.name)}</div><div class="text-[.75rem] text-zinc-500">${u.esc(x.status)} · ${u.money(x.budget)}</div></div>`).join("") || u.empty("No campaigns.")}</div>`;
    else if (tab === "Files") body = fileList(s.list("files").filter((f) => f.linked_kind === "client" && f.linked_id === id || (f.linked_kind === "project" && projs.some((p) => p.id === f.linked_id))), "client", id);
    else if (tab === "Notes") body = notesList(s.list("notes").filter((n) => n.linked_id === id), "client", id);
    else if (tab === "Transactions") body = `<div class="card overflow-hidden"><table class="tbl w-full"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Ref</th></tr></thead><tbody>${s.list("transactions").filter((t) => t.client_id === id).map((t) => `<tr><td class="font-num">${u.fmtDate(t.date)}</td><td>${u.pill(t.type === "Income" ? "Paid" : "Draft")}</td><td class="font-num font-bold">${u.money(t.amount)}</td><td class="text-zinc-500">${u.esc(t.reference || "")}</td></tr>`).join("")}</tbody></table></div>`;
    else body = `<div class="card p-5"><p class="text-[.82rem] text-zinc-500">${tab} — connected records appear here. Activity is auto-logged on every mutation.</p></div>`;
    return `<a href="#/customers" class="text-[.76rem] font-semibold text-zinc-500">← All customers</a>
    <div class="card p-5 mt-2 mb-4"><div class="flex flex-wrap items-center gap-4"><div class="w-12 h-12 rounded-xl bg-[#111113] text-white flex items-center justify-center font-extrabold">${u.initials(c.company_name)}</div>
    <div class="flex-1"><div class="flex items-center gap-2">${u.pill(c.status)}<span class="text-[.72rem] text-zinc-400">${(c.tags || []).map((t) => "#" + t).join(" ")}</span></div>
    <h1 class="text-[1.35rem] font-extrabold tracking-tight">${u.esc(c.company_name)}</h1><p class="text-[.8rem] text-zinc-500">${u.esc(c.contact_person || "")} · ${u.esc(c.email || "")} · ${u.esc(c.phone || "")}</p></div>
    <div class="flex gap-2"><button class="btn-g" data-chat-client="${c.id}">Chat</button><button class="btn-g" data-edit-client="${c.id}">Edit</button><button class="btn-p" data-action="new-project">+ Project</button></div></div></div>
    <div class="flex overflow-x-auto border-b border-[#E8E8E6] mb-4">${tabs.map((t) => `<button class="tabbtn ${tab === t ? "active" : ""}" data-ctab="${t}">${t}</button>`).join("")}</div>${body}`;
  }

  function pipeline() {
    const s = S(), u = U();
    const view = window._pipeview || "Kanban";
    const stages = C().pipelineStages;
    const total = stages.map((st) => s.list("leads").filter((l) => l.stage === st).reduce((a, l) => a + (+l.deal_value || 0), 0));
    const exp = s.list("leads").filter((l) => !["Won", "Lost"].includes(l.stage)).reduce((a, l) => a + (+l.deal_value || 0) * (+l.probability || 0) / 100, 0);
    const cols = view === "Kanban" ? `<div class="flex gap-3 overflow-x-auto pb-4">${stages.map((st) => { const items = s.list("leads").filter((l) => l.stage === st); return `
      <div class="kanban-col p-2.5 w-[260px] flex-shrink-0"><div class="px-1.5 py-1 mb-2"><div class="text-[.7rem] font-bold uppercase tracking-wide text-zinc-500">${st}</div><div class="text-[.68rem] text-zinc-400 font-num">${items.length} · ${u.money(items.reduce((a, l) => a + (+l.deal_value || 0), 0))}</div></div>
      <div class="space-y-2 min-h-[60px]" data-drop-lead="${st}">${items.map((l) => `
        <div class="kanban-card" draggable="true" data-lead="${l.id}" data-drag-lead="${l.id}">
          <div class="text-[.8rem] font-bold">${u.esc(l.company)}</div><div class="text-[.7rem] text-zinc-500">${u.esc(l.contact_person || "")} · ${u.esc(l.service_interest || "")}</div>
          <div class="flex items-center gap-2 mt-2"><span class="font-num font-extrabold text-[.82rem]">${u.money(l.deal_value)}</span><span class="chip font-num">${l.probability}%</span>${l.next_follow_up && l.next_follow_up <= s.today() ? `<span class="chip" style="color:#DC2626;border-color:#DC262633">follow up</span>` : ""}</div>
        </div>`).join("")}</div></div>`; }).join("")}</div>`
      : `<div class="card overflow-hidden"><table class="tbl w-full min-w-[900px]"><thead><tr><th>Company</th><th>Service</th><th>Stage</th><th>Value</th><th>Prob.</th><th>Expected</th><th>Follow-up</th><th>Owner</th></tr></thead><tbody>
        ${s.list("leads").map((l) => `<tr class="cursor-pointer" data-lead="${l.id}"><td class="font-semibold">${u.esc(l.company)}<div class="text-[.68rem] font-normal text-zinc-400">${u.esc(l.contact_person || "")}</div></td><td class="text-[.78rem]">${u.esc(l.service_interest || "—")}</td><td>${u.pill(l.stage)}</td><td class="font-num font-bold">${u.money(l.deal_value)}</td><td class="font-num">${l.probability}%</td><td class="font-num" style="color:#FF6600;font-weight:800">${u.money((+l.deal_value || 0) * (+l.probability || 0) / 100)}</td><td class="font-num text-[.78rem]">${u.fmtDate(l.next_follow_up)}</td><td class="text-[.78rem]">${u.esc(l.assigned_to || "—")}</td></tr>`).join("")}</tbody></table></div>`;
    return head("CRM Pipeline", `Expected revenue ${u.money(exp)} · drag cards between stages`, `
      ${["Kanban", "List"].map((v) => `<button class="seg ${view === v ? "active" : ""}" data-pipeview="${v}">${v}</button>`).join("")}
      <button class="btn-a" data-action="new-lead">+ New lead</button>`) + `
    <div class="card p-4 mb-4">${u.bars(total.slice(0, 6), stages.slice(0, 6).map((x) => x.split(" ")[0]))}</div>` + cols;
  }

  function leads() {
    const s = S(), u = U();
    return head("Leads", `${s.list("leads").filter((l) => !["Won", "Lost"].includes(l.stage)).length} open leads`, `<button class="btn-a" data-action="new-lead">+ New lead</button>`) + `
    <div class="card overflow-hidden"><table class="tbl w-full min-w-[860px]"><thead><tr><th>Company</th><th>Contact</th><th>Value</th><th>Stage</th><th>Follow-up</th><th></th></tr></thead><tbody>
    ${s.list("leads").map((l) => `<tr class="cursor-pointer" data-lead="${l.id}"><td class="font-semibold">${u.esc(l.company)}</td><td class="text-[.78rem] text-zinc-500">${u.esc(l.contact_person || "")}<br/>${u.esc(l.email || "")}</td><td class="font-num font-bold">${u.money(l.deal_value)}</td><td>${u.pill(l.stage)}</td><td class="font-num text-[.78rem]">${u.fmtDate(l.next_follow_up)}</td><td><button class="btn-g !px-2 !py-1" data-convert="${l.id}">Convert</button></td></tr>`).join("")}</tbody></table></div>`;
  }

  /* ---------------- FINANCE ---------------- */
  function finOverview() {
    const s = S(), u = U();
    const fin = s.financeTotals();
    const tx = s.list("transactions");
    const rev = tx.filter((t) => t.type === "Income").slice(0, 6);
    const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); return d.toISOString().slice(0, 7); });
    const revByMonth = months.map((m) => tx.filter((t) => t.type === "Income" && (t.date || "").slice(0, 7) === m).reduce((a, t) => a + (+t.amount || 0), 0));
    const mLabels = months.map((m) => new Date(m + "-02T12:00:00").toLocaleString("en-US", { month: "short" }));
    const catTotals = {};
    tx.filter((t) => t.type === "Income").forEach((t) => { catTotals[t.category || "Other"] = (catTotals[t.category || "Other"] || 0) + (+t.amount || 0); });
    const cats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return head("Financial Overview", "Revenue, expenses, profit and receivables.", `
      ${["This week", "This month", "This quarter", "This year"].map((r, i) => `<button class="seg ${i === 1 ? "active" : ""}">${r}</button>`).join("")}
      <button class="btn-a" data-action="new-transaction">+ Transaction</button>`) + `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      ${kpi("Revenue", u.money(fin.revenue), "all recorded", trend(fin.revenue), true)}
      ${kpi("Expenses", u.money(fin.expenses), "all recorded", trend(fin.expenses))}
      ${kpi("Net profit", u.money(fin.profit), Math.round((fin.profit / (fin.revenue || 1)) * 100) + "% margin", trend(fin.profit), true)}
      ${kpi("Receivable", u.money(fin.outstanding), s.list("invoices").filter((i) => i.status === "Overdue").length + " overdue")}
    </div>
    <div class="grid lg:grid-cols-3 gap-4">
      <div class="card p-5 lg:col-span-2"><div class="font-bold text-[.85rem] mb-3">Monthly trend</div>${revByMonth.some((v) => v > 0) ? u.bars(revByMonth, mLabels) : u.empty("No revenue yet.", "Income this half-year will appear here.")}</div>
      <div class="card p-5"><div class="font-bold text-[.85rem] mb-3">Revenue split</div>${cats.length ? u.donut(cats.map((c, i) => ({ value: c[1], color: ["#FF6600", "#111113", "#A1A1AA"][i], label: c[0] }))) : u.empty("Nothing to split yet.")}</div>
    </div>
    <div class="card p-4 mb-4"><div class="flex items-center justify-between mb-3"><span class="font-bold text-[.85rem]">Where the money sits</span><a href="#/accounts" class="text-[.75rem] font-semibold text-zinc-500 hover:text-black">Manage accounts →</a></div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">${s.list("accounts").filter((a) => a.is_active).map((a) => `<a href="#/accounts" class="rounded-xl border border-[#EFEFED] bg-[#FAFAF9] p-4 hover:border-zinc-900 transition"><div class="kpi-label">${u.esc(a.name)}</div><div class="text-[1.3rem] font-extrabold font-num mt-0.5">${u.moneyC(a.balance, a.currency)}</div><div class="text-[.68rem] text-zinc-400 font-num">${u.esc(a.type)} · ${u.esc(a.currency)}</div></a>`).join("") || `<div class="sm:col-span-3">${u.empty("No payment accounts yet.", "", `<button class="btn-a" data-action="new-account">+ Add account (BCA / PayPal)</button>`)}</div>`}</div></div>
    <div class="card overflow-hidden mt-4"><div class="card-h"><span class="font-bold text-[.85rem]">Recent transactions</span><a href="#/transactions" class="text-[.75rem] font-semibold text-zinc-500">View all →</a></div>
    <table class="tbl w-full"><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Client</th><th>Amount</th></tr></thead><tbody>
    ${rev.map((t) => `<tr><td class="font-num">${u.fmtDate(t.date)}</td><td>${u.pill(t.type === "Income" ? "Paid" : "Draft")}</td><td class="text-zinc-500">${u.esc(t.category || "")}</td><td class="text-zinc-500">${u.esc(s.clientName(t.client_id))}</td><td class="font-num font-bold" style="color:${t.type === "Income" ? "#16A34A" : "#111113"}">${t.type === "Income" ? "+" : "−"}${u.money(t.amount)}</td></tr>`).join("") || `<tr><td colspan="5">${u.empty("No transactions yet.", "", `<button class="btn-a" data-action="new-transaction">+ Record one</button>`)}</td></tr>`}</tbody></table></div>`;
  }

  function finPlanning() {
    const s = S(), u = U();
    const plan = s.list("plans")[0] || {};
    const fin = s.financeTotals();
    const expTx = s.list("transactions").filter((t) => t.type === "Expense");
    const expCol = s.list("expenses");
    const mktActual = expTx.filter((t) => t.category === "Marketing").reduce((a, t) => a + (+t.amount || 0), 0) + expCol.filter((e) => e.category === "Marketing").reduce((a, e) => a + (+e.amount || 0), 0);
    const opsActual = expTx.filter((t) => t.category !== "Marketing").reduce((a, t) => a + (+t.amount || 0), 0) + expCol.filter((e) => e.category !== "Marketing").reduce((a, e) => a + (+e.amount || 0), 0);
    const row = (label, p, a) => { const v = a - p; return `<tr><td class="font-semibold">${label}</td><td class="font-num">${u.money(p)}</td><td class="font-num">${u.money(a)}</td><td class="font-num font-bold" style="color:${v >= 0 ? "#16A34A" : "#DC2626"}">${v >= 0 ? "+" : ""}${u.money(v)}</td></tr>`; };
    return head("Finance Planning", "Planned vs actual · " + (plan.month || "").slice(0, 7), `<button class="btn-a" data-action="new-transaction">+ Transaction</button>`) + `
    <div class="grid md:grid-cols-3 gap-3 mb-4">${kpi("Revenue target", u.money(plan.revenue_target), "planned")}${kpi("Actual revenue", u.money(fin.revenue), "recorded")}${kpi("Variance", u.money(fin.revenue - (plan.revenue_target || 0)), "actual − planned")}</div>
    <div class="card overflow-hidden"><table class="tbl w-full"><thead><tr><th>Line</th><th>Planned</th><th>Actual</th><th>Variance</th></tr></thead><tbody>
    ${row("Revenue", plan.revenue_target, fin.revenue)}${row("Expenses", plan.expense_budget, fin.expenses)}${row("Marketing", plan.marketing_budget, mktActual)}${row("Operations", plan.ops_budget, opsActual)}
    </tbody></table></div>`;
  }

  function transactions() {
    const s = S(), u = U();
    return head("Transactions", `${s.list("transactions").length} records`, `<button class="btn-a" data-action="new-transaction">+ New transaction</button>`) + `
    <div class="card overflow-hidden"><div class="overflow-x-auto"><table class="tbl w-full min-w-[840px]"><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Client / Project</th><th>Method</th><th class="!text-right">Amount</th><th></th></tr></thead><tbody>
    ${s.list("transactions").map((t) => `<tr><td class="font-num">${u.fmtDate(t.date)}</td><td>${u.pill(t.type === "Income" ? "Paid" : t.type === "Expense" ? "Draft" : "Viewed")}<span class="text-[.7rem] text-zinc-400 ml-1">${t.type}</span></td><td class="text-zinc-500 text-[.78rem]">${u.esc(t.category || "")}</td><td class="text-[.78rem]">${t.bill_id ? `<span class="font-semibold">${u.esc(s.supplierName(s.get("bills", t.bill_id)?.supplier_id))}</span><div class="text-[.68rem] text-zinc-400">bill ${u.esc(t.reference || "")}</div>` : `${u.esc(s.clientName(t.client_id))}<div class="text-[.68rem] text-zinc-400">${u.esc(s.projectName(t.project_id))}</div>`}</td><td class="text-[.78rem] text-zinc-500">${u.esc(t.payment_method || "—")}${t.account_id ? `<div class="text-[.68rem] font-semibold" style="color:#0EA5A0">→ ${u.esc(s.accountName(t.account_id))}</div>` : ""}</td><td class="font-num font-bold !text-right" style="color:${t.type === "Income" ? "#16A34A" : "#111113"}">${t.type === "Income" ? "+" : "−"}${u.money(t.amount)}</td><td><button class="btn-g !px-2 !py-1" data-del-tx="${t.id}">Delete</button></td></tr>`).join("")}
    </tbody></table></div></div>`;
  }

  function invoices() {
    const s = S(), u = U();
    const total = s.list("invoices").reduce((a, i) => a + (+i.total || 0), 0);
    const paid = s.list("invoices").reduce((a, i) => a + (+i.amount_paid || 0), 0);
    return head("Invoices", `${u.money(total)} billed · ${u.money(total - paid)} outstanding`, `<button class="btn-a" data-action="new-invoice">+ New invoice</button>`) + `
    <div class="card overflow-hidden"><div class="overflow-x-auto"><table class="tbl w-full min-w-[880px]"><thead><tr><th>Number</th><th>Client</th><th>Issue</th><th>Due</th><th class="!text-right">Total</th><th>Status</th><th></th></tr></thead><tbody>
    ${s.list("invoices").map((i) => { const so = i.sales_order_id ? s.get("salesOrders", i.sales_order_id) : s.soByInvoice(i.id); return `<tr class="cursor-pointer" data-invoice="${i.id}"><td class="font-num font-bold">${u.esc(i.number)}${so ? `<div class="text-[.66rem] font-semibold" style="color:#7C3AED">${u.esc(so.number)}</div>` : ""}</td><td>${u.esc(s.clientName(i.client_id))}</td><td class="font-num text-[.78rem]">${u.fmtDate(i.issue_date)}</td><td class="font-num text-[.78rem] ${s.isOverdue(i.due_date) && !["Paid", "Cancelled"].includes(i.status) ? "text-red-600 font-bold" : ""}">${u.fmtDate(i.due_date)}</td><td class="font-num font-bold !text-right">${u.money(i.total)}${+i.amount_paid ? `<div class="text-[.66rem] font-medium" style="color:#16A34A">paid ${u.money(i.amount_paid)}</div>` : ""}</td><td>${u.pill(i.status)}</td><td class="whitespace-nowrap" onclick="event.stopPropagation()"><button class="btn-g !px-2 !py-1" data-print-inv="${i.id}">⎙ Print</button> <button class="btn-g !px-2 !py-1" data-del-inv="${i.id}">Delete</button></td></tr>`; }).join("")}
    </tbody></table></div></div>`;
  }

  function expenses() {
    const s = S(), u = U();
    const byCat = {};
    s.list("expenses").forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + (+e.amount || 0); });
    return head("Expenses", `${u.money(s.list("expenses").reduce((a, e) => a + (+e.amount || 0), 0))} tracked`, `<button class="btn-a" data-action="new-expense">+ New expense</button>`) + `
    <div class="card p-5 mb-4"><div class="font-bold text-[.85rem] mb-3">Breakdown</div>${u.bars(Object.values(byCat), Object.keys(byCat).map((x) => x.slice(0, 4)))}</div>
    <div class="card overflow-hidden"><table class="tbl w-full"><thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Project</th><th class="!text-right">Amount</th><th>Status</th><th></th></tr></thead><tbody>
    ${s.list("expenses").map((e) => `<tr><td class="font-num">${u.fmtDate(e.date)}</td><td>${u.pill(e.status === "Approved" ? "Paid" : "Draft")} <span class="text-[.72rem] text-zinc-500">${u.esc(e.category)}</span></td><td>${u.esc(e.vendor || "—")}</td><td class="text-[.78rem] text-zinc-500">${u.esc(s.projectName(e.project_id))}</td><td class="font-num font-bold !text-right">${u.money(e.amount)}</td><td class="text-[.76rem]">${u.esc(e.status)}</td><td><button class="btn-g !px-2 !py-1" data-del-exp="${e.id}">Delete</button></td></tr>`).join("")}
    </tbody></table></div>`;
  }

  /* ---------------- SALES ORDERS ---------------- */
  function salesOrders() {
    const s = S(), u = U();
    const rows = s.list("salesOrders");
    const open = rows.filter((o) => ["Draft", "Confirmed"].includes(o.status)).reduce((a, o) => a + (+o.total || 0), 0);
    return head("Sales Orders", `${rows.length} orders · ${u.money(open)} open — confirming an order auto-creates its invoice`, `<button class="btn-a" data-action="new-sales-order">+ New sales order</button>`) + `
    <div class="card overflow-hidden"><div class="overflow-x-auto"><table class="tbl w-full min-w-[880px]"><thead><tr><th>Number</th><th>Client</th><th>Issue</th><th>Due</th><th class="!text-right">Total</th><th>Status</th><th>Invoice</th><th></th></tr></thead><tbody>
    ${rows.map((o) => { const inv = o.invoice_id ? s.get("invoices", o.invoice_id) : null; return `<tr class="cursor-pointer" data-so="${o.id}">
      <td class="font-num font-bold">${u.esc(o.number)}</td><td>${u.esc(s.clientName(o.client_id))}<div class="text-[.68rem] text-zinc-400">${u.esc(s.projectName(o.project_id))}</div></td>
      <td class="font-num text-[.78rem]">${u.fmtDate(o.issue_date)}</td><td class="font-num text-[.78rem]">${u.fmtDate(o.due_date)}</td>
      <td class="font-num font-bold !text-right">${u.moneyC(o.total, o.currency)}</td><td>${u.pill(o.status)}</td>
      <td class="font-num text-[.78rem]">${inv ? `<span class="font-semibold" style="color:#7C3AED">${u.esc(inv.number)}</span>` : `<span class="text-zinc-300">—</span>`}</td>
      <td class="whitespace-nowrap" onclick="event.stopPropagation()"><button class="btn-g !px-2 !py-1" data-print-so="${o.id}">⎙ Print</button></td></tr>`; }).join("") || `<tr><td colspan="8">${u.empty("No sales orders yet.", "Create one — the invoice follows automatically.")}</td></tr>`}
    </tbody></table></div></div>`;
  }

  /* ---------------- PAYMENT ACCOUNTS ---------------- */
  function accounts() {
    const s = S(), u = U();
    const accs = s.list("accounts");
    const incomeFor = (id) => s.list("transactions").filter((t) => t.type === "Income" && t.account_id === id).slice(0, 5);
    return head("Payment Accounts", "Where income lands — BCA, PayPal, cash. Pick one on every payment.", `<button class="btn-a" data-action="new-account">+ New account</button>`) + `
    <div class="grid md:grid-cols-3 gap-4 mb-4">
      ${accs.map((a) => `<div class="card p-5 fade-up ${a.is_active ? "" : "opacity-55"}">
        <div class="flex items-center gap-2 mb-1"><span class="chip font-num">${u.esc(a.type)} · ${u.esc(a.currency)}</span>${a.is_active ? "" : u.pill("Draft")}<span class="ml-auto flex gap-1"><button class="btn-g !px-2 !py-1" data-edit-acc="${a.id}">Edit</button></span></div>
        <div class="font-extrabold tracking-tight text-[1.02rem]">${u.esc(a.name)}</div>
        <div class="text-[.72rem] text-zinc-400 font-num">${u.esc(a.account_no || "")} · ${u.esc(a.holder || "")}</div>
        <div class="text-[1.5rem] font-extrabold font-num mt-2">${u.moneyC(a.balance, a.currency)}</div>
        <div class="text-[.7rem] text-zinc-400">collected balance</div>
        <div class="mt-3 pt-3 border-t border-[#F4F4F2] space-y-1.5">
          ${incomeFor(a.id).map((t) => `<div class="flex text-[.74rem]"><span class="font-num text-zinc-400">${u.fmtDate(t.date)}</span><span class="ml-2 truncate">${u.esc(t.reference || "")}</span><b class="ml-auto font-num" style="color:#16A34A">+${u.moneyC(t.amount, t.currency || a.currency)}</b></div>`).join("") || `<p class="text-[.72rem] text-zinc-400">No income recorded here yet.</p>`}
        </div></div>`).join("")}
    </div>
    <div class="card overflow-hidden"><div class="card-h"><span class="font-bold text-[.85rem]">All income by destination</span></div>
    <table class="tbl w-full"><thead><tr><th>Date</th><th>Reference</th><th>Method</th><th>Destination</th><th class="!text-right">Amount</th></tr></thead><tbody>
    ${s.list("transactions").filter((t) => t.type === "Income").map((t) => { const a = s.get("accounts", t.account_id); return `<tr><td class="font-num">${u.fmtDate(t.date)}</td><td class="font-semibold">${u.esc(t.reference || "—")}</td><td class="text-[.78rem] text-zinc-500">${u.esc(t.payment_method || "—")}</td><td class="text-[.78rem]">${a ? `<b>${u.esc(a.name)}</b> <span class="text-zinc-400 font-num">${u.esc(a.currency)}</span>` : `<span class="text-zinc-300">unassigned</span>`}</td><td class="font-num font-bold !text-right" style="color:#16A34A">+${u.moneyC(t.amount, t.currency || a?.currency || "USD")}</td></tr>`; }).join("")}
    </tbody></table></div>`;
  }

  /* ---------------- PRINTABLE DOCUMENTS (offline-safe, inline styles) ---------------- */
  function docShell(title, paperHTML, toolbarHTML) {
    return `<div class="no-print flex flex-wrap items-center gap-2 mb-4 fade-up">
      <button class="btn-g" data-action="back">← Back</button>
      <span class="text-[.78rem] text-zinc-500 ml-1">Print works offline — choose <b>Save as PDF</b> as the printer destination.</span>
      <span class="ml-auto flex gap-2">${toolbarHTML || ""}<button class="btn-a" data-action="print-now">⎙ Print / Save PDF</button></span>
    </div>
    <div id="print-paper" style="background:#fff;border:1px solid #E8E8E6;border-radius:12px;max-width:800px;margin:0 auto;padding:48px 52px;color:#111113;">${paperHTML}</div>`;
  }
  function docHead(kind, number, status, statusColor) {
    const e = U().esc;
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
      <div><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="display:inline-flex;align-items:flex-end;gap:3px;"><span style="width:9px;height:9px;border-radius:99px;background:#FF6600;display:inline-block;"></span><span style="width:13px;height:13px;border-radius:99px;background:#FF6600;display:inline-block;"></span><span style="width:8px;height:8px;border-radius:99px;background:#FF6600;display:inline-block;"></span></span>
        <b style="font-size:15px;letter-spacing:-.02em;">Signal Society</b></div>
        <div style="font-size:11px;color:#71717A;line-height:1.6;">Internal Business Systems · Jakarta — San Francisco<br/>hello@signalsociety.com</div></div>
      <div style="text-align:right;"><div style="font-size:26px;font-weight:800;letter-spacing:-.03em;">${e(kind)}</div>
        <div style="font-size:13px;font-weight:700;margin-top:2px;">${e(number)}</div>
        <div style="display:inline-block;font-size:11px;font-weight:700;color:${statusColor};border:1.5px solid ${statusColor};border-radius:99px;padding:2px 12px;margin-top:6px;">${e(status)}</div></div>
    </div>`;
  }
  function docMeta(rows) {
    const e = U().esc;
    return `<div style="display:flex;gap:32px;flex-wrap:wrap;font-size:12px;margin-bottom:24px;">${rows.map((r) => `<div><div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:#8E8E93;margin-bottom:3px;">${e(r[0]).toUpperCase()}</div><div style="font-weight:600;">${e(r[1])}</div></div>`).join("")}</div>`;
  }
  function docBill(client, extra) {
    const s = S(), e = U().esc;
    const c = s.get("clients", client) || {};
    return `<div style="display:flex;gap:32px;margin-bottom:24px;"><div style="flex:1;"><div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:#8E8E93;margin-bottom:4px;">BILL TO</div>
      <div style="font-size:14px;font-weight:800;">${e(c.company_name || "—")}</div>
      <div style="font-size:12px;color:#3A3A3E;">${e(c.contact_person || "")}${c.email ? " · " + e(c.email) : ""}${c.phone ? "<br/>" + e(c.phone) : ""}${c.address ? "<br/>" + e(c.address) : ""}</div></div>
      ${extra || ""}</div>`;
  }
  function docItems(items, currency, u) {
    return `<table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:20px;">
      <thead><tr style="border-bottom:2px solid #111113;"><th style="text-align:left;padding:8px 4px;font-size:10px;letter-spacing:.08em;">DESCRIPTION</th><th style="text-align:right;padding:8px 4px;font-size:10px;letter-spacing:.08em;">QTY</th><th style="text-align:right;padding:8px 4px;font-size:10px;letter-spacing:.08em;">UNIT PRICE</th><th style="text-align:right;padding:8px 4px;font-size:10px;letter-spacing:.08em;">AMOUNT</th></tr></thead>
      <tbody>${(items || []).map((it) => `<tr style="border-bottom:1px solid #EFEFED;"><td style="padding:9px 4px;">${u.esc(it.description)}</td><td style="padding:9px 4px;text-align:right;">${u.esc(String(it.qty ?? ""))}</td><td style="padding:9px 4px;text-align:right;">${u.moneyC(it.unit_price, currency)}</td><td style="padding:9px 4px;text-align:right;font-weight:700;">${u.moneyC(it.amount ?? (it.qty * it.unit_price), currency)}</td></tr>`).join("")}</tbody></table>`;
  }
  function docTotals(doc, currency, u, paidLine) {
    const bal = (+doc.total || 0) - (+doc.amount_paid || 0);
    return `<div style="display:flex;justify-content:flex-end;margin-bottom:24px;"><div style="width:250px;font-size:12.5px;">
      <div style="display:flex;justify-content:space-between;padding:4px 0;color:#52525B;"><span>Subtotal</span><span>${u.moneyC(doc.subtotal, currency)}</span></div>
      ${+doc.discount ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#52525B;"><span>Discount</span><span>−${u.moneyC(doc.discount, currency)}</span></div>` : ""}
      ${+doc.tax ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#52525B;"><span>Tax</span><span>${u.moneyC(doc.tax, currency)}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #111113;font-size:15px;font-weight:800;"><span>Total</span><span>${u.moneyC(doc.total, currency)}</span></div>
      ${paidLine ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#52525B;"><span>Paid</span><span>${u.moneyC(doc.amount_paid, currency)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#FFF1E8;border-radius:8px;font-weight:800;color:#9A3B00;margin-top:4px;"><span>Balance due</span><span>${u.moneyC(bal, currency)}</span></div>` : ""}
    </div></div>`;
  }
  function docPayTo(u) {
    const accs = S().list("accounts").filter((a) => a.is_active);
    if (!accs.length) return "";
    return `<div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:#8E8E93;margin-bottom:6px;">PAY TO</div>
      <div style="font-size:12px;margin-bottom:24px;line-height:1.8;">${accs.map((a) => `<b>${u.esc(a.name)}</b> <span style="color:#71717A;">${u.esc(a.account_no || "")} · ${u.esc(a.currency)}</span>`).join("<br/>")}</div>`;
  }
  function docSign(left, right) {
    const e = U().esc;
    return `<div style="display:flex;gap:48px;margin-top:36px;font-size:12px;">
      <div style="flex:1;"><div style="border-top:1.5px solid #111113;padding-top:6px;font-weight:700;">${e(left)}</div><div style="color:#8E8E93;font-size:11px;">Signal Society</div></div>
      <div style="flex:1;"><div style="border-top:1.5px solid #111113;padding-top:6px;font-weight:700;">${e(right)}</div><div style="color:#8E8E93;font-size:11px;">Date &amp; signature</div></div></div>
    <div style="margin-top:28px;padding-top:12px;border-top:1px solid #EFEFED;font-size:10.5px;color:#A1A1AA;text-align:center;">Generated by Signal System · Signal Society — turns scattered business activity into one clear operational signal.</div>`;
  }

  function invoicePrint(id) {
    const s = S(), u = U();
    const i = s.get("invoices", id);
    if (!i) return head("Invoice not found", "", `<a href="#/invoices" class="btn-g">← Back</a>`);
    const so = i.sales_order_id ? s.get("salesOrders", i.sales_order_id) : s.soByInvoice(i.id);
    const stColor = { Draft: "#71717A", Sent: "#2563EB", Viewed: "#0EA5A0", "Partially Paid": "#D97706", Paid: "#16A34A", Overdue: "#DC2626", Cancelled: "#A1A1AA" }[i.status] || "#52525B";
    const cur = i.currency || "USD";
    const paper = docHead("INVOICE", i.number, i.status.toUpperCase(), stColor)
      + docMeta([["Issue date", u.fmtDate(i.issue_date)], ["Due date", u.fmtDate(i.due_date)], ["Sales order", so ? so.number : "—"], ["Project", s.projectName(i.project_id)], ["Currency", cur]])
      + docBill(i.client_id)
      + docItems(i.items, cur, u)
      + docTotals(i, cur, u, true)
      + docPayTo(u)
      + (i.notes ? `<div style="font-size:12px;color:#52525B;margin-bottom:8px;"><b>Notes — </b>${u.esc(i.notes)}</div>` : "")
      + docSign("Sissy · Finance", (s.get("clients", i.client_id) || {}).contact_person || "Client");
    return docShell("Invoice " + i.number, paper,
      `<button class="btn-g" data-receive="${i.id}">+ Receive payment</button><a class="btn-g" href="#/invoices">All invoices</a>`);
  }

  function soPrint(id) {
    const s = S(), u = U();
    const o = s.get("salesOrders", id);
    if (!o) return head("Sales order not found", "", `<a href="#/sales-orders" class="btn-g">← Back</a>`);
    const inv = o.invoice_id ? s.get("invoices", o.invoice_id) : null;
    const stColor = { Draft: "#71717A", Confirmed: "#2563EB", Invoiced: "#7C3AED", Completed: "#16A34A", Cancelled: "#A1A1AA" }[o.status] || "#52525B";
    const cur = o.currency || "USD";
    const paper = docHead("SALES ORDER", o.number, o.status.toUpperCase(), stColor)
      + docMeta([["Issue date", u.fmtDate(o.issue_date)], ["Valid until", u.fmtDate(o.due_date)], ["Invoice", inv ? inv.number + " (" + inv.status + ")" : "auto-created on confirm"], ["Project", s.projectName(o.project_id)], ["Currency", cur]])
      + docBill(o.client_id)
      + docItems(o.items, cur, u)
      + docTotals(o, cur, u, false)
      + (o.notes ? `<div style="font-size:12px;color:#52525B;margin-bottom:8px;"><b>Terms — </b>${u.esc(o.notes)}</div>` : `<div style="font-size:12px;color:#52525B;margin-bottom:8px;"><b>Terms — </b>Valid 30 days. Confirming this order automatically issues the invoice.</div>`)
      + docSign("Sissy · Operations", (s.get("clients", o.client_id) || {}).contact_person || "Client");
    return docShell("Sales Order " + o.number, paper,
      `${inv ? `<a class="btn-g" href="#/print/invoice/${inv.id}">View invoice →</a>` : `<button class="btn-p" data-so-invoice="${o.id}">Create invoice now</button>`}<a class="btn-g" href="#/sales-orders">All orders</a>`);
  }

  /* ---------------- PURCHASE ---------------- */
  function suppliers() {
    const s = S(), u = U();
    return head("Suppliers", `${s.list("suppliers").length} vendors`, `<button class="btn-a" data-action="new-supplier">+ New supplier</button>`) + `
    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      ${s.list("suppliers").map((v) => {
        const pos = s.list("purchaseOrders").filter((p) => p.supplier_id === v.id);
        const bls = s.list("bills").filter((b) => b.supplier_id === v.id);
        const owed = bls.filter((b) => !["Paid", "Cancelled", "Draft"].includes(b.status)).reduce((a, b) => a + ((+b.total || 0) - (+b.amount_paid || 0)), 0);
        return `<div class="card p-5 fade-up">
        <div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-[#111113] text-white flex items-center justify-center font-extrabold text-[.8rem]">${u.initials(v.name)}</div>
        <div class="flex-1"><div class="font-extrabold tracking-tight">${u.esc(v.name)}</div><div class="text-[.72rem] text-zinc-400">${u.esc(v.contact_person || "")} · ${u.esc(v.email || "")}</div></div>
        <button class="btn-g !px-2 !py-1" data-edit-sup="${v.id}">Edit</button></div>
        <div class="grid grid-cols-3 gap-2 mt-4 text-center">
          <div class="rounded-lg bg-[#FAFAF9] border border-[#F1F1EF] p-2.5"><div class="kpi-label">Orders</div><div class="font-extrabold font-num">${pos.length}</div></div>
          <div class="rounded-lg bg-[#FAFAF9] border border-[#F1F1EF] p-2.5"><div class="kpi-label">Bills</div><div class="font-extrabold font-num">${bls.length}</div></div>
          <div class="rounded-lg bg-[#FFF1E8] p-2.5"><div class="kpi-label">Owed</div><div class="font-extrabold font-num" style="color:#9A3B00">${u.money(owed)}</div></div>
        </div></div>`; }).join("")}
    </div>`;
  }

  function purchaseOrders() {
    const s = S(), u = U();
    const rows = s.list("purchaseOrders");
    const open = rows.filter((o) => ["Draft", "Confirmed"].includes(o.status)).reduce((a, o) => a + (+o.total || 0), 0);
    return head("Purchase Orders", `${rows.length} orders · confirming an order auto-creates its bill`, `<button class="btn-a" data-action="new-purchase-order">+ New purchase order</button>`) + `
    <div class="card overflow-hidden"><div class="overflow-x-auto"><table class="tbl w-full min-w-[880px]"><thead><tr><th>Number</th><th>Supplier</th><th>Issue</th><th>Due</th><th class="!text-right">Total</th><th>Status</th><th>Bill</th><th></th></tr></thead><tbody>
    ${rows.map((o) => { const b = o.bill_id ? s.get("bills", o.bill_id) : s.billByPO(o.id); return `<tr class="cursor-pointer" data-po="${o.id}">
      <td class="font-num font-bold">${u.esc(o.number)}</td><td>${u.esc(s.supplierName(o.supplier_id))}<div class="text-[.68rem] text-zinc-400">${u.esc(s.projectName(o.project_id))}</div></td>
      <td class="font-num text-[.78rem]">${u.fmtDate(o.issue_date)}</td><td class="font-num text-[.78rem]">${u.fmtDate(o.due_date)}</td>
      <td class="font-num font-bold !text-right">${u.moneyC(o.total, o.currency)}</td><td>${u.pill(o.status)}</td>
      <td class="font-num text-[.78rem]">${b ? `<span class="font-semibold" style="color:#7C3AED">${u.esc(b.number)}</span>` : `<span class="text-zinc-300">—</span>`}</td>
      <td class="whitespace-nowrap" onclick="event.stopPropagation()"><button class="btn-g !px-2 !py-1" data-print-po="${o.id}">⎙ Print</button></td></tr>`; }).join("") || `<tr><td colspan="8">${u.empty("No purchase orders yet.", "Create one — the bill follows automatically.")}</td></tr>`}
    </tbody></table></div></div>`;
  }

  function bills() {
    const s = S(), u = U();
    const rows = s.list("bills");
    const owed = rows.filter((b) => !["Paid", "Cancelled", "Draft"].includes(b.status)).reduce((a, b) => a + ((+b.total || 0) - (+b.amount_paid || 0)), 0);
    return head("Bills", `${u.money(owed)} owed to suppliers`, `<button class="btn-a" data-action="new-bill">+ New bill</button>`) + `
    <div class="card overflow-hidden"><div class="overflow-x-auto"><table class="tbl w-full min-w-[880px]"><thead><tr><th>Number</th><th>Supplier</th><th>Issue</th><th>Due</th><th class="!text-right">Total</th><th>Status</th><th></th></tr></thead><tbody>
    ${rows.map((b) => { const po = b.purchase_order_id ? s.get("purchaseOrders", b.purchase_order_id) : null; return `<tr class="cursor-pointer" data-bill="${b.id}">
      <td class="font-num font-bold">${u.esc(b.number)}${po ? `<div class="text-[.66rem] font-semibold" style="color:#7C3AED">${u.esc(po.number)}</div>` : ""}</td>
      <td>${u.esc(s.supplierName(b.supplier_id))}</td>
      <td class="font-num text-[.78rem]">${u.fmtDate(b.issue_date)}</td>
      <td class="font-num text-[.78rem] ${s.isOverdue(b.due_date) && !["Paid", "Cancelled"].includes(b.status) ? "text-red-600 font-bold" : ""}">${u.fmtDate(b.due_date)}</td>
      <td class="font-num font-bold !text-right">${u.moneyC(b.total, b.currency)}${+b.amount_paid ? `<div class="text-[.66rem] font-medium" style="color:#16A34A">paid ${u.moneyC(b.amount_paid, b.currency)}</div>` : ""}</td>
      <td>${u.pill(b.status)}</td>
      <td class="whitespace-nowrap" onclick="event.stopPropagation()"><button class="btn-g !px-2 !py-1" data-paybill="${b.id}">Pay</button> <button class="btn-g !px-2 !py-1" data-print-bill="${b.id}">⎙ Print</button> <button class="btn-g !px-2 !py-1" data-del-bill="${b.id}">Delete</button></td></tr>`; }).join("")}
    </tbody></table></div></div>`;
  }

  function docSupplier(supplierId) {
    const s = S(), e = U().esc;
    const v = s.get("suppliers", supplierId) || {};
    return `<div style="margin-bottom:24px;"><div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:#8E8E93;margin-bottom:4px;">BILL FROM (SUPPLIER)</div>
      <div style="font-size:14px;font-weight:800;">${e(v.name || "—")}</div>
      <div style="font-size:12px;color:#3A3A3E;">${e(v.contact_person || "")}${v.email ? " · " + e(v.email) : ""}${v.phone ? "<br/>" + e(v.phone) : ""}${v.address ? "<br/>" + e(v.address) : ""}</div></div>`;
  }
  function docPayFrom(u) {
    const accs = S().list("accounts").filter((a) => a.is_active);
    if (!accs.length) return "";
    return `<div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:#8E8E93;margin-bottom:6px;">PAY FROM (OUR ACCOUNT)</div>
      <div style="font-size:12px;margin-bottom:24px;line-height:1.8;">${accs.map((a) => `<b>${u.esc(a.name)}</b> <span style="color:#71717A;">${u.esc(a.account_no || "")} · ${u.esc(a.currency)}</span>`).join("<br/>")}</div>`;
  }

  function poPrint(id) {
    const s = S(), u = U();
    const o = s.get("purchaseOrders", id);
    if (!o) return head("Purchase order not found", "", `<a href="#/purchase-orders" class="btn-g">← Back</a>`);
    const bill = o.bill_id ? s.get("bills", o.bill_id) : s.billByPO(o.id);
    const stColor = { Draft: "#71717A", Confirmed: "#2563EB", Billed: "#7C3AED", Completed: "#16A34A", Cancelled: "#A1A1AA" }[o.status] || "#52525B";
    const cur = o.currency || "IDR";
    const paper = docHead("PURCHASE ORDER", o.number, o.status.toUpperCase(), stColor)
      + docMeta([["Issue date", u.fmtDate(o.issue_date)], ["Valid until", u.fmtDate(o.due_date)], ["Bill", bill ? bill.number + " (" + bill.status + ")" : "auto-created on confirm"], ["Project", s.projectName(o.project_id)], ["Currency", cur]])
      + docSupplier(o.supplier_id)
      + docItems(o.items, cur, u)
      + docTotals(o, cur, u, false)
      + (o.notes ? `<div style="font-size:12px;color:#52525B;margin-bottom:8px;"><b>Terms — </b>${u.esc(o.notes)}</div>` : `<div style="font-size:12px;color:#52525B;margin-bottom:8px;"><b>Terms — </b>Confirming this order automatically issues the vendor bill.</div>`)
      + docSign("Sissy · Finance", (s.get("suppliers", o.supplier_id) || {}).contact_person || "Supplier");
    return docShell("Purchase Order " + o.number, paper,
      `${bill ? `<a class="btn-g" href="#/print/bill/${bill.id}">View bill →</a>` : `<button class="btn-p" data-po-bill="${o.id}">Create bill now</button>`}<a class="btn-g" href="#/purchase-orders">All orders</a>`);
  }

  function billPrint(id) {
    const s = S(), u = U();
    const b = s.get("bills", id);
    if (!b) return head("Bill not found", "", `<a href="#/bills" class="btn-g">← Back</a>`);
    const po = b.purchase_order_id ? s.get("purchaseOrders", b.purchase_order_id) : null;
    const stColor = { Draft: "#71717A", Unpaid: "#EA580C", "Partially Paid": "#D97706", Paid: "#16A34A", Overdue: "#DC2626", Cancelled: "#A1A1AA" }[b.status] || "#52525B";
    const cur = b.currency || "IDR";
    const paper = docHead("BILL", b.number, b.status.toUpperCase(), stColor)
      + docMeta([["Issue date", u.fmtDate(b.issue_date)], ["Due date", u.fmtDate(b.due_date)], ["Purchase order", po ? po.number : "—"], ["Project", s.projectName(b.project_id)], ["Currency", cur]])
      + docSupplier(b.supplier_id)
      + docItems(b.items, cur, u)
      + docTotals(b, cur, u, true)
      + docPayFrom(u)
      + (b.notes ? `<div style="font-size:12px;color:#52525B;margin-bottom:8px;"><b>Notes — </b>${u.esc(b.notes)}</div>` : "")
      + docSign("Sissy · Finance", (s.get("suppliers", b.supplier_id) || {}).contact_person || "Supplier");
    return docShell("Bill " + b.number, paper,
      `<button class="btn-g" data-paybill="${b.id}">Pay bill</button><a class="btn-g" href="#/bills">All bills</a>`);
  }

  /* ---------------- SERVICES ---------------- */
  function services() {
    const s = S(), u = U();
    return head("Service Catalog", "What Signal Society sells and delivers.", `<button class="btn-a" data-action="new-service">+ New service</button>`) + `
    <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
    ${s.list("services").map((sv) => { const n = s.list("projects").filter((p) => p.service_key === sv.key).length;
      return `<div class="card p-5 fade-up"><div class="flex items-center gap-2 mb-2">${u.svcTag(sv.key)}${sv.is_active ? u.pill("Paid") : u.pill("Draft")}</div>
      <div class="font-extrabold tracking-tight">${u.esc(sv.name)}</div><p class="text-[.76rem] text-zinc-500 mt-1 leading-relaxed">${u.esc(sv.description || "")}</p>
      <div class="text-[.72rem] text-zinc-500 mt-3 font-num">${u.esc(sv.pricing_model || "")} · ~${sv.default_duration_days}d</div>
      <div class="text-[.75rem] font-bold mt-1">${n} project(s)</div></div>`; }).join("")}
    </div>`;
  }
  function templates() {
    const s = S(), u = U();
    return head("Service Templates", "One-click project scaffolding.", `<button class="btn-p" data-action="new-project">+ Use template</button>`) + `
    <div class="grid md:grid-cols-2 gap-4">${s.list("templates").map((t) => `
      <div class="card p-5"><div class="flex items-center justify-between mb-2"><span class="font-extrabold">${u.esc(t.name)}</span><button class="btn-a !py-1.5" data-use-template="${t.id}">Use template</button></div>
      <div class="flex flex-wrap gap-1.5 mt-2">${(t.stages || []).map((st, i) => `<span class="chip"><span class="font-num text-zinc-400">${i + 1}</span> ${u.esc(st.name)}</span>`).join("")}</div></div>`).join("")}</div>`;
  }

  /* ---------------- INSIGHTS ---------------- */
  function analytics() {
    const s = S(), u = U();
    const revByClient = s.list("clients").map((c) => ({ label: c.company_name.split(" ")[0], value: +c.lifetime_value || 0 })).sort((a, b) => b.value - a.value).slice(0, 6);
    const nWon = s.list("leads").filter((l) => l.stage === "Won").length;
    const nLost = s.list("leads").filter((l) => l.stage === "Lost").length;
    const nOpen = s.list("leads").length - nWon - nLost;
    return head("Analytics", "Marketing, project, financial and sales performance.", `
      <button class="seg active">Last 90 days</button><button class="btn-g" data-action="export">Export ↓</button>`) + `
    <div class="grid lg:grid-cols-3 gap-4">
      <div class="card p-5"><div class="font-bold text-[.85rem] mb-1">Revenue by client</div>${revByClient.some((x) => x.value > 0) ? u.bars(revByClient.map((x) => x.value), revByClient.map((x) => x.label)) : u.empty("No revenue yet.", "Record client payments to see this chart.")}</div>
      <div class="card p-5"><div class="font-bold text-[.85rem] mb-1">Project health</div>
        ${["Healthy", "At Risk", "Delayed"].map((hh) => { const n = s.list("projects").filter((p) => s.projectHealth(p) === hh).length; return `<div class="flex items-center gap-2 py-2 border-b border-[#F4F4F2] last:border-0">${healthDot(hh)}<span class="ml-auto font-num font-bold">${n}</span></div>`; }).join("")}
        <div class="font-bold text-[.85rem] mt-4 mb-1">Content funnel</div>
        ${C().contentStatuses.slice(0, 6).map((st) => { const n = s.list("content").filter((c) => c.status === st).length; return `<div class="flex items-center gap-2 text-[.78rem] py-1"><span class="w-28 text-zinc-500">${st}</span><div class="prog flex-1"><div style="width:${Math.min(100, n * 25)}%"></div></div><span class="font-num font-bold">${n}</span></div>`; }).join("")}</div>
      <div class="card p-5"><div class="font-bold text-[.85rem] mb-3">Pipeline conversion</div>${(nWon + nOpen + nLost) ? u.donut([{ value: nWon, color: "#16A34A", label: "Won" }, { value: nOpen, color: "#FF6600", label: "Open" }, { value: nLost, color: "#A1A1AA", label: "Lost" }]) : u.empty("No leads yet.", "Add leads to track conversion.")}
        <div class="text-[.75rem] text-zinc-500 mt-3">Expected revenue <b class="font-num" style="color:#FF6600">${u.money(s.list("leads").filter((l) => !["Won", "Lost"].includes(l.stage)).reduce((a, l) => a + (+l.deal_value || 0) * (+l.probability || 0) / 100, 0))}</b></div></div>
    </div>`;
  }
  function reports() {
    const u = U();
    const reps = [["Monthly Business Report", "Revenue, pipeline, delivery & marketing in one page."], ["Project Performance Report", "Progress, health, budget utilization per project."], ["Client Report", "Lifetime value, projects, invoices per client."], ["Campaign Report", "Spend, content output, KPI per campaign."], ["Financial Report", "P&L, receivables, expense breakdown."], ["Sales Pipeline Report", "Stage distribution, expected revenue, follow-ups."]];
    return head("Reports", "Board-ready summaries. Export to PDF / CSV.", `<button class="btn-g" data-action="export">Export CSV ↓</button>`) + `
    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${reps.map((r) => `<div class="card p-5"><div class="font-extrabold">${r[0]}</div><p class="text-[.78rem] text-zinc-500 mt-1 mb-4">${r[1]}</p><div class="flex gap-2"><button class="btn-p" data-action="export">PDF</button><button class="btn-g" data-action="export">CSV</button></div></div>`).join("")}</div>`;
  }

  /* ---------------- SYSTEM ---------------- */
  function fileList(files, kind, id) {
    const u = U();
    return `<div class="card overflow-hidden"><div class="card-h"><span class="font-bold text-[.85rem]">Files (${files.length})</span><button class="btn-g" data-action="upload" data-kind="${kind || ""}" data-id="${id || ""}">↑ Upload</button></div>
    <table class="tbl w-full"><thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Owner</th><th>Date</th></tr></thead><tbody>
    ${files.map((f) => `<tr><td class="font-semibold">${u.esc(f.name)}</td><td><span class="chip font-num">${u.esc(f.mime_type || "file")}</span></td><td class="font-num text-[.78rem]">${f.size_bytes > 1e6 ? (f.size_bytes / 1e6).toFixed(1) + " MB" : Math.round((f.size_bytes || 0) / 1024) + " KB"}</td><td class="text-[.78rem]">${u.esc(f.owner_name || "—")}</td><td class="font-num text-[.78rem]">${u.fmtDate((f.created_at || "").slice(0, 10))}</td></tr>`).join("") || `<tr><td colspan="5">${u.empty("No files yet.", "Uploads land in Supabase Storage once connected.")}</td></tr>`}</tbody></table></div>`;
  }
  function files() { return head("Files", "Everything, everywhere — linked to clients, projects, campaigns.", `<button class="btn-a" data-action="upload">↑ Upload</button>`) + fileList(S().list("files")); }

  function notesList(notes, kind, id) {
    const u = U();
    return `<div class="card p-5"><div class="flex items-center justify-between mb-3"><span class="font-bold text-[.85rem]">Notes (${notes.length})</span><button class="btn-g" data-action="new-note" data-kind="${kind}" data-id="${id}">+ Note</button></div>
    <div class="space-y-3">${notes.map((n) => `<div class="rounded-lg bg-[#FAFAF9] border border-[#F1F1EF] p-3.5"><div class="text-[.82rem] leading-relaxed">${u.esc(n.body)}</div><div class="text-[.68rem] text-zinc-400 mt-1.5">${u.esc(n.author_name || "")} · ${u.fmtDT(n.created_at)}</div></div>`).join("") || u.empty("No notes yet.")}</div></div>`;
  }

  function activity() {
    const s = S(), u = U();
    return head("Activity", "Every important mutation, auto-logged.", "") + `
    <div class="card p-2">${s.list("activities").slice(0, 40).map((a) => `<div class="flex gap-3 px-4 py-3 border-b border-[#F4F4F2] last:border-0">
      <span class="dot mt-1.5" style="background:#FF6600"></span>
      <div class="text-[.8rem]"><b>${u.esc(a.actor_name)}</b> ${u.esc(a.action)} — <span class="font-semibold">${u.esc(a.entity_label)}</span>
      <div class="text-[.68rem] text-zinc-400">${u.esc(a.entity_kind || "")} · ${u.fmtDT(a.created_at)}</div></div></div>`).join("")}</div>`;
  }

  function settings() {
    const u = U();
    const cfg = window.SignalConfig.supabase;
    return head("Settings", "Workspace, Supabase connection, roles and danger zone.", "") + `
    <div class="grid lg:grid-cols-2 gap-4">
      <div class="card p-5"><div class="font-bold text-[.85rem] mb-3">Workspace</div>
        <label class="lbl">Company</label><input class="inp mb-3" value="Signal Society"/>
        <label class="lbl">Workspace</label><input class="inp mb-3" value="Signal System · Production"/>
        <button class="btn-p" data-action="save-settings">Save Changes</button> <span class="text-[.72rem] text-zinc-400 ml-2" id="save-hint"></span></div>
      <div class="card p-5"><div class="font-bold text-[.85rem] mb-1">Supabase connection</div>
        <p class="text-[.76rem] text-zinc-500 mb-3">Project <b class="font-num">awxxvxlbebwlzgkepdsb</b> terisi otomatis. Tempel <b>anon key</b> (Project Settings → API), Connect, jalankan <b>schema.sql</b> di SQL Editor, lalu <b>Push</b> data lokal sekali.</p>
        <label class="lbl">Supabase URL</label><input id="sb-url" class="inp mb-3 font-num" placeholder="https://xyz.supabase.co" value="${u.esc(cfg.url)}"/>
        <label class="lbl">Anon key</label><input id="sb-key" class="inp mb-3 font-num" placeholder="eyJ…" value="${u.esc(cfg.anonKey)}"/>
        <div class="flex flex-wrap gap-2"><button class="btn-a" data-action="connect-sb">Connect</button><button class="btn-g" data-action="test-sb">Test</button><button class="btn-g" data-action="disconnect-sb">Disconnect</button></div>
        <div class="flex flex-wrap gap-2 mt-2"><button class="btn-p" data-action="push-sb">↑ Push local → Supabase</button><button class="btn-g" data-action="pull-sb">↓ Pull</button></div>
        <div class="text-[.72rem] mt-3 font-semibold" id="sb-status">${window.DB.useRemote() ? (window.DB.migrated() ? `<span class="text-green-600">● Live — synced with Supabase</span>` : `<span style="color:#D97706">● Connected — schema + Push needed</span>`) : (cfg.url ? `<span class="text-zinc-400">○ URL set, key missing</span>` : `<span class="text-zinc-400">○ Local mode — schema ready in /supabase/schema.sql</span>`)}</div></div>
      <div class="card p-5"><div class="font-bold text-[.85rem] mb-3">Roles & permissions</div>
        ${["Admin", "Manager", "Member", "Finance", "Marketing", "Viewer"].map((r) => `<div class="flex items-center gap-2 py-1.5 border-b border-[#F4F4F2] last:border-0 text-[.8rem]"><span class="font-semibold w-24">${r}</span><span class="text-zinc-500">${r === "Admin" ? "Full access" : r === "Viewer" ? "Read only" : "View · Create · Edit"}</span></div>`).join("")}</div>
      <div class="card p-5 border-red-200"><div class="font-bold text-[.85rem] mb-1 text-red-600">Danger zone</div>
        <p class="text-[.76rem] text-zinc-500 mb-3">Reset the workspace to fresh seed data.</p>
        <button class="btn-g !border-red-200 !text-red-600" data-action="reset">Reset demo data</button></div>
    </div>`;
  }

  return {
    dashboard, projects, projectDetail, tasks, projectCalendar,
    marketingCalendar, contentCalendar, campaigns, campaignDetail,
    customers, customerDetail, pipeline, leads,
    finOverview, finPlanning, transactions, invoices, expenses, salesOrders, accounts,
    suppliers, purchaseOrders, bills,
    invoicePrint, soPrint, poPrint, billPrint,
    services, templates, analytics, reports, files, activity, settings,
    taskBoard,
  };
})();
