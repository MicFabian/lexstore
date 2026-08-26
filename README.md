# Lexstore

Translation & localization management platform for software teams. Upload source strings (terms), invite translators per language, track untranslated/translated/fuzzy/proofread status, pull finished translations via API/CLI.

Built to the **Lexstore design system** (light-first editorial, one type family, colour reserved for meaning). Dark mode is a switch, not the default.

## Stack

| Layer | Tech |
|---|---|
| Backend | Spring Boot 4 · Kotlin · Java 25 · Spring Data JPA · Flyway · PostgreSQL 17 · OAuth2 resource server |
| Frontend | Angular 22 · TypeScript 6 · standalone components · signals · angular-auth-oidc-client |
| Auth | Keycloak 26 (OIDC, PKCE) with role-based access control |
| Infra | Docker Compose (Postgres + Keycloak) |

## Layout

```
backend/    Spring Boot Kotlin API (package-by-module: project, language, term,
            translation, contributor, apikey). Flyway schema + seed in
            src/main/resources/db/migration.
frontend/   Angular app. Design tokens in src/styles/, feature screens in
            src/app/screens/, app shell in src/app/shell/, shared UI in
            src/app/shared/, API + state in src/app/core/.
```

## Run

**1. Postgres + Keycloak**
```bash
cd backend
docker compose up -d        # Postgres :5442, Keycloak :8089 (realm "lexstore")
```
Keycloak imports the `lexstore` realm with three test users (password = username):
`owner` (all roles), `translator`, `proofreader`.

**2. Backend** (Java 25, runs on `:8088`)
```bash
cd backend
# LEXSTORE_SECRET_KEY encrypts provider keys stored through the UI. Without it
# the API refuses to store them and falls back to keys from the environment.
LEXSTORE_SECRET_KEY=$(openssl rand -base64 32) ./gradlew bootRun
```
Flyway creates the schema and seeds five demo projects (Mosaic Web App and four
others) with languages, terms, translations, contributors and API keys on first
boot, all belonging to one organisation. The API validates
Keycloak JWTs and enforces roles (`@PreAuthorize`).

**3. Frontend** (Node ≥22.22.3, runs on `:4300`, proxies `/api` → `:8088`)
```bash
cd frontend
npm install
npm start
```
Open the dev server URL; you're redirected to Keycloak to sign in (try `owner` /
`owner`), then land in the translation editor. The signed-in user's name stamps
audit history and comments; their roles gate the write actions.

> If tokens stop validating or the API returns 500/401 after a break, the
> Keycloak or Postgres container has likely stopped — `docker compose up -d`
> brings them back and the backend re-fetches the signing keys.

## Screens

- **Projects dashboard** — all projects, progress, untranslated/new counts.
- **Translation editor** — per-language term table paged and filtered on the server,
  several languages side by side, inspector panel (source, translation, machine
  suggestion, AI proofreader, save/proofread/flag, comments).
- **Terms** — source-string manager with expandable rows: per-language translations
  + audit history.
- **Languages** — per-language progress cards.
- **Contributors** — team table, roles, language scoping.
- **Settings** — project API keys, glossary, integrations, import/export, general.
- **Organisation** — AI spend and activity, provider keys (Claude, ChatGPT, Gemini),
  organisation-wide API keys, members, agent plan and quota.

Theme (dark/light), accent, and density are switchable via the appearance panel
(bottom-right) and persist to `localStorage`.

## Testing

| Layer | What | Run |
|---|---|---|
| Backend | Testcontainers integration tests — happy paths + validation, 404s, full CRUD lifecycles, status transitions, plurals, pagination edges, project isolation, API-key scope and reach, optimistic locking, credential resolution. Spins a real Postgres, resets the schema per test. | `cd backend && ./gradlew test` |
| CLI | 16 smoke + edge-case checks — every command, error paths, JSON validity, unknown-key skip, and API-key auth including a read-only refusal. | `cd cli && bash test.sh` (backend must be running) |
| Frontend | 66 Playwright E2E specs across every feature — navigation, multi-language editor with keyboard flow and save-and-next, inspector history and AI helper, terms filters and per-translation authors, features coverage and open work, dialogs (focus, Escape), undo, content states, the work queue, POEditor import, Translation AI, search, theming. | `cd frontend && npm run e2e` (backend running; the dev server starts itself) |

