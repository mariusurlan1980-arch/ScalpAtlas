export type CommercialAccessTokenProvider = () => Promise<string | null>;

let accessTokenProvider: CommercialAccessTokenProvider | null = null;

/**
 * The production authentication SDK should register a provider at app startup.
 * SCALP ATLAS never hardcodes a user token or store secret in the APK.
 */
export function registerCommercialAccessTokenProvider(
  provider: CommercialAccessTokenProvider | null
): void {
  accessTokenProvider = provider;
}

export async function getCommercialAccessToken(): Promise<string | null> {
  if (!accessTokenProvider) return null;
  const token = await accessTokenProvider();
  if (typeof token !== 'string') return null;
  const normalized = token.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function commercialAuthorizationHeader(): Promise<Record<string, string>> {
  const token = await getCommercialAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
