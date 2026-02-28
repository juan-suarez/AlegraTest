const parsePollingInterval = (value: string | undefined): number => {
  const parsedValue = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsedValue) ? 1000 : parsedValue;
};

export const globalConfig = {
  isDev: import.meta.env.DEV,
  apiKey: import.meta.env.VITE_API_KEY ?? '',
  pollingInterval: parsePollingInterval(import.meta.env.VITE_POLLING_INTERVAL),
  apiEndpoint: import.meta.env.DEV ? '/prod' : '',
};