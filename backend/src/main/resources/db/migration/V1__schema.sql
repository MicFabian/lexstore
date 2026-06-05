create table project (
    id            uuid primary key,
    name          varchar(255) not null,
    code          varchar(255) not null unique,
    source_lang   varchar(16)  not null default 'en',
    mark          varchar(16)  not null default '#3a5bff',
    updated_label varchar(64)
);

create table language (
    id         uuid primary key,
    project_id uuid not null references project (id) on delete cascade,
    code       varchar(16)  not null,
    name       varchar(128) not null,
    unique (project_id, code)
);

create table term (
    id           uuid primary key,
    project_id   uuid not null references project (id) on delete cascade,
    term_key     varchar(255) not null,
    ctx          varchar(255) not null default '',
    source_text  varchar(2000) not null,
    plural_one   varchar(255),
    plural_other varchar(255),
    tags         varchar(512) not null default '',
    is_new       boolean not null default false,
    added_label  varchar(64)  not null,
    created_at   timestamptz  not null default now(),
    unique (project_id, term_key)
);

create table translation (
    id            uuid primary key,
    term_id       uuid not null references term (id) on delete cascade,
    language_code varchar(16) not null,
    value         varchar(2000),
    plural_one    varchar(2000),
    status        varchar(32) not null default 'UNTRANSLATED',
    updated_at    timestamptz not null default now(),
    unique (term_id, language_code)
);

create table term_comment (
    id            uuid primary key,
    term_id       uuid not null references term (id) on delete cascade,
    author_name   varchar(128) not null,
    author_avatar int not null default 0,
    text          varchar(2000) not null,
    time_label    varchar(64) not null,
    created_at    timestamptz not null default now()
);

create table contributor (
    id           uuid primary key,
    project_id   uuid not null references project (id) on delete cascade,
    name         varchar(128) not null,
    email        varchar(255) not null,
    role         varchar(32) not null default 'TRANSLATOR',
    languages    varchar(512) not null default '',
    avatar_index int not null default 0,
    last_active  varchar(64) not null default ''
);

create table api_key (
    id               uuid primary key,
    project_id       uuid not null references project (id) on delete cascade,
    label            varchar(128) not null,
    prefix           varchar(32) not null,
    tail             varchar(16) not null,
    secret           varchar(128) not null,
    scope            varchar(32) not null default 'READ_WRITE',
    created_label    varchar(64) not null,
    last_used_label  varchar(64) not null default '—'
);

create index idx_term_project on term (project_id);
create index idx_translation_term on translation (term_id);
create index idx_language_project on language (project_id);
create index idx_contributor_project on contributor (project_id);
create index idx_apikey_project on api_key (project_id);
