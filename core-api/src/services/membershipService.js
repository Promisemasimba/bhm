/**
 * Membership Service
 * Fast lookups of member data from synced database
 * Used for registration validation and member queries
 */

const db = require('../db');
const logger = require('../config/logger');

class MembershipService {
  /**
   * Find principal member by national ID number
   * Used during registration with mode="id"
   *
   * @param {string} nationalIdNo - National ID number
   * @returns {Promise<Object|null>} Member record or null
   */
  async findMemberByNationalId(nationalIdNo) {
    if (!nationalIdNo) {
      return null;
    }

    try {
      const result = await db.query(
        `SELECT
          id,
          legacy_member_id,
          member_no,
          title,
          firstname,
          surname,
          initials,
          sex,
          date_of_birth,
          date_of_joining,
          national_id_no,
          member_status,
          plan,
          company,
          cellphone_no,
          email_address,
          email_address2
        FROM members
        WHERE national_id_no = $1
          AND is_dependant = false
        ORDER BY
          CASE member_status
            WHEN 'Active' THEN 1
            WHEN 'Suspended' THEN 2
            ELSE 3
          END,
          date_of_joining DESC
        LIMIT 1`,
        [nationalIdNo]
      );

      if (result.rows.length === 0) {
        logger.debug('No member found for national ID', { nationalIdNo });
        return null;
      }

      const member = result.rows[0];

      logger.debug('Found member by national ID', {
        nationalIdNo,
        memberId: member.legacy_member_id,
        memberNo: member.member_no,
        status: member.member_status,
      });

      return member;

    } catch (error) {
      logger.error('Error finding member by national ID', {
        nationalIdNo,
        error: error.message,
      });
      throw new Error('Failed to lookup member by national ID');
    }
  }

  /**
   * Find principal member by member number
   * Used during registration with mode="memberNumber"
   *
   * @param {string} memberNo - Member number
   * @returns {Promise<Object|null>} Member record or null
   */
  async findMemberByMemberNo(memberNo) {
    if (!memberNo) {
      return null;
    }

    try {
      const result = await db.query(
        `SELECT
          id,
          legacy_member_id,
          member_no,
          title,
          firstname,
          surname,
          initials,
          sex,
          date_of_birth,
          date_of_joining,
          national_id_no,
          member_status,
          plan,
          company,
          cellphone_no,
          email_address,
          email_address2
        FROM members
        WHERE member_no = $1
          AND is_dependant = false
        LIMIT 1`,
        [memberNo]
      );

      if (result.rows.length === 0) {
        logger.debug('No member found for member number', { memberNo });
        return null;
      }

      const member = result.rows[0];

      logger.debug('Found member by member number', {
        memberNo,
        memberId: member.legacy_member_id,
        status: member.member_status,
      });

      return member;

    } catch (error) {
      logger.error('Error finding member by member number', {
        memberNo,
        error: error.message,
      });
      throw new Error('Failed to lookup member by member number');
    }
  }

  /**
   * Get dependants for a member
   * Used by the Dependants tab in the app
   *
   * @param {number} legacyMemberId - Legacy member ID of the principal
   * @returns {Promise<Array>} Array of dependant records
   */
  async getDependantsForMember(legacyMemberId) {
    if (!legacyMemberId) {
      return [];
    }

    try {
      const result = await db.query(
        `SELECT
          id,
          legacy_member_id,
          member_no,
          title,
          firstname,
          surname,
          initials,
          sex,
          date_of_birth,
          member_status,
          plan,
          cellphone_no
        FROM members
        WHERE parent_legacy_id = $1
          AND is_dependant = true
        ORDER BY date_of_birth DESC`,
        [legacyMemberId]
      );

      logger.debug('Found dependants for member', {
        legacyMemberId,
        count: result.rows.length,
      });

      return result.rows;

    } catch (error) {
      logger.error('Error fetching dependants', {
        legacyMemberId,
        error: error.message,
      });
      throw new Error('Failed to fetch dependants');
    }
  }

