-- =====================================================================
-- Signal System — make the governance layer fit the Signal System app
-- (vanilla JS app in this repo). Applies after 20261107000000_governance.sql.
--
-- Decisions (CEO, 2026-11-09):
--   • Pipeline: drag forward freely. Gates: reaching Contacted or later needs a
--     real conversation (an approved message that was sent, or their inbound
--     message on the timeline); moving back, Lost and Nurture need a reason.
--     Won is allowed from any open stage.
--   • WhatsApp from Customers goes through approval, sent by hand via wa.me —
--     so a client (not only a lead) can own an approval and an outbox message.
--   • The app writes its own activity log and notifications.
--   • Admins may delete leads; audit_log keeps the full history.
-- =====================================================================

-- ---------- 1. activities + notifications written by the app ----------
grant insert on public.activities, public.notifications to authenticated;
create policy "writers log activity" on public.activities for insert to authenticated with check (app.is_writer());
create policy "writers notify" on public.notifications for insert to authenticated with check (app.is_writer());

-- app notifications have no recipient (one shared inbox); personal ones keep profile_id
drop policy "own notifications read" on public.notifications;
drop policy "own notifications" on public.notifications;
create policy "own or shared notifications read" on public.notifications for select to authenticated
  using (profile_id = auth.uid() or (profile_id is null and app.my_role() is not null));
create policy "own or shared notifications update" on public.notifications for update to authenticated
  using (profile_id = auth.uid() or (profile_id is null and app.is_writer()))
  with check (profile_id = auth.uid() or (profile_id is null and app.is_writer()));

-- ---------- 2. admins may delete leads ----------
create policy "admins delete" on public.leads for delete to authenticated using (app.my_role() = 'admin');

-- ---------- 3. approvals + outbox can belong to a client ----------
alter table public.approvals
  add column client_id uuid references public.clients (id) on delete restrict,
  alter column lead_id drop not null,
  add constraint approvals_subject check (lead_id is not null or client_id is not null);
create index approvals_client_idx on public.approvals (client_id);

alter table public.outbox
  add column client_id uuid references public.clients (id),
  alter column lead_id drop not null;

create or replace function app.guard_approval_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare pol public.approval_policies;
begin
  select * into pol from public.approval_policies where category = new.category;
  if new.lead_id is not null and new.client_id is null then
    select client_id into new.client_id from public.leads where id = new.lead_id;
  end if;
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

create or replace function app.guard_approval_update() returns trigger language plpgsql as $$
begin
  if current_setting('app.deciding', true) is distinct from 'on' then
    raise exception 'Approvals change only through decide_approval()' using errcode = '42501';
  end if;
  if (new.payload, new.payload_hash, new.category, new.lead_id, new.client_id, new.requested_by)
     is distinct from (old.payload, old.payload_hash, old.category, old.lead_id, old.client_id, old.requested_by) then
    raise exception 'Approved content is immutable; request a new approval instead' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function app.after_approval() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pol public.approval_policies;
  subject text := coalesce((select company from public.leads where id = new.lead_id), (select company_name from public.clients where id = new.client_id));
begin
  select * into pol from public.approval_policies where category = new.category;
  if tg_op = 'INSERT' then
    perform app.emit('approval.requested', 'approval', new.id, new.title,
      jsonb_build_object('category', new.category, 'lead_id', new.lead_id, 'client_id', new.client_id, 'subject', subject));
    insert into public.notifications (profile_id, title, body, kind, link)
    select p.id, 'Approval needed: ' || pol.name, coalesce(subject || ' · ', '') || new.title, 'approval', '#/approvals'
      from public.profiles p where p.role = 'admin' or p.role = pol.delegate_role;
  elsif new.status is distinct from old.status then
    perform app.emit('approval.decided', 'approval', new.id, new.title,
      jsonb_build_object('category', new.category, 'lead_id', new.lead_id, 'client_id', new.client_id, 'status', new.status, 'note', new.decision_note));
    insert into public.notifications (profile_id, title, body, kind, link)
    select new.requested_by, 'Approval ' || replace(new.status, '_', ' ') || ': ' || new.title, new.decision_note, 'approval',
           case when new.status = 'approved' then '#/outbox' else '#/approvals' end
     where new.requested_by is not null and new.requested_by is distinct from new.decided_by;
  end if;
  return null;
