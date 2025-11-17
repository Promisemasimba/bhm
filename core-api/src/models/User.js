const db = require('../db');
const bcrypt = require('bcryptjs');

class User {
  /**
   * Create a new user
   */
  static async create({ username, email, password, legacyMemberId, idNumber, memberNumber }) {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, legacy_member_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, legacy_member_id, is_active, created_at`,
      [username, email, passwordHash, legacyMemberId]
    );

    const user = result.rows[0];

    // Create profile with additional info
    if (idNumber || memberNumber) {
      await db.query(
        `INSERT INTO user_profiles (user_id, id_number, member_number)
         VALUES ($1, $2, $3)`,
        [user.id, idNumber, memberNumber]
      );
    }

    return user;
  }

  /**
   * Find user by username
   */
  static async findByUsername(username) {
    const result = await db.query(
      `SELECT u.*, up.first_name, up.last_name, up.phone_number, up.id_number, up.member_number
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE u.username = $1 AND u.is_active = true`,
      [username]
    );

    return result.rows[0];
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const result = await db.query(
      `SELECT u.*, up.first_name, up.last_name, up.phone_number, up.id_number, up.member_number
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );

    return result.rows[0];
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const result = await db.query(
      `SELECT u.*, up.first_name, up.last_name, up.phone_number, up.id_number, up.member_number,
              up.notification_preferences, up.profile_image_url
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE u.id = $1 AND u.is_active = true`,
      [id]
    );

    return result.rows[0];
  }

  /**
   * Find user by legacy member ID
   */
  static async findByLegacyMemberId(legacyMemberId) {
    const result = await db.query(
      `SELECT u.*, up.first_name, up.last_name, up.phone_number, up.id_number, up.member_number
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE u.legacy_member_id = $1 AND u.is_active = true`,
      [legacyMemberId]
    );

    return result.rows[0];
  }

  /**
   * Verify password
   */
  static async verifyPassword(plainPassword, passwordHash) {
    return bcrypt.compare(plainPassword, passwordHash);
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(userId) {
    await db.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId, profileData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'first_name',
      'last_name',
      'phone_number',
      'date_of_birth',
      'profile_image_url',
      'notification_preferences',
    ];

    for (const field of allowedFields) {
      if (profileData[field] !== undefined) {
        fields.push(`${field} = $${paramCount}`);
        values.push(profileData[field]);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(userId);

    const result = await db.query(
      `UPDATE user_profiles
       SET ${fields.join(', ')}
       WHERE user_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Check if username exists
   */
  static async usernameExists(username) {
    const result = await db.query(
      'SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)',
      [username]
    );
    return result.rows[0].exists;
  }

  /**
   * Check if email exists
   */
  static async emailExists(email) {
    const result = await db.query(
      'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)',
      [email]
    );
    return result.rows[0].exists;
  }
}

module.exports = User;
