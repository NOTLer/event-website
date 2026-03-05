-- Add file payload metadata to messages for storage-based attachments
alter table public.messages
  add column if not exists message_type text default 'text';

alter table public.messages
  add column if not exists file_url text;

alter table public.messages
  add column if not exists file_name text;

alter table public.messages
  add column if not exists file_size bigint;

alter table public.messages
  add column if not exists file_type text;
