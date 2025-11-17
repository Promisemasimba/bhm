/**
 * Budget Health Management - Cloudflare Worker
 * Edge API Gateway for mobile app
 */

import { handleAuth } from './handlers/auth';
import { handleUser } from './handlers/user';
import { handleHome } from './handlers/home';
import { handleCard } from './handlers/card';
import { handleCardRequests } from './handlers/cardRequests';
import { handleDependants } from './handlers/dependants';
import { handleProviders } from './handlers/providers';
import { handleClaims } from './handlers/claims';
import { handleCertificate } from './handlers/certificate';
import { handleSupport } from './handlers/support';
import { verifyJWT, extractToken } from './utils/jwt';
import { createResponse, errorResponse } from './utils/response';
import { RateLimiter } from './utils/rateLimiter';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Generate request ID for tracing
    const requestId = crypto.randomUUID();

    // Add CORS headers
    if (method === 'OPTIONS') {
      return handleCORS(request);
    }

    try {
      // Health check (no auth required)
      if (path === '/health' || path === '/api/health') {
        return createResponse({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          worker: 'bhm-api',
          version: '1.0.0',
        });
      }

      // Rate limiting
      const rateLimitResult = await checkRateLimit(request, env);
      if (!rateLimitResult.allowed) {
        return errorResponse('Too many requests', 429, requestId);
      }

      // Router
      const route = `${method} ${path}`;

      // Authentication endpoints (no JWT required)
      if (path === '/api/auth/register/id' && method === 'POST') {
        return handleAuth.registerById(request, env, requestId);
      }

      if (path === '/api/auth/register/membership' && method === 'POST') {
        return handleAuth.registerByMembership(request, env, requestId);
      }

      if (path === '/api/auth/login' && method === 'POST') {
        return handleAuth.login(request, env, requestId);
      }

      if (path === '/api/auth/refresh' && method === 'POST') {
        return handleAuth.refresh(request, env, requestId);
      }

      // Protected endpoints (JWT required)
      const token = extractToken(request);
      if (!token) {
        return errorResponse('Missing authorization token', 401, requestId);
      }

      // Verify JWT (we trust our Core API's tokens)
      // In production, you might want to verify the token here or forward to Core API
      // For now, we'll just extract it and pass it along

      // Logout (requires JWT)
      if (path === '/api/auth/logout' && method === 'POST') {
        return handleAuth.logout(request, env, requestId, token);
      }

      // User profile
      if (path === '/api/me' && method === 'GET') {
        return handleUser.getProfile(request, env, requestId, token);
      }

      if (path === '/api/me' && method === 'PATCH') {
        return handleUser.updateProfile(request, env, requestId, token);
      }

      // Package information
      if (path === '/api/packages/current' && method === 'GET') {
        return handleUser.getCurrentPackage(request, env, requestId, token);
      }

      // Home dashboard
      if (path === '/api/home' && method === 'GET') {
        return handleHome(request, env, requestId, token);
      }

      // Digital card
      if (path === '/api/card' && method === 'GET') {
        return handleCard(request, env, requestId, token);
      }

      // Physical card requests
      if (path === '/api/cards/physical-requests' && method === 'GET') {
        return handleCardRequests.list(request, env, requestId, token);
      }

      if (path === '/api/cards/physical-requests' && method === 'POST') {
        return handleCardRequests.create(request, env, requestId, token);
      }

      if (path.match(/^\/api\/cards\/physical-requests\/[^/]+$/) && method === 'GET') {
        const cardRequestId = path.split('/')[4];
        return handleCardRequests.getById(request, env, requestId, token, cardRequestId);
      }

      if (path.match(/^\/api\/cards\/physical-requests\/[^/]+$/) && method === 'DELETE') {
        const cardRequestId = path.split('/')[4];
        return handleCardRequests.cancel(request, env, requestId, token, cardRequestId);
      }

      // Dependants
      if (path === '/api/dependants' && method === 'GET') {
        return handleDependants(request, env, requestId, token);
      }

      // Provider search
      if (path === '/api/providers/search' && method === 'GET') {
        return handleProviders.search(request, env, requestId, token);
      }

      // Claims
      if (path === '/api/claims' && method === 'GET') {
        return handleClaims.list(request, env, requestId, token);
      }

      if (path === '/api/claims' && method === 'POST') {
        return handleClaims.submit(request, env, requestId, token);
      }

      // Claim upload URL
      if (path.match(/^\/api\/claims\/[^/]+\/upload$/) && method === 'POST') {
        const claimId = path.split('/')[3];
        return handleClaims.getUploadUrl(request, env, requestId, token, claimId);
      }

      // Membership certificate
      if (path === '/api/membership-certificate' && method === 'GET') {
        return handleCertificate(request, env, requestId, token);
      }

      // Support
      if (path === '/api/support/contact-options' && method === 'GET') {
        return handleSupport.getContactOptions(request, env, requestId, token);
      }

      // 404 Not Found
      return errorResponse('Not found', 404, requestId);

    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse(
        'Internal server error',
        500,
        requestId,
        env.ENVIRONMENT === 'development' ? error.message : undefined
      );
    }
  },
};

/**
 * Handle CORS preflight
 */
function handleCORS(request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Check rate limiting
 * In production, this would use Durable Objects or KV for distributed rate limiting
 */
async function checkRateLimit(request, env) {
  // Simple in-memory rate limiting (resets on worker restart)
  // In production, use Durable Objects or KV for persistent rate limiting

  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

  // For now, allow all requests
  // TODO: Implement proper rate limiting with Durable Objects

  return {
    allowed: true,
    remaining: 100,
    reset: Date.now() + 60000,
  };
}
