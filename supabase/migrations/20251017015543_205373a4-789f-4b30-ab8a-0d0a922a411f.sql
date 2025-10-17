-- CRITICAL SECURITY FIX: Move roles to separate table to prevent privilege escalation
-- Step 1: Create app_role enum
create type public.app_role as enum ('provider', 'seeker');

-- Step 2: Create user_roles table with proper security
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamp with time zone default now(),
  unique (user_id, role)
);

-- Step 3: Enable RLS
alter table public.user_roles enable row level security;

-- Step 4: Create security definer function to check roles (bypasses RLS to prevent recursion)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Step 5: Create helper function to get user's primary role
create or replace function public.get_user_role(_user_id uuid)
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_roles
  where user_id = _user_id
  limit 1
$$;

-- Step 6: RLS policy - users can only see their own roles
create policy "Users can view their own roles"
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id);

-- Step 7: Migrate existing data from profiles.role to user_roles (only valid auth.users)
insert into public.user_roles (user_id, role)
select p.id, p.role::app_role
from public.profiles p
inner join auth.users u on u.id = p.id
where p.role is not null
on conflict (user_id, role) do nothing;

-- Step 8: Drop the role column from profiles (no longer needed)
alter table public.profiles drop column if exists role;

-- Step 9: Update profiles RLS to allow updates
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Step 10: Create trigger to auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();