const express = require('express');
const router = express.Router();
const Joi = require('joi');
const providerService = require('../services/providerService');
const { validateQuery } = require('../middleware/validation');

// Validation schema
const searchSchema = Joi.object({
  query: Joi.string().optional(),
  location: Joi.string().optional(),
  type: Joi.string().optional(),
  specialty: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

/**
 * GET /internal/v1/providers/search
 * Search for healthcare providers
 */
router.get('/search', validateQuery(searchSchema), async (req, res, next) => {
  try {
    const result = await providerService.searchProviders(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/v1/providers/:id
 * Get provider details by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const provider = await providerService.getProviderById(req.params.id);
    res.json(provider);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
