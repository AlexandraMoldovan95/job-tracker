-- Job Tracker - an application can only point to one of your own companies.
-- Run once in Supabase -> SQL Editor, on a project already set up with schema.sql.
-- Safe to run again: each policy is dropped and created again.
--
-- Why: the policies in schema.sql check that an application is yours (user_id), but not
-- that the company it points to (companie_id) is yours too. The app only ever offers your
-- own companies, but someone calling the API directly with another user's company id
-- could attach an application to it. They still couldn't read that company (its own RLS
-- hides it), but if the other user deleted their company, the stranger's application
-- would be deleted with it ("on delete cascade"). Now Postgres checks both, on insert
-- and on update.
--
-- All in one transaction: if any line fails, nothing changes.

begin;

drop policy if exists "aplicari_insert_own" on public.aplicari;
create policy "aplicari_insert_own" on public.aplicari
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.companii c
      where c.id = aplicari.companie_id and c.user_id = auth.uid()
    )
  );

-- "using" picks the rows you may change (yours); "with check" validates the new values,
-- so an application can't be moved to another user or to another user's company.
drop policy if exists "aplicari_update_own" on public.aplicari;
create policy "aplicari_update_own" on public.aplicari
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.companii c
      where c.id = aplicari.companie_id and c.user_id = auth.uid()
    )
  );

commit;

-- Check: applications that already point to someone else's company.
-- Expected result: "Success. No rows returned". The SQL Editor runs as an admin, so this
-- sees every user's rows. Rows made before this change are not touched by it.
select a.id as application_id, a.user_id as application_owner, c.user_id as company_owner
from public.aplicari a
join public.companii c on c.id = a.companie_id
where a.user_id <> c.user_id;
