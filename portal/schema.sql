-- =====================================================================
-- VEXEL MEDIA — CLIENT PORTAL SCHEMA
-- Run this whole file in Supabase SQL Editor (Database → SQL Editor → New)
-- =====================================================================

-- 1. PROFILES TABLE (extends Supabase auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  company text,
  phone text,
  package text, -- 'Basic' / 'Starter' / 'Growth' / 'Scale' / null for one-off
  role text default 'client' check (role in ('client', 'admin')),
  created_at timestamptz default now()
);

-- Auto-create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. PROJECTS TABLE — top-level containers (e.g., "Brand identity 2026")
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  status text default 'active' check (status in ('active', 'archived')),
  created_at timestamptz default now()
);


-- 3. TASKS TABLE — items inside a project
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text,
  status text default 'submitted' check (
    status in ('submitted', 'in_progress', 'review', 'revisions', 'delivered')
  ),
  due_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tasks_project_idx on public.tasks(project_id);


-- 4. TASK FILES — references uploaded by client + deliverables uploaded by admin
-- ---------------------------------------------------------------------
create table if not exists public.task_files (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  file_path text not null,         -- path in the storage bucket
  file_name text not null,
  file_size bigint,
  file_type text default 'reference' check (file_type in ('reference', 'deliverable')),
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz default now()
);

create index if not exists task_files_task_idx on public.task_files(task_id);


-- 5. TASK MESSAGES — comment thread per task
-- ---------------------------------------------------------------------
create table if not exists public.task_messages (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  message text not null,
  created_at timestamptz default now()
);

create index if not exists task_messages_task_idx on public.task_messages(task_id);


-- =====================================================================
-- ROW-LEVEL SECURITY (RLS) — clients only see their own data, admins see all
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_files enable row level security;
alter table public.task_messages enable row level security;

-- helper function: is the current user an admin?
create or replace function public.is_admin()
returns boolean as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- PROFILES policies ---------------------------------------------------
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

drop policy if exists "Admins can insert profiles" on public.profiles;
create policy "Admins can insert profiles" on public.profiles
  for insert with check (public.is_admin());

-- PROJECTS policies ---------------------------------------------------
drop policy if exists "Clients see own projects" on public.projects;
create policy "Clients see own projects" on public.projects
  for select using (client_id = auth.uid() or public.is_admin());

drop policy if exists "Clients create own projects" on public.projects;
create policy "Clients create own projects" on public.projects
  for insert with check (client_id = auth.uid() or public.is_admin());

drop policy if exists "Admins update projects" on public.projects;
create policy "Admins update projects" on public.projects
  for update using (public.is_admin());

drop policy if exists "Admins delete projects" on public.projects;
create policy "Admins delete projects" on public.projects
  for delete using (public.is_admin());

-- TASKS policies ------------------------------------------------------
drop policy if exists "Tasks: visible to project owner + admins" on public.tasks;
create policy "Tasks: visible to project owner + admins" on public.tasks
  for select using (
    exists(select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "Tasks: insertable by project owner + admins" on public.tasks;
create policy "Tasks: insertable by project owner + admins" on public.tasks
  for insert with check (
    exists(select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "Tasks: updatable by project owner + admins" on public.tasks;
create policy "Tasks: updatable by project owner + admins" on public.tasks
  for update using (
    exists(select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "Tasks: deletable by admins" on public.tasks;
create policy "Tasks: deletable by admins" on public.tasks
  for delete using (public.is_admin());

-- TASK_FILES policies -------------------------------------------------
drop policy if exists "Files: visible if task is visible" on public.task_files;
create policy "Files: visible if task is visible" on public.task_files
  for select using (
    exists(
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and (p.client_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Files: clients upload references, admins upload anything" on public.task_files;
create policy "Files: clients upload references, admins upload anything" on public.task_files
  for insert with check (
    public.is_admin()
    or (
      file_type = 'reference'
      and exists(
        select 1 from public.tasks t
        join public.projects p on p.id = t.project_id
        where t.id = task_id and p.client_id = auth.uid()
      )
    )
  );

drop policy if exists "Files: deletable by uploader + admins" on public.task_files;
create policy "Files: deletable by uploader + admins" on public.task_files
  for delete using (uploaded_by = auth.uid() or public.is_admin());

-- TASK_MESSAGES policies ----------------------------------------------
drop policy if exists "Messages: visible if task is visible" on public.task_messages;
create policy "Messages: visible if task is visible" on public.task_messages
  for select using (
    exists(
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and (p.client_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Messages: postable if task is visible" on public.task_messages;
create policy "Messages: postable if task is visible" on public.task_messages
  for insert with check (
    user_id = auth.uid()
    and exists(
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and (p.client_id = auth.uid() or public.is_admin())
    )
  );


-- =====================================================================
-- STORAGE BUCKET for task files
-- After running this SQL, also do this in the Supabase UI:
--   1. Go to Storage → Create bucket
--   2. Name: 'task-files'
--   3. Public: NO (private bucket)
-- The policies below restrict access at the storage level too.
-- =====================================================================

-- Storage policies (run after creating the bucket)
-- These let users upload/read files for tasks they have access to.

insert into storage.buckets (id, name, public)
values ('task-files', 'task-files', false)
on conflict (id) do nothing;

drop policy if exists "Storage: read if task accessible" on storage.objects;
create policy "Storage: read if task accessible" on storage.objects
  for select using (
    bucket_id = 'task-files' and (
      public.is_admin()
      or exists(
        select 1 from public.task_files tf
        join public.tasks t on t.id = tf.task_id
        join public.projects p on p.id = t.project_id
        where tf.file_path = name and p.client_id = auth.uid()
      )
    )
  );

drop policy if exists "Storage: upload to own task folders" on storage.objects;
create policy "Storage: upload to own task folders" on storage.objects
  for insert with check (
    bucket_id = 'task-files' and (
      public.is_admin()
      or auth.role() = 'authenticated'
    )
  );

drop policy if exists "Storage: delete own files + admin" on storage.objects;
create policy "Storage: delete own files + admin" on storage.objects
  for delete using (
    bucket_id = 'task-files' and (owner = auth.uid() or public.is_admin())
  );

-- =====================================================================
-- DONE! Now:
--  1. Sign up your admin account via the website's /login page
--  2. Run this in SQL Editor (replace YOUR_EMAIL):
--     update public.profiles set role = 'admin' where email = 'YOUR_EMAIL';
-- =====================================================================
