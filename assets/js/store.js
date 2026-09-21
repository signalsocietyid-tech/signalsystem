/* ============================================================
   SIGNAL SYSTEM · Store — state + CRUD + derived business logic
   Supabase-ready: every mutation goes through DB adapter
   (local now, Supabase later) and emits an activity entry.
   ============================================================ */
window.SignalStore = (function () {
  const LS_KEY = "signal_system_v2"; // v2: demo data removed, fresh empty workspace
  let state = null;
  const listeners = new Set();
  const uid = (p) => p + "_" + Math.random().toString(36).slice(2, 9);
  const today = () => new Date().toISOString().slice(0, 10);

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        state = JSON.parse(raw);
        // migrate: backfill collections added in later versions
        const s = window.SignalSeed;
        ["salesOrders", "accounts", "suppliers", "purchaseOrders", "bills"].forEach((k) => { if (!Array.isArray(state[k])) state[k] = s[k] || []; });
        persist(); return;
      }
    } catch (e) {}
    const s = window.SignalSeed;
    state = {
      clients: s.clients, leads: s.leads, projects: s.projects,
      milestones: s.milestones, tasks: s.tasks, subtasks: s.subtasks,
      comments: s.comments, campaigns: s.campaigns, content: s.content,
      marketingEvents: s.marketingEvents, invoices: s.invoices,
      salesOrders: s.salesOrders || [], accounts: s.accounts || [],
      suppliers: s.suppliers || [], purchaseOrders: s.purchaseOrders || [], bills: s.bills || [],
      transactions: s.transactions, expenses: s.expenses,
      services: s.services, templates: s.templates, files: s.files,
      activities: s.activities, notifications: s.notifications,
      notes: s.notes, plans: s.plans,
    };
    persist();
  }
  function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }
  function emit(evt) { listeners.forEach((fn) => { try { fn(evt); } catch (e) {} }); persist(); }

  function log(action, kind, label, actor) {
    state.activities.unshift({
      id: uid("a"), actor_name: actor || window.SignalConfig.currentUser.name,
      action, entity_kind: kind || "", entity_label: label || "",
      created_at: new Date().toISOString(),
    });
  }
  function notify(title, body, kind, link) {
    state.notifications.unshift({
      id: uid("n"), title, body: body || "", kind: kind || "info",
      link: link || "#/dashboard", is_read: false, created_at: new Date().toISOString(),
    });
  }

  // ---- generic CRUD ----
  function list(coll) { return state[coll] || []; }
  function get(coll, id) { return list(coll).find((x) => x.id === id); }
  function insert(coll, obj, meta) {
    obj.id = obj.id || uid(coll.slice(0, 2));
    list(coll).unshift(obj);
    if (meta !== false) log("created " + coll.slice(0, -1), coll, obj.name || obj.title || obj.company || obj.company_name || obj.number || obj.id);
    emit({ type: coll + ":insert", row: obj });
    return obj;
  }
  function update(coll, id, patch, meta) {
    const row = get(coll, id); if (!row) return null;
    Object.assign(row, patch);
    if (meta !== false) log("updated " + coll.slice(0, -1), coll, row.name || row.title || row.company || row.company_name || row.number || row.id);
    emit({ type: coll + ":update", row });
    return row;
  }
  function remove(coll, id, label) {
    const i = list(coll).findIndex((x) => x.id === id);
    if (i < 0) return false;
    const [row] = list(coll).splice(i, 1);
    log("deleted " + coll.slice(0, -1), coll, label || row.name || row.title || row.id);
    emit({ type: coll + ":delete", row });
    return true;
  }

  // ---- derived ----
  const clientName = (id) => (get("clients", id) || {}).company_name || "—";
  const projectName = (id) => (get("projects", id) || {}).name || "—";
  const isOverdue = (d) => d && d < today();

  function projectTasks(pid) { return list("tasks").filter((t) => t.project_id === pid); }
  function projectProgress(p) {
    if (p.progress_override != null) return p.progress_override;
    const ts = projectTasks(p.id);
    if (!ts.length) return p.status === "Completed" ? 100 : 0;
    return Math.round((ts.filter((t) => t.status === "Done").length / ts.length) * 100);
  }
  function projectHealth(p) {
    if (p.health_override) return p.health_override;
    const ts = projectTasks(p.id);
    const overdue = ts.filter((t) => t.status !== "Done" && isOverdue(t.due_date)).length;
    const blocked = ts.filter((t) => t.status === "Blocked").length;
    const spent = (p.estimated_cost || 0) > 0 && (actualCost(p.id) / (p.budget || 1)) > 0.9;
    if (overdue >= 2 || blocked >= 1 && overdue >= 1 || (p.deadline && isOverdue(p.deadline) && p.status !== "Completed")) return "Delayed";
    if (overdue >= 1 || blocked >= 1 || spent) return "At Risk";
    return "Healthy";
  }
  function actualCost(pid) {
    return list("expenses").filter((e) => e.project_id === pid).reduce((s, e) => s + (+e.amount || 0), 0)
      + list("transactions").filter((t) => t.project_id === pid && t.type === "Expense").reduce((s, e) => s + (+e.amount || 0), 0);
  }
  function financeTotals(range) {
    const tx = list("transactions");
    const inR = tx.filter((t) => t.type === "Income").reduce((s, t) => s + (+t.amount || 0), 0);
    const exR = tx.filter((t) => t.type === "Expense").reduce((s, t) => s + (+t.amount || 0), 0);
    const outstanding = list("invoices").filter((i) => ["Sent", "Viewed", "Partially Paid", "Overdue"].includes(i.status))
      .reduce((s, i) => s + ((+i.total || 0) - (+i.amount_paid || 0)), 0);
    return { revenue: inR, expenses: exR, profit: inR - exR, outstanding };
  }
  function pipelineValue() {
    return list("leads").filter((l) => !["Won", "Lost"].includes(l.stage))
      .reduce((s, l) => s + (+l.deal_value || 0), 0);
  }
  function attention() {
    const out = [];
    const overdueTasks = list("tasks").filter((t) => t.status !== "Done" && isOverdue(t.due_date));
    if (overdueTasks.length) out.push({ kind: "tasks", label: overdueTasks.length + " task(s) overdue", link: "#/tasks", items: overdueTasks.slice(0, 4) });
    const dueSoon = list("tasks").filter((t) => t.status !== "Done" && !isOverdue(t.due_date) && t.due_date && t.due_date <= addDays(3));
    if (dueSoon.length) out.push({ kind: "deadlines", label: dueSoon.length + " deadline(s) within 3 days", link: "#/tasks", items: dueSoon.slice(0, 4) });
    const odInv = list("invoices").filter((i) => i.status === "Overdue");
    if (odInv.length) out.push({ kind: "invoices", label: odInv.length + " invoice(s) overdue", link: "#/invoices", items: odInv.slice(0, 4) });
    const stale = list("leads").filter((l) => !["Won", "Lost"].includes(l.stage) && l.next_follow_up && l.next_follow_up <= today());
    if (stale.length) out.push({ kind: "leads", label: stale.length + " lead(s) need follow-up", link: "#/pipeline", items: stale.slice(0, 4) });
    const appr = list("content").filter((c) => ["Internal Review", "Client Review"].includes(c.status));
    if (appr.length) out.push({ kind: "content", label: appr.length + " content piece(s) awaiting approval", link: "#/content-calendar", items: appr.slice(0, 4) });
    const camp = list("campaigns").filter((c) => c.status === "Planning");
    if (camp.length) out.push({ kind: "campaigns", label: camp.length + " campaign(s) awaiting launch", link: "#/campaigns", items: camp.slice(0, 4) });
    const openSO = list("salesOrders").filter((o) => o.status === "Confirmed" && !o.invoice_id);
    if (openSO.length) out.push({ kind: "sales", label: openSO.length + " confirmed order(s) not yet invoiced", link: "#/sales-orders", items: openSO.slice(0, 4) });
    const openPO = list("purchaseOrders").filter((o) => o.status === "Confirmed" && !o.bill_id);
    if (openPO.length) out.push({ kind: "purchase", label: openPO.length + " confirmed purchase(s) not yet billed", link: "#/purchase-orders", items: openPO.slice(0, 4) });
    const odBill = list("bills").filter((b) => b.status === "Overdue");
    if (odBill.length) out.push({ kind: "bills", label: odBill.length + " bill(s) overdue to suppliers", link: "#/bills", items: odBill.slice(0, 4) });
    return out;
  }
  function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function addDaysTo(dateStr, n) { const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

  // ---- sales orders → invoices (automatic flow) ----
  function nextNumber(prefix, coll, field) {
    let max = 0;
    list(coll).forEach((r) => {
      const m = String(r[field] || "").match(new RegExp("^" + prefix + "-(\\d+)$"));
      if (m) max = Math.max(max, +m[1]);
    });
    return prefix + "-" + (max + 1);
  }
  const nextSONumber = () => nextNumber("SO", "salesOrders", "number");
  const nextInvoiceNumber = () => nextNumber("INV", "invoices", "number");
  const accountName = (id) => (get("accounts", id) || {}).name || "—";
  const soByInvoice = (invId) => list("salesOrders").find((o) => o.invoice_id === invId) || null;

  function createInvoiceFromSO(soId) {
    const so = get("salesOrders", soId); if (!so) return null;
    if (so.invoice_id && get("invoices", so.invoice_id)) return get("invoices", so.invoice_id);
    const inv = insert("invoices", {
      number: nextInvoiceNumber(), client_id: so.client_id, project_id: so.project_id || null,
      sales_order_id: so.id, issue_date: today(), due_date: so.due_date || addDays(14),
      subtotal: so.subtotal || 0, tax: so.tax || 0, discount: so.discount || 0, total: so.total || 0,
      amount_paid: 0, status: "Draft", currency: so.currency || "USD",
      notes: "Auto-generated from " + so.number,
      items: (so.items || []).map((it) => ({ description: it.description, qty: +it.qty || 0, unit_price: +it.unit_price || 0, amount: (+it.qty || 0) * (+it.unit_price || 0) })),
    });
    update("salesOrders", soId, { status: "Invoiced", invoice_id: inv.id });
    notify("Invoice drafted", inv.number + " · auto-created from " + so.number, "info", "#/print/invoice/" + inv.id);
    return inv;
  }

  // ---- payments: income lands in a chosen account (BCA / PayPal / …) ----
  function receivePayment(invId, opts) {
    const inv = get("invoices", invId); if (!inv) return null;
    const o = opts || {};
    const due = (+inv.total || 0) - (+inv.amount_paid || 0);
    const amount = Math.min(+o.amount || 0, due);
    if (amount <= 0) return null;
    const acc = get("accounts", o.accountId);
    insert("transactions", {
      date: o.date || today(), type: "Income", category: "Client Payment",
      amount, currency: inv.currency || "USD",
      client_id: inv.client_id, project_id: inv.project_id, invoice_id: inv.id,
      account_id: acc ? acc.id : null, payment_method: o.method || "Bank Transfer",
      status: "Completed", reference: inv.number,
      notes: acc && acc.currency !== (inv.currency || "USD") ? "FX: recorded in invoice currency, confirm rate" : "",
    }, false);
    const paid = (+inv.amount_paid || 0) + amount;
    update("invoices", invId, { amount_paid: paid, status: paid >= (+inv.total || 0) ? "Paid" : "Partially Paid" });
    if (acc) update("accounts", acc.id, { balance: (+acc.balance || 0) + amount }, false);
    log("received payment", "invoice", inv.number + " · " + (o.method || "") + " → " + (acc ? acc.name : "—"));
    notify("Payment received", inv.number + " · " + (o.method || "") + " → " + (acc ? acc.name : "—"), "info", "#/accounts");
    return true;
  }

  // ---- purchase: PO → bill (automatic) → pay out from account ----
  const nextPONumber = () => nextNumber("PO", "purchaseOrders", "number");
  const nextBillNumber = () => nextNumber("BILL", "bills", "number");
  const supplierName = (id) => (get("suppliers", id) || {}).name || "—";
  const billByPO = (poId) => list("bills").find((b) => b.purchase_order_id === poId) || null;

  function createBillFromPO(poId) {
    const po = get("purchaseOrders", poId); if (!po) return null;
    if (po.bill_id && get("bills", po.bill_id)) return get("bills", po.bill_id);
    const bill = insert("bills", {
      number: nextBillNumber(), supplier_id: po.supplier_id, project_id: po.project_id || null,
      purchase_order_id: po.id, issue_date: today(), due_date: po.due_date || addDays(14),
      subtotal: po.subtotal || 0, tax: po.tax || 0, discount: po.discount || 0, total: po.total || 0,
      amount_paid: 0, status: "Unpaid", currency: po.currency || "IDR",
      notes: "Auto-generated from " + po.number,
      items: (po.items || []).map((it) => ({ description: it.description, qty: +it.qty || 0, unit_price: +it.unit_price || 0, amount: (+it.qty || 0) * (+it.unit_price || 0) })),
    });
    update("purchaseOrders", poId, { status: "Billed", bill_id: bill.id });
    notify("Bill received", bill.number + " · auto-created from " + po.number, "info", "#/print/bill/" + bill.id);
    return bill;
  }

  function payBill(billId, opts) {
    const bill = get("bills", billId); if (!bill) return null;
    const o = opts || {};
    const due = (+bill.total || 0) - (+bill.amount_paid || 0);
    const amount = Math.min(+o.amount || 0, due);
    if (amount <= 0) return null;
    const acc = get("accounts", o.accountId);
    insert("transactions", {
      date: o.date || today(), type: "Expense", category: "Vendor Payment",
      amount, currency: bill.currency || "IDR",
      project_id: bill.project_id, bill_id: bill.id,
      account_id: acc ? acc.id : null, payment_method: o.method || "Bank Transfer",
      status: "Completed", reference: bill.number,
      notes: acc && acc.currency !== (bill.currency || "IDR") ? "FX: recorded in bill currency, confirm rate" : "",
    }, false);
    const paid = (+bill.amount_paid || 0) + amount;
    update("bills", billId, { amount_paid: paid, status: paid >= (+bill.total || 0) ? "Paid" : "Partially Paid" });
    if (acc) update("accounts", acc.id, { balance: (+acc.balance || 0) - amount }, false);
    log("paid bill", "bill", bill.number + " · " + (o.method || "") + " ← " + (acc ? acc.name : "—"));
    notify("Bill paid", bill.number + " · " + (o.method || "") + " ← " + (acc ? acc.name : "—"), "info", "#/accounts");
    return true;
  }

  load();
  return {
    get state() { return state; },
    list, get, insert, update, remove, log, notify,
    clientName, projectName, projectTasks, projectProgress, projectHealth,
    actualCost, financeTotals, pipelineValue, attention, isOverdue, today, uid,
    nextSONumber, nextInvoiceNumber, accountName, soByInvoice,
    createInvoiceFromSO, receivePayment, addDaysTo,
    nextPONumber, nextBillNumber, supplierName, billByPO,
    createBillFromPO, payBill,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    replaceAll(patch) { Object.assign(state, patch); emit({ type: "bulk" }); },
    reset() { localStorage.removeItem(LS_KEY); load(); emit({ type: "reset" }); },
  };
})();
