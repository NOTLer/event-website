-- Fix message deletion so it is removed in DB (not only hidden in UI).
-- Run this in Supabase SQL editor.

-- 1) Ensure sender can delete own messages directly when RLS is enabled.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname = 'messages_delete_own'
  ) then
    create policy messages_delete_own
      on public.messages
      for delete
      using (auth.uid() = sender_id);
  end if;
end
$$;

-- 2) RPC fallback for frontend (works consistently through PostgREST).
create or replace function public.delete_own_message(p_message_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
begin
  delete from public.messages
  where id::text = p_message_id
    and sender_id = auth.uid()
  returning id::text into v_id;

  return v_id;
end;
$$;

revoke all on function public.delete_own_message(text) from public;
grant execute on function public.delete_own_message(text) to authenticated;
