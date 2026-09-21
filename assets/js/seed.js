/* ============================================================
   SIGNAL SYSTEM · seed — MASTER DATA ONLY (no demo data)
   Business collections start empty; the workspace fills up
   through real usage (Quick create / imports / Supabase push).
   services + templates are master catalog, not demo data.
   ============================================================ */
window.SignalSeed = (function () {
  const clients = [];
  const leads = [];
  const projects = [];
  const milestones = [];
  const tasks = [];
  const subtasks = [];
  const comments = [];
  const campaigns = [];
  const content = [];
  const marketingEvents = [];
  const invoices = [];
  const salesOrders = [];
  const suppliers = [];
  const purchaseOrders = [];
  const bills = [];
  const accounts = [];
  const transactions = [];
  const expenses = [];
  const files = [];
  const notes = [];
  const activities = [];
  const notifications = [];
  const plans = [];

  const services = [
    { id: "sv_website", key: "website", name: "Website Development", description: "High-end marketing sites + booking + CMS.", category: "Build", pricing_model: "Fixed / milestone", default_duration_days: 45, is_active: true },
    { id: "sv_erp", key: "erp", name: "ERP Integration", description: "Inventory, finance and ops system mapping.", category: "Systems", pricing_model: "Discovery + fixed", default_duration_days: 60, is_active: true },
    { id: "sv_pos", key: "pos", name: "Point of Sale", description: "Multi-location POS, loyalty, online ordering.", category: "Systems", pricing_model: "Fixed + hardware", default_duration_days: 30, is_active: true },
    { id: "sv_ecommerce", key: "ecommerce", name: "E-commerce Platform", description: "Headless storefronts, subscriptions, payments.", category: "Commerce", pricing_model: "Fixed / milestone", default_duration_days: 50, is_active: true },
    { id: "sv_social", key: "social", name: "Social Media Campaign", description: "Always-on content engine + paid social.", category: "Marketing", pricing_model: "Monthly retainer", default_duration_days: 90, is_active: true },
    { id: "sv_saas", key: "saas", name: "SaaS Marketing Dashboard", description: "KPI dashboards, attribution, reporting.", category: "Data", pricing_model: "Fixed + care", default_duration_days: 40, is_active: true },
    { id: "sv_marketing", key: "marketing", name: "Digital Marketing", description: "Campaign management across Meta, TikTok, SEO.", category: "Marketing", pricing_model: "Retainer + % spend", default_duration_days: 90, is_active: true },
    { id: "sv_custom", key: "custom", name: "Custom Digital Infrastructure", description: "Bespoke internal tools + automation.", category: "Systems", pricing_model: "Scoped", default_duration_days: 60, is_active: true },
  ];

  const templates = [
    { id: "tp_web", service_key: "website", name: "Website Project Template", stages: [{ name: "Discovery" }, { name: "Wireframe" }, { name: "UI Design" }, { name: "Development" }, { name: "QA" }, { name: "Deployment" }] },
    { id: "tp_eco", service_key: "ecommerce", name: "E-commerce Template", stages: [{ name: "Discovery" }, { name: "Store Setup" }, { name: "Product Structure" }, { name: "Payment" }, { name: "Shipping" }, { name: "QA" }, { name: "Launch" }] },
    { id: "tp_soc", service_key: "social", name: "Social Engine Template", stages: [{ name: "Strategy" }, { name: "Content Planning" }, { name: "Production" }, { name: "Approval" }, { name: "Scheduling" }, { name: "Reporting" }] },
    { id: "tp_erp", service_key: "erp", name: "ERP Template", stages: [{ name: "Requirement Gathering" }, { name: "System Mapping" }, { name: "Integration" }, { name: "Configuration" }, { name: "Testing" }, { name: "Training" }, { name: "Deployment" }] },
  ];

  return { clients, leads, projects, milestones, tasks, subtasks, comments, campaigns, content, marketingEvents, invoices, salesOrders, accounts, suppliers, purchaseOrders, bills, transactions, expenses, services, templates, files, activities, notifications, notes, plans };
})();
