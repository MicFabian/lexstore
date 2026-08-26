FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /src/dist/frontend/browser /usr/share/nginx/html
# nginx substitutes ${API_ORIGIN} from the environment at container start.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Writes /config.json from AUTH_AUTHORITY / AUTH_CLIENT_ID at container start,
# so the same image points at any Keycloak without a rebuild.
COPY docker-entrypoint.d/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh
ENV API_ORIGIN=http://backend:8088
# Keeps nginx's own $variables intact through envsubst.
ENV DOLLAR=$
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1
