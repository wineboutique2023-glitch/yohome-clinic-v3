
create extension if not exists "uuid-ossp";

create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  date_of_birth date,
  address text,
  emergency_contact text,
  notes text,
  created_by uuid references auth.users(id)
);

create table if not exists public.intake_forms (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients(id) on delete cascade,
  form_date date,
  therapist text,
  main_reason text,
  conditions_injuries text,
  medications text,
  allergies text,
  areas_to_avoid text,
  consent_notes text,
  file_name text,
  created_by uuid references auth.users(id)
);

create table if not exists public.soap_notes (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients(id) on delete cascade,
  session_date date,
  therapist text,
  subjective text,
  objective text,
  assessment text,
  plan text,
  techniques_used text,
  session_duration text,
  next_review text,
  file_name text,
  created_by uuid references auth.users(id)
);

alter table public.clients enable row level security;
alter table public.intake_forms enable row level security;
alter table public.soap_notes enable row level security;

drop policy if exists "clinic staff read clients" on public.clients;
create policy "clinic staff read clients" on public.clients for select to authenticated using (true);
drop policy if exists "clinic staff insert clients" on public.clients;
create policy "clinic staff insert clients" on public.clients for insert to authenticated with check (true);
drop policy if exists "clinic staff update clients" on public.clients;
create policy "clinic staff update clients" on public.clients for update to authenticated using (true) with check (true);
drop policy if exists "clinic staff delete clients" on public.clients;
create policy "clinic staff delete clients" on public.clients for delete to authenticated using (true);

drop policy if exists "clinic staff read intake" on public.intake_forms;
create policy "clinic staff read intake" on public.intake_forms for select to authenticated using (true);
drop policy if exists "clinic staff insert intake" on public.intake_forms;
create policy "clinic staff insert intake" on public.intake_forms for insert to authenticated with check (true);
drop policy if exists "clinic staff update intake" on public.intake_forms;
create policy "clinic staff update intake" on public.intake_forms for update to authenticated using (true) with check (true);
drop policy if exists "clinic staff delete intake" on public.intake_forms;
create policy "clinic staff delete intake" on public.intake_forms for delete to authenticated using (true);

drop policy if exists "clinic staff read soap" on public.soap_notes;
create policy "clinic staff read soap" on public.soap_notes for select to authenticated using (true);
drop policy if exists "clinic staff insert soap" on public.soap_notes;
create policy "clinic staff insert soap" on public.soap_notes for insert to authenticated with check (true);
drop policy if exists "clinic staff update soap" on public.soap_notes;
create policy "clinic staff update soap" on public.soap_notes for update to authenticated using (true) with check (true);
drop policy if exists "clinic staff delete soap" on public.soap_notes;
create policy "clinic staff delete soap" on public.soap_notes for delete to authenticated using (true);
