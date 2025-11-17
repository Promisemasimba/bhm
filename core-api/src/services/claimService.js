const User = require('../models/User');
const legacyClient = require('../clients/legacyClient');
const db = require('../db');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class ClaimService {
  /**
   * Get user's claims with pagination
   * Returns OpenAPI-compliant paginated response
   */
  async getUserClaims(userId, { limit = 50, offset = 0, status } = {}) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      // Fetch from legacy system
      const claims = await legacyClient.getMemberClaims(user.legacy_member_id);

      // Cache claims locally
      await this._cacheClaims(userId, claims);

      // Filter by status if provided
      let filteredClaims = claims;
      if (status) {
        filteredClaims = claims.filter(c => c.status === status);
      }

      // Apply pagination
      const paginatedClaims = filteredClaims.slice(offset, offset + limit);
      const total = filteredClaims.length;

      // Return OpenAPI-compliant paginated response
      return {
        data: paginatedClaims.map(claim => ({
          id: claim.id,
          claimNumber: claim.claimNumber,
          type: claim.type,
          provider: claim.provider,
          date: claim.date,
          amount: claim.amount,
          status: claim.status.toUpperCase(),
          description: claim.description,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    } catch (error) {
      logger.error('Error fetching claims', { userId, error: error.message });

      // Fallback to local cache
      return this._getLocalClaims(userId, { limit, offset, status });
    }
  }

  /**
   * Get specific claim by ID
   */
  async getClaimById(userId, claimId) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      // First try to get from local cache
      const cachedClaim = await this._getLocalClaim(userId, claimId);

      if (cachedClaim) {
        return cachedClaim;
      }

      // If not in cache, fetch from legacy system
      const claims = await legacyClient.getMemberClaims(user.legacy_member_id);
      const claim = claims.find(c => c.id === claimId || c.claimNumber === claimId);

      if (!claim) {
        const error = new Error('Claim not found');
        error.status = 404;
        throw error;
      }

      // Cache it for future use
      await this._cacheClaimLocal(userId, claim);

      return {
        id: claim.id,
        claimNumber: claim.claimNumber,
        type: claim.type,
        provider: claim.provider,
        date: claim.date,
        amount: claim.amount,
        status: claim.status.toUpperCase(),
        description: claim.description,
        documents: claim.documents || [],
      };
    } catch (error) {
      if (error.status === 404) {
        throw error;
      }
      logger.error('Error fetching claim', { userId, claimId, error: error.message });
      throw new Error('Failed to fetch claim details');
    }
  }

  /**
   * Submit a new claim
   */
  async submitClaim(userId, claimData) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      // Prepare claim data for legacy system
      const legacyClaimData = {
        member_id: user.legacy_member_id,
        type: claimData.type,
        provider_id: claimData.providerId,
        provider_name: claimData.providerName,
        service_date: claimData.serviceDate,
        amount: claimData.amount,
        description: claimData.description,
        diagnosis_code: claimData.diagnosisCode,
      };

      // Submit to legacy system
      const createdClaim = await legacyClient.submitClaim(legacyClaimData);

      // Cache locally
      await this._cacheClaimLocal(userId, createdClaim);

      logger.info('Claim submitted successfully', {
        userId,
        claimId: createdClaim.id,
        claimNumber: createdClaim.claimNumber,
      });

      return createdClaim;
    } catch (error) {
      logger.error('Error submitting claim', { userId, error: error.message });
      throw new Error('Failed to submit claim');
    }
  }

  /**
   * Get upload URL for claim document
   * In production, this would generate a signed URL for S3/Cloud Storage
   */
  async getUploadUrl(userId, claimId, { fileName, fileType, fileSize }) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileSize > maxSize) {
      const error = new Error('File size exceeds maximum allowed (10MB)');
      error.status = 400;
      throw error;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(fileType)) {
      const error = new Error('Invalid file type. Allowed: PDF, JPG, PNG');
      error.status = 400;
      throw error;
    }

    // Generate unique file key
    const fileKey = `claims/${userId}/${claimId}/${uuidv4()}-${fileName}`;

    // In production, generate signed S3/Cloud Storage URL
    // For now, return a mock URL
    const uploadUrl = `https://storage.example.com/upload?key=${encodeURIComponent(fileKey)}`;

    logger.info('Generated upload URL', { userId, claimId, fileKey });

    return {
      uploadUrl,
      fileKey,
      expiresIn: 3600, // 1 hour
      method: 'PUT',
      headers: {
        'Content-Type': fileType,
      },
    };
  }

  /**
   * Record uploaded document metadata
   */
  async recordDocument(userId, claimId, documentData) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    // Get the local claim
    const claimResult = await db.query(
      'SELECT id FROM claims WHERE user_id = $1 AND (id = $2 OR legacy_claim_id = $2)',
      [userId, claimId]
    );

    if (claimResult.rows.length === 0) {
      const error = new Error('Claim not found');
      error.status = 404;
      throw error;
    }

    const localClaimId = claimResult.rows[0].id;

    // Insert document record
    const result = await db.query(
      `INSERT INTO claim_documents (claim_id, document_type, file_name, file_url, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        localClaimId,
        documentData.documentType,
        documentData.fileName,
        documentData.fileUrl,
        documentData.fileSize,
        documentData.mimeType,
      ]
    );

    logger.info('Document recorded', {
      userId,
      claimId,
      documentId: result.rows[0].id,
    });

    return result.rows[0];
  }

  /**
   * Cache claims in local database
   */
  async _cacheClaims(userId, claims) {
    if (!claims || claims.length === 0) {
      return;
    }

    try {
      for (const claim of claims) {
        await db.query(
          `INSERT INTO claims (
            user_id, legacy_claim_id, claim_number, claim_type, provider_name,
            claim_date, amount, status, description
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (claim_number)
          DO UPDATE SET
            status = EXCLUDED.status,
            updated_at = CURRENT_TIMESTAMP`,
          [
            userId,
            claim.id,
            claim.claimNumber,
            claim.type,
            claim.provider,
            claim.date,
            claim.amount,
            claim.status,
            claim.description,
          ]
        );
      }

      logger.debug('Cached claims', { userId, count: claims.length });
    } catch (error) {
      logger.error('Error caching claims', { userId, error: error.message });
    }
  }

  /**
   * Cache single claim locally
   */
  async _cacheClaimLocal(userId, claim) {
    try {
      await db.query(
        `INSERT INTO claims (
          user_id, legacy_claim_id, claim_number, claim_type, provider_name,
          claim_date, amount, status, description
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (claim_number)
        DO UPDATE SET
          status = EXCLUDED.status,
          amount = EXCLUDED.amount,
          updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          claim.id,
          claim.claimNumber,
          claim.type,
          claim.provider,
          claim.date,
          claim.amount,
          claim.status,
          claim.description,
        ]
      );
    } catch (error) {
      logger.error('Error caching claim', { userId, error: error.message });
    }
  }

  /**
   * Get claims from local cache
   * Returns OpenAPI-compliant paginated response
   */
  async _getLocalClaims(userId, { limit, offset, status }) {
    const conditions = ['user_id = $1'];
    const params = [userId];
    let paramCount = 2;

    if (status) {
      conditions.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM claims WHERE ${conditions.join(' AND ')}`,
      params.slice(0, paramCount - 1)
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit);
    params.push(offset);

    const result = await db.query(
      `SELECT
        legacy_claim_id as id,
        claim_number,
        claim_type as type,
        provider_name as provider,
        claim_date as date,
        amount,
        status,
        description,
        created_at,
        updated_at
      FROM claims
      WHERE ${conditions.join(' AND ')}
      ORDER BY claim_date DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    return {
      data: result.rows.map(claim => ({
        id: claim.id,
        claimNumber: claim.claim_number,
        type: claim.type,
        provider: claim.provider,
        date: claim.date,
        amount: claim.amount,
        status: claim.status.toUpperCase(),
        description: claim.description,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      source: 'cache',
    };
  }

  /**
   * Get single claim from local cache
   */
  async _getLocalClaim(userId, claimId) {
    const result = await db.query(
      `SELECT
        legacy_claim_id as id,
        claim_number,
        claim_type as type,
        provider_name as provider,
        claim_date as date,
        amount,
        status,
        description,
        created_at,
        updated_at
      FROM claims
      WHERE user_id = $1 AND (legacy_claim_id = $2 OR claim_number = $2)
      LIMIT 1`,
      [userId, claimId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const claim = result.rows[0];
    return {
      id: claim.id,
      claimNumber: claim.claim_number,
      type: claim.type,
      provider: claim.provider,
      date: claim.date,
      amount: claim.amount,
      status: claim.status.toUpperCase(),
      description: claim.description,
      documents: [], // Documents would need to be fetched separately
    };
  }
}

module.exports = new ClaimService();
