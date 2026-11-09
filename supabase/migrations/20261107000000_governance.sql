-- =====================================================================
-- Signal System — governance on top of the EXISTING schema
-- Target: live project "signalsystem" (36 tables: clients, leads, contacts, …).
-- Additive: no existing table is dropped or renamed; existing columns keep
-- their meaning. Tested against tests/fixtures/live-baseline.sql (npm test).
--
--   1. closes the "dev open" policies (anyone with the public key could read
--      and write everything) — members only, role-gated writes
--   2. leads become the governed pipeline: stages change only through
--      move_lead(); "Contacted" requires an approved message that was sent
--   3. approvals (bound to a hash of the exact content) + outbox (only door out)
--   4. every row change → audit_log; every business step → activities
--
-- Role mapping (profiles.role → org/company.js): admin = CEO,
-- manager = operations delegate, member/marketing/finance = writers, viewer = read-only.
-- =====================================================================

create schema if not exists app;

-- ---------- helpers ----------
create function app.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function app.is_writer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app.my_role() in ('admin', 'manager', 'member', 'marketing', 'finance'), false)
$$;

create function app.message_payload(p_channel text, p_recipient text, p_subject text, p_body text) returns jsonb
language sql immutable as $$
  select jsonb_build_object('channel', p_channel, 'recipient', trim(p_recipient), 'subject', coalesce(p_subject, ''), 'body', p_body)
$$;

create function app.hash(p jsonb) returns text
language sql immutable as $$
  select encode(sha256(convert_to(p::text, 'UTF8')), 'hex')
$$;

-- business events go to the existing activities feed
alter table public.activities add column actor_id uuid references public.profiles (id);

create function app.emit(p_action text, p_kind text, p_id uuid, p_label text default null, p_data jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into public.activities (organization_id, actor_id, actor_name, action, entity_kind, entity_id, entity_label, metadata)
  select pr.organization_id, auth.uid(), coalesce(pr.full_name, 'system'), p_action, p_kind, p_id::text, p_label, coalesce(p_data, '{}')
    from (select 1) one left join public.profiles pr on pr.id = auth.uid()
$$;

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id text,
  op text not null,
  before jsonb,
  after jsonb,
  actor uuid,
  at timestamptz not null default now()
);
create index audit_row_idx on public.audit_log (table_name, row_id, at desc);

create function app.audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare b jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
        a jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
begin
  insert into public.audit_log (table_name, row_id, op, before, after, actor)
  values (tg_table_name, coalesce(a ->> 'id', b ->> 'id'), tg_op, b, a, auth.uid());
  return null;
end $$;

-- ---------- profiles: only admins change roles ----------
create function app.guard_profile() returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and app.my_role() is distinct from 'admin' and auth.uid() is not null then
    raise exception 'Only an admin can change roles' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function app.guard_profile();

-- ---------- contacts: reachability + personal-data basis (UU PDP) ----------
alter table public.contacts
  add column whatsapp text,
  add column instagram text,
  add column whatsapp_opt_in_at timestamptz,
  add column is_generic boolean not null default false, -- "Front desk", "Admin": not a named person
  add column consent_basis text not null default 'legitimate_interest',
  add column is_verified boolean not null default false,
  add column updated_at timestamptz default now(),
  add constraint contacts_consent_basis check (consent_basis in ('public_business_contact', 'legitimate_interest', 'consent', 'client_relationship')),
  add constraint contacts_named_person_basis check (is_generic or consent_basis <> 'public_business_contact'),
  add constraint contacts_email_format check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
create unique index contacts_email_key on public.contacts (lower(email)) where email is not null;
create index contacts_client_idx on public.contacts (client_id);
create trigger trg_contacts_updated before update on public.contacts for each row execute function public.set_updated_at();

