-- Konta zakładane przez dostawców OAuth (Google, Microsoft/azure, LinkedIn
-- OIDC) nie mają w user_metadata klucza `display_name`, którym posługuje się
-- rejestracja e-mailowa. Dotychczasowy trigger wpisywał im nazwę z prefiksu
-- maila („jan.kowalski”), choć dostawca podał pełne imię i nazwisko.
--
-- Łańcuch fallbacku jest lustrzanym odbiciem `profileFromSession` w
-- src/context/AuthContext.tsx — zmiana jednej strony wymaga zmiany drugiej.
-- Klucze zgodne z tym, co Supabase wkłada do raw_user_meta_data:
--   google → full_name, azure → name/preferred_username, linkedin_oidc → name.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'preferred_username',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger `on_auth_user_created` zostaje bez zmian (0001_init.sql) —
-- REPLACE FUNCTION podmienia implementację pod istniejącym triggerem.
