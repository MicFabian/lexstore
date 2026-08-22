create index if not exists idx_term_comment_term on term_comment (term_id, created_at);

create index if not exists idx_term_project_created on term (project_id, created_at desc);

create index if not exists idx_tevent_term_created on translation_event (term_id, created_at desc);

create index if not exists idx_contributor_email on contributor (lower(email));
