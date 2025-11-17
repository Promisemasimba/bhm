const User = require('../models/User');
const legacyClient = require('../clients/legacyClient');
const logger = require('../config/logger');

class MemberService {
  /**
   * Get home dashboard data
   * Aggregates member info, plan, dependants
   */
  async getHomeDashboard(userId) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      // Fetch data from legacy system
      const [memberDetails, dependants, recentClaims] = await Promise.all([
        legacyClient.getMemberDetails(user.legacy_member_id),
        legacyClient.getMemberDependants(user.legacy_member_id),
        legacyClient.getMemberClaims(user.legacy_member_id).then(claims => claims.slice(0, 5)),
      ]);

      return {
        member: {
          memberNumber: user.member_number || memberDetails.member.memberNumber,
          firstName: user.first_name || memberDetails.member.firstName,
          lastName: user.last_name || memberDetails.member.lastName,
          status: memberDetails.member.status,
        },
        plan: memberDetails.plan,
        coverage: memberDetails.coverage,
        dependants: {
          count: dependants.length,
          list: dependants.slice(0, 3), // Show first 3
        },
        recentClaims: {
          count: recentClaims.length,
          list: recentClaims,
        },
        quickActions: [
          { id: 'submit_claim', label: 'Submit Claim', icon: 'file-plus' },
          { id: 'find_provider', label: 'Find Provider', icon: 'search' },
          { id: 'view_card', label: 'View Card', icon: 'id-card' },
          { id: 'download_certificate', label: 'Certificate', icon: 'download' },
        ],
      };
    } catch (error) {
      logger.error('Error fetching home dashboard', { userId, error: error.message });
      throw new Error('Failed to load dashboard data');
    }
  }

  /**
   * Get digital card information
   */
  async getDigitalCard(userId) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      const memberDetails = await legacyClient.getMemberDetails(user.legacy_member_id);

      return {
        memberNumber: user.member_number || memberDetails.member.memberNumber,
        memberName: `${user.first_name || memberDetails.member.firstName} ${user.last_name || memberDetails.member.lastName}`,
        planName: memberDetails.plan?.name,
        effectiveDate: memberDetails.member.effectiveDate,
        expiryDate: memberDetails.member.expiryDate,
        qrCode: this._generateQRCodeData(user.member_number || memberDetails.member.memberNumber),
        barcode: user.member_number || memberDetails.member.memberNumber,
      };
    } catch (error) {
      logger.error('Error fetching digital card', { userId, error: error.message });
      throw new Error('Failed to load card information');
    }
  }

  /**
   * Get list of dependants
   */
  async getDependants(userId) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      const dependants = await legacyClient.getMemberDependants(user.legacy_member_id);

      return {
        principal: {
          firstName: user.first_name,
          lastName: user.last_name,
          memberNumber: user.member_number,
          relationship: 'Principal Member',
        },
        dependants: dependants.map(dep => ({
          id: dep.id,
          firstName: dep.firstName,
          lastName: dep.lastName,
          relationship: dep.relationship,
          dateOfBirth: dep.dateOfBirth,
          status: dep.status,
        })),
      };
    } catch (error) {
      logger.error('Error fetching dependants', { userId, error: error.message });
      throw new Error('Failed to load dependants');
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
