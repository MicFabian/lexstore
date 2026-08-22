alter table project add column updated_at timestamptz;

-- Existing rows carry a frozen label such as "12 min ago". Translate the ones
-- the demo data uses into real offsets so the dashboard keeps its spread and
-- starts ageing properly; anything else falls back to the project's newest
-- translation, or to now.
update project p
set updated_at = case updated_label
    when '12 min ago' then now() - interval '12 minutes'
    when '2h ago'     then now() - interval '2 hours'
    when 'Yesterday'  then now() - interval '1 day'
    when '3d ago'     then now() - interval '3 days'
    when '1 week ago' then now() - interval '7 days'
    else coalesce(
        (
            select max(tr.updated_at)
            from translation tr
            join term t on t.id = tr.term_id
            where t.project_id = p.id
        ),
        now()
    )
end;

alter table project alter column updated_at set not null;

-- Terms carry the same kind of frozen label. Relative ones become offsets;
-- the absolute ones ("Feb 14") are already dates, so parse them into this year
-- and fall back to the row's existing created_at when they cannot be read.
update term
set created_at = case
    when added_label = 'Today'      then now()
    when added_label = 'Yesterday'  then now() - interval '1 day'
    when added_label = '3d ago'     then now() - interval '3 days'
    when added_label = '1 week ago' then now() - interval '7 days'
    when added_label ~ '^[A-Z][a-z]{2} [0-9]{1,2}$'
        -- Midday, so rendering the date back in any nearby timezone keeps the
        -- day the label named.
        then coalesce(
            to_timestamp(added_label || ' ' || extract(year from now())::text || ' 12', 'Mon DD YYYY HH24'),
            created_at
        )
    else created_at
end;
