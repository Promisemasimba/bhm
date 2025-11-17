const express = require('express');
const router = express.Router();
const Joi = require('joi');
const memberService = require('../services/memberService');
const User = require('../models/User');
const membershipService = require('../services/membershipService');
const { validateBody } = require('../middleware/validation');

// Validation schema for PATCH /me
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(1).max(100).optional(),
  lastName: Joi.string().min(1).max(100).optional(),
  phoneNumber: Joi.string().pattern(/^\+?[0-9]{10,15}$/).optional(),
  dateOfBirth: Joi.date().iso().optional(),
  profileImageUrl: Joi.string().uri().optional(),
  notificationPreferences: Joi.object({
    email: Joi.boolean().optional(),
    push: Joi.boolean().optional(),
    sms: Joi.boolean().optional(),
  }).optional(),
});

/**
 * GET /internal/v1/me
 * Get current user profile
 */
router.get('/me', async (req, res, next) => {
  try {
    const userId = req.user.sub; // From JWT payload
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    // Get member details from synced database
    const member = await membershipService.getMemberByLegacyId(
      parseInt(user.legacy_member_id, 10)
    );

    // Return user profile in OpenAPI format
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name || member?.firstname || null,
      lastName: user.last_name || member?.surname || null,
      fullName: `${user.first_name || member?.firstname || ''} ${user.last_name || member?.surname || ''}`.trim(),
      idNumber: user.id_number || member?.national_id_no || null,
      membershipNumber: user.member_number || member?.member_no || null,
      phoneNumber: user.phone_number || member?.cellphone_no || null,
      dateOfBirth: user.date_of_birth || member?.date_of_birth || null,
      profileImageUrl: user.profile_image_url || null,
      notificationPreferences: user.notification_preferences || {
        email: true,
        push: true,
        sms: false,
      },
      status: user.is_active ? 'ACTIVE' : 'INACTIVE',
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /internal/v1/me
 * Update current user profile
 */
router.patch('/me', validateBody(updateProfileSchema), async (req, res, next) => {
  try {
    const userId = req.user.sub;

    // Transform camelCase to snake_case for database
    const profileData = {};
    if (req.body.firstName !== undefined) profileData.first_name = req.body.firstName;
    if (req.body.lastName !== undefined) profileData.last_name = req.body.lastName;
    if (req.body.phoneNumber !== undefined) profileData.phone_number = req.body.phoneNumber;
    if (req.body.dateOfBirth !== undefined) profileData.date_of_birth = req.body.dateOfBirth;
    if (req.body.profileImageUrl !== undefined) profileData.profile_image_url = req.body.profileImageUrl;
    if (req.body.notificationPreferences !== undefined) {
      profileData.notification_preferences = req.body.notificationPreferences;
    }

    // Update profile
    await User.updateProfile(userId, profileData);

    // Fetch updated user
    const user = await User.findById(userId);
    const member = await membershipService.getMemberByLegacyId(
      parseInt(user.legacy_member_id, 10)
    );

    // Return updated profile
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name || member?.firstname || null,
      lastName: user.last_name || member?.surname || null,
      fullName: `${user.first_name || member?.firstname || ''} ${user.last_name || member?.surname || ''}`.trim(),
      idNumber: user.id_number || member?.national_id_no || null,
      membershipNumber: user.member_number || member?.member_no || null,
      phoneNumber: user.phone_number || member?.cellphone_no || null,
      dateOfBirth: user.date_of_birth || member?.date_of_birth || null,
      profileImageUrl: user.profile_image_url || null,
      notificationPreferences: user.notification_preferences || {
        email: true,
        push: true,
        sms: false,
      },
      status: user.is_active ? 'ACTIVE' : 'INACTIVE',
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/v1/packages/current
 * Get current package/plan information
 */
router.get('/packages/current', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    // Get member details from synced database
    const member = await membershipService.getMemberByLegacyId(
      parseInt(user.legacy_member_id, 10)
    );

    if (!member) {
      const error = new Error('Member not found');
      error.status = 404;
      throw error;
    }

    // For detailed plan information, we need to query the legacy system
    // In a production system, this data would be cached in Worker KV
    const legacyClient = require('../clients/legacyClient');
    const memberDetails = await legacyClient.getMemberDetails(user.legacy_member_id);

    // Return package information in OpenAPI format
    res.json({
      id: memberDetails.plan?.id || member.plan || 'unknown',
      name: memberDetails.plan?.name || member.plan || 'Standard Plan',
      description: memberDetails.plan?.description || `Healthcare package for ${member.firstname} ${member.surname}`,
      status: member.member_status === 'Active' ? 'ACTIVE' : 'INACTIVE',
      effectiveDate: member.date_of_joining || null,
      expiryDate: null, // Most plans don't have expiry, they're ongoing
      benefits: memberDetails.plan?.benefits || [
        {
          id: 'gp-consultation',
          name: 'GP Consultation',
          description: 'General practitioner visits',
          limit: 'Unlimited',
          coverage: '100%',
        },
        {
          id: 'specialist',
          name: 'Specialist Consultation',
          description: 'Specialist doctor visits',
          limit: 'Subject to referral',
          coverage: '100%',
        },
        {
          id: 'hospitalization',
          name: 'Hospitalization',
          description: 'In-patient hospital care',
          limit: 'As per plan',
          coverage: '100%',
        },
        {
          id: 'pharmacy',
          name: 'Pharmacy Benefits',
          description: 'Prescription medications',
          limit: 'As per formulary',
          coverage: '100%',
        },
      ],
      coverage: {
        annual: memberDetails.coverage?.annual || 'Unlimited',
        perVisit: memberDetails.coverage?.perVisit || 'As per tariff',
        copayment: memberDetails.coverage?.copayment || '0%',
      },
      memberCount: 1, // Will be updated once dependants are fetched
      primaryMember: {
        id: user.id,
        name: `${member.firstname} ${member.surname}`,
        membershipNumber: member.member_no,
      },
    });
  } catch (err) {
    next(err);
  }
});

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
