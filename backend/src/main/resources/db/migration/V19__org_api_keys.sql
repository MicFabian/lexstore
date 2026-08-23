-- An API key belongs to a project or to an organisation. An organisation key
-- reaches every project the organisation owns, which is what a CI job spanning
-- several projects needs.
alter table api_key add column org_id uuid references organisation (id) on delete cascade;
alter table api_key alter column project_id drop not null;

alter table api_key add constraint api_key_scope_target check (
    (project_id is not null and org_id is null)
    or (project_id is null and org_id is not null)
);

create index idx_apikey_org on api_key (org_id);

-- Now that keys authenticate requests, when one was last used is a fact rather
-- than a guess, so it gets a real timestamp.
alter table api_key add column last_used_at timestamptz;
