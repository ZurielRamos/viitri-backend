# syntax=docker/dockerfile:1

# API de viitri (NestJS). Imagen de varias etapas: compila con todas las
# dependencias y la imagen final solo lleva dist/ y las de producción.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
# npm 10 (el que trae Node 22) falla al resolver las peer dependencies de
# este proyecto ("Cannot read properties of null (reading 'edgesOut')").
RUN npm install -g npm@12 --no-fund --no-audit

# ---------- Dependencias completas, para compilar ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-fund --no-audit

# ---------- Compilación ----------
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------- Solo dependencias de producción ----------
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-fund --no-audit

# ---------- Imagen final ----------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

COPY --chown=node:node package.json ./
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
# Carpeta de archivos locales (correos .eml e imágenes) cuando no hay SMTP
# ni bucket configurados. En producción conviene montarla como volumen.
RUN mkdir -p var && chown node:node var

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Sin npm de por medio: node recibe las señales y la app cierra limpio.
CMD ["node", "dist/main.js"]
