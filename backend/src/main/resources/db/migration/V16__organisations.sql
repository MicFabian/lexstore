create table organisation (
    id          uuid primary key,
    name        varchar(200) not null,
    slug        varchar(120) not null unique,
    created_at  timestamptz not null default now(),
    -- Platform agent allowance. Null means the organisation brings its own key.
    agent_plan          varchar(32),
    agent_monthly_quota bigint not null default 0,
    agent_used_this_period bigint not null default 0,
    agent_period_start  timestamptz not null default now()
);

create table org_member (
    id       uuid primary key,
    org_id   uuid not null references organisation (id) on delete cascade,
    email    varchar(255) not null,
    name     varchar(200) not null,
    role     varchar(32) not null default 'MEMBER',
    unique (org_id, email)
);

create index idx_org_member_email on org_member (lower(email));

-- Provider credentials, encrypted at rest. Scope is either an organisation or a
-- single project; a project row overrides its organisation's for that project.
create table ai_credential (
    id           uuid primary key,
    org_id       uuid references organisation (id) on delete cascade,
    project_id   uuid references project (id) on delete cascade,
    provider     varchar(32) not null,
    label        varchar(120) not null default '',
    secret_cipher text not null,
    tail         varchar(8) not null default '',
    created_at   timestamptz not null default now(),
    created_by   varchar(200),
    constraint ai_credential_scope check (
        (org_id is not null and project_id is null)
        or (org_id is null and project_id is not null)
    )
);

create unique index idx_ai_cred_org_provider on ai_credential (org_id, provider)
    where org_id is not null;
create unique index idx_ai_cred_project_provider on ai_credential (project_id, provider)
    where project_id is not null;

alter table project add column org_id uuid references organisation (id) on delete cascade;

-- Everything that exists today belongs to one organisation.
insert into organisation (id, name, slug, agent_plan, agent_monthly_quota)
values ('00000000-0000-0000-0000-000000000001', 'Lexstore', 'lexstore', null, 0);

update project set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;

alter table project alter column org_id set not null;

-- Existing contributors become members of that organisation.
insert into org_member (id, org_id, email, name, role)
select gen_random_uuid(),
       '00000000-0000-0000-0000-000000000001',
       lower(c.email),
       min(c.name),
       case when bool_or(c.role in ('OWNER', 'ADMIN')) then 'ADMIN' else 'MEMBER' end
from contributor c
group by lower(c.email)
on conflict do nothing;
