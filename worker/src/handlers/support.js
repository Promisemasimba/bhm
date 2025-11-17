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

  /**
   * List support queries
   * GET /support/queries
   */
  async listQueries(request, env, requestId, token) {
    try {
      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/support/queries',
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('List support queries error:', error);
      return errorResponse('Failed to fetch support queries', 500, requestId);
    }
  },

  /**
   * Create support query
   * POST /support/queries
   */
  async createQuery(request, env, requestId, token) {
    try {
      const body = await request.json();

      // Basic validation
      if (!body.subject || !body.category || !body.description) {
        return errorResponse('Subject, category, and description are required', 400, requestId);
      }

      if (body.description.length < 10) {
        return errorResponse('Description must be at least 10 characters', 400, requestId);
      }

      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/support/queries',
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Create support query error:', error);
      if (error.message.includes('JSON')) {
        return errorResponse('Invalid request body', 400, requestId);
      }
      return errorResponse('Failed to create support query', 500, requestId);
    }
  },

  /**
   * Get specific support query
   * GET /support/queries/:id
   */
  async getQueryById(request, env, requestId, token, queryId) {
    try {
      const response = await proxyToCoreAPI(
        request,
        env,
        `/internal/v1/support/queries/${queryId}`,
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Get support query error:', error);
      return errorResponse('Failed to fetch support query', 500, requestId);
    }
  },

  /**
   * Add message to query
   * POST /support/queries/:id/messages
   */
  async addMessage(request, env, requestId, token, queryId) {
    try {
      const body = await request.json();

      if (!body.message) {
        return errorResponse('Message is required', 400, requestId);
      }

      const response = await proxyToCoreAPI(
        request,
        env,
        `/internal/v1/support/queries/${queryId}/messages`,
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Add message error:', error);
      if (error.message.includes('JSON')) {
        return errorResponse('Invalid request body', 400, requestId);
      }
      return errorResponse('Failed to add message', 500, requestId);
    }
  },

  /**
   * Close support query
   * DELETE /support/queries/:id
   */
  async closeQuery(request, env, requestId, token, queryId) {
    try {
      const response = await proxyToCoreAPI(
        request,
        env,
        `/internal/v1/support/queries/${queryId}`,
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Close support query error:', error);
      return errorResponse('Failed to close support query', 500, requestId);
    }
  },
};
