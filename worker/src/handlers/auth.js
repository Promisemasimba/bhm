import { proxyToCoreAPI } from '../utils/proxy';
import { proxyResponse, errorResponse } from '../utils/response';

export const handleAuth = {
  /**
   * Handle user registration
   */
  async register(request, env, requestId) {
    try {
      // Parse and validate request body
      const body = await request.json();

      // Basic validation
      if (!body.mode || !body.email || !body.username || !body.password) {
        return errorResponse('Missing required fields', 400, requestId);
      }

      if (!['id', 'memberNumber'].includes(body.mode)) {
        return errorResponse('Invalid mode. Must be "id" or "memberNumber"', 400, requestId);
      }

      if (body.mode === 'id' && !body.idNumber) {
        return errorResponse('ID number is required for ID mode', 400, requestId);
      }

      if (body.mode === 'memberNumber' && !body.memberNumber) {
        return errorResponse('Member number is required for memberNumber mode', 400, requestId);
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return errorResponse('Invalid email format', 400, requestId);
      }

      // Password strength (minimum 8 characters)
      if (body.password.length < 8) {
        return errorResponse('Password must be at least 8 characters', 400, requestId);
      }

      // Forward to Core API
      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/auth/register',
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
   */
  async login(request, env, requestId) {
    try {
      // Parse and validate request body
      const body = await request.json();

      // Basic validation
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
};
