import { describe, it, expect, beforeEach } from 'vitest';
import { validateConfig, resetConfigCacheForTesting, loadConfig } from '../config';

describe('Walidacja konfiguracji serwera (config.ts)', () => {
  beforeEach(() => {
    resetConfigCacheForTesting();
  });

  describe('Domyślna konfiguracja deweloperska', () => {
    it('domyślnie przyjmuje azure_openai jako dostawcę AI (główna ścieżka produkcyjna)', () => {
      const config = validateConfig({
        NODE_ENV: 'test',
        BACKEND_MODE: 'local',
      });

      expect(config.AI_PROVIDER).toBe('azure_openai');
    });

    it('poprawnie wczytuje bezpieczne wartości domyślne dla trybu local z Ollamą', () => {
      const config = validateConfig({
        NODE_ENV: 'development',
        BACKEND_MODE: 'local',
        AI_PROVIDER: 'ollama',
      });

      expect(config.NODE_ENV).toBe('development');
      expect(config.PORT).toBe(3000);
      expect(config.BACKEND_MODE).toBe('local');
      expect(config.backendEnabled).toBe(false);
      expect(config.AI_PROVIDER).toBe('ollama');
      expect(config.OLLAMA_BASE_URL).toBe('http://127.0.0.1:11434');
      expect(config.OLLAMA_MODEL).toBe('qwen-chat:latest');
      expect(config.paymentsEnabled).toBe(false);
      expect(config.TRUST_PROXY).toBe(false);
      expect(config.allowedOrigins).toEqual([]);
    });

    it('poprawnie przetwarza ALLOWED_ORIGINS i TRUST_PROXY', () => {
      const config = validateConfig({
        NODE_ENV: 'development',
        AI_PROVIDER: 'ollama',
        ALLOWED_ORIGINS: 'https://example.com, https://app.example.com ',
        TRUST_PROXY: 'true',
      });

      expect(config.allowedOrigins).toEqual(['https://example.com', 'https://app.example.com']);
      expect(config.TRUST_PROXY).toBe(true);
    });
  });

  describe('Walidacja krytyczna: BACKEND_MODE=cloud', () => {
    it('zatrzymuje serwer, jeśli w trybie cloud brakuje zmiennych Supabase', () => {
      expect(() =>
        validateConfig({
          NODE_ENV: 'development',
          AI_PROVIDER: 'ollama',
          BACKEND_MODE: 'cloud',
        })
      ).toThrowError(/BACKEND_MODE=cloud wymaga zmiennych: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/);
    });

    it('zatrzymuje serwer, jeśli brakuje tylko SUPABASE_SERVICE_ROLE_KEY', () => {
      expect(() =>
        validateConfig({
          NODE_ENV: 'development',
          AI_PROVIDER: 'ollama',
          BACKEND_MODE: 'cloud',
          SUPABASE_URL: 'https://test-project.supabase.co',
        })
      ).toThrowError(/BACKEND_MODE=cloud wymaga zmiennych: SUPABASE_SERVICE_ROLE_KEY/);
    });

    it('zatrzymuje serwer, jeśli brakuje tylko SUPABASE_URL', () => {
      expect(() =>
        validateConfig({
          NODE_ENV: 'development',
          AI_PROVIDER: 'ollama',
          BACKEND_MODE: 'cloud',
          SUPABASE_SERVICE_ROLE_KEY: 'secret-service-role-key',
        })
      ).toThrowError(/BACKEND_MODE=cloud wymaga zmiennych: SUPABASE_URL/);
    });

    it('przechodzi pomyślnie, gdy obie zmienne Supabase są obecne', () => {
      const config = validateConfig({
        NODE_ENV: 'development',
        AI_PROVIDER: 'ollama',
        BACKEND_MODE: 'cloud',
        SUPABASE_URL: 'https://test-project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'secret-service-role-key',
      });

      expect(config.backendEnabled).toBe(true);
      expect(config.SUPABASE_URL).toBe('https://test-project.supabase.co');
      expect(config.SUPABASE_SERVICE_ROLE_KEY).toBe('secret-service-role-key');
    });
  });

  describe('Walidacja krytyczna: AI_PROVIDER=azure_openai', () => {
    it('zatrzymuje serwer poza środowiskiem testowym, gdy brak endpointu lub deploymentu', () => {
      expect(() =>
        validateConfig({
          NODE_ENV: 'development',
          AI_PROVIDER: 'azure_openai',
        })
      ).toThrowError(/AI_PROVIDER=azure_openai wymaga ustawienia AZURE_OPENAI_ENDPOINT oraz AZURE_OPENAI_DEPLOYMENT/);
    });

    it('akceptuje kompletną konfigurację Azure OpenAI', () => {
      const config = validateConfig({
        NODE_ENV: 'development',
        AI_PROVIDER: 'azure_openai',
        AZURE_OPENAI_ENDPOINT: 'https://custom-resource.openai.azure.com',
        AZURE_OPENAI_DEPLOYMENT: 'gpt-4o-mini',
      });

      expect(config.AI_PROVIDER).toBe('azure_openai');
      expect(config.AZURE_OPENAI_ENDPOINT).toBe('https://custom-resource.openai.azure.com');
      expect(config.AZURE_OPENAI_DEPLOYMENT).toBe('gpt-4o-mini');
    });
  });

  describe('Walidacja krytyczna: spójność Stripe', () => {
    it('zatrzymuje serwer, gdy podano STRIPE_SECRET_KEY bez STRIPE_WEBHOOK_SECRET', () => {
      expect(() =>
        validateConfig({
          NODE_ENV: 'development',
          AI_PROVIDER: 'ollama',
          STRIPE_SECRET_KEY: 'sk_test_12345',
        })
      ).toThrowError(/Zmienna STRIPE_SECRET_KEY jest ustawiona, ale brakuje STRIPE_WEBHOOK_SECRET/);
    });

    it('zatrzymuje serwer, gdy podano STRIPE_WEBHOOK_SECRET bez STRIPE_SECRET_KEY', () => {
      expect(() =>
        validateConfig({
          NODE_ENV: 'development',
          AI_PROVIDER: 'ollama',
          STRIPE_WEBHOOK_SECRET: 'whsec_12345',
        })
      ).toThrowError(/Zmienna STRIPE_WEBHOOK_SECRET jest ustawiona, ale brakuje STRIPE_SECRET_KEY/);
    });

    it('akceptuje parę kluczy Stripe', () => {
      const config = validateConfig({
        NODE_ENV: 'development',
        AI_PROVIDER: 'ollama',
        BACKEND_MODE: 'cloud',
        SUPABASE_URL: 'https://test-project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'secret-service-role-key',
        STRIPE_SECRET_KEY: 'sk_test_12345',
        STRIPE_WEBHOOK_SECRET: 'whsec_12345',
      });

      expect(config.STRIPE_SECRET_KEY).toBe('sk_test_12345');
      expect(config.STRIPE_WEBHOOK_SECRET).toBe('whsec_12345');
    });
  });

  describe('Walidacja krytyczna: środowisko produkcyjne (NODE_ENV=production)', () => {
    const validProdEnv = {
      NODE_ENV: 'production',
      BACKEND_MODE: 'cloud',
      APP_URL: 'https://kierivo.com',
      SUPABASE_URL: 'https://prod-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'prod-secret-service-role-key',
      AZURE_OPENAI_ENDPOINT: 'https://kierivo-ai.openai.azure.com',
      AZURE_OPENAI_DEPLOYMENT: 'gpt-4o',
    };

    it('zatrzymuje serwer, gdy APP_URL na produkcji wskazuje na localhost', () => {
      expect(() =>
        validateConfig({
          ...validProdEnv,
          APP_URL: 'http://localhost:3000',
        })
      ).toThrowError(/APP_URL na produkcji \(NODE_ENV=production\) nie może wskazywać na adres lokalny/);
    });

    it('zatrzymuje serwer, gdy na produkcji wybrano BACKEND_MODE=local', () => {
      expect(() =>
        validateConfig({
          ...validProdEnv,
          BACKEND_MODE: 'local',
        })
      ).toThrowError(/Wdrożenie produkcyjne \(NODE_ENV=production\) wymaga BACKEND_MODE=cloud/);
    });

    it('zatrzymuje serwer na produkcji z domyślnym azure_openai, gdy brak endpointu Azure', () => {
      const { AZURE_OPENAI_ENDPOINT: _, ...envWithoutEndpoint } = validProdEnv;
      expect(() => validateConfig(envWithoutEndpoint)).toThrowError(
        /AI_PROVIDER=azure_openai wymaga ustawienia AZURE_OPENAI_ENDPOINT oraz AZURE_OPENAI_DEPLOYMENT/
      );
    });

    it('akceptuje w pełni poprawną konfigurację produkcyjną z domyślnym Azure OpenAI', () => {
      const config = validateConfig(validProdEnv);
      expect(config.NODE_ENV).toBe('production');
      expect(config.AI_PROVIDER).toBe('azure_openai');
      expect(config.APP_URL).toBe('https://kierivo.com');
      expect(config.backendEnabled).toBe(true);
    });
  });

  describe('Walidacja bezpieczeństwa: blokada prywatnych kluczy w VITE_*', () => {
    it('zatrzymuje serwer, gdy wykryto VITE_SUPABASE_SERVICE_ROLE_KEY', () => {
      expect(() =>
        validateConfig({
          NODE_ENV: 'development',
          AI_PROVIDER: 'ollama',
          VITE_SUPABASE_SERVICE_ROLE_KEY: 'dangerous-key-in-bundle',
        })
      ).toThrowError(/Wykryto prywatny sekret z prefiksem VITE_: VITE_SUPABASE_SERVICE_ROLE_KEY/);
    });

    it('zatrzymuje serwer, gdy wykryto VITE_STRIPE_SECRET_KEY', () => {
      expect(() =>
        validateConfig({
          NODE_ENV: 'development',
          AI_PROVIDER: 'ollama',
          VITE_STRIPE_SECRET_KEY: 'dangerous-stripe-key',
        })
      ).toThrowError(/Wykryto prywatny sekret z prefiksem VITE_: VITE_STRIPE_SECRET_KEY/);
    });
  });

  describe('Pamięć podręczna konfiguracji loadConfig()', () => {
    it('zapamiętuje wynik pierwszego wywołania i resetuje się przez resetConfigCacheForTesting', () => {
      const originalPort = process.env.PORT;
      try {
        process.env.PORT = '4000';
        resetConfigCacheForTesting();
        const first = loadConfig();
        expect(first.PORT).toBe(4000);

        process.env.PORT = '5000';
        const second = loadConfig();
        expect(second.PORT).toBe(4000); // z pamięci podręcznej

        resetConfigCacheForTesting();
        const third = loadConfig();
        expect(third.PORT).toBe(5000); // po resecie
      } finally {
        if (originalPort !== undefined) {
          process.env.PORT = originalPort;
        } else {
          delete process.env.PORT;
        }
        resetConfigCacheForTesting();
      }
    });
  });
});
