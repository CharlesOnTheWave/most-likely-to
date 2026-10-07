import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";

// Sign-in, sign-up and OAuth errors travel in the URL only as codes; the page shows the Polish text from this map,
// so text typed into `?error=` never reaches the screen. OAuth codes come from /api/auth/oauth, /api/auth/callback
// and from Supabase itself, which sends OAuth state errors straight to the Site URL (/auth/signin) as `error_code`.
const MESSAGES: Record<string, string> = {
  missing_fields: "Podaj e-mail i hasło.",
  invalid_credentials: "Nieprawidłowy e-mail lub hasło.",
  email_not_confirmed: "Najpierw potwierdź adres e-mail. Link jest w wiadomości od nas.",
  over_request_rate_limit: "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.",
  over_email_send_rate_limit: "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.",
  validation_failed: "Sprawdź adres e-mail i hasło.",
  email_address_invalid: "Sprawdź adres e-mail i hasło.",
  user_already_exists: "Konto z tym adresem już istnieje. Zaloguj się.",
  email_exists: "Konto z tym adresem już istnieje. Zaloguj się.",
  weak_password: "Hasło jest za słabe. Użyj co najmniej 6 znaków.",
  signup_disabled: "Zakładanie kont jest wyłączone.",
  config_missing: "Serwer jest chwilowo niedostępny. Spróbuj za kilka minut.",
  service_unavailable: "Serwer jest chwilowo niedostępny. Spróbuj za kilka minut.",
  // OAuth: the host cancelled consent at Discord or Google.
  access_denied: "Logowanie przerwane. Spróbuj jeszcze raz.",
  // OAuth: expired (over 300 s) or broken flow, e.g. a lost PKCE cookie or a reused link.
  bad_oauth_state: "Logowanie wygasło albo się urwało. Zacznij od nowa.",
  bad_oauth_callback: "Logowanie wygasło albo się urwało. Zacznij od nowa.",
  flow_state_expired: "Logowanie wygasło albo się urwało. Zacznij od nowa.",
  flow_state_not_found: "Logowanie wygasło albo się urwało. Zacznij od nowa.",
  flow_state_already_used: "Logowanie wygasło albo się urwało. Zacznij od nowa.",
  pkce_code_verifier_not_found: "Logowanie wygasło albo się urwało. Zacznij od nowa.",
  bad_code_verifier: "Logowanie wygasło albo się urwało. Zacznij od nowa.",
  // OAuth: the email is not verified at the provider.
  provider_email_needs_verification: "Potwierdź adres e-mail u dostawcy albo zaloguj się drugą drogą.",
  email_address_not_authorized: "Potwierdź adres e-mail u dostawcy albo zaloguj się drugą drogą.",
  // OAuth: other failures on Supabase's side (unexpected_failure covers e.g. a provider account without an email).
  unexpected_failure: "Nie udało się zalogować tym kontem. Spróbuj drugiej drogi.",
  user_banned: "Nie udało się zalogować tym kontem. Spróbuj drugiej drogi.",
};

const GENERIC_MESSAGE = "Coś poszło nie tak. Spróbuj ponownie.";

export function authErrorMessage(code: string | null): string | null {
  if (code === null) return null;
  return Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : GENERIC_MESSAGE;
}

// Code for the redirect URL. AuthRetryableFetchError (no connection or 502/503/504, e.g. a paused project) has no
// code, so it and any other 5xx mean Supabase itself is down.
export function authErrorCode(error: AuthError): string {
  if (isAuthRetryableFetchError(error) || (error.status ?? 0) >= 500) return "service_unavailable";
  return error.code ?? "unknown";
}
