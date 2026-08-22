alter table term add column created_by_name varchar(200);
alter table term add column created_by_avatar int;

-- Seeded terms predate this column. Attribute them to the most senior
-- contributor the project actually has, so the demo shows a real member
-- instead of an empty creator.
update term t
set created_by_name = c.name,
    created_by_avatar = c.avatar_index
from (
    select distinct on (project_id) project_id, name, avatar_index
    from contributor
    order by project_id,
             case role
                 when 'OWNER' then 1
                 when 'ADMIN' then 2
                 when 'PROOFREADER' then 3
                 else 4
             end,
             name
) c
where c.project_id = t.project_id
  and t.created_by_name is null;
