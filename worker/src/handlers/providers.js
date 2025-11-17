import { proxyToCoreAPI } from '../utils/proxy';
import { proxyResponse, errorResponse } from '../utils/response';

export const handleProviders = {
  /**
   * Search providers
   */
  async search(request, env, requestId, token) {
    // Optional: Add caching for provider search results
    // This is a read-heavy endpoint that benefits from edge caching

    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const location = url.searchParams.get('location');
    const type = url.searchParams.get('type');
    const specialty = url.searchParams.get('specialty');

    // Validation
    if (!query && !location && !type && !specialty) {
      return errorResponse('At least one search parameter is required', 400, requestId);
    }

    const response = await proxyToCoreAPI(
      request,
      env,
      '/internal/v1/providers/search',
      requestId,
      token
    );

    // You could cache successful responses here
    // if (response.ok && env.CACHE) {
    //   const cacheKey = `providers:${url.search}`;
    //   await env.CACHE.put(cacheKey, await response.clone().text(), {
    //     expirationTtl: 3600, // 1 hour
    //   });
    // }

    return proxyResponse(response, requestId);
  },
};
