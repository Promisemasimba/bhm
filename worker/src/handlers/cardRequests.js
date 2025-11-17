import { proxyToCoreAPI } from '../utils/proxy';
import { proxyResponse, errorResponse } from '../utils/response';

export const handleCardRequests = {
  /**
   * List card requests
   * GET /cards/physical-requests
   */
  async list(request, env, requestId, token) {
    try {
      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/cards/physical-requests',
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('List card requests error:', error);
      return errorResponse('Failed to fetch card requests', 500, requestId);
    }
  },

  /**
   * Create new card request
   * POST /cards/physical-requests
   */
  async create(request, env, requestId, token) {
    try {
      const body = await request.json();

      // Basic validation
      if (!body.requestType || !['NEW', 'REPLACEMENT', 'RENEWAL'].includes(body.requestType)) {
        return errorResponse('Invalid request type', 400, requestId);
      }

      if (!body.deliveryAddress || !body.deliveryAddress.street || !body.deliveryAddress.city) {
        return errorResponse('Delivery address is required', 400, requestId);
      }

      if (!body.contactPhone) {
        return errorResponse('Contact phone is required', 400, requestId);
      }

      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/cards/physical-requests',
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Create card request error:', error);
      if (error.message.includes('JSON')) {
        return errorResponse('Invalid request body', 400, requestId);
      }
      return errorResponse('Failed to create card request', 500, requestId);
    }
  },

  /**
   * Get specific card request
   * GET /cards/physical-requests/:id
   */
  async getById(request, env, requestId, token, cardRequestId) {
    try {
      const response = await proxyToCoreAPI(
        request,
        env,
        `/internal/v1/cards/physical-requests/${cardRequestId}`,
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Get card request error:', error);
      return errorResponse('Failed to fetch card request', 500, requestId);
    }
  },

  /**
   * Cancel card request
   * DELETE /cards/physical-requests/:id
   */
  async cancel(request, env, requestId, token, cardRequestId) {
    try {
      const response = await proxyToCoreAPI(
        request,
        env,
        `/internal/v1/cards/physical-requests/${cardRequestId}`,
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Cancel card request error:', error);
      return errorResponse('Failed to cancel card request', 500, requestId);
    }
  },
};
