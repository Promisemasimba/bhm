import { proxyToCoreAPI } from '../utils/proxy';
import { proxyResponse, errorResponse } from '../utils/response';

export const handleAuth = {
  /**
   * Handle user registration via national ID number
   * POST /auth/register/id
   */
  async registerById(request, env, requestId) {
    try {
      const body = await request.json();

      // Validation
      if (!body.idNumber || !body.email || !body.username || !body.password) {
        return errorResponse('Missing required fields', 400, requestId);
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return errorResponse('Invalid email format', 400, requestId);
      }

      // Password strength
      if (body.password.length < 8) {
        return errorResponse('Password must be at least 8 characters', 400, requestId);
      }

      // Forward to Core API
      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/auth/register/id',
        requestId
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Registration error:', error);
      return errorResponse('Invalid request body', 400, requestId);
    }
  },

  /**
   * Handle user registration via membership number
   * POST /auth/register/membership
   */
  async registerByMembership(request, env, requestId) {
    try {
      const body = await request.json();

      // Validation
      if (!body.membershipNumber || !body.email || !body.username || !body.password) {
        return errorResponse('Missing required fields', 400, requestId);
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return errorResponse('Invalid email format', 400, requestId);
      }

      // Password strength
      if (body.password.length < 8) {
        return errorResponse('Password must be at least 8 characters', 400, requestId);
      }

      // Forward to Core API
      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/auth/register/membership',
        requestId
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Registration error:', error);
      return errorResponse('Invalid request body', 400, requestId);
    }
  },

  /**
   * Handle user login
   * POST /auth/login
   */
  async login(request, env, requestId) {
    try {
      const body = await request.json();

      // Validation
      if (!body.username || !body.password) {
        return errorResponse('Username and password are required', 400, requestId);
      }

      // Forward to Core API
      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/auth/login',
        requestId
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Login error:', error);
      return errorResponse('Invalid request body', 400, requestId);
    }
  },

  /**
   * Handle token refresh
   * POST /auth/refresh
   */
  async refresh(request, env, requestId) {
    try {
      const body = await request.json();

      // Validation
      if (!body.refreshToken) {
        return errorResponse('Refresh token is required', 400, requestId);
      }

      // Forward to Core API
      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/auth/refresh',
        requestId
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Token refresh error:', error);
      return errorResponse('Invalid request body', 400, requestId);
    }
  },

  /**
   * Handle user logout
   * POST /auth/logout
   */
  async logout(request, env, requestId, token) {
    try {
      // Forward to Core API with auth token
      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/auth/logout',
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Logout error:', error);
      return errorResponse('Logout failed', 500, requestId);
    }
  },
};
