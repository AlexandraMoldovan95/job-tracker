-- Job Tracker - "Delete account". Run once in Supabase -> SQL Editor.
--
-- Why a database function: a signed-in user can delete their own rows through
-- Row Level Security, but not their account - only an admin can remove a row
-- from auth.users. This function runs with its owner's rights (security
-- definer) and only ever touches the caller's own data (auth.uid()), so the
-- browser can call it safely with the public key.
--
-- user_id in every table references auth.users WITHOUT "on delete cascade",
-- so the user's rows are deleted first, then the account.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.';
  end if;

  -- The shared demo account is kept, so whoever uses it can't delete it for everyone.
  if me = 'b50e790b-6604-4833-bcc5-1bfd5a2a9668'::uuid then
    raise exception 'The shared demo account can''t be deleted.';
  end if;

  delete from public.aplicari    where user_id = me;  -- applications (they reference companies)
  delete from public.companii    where user_id = me;  -- companies
  delete from public.cv_versiuni where user_id = me;  -- resume versions
  delete from auth.users         where id = me;       -- the account itself; its sessions go with it
end;
$$;

-- Only signed-in users may call it, never anonymous visitors.
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
