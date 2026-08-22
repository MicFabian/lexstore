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
ENV API_ORIGIN=http://backend:8088
# Keeps nginx's own $variables intact through envsubst.
ENV DOLLAR=$
EXPOSE 80
