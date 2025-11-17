const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const logger = require('./config/logger');
const { verifyServiceAuth } = require('./middleware/serviceAuth');
const { verifyJWT } = require('./middleware/jwtAuth');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const memberRoutes = require('./routes/member');
const providerRoutes = require('./routes/providers');
const claimRoutes = require('./routes/claims');
const supportRoutes = require('./routes/support');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.cors.origin || '*',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
  req.requestId = requestId;

  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  next();
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// All internal routes require service authentication
app.use('/internal/v1', verifyServiceAuth);

// Auth routes (no JWT required)
app.use('/internal/v1/auth', authRoutes);

// Protected routes (require JWT)
app.use('/internal/v1', verifyJWT);
app.use('/internal/v1', memberRoutes);
app.use('/internal/v1/providers', providerRoutes);
app.use('/internal/v1/claims', claimRoutes);
app.use('/internal/v1/support', supportRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  logger.info(`Budget Health Management Core API listening on port ${PORT}`, {
    environment: config.env,
    nodeVersion: process.version,
  });

  // Log startup configuration (without sensitive data)
  logger.info('Configuration loaded', {
    port: PORT,
    environment: config.env,
    logLevel: config.logging.level,
    corsOrigin: config.cors.origin,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

module.exports = app;
