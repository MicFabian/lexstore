# lexstore CLI

Pull and push translations from your terminal. Zero dependencies (Node ≥ 20, uses built-in `fetch`).

## Install

```bash
cd cli
npm link        # or: npm install -g .
```

Or run directly: `node cli/lexstore.mjs <command>`.

## Configure

```bash
export LEXSTORE_API=http://localhost:8088/api          # default
export LEXSTORE_KEYCLOAK=http://localhost:8089/realms/lexstore  # default

# Authenticate. An API key is the right choice for CI: create one in the
# project's settings, or an organisation-wide one under Organisation → API
# access, and revoke it on its own if it leaks.
export LEXSTORE_API_KEY=tl_live_...                    # preferred

# Or sign in as a person, for interactive use:
export LEXSTORE_USER=owner LEXSTORE_PASS=owner         # password grant, or
export LEXSTORE_TOKEN=<access-token>                   # a pre-fetched token
```

## Commands

```bash
lexstore projects                                   # list projects + progress
lexstore languages --project mosaic-web             # per-language progress
lexstore status    --project mosaic-web             # progress bars

# Export finished translations to a JSON key→value file
lexstore pull --project mosaic-web --lang fr --out fr.json
lexstore pull --project mosaic-web --lang fr --status proofread,translated

# Import translations from a JSON file (key→value)
lexstore push --project mosaic-web --lang fr --in fr.json --status translated
```

`pull` writes a flat `{ "term.key": "translation" }` map — drop it straight into
your app's i18n bundle. `push` matches keys back to terms and upserts each
translation idempotently via `PUT …/languages/{lang}/translations/{termId}`.
