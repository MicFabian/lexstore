create table glossary_entry (
    id           uuid primary key,
    project_id   uuid not null references project (id) on delete cascade,
    term         varchar(200) not null,
    language_code varchar(16),
    translation  varchar(200),
    -- A term that must never be translated at all (brand names, product names).
    do_not_translate boolean not null default false,
    note         varchar(500),
    created_at   timestamptz not null default now(),
    unique (project_id, term, language_code)
);

create index idx_glossary_project on glossary_entry (project_id, language_code);
