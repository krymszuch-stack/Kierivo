import { z } from 'zod';

/**
 * Kontrakty żądań — jedno źródło dla serwera i dla klienta.
 *
 * Trasy sprawdzały ciała żądań ręcznie (`if (typeof url !== 'string' || …)`),
 * mimo że `zod` był już zależnością i był używany w `config.ts`. Ręczna walidacja
 * rozjeżdża się z typami przy pierwszej zmianie kształtu, a kontrakt opisany raz
 * daje przy okazji typ TypeScriptu po obu stronach.
 */

export const fetchJdUrlSchema = z.object({
  // 2048 znaków to praktyczny limit adresu obsługiwany przez serwery i
  // przeglądarki; dłuższy adres to prawie zawsze próba przemycenia ładunku.
  url: z.string().trim().min(1).max(2048),
});
export type FetchJdUrlInput = z.infer<typeof fetchJdUrlSchema>;

export const parseJdSchema = z.object({
  rawJdText: z.string().trim().min(1, 'Brak treści ogłoszenia o pracę.'),
});
export type ParseJdInput = z.infer<typeof parseJdSchema>;

/**
 * Vault trafia do bazy jako `jsonb`, więc kształt pilnuje ta walidacja, a nie
 * schemat tabeli. `passthrough` jest celowy: MasterVault zmienia się razem
 * z interfejsem, a odrzucanie nieznanych pól oznaczałoby, że starszy serwer
 * po cichu obcina dane zapisane przez nowszy front.
 */
export const vaultPayloadSchema = z.object({
  vault: z.object({
    schemaVersion: z.number().int().positive().optional(),
    version: z.string(),
    updatedAt: z.string(),
    personalInfo: z.object({}).passthrough(),
  }).passthrough(),
});
export type VaultPayload = z.infer<typeof vaultPayloadSchema>;

export const applicationStatusSchema = z.enum([
  'Do wysłania',
  'Wysłana',
  'Rozmowa',
  'Oferta',
  'Odrzucona',
  'Archiwum',
]);

export const applicationInputSchema = z.object({
  company: z.string().trim().min(1).max(200),
  position: z.string().trim().min(1).max(200),
  salary: z.string().trim().max(120).optional(),
  appliedAt: z.string().trim().max(40).optional(),
  status: applicationStatusSchema.default('Wysłana'),
  notes: z.string().max(10_000).optional(),
  jobUrl: z.string().trim().max(2048).optional(),
});
export type ApplicationInput = z.infer<typeof applicationInputSchema>;

/** Aktualizacja częściowa — PATCH nie wymaga kompletu pól. */
export const applicationPatchSchema = applicationInputSchema.partial();

export const checkoutSessionSchema = z.object({
  // Identyfikator ceny jest weryfikowany w tabeli `plans`, zanim powstanie
  // sesja płatności. Bez tego wystarczyłoby podmienić `price_...` w żądaniu
  // i kupić plan Pro za cenę szablonu.
  priceId: z.string().trim().min(1).max(200),
});
export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;

/**
 * Zgłoszenie błędu klienta — kontrakt anonimizacji, nie tylko kształtu.
 *
 * Schemat odmawia wszystkiego, co mogłoby nieść daną osobową: brak pola na
 * identyfikator użytkownika, treść wiadomości przycięta do 300 znaków po
 * sanityzacji po stronie klienta, stos zredukowany do nazw funkcji i nazw plików
 * (bez ścieżek absolutnych i argumentów). `strict()` jest tu częścią polityki
 * prywatności: nieznanego pola nie da się przemycić „na zapas", bo całe
 * zgłoszenie zostanie odrzucone zamiast po cichu przepuścić obce dane.
 */
export const clientErrorKindSchema = z.enum([
  /** Wyjątek przy generowaniu/eksportowaniu dokumentu CV. */
  'cv-export',
  /** Wyjątek złapany przez granicę błędów Reacta. */
  'ui-crash',
  /** Nieobsłużony wyjątek (`window.error`) bez własnej obsługi. */
  'uncaught',
  /** Odrzucona obietnica bez `catch`. */
  'unhandledrejection',
]);

export const clientErrorStackFrameSchema = z.object({
  fn: z.string().max(80).optional(),
  file: z.string().max(120).optional(),
  line: z.number().int().nonnegative().optional(),
});

export const clientErrorEventSchema = z.strictObject({
  fingerprint: z.string().regex(/^[0-9a-f]{16}$/),
  kind: clientErrorKindSchema,
  surface: z.string().min(1).max(60).regex(/^[A-Za-z0-9:_-]+$/),
  message: z.string().min(1).max(300),
  stack: z.array(clientErrorStackFrameSchema).max(5).optional(),
  env: z.enum(['dev', 'prod']).optional(),
  uaFamily: z.string().max(40).optional(),
  viewportBucket: z.string().max(20).optional(),
  occurredAt: z.iso.datetime(),
});
export type ClientErrorEvent = z.infer<typeof clientErrorEventSchema>;

/** Partia wysyłana jednym żądaniem / jednym beaconem. */
export const clientErrorBatchSchema = z.object({
  events: z.array(clientErrorEventSchema).min(1).max(20),
});
