-- Canonical conversations/messages schema for persistent chats

create table if not exists public.conversations (
  id uuid not null default gen_random_uuid(),
  title text null,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint conversations_pkey primary key (id),
  constraint conversations_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null
) tablespace pg_default;

create table if not exists public.conversation_participants (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid null,
  user_id uuid null,
  joined_at timestamp with time zone null default now(),
  constraint conversation_participants_pkey primary key (id),
  constraint conversation_participants_conversation_id_fkey foreign key (conversation_id) references public.conversations (id) on delete cascade,
  constraint conversation_participants_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
) tablespace pg_default;

alter table public.messages alter column receiver_id drop not null;
alter table public.messages add column if not exists conversation_id uuid null references public.conversations(id) on delete cascade;

alter table public.messages
  drop constraint if exists messages_dm_or_conversation_check;

alter table public.messages
  add constraint messages_dm_or_conversation_check check (
    (
      (conversation_id is not null and receiver_id is null)
      or
      (conversation_id is null and receiver_id is not null)
    )
  );

create index if not exists messages_sender_idx on public.messages using btree (sender_id, created_at desc) tablespace pg_default;
create index if not exists messages_receiver_idx on public.messages using btree (receiver_id, created_at desc) tablespace pg_default;
create index if not exists messages_pair_idx on public.messages using btree (sender_id, receiver_id, created_at desc) tablespace pg_default;
create index if not exists messages_unread_idx on public.messages using btree (receiver_id, sender_id, created_at desc) tablespace pg_default
where
  (read_at is null);
create index if not exists idx_messages_conversation_id_created_at on public.messages using btree (conversation_id, created_at desc) tablespace pg_default;


drop trigger if exists trg_guard_messages_update on public.messages;
do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'guard_messages_update'
      and pg_function_is_visible(oid)
  ) then
    create trigger trg_guard_messages_update
    before update on public.messages for each row
    execute function public.guard_messages_update();
  end if;
end $$;

drop trigger if exists trg_touch_conversation_updated_at on public.messages;
create trigger trg_touch_conversation_updated_at
after insert on public.messages for each row when (new.conversation_id is not null)
execute function public.touch_conversation_updated_at();
