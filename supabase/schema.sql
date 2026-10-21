-- PALLET·LAB shared design list (pilot) — run once in Supabase: SQL Editor → New query → paste → Run.
-- Running it again is safe: it only creates what is missing and replaces the functions and rules.
--
-- designs : one row per design; `state` is the design file itself ({fmt, type, saved, f}), the other
--           columns are what the list shows and searches. `id` gives the order designs were added.
-- members : the emails allowed to use the list. Nobody else can read or change a design, even with
--           an account: the tool's publishable key is public, the rules below are what guard the data.

create table if not exists public.designs (
  id         bigint generated always as identity primary key,
  name       text not null unique check (btrim(name) <> ''),
  type       text not null default 'stringer',
  client     text not null default '',
  part_no    text not null default '',
  saved      text not null default '',
  source     text not null default '',
  state      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
create table if not exists public.members (
  email text primary key check (email = lower(email))
);

alter table public.designs enable row level security;
alter table public.members enable row level security;      -- no rules on it: not readable through the API

-- is the signed-in person a member? (security definer: it may read members, the caller may not)
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m
                 where m.email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

drop policy if exists "members read"   on public.designs;
drop policy if exists "members add"    on public.designs;
drop policy if exists "members change" on public.designs;
drop policy if exists "members delete" on public.designs;
create policy "members read"   on public.designs for select to authenticated using (public.is_member());
create policy "members add"    on public.designs for insert to authenticated with check (public.is_member());
create policy "members change" on public.designs for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "members delete" on public.designs for delete to authenticated using (public.is_member());

revoke all on public.designs from anon;
revoke all on public.members from anon, authenticated;
grant select, insert, update, delete on public.designs to authenticated;
grant usage, select on sequence public.designs_id_seq to authenticated;

-- save one design: add it, or replace the one with the same name (it keeps its id, so its place)
create or replace function public.save_design(p_name text, p_state jsonb, p_source text default '')
returns table (id bigint, updated boolean)
language sql security invoker set search_path = public as $$
  insert into public.designs as d (name, type, client, part_no, saved, source, state, updated_at, updated_by)
  values (p_name,
          coalesce(nullif(p_state ->> 'type', ''), 'stringer'),
          coalesce(p_state -> 'f' ->> 'client', ''),
          coalesce(p_state -> 'f' ->> 'partNo', ''),
          coalesce(p_state ->> 'saved', ''),
          coalesce(p_source, ''),
          p_state, now(),
          coalesce(auth.jwt() ->> 'email', ''))
  on conflict (name) do update set
    type = excluded.type, client = excluded.client, part_no = excluded.part_no, saved = excluded.saved,
    source = excluded.source, state = excluded.state, updated_at = now(), updated_by = excluded.updated_by
  returning d.id, (d.xmax::text <> '0');          -- xmax is 0 on a row just added, set on one replaced
$$;

-- save many (an import): all of them or none, one after the other so a repeated name replaces
create or replace function public.save_designs(p_items jsonb)
returns table (added integer, updated integer)
language plpgsql security invoker set search_path = public as $$
declare it jsonb; r record; a integer := 0; u integer := 0;
begin
  for it in select value from jsonb_array_elements(p_items) loop
    select * into r from public.save_design(it ->> 'name', it -> 'state', coalesce(it ->> 'source', ''));
    if r.updated then u := u + 1; else a := a + 1; end if;
  end loop;
  return query select a, u;
end;
$$;

revoke all on function public.save_design(text, jsonb, text) from public, anon;
revoke all on function public.save_designs(jsonb) from public, anon;
grant execute on function public.save_design(text, jsonb, text) to authenticated;
grant execute on function public.save_designs(jsonb) to authenticated;
grant execute on function public.is_member() to anon, authenticated;

-- ===== the people who may use the list: write their emails here (lower case), then Run =====
insert into public.members (email) values
  ('imejia0488@sdsu.edu')
on conflict (email) do nothing;

notify pgrst, 'reload schema';
