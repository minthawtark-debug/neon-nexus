create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end; $$;

revoke execute on function public.has_role(bigint, public.app_role) from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;