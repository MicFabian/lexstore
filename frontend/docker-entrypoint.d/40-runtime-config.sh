#!/bin/sh
# Writes the deployment's runtime settings where the app fetches them, so one
# image serves every environment. Defaults match local development.
set -eu

: "${AUTH_AUTHORITY:=http://localhost:8089/realms/lexstore}"
: "${AUTH_CLIENT_ID:=lexstore-spa}"

cat > /usr/share/nginx/html/config.json <<EOF
{
  "authority": "${AUTH_AUTHORITY}",
  "clientId": "${AUTH_CLIENT_ID}",
  "apiBase": "/api"
}
EOF
