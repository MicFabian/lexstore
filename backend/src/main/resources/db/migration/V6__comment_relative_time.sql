-- Comment timestamps become computed from created_at instead of a stored label
-- (a stored "just now" never ages). Backdate the seeded comments so the demo
-- keeps its relative feel, then drop the redundant column.

update term_comment set created_at = now() - interval '2 hours' where time_label = '2h ago';
update term_comment set created_at = now() - interval '1 day'   where time_label = '1d ago';

alter table term_comment drop column time_label;
