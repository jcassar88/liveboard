-- One row per student per live session.
-- "snapshot" holds a tldraw store snapshot (JSON) for that student's canvas.
create table if not exists canvases (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  student_id text not null,
  student_name text,
  snapshot jsonb,
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists canvases_session_id_idx on canvases (session_id);

-- Keep updated_at current on every write, used by the teacher view to
-- sort by "most recently active" student.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists canvases_set_updated_at on canvases;
create trigger canvases_set_updated_at
  before update on canvases
  for each row execute procedure set_updated_at();

-- Enable Realtime so the teacher view can subscribe to postgres_changes.
alter publication supabase_realtime add table canvases;

-- RLS: locked down for now (anon key can read/write everything) since this
-- is a v1 prototype behind an LTI-authenticated app, not a public API.
-- Before going anywhere near production, replace this with policies scoped
-- to session_id + a verified LTI launch token.
alter table canvases enable row level security;

create policy "anon can read canvases" on canvases
  for select using (true);

create policy "anon can write canvases" on canvases
  for insert with check (true);

create policy "anon can update canvases" on canvases
  for update using (true);
