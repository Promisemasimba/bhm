/**
 * Create a JSON response with CORS headers
 */
export function createResponse(data, status = 200, requestId = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (requestId) {
    headers['X-Request-ID'] = requestId;
  }

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

/**
 * Create an error response
 */
export function errorResponse(message, status = 500, requestId = null, details = null) {
  const body = {
    error: message,
    status,
  };

  if (requestId) {
    body.requestId = requestId;
  }

  if (details) {
    body.details = details;
  }

  return createResponse(body, status, requestId);
}

/**
 * Proxy response from Core API
 */
export function proxyResponse(coreResponse, requestId = null) {
  const headers = new Headers(coreResponse.headers);

  // Add CORS headers
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (requestId) {
    headers.set('X-Request-ID', requestId);
  }

  return new Response(coreResponse.body, {
    status: coreResponse.status,
    headers,
  });
}
