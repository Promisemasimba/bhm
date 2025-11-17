const User = require('../models/User');
const db = require('../db');
const logger = require('../config/logger');

class CardRequestService {
  /**
   * Get user's card requests with pagination
   * Returns OpenAPI-compliant paginated response
   */
  async getUserCardRequests(userId, { limit = 50, offset = 0, status } = {}) {
    try {
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
        `SELECT COUNT(*) FROM card_requests WHERE ${conditions.join(' AND ')}`,
        params.slice(0, paramCount - 1)
      );
      const total = parseInt(countResult.rows[0].count, 10);

      params.push(limit);
      params.push(offset);

      const result = await db.query(
        `SELECT
          id,
          request_type,
          reason,
          delivery_address,
          delivery_city,
          delivery_province,
          delivery_postal_code,
          contact_phone,
          status,
          tracking_number,
          requested_at,
          approved_at,
          shipped_at,
          delivered_at,
          rejected_reason,
          notes
        FROM card_requests
        WHERE ${conditions.join(' AND ')}
        ORDER BY requested_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
        params
      );

      return {
        data: result.rows.map(row => ({
          id: row.id,
          requestType: row.request_type,
          reason: row.reason,
          deliveryAddress: {
            street: row.delivery_address,
            city: row.delivery_city,
            province: row.delivery_province,
            postalCode: row.delivery_postal_code,
          },
          contactPhone: row.contact_phone,
          status: row.status,
          trackingNumber: row.tracking_number,
          requestedAt: row.requested_at,
          approvedAt: row.approved_at,
          shippedAt: row.shipped_at,
          deliveredAt: row.delivered_at,
          rejectedReason: row.rejected_reason,
          notes: row.notes,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    } catch (error) {
      logger.error('Error fetching card requests', { userId, error: error.message });
      throw new Error('Failed to fetch card requests');
    }
  }

  /**
   * Create a new physical card request
   */
  async createCardRequest(userId, requestData) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      const result = await db.query(
        `INSERT INTO card_requests (
          user_id,
          request_type,
          reason,
          delivery_address,
          delivery_city,
          delivery_province,
          delivery_postal_code,
          contact_phone
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          userId,
          requestData.requestType,
          requestData.reason,
          requestData.deliveryAddress.street,
          requestData.deliveryAddress.city,
          requestData.deliveryAddress.province,
          requestData.deliveryAddress.postalCode,
          requestData.contactPhone,
        ]
      );

      const request = result.rows[0];

      logger.info('Card request created', {
        userId,
        requestId: request.id,
        requestType: request.request_type,
      });

      return {
        id: request.id,
        requestType: request.request_type,
        reason: request.reason,
        deliveryAddress: {
          street: request.delivery_address,
          city: request.delivery_city,
          province: request.delivery_province,
          postalCode: request.delivery_postal_code,
        },
        contactPhone: request.contact_phone,
        status: request.status,
        trackingNumber: request.tracking_number,
        requestedAt: request.requested_at,
        approvedAt: request.approved_at,
        shippedAt: request.shipped_at,
        deliveredAt: request.delivered_at,
      };
    } catch (error) {
      logger.error('Error creating card request', { userId, error: error.message });
      throw new Error('Failed to create card request');
    }
  }

  /**
   * Get specific card request by ID
   */
  async getCardRequestById(userId, requestId) {
    try {
      const result = await db.query(
        `SELECT
          id,
          request_type,
          reason,
          delivery_address,
          delivery_city,
          delivery_province,
          delivery_postal_code,
          contact_phone,
          status,
          tracking_number,
          requested_at,
          approved_at,
          shipped_at,
          delivered_at,
          rejected_reason,
          notes
        FROM card_requests
        WHERE id = $1 AND user_id = $2`,
        [requestId, userId]
      );

      if (result.rows.length === 0) {
        const error = new Error('Card request not found');
        error.status = 404;
        throw error;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        requestType: row.request_type,
        reason: row.reason,
        deliveryAddress: {
          street: row.delivery_address,
          city: row.delivery_city,
          province: row.delivery_province,
          postalCode: row.delivery_postal_code,
        },
        contactPhone: row.contact_phone,
        status: row.status,
        trackingNumber: row.tracking_number,
        requestedAt: row.requested_at,
        approvedAt: row.approved_at,
        shippedAt: row.shipped_at,
        deliveredAt: row.delivered_at,
        rejectedReason: row.rejected_reason,
        notes: row.notes,
      };
    } catch (error) {
      if (error.status === 404) {
        throw error;
      }
      logger.error('Error fetching card request', { userId, requestId, error: error.message });
      throw new Error('Failed to fetch card request');
    }
  }

  /**
   * Cancel a card request (only if pending or approved)
   */
  async cancelCardRequest(userId, requestId) {
    try {
      const result = await db.query(
        `UPDATE card_requests
         SET status = 'CANCELLED'
         WHERE id = $1 AND user_id = $2 AND status IN ('PENDING', 'APPROVED')
         RETURNING *`,
        [requestId, userId]
      );

      if (result.rows.length === 0) {
        const error = new Error('Card request not found or cannot be cancelled');
        error.status = 404;
        throw error;
      }

      logger.info('Card request cancelled', { userId, requestId });

      return { success: true, message: 'Card request cancelled successfully' };
    } catch (error) {
      if (error.status === 404) {
        throw error;
      }
      logger.error('Error cancelling card request', { userId, requestId, error: error.message });
      throw new Error('Failed to cancel card request');
    }
  }
}

module.exports = new CardRequestService();
