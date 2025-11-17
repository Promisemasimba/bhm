import { proxyToCoreAPI } from '../utils/proxy';
import { proxyResponse, errorResponse } from '../utils/response';

export const handleDependants = {
  /**
   * Get list of dependants
   * GET /dependants
   */
  async list(request, env, requestId, token) {
    try {
      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/dependants',
        requestId,
        token
      );

      return proxyResponse(response, requestId);
    } catch (error) {
      console.error('List dependants error:', error);
      return errorResponse('Failed to fetch dependants', 500, requestId);
    }
  },

  /**
   * Get specific dependant by ID
   * GET /dependants/:id
   */
  async getById(request, env, requestId, token, dependantId) {
    try {
      const response = await proxyToCoreAPI(
        request,
        env,
        `/internal/v1/dependants/${dependantId}`,
        requestId,
        token
      );

      return proxyResponse(response, requestId);
    } catch (error) {
      console.error('Get dependant error:', error);
      return errorResponse('Failed to fetch dependant', 500, requestId);
    }
  },

  /**
   * Create new dependant
   * POST /dependants
   */
  async create(request, env, requestId, token) {
    try {
      const body = await request.json();

      // Basic validation
      if (!body.firstName || !body.lastName) {
        return errorResponse('First name and last name are required', 400, requestId);
      }

      if (!body.dateOfBirth) {
        return errorResponse('Date of birth is required', 400, requestId);
      }

      if (!body.relationship) {
        return errorResponse('Relationship is required', 400, requestId);
      }

      // Validate relationship value
      const validRelationships = ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'];
      if (!validRelationships.includes(body.relationship)) {
        return errorResponse('Invalid relationship type', 400, requestId);
      }

      const response = await proxyToCoreAPI(
        request,
        env,
        '/internal/v1/dependants',
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Create dependant error:', error);
      if (error.message.includes('JSON')) {
        return errorResponse('Invalid request body', 400, requestId);
      }
      return errorResponse('Failed to create dependant', 500, requestId);
    }
  },

  /**
   * Update dependant information
   * PATCH /dependants/:id
   */
  async update(request, env, requestId, token, dependantId) {
    try {
      const body = await request.json();

      // Validate at least one field is provided
      const allowedFields = ['firstName', 'lastName', 'idNumber', 'dateOfBirth', 'relationship', 'gender'];
      const providedFields = Object.keys(body).filter(key => allowedFields.includes(key));

      if (providedFields.length === 0) {
        return errorResponse('At least one field must be provided for update', 400, requestId);
      }

      // Validate relationship if provided
      if (body.relationship) {
        const validRelationships = ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'];
        if (!validRelationships.includes(body.relationship)) {
          return errorResponse('Invalid relationship type', 400, requestId);
        }
      }

      // Validate gender if provided
      if (body.gender) {
        const validGenders = ['MALE', 'FEMALE', 'OTHER'];
        if (!validGenders.includes(body.gender)) {
          return errorResponse('Invalid gender value', 400, requestId);
        }
      }

      const response = await proxyToCoreAPI(
        request,
        env,
        `/internal/v1/dependants/${dependantId}`,
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Update dependant error:', error);
      if (error.message.includes('JSON')) {
        return errorResponse('Invalid request body', 400, requestId);
      }
      return errorResponse('Failed to update dependant', 500, requestId);
    }
  },

  /**
   * Delete/remove dependant
   * DELETE /dependants/:id
   */
  async remove(request, env, requestId, token, dependantId) {
    try {
      const response = await proxyToCoreAPI(
        request,
        env,
        `/internal/v1/dependants/${dependantId}`,
        requestId,
        token
      );

      return proxyResponse(response, requestId);

    } catch (error) {
      console.error('Delete dependant error:', error);
      return errorResponse('Failed to remove dependant', 500, requestId);
    }
  },
};
