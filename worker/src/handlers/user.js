import { proxyToCoreAPI } from '../utils/proxy';
import { proxyResponse, errorResponse } from '../utils/response';

export const handleUser = {
  /**
   * Get current user profile
   * GET /me
   */
  async getProfile(request, env, requestId, token) {
    try {
      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/me',
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Get profile error:', error);
      return errorResponse('Failed to fetch profile', 500, requestId);
    }
  },

  /**
   * Update current user profile
   * PATCH /me
   */
  async updateProfile(request, env, requestId, token) {
    try {
      const body = await request.json();

      // Basic validation
      if (body.phoneNumber && !/^\+?[0-9]{10,15}$/.test(body.phoneNumber)) {
        return errorResponse('Invalid phone number format', 400, requestId);
      }

      if (body.profileImageUrl && !body.profileImageUrl.startsWith('http')) {
        return errorResponse('Invalid profile image URL', 400, requestId);
      }

      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/me',
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Update profile error:', error);
      if (error.message.includes('JSON')) {
        return errorResponse('Invalid request body', 400, requestId);
      }
      return errorResponse('Failed to update profile', 500, requestId);
    }
  },

  /**
   * Get current package/plan information
   * GET /packages/current
   */
  async getCurrentPackage(request, env, requestId, token) {
    try {
      // Check Worker KV cache first (if implemented)
      // TODO: Implement Worker KV caching for package data

      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/packages/current',
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Get package error:', error);
      return errorResponse('Failed to fetch package information', 500, requestId);
    }
  },
};
