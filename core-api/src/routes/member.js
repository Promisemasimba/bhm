const express = require('express');
const router = express.Router();
const memberService = require('../services/memberService');

/**
 * GET /internal/v1/home
 * Get home dashboard data
 */
router.get('/home', async (req, res, next) => {
  try {
    const userId = req.user.sub; // From JWT payload
    const dashboard = await memberService.getHomeDashboard(userId);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/v1/card
 * Get digital card information
 */
router.get('/card', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const card = await memberService.getDigitalCard(userId);
    res.json(card);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/v1/dependants
 * Get list of dependants
 */
router.get('/dependants', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const dependants = await memberService.getDependants(userId);
    res.json(dependants);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/v1/membership-certificate
 * Get membership certificate
 */
router.get('/membership-certificate', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const certificate = await memberService.getMembershipCertificate(userId);
    res.json(certificate);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
