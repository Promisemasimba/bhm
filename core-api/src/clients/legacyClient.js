const axios = require('axios');
const config = require('../config');
const logger = require('../config/logger');

/**
 * Client for interacting with legacy system
 * Supports both REST API and direct database access
 */
class LegacyClient {
  constructor() {
    this.apiClient = axios.create({
      baseURL: config.legacy.apiUrl,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${config.legacy.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Add request/response interceptors for logging
    this.apiClient.interceptors.request.use(
      (config) => {
        logger.debug('Legacy API request', {
          method: config.method,
          url: config.url,
          params: config.params,
        });
        return config;
      },
      (error) => {
        logger.error('Legacy API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.apiClient.interceptors.response.use(
      (response) => {
        logger.debug('Legacy API response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('Legacy API response error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Find member by ID number
   * @param {string} idNumber - National ID number
   * @returns {Promise<Object|null>} Member data or null
   */
  async findMemberByIdNumber(idNumber) {
    try {
      // Example REST API call
      const response = await this.apiClient.get('/members/by-id', {
        params: { idNumber },
      });

      if (response.data && response.data.length > 0) {
        const member = response.data[0];
        return this._normalizeMember(member);
      }

      return null;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Error finding member by ID', { idNumber, error: error.message });
      throw new Error('Failed to query legacy system for member by ID');
    }
  }

  /**
   * Find member by member number
   * @param {string} memberNumber - Member number
   * @returns {Promise<Object|null>} Member data or null
   */
  async findMemberByMemberNumber(memberNumber) {
    try {
      const response = await this.apiClient.get(`/members/${memberNumber}`);

      if (response.data) {
        return this._normalizeMember(response.data);
      }

      return null;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Error finding member by number', { memberNumber, error: error.message });
      throw new Error('Failed to query legacy system for member by number');
    }
  }

  /**
   * Get member details with plan and benefits
   * @param {string} legacyMemberId - Legacy member ID
   * @returns {Promise<Object>} Member details
   */
  async getMemberDetails(legacyMemberId) {
    try {
      const response = await this.apiClient.get(`/members/${legacyMemberId}/details`);
      return this._normalizeMemberDetails(response.data);
    } catch (error) {
      logger.error('Error getting member details', { legacyMemberId, error: error.message });
      throw new Error('Failed to retrieve member details from legacy system');
    }
  }

  /**
   * Get member dependants
   * @param {string} legacyMemberId - Legacy member ID
   * @returns {Promise<Array>} List of dependants
   */
  async getMemberDependants(legacyMemberId) {
    try {
      const response = await this.apiClient.get(`/members/${legacyMemberId}/dependants`);
      return (response.data || []).map(dep => this._normalizeDependant(dep));
    } catch (error) {
      logger.error('Error getting dependants', { legacyMemberId, error: error.message });
      throw new Error('Failed to retrieve dependants from legacy system');
    }
  }

  /**
   * Search providers
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} List of providers
   */
  async searchProviders({ query, location, type, specialty, limit = 50, offset = 0 }) {
    try {
      const response = await this.apiClient.get('/providers/search', {
        params: {
          q: query,
          location,
          type,
          specialty,
          limit,
          offset,
        },
      });

      return (response.data || []).map(provider => this._normalizeProvider(provider));
    } catch (error) {
      logger.error('Error searching providers', { query, error: error.message });
      throw new Error('Failed to search providers in legacy system');
    }
  }

  /**
   * Get member claims
   * @param {string} legacyMemberId - Legacy member ID
   * @returns {Promise<Array>} List of claims
   */
  async getMemberClaims(legacyMemberId) {
    try {
      const response = await this.apiClient.get(`/members/${legacyMemberId}/claims`);
      return (response.data || []).map(claim => this._normalizeClaim(claim));
    } catch (error) {
      logger.error('Error getting claims', { legacyMemberId, error: error.message });
      throw new Error('Failed to retrieve claims from legacy system');
    }
  }

  /**
   * Submit a claim
   * @param {Object} claimData - Claim data
   * @returns {Promise<Object>} Created claim
   */
  async submitClaim(claimData) {
    try {
      const response = await this.apiClient.post('/claims', claimData);
      return this._normalizeClaim(response.data);
    } catch (error) {
      logger.error('Error submitting claim', { error: error.message });
      throw new Error('Failed to submit claim to legacy system');
    }
  }

  /**
   * Create a new dependant
   * @param {string} legacyMemberId - Principal member's legacy ID
   * @param {Object} dependantData - Dependant data
   * @returns {Promise<Object>} Created dependant
   */
  async createDependant(legacyMemberId, dependantData) {
    try {
      const response = await this.apiClient.post(`/members/${legacyMemberId}/dependants`, {
        first_name: dependantData.firstName,
        last_name: dependantData.lastName,
        id_number: dependantData.idNumber,
        date_of_birth: dependantData.dateOfBirth,
        relationship: dependantData.relationship,
        gender: dependantData.gender,
      });
      return this._normalizeDependant(response.data);
    } catch (error) {
      logger.error('Error creating dependant', { legacyMemberId, error: error.message });
      if (error.response?.status === 400) {
        throw new Error(error.response?.data?.message || 'Invalid dependant data');
      }
      throw new Error('Failed to create dependant in legacy system');
    }
  }

  /**
   * Update dependant information
   * @param {string} dependantId - Dependant ID
   * @param {Object} updateData - Updated dependant data
   * @returns {Promise<Object>} Updated dependant
   */
  async updateDependant(dependantId, updateData) {
    try {
      const payload = {};
      if (updateData.firstName) payload.first_name = updateData.firstName;
      if (updateData.lastName) payload.last_name = updateData.lastName;
      if (updateData.idNumber) payload.id_number = updateData.idNumber;
      if (updateData.dateOfBirth) payload.date_of_birth = updateData.dateOfBirth;
      if (updateData.relationship) payload.relationship = updateData.relationship;
      if (updateData.gender) payload.gender = updateData.gender;

      const response = await this.apiClient.patch(`/dependants/${dependantId}`, payload);
      return this._normalizeDependant(response.data);
    } catch (error) {
      logger.error('Error updating dependant', { dependantId, error: error.message });
      if (error.response?.status === 404) {
        const err = new Error('Dependant not found');
        err.status = 404;
        throw err;
      }
      if (error.response?.status === 400) {
        throw new Error(error.response?.data?.message || 'Invalid dependant data');
      }
      throw new Error('Failed to update dependant in legacy system');
    }
  }

  /**
   * Delete/remove a dependant
   * @param {string} dependantId - Dependant ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteDependant(dependantId) {
    try {
      const response = await this.apiClient.delete(`/dependants/${dependantId}`);
      return { success: true, message: 'Dependant removed successfully' };
    } catch (error) {
      logger.error('Error deleting dependant', { dependantId, error: error.message });
      if (error.response?.status === 404) {
        const err = new Error('Dependant not found');
        err.status = 404;
        throw err;
      }
      if (error.response?.status === 400) {
        throw new Error(error.response?.data?.message || 'Cannot remove dependant');
      }
      throw new Error('Failed to remove dependant from legacy system');
    }
  }

  /**
   * Get membership certificate data
   * @param {string} legacyMemberId - Legacy member ID
   * @returns {Promise<Object>} Certificate data
   */
  async getMembershipCertificate(legacyMemberId) {
    try {
      const response = await this.apiClient.get(`/members/${legacyMemberId}/certificate`);
      return response.data;
    } catch (error) {
      logger.error('Error getting certificate', { legacyMemberId, error: error.message });
      throw new Error('Failed to retrieve certificate from legacy system');
    }
  }

  /**
   * Normalize member data from legacy format to app format
   */
  _normalizeMember(legacyMember) {
    return {
      id: legacyMember.member_id || legacyMember.id,
      memberNumber: legacyMember.member_number || legacyMember.memberNumber,
      idNumber: legacyMember.id_number || legacyMember.idNumber,
      firstName: legacyMember.first_name || legacyMember.firstName,
      lastName: legacyMember.last_name || legacyMember.lastName,
      dateOfBirth: legacyMember.date_of_birth || legacyMember.dateOfBirth,
      status: legacyMember.status,
      planId: legacyMember.plan_id || legacyMember.planId,
      planName: legacyMember.plan_name || legacyMember.planName,
      effectiveDate: legacyMember.effective_date || legacyMember.effectiveDate,
      expiryDate: legacyMember.expiry_date || legacyMember.expiryDate,
    };
  }

  /**
   * Normalize member details
   */
  _normalizeMemberDetails(data) {
    return {
      member: this._normalizeMember(data.member || data),
      plan: data.plan ? {
        id: data.plan.id,
        name: data.plan.name,
        description: data.plan.description,
        benefits: data.plan.benefits || [],
      } : null,
      coverage: data.coverage || {},
    };
  }

  /**
   * Normalize dependant data
   */
  _normalizeDependant(dep) {
    return {
      id: dep.id,
      firstName: dep.first_name || dep.firstName,
      lastName: dep.last_name || dep.lastName,
      relationship: dep.relationship,
      dateOfBirth: dep.date_of_birth || dep.dateOfBirth,
      status: dep.status,
    };
  }

  /**
   * Normalize provider data
   */
  _normalizeProvider(provider) {
    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      specialties: provider.specialties || [],
      address: provider.address,
      city: provider.city,
      province: provider.province,
      postalCode: provider.postal_code || provider.postalCode,
      phone: provider.phone || provider.phone_number,
      email: provider.email,
      coordinates: provider.coordinates || provider.location,
      networkStatus: provider.network_status || provider.networkStatus,
    };
  }

  /**
   * Normalize claim data
   */
  _normalizeClaim(claim) {
    return {
      id: claim.id,
      claimNumber: claim.claim_number || claim.claimNumber,
      type: claim.type || claim.claim_type,
      provider: claim.provider || claim.provider_name,
      date: claim.date || claim.claim_date,
      amount: claim.amount,
      status: claim.status,
      description: claim.description,
      documents: claim.documents || [],
    };
  }
}

// Export singleton instance
module.exports = new LegacyClient();
