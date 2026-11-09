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
  // Supabase is the source of truth (sign-in required). The publishable key is
  // public by design — row level security decides what each signed-in role may do.
  // Never put the service_role / secret key in this file.
  // localStorage signal_supabase_key = "local" → offline demo mode (no sign-in, data in this browser only).
  supabase: {
    url: localStorage.getItem("signal_supabase_url") || "https://awxxvxlbebwlzgkepdsb.supabase.co",
    anonKey: localStorage.getItem("signal_supabase_key") === "local" ? "" : (localStorage.getItem("signal_supabase_key") || "sb_publishable_IyL3isPDXBANHehMlkTTNg_7JvJW0vN"),
  },
  // order matters: the database lets leads move forward freely; moving back,
  // Lost and Nurture need a reason; past Qualified needs a real conversation
  pipelineStages: ["New Lead","Qualified","Contacted","Discovery","Solutioning","Proposal","Negotiation","Won","Lost","Nurture"],
  approvalChannels: [["whatsapp", "WhatsApp (sent by hand via wa.me)"], ["email", "Email"], ["instagram", "Instagram DM (reply only)"]],
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
    { name: "Sissy", role: "Account Manager", initials: "SS", color: "#FF6600" },
  ],
  currentUser: { name: "Sissy", role: "Admin", initials: "SS" },
};
