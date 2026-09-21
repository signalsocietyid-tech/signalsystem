/* ============================================================
   SIGNAL SYSTEM · Service layer (Supabase-ready abstraction)
   - No keys  → pure local Store adapter (offline-capable).
   - Keys set → write-through: every insert/update/remove also
     hits Supabase (parent + line-items split), local stays cache.
   - Settings → "Push local" uploads everything once (UUID remap),
     "Pull" refreshes local from Supabase.
   UI code never changes between modes.
   Usage:  DB.from('projects').select() / .insert() / .update()
   ============================================================ */
window.DB = (function () {
  const Store = () => window.SignalStore;
  const cfg = () => window.SignalConfig.supabase;
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
  };
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
    return inv[t] || ({
      clients: "clients", contacts: "clients", leads: "leads",
      projects: "projects", milestones: "milestones", tasks: "tasks",
      campaigns: "campaigns", content_items: "content",
      marketing_events: "marketingEvents", invoices: "invoices",
      invoice_items: "invoices", sales_orders: "salesOrders",
      sales_order_items: "salesOrders", accounts: "accounts",
    }[t] || t);
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
  const itemRows = (coll, parentId, items) => (items || []).map((it) => ({
    [ITEMS[coll].fk]: parentId, description: it.description,
    qty: it.qty || 0, unit_price: it.unit_price || 0,
    amount: it.amount ?? (it.qty || 0) * (it.unit_price || 0),
  }));

  function from(table) {
    const coll = mapTable(table);
    const tbl = COLL_TABLE[coll] || coll;
    return {
      async select() {
        return { data: Store().list(coll) }; // local cache is source of truth; use pull() to refresh
      },
      async insert(row) {
        const r = remote();
        if (r) {
          const { data, error } = await r.from(tbl).insert(stripForRemote(coll, row)).select();
          if (error) throw error;
          const saved = data[0];
          if (ITEMS[coll] && row.items && row.items.length) {
            const ir = await r.from(ITEMS[coll].table).insert(itemRows(coll, saved.id, row.items));
            if (ir.error) throw ir.error;
          }
          row = { ...row, ...saved, items: row.items };
        }
        return { data: [Store().insert(coll, row)] };
      },
      async update(id, patch) {
        const r = remote();
        if (r) {
          const body = stripForRemote(coll, patch);
          delete body.id;
          const { error } = await r.from(tbl).update(body).eq("id", id);
          if (error) throw error;
          if (ITEMS[coll] && patch.items) {
            const { table, fk } = ITEMS[coll];
            const del = await r.from(table).delete().eq(fk, id);
            if (del.error) throw del.error;
            if (patch.items.length) {
              const ins = await r.from(table).insert(itemRows(coll, id, patch.items));
              if (ins.error) throw ins.error;
            }
          }
        }
        return { data: [Store().update(coll, id, patch)] };
      },
      async remove(id) {
        const r = remote();
        if (r) {
          const { error } = await r.from(tbl).delete().eq("id", id);
          if (error) throw error;
        }
        Store().remove(coll, id);
        return { data: [] };
      },
    };
  }

  async function test() {
    const r = remote();
    if (!r) throw new Error("URL / anon key belum diisi.");
    const { error } = await r.from("accounts").select("id", { count: "exact", head: true });
    if (error) throw error;
    return true;
  }

  const uuid = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const v = (Math.random() * 16) | 0;
      return (c === "x" ? v : (v & 0x3) | 0x8).toString(16);
    });

  // One-way bulk upload: local seed → Supabase, UUID remap, local ids rewritten.
  async function push() {
    const r = remote();
    if (!r) throw new Error("Supabase belum terhubung.");
    const S = Store();
    const ORDER = ["services", "templates", "accounts", "suppliers", "clients",
      "leads", "projects", "campaigns", "content", "marketingEvents",
      "milestones", "tasks", "subtasks", "comments", "salesOrders",
      "purchaseOrders", "invoices", "bills", "transactions", "expenses",
      "files", "notes", "plans", "activities", "notifications"];
    const idMap = {};
    ORDER.forEach((coll) => S.list(coll).forEach((row) => { if (row.id && !idMap[row.id]) idMap[row.id] = uuid(); }));
    const Tables = {
      services: (x) => ({ id: idMap[x.id], key: x.key, name: x.name, description: x.description, category: x.category, pricing_model: x.pricing_model, default_duration_days: x.default_duration_days, default_stages: x.default_stages || [], is_active: x.is_active }),
      templates: (x) => ({ id: idMap[x.id], service_key: x.service_key, name: x.name, stages: x.stages || [] }),
      plans: (x) => ({ id: idMap[x.id], month: x.month, revenue_target: x.revenue_target, expense_budget: x.expense_budget, marketing_budget: x.marketing_budget, ops_budget: x.ops_budget, profit_target: x.profit_target }),
      activities: (x) => ({ ...remap(x), entity_id: x.entity_id && idMap[x.entity_id] ? idMap[x.entity_id] : x.entity_id }),
    };
    const remap = (row) => {
      const o = { ...row, id: idMap[row.id] || row.id };
      delete o.items;
      FK.forEach((f) => { if (o[f] !== undefined) o[f] = o[f] ? (idMap[o[f]] || null) : null; });
      return o;
    };
    const patch = {};
    for (const coll of ORDER) {
      const tbl = COLL_TABLE[coll];
      const rows = S.list(coll);
      if (!rows.length) { patch[coll] = rows; continue; }
      const bodies = rows.map((row) => (Tables[coll] ? Tables[coll](row) : remap(row)));
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
      // rewrite local ids so local + remote stay in sync
      patch[coll] = rows.map((row) => {
        const o = { ...row, id: idMap[row.id] };
        FK.forEach((f) => { if (o[f] !== undefined) o[f] = o[f] ? (idMap[o[f]] || null) : null; });
        if (row.entity_id !== undefined) o.entity_id = row.entity_id && idMap[row.entity_id] ? idMap[row.entity_id] : row.entity_id;
        return o;
      });
    }
    S.replaceAll(patch);
    localStorage.setItem("signal_migrated", "1");
    S.log("pushed workspace to Supabase", "system", ORDER.reduce((a, c) => a + S.list(c).length, 0) + " records");
    return true;
  }

  // One-way refresh: Supabase → local (overwrites local collections).
  async function pull() {
    const r = remote();
    if (!r) throw new Error("Supabase belum terhubung.");
    const S = Store();
    const getAll = async (tbl) => {
      let all = [], from = 0;
      for (;;) {
        const { data, error } = await r.from(tbl).select("*").range(from, from + 999);
        if (error) throw new Error(tbl + ": " + error.message);
        all = all.concat(data || []);
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      return all;
    };
    const patch = {};
    for (const [coll, tbl] of Object.entries(COLL_TABLE)) {
      const rows = await getAll(tbl);
      if (coll === "plans") patch.plans = rows.map((x) => ({ id: x.id, month: x.month, revenue_target: +x.revenue_target, expense_budget: +x.expense_budget, marketing_budget: +x.marketing_budget, ops_budget: +x.ops_budget, profit_target: +x.profit_target }));
      else patch[coll] = rows;
    }
    for (const [coll, { table, fk }] of Object.entries(ITEMS)) {
      const by = {};
      (await getAll(table)).forEach((it) => ((by[it[fk]] = by[it[fk]] || []).push({
        description: it.description, qty: +it.qty, unit_price: +it.unit_price, amount: +it.amount,
      })));
      (patch[coll] || []).forEach((p) => (p.items = by[p.id] || []));
    }
    S.replaceAll(patch);
    S.log("pulled workspace from Supabase", "system", "refresh");
    return true;
  }

  // Auth stub — replace with supabase.auth once keys are set
  const Auth = {
    user: window.SignalConfig.currentUser,
    async signIn() { return { user: this.user }; },
    async signOut() { return {}; },
    role() { return "admin"; },
    can() { return true; }, // per-module View/Create/Edit/Delete enforced here later
  };

  // Realtime stub — subscribes to local Store; swap with
  // supabase.channel(...).on('postgres_changes', ...) later
  const Realtime = {
    subscribe(fn) { return window.SignalStore.subscribe(fn); },
  };

  // Storage stub — swap with supabase.storage.from(bucket) later
  const Storage = {
    async upload(file, meta) {
      const S = window.SignalStore;
      const row = S.insert("files", {
        name: file.name || meta?.name || "upload",
        mime_type: (file.type || "file").split("/").pop(),
        size_bytes: file.size || 0,
        owner_name: S && window.SignalConfig.currentUser.name,
        linked_kind: meta?.linked_kind || null, linked_id: meta?.linked_id || null,
        created_at: new Date().toISOString(),
      });
      return { data: row };
    },
  };

  return { from, Auth, Realtime, Storage, useRemote, migrated, test, push, pull };
})();
