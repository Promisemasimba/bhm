const express = require('express');
const router = express.Router();
const Joi = require('joi');
const supportQueryService = require('../services/supportQueryService');
const { validateBody, validateQuery } = require('../middleware/validation');

// Validation schemas
const listQueriesSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
  status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED').optional(),
  category: Joi.string().valid('BILLING', 'CLAIMS', 'COVERAGE', 'TECHNICAL', 'ACCOUNT', 'GENERAL', 'COMPLAINT').optional(),
});

const createQuerySchema = Joi.object({
  subject: Joi.string().min(1).max(255).required(),
  category: Joi.string().valid('BILLING', 'CLAIMS', 'COVERAGE', 'TECHNICAL', 'ACCOUNT', 'GENERAL', 'COMPLAINT').required(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional(),
  description: Joi.string().min(10).required(),
});

const addMessageSchema = Joi.object({
  message: Joi.string().min(1).required(),
  attachments: Joi.array().items(
    Joi.object({
      filename: Joi.string().required(),
      url: Joi.string().uri().required(),
      size: Joi.number().integer().positive().optional(),
    })
  ).optional(),
});

/**
 * GET /internal/v1/support/contact-options
 * Get available support contact options
 */
router.get('/contact-options', async (req, res, next) => {
  try {
    // Return support contact options in OpenAPI format
    // In production, this could be fetched from a database or config
    res.json({
      phone: {
        primary: '+263 4 123456',
        tollfree: '0800 123 456',
        whatsapp: '+263 77 123 4567',
        available: '24/7',
        description: 'Call our support team for immediate assistance',
      },
      email: {
        general: 'support@budgethealth.co.zw',
        claims: 'claims@budgethealth.co.zw',
        emergencies: 'emergency@budgethealth.co.zw',
        responseTime: 'Within 24 hours',
        description: 'Email us for non-urgent queries',
      },
      onlineChat: {
        available: true,
        hours: 'Monday - Friday: 8:00 AM - 5:00 PM',
        url: 'https://support.budgethealth.co.zw/chat',
        description: 'Chat with a support agent in real-time',
      },
      office: {
        address: '123 Healthcare Avenue, Harare, Zimbabwe',
        hours: 'Monday - Friday: 8:00 AM - 5:00 PM',
        saturday: '8:00 AM - 12:00 PM',
        sunday: 'Closed',
        description: 'Visit our offices for in-person assistance',
      },
      emergency: {
        phone: '999',
        ambulance: '+263 4 654321',
        available: '24/7',
        description: 'For medical emergencies, call immediately',
      },
      resources: [
        {
          id: 'faq',
          title: 'Frequently Asked Questions',
          url: 'https://www.budgethealth.co.zw/faq',
          description: 'Find answers to common questions',
        },
        {
          id: 'claims-guide',
          title: 'Claims Submission Guide',
          url: 'https://www.budgethealth.co.zw/guides/claims',
          description: 'Step-by-step guide for submitting claims',
        },
        {
          id: 'provider-network',
          title: 'Provider Network Directory',
          url: 'https://www.budgethealth.co.zw/providers',
          description: 'Browse our network of healthcare providers',
        },
        {
          id: 'member-handbook',
          title: 'Member Handbook',
          url: 'https://www.budgethealth.co.zw/handbook',
          description: 'Complete guide to your benefits',
        },
      ],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/v1/support/queries
 * List user's support queries
 */
router.get('/queries', validateQuery(listQueriesSchema), async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const result = await supportQueryService.getUserQueries(userId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /internal/v1/support/queries
 * Create a new support query
 */
router.post('/queries', validateBody(createQuerySchema), async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const query = await supportQueryService.createQuery(userId, req.body);
    res.status(201).json(query);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/v1/support/queries/:queryId
 * Get specific support query with messages
 */
router.get('/queries/:queryId', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { queryId } = req.params;
    const query = await supportQueryService.getQueryById(userId, queryId);
    res.json(query);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /internal/v1/support/queries/:queryId/messages
 * Add a message to a support query
 */
router.post('/queries/:queryId/messages', validateBody(addMessageSchema), async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { queryId } = req.params;
    const message = await supportQueryService.addMessage(userId, queryId, req.body);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /internal/v1/support/queries/:queryId
 * Close a support query
 */
router.delete('/queries/:queryId', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { queryId } = req.params;
    const result = await supportQueryService.closeQuery(userId, queryId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
