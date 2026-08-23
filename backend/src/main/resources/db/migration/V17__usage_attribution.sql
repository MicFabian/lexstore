-- Who a translation request was for, so spend can be attributed rather than
-- only counted. Null means it predates this column or came from the playground.
alter table translation_request add column project_id uuid references project (id) on delete set null;
alter table translation_request add column org_id uuid references organisation (id) on delete set null;
alter table translation_request add column credential_source varchar(24);

create index idx_treq_org_created on translation_request (org_id, created_at desc);
create index idx_treq_project_created on translation_request (project_id, created_at desc);
