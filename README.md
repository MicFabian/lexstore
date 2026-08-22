# TransLad

Translation & localization management platform for software teams. Upload source strings (terms), invite translators per language, track untranslated/translated/fuzzy/proofread status, pull finished translations via API/CLI.

Built to the **TransLad design system** (dark-first, electric-cobalt accent, editorial-meets-developer). State-of-the-art stack.

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
docker compose up -d        # Postgres :5432, Keycloak :8089 (realm "translad")
```
Keycloak imports the `translad` realm with three test users (password = username):
`owner` (all roles), `translator`, `proofreader`.

**2. Backend** (Java 25, runs on `:8088`)
```bash
cd backend
JAVA_HOME=/path/to/jdk25 ./gradlew bootRun
```
Flyway creates the schema and seeds the demo *Mosaic Web App* project (6 languages,
14 terms, translations, contributors, API keys) on first boot. The API validates
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
- **Translation editor** — per-language term table, status filters, inspector panel
  (source, translation, machine suggestion, save/proofread/flag, comments).
- **Terms** — source-string manager with expandable rows: per-language translations
  + audit history.
- **Languages** — per-language progress cards.
- **Contributors** — team table, roles, language scoping.
- **Settings** — API keys (reveal/copy/revoke), integrations, import/export, general.

Theme (dark/light), accent, and density are switchable via the appearance panel
(bottom-right) and persist to `localStorage`.

## Testing

| Layer | What | Run |
|---|---|---|
| Backend | Testcontainers integration tests — happy paths + validation, 404s, full CRUD lifecycles, status transitions, plurals, pagination edges, project isolation. Spins a real Postgres, resets the schema per test. | `cd backend && ./gradlew test` |
| CLI | 14 smoke + edge-case checks — every command, error paths, JSON validity, unknown-key skip. | `cd cli && bash test.sh` (backend must be running) |
| Frontend | 50 Playwright E2E specs across every feature — navigation, multi-language editor with keyboard flow and save-and-next, inspector history and AI helper, terms filters and per-translation authors, features coverage and open work, dialogs (focus, Escape), undo, content states, the work queue, POEditor import, Translation AI, search, theming. | `cd frontend && npm run e2e` (backend running; the dev server starts itself) |

The E2E suite resets the backend to its seeded state before every test (a
global fixture calls `POST /api/dev/reset`), so it is fully order-independent
and repeatable. Run the backend with `TRANSLAD_DEV_RESET=true` to enable that
endpoint (it is disabled by default and refused in any other configuration).

## API

Base: `http://localhost:8088/api`

- `GET  /projects` · `GET /projects/{id}`
- `GET  /projects/{id}/languages` · `POST …/languages`
- `GET  /projects/{id}/editor?lang=fr` · `PUT …/editor/{termId}?lang=fr`
- `GET  /projects/{id}/terms` · `POST …/terms` · `POST …/terms/{id}/comments`
- `GET  /projects/{id}/contributors` · `POST …/contributors`
- `GET  /projects/{id}/api-keys` · `POST …/api-keys`

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
| `POST /api/dev/reset` | opt-in via `TRANSLAD_DEV_RESET` | refused |
| Flyway `clean` | allowed, so the reset endpoint can wipe and reseed | disabled |
| CORS origins | localhost and 127.0.0.1 | exactly what `ALLOWED_ORIGINS` names |
| SQL logging | formatted statements | warnings only |

### Required environment

| Variable | Why |
|---|---|
| `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD` | Postgres connection |
| `KEYCLOAK_ISSUER` | Realm the API validates tokens against |
| `ALLOWED_ORIGINS` | Browser origins allowed to call the API |
| `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | Optional; the mock translator is used when unset |

Two realm files exist on purpose: `realm-translad.json` seeds owner,
translator, and proofreader accounts with matching passwords for local work,
and is never mounted by the compose file. `realm-translad.prod.json` has no
users and sets `sslRequired: external` — create the first account through the
Keycloak admin console after the stack is up.

`frontend/public/config.json` carries the browser's half — the Keycloak
authority and client id. Replace it at deploy time; it is served with
`Cache-Control: no-store` so a redeploy takes effect immediately.