-- ---------- leads: the governed pipeline ----------
do $$
declare r record;
begin -- drop the old stage check by definition (its live name is not guaranteed)
  for r in select conname from pg_constraint where conrelid = 'public.leads'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%stage%' loop
    execute format('alter table public.leads drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.leads
  add column client_id uuid references public.clients (id) on delete restrict,
  add column services text[] not null default '{}',
  add column owner_id uuid references public.profiles (id),
  add column stage_reason text,
  add column stage_changed_at timestamptz not null default now(),
  add column nurture_until date,
  add column next_action text,
  add constraint leads_stage check (stage in ('New Lead', 'Qualified', 'Contacted', 'Discovery', 'Solutioning', 'Proposal', 'Negotiation', 'Won', 'Lost', 'Nurture')),
  add constraint leads_services check (services <@ array['grow', 'build', 'operate']::text[]);
create index leads_client_idx on public.leads (client_id);
create index leads_stage_idx on public.leads (stage);

create function app.guard_lead_insert() returns trigger language plpgsql as $$
begin
  if new.stage not in ('New Lead', 'Qualified') then
    raise exception 'A new lead starts at New Lead or Qualified, not %', new.stage using errcode = '23514';
  end if;
  if new.client_id is not null and new.company is null then
    select company_name into new.company from public.clients where id = new.client_id;
  end if;
  new.stage_changed_at := now();
  return new;
end $$;

create function app.guard_lead_stage() returns trigger language plpgsql as $$
declare
  ord constant text[] := array['New Lead', 'Qualified', 'Contacted', 'Discovery', 'Solutioning', 'Proposal', 'Negotiation'];
  f int := array_position(ord, old.stage);
  t int := array_position(ord, new.stage);
begin
  if new.stage is not distinct from old.stage then return new; end if;
  if current_setting('app.transition', true) is distinct from 'on' then
    raise exception 'Change stage with move_lead()' using errcode = '42501';
  end if;
  if old.stage in ('Won', 'Lost') then
    raise exception 'Lead is closed (%)', old.stage using errcode = '23514';
  elsif new.stage in ('Lost', 'Nurture') then
    if new.stage_reason is null then raise exception 'A reason is required to move to %', new.stage using errcode = '23514'; end if;
  elsif new.stage = 'Won' then
    if old.stage <> 'Negotiation' then raise exception 'Only a lead in Negotiation can be won' using errcode = '23514'; end if;
  elsif old.stage = 'Nurture' then
    if new.stage <> 'Qualified' then raise exception 'A nurtured lead re-enters at Qualified' using errcode = '23514'; end if;
  elsif t = f + 1 then
    null;
  elsif t < f then
    if new.stage_reason is null then raise exception 'A reason is required to move back a stage' using errcode = '23514'; end if;
  else
    raise exception 'Stages move one step at a time (% → %)', old.stage, new.stage using errcode = '23514';
  end if;
  if new.stage = 'Contacted' and not exists (select 1 from public.outbox where lead_id = new.id and status = 'sent') then
    raise exception 'Contacted requires an approved outreach message that has been sent' using errcode = '23514';
  end if;
  new.stage_changed_at := now();
  return new;
end $$;

create function app.after_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform app.emit('lead.created', 'lead', new.id, new.company, jsonb_build_object('stage', new.stage, 'client_id', new.client_id));
  elsif new.stage is distinct from old.stage then
    perform app.emit('lead.stage_changed', 'lead', new.id, new.company, jsonb_build_object('from', old.stage, 'to', new.stage, 'reason', new.stage_reason));
    if new.stage = 'Won' and new.client_id is not null then
      update public.clients set status = 'Active Client' where id = new.client_id and status in ('Lead', 'Prospect');
      update public.leads set converted_client_id = new.client_id where id = new.id and converted_client_id is null;
    elsif new.stage = 'Qualified' and new.client_id is not null then
      update public.clients set status = 'Prospect' where id = new.client_id and status = 'Lead';
    end if;
  end if;
  return null;
end $$;

create trigger leads_insert before insert on public.leads for each row execute function app.guard_lead_insert();
create trigger leads_stage before update on public.leads for each row execute function app.guard_lead_stage();
create trigger leads_events after insert or update on public.leads for each row execute function app.after_lead();

create function public.move_lead(p_id uuid, p_to text, p_reason text default null, p_nurture_until date default null)
returns public.leads
language plpgsql security invoker set search_path = public, app as $$
declare l public.leads;
begin
  perform set_config('app.transition', 'on', true);
  update public.leads
     set stage = p_to,
         stage_reason = nullif(trim(p_reason), ''),
         nurture_until = case when p_to = 'Nurture' then p_nurture_until else nurture_until end,
         last_contact = case when p_to = 'Contacted' then current_date else last_contact end
   where id = p_id
   returning * into l;
  perform set_config('app.transition', 'off', true);
  if l.id is null then raise exception 'Lead not found or not permitted' using errcode = '42501'; end if;
  return l;
end $$;

-- ---------- lead_activities become the interaction timeline ----------
alter table public.lead_activities
  add column channel text,
  add column direction text not null default 'internal',
  add column occurred_at timestamptz not null default now(),
  add column subject text,
  add column contact_id uuid references public.contacts (id) on delete set null,
  add column outbox_id uuid unique,
  add constraint lead_activities_channel check (channel is null or channel in ('email', 'whatsapp', 'instagram', 'phone', 'meeting', 'other')),
  add constraint lead_activities_direction check (direction in ('inbound', 'outbound', 'internal'));
create index lead_activities_lead_idx on public.lead_activities (lead_id, occurred_at desc);

create function app.after_lead_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform app.emit('interaction.logged', 'lead', new.lead_id, null, jsonb_build_object('activity_id', new.id, 'channel', new.channel, 'direction', new.direction));
  if new.direction in ('inbound', 'outbound') then
    update public.leads set last_contact = greatest(coalesce(last_contact, new.occurred_at::date), new.occurred_at::date) where id = new.lead_id;
  end if;
  return null;
end $$;
create trigger lead_activities_events after insert on public.lead_activities for each row execute function app.after_lead_activity();

-- ---------- approvals ----------
create table public.approval_policies (
  category text primary key,
  name text not null,
  sla interval not null,
  delegate_role text check (delegate_role in ('manager')),
  risk text not null check (risk in ('low', 'medium', 'high')),
  external boolean not null -- approved content leaves through the outbox
);
insert into public.approval_policies (category, name, sla, delegate_role, risk, external) values
  ('outreach',          'Prospect outreach',                     '24 hours', 'manager', 'medium', true),
  ('external-comms',    'External communications',               '8 hours',  'manager', 'medium', true),
  ('meeting',           'Meeting confirmation',                  '8 hours',  'manager', 'low',    true),
  ('demo-request',      'Demo production request',               '48 hours', null,      'high',   false),
  ('demo-release',      'Demo release to Marketing',             '24 hours', null,      'medium', false),
  ('proposal-quote',    'Proposal & quotation',                  '24 hours', null,      'high',   true),
  ('pricing-exception', 'Pricing exception',                     '24 hours', null,      'high',   false),
  ('contract',          'Contract',                              '48 hours', null,      'high',   true),
  ('project-start',     'Project commencement',                  '24 hours', null,      'high',   false),
  ('scope-change',      'Scope change',                          '24 hours', 'manager', 'medium', false),
  ('additional-cost',   'Additional cost',                       '24 hours', null,      'medium', false),
  ('financial-tx',      'Financial transaction / invoice issue', '24 hours', null,      'high',   true),
  ('final-delivery',    'Final delivery',                        '24 hours', null,      'high',   false);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  category text not null references public.approval_policies (category),
  lead_id uuid not null references public.leads (id) on delete restrict,
  title text not null check (length(trim(title)) > 0),
  context text,
  proposed_action text not null check (length(trim(proposed_action)) > 0),
  payload jsonb not null,
  payload_hash text not null,
  evidence text,
  risks text,
  ai_recommendation text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revision_requested', 'deferred')),
  requested_by uuid default auth.uid() references public.profiles (id),
  requested_at timestamptz not null default now(),
  due_at timestamptz not null,
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text,
  instructions text
);
create index approvals_open_idx on public.approvals (status, due_at);
create index approvals_lead_idx on public.approvals (lead_id);

