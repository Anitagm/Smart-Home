# Ferdowsi — Smart Home Dashboard frontend.
# Multi-stage build: compile the Vite app, then serve the static bundle
# with nginx (which also reverse-proxies /api to the backend container).

FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Relative base so the same build works behind nginx's /api proxy
# regardless of which host/port the page is served from.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
