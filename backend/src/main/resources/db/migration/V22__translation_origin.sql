-- Where a translation's text came from: a person, or a machine draft.
-- The origin survives status changes, so an accepted AI draft still reads
-- as machine output; it flips to 'human' only when a person rewrites the text.
alter table translation
    add column origin varchar(16) not null default 'human';

create index idx_translation_origin_status on translation (origin, status);
