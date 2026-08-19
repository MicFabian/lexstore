-- Every project already groups its keys by prefix (checkout.*, auth.*), so the
-- first features are seeded from those prefixes and their terms assigned.
insert into feature (id, project_id, name, feature_key, description, created_at)
select
    gen_random_uuid(),
    t.project_id,
    initcap(replace(split_part(t.term_key, '.', 1), '-', ' ')),
    split_part(t.term_key, '.', 1),
    null,
    now()
from term t
where position('.' in t.term_key) > 0
group by t.project_id, split_part(t.term_key, '.', 1);

update term t
set feature_id = f.id
from feature f
where f.project_id = t.project_id
  and f.feature_key = split_part(t.term_key, '.', 1);
