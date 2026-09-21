/* ============================================================
   SIGNAL SYSTEM · config
   Single source of truth for brand, constants, Supabase wiring
   ============================================================ */
window.SignalConfig = {
  appName: "Signal System",
  company: "Signal Society",
  tagline: "Turn scattered business activity into one clear operational signal.",
  brand: {
    accent: "#FF6600",
    accentHover: "#E65C00",
    accentSoft: "#FFF1E8",
    ink: "#111113",
    graphite: "#1C1C1F",
    paper: "#FAFAF9",
  },
  // Fill these in when connecting Supabase — the app runs on
  // local seed + localStorage until then (see services/db.js).
  supabase: {
    url: localStorage.getItem("signal_supabase_url") || "https://awxxvxlbebwlzgkepdsb.supabase.co",
    anonKey: localStorage.getItem("signal_supabase_key") || "",
  },
  pipelineStages: ["New Lead","Qualified","Contacted","Discovery","Proposal","Negotiation","Won","Lost"],
  taskStatuses: ["To Do","In Progress","Review","Blocked","Done"],
  taskPriorities: ["Low","Medium","High","Urgent"],
  projectStatuses: ["Planning","Active","On Hold","Completed","Archived"],
  clientStatuses: ["Lead","Prospect","Active Client","Past Client","Inactive"],
  campaignStatuses: ["Planning","Active","Paused","Completed","Archived"],
  contentStatuses: ["Idea","Brief","Production","Internal Review","Client Review","Approved","Scheduled","Published","Archived"],
  marketingStatuses: ["Planned","Active","Paused","Completed","Cancelled"],
  invoiceStatuses: ["Draft","Sent","Viewed","Partially Paid","Paid","Overdue","Cancelled"],
  soStatuses: ["Draft","Confirmed","Invoiced","Completed","Cancelled"],
  poStatuses: ["Draft","Confirmed","Billed","Completed","Cancelled"],
  billStatuses: ["Draft","Unpaid","Partially Paid","Paid","Overdue","Cancelled"],
  paymentMethods: ["Bank Transfer","PayPal","Stripe","QRIS","Cash","Card","Other"],
  accountTypes: ["Bank","PayPal","Cash","E-Wallet","Other"],
  serviceKeys: [
    { key: "website",   name: "Website",                  short: "WEB" },
    { key: "erp",       name: "ERP Integration",          short: "ERP" },
    { key: "pos",       name: "Point of Sale",            short: "POS" },
    { key: "ecommerce", name: "E-commerce Platform",      short: "ECO" },
    { key: "social",    name: "Social Media Campaign",    short: "SOC" },
    { key: "saas",      name: "SaaS Marketing Dashboard", short: "SAA" },
    { key: "marketing", name: "Digital Marketing",        short: "MKT" },
    { key: "custom",    name: "Custom Systems",           short: "CST" },
  ],
  platforms: ["Instagram","TikTok","LinkedIn","Facebook","Website","YouTube","Other"],
  contentTypes: ["Static","Carousel","Reel","Video","Story","Article","Blog","Advertisement","UGC","Other"],
  expenseCategories: ["Operations","Software","Marketing","Team","Transport","Equipment","Production","Freelance","Other"],
  team: [
    { name: "Sarah Chen",  role: "Project Manager", initials: "SC", color: "#FF6600" },
    { name: "Marcus Webb", role: "Lead Developer",  initials: "MW", color: "#111113" },
    { name: "Aisha Khan",  role: "Designer",        initials: "AK", color: "#6B4EFF" },
    { name: "Leo Fournier",role: "Marketing Lead",  initials: "LF", color: "#0EA5A0" },
    { name: "Dana Cole",   role: "Finance",         initials: "DC", color: "#B7791F" },
  ],
  currentUser: { name: "Signal Operator", role: "Admin", initials: "SO" },
};
