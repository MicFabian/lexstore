# translad CLI

Pull and push translations from your terminal. Zero dependencies (Node ≥ 20, uses built-in `fetch`).

## Install

```bash
cd cli
npm link        # or: npm install -g .
```

Or run directly: `node cli/translad.mjs <command>`.

## Configure

```bash
export TRANSLAD_API=http://localhost:8088/api   # default
```

## Commands

```bash
translad projects                                   # list projects + progress
translad languages --project mosaic-web             # per-language progress
translad status    --project mosaic-web             # progress bars

# Export finished translations to a JSON key→value file
translad pull --project mosaic-web --lang fr --out fr.json
translad pull --project mosaic-web --lang fr --status proofread,translated

# Import translations from a JSON file (key→value)
translad push --project mosaic-web --lang fr --in fr.json --status translated
```

`pull` writes a flat `{ "term.key": "translation" }` map — drop it straight into
your app's i18n bundle. `push` matches keys back to terms and upserts each
translation idempotently via `PUT …/languages/{lang}/translations/{termId}`.
