const express = require('express');
const router = express.Router();
const Joi = require('joi');
const cardRequestService = require('../services/cardRequestService');
const { validateBody, validateQuery } = require('../middleware/validation');

// Validation schemas
const listCardRequestsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
  status: Joi.string().valid('PENDING', 'APPROVED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'REJECTED', 'CANCELLED').optional(),
});

const createCardRequestSchema = Joi.object({
  requestType: Joi.string().valid('NEW', 'REPLACEMENT', 'RENEWAL').required(),
  reason: Joi.string().max(500).optional(),
  deliveryAddress: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    province: Joi.string().required(),
    postalCode: Joi.string().optional(),
  }).required(),
  contactPhone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).required(),
});

/**
 * GET /internal/v1/cards/physical-requests
 * Get user's physical card requests
 */
router.get('/physical-requests', validateQuery(listCardRequestsSchema), async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const result = await cardRequestService.getUserCardRequests(userId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /internal/v1/cards/physical-requests
 * Request a new physical card
 */
router.post('/physical-requests', validateBody(createCardRequestSchema), async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const cardRequest = await cardRequestService.createCardRequest(userId, req.body);
    res.status(201).json(cardRequest);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/v1/cards/physical-requests/:requestId
 * Get specific card request details
 */
router.get('/physical-requests/:requestId', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { requestId } = req.params;
    const cardRequest = await cardRequestService.getCardRequestById(userId, requestId);
    res.json(cardRequest);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /internal/v1/cards/physical-requests/:requestId
 * Cancel a pending card request
 */
router.delete('/physical-requests/:requestId', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { requestId } = req.params;
    const result = await cardRequestService.cancelCardRequest(userId, requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
