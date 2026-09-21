-- ============================================================
-- SIGNAL SYSTEM · Supabase PostgreSQL schema
-- Signal Society · Internal Business Operating System
-- ============================================================
-- Philosophy: Signal System turns scattered business activity
-- into one clear operational signal.
--
-- Conventions:
--  * UUID primary keys (gen_random_uuid())
--  * created_at / updated_at timestamps
--  * Soft-delete via deleted_at where appropriate
--  * RLS enabled on every table (policies below are starter
--    templates — tighten per workspace in production)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- organizations & profiles ----------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Signal Society',
  slug text unique not null default 'signal-society',
  logo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id),
  full_name text not null,
  avatar_url text,
  role text not null default 'member'
    check (role in ('admin','manager','member','finance','marketing','viewer')),
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- services ----------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,            -- website, erp, pos, ecommerce, social, saas, marketing, custom
  name text not null,
  description text,
  category text,
  pricing_model text,
  default_duration_days int default 30,
  default_stages jsonb default '[]',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.service_templates (
  id uuid primary key default gen_random_uuid(),
  service_key text references public.services(key),
  name text not null,
  stages jsonb default '[]',           -- [{name, order, tasks:[{title, est_hours}]}]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- clients / contacts / leads ----------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  company_name text not null,
  contact_person text,
  email text,
  phone text,
  website text,
  industry text,
  address text,
  company_size text,
  source text,
  status text default 'Active Client'
    check (status in ('Lead','Prospect','Active Client','Past Client','Inactive')),
  account_manager text,
  notes text,
  tags text[] default '{}',
  lifetime_value numeric(14,2) default 0,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  is_primary boolean default false,
  created_at timestamptz default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  company text not null,
  contact_person text,
  email text,
  phone text,
  service_interest text,
  deal_value numeric(14,2) default 0,
  source text,
  probability int default 20 check (probability between 0 and 100),
  stage text default 'New Lead'
    check (stage in ('New Lead','Qualified','Contacted','Discovery','Proposal','Negotiation','Won','Lost')),
  assigned_to text,
  next_follow_up date,
  last_contact date,
  notes text,
  converted_client_id uuid references public.clients(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  kind text default 'note',
  body text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- ---------- projects ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  client_id uuid references public.clients(id) on delete set null,
  service_key text references public.services(key),
  name text not null,
  description text,
  status text default 'Active'
    check (status in ('Planning','Active','On Hold','Completed','Archived')),
  health text default 'Healthy' check (health in ('Healthy','At Risk','Delayed')),
  health_override text,
  progress_override int,
  start_date date,
  deadline date,
  budget numeric(14,2) default 0,
  contract_value numeric(14,2) default 0,
  estimated_cost numeric(14,2) default 0,
  owner text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.project_members (
  project_id uuid references public.projects(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  role text default 'member',
  primary key (project_id, profile_id)
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  status text default 'To Do' check (status in ('To Do','In Progress','Review','Blocked','Done')),
  deadline date,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  title text not null,
  description text,
  status text default 'To Do'
    check (status in ('To Do','In Progress','Review','Blocked','Done')),
  priority text default 'Medium' check (priority in ('Low','Medium','High','Urgent')),
  assignee text,
  start_date date,
  due_date date,
  est_hours numeric(6,2) default 0,
  actual_hours numeric(6,2) default 0,
  tags text[] default '{}',
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  is_done boolean default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  author_name text,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz default now()
);

create table public.task_dependencies (
  task_id uuid references public.tasks(id) on delete cascade,
  depends_on_task_id uuid references public.tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id)
);

-- ---------- marketing ----------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  objective text,
  platforms text[] default '{}',
  budget numeric(14,2) default 0,
  spend numeric(14,2) default 0,
  start_date date,
  end_date date,
  status text default 'Planning'
    check (status in ('Planning','Active','Paused','Completed','Archived')),
  audience text,
  kpi text,
  results jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  caption text,
  platform text default 'Instagram',
  content_type text default 'Static',
  pillar text,
  publish_date date,
  deadline date,
  status text default 'Idea'
    check (status in ('Idea','Brief','Production','Internal Review','Client Review','Approved','Scheduled','Published','Archived')),
  assignee text,
  asset_url text,
  cta text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  kind text default 'campaign',
  channel text,
  start_date date not null,
  end_date date,
  status text default 'Planned'
    check (status in ('Planned','Active','Paused','Completed','Cancelled')),
  owner text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- finance ----------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  name text not null,                -- e.g. "BCA · •• 8828"
  type text default 'Bank' check (type in ('Bank','PayPal','Cash','E-Wallet','Other')),
  currency text default 'USD',       -- USD | IDR | …
  account_no text,
  holder text,
  balance numeric(16,2) default 0,   -- maintained by receive-payment flow
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  number text unique not null,       -- SO-2501, …
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  issue_date date default current_date,
  due_date date,
  status text default 'Draft'
    check (status in ('Draft','Confirmed','Invoiced','Completed','Cancelled')),
  currency text default 'USD',
  subtotal numeric(14,2) default 0,
  tax numeric(14,2) default 0,
  discount numeric(14,2) default 0,
  total numeric(14,2) default 0,
  invoice_id uuid,                   -- set once auto-invoice is issued
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid references public.sales_orders(id) on delete cascade,
  description text not null,
  qty numeric(10,2) default 1,
  unit_price numeric(14,2) default 0,
  amount numeric(14,2) default 0
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  number text unique not null,       -- PO-1101, …
  supplier_id uuid references public.suppliers(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  issue_date date default current_date,
  due_date date,
  status text default 'Draft'
    check (status in ('Draft','Confirmed','Billed','Completed','Cancelled')),
  currency text default 'IDR',
  subtotal numeric(14,2) default 0,
  tax numeric(14,2) default 0,
  discount numeric(14,2) default 0,
  total numeric(14,2) default 0,
  bill_id uuid,                      -- set once auto-bill is issued
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid references public.purchase_orders(id) on delete cascade,
  description text not null,
  qty numeric(10,2) default 1,
  unit_price numeric(14,2) default 0,
  amount numeric(14,2) default 0
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  supplier_id uuid references public.suppliers(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  number text unique not null,       -- BILL-301, …
  issue_date date default current_date,
  due_date date,
  subtotal numeric(14,2) default 0,
  tax numeric(14,2) default 0,
  discount numeric(14,2) default 0,
  total numeric(14,2) default 0,
  amount_paid numeric(14,2) default 0,
  currency text default 'IDR',
  status text default 'Unpaid'
    check (status in ('Draft','Unpaid','Partially Paid','Paid','Overdue','Cancelled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid references public.bills(id) on delete cascade,
  description text not null,
  qty numeric(10,2) default 1,
  unit_price numeric(14,2) default 0,
  amount numeric(14,2) default 0
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  sales_order_id uuid references public.sales_orders(id) on delete set null,
  number text unique not null,
  issue_date date default current_date,
  due_date date,
  subtotal numeric(14,2) default 0,
  tax numeric(14,2) default 0,
  discount numeric(14,2) default 0,
  total numeric(14,2) default 0,
  amount_paid numeric(14,2) default 0,
  currency text default 'USD',
  status text default 'Draft'
    check (status in ('Draft','Sent','Viewed','Partially Paid','Paid','Overdue','Cancelled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  description text not null,
  qty numeric(10,2) default 1,
  unit_price numeric(14,2) default 0,
  amount numeric(14,2) default 0
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  date date default current_date,
  type text check (type in ('Income','Expense','Refund','Transfer')),
  category text,
  amount numeric(14,2) not null,
  currency text default 'USD',
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  bill_id uuid references public.bills(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  payment_method text,
  status text default 'Completed',
  reference text,
  notes text,
  created_at timestamptz default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  date date default current_date,
  category text,
  amount numeric(14,2) not null,
  vendor text,
  project_id uuid references public.projects(id) on delete set null,
  receipt_url text,
  status text default 'Approved',
  notes text,
  created_at timestamptz default now()
);

create table public.financial_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  month date not null,
  revenue_target numeric(14,2) default 0,
  expense_budget numeric(14,2) default 0,
  marketing_budget numeric(14,2) default 0,
  ops_budget numeric(14,2) default 0,
  profit_target numeric(14,2) default 0,
  created_at timestamptz default now(),
  unique (organization_id, month)
);

-- ---------- system ----------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  name text not null,
  mime_type text,
  size_bytes bigint default 0,
  storage_path text,
  owner_name text,
  linked_kind text,   -- client | project | campaign | task | invoice
  linked_id uuid,
  created_at timestamptz default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  linked_kind text,
  linked_id uuid,
  author_name text,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  actor_name text,
  action text not null,
  entity_kind text,
  entity_id text,
  entity_label text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  kind text default 'info',
  link text,
  is_read boolean default false,
  created_at timestamptz default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  color text default '#FF6600'
);

-- ---------- updated_at triggers ----------
do $$ declare t text; begin
  for t in select unnest(array[
    'organizations','profiles','services','service_templates','clients','leads','projects',
    'milestones','tasks','campaigns','content_items','marketing_events',
    'accounts','sales_orders','invoices','suppliers','purchase_orders','bills','notes']) loop
    execute format('drop trigger if exists trg_%s_updated on public.%s', t, t);
    execute format('create trigger trg_%s_updated before update on public.%s
      for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- RLS ----------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.service_templates enable row level security;
alter table public.clients enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.campaigns enable row level security;
alter table public.content_items enable row level security;
alter table public.marketing_events enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.expenses enable row level security;
alter table public.financial_plans enable row level security;
alter table public.files enable row level security;
alter table public.notes enable row level security;
alter table public.activities enable row level security;
alter table public.notifications enable row level security;
alter table public.tags enable row level security;

-- ---------- DEV open policies (get going instantly) ----------
-- WARNING: these allow anon + authenticated full access to every table.
-- Perfect for wiring the app today; replace with tight per-role
-- policies before any production or client data goes in.
do $$ declare t text; begin
  for t in select unnest(array[
    'organizations','profiles','services','service_templates','clients',
    'contacts','leads','lead_activities','projects','project_members',
    'milestones','tasks','subtasks','task_comments','task_dependencies',
    'campaigns','content_items','marketing_events','accounts','sales_orders',
    'sales_order_items','suppliers','purchase_orders','purchase_order_items',
    'bills','bill_items','invoices','invoice_items','transactions','expenses',
    'financial_plans','files','notes','activities','notifications','tags']) loop
    execute format('drop policy if exists "dev open" on public.%I', t);
    execute format('create policy "dev open" on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- realtime ----------
-- In Supabase dashboard: enable Realtime for
-- tasks, projects, notifications, activities, content_items, leads,
-- invoices, sales_orders, bills, purchase_orders.
--   alter publication supabase_realtime add table public.tasks;