end $$;

-- WhatsApp is sent by hand through wa.me (the person's own WhatsApp), so no
-- API opt-in is required here. When n8n sends through the WhatsApp Cloud API
-- (Phase 2), the opt-in check moves into that connector.
create or replace function app.guard_outbox_insert() returns trigger
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
  new.lead_id := a.lead_id;
  new.client_id := a.client_id;
  new.status := 'ready';
  new.sent_at := null; new.sent_by := null; new.provider_ref := null; new.failure := null;
  return new;
end $$;

create or replace function app.guard_outbox_update() returns trigger language plpgsql as $$
begin
  if (new.approval_id, new.lead_id, new.client_id, new.contact_id, new.channel, new.recipient, new.subject, new.body)
     is distinct from (old.approval_id, old.lead_id, old.client_id, old.contact_id, old.channel, old.recipient, old.subject, old.body) then
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

create or replace function app.after_outbox() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform app.emit('outbox.queued', 'outbox', new.id, new.recipient, jsonb_build_object('lead_id', new.lead_id, 'client_id', new.client_id, 'channel', new.channel));
  elsif new.status <> old.status then
    perform app.emit('outbox.' || new.status, 'outbox', new.id, new.recipient,
      jsonb_build_object('lead_id', new.lead_id, 'client_id', new.client_id, 'channel', new.channel, 'failure', new.failure));
    if new.status = 'sent' and new.lead_id is not null then
      insert into public.lead_activities (lead_id, kind, channel, direction, occurred_at, subject, body, contact_id, outbox_id, created_by)
      values (new.lead_id, new.channel, new.channel, 'outbound', new.sent_at, new.subject, new.body, new.contact_id, new.id, new.sent_by);
    end if;
    if new.status = 'sent' and new.client_id is not null then
      update public.leads set last_contact = new.sent_at::date where client_id = new.client_id and stage not in ('Won', 'Lost');
    end if;
  end if;
  return null;
end $$;

-- ---------- 4. pipeline rules ----------
-- inserts (new leads, imports) may start at any stage; changes stay governed
create or replace function app.guard_lead_insert() returns trigger language plpgsql as $$
begin
  if new.client_id is not null and new.company is null then
    select company_name into new.company from public.clients where id = new.client_id;
  end if;
  new.stage_changed_at := now();
  return new;
end $$;

create or replace function app.guard_lead_stage() returns trigger language plpgsql as $$
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
  end if;
  if new.stage in ('Lost', 'Nurture') and new.stage_reason is null then
    raise exception 'A reason is required to move to %', new.stage using errcode = '23514';
  end if;
  if f is not null and t is not null and t < f and new.stage_reason is null then
    raise exception 'A reason is required to move back a stage' using errcode = '23514';
  end if;
  -- gate: past Qualified only after a real conversation
  if new.stage not in ('New Lead', 'Qualified', 'Lost', 'Nurture') and old.stage in ('New Lead', 'Qualified', 'Nurture')
     and not exists (select 1 from public.outbox o where o.status = 'sent' and (o.lead_id = new.id or (new.client_id is not null and o.client_id = new.client_id)))
     and not exists (select 1 from public.lead_activities la where la.lead_id = new.id and la.direction = 'inbound') then
    raise exception 'Moving to % needs a conversation first: send an approved message (Approvals → Outbox) or log their reply as inbound', new.stage using errcode = '23514';
  end if;
  new.stage_changed_at := now();
  return new;
end $$;
