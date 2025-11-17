const User = require('../models/User');
const db = require('../db');
const logger = require('../config/logger');

class SupportQueryService {
  /**
   * Get user's support queries with pagination
   * Returns OpenAPI-compliant paginated response
   */
  async getUserQueries(userId, { limit = 50, offset = 0, status, category } = {}) {
    try {
      const conditions = ['user_id = $1'];
      const params = [userId];
      let paramCount = 2;

      if (status) {
        conditions.push(`status = $${paramCount}`);
        params.push(status);
        paramCount++;
      }

      if (category) {
        conditions.push(`category = $${paramCount}`);
        params.push(category);
        paramCount++;
      }

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) FROM support_queries WHERE ${conditions.join(' AND ')}`,
        params.slice(0, paramCount - 1)
      );
      const total = parseInt(countResult.rows[0].count, 10);

      params.push(limit);
      params.push(offset);

      const result = await db.query(
        `SELECT
          id,
          subject,
          category,
          priority,
          description,
          status,
          created_at,
          updated_at,
          resolved_at,
          closed_at
        FROM support_queries
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
        params
      );

      return {
        data: result.rows.map(row => ({
          id: row.id,
          subject: row.subject,
          category: row.category,
          priority: row.priority,
          description: row.description,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          resolvedAt: row.resolved_at,
          closedAt: row.closed_at,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    } catch (error) {
      logger.error('Error fetching support queries', { userId, error: error.message });
      throw new Error('Failed to fetch support queries');
    }
  }

  /**
   * Create a new support query
   */
  async createQuery(userId, queryData) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      const client = await db.getClient();
      await client.query('BEGIN');

      // Create the query
      const queryResult = await client.query(
        `INSERT INTO support_queries (
          user_id,
          subject,
          category,
          priority,
          description
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
          userId,
          queryData.subject,
          queryData.category,
          queryData.priority || 'MEDIUM',
          queryData.description,
        ]
      );

      const query = queryResult.rows[0];

      // Add initial message
      await client.query(
        `INSERT INTO support_query_messages (
          query_id,
          sender_type,
          sender_name,
          message
        )
        VALUES ($1, $2, $3, $4)`,
        [
          query.id,
          'USER',
          `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
          queryData.description,
        ]
      );

      await client.query('COMMIT');
      client.release();

      logger.info('Support query created', {
        userId,
        queryId: query.id,
        category: query.category,
      });

      // TODO: Send email notification to support team

      return {
        id: query.id,
        subject: query.subject,
        category: query.category,
        priority: query.priority,
        description: query.description,
        status: query.status,
        createdAt: query.created_at,
      };
    } catch (error) {
      logger.error('Error creating support query', { userId, error: error.message });
      throw new Error('Failed to create support query');
    }
  }

  /**
   * Get specific support query by ID with messages
   */
  async getQueryById(userId, queryId) {
    try {
      // Get query details
      const queryResult = await db.query(
        `SELECT
          id,
          subject,
          category,
          priority,
          description,
          status,
          assigned_to,
          resolution,
          created_at,
          updated_at,
          resolved_at,
          closed_at
        FROM support_queries
        WHERE id = $1 AND user_id = $2`,
        [queryId, userId]
      );

      if (queryResult.rows.length === 0) {
        const error = new Error('Support query not found');
        error.status = 404;
        throw error;
      }

      const query = queryResult.rows[0];

      // Get messages for this query
      const messagesResult = await db.query(
        `SELECT
          id,
          sender_type,
          sender_name,
          message,
          attachments,
          created_at
        FROM support_query_messages
        WHERE query_id = $1
        ORDER BY created_at ASC`,
        [queryId]
      );

      return {
        id: query.id,
        subject: query.subject,
        category: query.category,
        priority: query.priority,
        description: query.description,
        status: query.status,
        assignedTo: query.assigned_to,
        resolution: query.resolution,
        createdAt: query.created_at,
        updatedAt: query.updated_at,
        resolvedAt: query.resolved_at,
        closedAt: query.closed_at,
        messages: messagesResult.rows.map(msg => ({
          id: msg.id,
          senderType: msg.sender_type,
          senderName: msg.sender_name,
          message: msg.message,
          attachments: msg.attachments || [],
          createdAt: msg.created_at,
        })),
      };
    } catch (error) {
      if (error.status === 404) {
        throw error;
      }
      logger.error('Error fetching support query', { userId, queryId, error: error.message });
      throw new Error('Failed to fetch support query');
    }
  }

  /**
   * Add a message to an existing query
   */
  async addMessage(userId, queryId, messageData) {
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    try {
      // Verify query belongs to user
      const queryCheck = await db.query(
        'SELECT id, status FROM support_queries WHERE id = $1 AND user_id = $2',
        [queryId, userId]
      );

      if (queryCheck.rows.length === 0) {
        const error = new Error('Support query not found');
        error.status = 404;
        throw error;
      }

      const query = queryCheck.rows[0];

      if (query.status === 'CLOSED') {
        const error = new Error('Cannot add message to closed query');
        error.status = 400;
        throw error;
      }

      // Add message
      const result = await db.query(
        `INSERT INTO support_query_messages (
          query_id,
          sender_type,
          sender_name,
          message,
          attachments
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
          queryId,
          'USER',
          `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
          messageData.message,
          messageData.attachments ? JSON.stringify(messageData.attachments) : null,
        ]
      );

      // Update query status if it was resolved
      if (query.status === 'RESOLVED') {
        await db.query(
          "UPDATE support_queries SET status = 'OPEN' WHERE id = $1",
          [queryId]
        );
      }

      const message = result.rows[0];

      logger.info('Message added to support query', {
        userId,
        queryId,
        messageId: message.id,
      });

      return {
        id: message.id,
        senderType: message.sender_type,
        senderName: message.sender_name,
        message: message.message,
        attachments: message.attachments || [],
        createdAt: message.created_at,
      };
    } catch (error) {
      if (error.status === 404 || error.status === 400) {
        throw error;
      }
      logger.error('Error adding message to query', { userId, queryId, error: error.message });
      throw new Error('Failed to add message');
    }
  }

  /**
   * Close a support query (mark as resolved by user)
   */
  async closeQuery(userId, queryId) {
    try {
      const result = await db.query(
        `UPDATE support_queries
         SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2 AND status != 'CLOSED'
         RETURNING *`,
        [queryId, userId]
      );

      if (result.rows.length === 0) {
        const error = new Error('Support query not found or already closed');
        error.status = 404;
        throw error;
      }

      logger.info('Support query closed', { userId, queryId });

      return { success: true, message: 'Support query closed successfully' };
    } catch (error) {
      if (error.status === 404) {
        throw error;
      }
      logger.error('Error closing support query', { userId, queryId, error: error.message });
      throw new Error('Failed to close support query');
    }
  }
}

module.exports = new SupportQueryService();
