import { globalConfig } from '../config/globalConfig';

interface AuthSession {
  idToken: string;
  accessToken: string;
  expiresAt: number;
  tokenType: string;
}

const AUTH_STORAGE_KEY = 'restaurantAuthSession';
const EXPIRY_SAFETY_WINDOW_MS = 30_000;

const normalizeDomain = (domain: string): string => {
  if (!domain) {
    return '';
  }

  const trimmed = domain.trim();
  const extractedUrl = trimmed.match(/https?:\/\/\S+/)?.[0] ?? trimmed;

  if (extractedUrl.includes('Token[')) {
    return '';
  }

  if (extractedUrl.startsWith('http://') || extractedUrl.startsWith('https://')) {
    return extractedUrl.replace(/\/$/, '');
  }

  return `https://${extractedUrl.replace(/\/$/, '')}`;
};

const parseHashParams = (hashValue: string): URLSearchParams => {
  const hash = hashValue.startsWith('#') ? hashValue.slice(1) : hashValue;
  return new URLSearchParams(hash);
};

const getConfiguredRedirectUri = (): string => {
  if (globalConfig.auth.redirectUri) {
    return globalConfig.auth.redirectUri;
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/`;
  }

  return '';
};

const getConfiguredLogoutUri = (): string => {
  if (globalConfig.auth.logoutUri) {
    return globalConfig.auth.logoutUri;
  }

  return getConfiguredRedirectUri();
};

const saveSession = (session: AuthSession): void => {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

const clearUrlHash = (): void => {
  if (!window.location.hash) {
    return;
  }

  const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  window.history.replaceState({}, document.title, cleanUrl);
};

export const authService = {
  isEnabled(): boolean {
    return globalConfig.auth.enabled;
  },

  completeLoginFromUrl(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const params = parseHashParams(window.location.hash);
    const idToken = params.get('id_token');
    const accessToken = params.get('access_token');
    const tokenType = params.get('token_type') ?? 'Bearer';
    const expiresInRaw = Number.parseInt(params.get('expires_in') ?? '0', 10);

    if (!idToken || !accessToken || Number.isNaN(expiresInRaw) || expiresInRaw <= 0) {
      return false;
    }

    const expiresAt = Date.now() + expiresInRaw * 1000;
    saveSession({
      idToken,
      accessToken,
      expiresAt,
      tokenType,
    });

    clearUrlHash();
    return true;
  },

  getSession(): AuthSession | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!rawSession) {
      return null;
    }

    try {
      const parsedSession = JSON.parse(rawSession) as AuthSession;
      if (!parsedSession.idToken || !parsedSession.accessToken || !parsedSession.expiresAt) {
        return null;
      }
      return parsedSession;
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    const session = this.getSession();
    if (!session) {
      return false;
    }

    const isStillValid = session.expiresAt > Date.now() + EXPIRY_SAFETY_WINDOW_MS;
    if (!isStillValid && typeof window !== 'undefined') {
      this.clearSession();
    }

    return isStillValid;
  },

  getAuthorizationHeader(): string | null {
    const session = this.getSession();
    if (!session) {
      return null;
    }

    if (!this.isAuthenticated()) {
      return null;
    }

    return `${session.tokenType} ${session.idToken}`;
  },

  login(): void {
    console.info('[Auth] Login attempt config', {
      enabled: globalConfig.auth.enabled,
      cognitoDomainRaw: globalConfig.auth.cognitoDomain,
      clientIdPresent: Boolean(globalConfig.auth.clientId),
      redirectUri: getConfiguredRedirectUri(),
      scopes: globalConfig.auth.scopes,
    });

    const domain = normalizeDomain(globalConfig.auth.cognitoDomain);
    if (!domain || !globalConfig.auth.clientId) {
      console.error('[Auth] Invalid login configuration', {
        cognitoDomainRaw: globalConfig.auth.cognitoDomain,
        cognitoDomainNormalized: domain,
        clientIdPresent: Boolean(globalConfig.auth.clientId),
      });
      throw new Error('Cognito domain or client ID is not configured (or invalid).');
    }

    const redirectUri = getConfiguredRedirectUri();
    let authorizeUrl: URL;

    try {
      authorizeUrl = new URL(`${domain}/oauth2/authorize`);
    } catch {
      console.error('[Auth] Failed to create authorize URL', {
        domain,
        cognitoDomainRaw: globalConfig.auth.cognitoDomain,
      });
      throw new Error(`Invalid Cognito domain configured: ${globalConfig.auth.cognitoDomain}`);
    }

    authorizeUrl.searchParams.set('client_id', globalConfig.auth.clientId);
    authorizeUrl.searchParams.set('response_type', 'token');
    authorizeUrl.searchParams.set('scope', globalConfig.auth.scopes);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);

    console.info('[Auth] Redirecting to Cognito authorize URL', {
      authorizeUrl: authorizeUrl.toString(),
    });

    window.location.assign(authorizeUrl.toString());
  },

  logout(): void {
    console.info('[Auth] Logout attempt config', {
      cognitoDomainRaw: globalConfig.auth.cognitoDomain,
      clientIdPresent: Boolean(globalConfig.auth.clientId),
      logoutUri: getConfiguredLogoutUri(),
    });

    const domain = normalizeDomain(globalConfig.auth.cognitoDomain);
    const logoutUri = getConfiguredLogoutUri();

    this.clearSession();

    if (!domain || !globalConfig.auth.clientId) {
      console.warn('[Auth] Logout without Cognito config, using fallback redirect', {
        cognitoDomainNormalized: domain,
        clientIdPresent: Boolean(globalConfig.auth.clientId),
        logoutUri,
      });
      if (logoutUri) {
        window.location.assign(logoutUri);
      }
      return;
    }

    const logoutUrl = new URL(`${domain}/logout`);
    logoutUrl.searchParams.set('client_id', globalConfig.auth.clientId);
    logoutUrl.searchParams.set('logout_uri', logoutUri);

    console.info('[Auth] Redirecting to Cognito logout URL', {
      logoutUrl: logoutUrl.toString(),
    });

    window.location.assign(logoutUrl.toString());
  },

  clearSession(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  },
};
