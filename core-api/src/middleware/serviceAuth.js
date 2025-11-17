const config = require('../config');
const logger = require('../config/logger');

/**
 * Middleware to verify requests from Cloudflare Worker
 * Checks X-Service-Auth header against shared secret
 */
function verifyServiceAuth(req, res, next) {
  const serviceAuth = req.headers['x-service-auth'];
  const requestId = req.headers['x-request-id'];

  // Log request for debugging
  logger.info('Service auth check', {
    requestId,
    path: req.path,
    method: req.method,
    hasAuth: !!serviceAuth,
  });

  if (!serviceAuth) {
    logger.warn('Missing service auth header', { requestId, path: req.path });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing service authentication',
    });
  }

  if (serviceAuth !== config.security.serviceSecret) {
    logger.warn('Invalid service auth header', { requestId, path: req.path });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid service authentication',
    });
  }

  // Attach request ID to request for logging
  req.requestId = requestId;

  next();
}

module.exports = { verifyServiceAuth };
