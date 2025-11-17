const express = require('express');
const router = express.Router();
const Joi = require('joi');
const authService = require('../services/authService');
const { validateBody } = require('../middleware/validation');
const { verifyJWT } = require('../middleware/jwtAuth');

// Validation schemas
const registerViaIdSchema = Joi.object({
  idNumber: Joi.string().required(),
  email: Joi.string().email().required(),
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(8).required(),
  mobileNumber: Joi.string().optional(),
});

const registerViaMembershipSchema = Joi.object({
  membershipNumber: Joi.string().required(),
  email: Joi.string().email().required(),
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(8).required(),
  mobileNumber: Joi.string().optional(),
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

/**
 * POST /internal/v1/auth/register/id
 * Register using national ID number
 */
router.post('/register/id', validateBody(registerViaIdSchema), async (req, res, next) => {
  try {
    const result = await authService.registerUser({
      mode: 'id',
      idNumber: req.body.idNumber,
      email: req.body.email,
      username: req.body.username,
      password: req.body.password,
      mobileNumber: req.body.mobileNumber,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /internal/v1/auth/register/membership
 * Register using membership number
 */
router.post('/register/membership', validateBody(registerViaMembershipSchema), async (req, res, next) => {
  try {
    const result = await authService.registerUser({
      mode: 'memberNumber',
      memberNumber: req.body.membershipNumber,
      email: req.body.email,
      username: req.body.username,
      password: req.body.password,
      mobileNumber: req.body.mobileNumber,
    });
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
 * POST /internal/v1/auth/refresh
 * Refresh access token
 */
router.post('/refresh', validateBody(refreshTokenSchema), async (req, res, next) => {
  try {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /internal/v1/auth/logout
 * Logout user (invalidate tokens)
 */
router.post('/logout', verifyJWT, async (req, res, next) => {
  try {
    const token = req.headers.authorization?.substring(7); // Remove 'Bearer '
    await authService.logout(req.user.sub, token);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
