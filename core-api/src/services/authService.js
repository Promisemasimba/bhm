const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const membershipService = require('./membershipService');
const db = require('../db');
const config = require('../config');
const logger = require('../config/logger');

class AuthService {
  /**
   * Register a new user
   * Validates against synced member database and creates app account
   */
  async registerUser(payload) {
    const { mode, idNumber, memberNumber, email, username, password, mobileNumber } = payload;

    // Validate required fields
    if (!mode || !email || !username || !password) {
      const error = new Error('Missing required fields');
      error.status = 400;
      throw error;
    }

    if (!['id', 'memberNumber'].includes(mode)) {
      const error = new Error('Invalid mode. Must be "id" or "memberNumber"');
      error.status = 400;
      throw error;
    }

    // Check if username or email already exists
    const [usernameExists, emailExists] = await Promise.all([
      User.usernameExists(username),
      User.emailExists(email),
    ]);

    if (usernameExists) {
      const error = new Error('Username already exists');
      error.status = 409;
      throw error;
    }

    if (emailExists) {
      const error = new Error('Email already exists');
      error.status = 409;
      throw error;
    }

    // Query synced member database based on mode
    let member;
    try {
      if (mode === 'id') {
        if (!idNumber) {
          const error = new Error('ID number is required for ID mode');
          error.status = 400;
          throw error;
        }
        member = await membershipService.findMemberByNationalId(idNumber);
      } else if (mode === 'memberNumber') {
        if (!memberNumber) {
          const error = new Error('Member number is required for memberNumber mode');
          error.status = 400;
          throw error;
        }
        member = await membershipService.findMemberByMemberNo(memberNumber);
      }
    } catch (error) {
      logger.error('Database error during registration', { mode, error: error.message });
      const err = new Error('Unable to verify membership. Please try again later.');
      err.status = 503;
      throw err;
    }

    // Validate member exists and is active
    if (!member) {
      const error = new Error('No active membership found with the provided information');
      error.status = 404;
      throw error;
    }

    if (member.member_status !== 'Active') {
      const error = new Error(`Membership is not active (status: ${member.member_status}). Please contact support.`);
      error.status = 403;
      throw error;
    }

    // Check if this legacy member is already registered
    const existingUser = await User.findByLegacyMemberId(member.legacy_member_id.toString());
    if (existingUser) {
      const error = new Error('This membership is already registered. Please login instead.');
      error.status = 409;
      throw error;
    }

    // Create user account
    const user = await User.create({
      username,
      email,
      password,
      legacyMemberId: member.legacy_member_id.toString(),
      idNumber: member.national_id_no,
      memberNumber: member.member_no,
    });

    logger.info('User registered successfully', {
      userId: user.id,
      username: user.username,
      legacyMemberId: member.legacy_member_id,
      memberNo: member.member_no,
    });

    // Return BasicUser format (matching OpenAPI spec)
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: `${member.firstname || ''} ${member.surname || ''}`.trim(),
      idNumber: member.national_id_no,
      membershipNumber: member.member_no,
      mobileNumber: mobileNumber || member.cellphone_no || null,
      status: 'ACTIVE',
    };
  }

  /**
   * Login user
   * Returns tokens and user info matching OpenAPI LoginResponse schema
   */
  async loginUser({ username, password }) {
    if (!username || !password) {
      const error = new Error('Username and password are required');
      error.status = 400;
      throw error;
    }

    // Find user by username
    const user = await User.findByUsername(username);

    if (!user) {
      const error = new Error('Invalid credentials');
      error.status = 401;
      throw error;
    }

    // Verify password
    const validPassword = await User.verifyPassword(password, user.password_hash);

    if (!validPassword) {
      logger.warn('Failed login attempt', { username });
      const error = new Error('Invalid credentials');
      error.status = 401;
      throw error;
    }

    // Get member details from synced database
    const member = await membershipService.getMemberByLegacyId(parseInt(user.legacy_member_id, 10));

    // Update last login
    await User.updateLastLogin(user.id);

    logger.info('User logged in successfully', {
      userId: user.id,
      username: user.username,
    });

    // Generate tokens
    const accessToken = this._generateAccessToken(user);
    const refreshToken = await this._generateRefreshToken(user);

    // Return format matching OpenAPI LoginResponse
    return {
      tokens: {
        tokenType: 'Bearer',
        accessToken,
        refreshToken,
        expiresIn: 3600, // 1 hour in seconds
      },
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: `${user.first_name || member?.firstname || ''} ${user.last_name || member?.surname || ''}`.trim(),
        idNumber: user.id_number || member?.national_id_no,
        membershipNumber: user.member_number || member?.member_no,
        mobileNumber: member?.cellphone_no || null,
        status: 'ACTIVE',
      },
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken) {
    if (!refreshToken) {
      const error = new Error('Refresh token is required');
      error.status = 400;
      throw error;
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.security.jwtSecret);

      // Check if refresh token exists in database and is not expired
      const sessionResult = await db.query(
        `SELECT * FROM user_sessions
         WHERE refresh_token = $1 AND user_id = $2 AND expires_at > NOW()`,
        [refreshToken, decoded.sub]
      );

      if (sessionResult.rows.length === 0) {
        const error = new Error('Invalid or expired refresh token');
        error.status = 401;
        throw error;
      }

      // Get user
      const user = await User.findById(decoded.sub);

      if (!user) {
        const error = new Error('User not found');
        error.status = 401;
        throw error;
      }

      // Generate new access token
      const accessToken = this._generateAccessToken(user);

      // Optionally generate new refresh token (refresh token rotation)
      const newRefreshToken = await this._generateRefreshToken(user);

      // Invalidate old refresh token
      await db.query(
        'DELETE FROM user_sessions WHERE refresh_token = $1',
        [refreshToken]
      );

      logger.info('Token refreshed', { userId: user.id });

      return {
        tokenType: 'Bearer',
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600,
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
        const err = new Error('Invalid or expired refresh token');
        err.status = 401;
        throw err;
      }
      throw error;
    }
  }

  /**
   * Logout user (invalidate all sessions)
   */
  async logout(userId, accessToken) {
    try {
      // Delete all refresh tokens for this user
      await db.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);

      logger.info('User logged out', { userId });
    } catch (error) {
      logger.error('Logout error', { userId, error: error.message });
      throw new Error('Failed to logout');
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, config.security.jwtSecret);
      return decoded;
    } catch (error) {
      logger.warn('Invalid token', { error: error.message });
      return null;
    }
  }

  /**
   * Generate access token (JWT)
   */
  _generateAccessToken(user) {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      legacyMemberId: user.legacy_member_id,
    };

    return jwt.sign(payload, config.security.jwtSecret, {
      expiresIn: config.security.jwtExpiry,
      issuer: 'bhm-core-api',
      audience: 'bhm-mobile-app',
    });
  }

  /**
   * Generate refresh token and store in database
   */
  async _generateRefreshToken(user) {
    const refreshToken = crypto.randomBytes(40).toString('hex');

    // Hash the refresh token before storing
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Store in database with 30-day expiry
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO user_sessions (user_id, refresh_token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    // Return the signed JWT containing the refresh token
    return jwt.sign(
      {
        sub: user.id,
        type: 'refresh',
        jti: tokenHash,
      },
      config.security.jwtSecret,
      {
        expiresIn: '30d',
        issuer: 'bhm-core-api',
        audience: 'bhm-mobile-app',
      }
    );
  }
}

module.exports = new AuthService();
