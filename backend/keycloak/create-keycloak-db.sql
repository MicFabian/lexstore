-- Runs once on first Postgres boot: Keycloak gets its own database, so its
-- tables never share a schema with the application's Flyway-managed one.
CREATE DATABASE keycloak OWNER lexstore;
