-- Per-translation audit: who last changed each translation, and a full event log.

alter table translation add column modified_by_name   varchar(128);
alter table translation add column modified_by_avatar  int;

create table translation_event (
    id            uuid primary key,
    project_id    uuid not null references project (id) on delete cascade,
    term_id       uuid not null references term (id) on delete cascade,
    language_code varchar(16) not null,
    action        varchar(32) not null,
    old_value     varchar(2000),
    new_value     varchar(2000),
    old_status    varchar(32),
    new_status    varchar(32) not null,
    author_name   varchar(128) not null,
    author_avatar int not null default 0,
    created_at    timestamptz not null default now()
);

create index idx_tevent_term on translation_event (term_id);
create index idx_tevent_term_lang on translation_event (term_id, language_code);

-- Backfill modified_by + a seed audit trail for existing translations so the
-- history view isn't empty on a fresh install. Attribute edits to seeded authors.
update translation t set modified_by_name = 'Amélie Rousseau', modified_by_avatar = 0
  where t.language_code = 'fr' and t.value is not null;
update translation t set modified_by_name = 'Lukas Brandt', modified_by_avatar = 3
  where t.language_code = 'de' and t.value is not null;
update translation t set modified_by_name = 'Sofía Ramírez', modified_by_avatar = 1
  where t.language_code = 'es-ES' and t.value is not null;
update translation t set modified_by_name = 'Kenji Watanabe', modified_by_avatar = 4
  where t.language_code = 'ja' and t.value is not null;

-- One "translated" event per existing non-empty translation, authored by the
-- per-language contributor, timestamped slightly in the past.
insert into translation_event (id, project_id, term_id, language_code, action, old_value, new_value, old_status, new_status, author_name, author_avatar, created_at)
select
  gen_random_uuid(),
  tm.project_id,
  t.term_id,
  t.language_code,
  case when t.status = 'PROOFREAD' then 'proofread'
       when t.status = 'FUZZY' then 'flagged'
       else 'translated' end,
  null,
  t.value,
  null,
  t.status,
  coalesce(t.modified_by_name, 'You There'),
  coalesce(t.modified_by_avatar, 0),
  now() - (interval '1 hour' * (row_number() over (order by t.term_id)))
from translation t
join term tm on tm.id = t.term_id
where t.value is not null;