create function app.guard_approval_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare pol public.approval_policies;
begin
  select * into pol from public.approval_policies where category = new.category;
  if pol.external then
    -- normalised to {channel, recipient, subject, body} so the outbox can match it exactly
    if coalesce(trim(new.payload ->> 'recipient'), '') = '' or coalesce(trim(new.payload ->> 'body'), '') = ''
       or coalesce(new.payload ->> 'channel', '') not in ('email', 'whatsapp', 'instagram') then
      raise exception 'External approvals need channel (email, whatsapp, instagram), recipient and body' using errcode = '23514';
    end if;
    new.payload := app.message_payload(new.payload ->> 'channel', new.payload ->> 'recipient', new.payload ->> 'subject', new.payload ->> 'body');
  end if;
  new.payload_hash := app.hash(new.payload);
  new.status := 'pending';
  new.requested_at := now();
  new.due_at := now() + pol.sla;
  new.decided_by := null; new.decided_at := null; new.decision_note := null; new.instructions := null;
  return new;
end $$;

create function app.guard_approval_update() returns trigger language plpgsql as $$
begin
  if current_setting('app.deciding', true) is distinct from 'on' then
    raise exception 'Approvals change only through decide_approval()' using errcode = '42501';
  end if;
  if (new.payload, new.payload_hash, new.category, new.lead_id, new.requested_by)
     is distinct from (old.payload, old.payload_hash, old.category, old.lead_id, old.requested_by) then
    raise exception 'Approved content is immutable; request a new approval instead' using errcode = '42501';
  end if;
  return new;
