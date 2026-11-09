// Database governance tests — dev only, the app stays static.
// Builds the database exactly like production: supabase/schema.sql (with its
// "dev open" policies) + supabase/migrations/*, in PGlite (Postgres in-process),
// with a minimal stand-in for what Supabase provides (roles, auth.uid(), realtime).
// Run: cd tests && npm install && npm test
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const SCHEMA = new URL('../supabase/schema.sql', import.meta.url);
const MIGRATIONS = new URL('../supabase/migrations/', import.meta.url);

const SUPABASE_SHIM = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  create publication supabase_realtime;
`;

const U = {
  admin: '00000000-0000-0000-0000-00000000000c', // CEO
  manager: '00000000-0000-0000-0000-00000000000a', // delegate
  member: '00000000-0000-0000-0000-00000000000b',
  viewer: '00000000-0000-0000-0000-00000000000d',
  stranger: '00000000-0000-0000-0000-00000000000e' // signed in, no profile
};

let db;
async function as(uid, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return (await db.query(sql, params)).rows; }
  finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
const one = async (uid, sql, params) => (await as(uid, sql, params))[0];
const sys = async (sql, params = []) => (await db.query(sql, params)).rows;
const move = (uid, id, to, reason = null) => as(uid, `select public.move_lead($1, $2, $3)`, [id, to, reason]);
const approve = (uid, id, d = 'approved', note = null) => as(uid, `select public.decide_approval($1, $2, $3)`, [id, d, note]);
const request = (uid, { category = 'outreach', lead = null, client = null, payload }) =>
  one(uid, `insert into public.approvals (category, lead_id, client_id, title, proposed_action, payload) values ($1, $2, $3, 'Req', 'x', $4) returning *`,
    [category, lead, client, JSON.stringify(payload)]);
const queue = (uid, apId, m) =>
  one(uid, `insert into public.outbox (approval_id, channel, recipient, subject, body) values ($1, $2, $3, $4, $5) returning *`, [apId, m.channel, m.recipient, m.subject, m.body]);

const MAIL = { channel: 'email', recipient: 'budi@dapursedap.test', subject: 'Menu online', body: 'Halo Pak Budi, ...' };
const WA = { channel: 'whatsapp', recipient: '6281234567890', subject: '', body: 'Halo kak, kami dari Signal Society ...' };
let mapsClient, leadA;

before(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  // gen_random_uuid() is built in; PGlite has no pgcrypto by default
  await db.exec(readFileSync(SCHEMA, 'utf8').replace(/create extension if not exists "pgcrypto";/, ''));
  // data that exists before the migrations (Maps import) must survive them
  await db.exec(`insert into public.clients (company_name, phone, source, status, notes) values ('Bloom Studio Pilates', '0823-1301-5190', 'Google Maps', 'Lead', 'place_id:ChIJtest')`);
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(f, MIGRATIONS), 'utf8'));
  }
  await db.exec(`
    insert into auth.users (id) values ('${U.admin}'), ('${U.manager}'), ('${U.member}'), ('${U.viewer}'), ('${U.stranger}');
    insert into public.profiles (id, full_name, role) values
      ('${U.admin}', 'Sissy', 'admin'), ('${U.manager}', 'Ops', 'manager'), ('${U.member}', 'Member', 'member'), ('${U.viewer}', 'Viewer', 'viewer');
  `);
  mapsClient = (await sys(`select id from public.clients where notes = 'place_id:ChIJtest'`))[0].id;
});

test('security: no "dev open" left; anon sees nothing; non-members see nothing; viewers read only', async () => {
  assert.equal((await sys(`select count(*)::int n from pg_policies where policyname = 'dev open'`))[0].n, 0);
  assert.equal((await sys(`select count(*)::int n from pg_tables where schemaname = 'public' and not rowsecurity`))[0].n, 0);
  await db.exec(`set role anon`);
  await assert.rejects(db.query('select * from public.clients'), /permission denied/);
  await db.exec(`reset role`);
  assert.equal((await as(U.stranger, 'select * from public.clients')).length, 0);
  assert.equal((await as(U.viewer, 'select * from public.clients')).length, 1, 'existing Maps client survived and is readable');
  await assert.rejects(as(U.viewer, `insert into public.clients (company_name) values ('X')`), /row-level security/);
});

test('the app can write its own activity log and shared notifications', async () => {
  await as(U.member, `insert into public.activities (actor_name, action, entity_kind, entity_label) values ('Member', 'created client', 'clients', 'X')`);
  await as(U.member, `insert into public.notifications (title, kind, link) values ('Invoice drafted', 'info', '#/invoices')`);
  assert.ok((await as(U.viewer, `select * from public.notifications where title = 'Invoice drafted'`)).length === 1, 'shared notification visible to members');
  await assert.rejects(as(U.viewer, `insert into public.activities (action) values ('x')`), /row-level security/);
  await assert.rejects(as(U.admin, `delete from public.activities`), /permission denied/);
});

test('pipeline: free forward moves, but past Qualified needs a real conversation', async () => {
  leadA = (await one(U.member, `insert into public.leads (client_id, stage) values ($1, 'New Lead') returning id`, [mapsClient])).id;
  assert.equal((await one(U.member, `select company from public.leads where id = $1`, [leadA])).company, 'Bloom Studio Pilates');
  await assert.rejects(as(U.member, `update public.leads set stage = 'Qualified' where id = $1`, [leadA]), /move_lead/);
  await move(U.member, leadA, 'Qualified');
  assert.equal((await one(U.member, `select status from public.clients where id = $1`, [mapsClient])).status, 'Prospect');
  await assert.rejects(move(U.member, leadA, 'Discovery'), /needs a conversation first/);
  await assert.rejects(move(U.member, leadA, 'Won'), /needs a conversation first/);
  // an outbound note logged by hand does NOT open the gate
  await as(U.member, `insert into public.lead_activities (lead_id, channel, direction, body) values ($1, 'whatsapp', 'outbound', 'sent by hand')`, [leadA]);
  await assert.rejects(move(U.member, leadA, 'Contacted'), /needs a conversation first/);
  await assert.rejects(move(U.member, leadA, 'Lost'), /reason is required/);
});

test('WhatsApp from Customers: client-level approval → exact text → sent → gate opens for its lead', async () => {
  const ap = await request(U.member, { client: mapsClient, payload: WA });
  assert.equal(ap.status, 'pending');
  assert.equal(ap.lead_id, null);
  const notes = (await sys(`select profile_id from public.notifications where link = '#/approvals'`)).map((r) => r.profile_id).sort();
  assert.deepEqual(notes, [U.admin, U.manager].sort(), 'CEO and delegate are notified');
  await assert.rejects(queue(U.member, ap.id, WA), /only approved content/);
  await approve(U.admin, ap.id);
  await assert.rejects(queue(U.member, ap.id, { ...WA, body: WA.body + ' Diskon 50%!' }), /does not match/);
  const ob = await queue(U.member, ap.id, WA);
  assert.equal(ob.client_id, mapsClient, 'client copied from approval');
  await assert.rejects(queue(U.member, ap.id, WA), /outbox_approval_id_key/);
  await as(U.member, `update public.outbox set status = 'sent', provider_ref = 'wa.me' where id = $1`, [ob.id]);
  // the lead of that client may now skip ahead
  await move(U.member, leadA, 'Discovery');
  await move(U.member, leadA, 'Proposal');
  await assert.rejects(move(U.member, leadA, 'Discovery'), /reason is required to move back/);
  await move(U.member, leadA, 'Discovery', 'Client asked for a demo first');
  await move(U.member, leadA, 'Won');
  const c = await one(U.admin, `select l.converted_client_id, c.status from public.leads l join public.clients c on c.id = l.client_id where l.id = $1`, [leadA]);
  assert.deepEqual(c, { converted_client_id: mapsClient, status: 'Active Client' });
  await assert.rejects(move(U.member, leadA, 'Lost', 'x'), /closed/);
});

test('inbound message opens the gate for a lead without a client (old Leads module)', async () => {
  const id = (await one(U.member, `insert into public.leads (company, stage) values ('Kopi Senja', 'Qualified') returning id`)).id;
  await assert.rejects(move(U.member, id, 'Negotiation'), /needs a conversation first/);
  await as(U.member, `insert into public.lead_activities (lead_id, channel, direction, body) values ($1, 'whatsapp', 'inbound', 'Kak, mau tanya harga website')`, [id]);
  await move(U.member, id, 'Negotiation');
  // imports may insert at any stage
  await as(U.member, `insert into public.leads (company, stage) values ('Imported deal', 'Proposal')`);
});

test('approval rights: delegate decides outreach only; CEO-only categories stay CEO-only', async () => {
  const lead = (await one(U.member, `insert into public.leads (company) values ('Rights Co') returning id`)).id;
  const contract = await request(U.member, { category: 'contract', lead, payload: MAIL });
  await assert.rejects(approve(U.manager, contract.id), /cannot decide contract/);
  await assert.rejects(approve(U.member, contract.id), /cannot decide contract/);
  const outreach = await request(U.member, { lead, payload: MAIL });
  await approve(U.manager, outreach.id);
  const own = await request(U.manager, { lead, payload: MAIL });
  await assert.rejects(approve(U.manager, own.id), /own request/);
  await assert.rejects(approve(U.admin, own.id, 'rejected'), /note/);
  await approve(U.admin, own.id, 'rejected', 'Too pushy');
  assert.equal((await as(U.member, `update public.approvals set status = 'approved' where id = $1 returning id`, [own.id])).length, 0);
  await assert.rejects(request(U.member, { lead, payload: { ...MAIL, channel: 'fax' } }), /External approvals need/);
  const demo = await request(U.member, { category: 'demo-request', lead, payload: { tier: 'T2' } });
  await approve(U.admin, demo.id);
  await assert.rejects(queue(U.member, demo.id, MAIL), /do not authorise external/);
});

test('deletes: admins may delete leads, others may not; governance records never', async () => {
  const id = (await one(U.member, `insert into public.leads (company) values ('Delete me') returning id`)).id;
  assert.equal((await as(U.member, `delete from public.leads where id = $1 returning id`, [id])).length, 0);
  assert.equal((await as(U.admin, `delete from public.leads where id = $1 returning id`, [id])).length, 1);
  await assert.rejects(as(U.admin, `delete from public.approvals`), /permission denied/);
  await assert.rejects(as(U.admin, `delete from public.audit_log`), /permission denied/);
  assert.ok((await one(U.admin, `select count(*)::int n from public.audit_log where table_name = 'leads' and op = 'DELETE' and row_id = $1::text`, [id])).n === 1, 'deletion is audited');
  await assert.rejects(as(U.member, `update public.profiles set role = 'admin' where id = $1`, [U.member]), /Only an admin/);
});
