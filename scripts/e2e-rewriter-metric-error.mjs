// Wspólna próba błędu i odzyskiwania z ilościowym źródłem. Odrzucenie zmiany
// -20% → +20% na rzeczywistej trasie potwierdzają testy trustedAdvisorRoutes.
process.env.REWRITE_ERROR_SOURCE = 'Zmiana wyniku -20%.';
process.env.REWRITE_ERROR_EVIDENCE = 'docs/evidence/rewriter-metric-sign-rejected-2026-10-03.png';
await import('./e2e-rewriter-model-error.mjs');
