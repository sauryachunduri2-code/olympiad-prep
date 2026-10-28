-- Olympiad prep platform: Postgres schema (Supabase flavored: pgvector, auth.uid()).
-- Mirrors "Data model" and "Access paths & indexes" in docs/spec.md.
-- NOT YET RUN against a database; validate on a Supabase dev project before use.

create extension if not exists vector;

-- Reference data -------------------------------------------------------------

create table competitions (
  id           text primary key,                 -- 'usabo' | 'usnco' | 'fma'
  name         text not null,
  discipline   text not null check (discipline in ('biology', 'chemistry', 'physics')),
  choice_count int,
  time_limit_s int,
  scoring_rule jsonb not null default '{}',
  style_card   jsonb not null default '{}'       -- notation, units, figure conventions, stem length
);

create table topics (
  id         serial primary key,
  discipline text not null check (discipline in ('biology', 'chemistry', 'physics')),
  parent_id  int references topics (id),
  name       text not null,
  unique (discipline, parent_id, name)
);

create table exam_papers (
  id             serial primary key,
  competition_id text not null references competitions (id),
  year           int not null,
  round          text not null check (round in ('local', 'national', 'open', 'semi', 'fma')),
  form           text check (form in ('A', 'B')),
  source_url     text,
  storage_policy text not null check (storage_policy in ('full', 'tags_only')),
  unique nulls not distinct (competition_id, year, round, form)
);

create table cutoffs (
  competition_id text not null references competitions (id),
  year           int not null,
  round          text not null,
  cutoff_score   numeric not null,
  max_score      numeric,
  scoring_note   text,
  primary key (competition_id, year, round)
);

-- Questions ------------------------------------------------------------------

create table questions (
  id                  uuid primary key default gen_random_uuid(),
  paper_id            int references exam_papers (id),
  number              int,
  stem                text,                      -- null for USABO (tags only, CEE terms)
  choices             jsonb,
  answer_index        int,
  also_accepted       int[] not null default '{}',   -- extra indexes the exam board accepted later
  solution            text,
  figure_ref          text,
  format              text not null,             -- calc | concept | data | pedigree | experiment ...
  difficulty_band     int not null check (difficulty_band between 1 and 5),
  origin              text not null check (origin in ('official', 'variant', 'ai_bio')),
  parent_question_id  uuid references questions (id),
  status              text not null default 'pending' check (status in ('active', 'pending', 'quarantined')),
  verification_level  text not null check (verification_level in ('official', 'code_verified', 'unverified')),
  content_hash        text,
  created_by          uuid references auth.users (id),
  created_at          timestamptz not null default now(),
  -- official rows come from a paper; generated rows must name their parent or source
  check (origin <> 'official' or paper_id is not null),
  check (origin <> 'variant' or parent_question_id is not null)
);

create unique index questions_paper_number_uq on questions (paper_id, number) where paper_id is not null;
create unique index questions_content_hash_uq  on questions (content_hash) where content_hash is not null;
create index questions_status_band_idx         on questions (status, difficulty_band);

create table question_topics (
  question_id uuid not null references questions (id) on delete cascade,
  topic_id    int  not null references topics (id),
  weight      real not null default 1,
  primary key (question_id, topic_id)
);
create index question_topics_topic_idx on question_topics (topic_id);

create table competition_blueprints (
  competition_id  text not null references competitions (id),
  topic_id        int  not null references topics (id),
  weight          real not null,
  difficulty_dist jsonb not null default '{}',
  primary key (competition_id, topic_id)
);

create table verification_runs (
  id          bigserial primary key,
  question_id uuid not null references questions (id) on delete cascade,
  gate        text not null,
  passed      boolean not null,
  details     jsonb,
  run_by      uuid references auth.users (id),
  created_at  timestamptz not null default now()
);

-- Sources / retrieval --------------------------------------------------------

create table source_documents (
  id              serial primary key,
  title           text not null,
  license         text not null,                 -- 'CC BY 4.0', 'official-public', 'map-only'
  url             text,
  embedding_model text                           -- so the corpus can be re-embedded on model change
);

create table source_chunks (
  id           bigserial primary key,
  document_id  int not null references source_documents (id) on delete cascade,
  heading_path text not null,
  text         text not null,
  embedding    vector(384),
  tsv          tsvector generated always as (to_tsvector('english', text)) stored
);
create index source_chunks_embedding_idx on source_chunks using hnsw (embedding vector_cosine_ops);
create index source_chunks_tsv_idx       on source_chunks using gin (tsv);

create table reading_map (
  topic_id    int not null references topics (id),
  document_id int not null references source_documents (id),
  locator     text not null,                     -- OpenStax section id, or Campbell "ch. 14, pp. 270-285"
  primary key (topic_id, document_id, locator)
);

-- Users and practice ---------------------------------------------------------

create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         text not null default 'student' check (role in ('student', 'owner')),
  competitions text[] not null default '{}'
);

create table quiz_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  mode           text not null check (mode in ('drill', 'replay', 'blueprint')),
  competition_id text not null references competitions (id),
  paper_id       int references exam_papers (id),
  started_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  score          numeric
);
create index quiz_sessions_user_idx on quiz_sessions (user_id, started_at desc);

create table responses (
  session_id   uuid not null references quiz_sessions (id) on delete cascade,
  question_id  uuid not null references questions (id),
  chosen_index int,
  correct      boolean,
  time_ms      int,
  primary key (session_id, question_id)          -- autosave = idempotent upsert
);

create table flags (
  id          bigserial primary key,
  question_id uuid not null references questions (id) on delete cascade,
  user_id     uuid not null references auth.users (id),
  reason      text not null check (reason in ('wrong_key', 'ambiguous', 'off_syllabus', 'too_easy')),
  note        text,
  created_at  timestamptz not null default now(),
  unique (question_id, user_id, reason)
);
create index flags_question_idx on flags (question_id);

create view topic_mastery as
select s.user_id,
       qt.topic_id,
       count(*)                                      as attempts,
       avg(r.correct::int)                           as accuracy,
       sum(r.correct::int * exp(-extract(epoch from now() - s.started_at) / 2592000.0))
         / nullif(sum(exp(-extract(epoch from now() - s.started_at) / 2592000.0)), 0) as recent_accuracy
from responses r
join quiz_sessions s  on s.id = r.session_id
join question_topics qt on qt.question_id = r.question_id
group by s.user_id, qt.topic_id;

-- Row-level security ---------------------------------------------------------
-- Reference data and active questions are readable by any signed-in user.
-- Students only write their own practice rows and may only insert 'pending' questions as themselves.
-- Promotion to 'active' happens in a security-definer function (to be written with the verification flow).

alter table questions      enable row level security;
alter table quiz_sessions  enable row level security;
alter table responses      enable row level security;
alter table flags          enable row level security;
alter table profiles       enable row level security;

create policy questions_read   on questions for select to authenticated using (status = 'active');
create policy questions_insert on questions for insert to authenticated
  with check (status = 'pending' and origin in ('variant', 'ai_bio') and created_by = auth.uid());

create policy sessions_own on quiz_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy responses_own on responses for all to authenticated
  using (exists (select 1 from quiz_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from quiz_sessions s where s.id = session_id and s.user_id = auth.uid()));

create policy flags_own_insert on flags for insert to authenticated with check (user_id = auth.uid());
create policy flags_own_read   on flags for select to authenticated using (user_id = auth.uid());

create policy profiles_own on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = 'student');
