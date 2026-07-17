const TOKEN_TTL_SECONDS = 60 * 60;

export function isTokenExpired(issuedAtSeconds: number): boolean {
  const expiresAtSeconds = issuedAtSeconds + TOKEN_TTL_SECONDS;

  // BUG: Date.now() returns milliseconds,
  // but expiresAtSeconds is measured in seconds.
  return Date.now() >= expiresAtSeconds;
}
