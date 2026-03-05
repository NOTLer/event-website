-- supabase/messages_conversations_link.sql

begin;

-- 1) messages: allow group-chat messages without receiver_id
alter table public.messages
  alter column receiver_id drop not null;

-- 2) link messages -> conversations
alter table public.messages
  add column if not exists conversation_id uuid null references public.conversations(id) on delete cascade;

-- 3) optional: sanity constraint (either DM or conversation)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_dm_or_conversation_check'
  ) then
    alter table public.messages
      add constraint messages_dm_or_conversation_check
      check (
        (conversation_id is not null and receiver_id is null)
        or
        (conversation_id is null and receiver_id is not null)
      );
  end if;
end $$;

-- 4) index
create index if not exists idx_messages_conversation_id_created_at
  on public.messages(conversation_id, created_at desc);

-- 5) touch conversations.updated_at when a new message appears
create or replace function public.touch_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.conversation_id is not null then
    update public.conversations
    set updated_at = now()
    where id = new.conversation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_conversation_updated_at on public.messages;

create trigger trg_touch_conversation_updated_at
after insert on public.messages
for each row
execute function public.touch_conversation_updated_at();

commit;