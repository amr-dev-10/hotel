-- Arcadia PostgreSQL database bootstrap
--
-- Purpose:
--   Create and harden a PostgreSQL database for Arcadia in development or
--   production. This script prepares the database, login role, public schema,
--   required extensions, grants, and post-migration hardening checks.
--
-- Important:
--   This file does not create application tables. Application tables are owned
--   by the SQLAlchemy models and Alembic migrations. After this script, run:
--
--     alembic -c backend/alembic.ini upgrade head
--
--   For a brand-new local database that is initialized from SQLAlchemy models,
--   follow docs/development-setup-testing-and-seeding.md.
--
-- Development example:
--   psql -U postgres -h localhost -f scripts/postgres_setup.sql \
--     -v app_db=arcadia \
--     -v app_user=arcadia \
--     -v app_password='StrongPassword123'
--
-- Production example:
--   psql -U postgres -h <db-host> -f scripts/postgres_setup.sql \
--     -v app_db=arcadia_prod \
--     -v app_user=arcadia_app \
--     -v app_password='<replace-with-strong-secret>'
--
-- Matching SQLAlchemy URL:
--   postgresql+psycopg://<app_user>:<app_password>@<db-host>:5432/<app_db>

\set ON_ERROR_STOP on

\if :{?app_db}
\else
  \set app_db arcadia
\endif

\if :{?app_user}
\else
  \set app_user arcadia
\endif

\if :{?app_password}
\else
  \set app_password 'change-this-password-before-use'
\endif

SELECT 'Bootstrapping database "' || :'app_db' || '" for role "' || :'app_user' || '"' AS arcadia_postgres_setup;

-- 1. Create or update the application login role.
SELECT format(
    'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT',
    :'app_user',
    :'app_password'
)
WHERE NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = :'app_user'
);
\gexec

ALTER ROLE :"app_user"
  WITH LOGIN
  PASSWORD :'app_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  INHERIT;

-- 2. Create the application database if it does not already exist.
SELECT format(
    'CREATE DATABASE %I OWNER %I ENCODING %L TEMPLATE template0',
    :'app_db',
    :'app_user',
    'UTF8'
)
WHERE NOT EXISTS (
    SELECT 1
    FROM pg_database
    WHERE datname = :'app_db'
);
\gexec

ALTER DATABASE :"app_db" OWNER TO :"app_user";
GRANT CONNECT, TEMPORARY ON DATABASE :"app_db" TO :"app_user";

-- 3. Connect to the target database before schema, extension, and grant setup.
\connect :app_db

-- 4. Required or recommended extensions.
-- pgcrypto: useful for UUIDs and cryptographic helpers.
-- btree_gist: required by the production room_blocks overlap exclusion constraint.
-- pg_trgm: useful for search indexes when text search grows.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Optional future extension. Enable only if the server has pgvector installed.
-- CREATE EXTENSION IF NOT EXISTS vector;

-- 5. Own and harden the public schema.
CREATE SCHEMA IF NOT EXISTS public AUTHORIZATION :"app_user";
ALTER SCHEMA public OWNER TO :"app_user";

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO :"app_user";

-- 6. Existing object privileges.
-- These are safe before migrations and useful after migrations.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO :"app_user";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO :"app_user";

-- 7. Default privileges for future objects.
-- Covers objects created by this admin connection and by the app role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO :"app_user";

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO :"app_user";

ALTER DEFAULT PRIVILEGES FOR ROLE :"app_user" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";

ALTER DEFAULT PRIVILEGES FOR ROLE :"app_user" IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO :"app_user";

ALTER DEFAULT PRIVILEGES FOR ROLE :"app_user" IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO :"app_user";

-- 8. App-specific session setting placeholder.
-- Arcadia sets app.current_hotel_id per request with set_config(...).
-- Keeping a database default avoids "unrecognized parameter" surprises in tools.
ALTER DATABASE :"app_db" SET app.current_hotel_id TO '';

-- 9. Post-migration production hardening.
-- This block is intentionally guarded so the same script can be run before
-- migrations and again after migrations. It adds the database-level room block
-- overlap protection described in docs/v5/architecture_v5_final.md.
DO $$
BEGIN
    IF to_regclass('public.room_blocks') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'room_blocks_no_room_overlap'
              AND conrelid = 'public.room_blocks'::regclass
        ) THEN
            ALTER TABLE public.room_blocks
              ADD CONSTRAINT room_blocks_no_room_overlap
              EXCLUDE USING gist (
                  hotel_id WITH =,
                  room_id WITH =,
                  daterange(start_date, end_date, '[)') WITH &&
              )
              WHERE (room_id IS NOT NULL);
        END IF;
    END IF;
END
$$;

-- 10. Final visibility check.
SELECT
    current_database() AS database_name,
    current_user AS executed_by,
    :'app_user' AS application_user,
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') AS app_role_exists,
    EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS pgcrypto_enabled,
    EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') AS btree_gist_enabled,
    EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS pg_trgm_enabled,
    to_regclass('public.room_blocks') IS NOT NULL AS room_blocks_table_exists;

