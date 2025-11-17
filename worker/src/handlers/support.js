import { proxyToCoreAPI } from '../utils/proxy';
import { proxyResponse, errorResponse } from '../utils/response';

export const handleSupport = {
  /**
   * Get contact options
   * GET /support/contact-options
   */
  async getContactOptions(request, env, requestId, token) {
    try {
      // This could be cached in Worker KV for faster responses
      // For now, proxy to Core API
      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/support/contact-options',
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Get contact options error:', error);
      return errorResponse('Failed to fetch contact options', 500, requestId);
    }
  },
};
