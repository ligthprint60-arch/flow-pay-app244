
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  bio text,
  is_author boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_read_all" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);

-- WALLETS
create table public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rflow_balance bigint not null default 500000, -- starter 500k UZS
  fflow_pending bigint not null default 0,
  fflow_active bigint not null default 0,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;
create policy "wallets_read_own" on public.wallets for select to authenticated using (auth.uid() = user_id);
create policy "wallets_insert_own" on public.wallets for insert to authenticated with check (auth.uid() = user_id);
create policy "wallets_update_own" on public.wallets for update to authenticated using (auth.uid() = user_id);

-- TRANSACTIONS
create type public.tx_type as enum ('payment','transfer','fragmentation','donation','quiz_reward','spend_reward','liquidity_lock');
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.tx_type not null,
  rflow_delta bigint not null default 0,
  fflow_pending_delta bigint not null default 0,
  fflow_active_delta bigint not null default 0,
  counterparty text,
  note text,
  created_at timestamptz not null default now()
);
create index on public.transactions(user_id, created_at desc);
grant select, insert on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "tx_read_own" on public.transactions for select to authenticated using (auth.uid() = user_id);
create policy "tx_insert_own" on public.transactions for insert to authenticated with check (auth.uid() = user_id);

-- POSTS
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  topic text,
  likes int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.posts(created_at desc);
grant select, insert on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts_read_all" on public.posts for select to authenticated using (true);
create policy "posts_insert_author" on public.posts for insert to authenticated
  with check (auth.uid() = author_id and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_author = true));

-- QUIZZES
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  options jsonb not null, -- ["a","b","c","d"]
  correct_index int not null,
  reward int not null default 20,
  active_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index on public.quizzes(active_date desc);
grant select on public.quizzes to authenticated;
grant all on public.quizzes to service_role;
alter table public.quizzes enable row level security;
create policy "quizzes_read_all" on public.quizzes for select to authenticated using (true);

-- QUIZ ATTEMPTS
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  chosen_index int not null,
  correct boolean not null,
  created_at timestamptz not null default now(),
  unique(user_id, quiz_id)
);
grant select, insert on public.quiz_attempts to authenticated;
grant all on public.quiz_attempts to service_role;
alter table public.quiz_attempts enable row level security;
create policy "qa_read_own" on public.quiz_attempts for select to authenticated using (auth.uid() = user_id);
create policy "qa_insert_own" on public.quiz_attempts for insert to authenticated with check (auth.uid() = user_id);

-- Auto-create profile + wallet on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
  uname text;
  suffix int := 0;
begin
  base_name := coalesce(new.raw_user_meta_data->>'username',
                        split_part(new.email,'@',1),
                        'user');
  base_name := regexp_replace(lower(base_name), '[^a-z0-9_]', '', 'g');
  if length(base_name) < 3 then base_name := 'user' || substr(new.id::text,1,6); end if;
  uname := base_name;
  while exists(select 1 from public.profiles where username = uname) loop
    suffix := suffix + 1;
    uname := base_name || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, uname, coalesce(new.raw_user_meta_data->>'display_name', uname));

  insert into public.wallets (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seed today's quiz
insert into public.quizzes (question, options, correct_index, reward, active_date) values
('Что означает правило 72 в личных финансах?',
 '["Срок удвоения капитала при заданной ставке","Максимальная ставка по кредиту","Минимальный возраст инвестора","Лимит трат в месяц"]'::jsonb,
 0, 20, current_date),
('Что такое диверсификация портфеля?',
 '["Концентрация в одном активе","Распределение риска между разными активами","Покупка только акций","Хранение всего в наличных"]'::jsonb,
 1, 20, current_date + 1),
('Какая комиссия типична для эквайринга карт?',
 '["0.01%","0.1%","2-3%","15%"]'::jsonb,
 2, 20, current_date + 2);
