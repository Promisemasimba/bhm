import { proxyToCoreAPI } from '../utils/proxy';
import { proxyResponse, errorResponse } from '../utils/response';

export const handleClaims = {
  /**
   * List user's claims
   */
  async list(request, env, requestId, token) {
    const response = await proxyToCoreAPI(
      request,
      env,
      '/internal/v1/claims',
      requestId,
      token
    );

    return proxyResponse(response, requestId);
  },

  /**
   * Submit a new claim
   */
  async submit(request, env, requestId, token) {
    try {
      const body = await request.json();

      // Basic validation
      if (!body.type || !body.providerName || !body.serviceDate || !body.amount) {
        return errorResponse('Missing required fields', 400, requestId);
      }

      // Validate amount is positive
      if (body.amount <= 0) {
        return errorResponse('Amount must be positive', 400, requestId);
      }

      // Validate service date
      const serviceDate = new Date(body.serviceDate);
      if (isNaN(serviceDate.getTime())) {
        return errorResponse('Invalid service date', 400, requestId);
      }

      // Check if service date is not in the future
      if (serviceDate > new Date()) {
        return errorResponse('Service date cannot be in the future', 400, requestId);
      }

      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/claims',
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Submit claim error:', error);
      return errorResponse('Invalid request body', 400, requestId);
    }
  },

  /**
   * Get upload URL for claim document
   */
  async getUploadUrl(request, env, requestId, token, claimId) {
    try {
      const body = await request.json();

      // Validate file info
      if (!body.fileName || !body.fileType || !body.fileSize) {
        return errorResponse('Missing file information', 400, requestId);
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (body.fileSize > maxSize) {
        return errorResponse('File size exceeds maximum (10MB)', 400, requestId);
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(body.fileType)) {
        return errorResponse('Invalid file type. Allowed: PDF, JPG, PNG', 400, requestId);
      }

      const response = await proxyToCoreAPI(
        request,
        env,
        `/internal/v1/claims/${claimId}/upload-url`,
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Get upload URL error:', error);
      return errorResponse('Invalid request body', 400, requestId);
    }
  },
};
