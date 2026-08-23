-- The remaining frozen labels. Each one is a string fixed when the row was
-- written, so it never ages; the timestamps beside them do.
alter table api_key add column created_at timestamptz not null default now();

-- Existing keys keep the day they claimed, where that can be read back.
update api_key
set created_at = case
    when created_label = 'Just now' then now()
    when created_label ~ '^[A-Z][a-z]{2} [0-9]{1,2}, [0-9]{4}$'
        then coalesce(to_timestamp(created_label || ' 12', 'Mon DD, YYYY HH24'), now())
    else now()
end;
