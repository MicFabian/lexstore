-- AI translation service: cache, request log, settings.

create table translation_cache (
    id           uuid primary key,
    cache_key    varchar(80) not null unique,
    source_text  varchar(4000) not null,
    source_lang  varchar(16) not null,
    target_lang  varchar(16) not null,
    provider     varchar(32) not null,
    model        varchar(64) not null,
    target_text  varchar(4000) not null,
    hits         bigint not null default 0,
    created_at   timestamptz not null default now(),
    last_used_at timestamptz not null default now()
);
create index idx_cache_source on translation_cache (source_text);
create index idx_cache_last_used on translation_cache (last_used_at desc);

create table translation_request (
    id            uuid primary key,
    source_text   varchar(4000) not null,
    source_lang   varchar(16) not null,
    target_lang   varchar(16) not null,
    provider      varchar(32) not null,
    model         varchar(64) not null,
    result_text   varchar(4000),
    cache_hit     boolean not null,
    latency_ms    bigint not null,
    input_tokens  int not null default 0,
    output_tokens int not null default 0,
    status        varchar(16) not null default 'ok',
    error_message varchar(512),
    created_at    timestamptz not null default now()
);
create index idx_request_created on translation_request (created_at desc);

create table ai_settings (
    id              int primary key,
    provider        varchar(32) not null default 'mock',
    model           varchar(64) not null default 'claude-haiku-4-5',
    temperature     double precision not null default 0.2,
    formality       varchar(16) not null default 'neutral',
    tone            varchar(1000),
    auto_flag_fuzzy boolean not null default true,
    cache_ttl_hours int not null default 720
);

insert into ai_settings (id) values (1);
