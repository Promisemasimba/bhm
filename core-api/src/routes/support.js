const express = require('express');
const router = express.Router();

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

module.exports = router;
