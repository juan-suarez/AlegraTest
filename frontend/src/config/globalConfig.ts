const parsePollingInterval = (value: string | undefined): number => {
  const parsedValue = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsedValue) ? 1000 : parsedValue;
};

type RuntimeAuthConfig = {
  enabled?: boolean;
  cognitoDomain?: string;
  clientId?: string;
  redirectUri?: string;
  logoutUri?: string;
  scopes?: string;
};

type RuntimeAppConfig = {
  auth?: RuntimeAuthConfig;
};

const getRuntimeConfig = (): RuntimeAppConfig | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const runtimeWindow = window as Window & { __APP_CONFIG__?: RuntimeAppConfig };
  return runtimeWindow.__APP_CONFIG__ ?? null;
};

const runtimeAuthConfig = getRuntimeConfig()?.auth;

export const globalConfig = {
  isDev: import.meta.env.DEV,
  apiKey: import.meta.env.VITE_API_KEY ?? '',
  pollingInterval: parsePollingInterval(import.meta.env.VITE_POLLING_INTERVAL),
  // Production API endpoint.
  // Default to same-origin so CloudFront path-based proxy (/orders, /inventory, /purchases)
  // can inject x-api-key and route to API Gateway.
  apiEndpoint: import.meta.env.VITE_API_ENDPOINT ?? '',
  auth: {
    enabled: runtimeAuthConfig?.enabled ?? ((import.meta.env.VITE_AUTH_ENABLED ?? 'false') === 'true'),
    cognitoDomain: runtimeAuthConfig?.cognitoDomain ?? (import.meta.env.VITE_COGNITO_DOMAIN ?? ''),
    clientId: runtimeAuthConfig?.clientId ?? (import.meta.env.VITE_COGNITO_CLIENT_ID ?? ''),
    redirectUri: runtimeAuthConfig?.redirectUri ?? (import.meta.env.VITE_COGNITO_REDIRECT_URI ?? ''),
    logoutUri: runtimeAuthConfig?.logoutUri ?? (import.meta.env.VITE_COGNITO_LOGOUT_URI ?? ''),
    scopes: runtimeAuthConfig?.scopes ?? (import.meta.env.VITE_COGNITO_SCOPES ?? 'openid email profile'),
  },
};