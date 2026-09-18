// Must run before anything reads process.env. `dotenv` was a declared dependency
// but was never imported, so .env files were silently ignored — which also left
// NODE_ENV unset and put the error handler into its most verbose mode.
import "dotenv/config";

import express from "express";
import path from "path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import helmet from "helmet";
import { jobsRouter } from "./src/server/routes/jobs.routes";
import { aiRouter } from "./src/server/routes/ai.routes";
import { statsRouter } from "./src/server/routes/stats.routes";
import { meRouter } from "./src/server/routes/me.routes";
import { vaultRouter } from "./src/server/routes/vault.routes";
import { applicationsRouter } from "./src/server/routes/applications.routes";
import { billingRouter } from "./src/server/routes/billing.routes";
import { intelRouter } from "./src/server/routes/intel.routes";
import { errorsRouter } from "./src/server/routes/errors.routes";
import { stripeWebhookRouter } from "./src/server/routes/stripe.routes";
import { pdfRouter } from "./src/server/routes/pdf.routes";
import { errorHandler } from "./src/server/middleware/errorHandler";
import { standardApiLimiter } from "./src/server/middleware/rateLimiter";
import { validateStartupEnv } from "./src/server/config";
import { PAYMENTS_ENABLED } from "./src/lib/beta";

async function startServer() {
  // Twarda walidacja startowa: sprawdza kompletność zmiennych krytycznych,
  // spójność konfiguracji oraz restrykcje bezpieczeństwa przed zainicjalizowaniem aplikacji.
  const config = validateStartupEnv();
  const isProduction = config.NODE_ENV === "production";

  const app = express();
  app.disable("x-powered-by");

  // Rejestracja spójnego requestId dla całego potoku żądań
  app.use((req, res, next) => {
    const incomingId = req.headers["x-request-id"];
    const requestId =
      typeof incomingId === "string" && incomingId.trim().length > 0
        ? incomingId.trim()
        : randomUUID();
    (req as unknown as { requestId: string }).requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  });

  // Only meaningful behind a reverse proxy. Enabling it without one would let a
  // client spoof its address through X-Forwarded-For and bypass rate limiting.
  if (config.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  // The whole threat model here is "XSS reads localStorage", which makes CSP the
  // single most valuable header. Dev needs the loose directives Vite's HMR
  // requires; production gets the strict set.
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              // Tailwind injects styles at runtime.
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "blob:"],
              // Fonty hostujemy u siebie (public/fonts). Zezwolenie na
              // fonts.gstatic.com było potrzebne, dopóki ładowaliśmy je z Google —
              // co wysyłało adres IP każdego odwiedzającego na ich serwery.
              fontSrc: ["'self'", "data:"],
              connectSrc: ["'self'", "https://*.supabase.co", "https://api.stripe.com"],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      // helmet defaults to SAMEORIGIN; this app is never meant to be framed.
      frameguard: { action: "deny" },
      hsts: isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    })
  );

  // Reflect only origins on the allowlist — never a wildcard. `Vary: Origin`
  // keeps caches from serving one origin's response to another.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    res.header("Vary", "Origin");

    if (origin && config.allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    }

    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  // Weryfikacja podpisu Stripe'a liczy się z **dokładnych bajtów** ciała żądania,
  // razem z kolejnością pól i białymi znakami. Po sparsowaniu do obiektu i
  // ponownym zserializowaniu podpis już się nie zgadza. Stąd `express.raw` i to
  // samo wymaganie kolejności co niżej: pierwszy parser wygrywa.
  app.use("/api/stripe-webhook", express.raw({ type: "application/json", limit: "1mb" }));

  // Ogłoszenia bywają długie, a `/api/parse-jd` dostaje ich pełną treść.
  // Musi być zarejestrowane *przed* globalnym parserem: body-parser oznacza
  // żądanie jako odczytane (`req._body`) i każdy kolejny parser robi wtedy
  // no-op, więc podniesienie limitu poniżej progu 200 kB nigdy nie działało.
  app.use("/api/parse-jd", express.json({ limit: "1mb" }));

  // Vault to całe CV z historią zatrudnienia — 200 kB bywa za mało przy dłuższym
  // przebiegu zawodowym.
  app.use("/api/vault", express.json({ limit: "1mb" }));

  // Weryfikator CV AI 360° przesyła pełny MasterVault do audytu
  app.use("/api/ai/verify-cv", express.json({ limit: "1mb" }));

  // Eksport PDF przesyła pełny obiekt MasterVault i opcjonalny TailoredResume.
  app.use("/api/cv/export-pdf", express.json({ limit: "2mb" }));

  // 200kB globally. The previous 10MB limit combined with 120 req/min allowed
  // 1.2GB/min of JSON per IP. Routes that genuinely need large bodies raise it
  // for themselves.
  app.use(express.json({ limit: "200kb" }));

  // Webhook przed limiterem świadomie: Stripe ponawia dostarczenie po każdym
  // niepowodzeniu, więc odbicie go z kodem 429 zamienia chwilowy ruch w pętlę
  // ponowień. Rolę ochrony pełni tu weryfikacja podpisu — żądanie bez ważnego
  // podpisu jest odrzucane, zanim cokolwiek zrobi.
  //
  // Webhook mountowany tylko gdy płatności są włączone — bez flagi Secret
  // i webhook handler nie ma sensu istnieć w drzewie routingowym.
  if (PAYMENTS_ENABLED) {
    app.use("/api", stripeWebhookRouter);
  }

  app.use("/api", standardApiLimiter);

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "KIERIVO Core Engine API",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.use("/api", jobsRouter);
  app.use("/api", aiRouter);
  app.use("/api", statsRouter);
  app.use("/api", pdfRouter);

  // Trasy wymagające konta. Rejestrowane zawsze — `requireAuth` odpowiada 501
  // w trybie `BACKEND_MODE=local`, więc klient dostaje jasną informację, że ta
  // instalacja nie prowadzi kont, zamiast trafiać na 404 nie do odróżnienia od
  // literówki w adresie.
  app.use("/api", meRouter);
  app.use("/api", vaultRouter);
  app.use("/api", applicationsRouter);

  // Płatności mountowane wyłącznie gdy flaga produktowa jest włączona.
  // Gdy PAYMENTS_ENABLED=false, trasy billing i stripe nie istnieją w drzewie
  // routingowym — żaden curl z tokenem nie dotrze do `checkout.sessions.create`.
  if (PAYMENTS_ENABLED) {
    app.use("/api", billingRouter);
  }

  // Wiedza zbiorowa jest celowo bez `requireAuth`: wpis nie ma właściciela,
  // więc nie ma czego weryfikować, a wymaganie konta odcięłoby od korpusu
  // wszystkich pracujących w trybie lokalnym.
  app.use("/api", intelRouter);

  // Zgłoszenia błędów klienta również bez `requireAuth` (uzasadnienie w trasie).
  app.use("/api", errorsRouter);

  // Nieznana ścieżka pod /api kończy się czystym 404 w JSON-ie. Bez tego łapie ją
  // fallback SPA poniżej i odsyła index.html ze statusem 200 — klient wywołujący
  // usunięty albo przekręcony endpoint dostawał wtedy stronę HTML, a `res.json()`
  // wywracał się na parsowaniu zamiast pokazać, że trasy po prostu nie ma.
  app.use("/api", (_req, res) => {
    res.status(404).json({ success: false, error: "Nie znaleziono takiego zasobu API." });
  });

  if (!isProduction) {
    // Loaded lazily so the production bundle never pulls Vite (and with it
    // rollup and esbuild) into the container image or the cold start.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Resolve relative to this file rather than the working directory, so the
    // server does not depend on where it was launched from. The bundle lives in
    // `dist/`, the frontend in `dist/client/` — keeping them apart is what stops
    // `express.static` from serving the server bundle and its source map.
    const clientPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "client");

    // On Cloud Run the frontend is hosted by Vercel, so the image is built API-only
    // and this directory is absent. Serving it conditionally means one image works
    // both ways instead of crashing on a missing path.
    if (existsSync(path.join(clientPath, "index.html"))) {
      app.use(express.static(clientPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(clientPath, "index.html"));
      });
    }
  }

  // Error middleware only catches what is registered before it.
  app.use(errorHandler);

  app.listen(config.PORT, "0.0.0.0", () => {
    console.log(`KIERIVO Engine Server running on http://localhost:${config.PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Nie udało się uruchomić serwera:\n", err instanceof Error ? err.message : err);
  process.exit(1);
});
