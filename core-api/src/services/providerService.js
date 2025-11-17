const legacyClient = require('../clients/legacyClient');
const db = require('../db');
const logger = require('../config/logger');

class ProviderService {
  /**
   * Search for healthcare providers
   * Uses legacy system and local cache
   * Returns OpenAPI-compliant paginated response
   */
  async searchProviders({ query, location, type, specialty, limit = 50, offset = 0 }) {
    try {
      // First, try to get from legacy system
      const providers = await legacyClient.searchProviders({
        query,
        location,
        type,
        specialty,
        limit,
        offset,
      });

      // Cache providers in local DB for faster future lookups
      await this._cacheProviders(providers);

      // Note: Legacy system doesn't return total count, so we estimate
      const total = providers.length === limit ? offset + limit + 1 : offset + providers.length;

      return {
        data: providers.map(provider => ({
          id: provider.id,
          name: provider.name,
          type: provider.type,
          specialties: provider.specialties || [],
          address: provider.address,
          city: provider.city,
          province: provider.province,
          postalCode: provider.postalCode,
          phone: provider.phone,
          email: provider.email,
          networkStatus: provider.networkStatus?.toUpperCase() || 'IN_NETWORK',
          coordinates: provider.coordinates,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: providers.length === limit,
        },
      };
    } catch (error) {
      logger.error('Error searching providers', { query, error: error.message });

      // Fallback to local cache if legacy system fails
      logger.info('Falling back to local provider cache');
      return this._searchLocalProviders({ query, location, type, specialty, limit, offset });
    }
  }

  /**
   * Get provider details by ID
   */
  async getProviderById(providerId) {
    try {
      // Check local cache first
      const cachedProvider = await this._getLocalProvider(providerId);

      if (cachedProvider) {
        return cachedProvider;
      }

      // If not in cache, this would fetch from legacy (not implemented in this example)
      const error = new Error('Provider not found');
      error.status = 404;
      throw error;
    } catch (error) {
      logger.error('Error getting provider', { providerId, error: error.message });
      throw error;
    }
  }

  /**
   * Cache providers in local database
   */
  async _cacheProviders(providers) {
    if (!providers || providers.length === 0) {
      return;
    }

    try {
      for (const provider of providers) {
        await db.query(
          `INSERT INTO providers (
            legacy_provider_id, name, type, specialties, address, city, province,
            postal_code, phone_number, email, network_status, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (legacy_provider_id)
          DO UPDATE SET
            name = EXCLUDED.name,
            type = EXCLUDED.type,
            specialties = EXCLUDED.specialties,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            province = EXCLUDED.province,
            postal_code = EXCLUDED.postal_code,
            phone_number = EXCLUDED.phone_number,
            email = EXCLUDED.email,
            network_status = EXCLUDED.network_status,
            metadata = EXCLUDED.metadata,
            updated_at = CURRENT_TIMESTAMP`,
          [
            provider.id,
            provider.name,
            provider.type,
            provider.specialties,
            provider.address,
            provider.city,
            provider.province,
            provider.postalCode,
            provider.phone,
            provider.email,
            provider.networkStatus,
            JSON.stringify({ coordinates: provider.coordinates }),
          ]
        );
      }

      logger.debug('Cached providers', { count: providers.length });
    } catch (error) {
      logger.error('Error caching providers', { error: error.message });
      // Don't throw - caching is optional
    }
  }

  /**
   * Search local provider cache
   * Returns OpenAPI-compliant paginated response
   */
  async _searchLocalProviders({ query, location, type, specialty, limit, offset }) {
    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (query) {
      conditions.push(`to_tsvector('english', name) @@ plainto_tsquery('english', $${paramCount})`);
      params.push(query);
      paramCount++;
    }

    if (location) {
      conditions.push(`(city ILIKE $${paramCount} OR province ILIKE $${paramCount})`);
      params.push(`%${location}%`);
      paramCount++;
    }

    if (type) {
      conditions.push(`type = $${paramCount}`);
      params.push(type);
      paramCount++;
    }

    if (specialty) {
      conditions.push(`$${paramCount} = ANY(specialties)`);
      params.push(specialty);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM providers ${whereClause}`,
      params.slice(0, paramCount - 1)
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit);
    params.push(offset);

    const result = await db.query(
      `SELECT
        legacy_provider_id as id,
        name,
        type,
        specialties,
        address,
        city,
        province,
        postal_code,
        phone_number as phone,
        email,
        network_status,
        metadata
      FROM providers
      ${whereClause}
      ORDER BY name
      LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    return {
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        specialties: row.specialties || [],
        address: row.address,
        city: row.city,
        province: row.province,
        postalCode: row.postal_code,
        phone: row.phone,
        email: row.email,
        networkStatus: row.network_status?.toUpperCase() || 'IN_NETWORK',
        coordinates: row.metadata?.coordinates,
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
   * Get provider from local cache by ID
   */
  async _getLocalProvider(providerId) {
    const result = await db.query(
      `SELECT
        legacy_provider_id as id,
        name,
        type,
        specialties,
        address,
        city,
        province,
        postal_code,
        phone_number as phone,
        email,
        network_status,
        metadata
      FROM providers
      WHERE legacy_provider_id = $1`,
      [providerId]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        ...row,
        coordinates: row.metadata?.coordinates,
      };
    }

    return null;
  }
}

module.exports = new ProviderService();
