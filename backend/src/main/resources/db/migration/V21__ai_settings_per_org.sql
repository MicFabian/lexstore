-- AI settings were a single row for the whole instance. With organisations
-- that means one of them can change the provider, model and cache policy for
-- every other. Each organisation gets its own.
alter table ai_settings add column org_id uuid references organisation (id) on delete cascade;

update ai_settings
set org_id = (select id from organisation order by created_at limit 1)
where org_id is null;

-- Organisations without settings get a row of defaults. The id column is a
-- plain integer, so the next value is taken from what is already there.
insert into ai_settings (id, org_id, provider, model, temperature, formality, tone, auto_flag_fuzzy, cache_ttl_hours)
select (select coalesce(max(id), 0) from ai_settings) + row_number() over (order by o.created_at),
       o.id, 'mock', 'claude-haiku-4-5', 0.2, 'neutral', null, true, 720
from organisation o
where not exists (select 1 from ai_settings s where s.org_id = o.id);

create unique index if not exists idx_ai_settings_org on ai_settings (org_id);