The E2E suite resets the backend to its seeded state before every test (a
global fixture calls `POST /api/dev/reset`), so it is fully order-independent
and repeatable. Run the backend with `LEXSTORE_DEV_RESET=true` to enable that
endpoint (it is disabled by default and refused in any other configuration).

## API

Base: `http://localhost:8088/api`

Authenticate with a Keycloak bearer token, or with an API key in `X-API-Key`.
A project key reaches its own project; an organisation key reaches every project
that organisation owns. A read-only key is refused every unsafe method.

- `GET  /projects` · `GET /projects/{id}`
- `GET  /projects/{id}/languages` · `POST …/languages`
- `GET  /projects/{id}/languages/{code}/translations?page=&size=&status=&q=&featureId=`
- `PUT  …/languages/{code}/translations/{termId}` — send `version` to detect a
  concurrent edit; a stale one is refused with 409
- `GET  …/languages/{code}/translations/{termId}/suggestion` · `…/proofread`
- `GET  /projects/{id}/terms` · `POST …/terms` · `POST …/terms/{id}/comments`
- `GET  /projects/{id}/glossary` · `POST …/glossary` · `DELETE …/glossary/{id}`
- `GET  /projects/{id}/features` · `GET …/features/{id}/open`
- `GET  /projects/{id}/contributors` · `POST …/contributors`
- `GET  /projects/{id}/api-keys` · `POST …/api-keys`
- `GET  /org` · `/org/members` · `/org/usage` · `/org/activity`
- `GET  /org/credentials` · `POST …` — provider keys, stored encrypted
- `GET  /org/api-keys` · `POST …` — keys that span every project
- `PUT  /org/agent` — subscribe to the platform agent and set its quota

## Deploying

One build is promoted between environments: the frontend reads
`/config.json` at startup, so the same image runs against staging and
production without recompiling.

```bash
cp .env.example .env      # fill in secrets and hostnames
docker compose up -d --build
```

The compose file builds both images, runs Postgres and Keycloak, and serves
the app through nginx, which proxies `/api` to the backend from the same
origin — so the browser makes no cross-origin calls at all.

### What production turns off

The backend runs under `SPRING_PROFILES_ACTIVE=prod`, which pins shut the
things that only make sense on a laptop:

| Setting | Development | Production |
|---|---|---|
| `POST /api/dev/reset` | opt-in via `LEXSTORE_DEV_RESET` | refused |
| Flyway `clean` | allowed, so the reset endpoint can wipe and reseed | disabled |
| CORS origins | localhost and 127.0.0.1 | exactly what `ALLOWED_ORIGINS` names |
| SQL logging | formatted statements | warnings only |

### Required environment

| Variable | Why |
|---|---|
| `DATABASE_USER`, `DATABASE_PASSWORD` | Postgres connection |
| `KEYCLOAK_ISSUER` | Realm the API validates tokens against, and what the browser's `/config.json` points at |
| `ALLOWED_ORIGINS` | Browser origins allowed to call the API |
| `APP_ORIGIN` | The SPA's public origin; substituted into the Keycloak realm at import as the redirect and CORS origin |
| `LEXSTORE_SECRET_KEY` | Encrypts provider keys stored through the UI; without it they cannot be saved (the API logs a warning at startup) |
| `LEXSTORE_AGENT_KEY` | The platform's own provider key for organisations on an agent plan |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` | Optional fallback provider keys; the mock translator is used when none is reachable |

TLS terminates at a reverse proxy in front of the frontend and Keycloak
ports; Keycloak runs with `--proxy-headers xforwarded` and trusts the
`X-Forwarded-*` headers that proxy sets. Add HSTS at the proxy.

Two realm files exist on purpose: `realm-lexstore.json` seeds owner,
translator, and proofreader accounts with matching passwords for local work,
and is never mounted by the compose file. `realm-lexstore.prod.json` has no
users, disables the password grant, sets `sslRequired: external`, and takes
its redirect URIs from `APP_ORIGIN` — create the first account through the
Keycloak admin console after the stack is up. Both realms use the `lexstore`
login theme, mounted read-only from `backend/keycloak/themes`.

`frontend/public/config.json` carries the browser's half — the Keycloak
authority and client id. Replace it at deploy time; it is served with
`Cache-Control: no-store` so a redeploy takes effect immediately.
