# Codex — konfiguracja oszczędnego kontekstu dla Kierivo

Stan: 14.10.2026. Używaj `AGENTS.md` jako jedynego operacyjnego kontraktu. Plik dokumentuje powody i elementy opcjonalne, **nie** jest dodatkowym always-on promptem.

## Wdrożone w repo

1. Krótkie, warunkowe instrukcje w `AGENTS.md` zamiast obowiązkowego czytania wszystkich dokumentów przed każdym zadaniem.
2. Zasada: `git grep` / wycinki plików / testy pojedynczej funkcji → pełna bramka przed PR, nie kilka pełnych audytów na każdy krok.
3. Równoległość *wyłącznie niezależnych odczytów* w Code Mode, serializacja zapisów i działań wymagających uprawnienia.
4. Skill `kierivo-targeted-audit` w `.agents/skills/`. Dodatkowe szczegóły procedury są ładowane na żądanie, nie w kontekście każdego zadania.
5. Minimalny handoff w Linear: SHA, issue, root cause, testy, NEXT; bez pełnych logów/duplikowanych streszczeń.

## Czego świadomie nie włączono globalnie

- **Wymuszenie modelu/effort** w project `.codex/config.toml`: mogłoby zastąpić wybór użytkownika (również High dla security). Model i effort dobieraj do zadania.
- **Dziesiątki subagentów, polling co sekundę:** można zwiększyć koszt i zatory; jedynie 1–2 agenty do naprawdę niezależnych, ograniczonych badań. Subagenci nie gwarantują oszczędności.
- **Manipulacja `model_context_window`, `model_auto_compact_token_limit`, nieudokumentowane feature flags i wyłączanie pamięci/compaction:** brak wiarygodnego zysku dla Kierivo, ryzyko kompatybilności w różnych klientach.
- **`approval_policy = "never"`, `sandbox_mode = "danger-full-access"`, globalny network access:** nie poprawiają jakości analizy i zwiększają ryzyko skutków ubocznych.
- **Przymusowe MCP dla każdego zadania:** dodatkowe serwery to większy koszt startowy i powierzchnia dostępu; łącz na żądanie. Linear i GitHub pozostają źródłami danych, nie kopiuj ich w prompt.

## Opcjonalna konfiguracja użytkownika (nie została zmieniona zdalnie)

Po sprawdzeniu działającej wersji Codex CLI/IDE można ustawić w **lokalnym** `~/.codex/config.toml`:

```toml
approval_policy = "on-request"
sandbox_mode = "workspace-write"
```

To przykład bezpiecznej postawy, a nie automatycznie wdrożona zmiana; może już być skonfigurowana. Repo celowo nie narzuca tych kluczy. Projektowa `.codex/config.toml` działa wyłącznie w zaufanych projektach i ma pierwszeństwo przed częścią konfiguracji użytkownika.

## Testowanie poprawy

Porównaj **to samo issue i porównywalną klasę zmian** przed/po: liczbę wywołań narzędzi, rozmiar wejścia, licznik tokenów raportowany przez Codex (jeśli dostępny), czas, test coverage, błędy, regresje. Nie obiecuj stałego procentu oszczędności — wyniki GitHub issue #41450 są pomiarem jednego przypadku.

Źródła:
- Oficjalne zalecenia OpenAI (11.09.2026): https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra
- Oficjalne skills w repo: https://developers.openai.com/blog/skills-agents-sdk
- Kod trybu narzędziowego, jedno `AGENTS.md` i token amplification: https://github.com/openai/codex/issues/41450
- Społeczność, rola subagentów i koszt: https://www.reddit.com/r/codex/comments/1ur3pth/3_reasons_why_you_should_use_subagents_in_codex/
- Konfiguracja projektowa: https://learn.chatgpt.com/docs/config-file/config-basic
