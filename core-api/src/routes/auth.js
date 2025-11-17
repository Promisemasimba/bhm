const express = require('express');
const router = express.Router();
const Joi = require('joi');
const authService = require('../services/authService');
const { validateBody } = require('../middleware/validation');

// Validation schemas
const registerSchema = Joi.object({
  mode: Joi.string().valid('id', 'memberNumber').required(),
  idNumber: Joi.string().when('mode', {
    is: 'id',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  memberNumber: Joi.string().when('mode', {
    is: 'memberNumber',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  email: Joi.string().email().required(),
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(8).required(),
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

/**
 * POST /internal/v1/auth/register
 * Register a new user
 */
router.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /internal/v1/auth/login
 * Login user
 */
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.loginUser(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /internal/v1/auth/verify
 * Verify JWT token
 */
router.post('/verify', async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const decoded = authService.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ valid: false, error: 'Invalid or expired token' });
    }

    res.json({
      valid: true,
      payload: decoded,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
