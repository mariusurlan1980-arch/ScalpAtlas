import { commercialAuthorizationHeader } from './commercialAuth';
import type { CommercialAccessState } from './commercialAccess';

export type CommercialAccessPayload = CommercialAccessState & {
  freeAnalysesRemaining: number;
  canAnalyze: boolean;
  duplicate?: boolean;
};

const commercialApiUrl = (process.env.EXPO_PUBLIC_ENTITLEMENT_API_URL || '').trim().replace(/\/$/, '');

export class CommercialBackendError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status = 0, code: string | null = null) {
    super(message);
    this.name = 'CommercialBackendError';
    this.status = status;
    this.code = code;
  }
}

export function commercialBackendConfigured(): boolean {
  return commercialApiUrl.length > 0;
}

export function commercialBackendBaseUrl(): string {
  return commercialApiUrl;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!commercialApiUrl) {
    throw new CommercialBackendError('Serverul comercial SCALP ATLAS nu este configurat încă.');
  }

  const authHeaders = await commercialAuthorizationHeader();
  const response = await fetch(`${commercialApiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders,
      ...(init?.headers || {}),
    },
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const code =
      payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : null;

    const message =
      response.status === 401
        ? 'Contul trebuie autentificat pentru a verifica accesul comercial.'
        : response.status === 402
          ? 'Cele 5 analize gratuite au fost folosite. Este necesar un abonament.'
          : `Serverul comercial nu a putut valida accesul (${response.status}).`;

    throw new CommercialBackendError(message, response.status, code);
  }

  return payload as T;
}

export async function fetchCommercialAccess(): Promise<CommercialAccessPayload> {
  return requestJson<CommercialAccessPayload>('/v1/access');
}

export async function completeCommercialAnalysis(
  clientAnalysisId: string
): Promise<CommercialAccessPayload> {
  return requestJson<CommercialAccessPayload>('/v1/analyses/complete', {
    method: 'POST',
    body: JSON.stringify({ clientAnalysisId }),
  });
}

export function commercialAccessStateFromPayload(
  payload: CommercialAccessPayload
): CommercialAccessState {
  return {
    freeAnalysesUsed: Math.max(0, Math.min(5, Math.floor(payload.freeAnalysesUsed || 0))),
    subscriptionActive: payload.subscriptionActive === true,
    subscriptionProductId:
      typeof payload.subscriptionProductId === 'string' ? payload.subscriptionProductId : null,
    subscriptionExpiresAt:
      typeof payload.subscriptionExpiresAt === 'string' ? payload.subscriptionExpiresAt : null,
  };
}

export function createClientAnalysisId(): string {
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `${Date.now().toString(36)}-${randomPart}`;
}
