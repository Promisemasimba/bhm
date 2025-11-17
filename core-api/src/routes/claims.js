const express = require('express');
const router = express.Router();
const Joi = require('joi');
const claimService = require('../services/claimService');
const { validateBody, validateQuery } = require('../middleware/validation');

// Validation schemas
const listClaimsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
  status: Joi.string().valid('pending', 'approved', 'rejected', 'processing').optional(),
});

const submitClaimSchema = Joi.object({
  type: Joi.string().required(),
  providerId: Joi.string().optional(),
  providerName: Joi.string().required(),
  serviceDate: Joi.date().iso().required(),
  amount: Joi.number().positive().required(),
  description: Joi.string().max(500).optional(),
  diagnosisCode: Joi.string().optional(),
});

const uploadUrlSchema = Joi.object({
  fileName: Joi.string().required(),
  fileType: Joi.string().valid('application/pdf', 'image/jpeg', 'image/jpg', 'image/png').required(),
  fileSize: Joi.number().integer().positive().required(),
});

const recordDocumentSchema = Joi.object({
  documentType: Joi.string().required(),
  fileName: Joi.string().required(),
  fileUrl: Joi.string().uri().required(),
  fileSize: Joi.number().integer().positive().required(),
  mimeType: Joi.string().required(),
});

/**
 * GET /internal/v1/claims
 * Get user's claims
 */
router.get('/', validateQuery(listClaimsSchema), async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const result = await claimService.getUserClaims(userId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/v1/claims/:claimId
 * Get specific claim by ID
 */
router.get('/:claimId', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { claimId } = req.params;
    const claim = await claimService.getClaimById(userId, claimId);
    res.json(claim);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /internal/v1/claims
 * Submit a new claim
 */
router.post('/', validateBody(submitClaimSchema), async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const claim = await claimService.submitClaim(userId, req.body);
    res.status(201).json(claim);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /internal/v1/claims/:claimId/upload-url
 * Get upload URL for claim document
 */
router.post('/:claimId/upload-url', validateBody(uploadUrlSchema), async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { claimId } = req.params;
    const uploadInfo = await claimService.getUploadUrl(userId, claimId, req.body);
    res.json(uploadInfo);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /internal/v1/claims/:claimId/documents
 * Record uploaded document metadata
 */
router.post('/:claimId/documents', validateBody(recordDocumentSchema), async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { claimId } = req.params;
    const document = await claimService.recordDocument(userId, claimId, req.body);
    res.status(201).json(document);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
