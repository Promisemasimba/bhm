/**
 * Proxy request to Core API with service authentication
 */
export async function proxyToCoreAPI(request, env, corePath, requestId, token = null) {
  const coreUrl = new URL(corePath, env.CORE_API_BASE);

  // Build headers
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('X-Service-Auth', env.SERVICE_SECRET);
  headers.set('X-Request-ID', requestId);

  // Add JWT token if provided
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Build request options
  const options = {
    method: request.method,
    headers,
  };

  // Add body for POST/PUT requests
  if (request.method === 'POST' || request.method === 'PUT') {
    try {
      const body = await request.text();
      options.body = body;
    } catch (error) {
      console.error('Error reading request body:', error);
    }
  }

  // Add query parameters
  const url = new URL(request.url);
  if (url.search) {
    coreUrl.search = url.search;
  }

  // Make request to Core API
  const response = await fetch(coreUrl.toString(), options);

  return response;
}
