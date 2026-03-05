-- Conversations architecture (group + direct chats)

-- 1) Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) Conversation participants
create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default now()
);

-- no unique constraints by business requirement

-- 3) messages -> conversation_id
alter table public.messages
add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;

-- RLS
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;

create policy "Users can see their conversations"
on public.conversations
for select
using (
  exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = conversations.id
      and p.user_id = auth.uid()
  )
);

create policy "Users can create conversations"
on public.conversations
for insert
with check (created_by = auth.uid());

create policy "Users can see participants of their conversations"
on public.conversation_participants
for select
using (
  exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = conversation_participants.conversation_id
      and p.user_id = auth.uid()
  )
);

create policy "Users can add participants"
on public.conversation_participants
for insert
with check (true);

create policy "Users can read messages in their conversations"
on public.messages
for select
using (
  exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = messages.conversation_id
      and p.user_id = auth.uid()
  )
);

create policy "Users can send messages"
on public.messages
for insert
with check (
  exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = conversation_id
      and p.user_id = auth.uid()
  )
);
