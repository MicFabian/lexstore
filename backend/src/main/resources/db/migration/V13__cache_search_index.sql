do $$
begin
    create extension if not exists pg_trgm;
exception when insufficient_privilege then
    raise notice 'pg_trgm not installed: cache search falls back to a sequential scan';
end $$;

do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_trgm') then
        create index if not exists idx_cache_source_trgm
            on translation_cache using gin (lower(source_text) gin_trgm_ops);
        create index if not exists idx_cache_target_trgm
            on translation_cache using gin (lower(target_text) gin_trgm_ops);
    end if;
end $$;
