# Obraz KIERIVO dla Azure Container Apps.
#
# Jeden kontener serwuje frontend i API. Skutek: jeden URL, więc nie ma ruchu
# cross-origin, nie ma CORS do skonfigurowania i nie ma osobnego rachunku za
# hosting frontendu. `server.ts` serwuje `dist/client/` warunkowo (`existsSync`),
# więc ten sam obraz zbudowany bez frontendu działa dalej jako samo API.

# ---------- etap 1: build ----------
# Node 22, nie 20: safeFetch przypina zwalidowane IP przez własny `lookup`
# w `http.request` i cała weryfikacja SSRF była robiona na tej wersji.
FROM node:22-slim AS build

WORKDIR /app

# Warstwa zależności osobno od źródeł — dopóki lockfile się nie zmienia,
# Docker odtwarza ją z cache zamiast instalować od nowa przy każdym buildzie.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Zmienne VITE_ są **wbudowywane w pakiet przeglądarki w trakcie budowania**,
# a nie odczytywane w czasie działania. Przekazanie ich przez `--set-env-vars`
# w konfiguracji Container Apps nie zadziała — muszą być tutaj.
#
# Obie są publiczne z definicji: `anon` chroni RLS, a klucz publikowalny Stripe'a
# służy właśnie do umieszczania w kodzie klienta. SUPABASE_SERVICE_ROLE_KEY ani
# STRIPE_SECRET_KEY nie mogą tu trafić nigdy — pierwszy omija całe RLS, drugi
# pozwala obciążać cudze karty.
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_STRIPE_PUBLISHABLE_KEY=""
ARG VITE_API_URL=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY \
    VITE_API_URL=$VITE_API_URL

RUN npm run build

# ---------- etap 2: runtime ----------
FROM node:22-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Bez devDependencies: bundel wymaga w czasie działania tylko express, helmet,
# zod, dotenv, cheerio, openai, @azure/identity, @supabase/supabase-js i stripe. Vite jest
# ładowany dynamicznym importem wyłącznie w gałęzi deweloperskiej.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/dist ./dist

# Graf semantyczny (PoliMorf/ESCO) jako baza SQLite tylko-do-odczytu.
#
# Plik `work-graph.db` jest generowany (`npm run seed:import` w pakiecie
# semantic-work-graph) i nie leży w repozytorium — kopiowanie całego katalogu
# `data/` przenosi go do obrazu wtedy, gdy zdążył powstać przed buildem, a bez
# niego obraz i tak się buduje (katalog niesie też seed i dokumenty).
#
# Warunek pakowania: przed buildem baza musi zostać zcheckpointowana i
# przestawiona na `PRAGMA journal_mode = DELETE`. Tryb WAL jest trwały w
# nagłówku pliku, a czytelnik bazy WAL tworzy obok siebie pliki `-wal`/`-shm`
# — na systemie plików tylko-do-odczytu kontenera skończyło by się to błędem.
# Odczyt otwiera `SqliteGraphRepository({ readonly: true })`, co dodatkowo
# wymusza `query_only = ON` i `fileMustExist`.
COPY --from=build /app/semantic-work-graph/data ./semantic-work-graph/data

# Kontener nie ma powodu działać jako root. Obraz `node` ma gotowego
# nieuprzywilejowanego użytkownika `node` (uid 1000).
USER node

# Container Apps przekazuje ruch na skonfigurowany port, a `config.ts` czyta
# PORT ze środowiska, a `server.ts` binduje 0.0.0.0. Ta wartość jest tylko
# domyślną dla uruchomienia lokalnego.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "--enable-source-maps", "dist/server.mjs"]