end $$;

create function app.after_approval() returns trigger
language plpgsql security definer set search_path = public as $$
declare pol public.approval_policies;
begin
  select * into pol from public.approval_policies where category = new.category;
  if tg_op = 'INSERT' then
    perform app.emit('approval.requested', 'approval', new.id, new.title, jsonb_build_object('category', new.category, 'lead_id', new.lead_id));
    -- tell everyone who may decide it (uses the existing notifications table)
    insert into public.notifications (profile_id, title, body, kind, link)
    select p.id, 'Approval needed: ' || pol.name, new.title, 'approval', '/approvals#' || new.id
      from public.profiles p where p.role = 'admin' or p.role = pol.delegate_role;
  elsif new.status is distinct from old.status then
    perform app.emit('approval.decided', 'approval', new.id, new.title, jsonb_build_object('category', new.category, 'lead_id', new.lead_id, 'status', new.status, 'note', new.decision_note));
    insert into public.notifications (profile_id, title, body, kind, link)
    select new.requested_by, 'Approval ' || replace(new.status, '_', ' ') || ': ' || new.title, new.decision_note, 'approval', '/leads/' || new.lead_id
     where new.requested_by is not null and new.requested_by is distinct from new.decided_by;
  end if;
  return null;
end $$;

create trigger approvals_insert before insert on public.approvals for each row execute function app.guard_approval_insert();
create trigger approvals_update before update on public.approvals for each row execute function app.guard_approval_update();
create trigger approvals_events after insert or update on public.approvals for each row execute function app.after_approval();

create function public.decide_approval(p_id uuid, p_decision text, p_note text default null, p_instructions text default null)
returns public.approvals
language plpgsql security definer set search_path = public, app as $$
declare
  a public.approvals;
  r text := app.my_role();
  delegate text;
begin
  if r is null then raise exception 'Not a Signal System member' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'rejected', 'revision_requested', 'deferred') then
    raise exception 'Choose approved, rejected, revision_requested or deferred' using errcode = '22023';
  end if;
  select * into a from public.approvals where id = p_id for update;
  if not found then raise exception 'Approval not found' using errcode = 'P0002'; end if;
  if a.status not in ('pending', 'deferred') then raise exception 'Approval already decided (%)', a.status using errcode = '23514'; end if;
  select delegate_role into delegate from public.approval_policies where category = a.category;
  -- null-safe: categories without a delegate stay admin (CEO) only
  if r <> 'admin' and r is distinct from delegate then
    raise exception 'Role % cannot decide % approvals', r, a.category using errcode = '42501';
  end if;
  if r <> 'admin' and a.requested_by = auth.uid() then
    raise exception 'A delegate cannot approve their own request' using errcode = '42501';
  end if;
  if p_decision in ('rejected', 'revision_requested') and coalesce(trim(p_note), '') = '' then
    raise exception 'Explain the rejection or revision in a note' using errcode = '23514';
  end if;
  perform set_config('app.deciding', 'on', true);
  update public.approvals
     set status = p_decision, decided_by = auth.uid(), decided_at = now(),
         decision_note = nullif(trim(p_note), ''), instructions = nullif(trim(p_instructions), '')
   where id = p_id
   returning * into a;
  perform set_config('app.deciding', 'off', true);
  return a;
end $$;

