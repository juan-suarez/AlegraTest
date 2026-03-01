/**
 * Local development service routing
 * Maps API paths to local service URLs
 * 
 * For local testing (browser on localhost):
 *   Uses localhost:PORT because Docker ports are mapped to host
 * 
 * For production (browser on real domain):
 *   Returns empty string to fall back to API Gateway
 */

// Local service routes - always use localhost for browser access
// (Docker port mapping makes services accessible at localhost:300X)
const serviceRoutes: Record<string, string> = {
  '/orders': 'http://localhost:3001',
  '/inventory': 'http://localhost:3003',
  '/purchases': 'http://localhost:3004',
};

/**
 * Resolves the correct base URL for a given API path
 * In local browser (localhost): returns local service URL
 * In production: returns empty string (uses globalConfig.apiEndpoint)
 */
export function resolveServiceUrl(path: string): string {
  // Find the matching route
  for (const [route, baseUrl] of Object.entries(serviceRoutes)) {
    if (path.startsWith(route)) {
      return baseUrl;
    }
  }
  
  // Fallback for unknown routes
  console.warn(`No local service mapping found for path: ${path}`);
  return '';
}
