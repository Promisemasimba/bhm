const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../config/logger');

/**
 * Middleware to verify JWT token from Worker
 * Extracts token from Authorization header and validates it
 */
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid authorization header', {
      requestId: req.requestId,
      path: req.path,
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header',
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, config.security.jwtSecret);

    // Attach user info to request
    req.user = decoded;

    logger.debug('JWT verified', {
      requestId: req.requestId,
      userId: decoded.sub,
      username: decoded.username,
    });

    next();
  } catch (error) {
    logger.warn('Invalid JWT token', {
      requestId: req.requestId,
      error: error.message,
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

module.exports = { verifyJWT };
