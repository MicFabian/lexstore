create table feature (
    id uuid primary key,
    project_id uuid not null references project(id) on delete cascade,
    name varchar(255) not null,
    feature_key varchar(255) not null,
    description varchar(1000),
    created_at timestamptz not null default now(),
    unique (project_id, feature_key)
);

alter table term add column feature_id uuid references feature(id) on delete set null;
create index idx_term_feature on term(feature_id);