-- ---------- outbox: the only door out ----------
create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null unique references public.approvals (id) on delete restrict, -- unique: one approval sends once
  lead_id uuid not null references public.leads (id),
  contact_id uuid references public.contacts (id),
  channel text not null check (channel in ('email', 'whatsapp', 'instagram')),
  recipient text not null check (length(trim(recipient)) > 0),
  subject text,
  body text not null check (length(trim(body)) > 0),
  status text not null default 'ready' check (status in ('ready', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  sent_by uuid references public.profiles (id),
  provider_ref text,
  failure text,
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
alter table public.lead_activities add constraint lead_activities_outbox_fk foreign key (outbox_id) references public.outbox (id);

create function app.guard_outbox_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a public.approvals;
  pol public.approval_policies;
begin
  select * into a from public.approvals where id = new.approval_id for update;
  if not found then raise exception 'Outbox needs an approval' using errcode = '23503'; end if;
  select * into pol from public.approval_policies where category = a.category;
  if a.status <> 'approved' then raise exception 'Approval is % — only approved content can be sent', a.status using errcode = '42501'; end if;
  if not pol.external then raise exception '% approvals do not authorise external messages', a.category using errcode = '42501'; end if;
  if app.hash(app.message_payload(new.channel, new.recipient, new.subject, new.body)) <> a.payload_hash then
    raise exception 'Outbox content does not match the approved content' using errcode = '42501';
  end if;
  if new.channel = 'whatsapp' and not exists (select 1 from public.contacts where id = new.contact_id and whatsapp_opt_in_at is not null) then
    raise exception 'WhatsApp messages need a contact with a recorded opt-in' using errcode = '42501';
  end if;
  new.lead_id := a.lead_id;
  new.status := 'ready';
  new.sent_at := null; new.sent_by := null; new.provider_ref := null; new.failure := null;
  return new;
end $$;

create function app.guard_outbox_update() returns trigger language plpgsql as $$
begin
  if (new.approval_id, new.lead_id, new.contact_id, new.channel, new.recipient, new.subject, new.body)
     is distinct from (old.approval_id, old.lead_id, old.contact_id, old.channel, old.recipient, old.subject, old.body) then
    raise exception 'Outbox content is immutable' using errcode = '42501';
  end if;
  if new.status = old.status then return new; end if;
  if not ((old.status = 'ready' and new.status in ('sent', 'failed', 'cancelled')) or (old.status = 'failed' and new.status in ('ready', 'cancelled'))) then
    raise exception 'Outbox cannot go from % to %', old.status, new.status using errcode = '23514';
  end if;
  if new.status = 'sent' then
    new.sent_at := coalesce(new.sent_at, now());
    new.sent_by := coalesce(new.sent_by, auth.uid());
  end if;
  return new;
end $$;

create function app.after_outbox() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform app.emit('outbox.queued', 'lead', new.lead_id, new.recipient, jsonb_build_object('outbox_id', new.id, 'channel', new.channel));
  elsif new.status <> old.status then
    perform app.emit('outbox.' || new.status, 'lead', new.lead_id, new.recipient, jsonb_build_object('outbox_id', new.id, 'failure', new.failure));
    if new.status = 'sent' then
      insert into public.lead_activities (lead_id, kind, channel, direction, occurred_at, subject, body, contact_id, outbox_id, created_by)
      values (new.lead_id, new.channel, new.channel, 'outbound', new.sent_at, new.subject, new.body, new.contact_id, new.id, new.sent_by);
    end if;
  end if;
  return null;
end $$;

create trigger outbox_insert before insert on public.outbox for each row execute function app.guard_outbox_insert();
create trigger outbox_update before update on public.outbox for each row execute function app.guard_outbox_update();
create trigger outbox_events after insert or update on public.outbox for each row execute function app.after_outbox();

-- ---------- atomic intake: client + optional contact + lead (+ inbound message) ----------
create function public.create_prospect(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_client uuid;
  v_contact uuid;
  v_lead uuid;
  f jsonb := (select coalesce(jsonb_object_agg(key, nullif(trim(value), '')), '{}') from jsonb_each_text(p) where jsonb_typeof(p -> key) = 'string');
begin
  if f ->> 'client_id' is not null then
    v_client := (f ->> 'client_id')::uuid;
  else
    insert into public.clients (company_name, website, phone, email, industry, address, source, status, notes, tags)
    values (f ->> 'company_name', f ->> 'website', f ->> 'phone', f ->> 'email', f ->> 'industry', f ->> 'address',
            coalesce(f ->> 'source', 'Manual'), 'Lead', f ->> 'notes', coalesce((select array_agg(t) from jsonb_array_elements_text(p -> 'tags') t), '{}'))
    returning id into v_client;
  end if;

  if f ->> 'contact_name' is not null then
    insert into public.contacts (client_id, name, role, email, phone, whatsapp, instagram, consent_basis, is_generic, is_primary)
    values (v_client, f ->> 'contact_name', f ->> 'contact_role', f ->> 'contact_email', f ->> 'contact_phone', f ->> 'contact_whatsapp', f ->> 'contact_instagram',
            coalesce(f ->> 'consent_basis', 'legitimate_interest'), coalesce((f ->> 'contact_is_generic')::boolean, false), true)
    returning id into v_contact;
  end if;

  insert into public.leads (client_id, contact_person, email, phone, service_interest, services, deal_value, source, next_action, next_follow_up, notes)
  select v_client, f ->> 'contact_name', coalesce(f ->> 'contact_email', c.email), coalesce(f ->> 'contact_phone', c.phone), f ->> 'title',
         coalesce((select array_agg(s) from jsonb_array_elements_text(p -> 'services') s), '{}'), coalesce((f ->> 'deal_value')::numeric, 0),
         coalesce(f ->> 'source', c.source), f ->> 'next_action', (f ->> 'next_follow_up')::date, f ->> 'lead_notes'
    from public.clients c where c.id = v_client
  returning id into v_lead;
  if v_lead is null then raise exception 'Client not found or not permitted' using errcode = '42501'; end if;

  if f ->> 'message' is not null then
    insert into public.lead_activities (lead_id, kind, channel, direction, occurred_at, subject, body, contact_id)
    values (v_lead, 'email', 'email', 'inbound', coalesce((f ->> 'message_at')::timestamptz, now()), f ->> 'message_subject', f ->> 'message', v_contact);
  end if;

  return jsonb_build_object('client_id', v_client, 'contact_id', v_contact, 'lead_id', v_lead);
end $$;

-- ---------- audit every business table ----------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename not in ('audit_log', 'activities', 'notifications') loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function app.audit()', t || '_audit', t);
  end loop;
end $$;

-- =====================================================================
-- row level security: replace "dev open" everywhere
-- =====================================================================
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dev open" on public.%I', t);
    execute format('create policy "members read" on public.%I for select to authenticated using (app.my_role() is not null)', t);
  end loop;

  -- ordinary business tables: writers create and edit, admins delete
  for t in select tablename from pg_tables where schemaname = 'public'
            and tablename not in ('approvals', 'outbox', 'audit_log', 'activities', 'approval_policies', 'profiles', 'notifications') loop
    execute format('create policy "writers insert" on public.%I for insert to authenticated with check (app.is_writer())', t);
    execute format('create policy "writers update" on public.%I for update to authenticated using (app.is_writer()) with check (app.is_writer())', t);
    execute format('create policy "admins delete" on public.%I for delete to authenticated using (app.my_role() = ''admin'')', t);
  end loop;
end $$;

-- leads close as Lost, never disappear
drop policy "admins delete" on public.leads;

create policy "own notifications" on public.notifications for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy "members read" on public.notifications;
create policy "own notifications read" on public.notifications for select to authenticated using (profile_id = auth.uid());
create policy "edit own profile" on public.profiles for update to authenticated using (id = auth.uid() or app.my_role() = 'admin') with check (id = auth.uid() or app.my_role() = 'admin');
create policy "writers request approvals" on public.approvals for insert to authenticated with check (app.is_writer() and requested_by = auth.uid());
create policy "writers queue approved messages" on public.outbox for insert to authenticated with check (app.is_writer());
create policy "writers record delivery" on public.outbox for update to authenticated using (app.is_writer()) with check (app.is_writer());

-- ---------- grants ----------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke insert, update, delete on public.audit_log, public.activities, public.approval_policies from authenticated;
revoke delete on public.approvals, public.outbox from authenticated;
revoke insert on public.notifications from authenticated;

revoke all on all functions in schema app from public, anon;
grant usage on schema app to authenticated, service_role;
grant execute on all functions in schema app to authenticated, service_role;
revoke all on function public.move_lead(uuid, text, text, date), public.decide_approval(uuid, text, text, text), public.create_prospect(jsonb) from public, anon;
grant execute on function public.move_lead(uuid, text, text, date), public.create_prospect(jsonb) to authenticated, service_role;
grant execute on function public.decide_approval(uuid, text, text, text) to authenticated;

-- live updates for the Command Center (RLS still applies)
alter publication supabase_realtime add table public.approvals, public.activities;
