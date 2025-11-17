const User = require('../models/User');
const legacyClient = require('../clients/legacyClient');
const membershipService = require('./membershipService');
const logger = require('../config/logger');

class MemberService {
  /**
   * Get home dashboard data
   * Aggregates member info, plan, dependants
   * Uses synced database for fast member/dependant lookups
   */
  async getHomeDashboard(userId) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      const legacyMemberId = parseInt(user.legacy_member_id, 10);

      // Fetch data from synced database (fast) and legacy system (for claims)
      const [member, dependants, recentClaims] = await Promise.all([
        membershipService.getMemberByLegacyId(legacyMemberId),
        membershipService.getDependantsForMember(legacyMemberId),
        legacyClient.getMemberClaims(user.legacy_member_id).then(claims => claims.slice(0, 5)),
      ]);

      if (!member) {
        const error = new Error('Member data not found');
        error.status = 404;
        throw error;
      }

      // Return in OpenAPI HomeSummary format
      return {
        memberInfo: {
          memberNumber: member.member_no,
          fullName: `${member.firstname || ''} ${member.surname || ''}`.trim(),
          status: member.member_status === 'Active' ? 'ACTIVE' : 'INACTIVE',
        },
        plan: {
          name: member.plan || 'Standard Plan',
          status: member.member_status === 'Active' ? 'ACTIVE' : 'INACTIVE',
        },
        dependantsCount: dependants.length,
        recentClaims: recentClaims.map(claim => ({
          id: claim.id,
          claimNumber: claim.claimNumber,
          date: claim.date,
          provider: claim.provider,
          amount: claim.amount,
          status: claim.status,
          type: claim.type,
        })),
        quickActions: [
          {
            id: 'submit_claim',
            label: 'Submit Claim',
            icon: 'file-plus',
            route: '/claims/submit',
          },
          {
            id: 'find_provider',
            label: 'Find Provider',
            icon: 'search',
            route: '/providers/search',
          },
          {
            id: 'view_card',
            label: 'Digital Card',
            icon: 'id-card',
            route: '/card',
          },
          {
            id: 'view_dependants',
            label: 'Dependants',
            icon: 'users',
            route: '/dependants',
          },
        ],
      };
    } catch (error) {
      logger.error('Error fetching home dashboard', { userId, error: error.message });
      throw new Error('Failed to load dashboard data');
    }
  }

  /**
   * Get digital card information
   * Uses synced database for fast member lookups
   */
  async getDigitalCard(userId) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      const legacyMemberId = parseInt(user.legacy_member_id, 10);
      const member = await membershipService.getMemberByLegacyId(legacyMemberId);

      if (!member) {
        const error = new Error('Member data not found');
        error.status = 404;
        throw error;
      }

      // Return in OpenAPI DigitalCard format
      return {
        memberNumber: member.member_no,
        memberName: `${member.firstname || ''} ${member.surname || ''}`.trim(),
        planName: member.plan || 'Standard Plan',
        effectiveDate: member.date_of_joining || null,
        expiryDate: null, // Most plans don't have expiry
        status: member.member_status === 'Active' ? 'ACTIVE' : 'INACTIVE',
        qrCode: this._generateQRCodeData(member.member_no),
        barcode: member.member_no,
      };
    } catch (error) {
      logger.error('Error fetching digital card', { userId, error: error.message });
      throw new Error('Failed to load card information');
    }
  }

  /**
   * Get list of dependants
   * Uses synced database for fast dependant lookups
   */
  async getDependants(userId) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      const legacyMemberId = parseInt(user.legacy_member_id, 10);

      // Get principal member and dependants from synced database
      const [member, dependants] = await Promise.all([
        membershipService.getMemberByLegacyId(legacyMemberId),
        membershipService.getDependantsForMember(legacyMemberId),
      ]);

      if (!member) {
        const error = new Error('Member data not found');
        error.status = 404;
        throw error;
      }

      // Return in OpenAPI DependantsList format
      return {
        principal: {
          id: member.legacy_member_id.toString(),
          memberNumber: member.member_no,
          fullName: `${member.firstname || ''} ${member.surname || ''}`.trim(),
          relationship: 'Principal Member',
          status: member.member_status === 'Active' ? 'ACTIVE' : 'INACTIVE',
        },
        dependants: dependants.map(dep => ({
          id: dep.legacy_member_id.toString(),
          memberNumber: dep.member_no,
          firstName: dep.firstname,
          lastName: dep.surname,
          fullName: `${dep.firstname || ''} ${dep.surname || ''}`.trim(),
          relationship: 'Dependant', // Legacy system doesn't specify relationship type
          dateOfBirth: dep.date_of_birth,
          status: dep.member_status === 'Active' ? 'ACTIVE' : 'INACTIVE',
        })),
        totalCount: dependants.length,
      };
    } catch (error) {
      logger.error('Error fetching dependants', { userId, error: error.message });
      throw new Error('Failed to load dependants');
    }
  }

  /**
   * Get specific dependant by ID
   */
  async getDependantById(userId, dependantId) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      const legacyMemberId = parseInt(user.legacy_member_id, 10);

      // Get all dependants for this principal member
      const dependants = await membershipService.getDependantsForMember(legacyMemberId);

      // Find the specific dependant
      const dependant = dependants.find(
        dep => dep.legacy_member_id.toString() === dependantId || dep.member_no === dependantId
      );

      if (!dependant) {
        const error = new Error('Dependant not found');
        error.status = 404;
        throw error;
      }

      // Return in OpenAPI format
      return {
        id: dependant.legacy_member_id.toString(),
        memberNumber: dependant.member_no,
        firstName: dependant.firstname,
        lastName: dependant.surname,
        fullName: `${dependant.firstname || ''} ${dependant.surname || ''}`.trim(),
        relationship: 'Dependant',
        dateOfBirth: dependant.date_of_birth,
        status: dependant.member_status === 'Active' ? 'ACTIVE' : 'INACTIVE',
        plan: dependant.plan || 'Standard Plan',
      };
    } catch (error) {
      if (error.status === 404) {
        throw error;
      }
      logger.error('Error fetching dependant', { userId, dependantId, error: error.message });
      throw new Error('Failed to load dependant details');
    }
  }

  /**
   * Create a new dependant
   * Adds a dependant to the principal member's account via legacy API
   */
  async createDependant(userId, dependantData) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      const legacyMemberId = parseInt(user.legacy_member_id, 10);

      // Validate required fields
      if (!dependantData.firstName || !dependantData.lastName) {
        const error = new Error('First name and last name are required');
        error.status = 400;
        throw error;
      }

      if (!dependantData.dateOfBirth) {
        const error = new Error('Date of birth is required');
        error.status = 400;
        throw error;
      }

      if (!dependantData.relationship) {
        const error = new Error('Relationship is required');
        error.status = 400;
        throw error;
      }

      // Create dependant in legacy system
      const createdDependant = await legacyClient.createDependant(legacyMemberId, dependantData);

      logger.info('Dependant created', { userId, legacyMemberId, dependantId: createdDependant.id });

      // Return in OpenAPI format
      return {
        id: createdDependant.id.toString(),
        firstName: createdDependant.firstName,
        lastName: createdDependant.lastName,
        fullName: `${createdDependant.firstName} ${createdDependant.lastName}`.trim(),
        relationship: createdDependant.relationship,
        dateOfBirth: createdDependant.dateOfBirth,
        status: createdDependant.status || 'ACTIVE',
      };
    } catch (error) {
      if (error.status === 400 || error.status === 404) {
        throw error;
      }
      logger.error('Error creating dependant', { userId, error: error.message });
      throw new Error('Failed to create dependant');
    }
  }

  /**
   * Update dependant information
   * Updates a dependant's details via legacy API
   */
  async updateDependant(userId, dependantId, updateData) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      const legacyMemberId = parseInt(user.legacy_member_id, 10);

      // Verify dependant belongs to this principal member
      const dependants = await membershipService.getDependantsForMember(legacyMemberId);
      const dependant = dependants.find(
        dep => dep.legacy_member_id.toString() === dependantId || dep.member_no === dependantId
      );

      if (!dependant) {
        const error = new Error('Dependant not found or does not belong to this member');
        error.status = 404;
        throw error;
      }

      // Update via legacy API
      const updatedDependant = await legacyClient.updateDependant(dependant.legacy_member_id, updateData);

      logger.info('Dependant updated', { userId, dependantId, updates: Object.keys(updateData) });

      // Return in OpenAPI format
      return {
        id: updatedDependant.id.toString(),
        firstName: updatedDependant.firstName,
        lastName: updatedDependant.lastName,
        fullName: `${updatedDependant.firstName} ${updatedDependant.lastName}`.trim(),
        relationship: updatedDependant.relationship,
        dateOfBirth: updatedDependant.dateOfBirth,
        status: updatedDependant.status || 'ACTIVE',
      };
    } catch (error) {
      if (error.status === 400 || error.status === 404) {
        throw error;
      }
      logger.error('Error updating dependant', { userId, dependantId, error: error.message });
      throw new Error('Failed to update dependant');
    }
  }

  /**
   * Delete/remove a dependant
   * Removes a dependant from the principal member's account via legacy API
   */
  async deleteDependant(userId, dependantId) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      const legacyMemberId = parseInt(user.legacy_member_id, 10);

      // Verify dependant belongs to this principal member
      const dependants = await membershipService.getDependantsForMember(legacyMemberId);
      const dependant = dependants.find(
        dep => dep.legacy_member_id.toString() === dependantId || dep.member_no === dependantId
      );

      if (!dependant) {
        const error = new Error('Dependant not found or does not belong to this member');
        error.status = 404;
        throw error;
      }

      // Delete via legacy API
      await legacyClient.deleteDependant(dependant.legacy_member_id);

      logger.info('Dependant deleted', { userId, dependantId });

      return { success: true, message: 'Dependant removed successfully' };
    } catch (error) {
      if (error.status === 400 || error.status === 404) {
        throw error;
      }
      logger.error('Error deleting dependant', { userId, dependantId, error: error.message });
      throw new Error('Failed to remove dependant');
    }
  }

  /**
   * Get membership certificate
   */
  async getMembershipCertificate(userId) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      const certificate = await legacyClient.getMembershipCertificate(user.legacy_member_id);
      return certificate;
    } catch (error) {
      logger.error('Error fetching certificate', { userId, error: error.message });
      throw new Error('Failed to load membership certificate');
    }
  }

  /**
   * Generate QR code data for card
   */
  _generateQRCodeData(memberNumber) {
    // Generate a QR-code compatible string with member info
    // This would typically encode member number and validation data
    return `BHM:${memberNumber}:${Date.now()}`;
  }
}

module.exports = new MemberService();
