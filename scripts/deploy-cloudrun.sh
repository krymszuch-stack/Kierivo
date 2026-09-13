#!/usr/bin/env bash
# ==============================================================================
# scripts/deploy-cloudrun.sh — Wdrożenie Kierivo na Google Cloud Run
# ==============================================================================
# Jeden kontener serwuje jednocześnie skompilowany frontend React i serwer Express.
# Zgodnie z wytycznymi architektonicznymi:
# - Zero zaufania do klienta (Zero-Trust Client)
# - Sekrety wyłącznie przez Google Secret Manager
# - TRUST_PROXY=true dla poprawnej pracy rate limitera za reverse proxy Cloud Run
# ==============================================================================

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-${1:-}}"
REGION="${GCP_REGION:-europe-central2}"
SERVICE_NAME="cvelocity"

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Błąd: Podaj ID projektu GCP jako pierwszy argument lub ustaw zmienną GCP_PROJECT_ID."
  echo "Użycie: ./scripts/deploy-cloudrun.sh <TWÓJ_PROJECT_ID> [REGION]"
  exit 1
fi

echo "🚀 Rozpoczynam wdrożenie Kierivo na Cloud Run w projekcie: $PROJECT_ID ($REGION)"

# 1. Sprawdzenie narzędzi
command -v gcloud >/dev/null 2>&1 || { echo "❌ gcloud CLI nie jest zainstalowane."; exit 1; }

# 2. Sprawdzenie jakości przed buildem (Bramka CI)
echo "🔍 Uruchamiam testy i sprawdzanie typów..."
npm run lint
npm test

# 3. Weryfikacja czy sekrety w repo nie wyciekają do buildu
echo "🔒 Weryfikacja pakietu pod kątem wycieków kluczy..."
npm run build
if grep -rE "service_role|sk_live|sk_test|SUPABASE_SERVICE" dist/client/ 2>/dev/null; then
  echo "❌ KRYTYCZNY BŁĄD: Wykryto klucz serwerowy w pakiecie klienckim (dist/client/)!"
  exit 1
fi
echo "✓ Pakiet kliencki jest czysty od sekretów serwerowych."

# 4. Konfiguracja projektu w gcloud
gcloud config set project "$PROJECT_ID"

# 5. Upewnienie się, że wymagane API GCP są aktywne
echo "⚙️ Sprawdzam usługi GCP..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com

# 6. Utworzenie rejestru Artifact Registry jeśli nie istnieje
REPO_NAME="cvelocity"
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" >/dev/null 2>&1; then
  echo "📦 Tworzę repozytorium Artifact Registry: $REPO_NAME w $REGION..."
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Docker repository for Kierivo"
fi

IMAGE_TAG="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/app:latest"

# 7. Budowa obrazu z przekazaniem publicznych zmiennych VITE_ (build-args)
echo "🏗️ Budowanie i wysyłanie obrazu Docker przez Cloud Build..."
gcloud builds submit \
  --tag "$IMAGE_TAG" \
  --build-arg "VITE_SUPABASE_URL=${VITE_SUPABASE_URL:-}" \
  --build-arg "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY:-}" \
  --build-arg "VITE_STRIPE_PUBLISHABLE_KEY=${VITE_STRIPE_PUBLISHABLE_KEY:-}" \
  .

# 8. Wdrożenie na Cloud Run
echo "🚀 Wdrażanie kontenera na Google Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_TAG" \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --set-env-vars "NODE_ENV=production,BACKEND_MODE=cloud,TRUST_PROXY=true,SUPABASE_URL=${SUPABASE_URL:-},APP_URL=${APP_URL:-}" \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest,STRIPE_SECRET_KEY=stripe-secret:latest,STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest"

# 9. Test zdrowia
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format="value(status.url)")
echo "🩺 Sprawdzam stan wdrożonej usługi pod adresem: $SERVICE_URL..."
HEALTH_RESP=$(curl -sf "$SERVICE_URL/api/health" || echo "ERROR")

if [[ "$HEALTH_RESP" == *"ok"* ]]; then
  echo "✅ SUKCES: Kierivo działa poprawnie na Cloud Run!"
  echo "🔗 URL aplikacji: $SERVICE_URL"
else
  echo "⚠️ Ostrzeżenie: Endpoint zdrowia nie zwrócił 'ok'. Sprawdź logi gcloud:"
  echo "   gcloud run logs read --service $SERVICE_NAME --region $REGION --limit 50"
fi
