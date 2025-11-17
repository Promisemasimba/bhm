const jwt = require('jsonwebtoken');
const User = require('../models/User');
const legacyClient = require('../clients/legacyClient');
const config = require('../config');
const logger = require('../config/logger');

class AuthService {
  /**
   * Register a new user
   * Validates against legacy system and creates app account
   */
  async registerUser(payload) {
    const { mode, idNumber, memberNumber, email, username, password } = payload;

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

    // Query legacy system based on mode
    let legacyMember;
    try {
      if (mode === 'id') {
        if (!idNumber) {
          const error = new Error('ID number is required for ID mode');
          error.status = 400;
          throw error;
        }
        legacyMember = await legacyClient.findMemberByIdNumber(idNumber);
      } else if (mode === 'memberNumber') {
        if (!memberNumber) {
          const error = new Error('Member number is required for memberNumber mode');
          error.status = 400;
          throw error;
        }
        legacyMember = await legacyClient.findMemberByMemberNumber(memberNumber);
      }
    } catch (error) {
      logger.error('Legacy system error during registration', { mode, error: error.message });
      const err = new Error('Unable to verify membership. Please try again later.');
      err.status = 503;
      throw err;
    }

    // Validate legacy member exists and is active
    if (!legacyMember) {
      const error = new Error('No active membership found with the provided information');
      error.status = 404;
      throw error;
    }

    if (legacyMember.status !== 'active' && legacyMember.status !== 'Active') {
      const error = new Error('Membership is not active. Please contact support.');
      error.status = 403;
      throw error;
    }

    // Check if this legacy member is already registered
    const existingUser = await User.findByLegacyMemberId(legacyMember.id);
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
      legacyMemberId: legacyMember.id,
      idNumber: mode === 'id' ? idNumber : legacyMember.idNumber,
      memberNumber: mode === 'memberNumber' ? memberNumber : legacyMember.memberNumber,
    });

    logger.info('User registered successfully', {
      userId: user.id,
      username: user.username,
      legacyMemberId: legacyMember.id,
    });

    // Generate JWT token
    const token = this._generateToken(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        memberNumber: legacyMember.memberNumber,
      },
      token,
    };
  }

  /**
   * Login user
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

    // Update last login
    await User.updateLastLogin(user.id);

    logger.info('User logged in successfully', {
      userId: user.id,
      username: user.username,
    });

    // Generate token
    const token = this._generateToken(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        memberNumber: user.member_number,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      token,
    };
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
   * Generate JWT token
   */
  _generateToken(user) {
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
}

module.exports = new AuthService();
