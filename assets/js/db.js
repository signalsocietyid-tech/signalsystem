/* ============================================================
   SIGNAL SYSTEM · Service layer
   - No key   → local mode: Store + localStorage only (offline demo).
   - Key set  → Supabase is the source of truth:
       · sign-in required (Auth), role from public.profiles
       · on sign-in the workspace loads from Supabase (pull)
       · every Store insert/update/delete is mirrored to Supabase;
         if the database refuses (RLS, governance rules) the local
         change is rolled back and the reason is shown
       · lead stage changes go through move_lead() (pipeline rules)
       · approvals / outbox / conversation log via DB.gov (the
         database enforces who may decide and what may be sent)
   UI code keeps using SignalStore; only this adapter knows Supabase.
   ============================================================ */
window.DB = (function () {
  const Store = () => window.SignalStore;
  const cfg = () => window.SignalConfig.supabase;
  const toast = (t, b) => window.UI && window.UI.toast(t, b);
  const changed = () => window.dispatchEvent(new Event("signal:remote"));
  let client = null, clientKey = "";

  function remote() {
    const c = cfg();
    if (!c.url || !c.anonKey) return null;
    if (!window.supabase || !window.supabase.createClient) return null;
    const k = c.url + "|" + c.anonKey;
    if (!client || clientKey !== k) { client = window.supabase.createClient(c.url, c.anonKey); clientKey = k; }
    return client;
  }
  const useRemote = () => !!remote();
  const migrated = () => localStorage.getItem("signal_migrated") === "1";

  // local collection -> Supabase table
  const COLL_TABLE = {
    clients: "clients", leads: "leads", projects: "projects",
    milestones: "milestones", tasks: "tasks", subtasks: "subtasks",
    comments: "task_comments", campaigns: "campaigns", content: "content_items",
    marketingEvents: "marketing_events", invoices: "invoices",
    salesOrders: "sales_orders", purchaseOrders: "purchase_orders",
    bills: "bills", suppliers: "suppliers", accounts: "accounts",
    transactions: "transactions", expenses: "expenses",
    files: "files", notes: "notes", activities: "activities",
    notifications: "notifications", plans: "financial_plans",
    services: "services", templates: "service_templates",
    // governance (written through DB.gov, read on pull)
    approvals: "approvals", outbox: "outbox", leadActivities: "lead_activities", policies: "approval_policies",
  };
  const GOVERNED = new Set(["approvals", "outbox", "leadActivities", "policies"]);
  // collections whose line items live in a child table remotely
  const ITEMS = {
    invoices: { table: "invoice_items", fk: "invoice_id" },
    salesOrders: { table: "sales_order_items", fk: "sales_order_id" },
    purchaseOrders: { table: "purchase_order_items", fk: "purchase_order_id" },
    bills: { table: "bill_items", fk: "bill_id" },
  };
  const FK = ["client_id", "project_id", "supplier_id", "campaign_id", "milestone_id",
    "task_id", "lead_id", "invoice_id", "bill_id", "sales_order_id",
    "purchase_order_id", "account_id", "converted_client_id", "linked_id"];

  function mapTable(t) {
    const inv = {};
    Object.entries(COLL_TABLE).forEach(([c, tbl]) => (inv[tbl] = c));
    return inv[t] || ({ contacts: "clients", invoice_items: "invoices", sales_order_items: "salesOrders" }[t] || t);
  }

  function stripForRemote(coll, row) {
    const r = { ...row };
    delete r.items;
    if (coll === "plans") return {
      id: r.id, month: r.month, revenue_target: r.revenue_target,
      expense_budget: r.expense_budget, marketing_budget: r.marketing_budget,
      ops_budget: r.ops_budget, profit_target: r.profit_target,
      organization_id: null,
    };
    return r;
  }
  // only real columns (assets/js/columns.js), blank form values become null
  function clean(coll, row) {
    const tbl = COLL_TABLE[coll] || coll;
    const cols = (window.SignalColumns || {})[tbl];
    const r = stripForRemote(coll, row), out = {};
    Object.keys(r).forEach((k) => { if (!cols || cols.includes(k)) out[k] = r[k] === "" || r[k] === undefined ? null : r[k]; });
    return out;
  }
  const itemRows = (coll, parentId, items) => (items || []).map((it) => ({
    [ITEMS[coll].fk]: parentId, description: it.description,
    qty: it.qty || 0, unit_price: it.unit_price || 0,
    amount: it.amount ?? (it.qty || 0) * (it.unit_price || 0),
  }));

  // Applies server rows to the Store without mirroring them back.
  let quiet = 0;
  const silently = (fn) => { quiet++; try { return fn(); } finally { quiet--; } };

  /* ---------------- auth ---------------- */
  const Auth = {
    session: null, profile: null,
    get user() { return window.SignalConfig.currentUser; },
    async init() {
      const r = remote(); if (!r) return null;
      const { data } = await r.auth.getSession();
      this.session = data.session;
      if (this.session) await this.loadProfile();
      return this.session;
    },
    async loadProfile() {
      const { data } = await remote().from("profiles").select("*").eq("id", this.session.user.id).maybeSingle();
      this.profile = data || null;
      if (data) {
        const name = data.full_name || this.session.user.email;
        window.SignalConfig.currentUser = {
          id: data.id, name, email: this.session.user.email,
          role: data.role.charAt(0).toUpperCase() + data.role.slice(1),
          initials: name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
        };
      }
      return this.profile;
    },
    async signIn(email, password) {
      const { data, error } = await remote().auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "Email or password is not correct." : error.message);
      this.session = data.session;
      if (!(await this.loadProfile())) {
        await this.signOut();
        throw new Error("This account has no Signal System profile yet. Ask an admin to add one.");
      }
      return this.session;
    },
    async signOut() {
      stopRealtime();
      const r = remote(); if (r) await r.auth.signOut();
      this.session = null; this.profile = null; live = false;
    },
    signedIn() { return !!(this.session && this.profile); },
    role() { return this.profile ? this.profile.role : (useRemote() ? null : "admin"); },
    can(action) { // view · create · edit · delete — the database enforces the same rules
      const r = this.role(); if (!r) return false;
      if (r === "viewer") return action === "view";
      if (action === "delete") return r === "admin";
      return true;
    },
    canDecide(category) {
      const r = this.role(); if (r === "admin") return true;
      const pol = Store().list("policies").find((p) => p.category === category);
      return !!(pol && pol.delegate_role && pol.delegate_role === r);
    },
  };

  /* ---------------- live sync ---------------- */
  let live = false, chain = Promise.resolve();
  const knownStage = {};
  const isLive = () => live && Auth.signedIn() && !!remote();
  const enqueue = (task) => (chain = chain.then(task).catch((e) => console.error("[sync]", e)));

  async function refreshRow(coll, id) {
    const { data } = await remote().from(COLL_TABLE[coll]).select("*").eq("id", id).maybeSingle();
    silently(() => {
      if (!data) return Store().remove(coll, id, "", false);
      if (Store().get(coll, id)) Store().update(coll, id, data, false);
      else Store().insert(coll, data, false);
    });
    if (coll === "leads" && data) knownStage[id] = data.stage;
    changed();
  }
  async function refuse(coll, id, error) {
    toast("Not saved — " + (error.message || "the database refused this change."), "Your change was undone.");
    await refreshRow(coll, id);
  }

  async function mirror(evt) {
    const [coll, op] = String(evt.type).split(":");
    if (!op || !COLL_TABLE[coll] || GOVERNED.has(coll)) return;
    const r = remote(), tbl = COLL_TABLE[coll], row = evt.row;
    if (op === "insert") {
      const body = clean(coll, row);
      if (coll === "activities") body.actor_id = Auth.profile.id;
      const { data, error } = await r.from(tbl).insert(body).select().maybeSingle();
      if (error) {
        toast("Not saved — " + error.message, "Your change was undone.");
        silently(() => Store().remove(coll, row.id, "", false)); changed(); return;
      }
      if (ITEMS[coll] && row.items && row.items.length) {
        const ir = await r.from(ITEMS[coll].table).insert(itemRows(coll, row.id, row.items));
        if (ir.error) toast("Line items not saved — " + ir.error.message);
      }
      if (data) silently(() => Store().update(coll, row.id, { ...data, items: row.items }, false));
      if (coll === "leads" && data) knownStage[row.id] = data.stage;
    } else if (op === "update") {
      const body = clean(coll, row); delete body.id;
      if (coll === "leads") {
        const prev = knownStage[row.id];
        if (prev !== undefined && row.stage !== prev) {
          const { error } = await r.rpc("move_lead", { p_id: row.id, p_to: row.stage, p_reason: row.stage_reason || null, p_nurture_until: row.nurture_until || null });
          if (error) return refuse(coll, row.id, error);
          knownStage[row.id] = row.stage;
        }
        ["stage", "stage_reason", "stage_changed_at", "nurture_until"].forEach((k) => delete body[k]);
      }
      const { data, error } = await r.from(tbl).update(body).eq("id", row.id).select("id");
      if (error) return refuse(coll, row.id, error);
      if (!data || !data.length) return refuse(coll, row.id, { message: "your role cannot edit this." });
      if (ITEMS[coll] && row.items) {
        const { table, fk } = ITEMS[coll];
        const del = await r.from(table).delete().eq(fk, row.id);
        if (!del.error && row.items.length) await r.from(table).insert(itemRows(coll, row.id, row.items));
      }
      if (coll === "leads") await refreshRow(coll, row.id); // stage_reason, stage_changed_at, client status
    } else if (op === "delete") {
      const { data, error } = await r.from(tbl).delete().eq("id", row.id).select("id");
      if (error || !data || !data.length) {
        toast("Not deleted — " + (error ? error.message : "only an admin can delete this."), "It has been restored.");
        silently(() => Store().insert(coll, row, false)); changed();
      }
    }
  }

  async function start() {
    if (!Auth.signedIn()) return;
    const r = remote();
    // first sign-in on a fresh project: upload the master data (services + templates) once
    if (!migrated()) {
      const { count } = await r.from("services").select("id", { count: "exact", head: true });
      if (!count) await push();
      else localStorage.setItem("signal_migrated", "1");
    }
    await pull();
    live = true;
    startRealtime();
  }

  let channel = null;
  function startRealtime() {
    const r = remote(); if (!r || channel) return;
    channel = r.channel("signal-gov")
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, () => refresh(["approvals"]))
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, () => refresh(["activities", "notifications", "outbox"]))
      .subscribe();
  }
  function stopRealtime() { const r = remote(); if (r && channel) r.removeChannel(channel); channel = null; }

  let refreshTimer = null, pending = new Set();
  function refresh(colls) {
    colls.forEach((c) => pending.add(c));
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      const list = [...pending]; pending = new Set();
      const patch = {};
      for (const c of list) patch[c] = await getAll(COLL_TABLE[c]);
      silently(() => Store().replaceAll(patch));
      changed();
    }, 400);
  }

  async function getAll(tbl) {
    const r = remote();
    if (tbl === "activities") { // the feed, not the archive (audit_log keeps everything)
      const { data, error } = await r.from(tbl).select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw new Error(tbl + ": " + error.message);
      return data || [];
    }
    const NEWEST_FIRST = { notifications: "created_at", outbox: "created_at", approvals: "requested_at", lead_activities: "occurred_at" };
    let all = [], from = 0;
    for (;;) {
      let q = r.from(tbl).select("*").range(from, from + 999);
      if (NEWEST_FIRST[tbl]) q = q.order(NEWEST_FIRST[tbl], { ascending: false });
      const { data, error } = await q;
      if (error) throw new Error(tbl + ": " + error.message);
      all = all.concat(data || []);
      if (!data || data.length < 1000) break;
      from += 1000;
    }
    return all;
  }

  // Lead stage change through the database rules (move_lead); local mode just updates.
  async function moveLead(id, to, reason, nurtureUntil) {
    const l = Store().get("leads", id);
    if (!isLive()) { Store().update("leads", id, { stage: to, stage_reason: reason || null }); return; }
    const { error } = await remote().rpc("move_lead", { p_id: id, p_to: to, p_reason: reason || null, p_nurture_until: nurtureUntil || null });
    if (error) throw new Error(error.message);
    knownStage[id] = to;
    await refreshRow("leads", id); // stage, reason, converted_client_id
    if (l && l.client_id) await refreshRow("clients", l.client_id); // status follows the lead (Prospect / Active Client)
    Store().log("moved lead", "lead", (l ? l.company : "") + " → " + to);
  }

  /* ---------------- governance ---------------- */
  const need = () => { if (!isLive()) throw new Error("Sign in to Supabase first (Settings)."); return remote(); };
  const gov = {
    // CEO / delegate decisions, exact-content approvals, the outbox and the conversation log
    async request(a) {
      const r = need();
      const { data, error } = await r.from("approvals").insert({ ...a, requested_by: Auth.profile.id }).select().single();
      if (error) throw error;
      silently(() => Store().insert("approvals", data, false)); changed();
      return data;
    },
    async decide(id, decision, note, instructions) {
      const r = need();
      const { error } = await r.rpc("decide_approval", { p_id: id, p_decision: decision, p_note: note || null, p_instructions: instructions || null });
      if (error) throw error;
      await refreshRow("approvals", id);
    },
    async queue(approvalId) {
      const r = need();
      const a = Store().get("approvals", approvalId); if (!a) throw new Error("Approval not found.");
      const p = a.payload || {};
      const { data, error } = await r.from("outbox").insert({ approval_id: a.id, channel: p.channel, recipient: p.recipient, subject: p.subject || null, body: p.body }).select().single();
      if (error) throw new Error(/outbox_approval_id_key/.test(error.message) ? "Already queued — an approval sends once." : error.message);
      silently(() => Store().insert("outbox", data, false)); changed();
      return data;
    },
    async mark(outboxId, status, note) {
      const r = need();
      const patch = status === "sent" ? { status, provider_ref: note || "sent by hand" } : status === "failed" ? { status, failure: note } : { status };
      const { error } = await r.from("outbox").update(patch).eq("id", outboxId);
      if (error) throw error;
      await refreshRow("outbox", outboxId);
      refresh(["leadActivities", "leads", "activities"]);
    },
    async logConversation(a) {
      const r = need();
      const { data, error } = await r.from("lead_activities").insert({ ...a, kind: a.channel || "note", created_by: Auth.profile.id }).select().single();
      if (error) throw error;
      silently(() => Store().insert("leadActivities", data, false)); changed();
      return data;
    },
  };

  /* ---------------- legacy adapter API (kept for compatibility) ---------------- */
  function from(table) {
    const coll = mapTable(table);
    return {
      async select() { return { data: Store().list(coll) }; },
      async insert(row) { return { data: [Store().insert(coll, row)] }; }, // mirrored when live
      async update(id, patch) { return { data: [Store().update(coll, id, patch)] }; },
      async remove(id) { Store().remove(coll, id); return { data: [] }; },
    };
  }

  async function test() {
    const r = remote();
    if (!r) throw new Error("URL / key belum diisi.");
    const { error } = await r.from("approval_policies").select("category", { head: true, count: "exact" });
    if (error) throw error;
    return true;
  }

  const uuid = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const v = (Math.random() * 16) | 0;
      return (c === "x" ? v : (v & 0x3) | 0x8).toString(16);
    });

  // One-way bulk upload: local workspace → Supabase, UUID remap. Runs once per project.
  async function push() {
    const r = remote();
    if (!r) throw new Error("Supabase belum terhubung.");
    if (migrated()) throw new Error("Already pushed once — pushing again would duplicate data. Use Refresh instead.");
    const S = Store();
    const ORDER = ["services", "templates", "accounts", "suppliers", "clients",
      "leads", "projects", "campaigns", "content", "marketingEvents",
      "milestones", "tasks", "subtasks", "comments", "salesOrders",
      "purchaseOrders", "invoices", "bills", "transactions", "expenses",
      "files", "notes", "plans", "activities", "notifications"];
    const idMap = {};
    const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ""));
    ORDER.forEach((coll) => S.list(coll).forEach((row) => { if (row.id && !idMap[row.id]) idMap[row.id] = isUuid(row.id) ? row.id : uuid(); }));
    const remap = (row) => {
      const o = { ...row, id: idMap[row.id] || row.id };
      FK.forEach((f) => { if (o[f] !== undefined) o[f] = o[f] ? (idMap[o[f]] || null) : null; });
      return o;
    };
    const Tables = {
      activities: (x) => ({ ...remap(x), entity_id: x.entity_id && idMap[x.entity_id] ? idMap[x.entity_id] : x.entity_id }),
    };
    const patch = {};
    for (const coll of ORDER) {
      const tbl = COLL_TABLE[coll];
      const rows = S.list(coll);
      if (!rows.length) { patch[coll] = rows; continue; }
      const bodies = rows.map((row) => clean(coll, Tables[coll] ? Tables[coll](row) : remap(row)));
      const { error } = await r.from(tbl).insert(bodies);
      if (error) throw new Error(tbl + ": " + error.message);
      if (ITEMS[coll]) {
        const lines = [];
        rows.forEach((row) => (row.items || []).forEach((it) => lines.push({
          [ITEMS[coll].fk]: idMap[row.id], description: it.description,
          qty: it.qty || 0, unit_price: it.unit_price || 0,
          amount: it.amount ?? (it.qty || 0) * (it.unit_price || 0),
        })));
        if (lines.length) {
          const { error: e2 } = await r.from(ITEMS[coll].table).insert(lines);
          if (e2) throw new Error(ITEMS[coll].table + ": " + e2.message);
        }
      }
      patch[coll] = rows.map((row) => {
        const o = { ...row, id: idMap[row.id] };
        FK.forEach((f) => { if (o[f] !== undefined) o[f] = o[f] ? (idMap[o[f]] || null) : null; });
        if (row.entity_id !== undefined) o.entity_id = row.entity_id && idMap[row.entity_id] ? idMap[row.entity_id] : row.entity_id;
        return o;
      });
    }
    silently(() => S.replaceAll(patch));
    localStorage.setItem("signal_migrated", "1");
    return true;
  }

  // Supabase → local (replaces local collections). Safe to run any time.
  async function pull() {
    if (!remote()) throw new Error("Supabase belum terhubung.");
    const S = Store();
    const patch = {};
    // all tables in parallel — one round trip instead of thirty
    const [tables, itemTables] = await Promise.all([
      Promise.all(Object.entries(COLL_TABLE).map(async ([coll, tbl]) => [coll, await getAll(tbl)])),
      Promise.all(Object.entries(ITEMS).map(async ([coll, { table }]) => [coll, await getAll(table)])),
    ]);
    for (const [coll, rows] of tables) {
      if (coll === "plans") patch.plans = rows.map((x) => ({ id: x.id, month: x.month, revenue_target: +x.revenue_target, expense_budget: +x.expense_budget, marketing_budget: +x.marketing_budget, ops_budget: +x.ops_budget, profit_target: +x.profit_target }));
      else patch[coll] = rows;
    }
    const itemsBy = Object.fromEntries(itemTables);
    for (const [coll, { fk }] of Object.entries(ITEMS)) {
      const by = {};
      itemsBy[coll].forEach((it) => ((by[it[fk]] = by[it[fk]] || []).push({
        description: it.description, qty: +it.qty, unit_price: +it.unit_price, amount: +it.amount,
      })));
      (patch[coll] || []).forEach((p) => (p.items = by[p.id] || []));
    }
    (patch.leads || []).forEach((l) => (knownStage[l.id] = l.stage));
    silently(() => S.replaceAll(patch));
    return true;
  }

  // Realtime stub kept for callers; live updates come from startRealtime()
  const Realtime = { subscribe(fn) { return window.SignalStore.subscribe(fn); } };

  // Storage: metadata row only for now (bucket upload is a later phase)
  const Storage = {
    async upload(file, meta) {
      const S = window.SignalStore;
      const row = S.insert("files", {
        name: file.name || meta?.name || "upload",
        mime_type: (file.type || "file").split("/").pop(),
        size_bytes: file.size || 0,
        owner_name: window.SignalConfig.currentUser.name,
        linked_kind: meta?.linked_kind || null, linked_id: meta?.linked_id || null,
        created_at: new Date().toISOString(),
      });
      return { data: row };
    },
  };

  // mirror every Store change while signed in
  window.SignalStore.subscribe((evt) => { if (!quiet && isLive() && evt && evt.type) enqueue(() => mirror(evt)); });

  return { from, Auth, Realtime, Storage, useRemote, migrated, test, push, pull, start, refresh, gov, isLive, moveLead, uuid };
})();
