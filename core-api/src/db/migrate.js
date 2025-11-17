/**
 * Database migration script
 * Run with: node src/db/migrate.js
 */

const fs = require('fs');
const path = require('path');
const db = require('./index');
const logger = require('../config/logger');

async function migrate() {
  try {
    logger.info('Starting database migration...');

    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    await db.query(schema);

    logger.info('Database migration completed successfully');

    // Close the pool
    await db.pool.end();

    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

migrate();
