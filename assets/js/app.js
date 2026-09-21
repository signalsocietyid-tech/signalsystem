/* ============================================================
   SIGNAL SYSTEM · App shell — router, search, commands, CRUD
   ============================================================ */
(function () {
  const S = () => window.SignalStore;
  const U = () => window.UI;
  const V = () => window.Views;
  const C = () => window.SignalConfig;

  const NAV = [
    { section: "Overview" },
    { label: "Dashboard", route: "#/dashboard", icon: "◈" },
    { section: "Work" },
    { label: "Projects", route: "#/projects", icon: "▤" },
    { label: "Tasks", route: "#/tasks", icon: "✓" },
    { label: "Project Calendar", route: "#/project-calendar", icon: "◫" },
    { section: "Marketing" },
    { label: "Marketing Calendar", route: "#/marketing-calendar", icon: "◎" },
    { label: "Content Calendar", route: "#/content-calendar", icon: "▦" },
    { label: "Campaigns", route: "#/campaigns", icon: "◉" },
    { section: "Clients" },
    { label: "Customers", route: "#/customers", icon: "○" },
    { label: "CRM / Pipeline", route: "#/pipeline", icon: "⬢" },
    { label: "Leads", route: "#/leads", icon: "◇" },
    { section: "Sales" },
    { label: "Sales Orders", route: "#/sales-orders", icon: "◫" },
    { label: "Invoices", route: "#/invoices", icon: "§" },
    { section: "Purchase" },
    { label: "Suppliers", route: "#/suppliers", icon: "◍" },
    { label: "Purchase Orders", route: "#/purchase-orders", icon: "⬓" },
    { label: "Bills", route: "#/bills", icon: "◨" },
    { section: "Finance" },
    { label: "Financial Overview", route: "#/finance", icon: "₿" },
    { label: "Finance Planning", route: "#/finance-planning", icon: "▧" },
    { label: "Transactions", route: "#/transactions", icon: "⇄" },
    { label: "Expenses", route: "#/expenses", icon: "−" },
    { label: "Accounts", route: "#/accounts", icon: "⬔" },
    { section: "Services" },
    { label: "Service Catalog", route: "#/services", icon: "⬣" },
    { label: "Service Templates", route: "#/service-templates", icon: "⧉" },
    { section: "Insights" },
    { label: "Analytics", route: "#/analytics", icon: "▲" },
    { label: "Reports", route: "#/reports", icon: "▥" },
    { section: "System" },
    { label: "Files", route: "#/files", icon: "⤓" },
    { label: "Activity", route: "#/activity", icon: "〜" },
    { label: "Settings", route: "#/settings", icon: "⚙" },
  ];

  const ROUTES = {
    "#/dashboard": () => V().dashboard(),
    "#/projects": () => V().projects(),
    "#/tasks": () => V().tasks(),
    "#/project-calendar": () => V().projectCalendar(),
    "#/marketing-calendar": () => V().marketingCalendar(),
    "#/content-calendar": () => V().contentCalendar(),
    "#/campaigns": () => V().campaigns(),
    "#/customers": () => V().customers(),
    "#/pipeline": () => V().pipeline(),
    "#/leads": () => V().leads(),
    "#/finance": () => V().finOverview(),
    "#/finance-planning": () => V().finPlanning(),
    "#/transactions": () => V().transactions(),
    "#/sales-orders": () => V().salesOrders(),
    "#/invoices": () => V().invoices(),
    "#/suppliers": () => V().suppliers(),
    "#/purchase-orders": () => V().purchaseOrders(),
    "#/bills": () => V().bills(),
    "#/expenses": () => V().expenses(),
    "#/accounts": () => V().accounts(),
    "#/services": () => V().services(),
    "#/service-templates": () => V().templates(),
    "#/analytics": () => V().analytics(),
    "#/reports": () => V().reports(),
    "#/files": () => V().files(),
    "#/activity": () => V().activity(),
    "#/settings": () => V().settings(),
  };

  function renderNav() {
    const hash = location.hash.split("?")[0];
    let base = hash.startsWith("#/project/") ? "#/projects" : hash.startsWith("#/customer/") ? "#/customers" : hash.startsWith("#/campaign/") ? "#/campaigns" : hash;
    if (base.startsWith("#/print/invoice")) base = "#/invoices";
    if (base.startsWith("#/print/so")) base = "#/sales-orders";
    if (base.startsWith("#/print/bill")) base = "#/bills";
    if (base.startsWith("#/print/po")) base = "#/purchase-orders";
    document.getElementById("nav").innerHTML = NAV.map((n) => {
      if (n.section) return `<div class="px-2.5 mt-5 mb-1.5 text-[.62rem] font-bold tracking-[.12em] text-zinc-400">${n.section.toUpperCase()}</div>`;
      const active = base === n.route;
      const badge = n.route === "#/tasks" ? S().list("tasks").filter((t) => t.status !== "Done" && S().isOverdue(t.due_date)).length
        : n.route === "#/invoices" ? S().list("invoices").filter((i) => i.status === "Overdue").length : 0;
      return `<a href="${n.route}" class="navlink ${active ? "active" : ""}"><span class="navdot"></span><span class="flex-1">${n.label}</span>${badge ? `<span class="text-[.62rem] font-bold px-1.5 py-0.5 rounded-full" style="background:#FF6600;color:#fff">${badge}</span>` : ""}</a>`;
    }).join("");
    // topbar badges
    const unread = S().list("notifications").filter((n) => !n.is_read).length;
    const nb = document.getElementById("notif-badge");
    if (nb) { nb.textContent = unread; nb.style.display = unread ? "flex" : "none"; }
  }

  function render() {
    const raw = location.hash || "#/dashboard";
    const [path] = raw.split("?");
    let html;
    if (path.startsWith("#/project/")) html = V().projectDetail(path.split("/")[2]);
    else if (path.startsWith("#/customer/")) html = V().customerDetail(path.split("/")[2]);
    else if (path.startsWith("#/campaign/")) html = V().campaignDetail(path.split("/")[2]);
    else if (path.startsWith("#/print/invoice/")) html = V().invoicePrint(path.split("/")[3]);
    else if (path.startsWith("#/print/so/")) html = V().soPrint(path.split("/")[3]);
    else if (path.startsWith("#/print/bill/")) html = V().billPrint(path.split("/")[3]);
    else if (path.startsWith("#/print/po/")) html = V().poPrint(path.split("/")[3]);
    else html = (ROUTES[path] || V().dashboard)();
    const view = document.getElementById("view");
    view.innerHTML = html;
    view.classList.remove("fade-up"); void view.offsetWidth;
    renderNav();
    bindDynamic();
    window.scrollTo(0, 0);
  }

  /* ---------- global search / command menu ---------- */
  function openSearch() {
    U().openModal({
      title: "Search & commands", sub: "Clients · projects · tasks · campaigns · invoices · files — or type a command",
      body: `<input id="gq" class="inp !py-3 !text-[.95rem]" placeholder="Type to search…  ( try: 'create invoice' )" autocomplete="off"/>
             <div id="gresults" class="mt-3 max-h-[46vh] overflow-y-auto divide-y divide-[#F4F4F2]"></div>`,
      actions: [],
    });
    const q = document.getElementById("gq"), res = document.getElementById("gresults");
    const run = () => {
      const v = q.value.toLowerCase().trim();
      if (!v) { res.innerHTML = `<div class="py-6 text-center text-[.8rem] text-zinc-400">Quick commands: create project · create client · create task · create lead · create invoice · open finance · open calendar</div>`; return; }
      // commands
      const cmds = [["create project", "new-project"], ["create client", "new-client"], ["create task", "new-task"], ["create lead", "new-lead"], ["create sales order", "new-sales-order"], ["create purchase order", "new-purchase-order"], ["create supplier", "new-supplier"], ["create bill", "new-bill"], ["create invoice", "new-invoice"], ["create campaign", "new-campaign"], ["open dashboard", "#/dashboard"], ["open finance", "#/finance"], ["open sales", "#/sales-orders"], ["open sales orders", "#/sales-orders"], ["open purchase", "#/purchase-orders"], ["open suppliers", "#/suppliers"], ["open bills", "#/bills"], ["open accounts", "#/accounts"], ["open calendar", "#/marketing-calendar"], ["open pipeline", "#/pipeline"]].filter((c) => c[0].includes(v));
      const s = S(), u = U();
      const groups = [
        ["Clients", s.list("clients").filter((c) => (c.company_name + (c.contact_person || "")).toLowerCase().includes(v)).slice(0, 3).map((c) => ({ label: c.company_name, sub: c.contact_person, go: "#/customer/" + c.id }))],
        ["Projects", s.list("projects").filter((p) => p.name.toLowerCase().includes(v)).slice(0, 3).map((p) => ({ label: p.name, sub: s.clientName(p.client_id), go: "#/project/" + p.id }))],
        ["Tasks", s.list("tasks").filter((t) => t.title.toLowerCase().includes(v)).slice(0, 3).map((t) => ({ label: t.title, sub: t.status, task: t.id }))],
        ["Invoices", s.list("invoices").filter((i) => (i.number + s.clientName(i.client_id)).toLowerCase().includes(v)).slice(0, 3).map((i) => ({ label: i.number + " · " + u.money(i.total), sub: s.clientName(i.client_id), go: "#/print/invoice/" + i.id }))],
        ["Sales Orders", s.list("salesOrders").filter((o) => (o.number + s.clientName(o.client_id)).toLowerCase().includes(v)).slice(0, 3).map((o) => ({ label: o.number + " · " + u.money(o.total), sub: s.clientName(o.client_id), go: "#/print/so/" + o.id }))],
        ["Bills", s.list("bills").filter((b) => (b.number + s.supplierName(b.supplier_id)).toLowerCase().includes(v)).slice(0, 3).map((b) => ({ label: b.number + " · " + u.money(b.total), sub: s.supplierName(b.supplier_id), go: "#/print/bill/" + b.id }))],
        ["Purchase Orders", s.list("purchaseOrders").filter((o) => (o.number + s.supplierName(o.supplier_id)).toLowerCase().includes(v)).slice(0, 2).map((o) => ({ label: o.number + " · " + u.money(o.total), sub: s.supplierName(o.supplier_id), go: "#/print/po/" + o.id }))],
      ];
      res.innerHTML = (cmds.length ? `<div class="py-1">${cmds.map((c) => `<button class="w-full text-left px-3 py-2 rounded-lg hover:bg-[#FAFAF8] text-[.82rem] font-semibold" data-cmd="${c[1]}">⚡ ${c[0]}</button>`).join("")}</div>` : "")
        + groups.filter((g) => g[1].length).map((g) => `<div class="py-2"><div class="px-3 text-[.62rem] font-bold tracking-widest text-zinc-400">${g[0].toUpperCase()}</div>
          ${g[1].map((r) => r.task ? `<button class="w-full text-left px-3 py-2 rounded-lg hover:bg-[#FAFAF8]" data-task="${r.task}"><div class="text-[.82rem] font-semibold">${u.esc(r.label)}</div><div class="text-[.7rem] text-zinc-400">${u.esc(r.sub)}</div></button>`
            : `<a href="${r.go}" class="block px-3 py-2 rounded-lg hover:bg-[#FAFAF8]" data-close-first><div class="text-[.82rem] font-semibold">${u.esc(r.label)}</div><div class="text-[.7rem] text-zinc-400">${u.esc(r.sub)}</div></a>`).join("")}</div>`).join("")
        || `<div class="py-6 text-center text-[.8rem] text-zinc-400">No results for “${u.esc(v)}”.</div>`;
      res.querySelectorAll("[data-close-first]").forEach((a) => (a.onclick = () => U().closeModal()));
      res.querySelectorAll("[data-cmd]").forEach((b) => (b.onclick = () => { U().closeModal(); handleAction(b.dataset.cmd, b); }));
    };
    q.addEventListener("input", run); run(); setTimeout(() => q.focus(), 50);
  }

  function quickCreate() {
    U().openModal({
      title: "Quick create", sub: "Press C anywhere to open this",
      body: `<div class="grid grid-cols-2 gap-2">${[["Client", "new-client"], ["Lead", "new-lead"], ["Project", "new-project"], ["Task", "new-task"], ["Sales Order", "new-sales-order"], ["Invoice", "new-invoice"], ["Supplier", "new-supplier"], ["Purchase Order", "new-purchase-order"], ["Bill", "new-bill"], ["Campaign", "new-campaign"], ["Content", "new-content"], ["Transaction", "new-transaction"], ["Account", "new-account"]].map((x) => `<button class="card p-4 text-left hover:border-zinc-900 transition" data-qc="${x[1]}"><div class="font-bold text-[.85rem]">+ ${x[0]}</div><div class="text-[.7rem] text-zinc-400">Create new ${x[0].toLowerCase()}</div></button>`).join("")}</div>`,
      actions: [],
    });
    document.querySelectorAll("[data-qc]").forEach((b) => (b.onclick = () => { U().closeModal(); handleAction(b.dataset.qc, b); }));
  }

  /* ---------- forms ---------- */
  const esc = (s) => U().esc(s);
  const opt = (list, val) => list.map((x) => `<option ${x === val ? "selected" : ""}>${x}</option>`).join("");
  const clientOpts = (val) => S().list("clients").map((c) => `<option value="${c.id}" ${c.id === val ? "selected" : ""}>${esc(c.company_name)}</option>`).join("");
  const projectOpts = (val) => S().list("projects").map((p) => `<option value="${p.id}" ${p.id === val ? "selected" : ""}>${esc(p.name)}</option>`).join("");
  const teamOpts = (val) => C().team.map((t) => `<option ${t.name === val ? "selected" : ""}>${t.name}</option>`).join("");

  function formModal(title, fieldsHTML, onSave) {
    U().openModal({
      title, body: `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${fieldsHTML}</div>`,
      actions: [{ label: "Cancel", ghost: true, onClick: () => U().closeModal() },
        { label: "Save Changes", primary: true, id: "m-save", onClick: () => {
          const vals = {}; document.querySelectorAll("#modal-body [name]").forEach((el) => (vals[el.name] = el.value));
          const btn = document.getElementById("m-save"); btn.textContent = "Saving…"; btn.disabled = true;
          setTimeout(() => { onSave(vals); U().closeModal(); U().toast("Changes saved."); render(); }, 350);
        } }],
    });
  }
  const F = (label, inner, full) => `<div class="${full ? "sm:col-span-2" : ""}"><label class="lbl">${label}</label>${inner}</div>`;
  const T = (name, val, ph) => `<input name="${name}" class="inp" value="${esc(val || "")}" placeholder="${esc(ph || "")}"/>`;
  const Dd = (name, val) => `<input name="${name}" type="date" class="inp font-num" value="${esc(val || "")}"/>`;
  const Sel = (name, inner) => `<select name="${name}" class="inp">${inner}</select>`;
  const Ta = (name, val) => `<textarea name="${name}" class="inp" rows="2">${esc(val || "")}</textarea>`;

  function newClient(existing) {
    formModal(existing ? "Edit client" : "New client", `
      ${F("Company *", T("company_name", existing?.company_name, "Acme Inc."), 1)}
      ${F("Contact person", T("contact_person", existing?.contact_person))}
      ${F("Email", T("email", existing?.email))}
      ${F("Phone", T("phone", existing?.phone))}
      ${F("Website", T("website", existing?.website))}
      ${F("Industry", T("industry", existing?.industry))}
      ${F("Status", Sel("status", opt(C().clientStatuses, existing?.status || "Lead")))}
      ${F("Account manager", Sel("account_manager", teamOpts(existing?.account_manager)))}
      ${F("Notes", Ta("notes", ""), 1)}`, (v) => {
      if (!v.company_name) return U().toast("Company name required");
      if (existing) S().update("clients", existing.id, { ...v, lifetime_value: existing.lifetime_value });
      else S().insert("clients", { ...v, tags: [], lifetime_value: 0 });
    });
  }
  function newLead() {
    formModal("New lead", `
      ${F("Company *", T("company", ""), 1)} ${F("Contact", T("contact_person", ""))} ${F("Email", T("email", ""))}
      ${F("Service interest", Sel("service_interest", C().serviceKeys.map((x) => `<option>${x.name}</option>`).join("")))}
      ${F("Deal value ($)", `<input name="deal_value" type="number" class="inp font-num" value="10000"/>`)}
      ${F("Stage", Sel("stage", opt(C().pipelineStages, "New Lead")))} ${F("Probability %", `<input name="probability" type="number" class="inp font-num" value="20"/>`)}
      ${F("Owner", Sel("assigned_to", teamOpts("Sarah Chen")))} ${F("Follow-up", Dd("next_follow_up", S().today()))}
      ${F("Notes", Ta("notes", ""), 1)}`, (v) => {
      if (!v.company) return U().toast("Company required");
      S().insert("leads", { ...v, deal_value: +v.deal_value || 0, probability: +v.probability || 20, last_contact: S().today() });
      S().notify("Lead follow-up", v.company + " — due " + v.next_follow_up, "info", "#/pipeline");
    });
  }
  function newProject(tplId) {
    const tpl = tplId ? S().get("templates", tplId) : null;
    formModal(tpl ? "New project from template" : "New project", `
      ${F("Project name *", T("name", tpl ? tpl.name.replace(" Template", "") + " — New Client" : ""), 1)}
      ${F("Client", Sel("client_id", clientOpts()))} ${F("Service", Sel("service_key", C().serviceKeys.map((x) => `<option value="${x.key}">${x.name}</option>`).join("")))}
      ${F("Status", Sel("status", opt(C().projectStatuses, "Planning")))} ${F("Owner", Sel("owner", teamOpts("Sarah Chen")))}
      ${F("Start", Dd("start_date", S().today()))} ${F("Deadline", Dd("deadline", ""))}
      ${F("Budget ($)", `<input name="budget" type="number" class="inp font-num" value="15000"/>`)}
      ${F("Contract value ($)", `<input name="contract_value" type="number" class="inp font-num" value="18000"/>`)}
      ${F("Summary", Ta("description", ""), 1)}`, (v) => {
      if (!v.name) return U().toast("Project name required");
      const p = S().insert("projects", { ...v, budget: +v.budget || 0, contract_value: +v.contract_value || 0, estimated_cost: Math.round((+v.budget || 0) * 0.7) });
      const stages = tpl?.stages || [{ name: "Discovery" }, { name: "Delivery" }, { name: "Launch" }];
      stages.forEach((st) => S().insert("milestones", { project_id: p.id, name: st.name, status: "To Do", deadline: v.deadline }, false));
      S().log("applied template", "project", (tpl?.name || "blank") + " → " + v.name);
      location.hash = "#/project/" + p.id;
    });
  }
  function newTask(projectId, status) {
    formModal("New task", `
      ${F("Title *", T("title", "", "Website redesign"), 1)} ${F("Project", Sel("project_id", projectOpts(projectId)), 1)}
      ${F("Status", Sel("status", opt(C().taskStatuses, status || "To Do")))} ${F("Priority", Sel("priority", opt(C().taskPriorities, "Medium")))}
      ${F("Assignee", Sel("assignee", teamOpts("Sarah Chen")))} ${F("Due date", Dd("due_date", S().today()))}
      ${F("Est. hours", `<input name="est_hours" type="number" class="inp font-num" value="4"/>`)}
      ${F("Description", Ta("description", ""), 1)}`, (v) => {
      if (!v.title) return U().toast("Title required");
      const t = S().insert("tasks", { ...v, est_hours: +v.est_hours || 0, actual_hours: 0, tags: [] });
      S().notify("Task assigned", v.title + " → " + v.assignee, "info", "#/tasks");
    });
  }
  function newCampaign(existing) {
    formModal(existing ? "Edit campaign" : "New campaign", `
      ${F("Name *", T("name", existing?.name), 1)} ${F("Client", Sel("client_id", clientOpts(existing?.client_id)))}
      ${F("Status", Sel("status", opt(C().campaignStatuses, existing?.status || "Planning")))}
      ${F("Budget ($)", `<input name="budget" type="number" class="inp font-num" value="${existing?.budget || 5000}"/>`)}
      ${F("Start", Dd("start_date", existing?.start_date || S().today()))} ${F("End", Dd("end_date", existing?.end_date || ""))}
      ${F("Objective", Ta("objective", existing?.objective), 1)}`, (v) => {
      if (existing) S().update("campaigns", existing.id, { ...v, budget: +v.budget || 0 });
      else S().insert("campaigns", { ...v, budget: +v.budget || 0, spend: 0, platforms: ["Instagram"], audience: "", kpi: "" });
    });
  }
  function newContent() {
    formModal("New content", `
      ${F("Title *", T("title", ""), 1)} ${F("Client", Sel("client_id", clientOpts()))}
      ${F("Campaign", `<select name="campaign_id" class="inp"><option value="">—</option>${S().list("campaigns").map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}</select>`)}
      ${F("Platform", Sel("platform", opt(C().platforms, "Instagram")))} ${F("Type", Sel("content_type", opt(C().contentTypes, "Static")))}
      ${F("Status", Sel("status", opt(C().contentStatuses, "Idea")))} ${F("Owner", Sel("assignee", teamOpts("Leo Fournier")))}
      ${F("Publish date", Dd("publish_date", S().today()))} ${F("Deadline", Dd("deadline", S().today()))}
      ${F("Caption / notes", Ta("caption", ""), 1)}`, (v) => {
      if (!v.title) return U().toast("Title required");
      S().insert("content", { ...v, campaign_id: v.campaign_id || null, pillar: "Product", cta: "" });
    });
  }
  function newTransaction() {
    const accOpts = `<option value="">— unassigned</option>` + S().list("accounts").filter((a) => a.is_active).map((a) => `<option value="${a.id}">${esc(a.name)} · ${a.currency}</option>`).join("");
    formModal("New transaction", `
      ${F("Type", Sel("type", opt(["Income", "Expense", "Refund", "Transfer"], "Income")))}
      ${F("Amount *", `<input name="amount" type="number" class="inp font-num" value="1000"/>`)}
      ${F("Date", Dd("date", S().today()))} ${F("Category", T("category", "Client Payment"))}
      ${F("Client", Sel("client_id", `<option value="">—</option>` + clientOpts()))}
      ${F("Project", Sel("project_id", `<option value="">—</option>` + projectOpts()))}
      ${F("Method", Sel("payment_method", opt(C().paymentMethods, "Bank Transfer")))}
      ${F("Destination account", Sel("account_id", accOpts), 1)}
      ${F("Reference", T("reference", ""), 1)}`, (v) => {
      const acc = S().get("accounts", v.account_id);
      S().insert("transactions", { ...v, amount: +v.amount || 0, currency: acc?.currency || "USD", client_id: v.client_id || null, project_id: v.project_id || null, account_id: acc?.id || null, status: "Completed" });
    });
  }
  function newInvoice() {
    const num = S().nextInvoiceNumber();
    const freeSO = S().list("salesOrders").filter((o) => !o.invoice_id && ["Draft", "Confirmed"].includes(o.status));
    formModal("New invoice", `
      ${F("Number", T("number", num))} ${F("Client", Sel("client_id", clientOpts()))}
      ${F("Project", Sel("project_id", `<option value="">—</option>` + projectOpts()))}
      ${F("Sales order (optional)", `<select name="sales_order_id" class="inp"><option value="">— standalone</option>${freeSO.map((o) => `<option value="${o.id}">${esc(o.number)} · ${esc(S().clientName(o.client_id))}</option>`).join("")}</select>`)}
      ${F("Total *", `<input name="total" type="number" class="inp font-num" value="5000"/>`)}
      ${F("Currency", Sel("currency", opt(["USD", "IDR"], "USD")))}
      ${F("Issue", Dd("issue_date", S().today()))} ${F("Due", Dd("due_date", ""))}
      ${F("Status", Sel("status", opt(C().invoiceStatuses, "Draft")))}`, (v) => {
      const so = v.sales_order_id ? S().get("salesOrders", v.sales_order_id) : null;
      const src = so || {};
      const inv = S().insert("invoices", { ...v, sales_order_id: so?.id || null, client_id: so?.client_id || v.client_id, project_id: v.project_id || so?.project_id || null, total: so ? so.total : (+v.total || 0), subtotal: so ? so.subtotal : (+v.total || 0), tax: so?.tax || 0, discount: so?.discount || 0, amount_paid: 0, items: so ? (so.items || []).map((it) => ({ ...it })) : [{ description: "Services", qty: 1, unit_price: +v.total || 0, amount: +v.total || 0 }] });
      if (so) S().update("salesOrders", so.id, { status: "Invoiced", invoice_id: inv.id });
    });
  }
  /* ----- sales order: confirming auto-creates the invoice ----- */
  function newSalesOrder() {
    const soNum = S().nextSONumber();
    const projOptsByClient = (cid) => S().list("projects").filter((p) => !cid || p.client_id === cid)
      .map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
    U().openModal({
      title: "New sales order", sub: "No. " + soNum + " · confirming auto-creates the invoice",
      wide: true,
      body: `<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        ${F("Client *", Sel("so_client", clientOpts()))}
        ${F("Project", `<select name="so_project" id="so_project" class="inp"><option value="">—</option>${projOptsByClient("")}</select>`)}
        ${F("Status", Sel("so_status", opt(C().soStatuses.slice(0, 2), "Confirmed")))}
        ${F("Issue date", Dd("so_issue", S().today()))} ${F("Valid until", Dd("so_due", S().addDaysTo(S().today(), 30)))}
        ${F("Currency", Sel("so_currency", opt(["USD", "IDR"], "USD")))}
      </div>
      <div class="font-bold text-[.8rem] mb-2">Line items</div>
      <div id="so-items" class="space-y-2 mb-2"></div>
      <button class="btn-g !py-1.5 mb-4" id="so-addrow">+ Add line</button>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        ${F("Tax", `<input name="so_tax" id="so_tax" type="number" class="inp font-num" value="0"/>`)}
        ${F("Discount", `<input name="so_discount" id="so_discount" type="number" class="inp font-num" value="0"/>`)}
        <div><label class="lbl">Total</label><div id="so-total" class="text-[1.2rem] font-extrabold font-num">$0</div></div>
      </div>
      ${F("Notes / terms", Ta("so_notes", ""), 1)}`,
      actions: [{ label: "Cancel", ghost: true, onClick: () => U().closeModal() },
        { label: "Save Sales Order", primary: true, id: "so-save", onClick: () => saveSalesOrder(soNum) }],
    });
    const rowHTML = (d, q, p) => `<div class="so-row grid grid-cols-[1fr_70px_110px_90px_32px] gap-2 items-center">
      <input class="inp so-desc" placeholder="Description…" value="${d || ""}"/>
      <input class="inp font-num so-qty" type="number" min="0" value="${q ?? 1}"/>
      <input class="inp font-num so-price" type="number" min="0" value="${p ?? 0}"/>
      <span class="so-amt text-[.8rem] font-bold font-num text-right">$0</span>
      <button class="btn-g !px-2 !py-1 so-rm">✕</button></div>`;
    const box = document.getElementById("so-items");
    const calc = () => {
      let sub = 0;
      box.querySelectorAll(".so-row").forEach((r) => {
        const amt = (+r.querySelector(".so-qty").value || 0) * (+r.querySelector(".so-price").value || 0);
        r.querySelector(".so-amt").textContent = (document.querySelector('[name="so_currency"]')?.value === "IDR" ? "Rp" : "$") + Math.round(amt).toLocaleString();
        sub += amt;
      });
      const total = sub + (+document.getElementById("so_tax").value || 0) - (+document.getElementById("so_discount").value || 0);
      document.getElementById("so-total").textContent = (document.querySelector('[name="so_currency"]')?.value === "IDR" ? "Rp" : "$") + Math.round(total).toLocaleString();
      return { sub, total };
    };
    const addRow = () => { box.insertAdjacentHTML("beforeend", rowHTML()); bindRows(); };
    const bindRows = () => {
      box.querySelectorAll(".so-row").forEach((r) => {
        r.oninput = calc;
        r.querySelector(".so-rm").onclick = () => { r.remove(); calc(); };
      });
    };
    addRow(); addRow(); calc();
    document.getElementById("so-addrow").onclick = addRow;
    document.getElementById("so_tax").oninput = calc;
    document.getElementById("so_discount").oninput = calc;
    document.getElementById("so_project").dataset.all = projOptsByClient("");
    document.querySelector('[name="so_client"]').onchange = (e) => {
      document.getElementById("so_project").innerHTML = `<option value="">—</option>` + projOptsByClient(e.target.value);
    };
  }
  function saveSalesOrder(soNum) {
    const g = (n) => document.querySelector(`[name="${n}"]`)?.value || "";
    const client = g("so_client");
    if (!client) return U().toast("Client required");
    const items = [...document.querySelectorAll(".so-row")].map((r) => ({
      description: r.querySelector(".so-desc").value.trim(),
      qty: +r.querySelector(".so-qty").value || 0,
      unit_price: +r.querySelector(".so-price").value || 0,
    })).filter((it) => it.description).map((it) => ({ ...it, amount: it.qty * it.unit_price }));
    if (!items.length) return U().toast("Add at least one line item");
    const sub = items.reduce((a, it) => a + it.amount, 0);
    const tax = +g("so_tax") || 0, disc = +g("so_discount") || 0;
    const btn = document.getElementById("so-save"); btn.textContent = "Saving…"; btn.disabled = true;
    setTimeout(() => {
      const so = S().insert("salesOrders", {
        number: S().nextSONumber(), client_id: client, project_id: g("so_project") || null,
        issue_date: g("so_issue") || S().today(), due_date: g("so_due"), status: g("so_status") || "Draft",
        currency: g("so_currency") || "USD", subtotal: sub, tax, discount: disc, total: sub + tax - disc,
        invoice_id: null, notes: g("so_notes"), items,
      });
      U().closeModal();
      if (so.status === "Confirmed") {
        const inv = S().createInvoiceFromSO(so.id);
        U().toast("Order " + so.number + " confirmed.", "Invoice " + inv.number + " auto-created →");
        location.hash = "#/print/invoice/" + inv.id;
      } else {
        U().toast("Sales order saved as draft.", so.number);
        render();
      }
    }, 350);
  }

  function newAccount(existing) {
    formModal(existing ? "Edit account" : "New payment account", `
      ${F("Account name *", T("name", existing?.name, "BCA · •• 0000"), 1)}
      ${F("Type", Sel("type", opt(C().accountTypes, existing?.type || "Bank")))}
      ${F("Currency", Sel("currency", opt(["USD", "IDR"], existing?.currency || "IDR")))}
      ${F("Account no.", T("account_no", existing?.account_no))}
      ${F("Holder", T("holder", existing?.holder, "Signal Society"))}
      ${F("Current balance", `<input name="balance" type="number" class="inp font-num" value="${existing?.balance ?? 0}"/>`)}
      ${F("Active", Sel("is_active", `<option value="1" ${(existing?.is_active ?? true) ? "selected" : ""}>Active</option><option value="0" ${(existing?.is_active ?? true) ? "" : "selected"}>Inactive</option>`))}`, (v) => {
      if (!v.name) return U().toast("Name required");
      const row = { ...v, balance: +v.balance || 0, is_active: v.is_active === "1" };
      if (existing) S().update("accounts", existing.id, row);
      else S().insert("accounts", row);
    });
  }

  /* ----- drawers: sales order / invoice / receive payment ----- */
  function soDrawer(id) {
    const s = S(), u = U();
    const o = s.get("salesOrders", id); if (!o) return;
    const inv = o.invoice_id ? s.get("invoices", o.invoice_id) : null;
    U().openDrawer(o.number, `
      <div class="flex items-center gap-2 mb-3">${u.pill(o.status)}<span class="ml-auto font-num font-extrabold">${u.moneyC(o.total, o.currency)}</span></div>
      <div class="text-[.8rem] space-y-1.5 mb-4">${[["Client", s.clientName(o.client_id)], ["Project", s.projectName(o.project_id)], ["Issue", o.issue_date], ["Valid until", o.due_date], ["Currency", o.currency]].map((x) => `<div class="flex"><span class="w-24 text-zinc-400">${x[0]}</span><b>${u.esc(x[1] || "—")}</b></div>`).join("")}</div>
      <div class="font-bold text-[.8rem] mb-2">Items</div>
      <div class="card overflow-hidden mb-4"><table class="tbl w-full"><tbody>
        ${(o.items || []).map((it) => `<tr><td>${u.esc(it.description)}<div class="text-[.68rem] text-zinc-400 font-num">${it.qty} × ${u.moneyC(it.unit_price, o.currency)}</div></td><td class="font-num font-bold !text-right">${u.moneyC(it.amount ?? it.qty * it.unit_price, o.currency)}</td></tr>`).join("")}
      </tbody></table></div>
      ${o.notes ? `<p class="text-[.8rem] text-zinc-500 mb-4">${u.esc(o.notes)}</p>` : ""}
      <div class="rounded-xl p-3.5 mb-4 text-[.8rem]" style="background:#FFF1E8;">${inv ? `Linked invoice <a href="#/print/invoice/${inv.id}" class="font-extrabold" style="color:#7C3AED">${u.esc(inv.number)} (${inv.status})</a>` : `No invoice yet — ${o.status === "Confirmed" ? "create one below." : "confirm the order to auto-create it."}`}</div>
      <div class="grid grid-cols-2 gap-2">
        ${o.status === "Draft" ? `<button class="btn-a" id="so-confirm">Confirm order</button>` : ""}
        ${o.status === "Confirmed" && !inv ? `<button class="btn-p" id="so-mkinv">Create invoice</button>` : ""}
        ${inv ? `<a class="btn-p text-center" href="#/print/invoice/${inv.id}">View invoice →</a>` : ""}
        <a class="btn-g text-center" href="#/print/so/${o.id}">⎙ Print SO</a>
      </div>
      <button class="btn-g w-full mt-2 !text-red-600 !border-red-200" id="so-del">Delete order</button>`);
    document.getElementById("so-confirm") && (document.getElementById("so-confirm").onclick = () => {
      s.update("salesOrders", id, { status: "Confirmed" });
      const inv2 = s.createInvoiceFromSO(id);
      U().toast("Order confirmed.", "Invoice " + inv2.number + " auto-created →");
      U().closeDrawer(); location.hash = "#/print/invoice/" + inv2.id;
    });
    document.getElementById("so-mkinv") && (document.getElementById("so-mkinv").onclick = () => {
      const inv2 = s.createInvoiceFromSO(id);
      U().toast("Invoice created.", inv2.number);
      U().closeDrawer(); location.hash = "#/print/invoice/" + inv2.id;
    });
    document.getElementById("so-del").onclick = () => U().confirmDestructive("Delete this sales order?", (inv ? "Linked invoice " + inv.number + " stays, but the link is removed." : "This cannot be undone."), () => { s.remove("salesOrders", id); U().toast("Order deleted."); render(); });
  }

  function invoiceDrawer(id) {
    const s = S(), u = U();
    const i = s.get("invoices", id); if (!i) return;
    const so = i.sales_order_id ? s.get("salesOrders", i.sales_order_id) : s.soByInvoice(i.id);
    const pays = s.list("transactions").filter((t) => t.invoice_id === id);
    const due = (+i.total || 0) - (+i.amount_paid || 0);
    U().openDrawer(i.number, `
      <div class="flex items-center gap-2 mb-3">${u.pill(i.status)}${so ? `<span class="chip">from <b class="ml-1" style="color:#7C3AED">${u.esc(so.number)}</b></span>` : ""}<span class="ml-auto font-num font-extrabold">${u.moneyC(i.total, i.currency)}</span></div>
      <div class="text-[.8rem] space-y-1.5 mb-4">${[["Client", s.clientName(i.client_id)], ["Project", s.projectName(i.project_id)], ["Issue", i.issue_date], ["Due", i.due_date], ["Paid", u.moneyC(i.amount_paid, i.currency)], ["Balance due", u.moneyC(due, i.currency)]].map((x) => `<div class="flex"><span class="w-24 text-zinc-400">${x[0]}</span><b>${x[1]}</b></div>`).join("")}</div>
      <div class="font-bold text-[.8rem] mb-2">Items</div>
      <div class="card overflow-hidden mb-4"><table class="tbl w-full"><tbody>
        ${(i.items || []).map((it) => `<tr><td>${u.esc(it.description)}<div class="text-[.68rem] text-zinc-400 font-num">${it.qty} × ${u.moneyC(it.unit_price, i.currency)}</div></td><td class="font-num font-bold !text-right">${u.moneyC(it.amount ?? it.qty * it.unit_price, i.currency)}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="font-bold text-[.8rem] mb-2">Payments (${pays.length})</div>
      <div class="space-y-1.5 mb-4">${pays.map((t) => `<div class="flex items-center gap-2 text-[.78rem] card px-3 py-2"><span class="font-num text-zinc-400">${u.fmtDate(t.date)}</span><span>${u.esc(t.payment_method || "")}</span><span class="text-zinc-400">→ ${u.esc(s.accountName(t.account_id))}</span><b class="ml-auto font-num" style="color:#16A34A">+${u.moneyC(t.amount, t.currency)}</b></div>`).join("") || `<p class="text-[.76rem] text-zinc-400">No payments yet.</p>`}</div>
      <div class="grid grid-cols-2 gap-2">
        <a class="btn-p text-center" href="#/print/invoice/${i.id}">⎙ Print / PDF</a>
        ${due > 0 && i.status !== "Cancelled" ? `<button class="btn-a" id="inv-pay">+ Receive payment</button>` : ""}
        ${i.status === "Draft" ? `<button class="btn-g" id="inv-send">Mark sent</button>` : ""}
      </div>
      <button class="btn-g w-full mt-2 !text-red-600 !border-red-200" id="inv-del">Delete invoice</button>`);
    document.getElementById("inv-pay") && (document.getElementById("inv-pay").onclick = () => receivePaymentForm(id));
    document.getElementById("inv-send") && (document.getElementById("inv-send").onclick = () => { s.update("invoices", id, { status: "Sent" }); U().toast("Invoice marked sent.", i.number); render(); U().closeDrawer(); });
    document.getElementById("inv-del").onclick = () => U().confirmDestructive("Delete this invoice?", "Payments already recorded stay in Transactions.", () => { s.remove("invoices", id); U().toast("Invoice deleted."); render(); });
  }

  function receivePaymentForm(invId) {
    const s = S(), u = U();
    const i = s.get("invoices", invId); if (!i) return;
    const due = (+i.total || 0) - (+i.amount_paid || 0);
    const accs = s.list("accounts").filter((a) => a.is_active);
    if (!accs.length) return U().toast("Add a payment account first", "Finance → Accounts");
    formModal("Receive payment · " + i.number, `
      ${F("Amount due", `<div class="text-[1.15rem] font-extrabold font-num">${u.moneyC(due, i.currency)}</div>`)}
      ${F("Amount received *", `<input name="p_amount" type="number" class="inp font-num" value="${due}" max="${due}"/>`)}
      ${F("Date", Dd("p_date", s.today()))}
      ${F("Method *", Sel("p_method", opt(C().paymentMethods, "Bank Transfer")))}
      ${F("Destination account *", `<select name="p_account" class="inp">${accs.map((a) => `<option value="${a.id}">${u.esc(a.name)} · ${a.currency} (${u.moneyC(a.balance, a.currency)})</option>`).join("")}</select>`, 1)}
      <div class="sm:col-span-2 text-[.74rem] text-zinc-500 rounded-lg p-3" style="background:#FFF1E8;">Income posts to the chosen account balance instantly — BCA, PayPal, or cash.</div>`, (v) => {
      const acc = s.get("accounts", v.p_account);
      const ok = s.receivePayment(invId, { accountId: v.p_account, method: v.p_method, amount: +v.p_amount || 0, date: v.p_date });
      if (!ok) return U().toast("Nothing to record", "Amount must be above zero");
      U().toast("Payment recorded.", `${v.p_method} → ${acc ? acc.name : ""}`);
      render();
    });
  }

  /* ----- purchase: PO confirm auto-creates the bill ----- */
  function newSupplier(existing) {
    formModal(existing ? "Edit supplier" : "New supplier", `
      ${F("Supplier name *", T("name", existing?.name, "PT …"), 1)}
      ${F("Contact person", T("contact_person", existing?.contact_person))}
      ${F("Email", T("email", existing?.email))}
      ${F("Phone", T("phone", existing?.phone))}
      ${F("Address", T("address", existing?.address), 1)}
      ${F("Notes", Ta("notes", existing?.notes), 1)}`, (v) => {
      if (!v.name) return U().toast("Name required");
      if (existing) S().update("suppliers", existing.id, v);
      else S().insert("suppliers", v);
    });
  }
  const supplierOpts = (val) => S().list("suppliers").map((x) => `<option value="${x.id}" ${x.id === val ? "selected" : ""}>${esc(x.name)}</option>`).join("");

  function newPurchaseOrder() {
    const poNum = S().nextPONumber();
    U().openModal({
      title: "New purchase order", sub: "No. " + poNum + " · confirming auto-creates the vendor bill",
      wide: true,
      body: `<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        ${F("Supplier *", Sel("po_supplier", supplierOpts()))}
        ${F("Project (optional)", `<select name="po_project" class="inp"><option value="">—</option>${S().list("projects").map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}</select>`)}
        ${F("Status", Sel("po_status", opt(C().poStatuses.slice(0, 2), "Confirmed")))}
        ${F("Issue date", Dd("po_issue", S().today()))} ${F("Valid until", Dd("po_due", S().addDaysTo(S().today(), 14)))}
        ${F("Currency", Sel("po_currency", opt(["IDR", "USD"], "IDR")))}
      </div>
      <div class="font-bold text-[.8rem] mb-2">Line items</div>
      <div id="po-items" class="space-y-2 mb-2"></div>
      <button class="btn-g !py-1.5 mb-4" id="po-addrow">+ Add line</button>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        ${F("Tax", `<input name="po_tax" id="po_tax" type="number" class="inp font-num" value="0"/>`)}
        ${F("Discount", `<input name="po_discount" id="po_discount" type="number" class="inp font-num" value="0"/>`)}
        <div><label class="lbl">Total</label><div id="po-total" class="text-[1.2rem] font-extrabold font-num">Rp0</div></div>
      </div>
      ${F("Notes / terms", Ta("po_notes", ""), 1)}`,
      actions: [{ label: "Cancel", ghost: true, onClick: () => U().closeModal() },
        { label: "Save Purchase Order", primary: true, id: "po-save", onClick: () => savePurchaseOrder() }],
    });
    const box = document.getElementById("po-items");
    const cur = () => (document.querySelector('[name="po_currency"]')?.value === "USD" ? "$" : "Rp");
    const calc = () => {
      let sub = 0;
      box.querySelectorAll(".po-row").forEach((r) => {
        const amt = (+r.querySelector(".po-qty").value || 0) * (+r.querySelector(".po-price").value || 0);
        r.querySelector(".po-amt").textContent = cur() + Math.round(amt).toLocaleString();
        sub += amt;
      });
      const total = sub + (+document.getElementById("po_tax").value || 0) - (+document.getElementById("po_discount").value || 0);
      document.getElementById("po-total").textContent = cur() + Math.round(total).toLocaleString();
    };
    const bindRows = () => box.querySelectorAll(".po-row").forEach((r) => {
      r.oninput = calc;
      r.querySelector(".po-rm").onclick = () => { r.remove(); calc(); };
    });
    const addRow = () => {
      box.insertAdjacentHTML("beforeend", `<div class="po-row grid grid-cols-[1fr_70px_110px_90px_32px] gap-2 items-center">
        <input class="inp po-desc" placeholder="Description…"/><input class="inp font-num po-qty" type="number" min="0" value="1"/>
        <input class="inp font-num po-price" type="number" min="0" value="0"/><span class="po-amt text-[.8rem] font-bold font-num text-right">Rp0</span>
        <button class="btn-g !px-2 !py-1 po-rm">✕</button></div>`);
      bindRows();
    };
    addRow(); addRow(); calc();
    document.getElementById("po-addrow").onclick = addRow;
    document.getElementById("po_tax").oninput = calc;
    document.getElementById("po_discount").oninput = calc;
    document.querySelector('[name="po_currency"]').onchange = calc;
  }
  function savePurchaseOrder() {
    const g = (n) => document.querySelector(`[name="${n}"]`)?.value || "";
    if (!g("po_supplier")) return U().toast("Supplier required");
    const items = [...document.querySelectorAll(".po-row")].map((r) => ({
      description: r.querySelector(".po-desc").value.trim(),
      qty: +r.querySelector(".po-qty").value || 0,
      unit_price: +r.querySelector(".po-price").value || 0,
    })).filter((it) => it.description).map((it) => ({ ...it, amount: it.qty * it.unit_price }));
    if (!items.length) return U().toast("Add at least one line item");
    const sub = items.reduce((a, it) => a + it.amount, 0);
    const tax = +g("po_tax") || 0, disc = +g("po_discount") || 0;
    const btn = document.getElementById("po-save"); btn.textContent = "Saving…"; btn.disabled = true;
    setTimeout(() => {
      const po = S().insert("purchaseOrders", {
        number: S().nextPONumber(), supplier_id: g("po_supplier"), project_id: g("po_project") || null,
        issue_date: g("po_issue") || S().today(), due_date: g("po_due"), status: g("po_status") || "Draft",
        currency: g("po_currency") || "IDR", subtotal: sub, tax, discount: disc, total: sub + tax - disc,
        bill_id: null, notes: g("po_notes"), items,
      });
      U().closeModal();
      if (po.status === "Confirmed") {
        const bill = S().createBillFromPO(po.id);
        U().toast("Order " + po.number + " confirmed.", "Bill " + bill.number + " auto-created →");
        location.hash = "#/print/bill/" + bill.id;
      } else {
        U().toast("Purchase order saved as draft.", po.number);
        render();
      }
    }, 350);
  }

  function newBill() {
    const num = S().nextBillNumber();
    const freePO = S().list("purchaseOrders").filter((o) => !o.bill_id && !s_bill(o));
    function s_bill(o) { return o.bill_id || S().billByPO(o.id); }
    formModal("New bill", `
      ${F("Number", T("number", num))} ${F("Supplier", Sel("supplier_id", supplierOpts()))}
      ${F("Project (optional)", Sel("project_id", `<option value="">—</option>` + projectOpts()))}
      ${F("Purchase order (optional)", `<select name="purchase_order_id" class="inp"><option value="">— standalone</option>${freePO.map((o) => `<option value="${o.id}">${esc(o.number)} · ${esc(S().supplierName(o.supplier_id))}</option>`).join("")}</select>`)}
      ${F("Total *", `<input name="total" type="number" class="inp font-num" value="500000"/>`)}
      ${F("Currency", Sel("currency", opt(["IDR", "USD"], "IDR")))}
      ${F("Issue", Dd("issue_date", S().today()))} ${F("Due", Dd("due_date", S().addDaysTo(S().today(), 14)))}
      ${F("Status", Sel("status", opt(C().billStatuses, "Unpaid")))}`, (v) => {
      const po = v.purchase_order_id ? S().get("purchaseOrders", v.purchase_order_id) : null;
      const bill = S().insert("bills", { ...v, purchase_order_id: po?.id || null, supplier_id: po?.supplier_id || v.supplier_id, project_id: v.project_id || po?.project_id || null, total: po ? po.total : (+v.total || 0), subtotal: po ? po.subtotal : (+v.total || 0), tax: po?.tax || 0, discount: po?.discount || 0, amount_paid: 0, items: po ? (po.items || []).map((it) => ({ ...it })) : [{ description: "Vendor services", qty: 1, unit_price: +v.total || 0, amount: +v.total || 0 }] });
      if (po) S().update("purchaseOrders", po.id, { status: "Billed", bill_id: bill.id });
    });
  }

  function poDrawer(id) {
    const s = S(), u = U();
    const o = s.get("purchaseOrders", id); if (!o) return;
    const bill = o.bill_id ? s.get("bills", o.bill_id) : s.billByPO(o.id);
    U().openDrawer(o.number, `
      <div class="flex items-center gap-2 mb-3">${u.pill(o.status)}<span class="ml-auto font-num font-extrabold">${u.moneyC(o.total, o.currency)}</span></div>
      <div class="text-[.8rem] space-y-1.5 mb-4">${[["Supplier", s.supplierName(o.supplier_id)], ["Project", s.projectName(o.project_id)], ["Issue", o.issue_date], ["Valid until", o.due_date], ["Currency", o.currency]].map((x) => `<div class="flex"><span class="w-24 text-zinc-400">${x[0]}</span><b>${u.esc(x[1] || "—")}</b></div>`).join("")}</div>
      <div class="font-bold text-[.8rem] mb-2">Items</div>
      <div class="card overflow-hidden mb-4"><table class="tbl w-full"><tbody>
        ${(o.items || []).map((it) => `<tr><td>${u.esc(it.description)}<div class="text-[.68rem] text-zinc-400 font-num">${it.qty} × ${u.moneyC(it.unit_price, o.currency)}</div></td><td class="font-num font-bold !text-right">${u.moneyC(it.amount ?? it.qty * it.unit_price, o.currency)}</td></tr>`).join("")}
      </tbody></table></div>
      ${o.notes ? `<p class="text-[.8rem] text-zinc-500 mb-4">${u.esc(o.notes)}</p>` : ""}
      <div class="rounded-xl p-3.5 mb-4 text-[.8rem]" style="background:#FFF1E8;">${bill ? `Linked bill <a href="#/print/bill/${bill.id}" class="font-extrabold" style="color:#7C3AED">${u.esc(bill.number)} (${bill.status})</a>` : `No bill yet — ${o.status === "Confirmed" ? "create one below." : "confirm the order to auto-create it."}`}</div>
      <div class="grid grid-cols-2 gap-2">
        ${o.status === "Draft" ? `<button class="btn-a" id="po-confirm">Confirm order</button>` : ""}
        ${o.status === "Confirmed" && !bill ? `<button class="btn-p" id="po-mkbill">Create bill</button>` : ""}
        ${bill ? `<a class="btn-p text-center" href="#/print/bill/${bill.id}">View bill →</a>` : ""}
        <a class="btn-g text-center" href="#/print/po/${o.id}">⎙ Print PO</a>
      </div>
      <button class="btn-g w-full mt-2 !text-red-600 !border-red-200" id="po-del">Delete order</button>`);
    document.getElementById("po-confirm") && (document.getElementById("po-confirm").onclick = () => {
      s.update("purchaseOrders", id, { status: "Confirmed" });
      const b2 = s.createBillFromPO(id);
      U().toast("Order confirmed.", "Bill " + b2.number + " auto-created →");
      U().closeDrawer(); location.hash = "#/print/bill/" + b2.id;
    });
    document.getElementById("po-mkbill") && (document.getElementById("po-mkbill").onclick = () => {
      const b2 = s.createBillFromPO(id);
      U().toast("Bill created.", b2.number);
      U().closeDrawer(); location.hash = "#/print/bill/" + b2.id;
    });
    document.getElementById("po-del").onclick = () => U().confirmDestructive("Delete this purchase order?", "This cannot be undone.", () => { s.remove("purchaseOrders", id); U().toast("Order deleted."); render(); });
  }

  function billDrawer(id) {
    const s = S(), u = U();
    const b = s.get("bills", id); if (!b) return;
    const po = b.purchase_order_id ? s.get("purchaseOrders", b.purchase_order_id) : null;
    const pays = s.list("transactions").filter((t) => t.bill_id === id);
    const due = (+b.total || 0) - (+b.amount_paid || 0);
    U().openDrawer(b.number, `
      <div class="flex items-center gap-2 mb-3">${u.pill(b.status)}${po ? `<span class="chip">from <b class="ml-1" style="color:#7C3AED">${u.esc(po.number)}</b></span>` : ""}<span class="ml-auto font-num font-extrabold">${u.moneyC(b.total, b.currency)}</span></div>
      <div class="text-[.8rem] space-y-1.5 mb-4">${[["Supplier", s.supplierName(b.supplier_id)], ["Project", s.projectName(b.project_id)], ["Issue", b.issue_date], ["Due", b.due_date], ["Paid", u.moneyC(b.amount_paid, b.currency)], ["Balance owed", u.moneyC(due, b.currency)]].map((x) => `<div class="flex"><span class="w-24 text-zinc-400">${x[0]}</span><b>${x[1]}</b></div>`).join("")}</div>
      <div class="font-bold text-[.8rem] mb-2">Items</div>
      <div class="card overflow-hidden mb-4"><table class="tbl w-full"><tbody>
        ${(b.items || []).map((it) => `<tr><td>${u.esc(it.description)}<div class="text-[.68rem] text-zinc-400 font-num">${it.qty} × ${u.moneyC(it.unit_price, b.currency)}</div></td><td class="font-num font-bold !text-right">${u.moneyC(it.amount ?? it.qty * it.unit_price, b.currency)}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="font-bold text-[.8rem] mb-2">Payments (${pays.length})</div>
      <div class="space-y-1.5 mb-4">${pays.map((t) => `<div class="flex items-center gap-2 text-[.78rem] card px-3 py-2"><span class="font-num text-zinc-400">${u.fmtDate(t.date)}</span><span>${u.esc(t.payment_method || "")}</span><span class="text-zinc-400">← ${u.esc(s.accountName(t.account_id))}</span><b class="ml-auto font-num">−${u.moneyC(t.amount, t.currency)}</b></div>`).join("") || `<p class="text-[.76rem] text-zinc-400">No payments yet.</p>`}</div>
      <div class="grid grid-cols-2 gap-2">
        <a class="btn-p text-center" href="#/print/bill/${b.id}">⎙ Print / PDF</a>
        ${due > 0 && b.status !== "Cancelled" ? `<button class="btn-a" id="bill-pay">Pay bill</button>` : ""}
      </div>
      <button class="btn-g w-full mt-2 !text-red-600 !border-red-200" id="bill-del">Delete bill</button>`);
    document.getElementById("bill-pay") && (document.getElementById("bill-pay").onclick = () => payBillForm(id));
    document.getElementById("bill-del").onclick = () => U().confirmDestructive("Delete this bill?", "Payments already recorded stay in Transactions.", () => { s.remove("bills", id); U().toast("Bill deleted."); render(); });
  }

  function payBillForm(billId) {
    const s = S(), u = U();
    const b = s.get("bills", billId); if (!b) return;
    const due = (+b.total || 0) - (+b.amount_paid || 0);
    const accs = s.list("accounts").filter((a) => a.is_active);
    if (!accs.length) return U().toast("Add a payment account first", "Finance → Accounts");
    formModal("Pay bill · " + b.number, `
      ${F("Amount owed", `<div class="text-[1.15rem] font-extrabold font-num">${u.moneyC(due, b.currency)}</div>`)}
      ${F("Amount paid *", `<input name="b_amount" type="number" class="inp font-num" value="${due}" max="${due}"/>`)}
      ${F("Date", Dd("b_date", s.today()))}
      ${F("Method *", Sel("b_method", opt(C().paymentMethods, "Bank Transfer")))}
      ${F("Pay from account *", `<select name="b_account" class="inp">${accs.map((a) => `<option value="${a.id}">${u.esc(a.name)} · ${a.currency} (${u.moneyC(a.balance, a.currency)})</option>`).join("")}</select>`, 1)}
      <div class="sm:col-span-2 text-[.74rem] text-zinc-500 rounded-lg p-3" style="background:#FFF1E8;">Balance leaves the chosen account instantly and posts as an expense.</div>`, (v) => {
      const acc = s.get("accounts", v.b_account);
      const ok = s.payBill(billId, { accountId: v.b_account, method: v.b_method, amount: +v.b_amount || 0, date: v.b_date });
      if (!ok) return U().toast("Nothing to record", "Amount must be above zero");
      U().toast("Bill paid.", `${v.b_method} ← ${acc ? acc.name : ""}`);
      render();
    });
  }

  function newExpense() {
    formModal("New expense", `
      ${F("Category", Sel("category", opt(C().expenseCategories, "Operations")))}
      ${F("Amount ($) *", `<input name="amount" type="number" class="inp font-num" value="250"/>`)}
      ${F("Date", Dd("date", S().today()))} ${F("Vendor", T("vendor", ""))}
      ${F("Project", Sel("project_id", `<option value="">—</option>` + projectOpts()))}
      ${F("Notes", Ta("notes", ""), 1)}`, (v) => {
      S().insert("expenses", { ...v, amount: +v.amount || 0, project_id: v.project_id || null, status: "Pending" });
    });
  }

  /* ---------- drawers ---------- */
  function taskDrawer(id) {
    const s = S(), u = U();
    const t = s.get("tasks", id); if (!t) return;
    const subs = s.list("subtasks").filter((x) => x.task_id === id);
    const coms = s.list("comments").filter((x) => x.task_id === id);
    U().openDrawer(t.title, `
      <div class="flex items-center gap-2 mb-3">${u.pill(t.status)} ${u.pill(t.priority)} <span class="ml-auto text-[.72rem] text-zinc-400 font-num">due ${u.fmtDate(t.due_date)} · ${u.rel(t.due_date)}</span></div>
      <p class="text-[.83rem] text-zinc-600 leading-relaxed mb-4">${u.esc(t.description || "No description.")}</p>
      <div class="grid grid-cols-2 gap-2 mb-4 text-[.78rem]">
        <div class="rounded-lg bg-[#FAFAF9] border p-3"><div class="kpi-label">Project</div><div class="font-semibold">${u.esc(s.projectName(t.project_id))}</div></div>
        <div class="rounded-lg bg-[#FAFAF9] border p-3"><div class="kpi-label">Assignee</div><div class="font-semibold flex items-center gap-2">${u.avatar(t.assignee, 22)} ${u.esc(t.assignee || "—")}</div></div>
        <div class="rounded-lg bg-[#FAFAF9] border p-3"><div class="kpi-label">Estimate</div><div class="font-semibold font-num">${t.est_hours}h / ${t.actual_hours}h actual</div></div>
        <div class="rounded-lg bg-[#FAFAF9] border p-3"><div class="kpi-label">Move status</div>
          <select id="d-status" class="inp !py-1.5 mt-1">${opt(C().taskStatuses, t.status)}</select></div>
      </div>
      <div class="font-bold text-[.8rem] mb-2">Checklist (${subs.filter((x) => x.is_done).length}/${subs.length})</div>
      <div class="space-y-1.5 mb-3" id="d-subs">${subs.map((x) => `<label class="flex items-center gap-2 text-[.8rem] card px-3 py-2 cursor-pointer"><input type="checkbox" data-sub="${x.id}" ${x.is_done ? "checked" : ""} class="accent-[#FF6600]"/><span class="${x.is_done ? "line-through text-zinc-400" : ""}">${u.esc(x.title)}</span></label>`).join("") || `<p class="text-[.76rem] text-zinc-400">No subtasks.</p>`}</div>
      <div class="flex gap-2 mb-5"><input id="d-newsub" class="inp" placeholder="Add checklist item…"/><button class="btn-g" id="d-addsub">Add</button></div>
      <div class="font-bold text-[.8rem] mb-2">Comments</div>
      <div class="space-y-2 mb-3">${coms.map((c) => `<div class="rounded-lg bg-[#FAFAF9] border p-3"><div class="text-[.8rem]">${u.esc(c.body)}</div><div class="text-[.68rem] text-zinc-400 mt-1">${u.esc(c.author_name)} · ${u.fmtDT(c.created_at)}</div></div>`).join("") || `<p class="text-[.76rem] text-zinc-400">No comments yet.</p>`}</div>
      <div class="flex gap-2 mb-5"><input id="d-newcom" class="inp" placeholder="Write a comment…"/><button class="btn-g" id="d-addcom">Post</button></div>
      <div class="flex gap-2 pt-2 border-t border-[#F1F1EF]">
        <select id="d-prio" class="inp !w-32">${opt(C().taskPriorities, t.priority)}</select>
        <button class="btn-g" id="d-save">Save</button>
        <button class="btn-g !text-red-600 !border-red-200 ml-auto" id="d-del">Delete</button>
      </div>`);
    document.getElementById("d-status").onchange = (e) => { s.update("tasks", id, { status: e.target.value }); U().toast("Changes saved."); render(); taskDrawer(id); };
    document.getElementById("d-addsub").onclick = () => { const v = document.getElementById("d-newsub").value.trim(); if (!v) return; s.insert("subtasks", { task_id: id, title: v, is_done: false }, false); s.log("added subtask", "task", v); render(); taskDrawer(id); };
    document.getElementById("d-addcom").onclick = () => { const v = document.getElementById("d-newcom").value.trim(); if (!v) return; s.insert("comments", { task_id: id, author_name: C().currentUser.name, body: v, created_at: new Date().toISOString() }, false); s.log("commented on task", "task", t.title); render(); taskDrawer(id); };
    document.querySelectorAll("[data-sub]").forEach((cb) => (cb.onchange = () => { s.update("subtasks", cb.dataset.sub, { is_done: cb.checked }, false); const tt = s.get("tasks", id); if (s.list("subtasks").filter((x) => x.task_id === id).every((x) => x.is_done) && tt.status !== "Done") s.update("tasks", id, { status: "Done" }); render(); taskDrawer(id); }));
    document.getElementById("d-save").onclick = () => { s.update("tasks", id, { priority: document.getElementById("d-prio").value }); U().toast("Changes saved."); render(); U().closeDrawer(); };
    document.getElementById("d-del").onclick = () => U().confirmDestructive("Delete this task?", "This removes the task and its subtasks.", () => { s.remove("tasks", id); U().toast("Task deleted."); render(); });
  }

  function leadDrawer(id) {
    const s = S(), u = U();
    const l = s.get("leads", id); if (!l) return;
    U().openDrawer(l.company, `
      <div class="flex items-center gap-2 mb-3">${u.pill(l.stage)}<span class="chip font-num">${l.probability}%</span><span class="ml-auto font-num font-extrabold">${u.money(l.deal_value)}</span></div>
      <div class="text-[.8rem] space-y-1.5 mb-4">${[["Contact", l.contact_person], ["Email", l.email], ["Phone", l.phone], ["Interest", l.service_interest], ["Source", l.source], ["Owner", l.assigned_to], ["Follow-up", l.next_follow_up], ["Last contact", l.last_contact]].map((x) => `<div class="flex"><span class="w-24 text-zinc-400">${x[0]}</span><b>${u.esc(x[1] || "—")}</b></div>`).join("")}</div>
      <p class="text-[.83rem] text-zinc-600 mb-4">${u.esc(l.notes || "")}</p>
      <label class="lbl">Move stage</label>
      <select id="l-stage" class="inp mb-2">${opt(C().pipelineStages, l.stage)}</select>
      <div class="grid grid-cols-2 gap-2 mb-4"><div><label class="lbl">Value</label><input id="l-val" type="number" class="inp font-num" value="${l.deal_value}"/></div><div><label class="lbl">Probability</label><input id="l-prob" type="number" class="inp font-num" value="${l.probability}"/></div></div>
      <div class="text-[.8rem] rounded-lg p-3 mb-4" style="background:#FFF1E8">Expected revenue <b class="font-num">${u.money((+l.deal_value || 0) * (+l.probability || 0) / 100)}</b></div>
      <div class="flex gap-2"><button class="btn-a flex-1" id="l-save">Save Changes</button><button class="btn-p" id="l-convert">Convert to client</button></div>
      <button class="btn-g w-full mt-2 !text-red-600 !border-red-200" id="l-del">Delete lead</button>`);
    document.getElementById("l-save").onclick = () => {
      s.update("leads", id, { stage: document.getElementById("l-stage").value, deal_value: +document.getElementById("l-val").value || 0, probability: +document.getElementById("l-prob").value || 0 });
      U().toast("Changes saved."); render(); U().closeDrawer();
    };
    document.getElementById("l-convert").onclick = () => convertLead(id);
    document.getElementById("l-del").onclick = () => U().confirmDestructive("Delete this lead?", "The lead record will be removed.", () => { s.remove("leads", id); render(); });
  }

  function convertLead(id) {
    const l = S().get("leads", id); if (!l) return;
    const c = S().insert("clients", { company_name: l.company, contact_person: l.contact_person, email: l.email, phone: l.phone, source: l.source, status: "Active Client", account_manager: l.assigned_to, tags: [], lifetime_value: 0 });
    S().update("leads", id, { stage: "Won", converted_client_id: c.id });
    S().log("converted lead to client", "client", l.company);
    U().toast("Lead converted to client.", l.company);
    location.hash = "#/customer/" + c.id;
  }

  function contentDrawer(id) {
    const s = S(), u = U();
    const c = s.get("content", id); if (!c) return;
    U().openDrawer(c.title, `
      <div class="flex items-center gap-2 mb-3">${u.pill(c.status)}<span class="text-[.72rem] text-zinc-400">${u.esc(c.platform)} · ${u.esc(c.content_type)}</span></div>
      ${c.caption ? `<p class="text-[.83rem] text-zinc-600 mb-3">${u.esc(c.caption)}</p>` : ""}
      <div class="text-[.8rem] space-y-1.5 mb-4">${[["Client", s.clientName(c.client_id)], ["Publish", c.publish_date], ["Deadline", c.deadline], ["Owner", c.assignee], ["Pillar", c.pillar], ["CTA", c.cta]].map((x) => `<div class="flex"><span class="w-20 text-zinc-400">${x[0]}</span><b>${u.esc(x[1] || "—")}</b></div>`).join("")}</div>
      <label class="lbl">Status</label><select id="c-status" class="inp mb-3">${opt(C().contentStatuses, c.status)}</select>
      <label class="lbl">Publish date (drag reschedule)</label><input id="c-date" type="date" class="inp font-num mb-4" value="${c.publish_date || ""}"/>
      <div class="flex gap-2"><button class="btn-a flex-1" id="c-save">Save Changes</button><button class="btn-g !text-red-600" id="c-del">Delete</button></div>`);
    document.getElementById("c-save").onclick = () => { s.update("content", id, { status: document.getElementById("c-status").value, publish_date: document.getElementById("c-date").value }); U().toast("Changes saved."); render(); U().closeDrawer(); };
    document.getElementById("c-del").onclick = () => U().confirmDestructive("Delete this content?", "It will be removed from the calendar.", () => { s.remove("content", id); render(); });
  }

  /* ---------- action dispatch ---------- */
  function handleAction(a, el) {
    const d = el?.dataset || {};
    if (a === "cmdk" || a === "search") return openSearch();
    if (a === "quick") return quickCreate();
    if (a === "new-client") return newClient();
    if (a === "new-lead") return newLead();
    if (a === "new-project") return newProject();
    if (a === "new-task") return newTask(d.id || null, d.status);
    if (a === "new-campaign") return newCampaign();
    if (a === "new-content") return newContent();
    if (a === "new-transaction") return newTransaction();
    if (a === "new-invoice") return newInvoice();
    if (a === "new-sales-order") return newSalesOrder();
    if (a === "new-purchase-order") return newPurchaseOrder();
    if (a === "new-supplier") return newSupplier();
    if (a === "new-bill") return newBill();
    if (a === "new-account") return newAccount();
    if (a === "print-now") return window.print();
    if (a === "back") return history.length > 1 ? history.back() : (location.hash = "#/dashboard");
    if (a === "new-expense") return newExpense();
    if (a === "new-mktevent") {
      return formModal("New marketing event", `${F("Title *", T("title", ""), 1)}${F("Channel", T("channel", "Meta"))}${F("Start", Dd("start_date", S().today()))}${F("End", Dd("end_date", S().today()))}${F("Status", Sel("status", opt(C().marketingStatuses, "Planned")))}${F("Owner", Sel("owner", teamOpts("Sarah Chen")))}`, (v) => {
        if (!v.title) return U().toast("Title required");
        S().insert("marketingEvents", { ...v, kind: "campaign", campaign_id: null, client_id: null });
      });
    }
    if (a === "new-milestone") {
      return formModal("New milestone", `${F("Name *", T("name", ""), 1)}${F("Deadline", Dd("deadline", S().today()))}`, (v) => {
        S().insert("milestones", { project_id: d.id, name: v.name, status: "To Do", deadline: v.deadline });
      });
    }
    if (a === "new-note") {
      return formModal("New note", F("Note", Ta("body", ""), 1), (v) => {
        if (!v.body) return; S().insert("notes", { linked_kind: d.kind, linked_id: d.id, author_name: C().currentUser.name, body: v.body, created_at: new Date().toISOString() });
      });
    }
    if (a === "new-service") {
      return formModal("New service", `${F("Name *", T("name", ""), 1)}${F("Description", Ta("description", ""), 1)}`, (v) => {
        if (!v.name) return; S().insert("services", { key: v.name.toLowerCase().replace(/[^a-z]+/g, ""), name: v.name, description: v.description, category: "Custom", pricing_model: "Scoped", default_duration_days: 30, is_active: true });
      });
    }
    if (a === "upload") {
      const inp = document.createElement("input"); inp.type = "file"; inp.multiple = true;
      inp.onchange = () => { [...inp.files].forEach((f) => window.DB.Storage.upload(f, { linked_kind: d.kind || null, linked_id: d.id || null })); U().toast("Upload complete.", inp.files.length + " file(s)"); render(); };
      return inp.click();
    }
    if (a === "export") return U().toast("Export queued.", "CSV / PDF will download when connected.");
    if (a === "save-settings") { const h = document.getElementById("save-hint"); if (h) { h.textContent = "Saving…"; setTimeout(() => (h.textContent = "Saved ✓"), 600); } return U().toast("Changes saved."); }
    if (a === "connect-sb") {
      const url = document.getElementById("sb-url").value.trim(), key = document.getElementById("sb-key").value.trim();
      localStorage.setItem("signal_supabase_url", url); localStorage.setItem("signal_supabase_key", key);
      C().supabase.url = url; C().supabase.anonKey = key;
      if (!url || !key) { U().toast("Keys cleared — local mode."); return render(); }
      U().toast("Connecting…", url);
      window.DB.test().then(() => { U().toast("Supabase connected.", "Run schema.sql, then Push local data."); render(); })
        .catch((e) => U().toast("Connection failed.", e.message + " — cek schema.sql sudah di-run."));
      return render();
    }
    if (a === "test-sb") {
      window.DB.test().then(() => U().toast("Supabase OK.", "Schema terbaca.")).catch((e) => U().toast("Test gagal.", e.message));
      return;
    }
    if (a === "push-sb") {
      if (!window.DB.useRemote()) return U().toast("Isi anon key + Connect dulu.");
      return U().openModal({
        title: "Push local → Supabase", body: `<p class="text-[.84rem] text-zinc-600">Upload seluruh workspace (ID lama di-remap ke UUID, relasi ikut). Lakukan <b>sekali</b> setelah schema.sql di-run.</p>`,
        actions: [{ label: "Cancel", ghost: true, onClick: () => U().closeModal() },
          { label: "Push now", primary: true, onClick: () => { U().closeModal(); U().toast("Pushing…", "jangan tutup halaman."); window.DB.push().then(() => { U().toast("Synced.", "Local + Supabase sekarang sama."); render(); }).catch((e) => U().toast("Push gagal.", e.message)); } }],
      });
    }
    if (a === "pull-sb") {
      if (!window.DB.useRemote()) return U().toast("Isi anon key + Connect dulu.");
      return U().confirmDestructive("Pull dari Supabase?", "Data lokal ditimpa dengan isi Supabase.", () => {
        window.DB.pull().then(() => { U().toast("Refreshed from Supabase."); render(); }).catch((e) => U().toast("Pull gagal.", e.message));
      });
    }
    if (a === "disconnect-sb") { localStorage.removeItem("signal_supabase_url"); localStorage.removeItem("signal_supabase_key"); C().supabase.url = ""; C().supabase.anonKey = ""; U().toast("Disconnected — local mode."); return render(); }
    if (a === "reset") return U().confirmDestructive("Reset demo data?", "All local changes will be replaced with fresh seed data.", () => { S().reset(); render(); });
  }

  /* ---------- event wiring ---------- */
  function bindDynamic() {
    document.querySelectorAll("[data-go]").forEach((el) => (el.onclick = (e) => { if (e.target.closest("button")) return; location.hash = el.dataset.go; }));
    document.querySelectorAll("[data-task]").forEach((el) => (el.onclick = (e) => { if (window._dragging) return; e.stopPropagation(); U().closeModal(); taskDrawer(el.dataset.task); }));
    document.querySelectorAll("[data-lead]").forEach((el) => (el.onclick = (e) => { if (window._dragging) return; e.stopPropagation(); leadDrawer(el.dataset.lead); }));
    document.querySelectorAll("[data-content]").forEach((el) => (el.onclick = (e) => { if (window._dragging) return; e.stopPropagation(); contentDrawer(el.dataset.content); }));
    document.querySelectorAll("[data-so]").forEach((el) => (el.onclick = (e) => { e.stopPropagation(); soDrawer(el.dataset.so); }));
    document.querySelectorAll("[data-po]").forEach((el) => (el.onclick = (e) => { e.stopPropagation(); poDrawer(el.dataset.po); }));
    document.querySelectorAll("[data-bill]").forEach((el) => (el.onclick = (e) => { e.stopPropagation(); billDrawer(el.dataset.bill); }));
    document.querySelectorAll("[data-print-po]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); location.hash = "#/print/po/" + b.dataset.printPo; }));
    document.querySelectorAll("[data-print-bill]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); location.hash = "#/print/bill/" + b.dataset.printBill; }));
    document.querySelectorAll("[data-po-bill]").forEach((b) => (b.onclick = () => { const bl = S().createBillFromPO(b.dataset.poBill); U().toast("Bill created.", bl.number); location.hash = "#/print/bill/" + bl.id; }));
    document.querySelectorAll("[data-paybill]").forEach((b) => (b.onclick = () => payBillForm(b.dataset.paybill)));
    document.querySelectorAll("[data-del-bill]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); U().confirmDestructive("Delete this bill?", "Payments already recorded stay in Transactions.", () => { S().remove("bills", b.dataset.delBill); render(); }); }));
    document.querySelectorAll("[data-edit-sup]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); newSupplier(S().get("suppliers", b.dataset.editSup)); }));
    document.querySelectorAll("[data-invoice]").forEach((el) => (el.onclick = (e) => { e.stopPropagation(); invoiceDrawer(el.dataset.invoice); }));
    document.querySelectorAll("[data-print-inv]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); location.hash = "#/print/invoice/" + b.dataset.printInv; }));
    document.querySelectorAll("[data-print-so]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); location.hash = "#/print/so/" + b.dataset.printSo; }));
    document.querySelectorAll("[data-so-invoice]").forEach((b) => (b.onclick = () => { const inv = S().createInvoiceFromSO(b.dataset.soInvoice); U().toast("Invoice created.", inv.number); location.hash = "#/print/invoice/" + inv.id; }));
    document.querySelectorAll("[data-receive]").forEach((b) => (b.onclick = () => receivePaymentForm(b.dataset.receive)));
    document.querySelectorAll("[data-del-so]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); U().confirmDestructive("Delete this sales order?", "This cannot be undone.", () => { S().remove("salesOrders", b.dataset.delSo); render(); }); }));
    document.querySelectorAll("[data-edit-acc]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); newAccount(S().get("accounts", b.dataset.editAcc)); }));
    document.querySelectorAll("[data-mktevt]").forEach((el) => (el.onclick = () => {
      const ev = S().get("marketingEvents", el.dataset.mktevt); if (!ev) return;
      U().openDrawer(ev.title, `<div class="flex gap-2 mb-3">${U().pill(ev.status)}</div><div class="text-[.8rem] space-y-1.5">${[["Channel", ev.channel], ["Start", ev.start_date], ["End", ev.end_date], ["Owner", ev.owner]].map((x) => `<div class="flex"><span class="w-20 text-zinc-400">${x[0]}</span><b>${U().esc(x[1] || "—")}</b></div>`).join("")}</div><p class="text-[.83rem] text-zinc-600 mt-3">${U().esc(ev.notes || "")}</p><button class="btn-g w-full mt-4 !text-red-600" id="me-del">Delete event</button>`);
      document.getElementById("me-del").onclick = () => U().confirmDestructive("Delete this event?", "It will be removed from the calendar.", () => { S().remove("marketingEvents", ev.id); render(); });
    }));
    document.querySelectorAll("[data-ptab]").forEach((b) => (b.onclick = () => { window._ptab = b.dataset.ptab; render(); }));
    document.querySelectorAll("[data-ctab]").forEach((b) => (b.onclick = () => { window._ctab = b.dataset.ctab; render(); }));
    document.querySelectorAll("[data-tview]").forEach((b) => (b.onclick = () => { window._taskview = b.dataset.tview; render(); }));
    document.querySelectorAll("[data-mktview]").forEach((b) => (b.onclick = () => { window._mktview = b.dataset.mktview; render(); }));
    document.querySelectorAll("[data-contentview]").forEach((b) => (b.onclick = () => { window._contentview = b.dataset.contentview; render(); }));
    document.querySelectorAll("[data-pipeview]").forEach((b) => (b.onclick = () => { window._pipeview = b.dataset.pipeview; render(); }));
    document.querySelectorAll("[data-pf]").forEach((b) => (b.onclick = () => { window._filter = { ...window._filter, projects: { ...(window._filter?.projects || { q: "" }), status: b.dataset.pf } }; render(); }));
    document.querySelectorAll("[data-cal]").forEach((b) => (b.onclick = () => {
      const cur = window._calCursor ? new Date(window._calCursor) : new Date();
      cur.setMonth(cur.getMonth() + (+b.dataset.cal)); window._calCursor = cur.toISOString(); render();
    }));
    const pq = document.getElementById("pq"); if (pq) pq.oninput = () => { window._filter = { ...window._filter, projects: { status: window._filter?.projects?.status || "All", q: pq.value } }; const pos = pq.selectionStart; render(); const nq = document.getElementById("pq"); if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); } };
    const tq = document.getElementById("tq"); if (tq) tq.oninput = () => { window._filter = { ...window._filter, tasks: tq.value }; const pos = tq.selectionStart; render(); const nq = document.getElementById("tq"); if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); } };
    const cq = document.getElementById("cq"); if (cq) cq.oninput = () => { window._filter = { ...window._filter, customers: cq.value }; const pos = cq.selectionStart; render(); const nq = document.getElementById("cq"); if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); } };

    document.querySelectorAll("[data-action]").forEach((el) => (el.onclick = (e) => { e.stopPropagation(); handleAction(el.dataset.action, el); }));
    document.querySelectorAll("[data-edit-project]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const p = S().get("projects", b.dataset.editProject);
      formModal("Edit project", `${F("Name", T("name", p.name), 1)}${F("Status", Sel("status", opt(C().projectStatuses, p.status)))}${F("Deadline", Dd("deadline", p.deadline))}${F("Budget", `<input name="budget" type="number" class="inp font-num" value="${p.budget}"/>`)}`, (v) => S().update("projects", p.id, { ...v, budget: +v.budget || 0 })); }));
    document.querySelectorAll("[data-edit-client]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); newClient(S().get("clients", b.dataset.editClient)); }));
    document.querySelectorAll("[data-edit-campaign]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); newCampaign(S().get("campaigns", b.dataset.editCampaign)); }));
    document.querySelectorAll("[data-convert]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); convertLead(b.dataset.convert); }));
    document.querySelectorAll("[data-markpaid]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); receivePaymentForm(b.dataset.markpaid); }));
    document.querySelectorAll("[data-del-inv]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); U().confirmDestructive("Delete this invoice?", "This cannot be undone.", () => { S().remove("invoices", b.dataset.delInv); render(); }); }));
    document.querySelectorAll("[data-del-tx]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); U().confirmDestructive("Delete this transaction?", "This cannot be undone.", () => { S().remove("transactions", b.dataset.delTx); render(); }); }));
    document.querySelectorAll("[data-del-exp]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); U().confirmDestructive("Delete this expense?", "This cannot be undone.", () => { S().remove("expenses", b.dataset.delExp); render(); }); }));
    document.querySelectorAll("[data-use-template]").forEach((b) => (b.onclick = () => newProject(b.dataset.useTemplate)));

    // drag & drop: tasks, leads, content
    bindDrop("[data-drop]", "[data-drag]", (taskId, status) => { S().update("tasks", taskId, { status }); S().log("moved task", "task", S().get("tasks", taskId)?.title + " → " + status); U().toast("Changes saved."); render(); });
    bindDrop("[data-drop-lead]", "[data-drag-lead]", (id, stage) => { S().update("leads", id, { stage }); S().log("moved lead", "lead", S().get("leads", id)?.company + " → " + stage); U().toast("Changes saved."); render(); });
    bindDrop("[data-drop-content]", "[data-drag-content]", (id, status) => { S().update("content", id, { status }); S().log("moved content", "content", S().get("content", id)?.title + " → " + status); U().toast("Changes saved."); render(); });
  }

  function bindDrop(colSel, cardSel, onDrop) {
    document.querySelectorAll(cardSel).forEach((card) => {
      card.addEventListener("dragstart", (e) => { window._dragging = true; e.dataTransfer.setData("text/plain", card.getAttribute(cardSel.slice(1, -1)) || card.dataset.drag || card.dataset.dragLead || card.dataset.dragContent); card.style.opacity = ".5"; });
      card.addEventListener("dragend", () => { card.style.opacity = "1"; setTimeout(() => (window._dragging = false), 120); });
    });
    document.querySelectorAll(colSel).forEach((col) => {
      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
      col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
      col.addEventListener("drop", (e) => {
        e.preventDefault(); col.classList.remove("drag-over");
        const id = e.dataTransfer.getData("text/plain");
        const key = col.dataset.drop || col.dataset.dropLead || col.dataset.dropContent;
        if (id && key) onDrop(id, key);
      });
    });
  }

  /* ---------- shell events ---------- */
  function notifPanel() {
    const ns = S().list("notifications");
    U().openDrawer("Notifications", ns.map((n) => `
      <a href="${n.link}" class="block card px-4 py-3 mb-2 ${n.is_read ? "opacity-60" : ""}" data-notif="${n.id}">
        <div class="text-[.82rem] font-bold">${U().esc(n.title)}</div>
        <div class="text-[.76rem] text-zinc-500">${U().esc(n.body)}</div>
        <div class="text-[.65rem] text-zinc-400 mt-1">${U().rel(n.created_at)}</div></a>`).join("") || U().empty("No notifications."));
    document.querySelectorAll("[data-notif]").forEach((a) => (a.onclick = () => { S().update("notifications", a.dataset.notif, { is_read: true }, false); U().closeDrawer(); render(); }));
  }

  function boot() {
    document.getElementById("btn-search").onclick = openSearch;
    document.getElementById("btn-quick").onclick = quickCreate;
    document.getElementById("btn-notif").onclick = notifPanel;
    document.getElementById("btn-collapse").onclick = () => document.getElementById("app").classList.toggle("rail");
    document.getElementById("btn-menu").onclick = () => document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("btn-avatar").onclick = () => (location.hash = "#/settings");
    window.addEventListener("hashchange", render);
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
      if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) quickCreate();
      if (e.key === "Escape") { U().closeModal(); U().closeDrawer(); document.getElementById("sidebar")?.classList.remove("open"); }
    });
    S().subscribe(() => renderNav());
    if (!location.hash) location.hash = "#/dashboard";
    // greeting name
    const d = new Date(); const hh = d.getHours();
    render();
  }

  window.SignalApp = { boot, render, openSearch, quickCreate };
  document.addEventListener("DOMContentLoaded", boot);
})();
