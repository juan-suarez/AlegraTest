const parsePollingInterval = (value: string | undefined): number => {
  const parsedValue = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsedValue) ? 1000 : parsedValue;
};

export const globalConfig = {
  isDev: import.meta.env.DEV,
  apiKey: import.meta.env.VITE_API_KEY ?? '',
  pollingInterval: parsePollingInterval(import.meta.env.VITE_POLLING_INTERVAL),
  // Production API endpoint.
  // Default to same-origin so CloudFront path-based proxy (/orders, /inventory, /purchases)
  // can inject x-api-key and route to API Gateway.
  apiEndpoint: import.meta.env.VITE_API_ENDPOINT ?? '',
};