  /**
   * Get member by legacy member ID
   * Used to fetch principal member details
   *
   * @param {number} legacyMemberId - Legacy member ID
   * @returns {Promise<Object|null>} Member record or null
   */
  async getMemberByLegacyId(legacyMemberId) {
    if (!legacyMemberId) {
      return null;
    }

    try {
      const result = await db.query(
        `SELECT
          id,
          legacy_member_id,
          member_no,
          title,
          firstname,
          surname,
          initials,
          sex,
          date_of_birth,
          date_of_joining,
          national_id_no,
          member_status,
          plan,
          company,
          cellphone_no,
          email_address,
          is_dependant
        FROM members
        WHERE legacy_member_id = $1`,
        [legacyMemberId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];

    } catch (error) {
      logger.error('Error getting member by legacy ID', {
        legacyMemberId,
        error: error.message,
      });
      throw new Error('Failed to get member by legacy ID');
    }
  }

  /**
   * Get member statistics for a company
   * Useful for admin dashboards
   *
   * @param {string} company - Company name
   * @returns {Promise<Object>} Statistics object
   */
  async getCompanyStats(company) {
    try {
      const result = await db.query(
        `SELECT
          COUNT(*) as total_members,
          COUNT(*) FILTER (WHERE is_dependant = false) as principals,
          COUNT(*) FILTER (WHERE is_dependant = true) as dependants,
          COUNT(*) FILTER (WHERE member_status = 'Active') as active,
          COUNT(*) FILTER (WHERE member_status = 'Suspended') as suspended
        FROM members
        WHERE company = $1`,
        [company]
      );

      return result.rows[0];

    } catch (error) {
      logger.error('Error getting company stats', {
        company,
        error: error.message,
      });
      throw new Error('Failed to get company statistics');
    }
  }

  /**
   * Search members (for admin functionality)
   *
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} Array of matching members
   */
  async searchMembers({
    query,
    company,
    status,
    isDependant,
    limit = 50,
    offset = 0,
  } = {}) {
    try {
      const conditions = [];
      const params = [];
      let paramCount = 1;

      if (query) {
        conditions.push(`(
          firstname ILIKE $${paramCount} OR
          surname ILIKE $${paramCount} OR
          member_no ILIKE $${paramCount} OR
          national_id_no ILIKE $${paramCount}
        )`);
        params.push(`%${query}%`);
        paramCount++;
      }

      if (company) {
        conditions.push(`company = $${paramCount}`);
        params.push(company);
        paramCount++;
      }

      if (status) {
        conditions.push(`member_status = $${paramCount}`);
        params.push(status);
        paramCount++;
      }

      if (isDependant !== undefined) {
        conditions.push(`is_dependant = $${paramCount}`);
        params.push(isDependant);
        paramCount++;
      }

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      params.push(limit, offset);

      const result = await db.query(
        `SELECT
          id,
          legacy_member_id,
          member_no,
          firstname,
          surname,
          national_id_no,
          member_status,
          plan,
          company,
          is_dependant,
          date_of_birth
        FROM members
        ${whereClause}
        ORDER BY surname, firstname
        LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
        params
      );

      return result.rows;

    } catch (error) {
      logger.error('Error searching members', { error: error.message });
      throw new Error('Failed to search members');
    }
  }

  /**
   * Check if a member's data is stale and needs refresh
   * Data is considered stale if not synced in the last 24 hours
   *
   * @param {number} legacyMemberId - Legacy member ID
   * @returns {Promise<boolean>} True if stale
   */
  async isMemberDataStale(legacyMemberId) {
    try {
      const result = await db.query(
        `SELECT synced_at FROM members WHERE legacy_member_id = $1`,
        [legacyMemberId]
      );

      if (result.rows.length === 0) {
        return true; // Member not found = stale
      }

      const syncedAt = new Date(result.rows[0].synced_at);
      const hoursSinceSync = (Date.now() - syncedAt.getTime()) / (1000 * 60 * 60);

      return hoursSinceSync > 24;

    } catch (error) {
      logger.error('Error checking member staleness', {
        legacyMemberId,
        error: error.message,
      });
      return false; // Assume not stale on error
    }
  }
}

module.exports = new MembershipService();
