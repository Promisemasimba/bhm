const logger = require('../config/logger');

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  const requestId = req.requestId || req.headers['x-request-id'];

  logger.error('Request error', {
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    error: message,
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * 404 handler
 */
function notFoundHandler(req, res) {
  const requestId = req.requestId || req.headers['x-request-id'];

  logger.warn('Route not found', {
    requestId,
    path: req.path,
    method: req.method,
  });

  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    requestId,
  });
}

module.exports = { errorHandler, notFoundHandler };
