/**
 * Member Sync Job
 * Syncs member data from Budget Health legacy API to local database
 * Run with: node src/jobs/syncMembersJob.js
 * Schedule with cron: 0 2 * * * (daily at 2am)
 */

"use strict";

const db = require('../db');
const { getAllMembers } = require('../clients/legacyMembershipClient');
const logger = require('../config/logger');
const config = require('../config');

/**
 * Parse ISO date string to YYYY-MM-DD or null
 */
function parseDate(isoString) {
  if (!isoString) return null;
  try {
    return isoString.slice(0, 10);
  } catch (e) {
    return null;
  }
}

/**
 * Upsert a single member into the database
 */
async function upsertMember(client, member) {
  const query = `
    INSERT INTO members (
      legacy_member_id,
      segregated_fund,
      title,
      member_no,
      suffix,
      firstname,
      initials,
      surname,
      sex,
      nationality,
      occupation,
      member_status,
      date_of_birth,
      date_of_joining,
      date_of_resigning,
      national_id_no,
      plan,
      is_dependant,
      cellphone_no,
      email_address,
      email_address2,
      company,
      notes,
      parent_legacy_id,
      synced_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
      $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
      $23,$24, CURRENT_TIMESTAMP
    )
    ON CONFLICT (legacy_member_id) DO UPDATE SET
      segregated_fund   = EXCLUDED.segregated_fund,
      title             = EXCLUDED.title,
      member_no         = EXCLUDED.member_no,
      suffix            = EXCLUDED.suffix,
      firstname         = EXCLUDED.firstname,
      initials          = EXCLUDED.initials,
      surname           = EXCLUDED.surname,
      sex               = EXCLUDED.sex,
      nationality       = EXCLUDED.nationality,
      occupation        = EXCLUDED.occupation,
      member_status     = EXCLUDED.member_status,
      date_of_birth     = EXCLUDED.date_of_birth,
      date_of_joining   = EXCLUDED.date_of_joining,
      date_of_resigning = EXCLUDED.date_of_resigning,
      national_id_no    = EXCLUDED.national_id_no,
      plan              = EXCLUDED.plan,
      is_dependant      = EXCLUDED.is_dependant,
      cellphone_no      = EXCLUDED.cellphone_no,
      email_address     = EXCLUDED.email_address,
      email_address2    = EXCLUDED.email_address2,
      company           = EXCLUDED.company,
      notes             = EXCLUDED.notes,
      parent_legacy_id  = EXCLUDED.parent_legacy_id,
      synced_at         = CURRENT_TIMESTAMP,
      updated_at        = CURRENT_TIMESTAMP;
  `;

  const params = [
    member.memberId,
    member.segregatedFund,
    member.title,
    member.memberNo,
    member.suffix,
    member.firstname,
    member.initials,
    member.surname,
    member.sex,
    member.nationality,
    member.occupation,
    member.memberStatus,
    parseDate(member.dateOfBirth),
    parseDate(member.dateOfJoining),
    parseDate(member.dateOfResigning),
    member.nationalIdNo,
    member.plan,
    member.isDependant || false,
    member.cellphoneNo,
    member.emailAddress,
    member.emailAddress2,
    member.company,
    member.notes,
    member.parentId || null,
  ];

  await client.query(query, params);
}

/**
 * Run the full sync process
 */
async function runSync({
  scheme,
  apiKey,
  pageSize = 50,
  retries = 2,
  batchSize = 100,
} = {}) {
  // Use config if not provided
  scheme = scheme || config.legacy.scheme;
  apiKey = apiKey || config.legacy.apiKey;

  if (!scheme || !apiKey) {
    throw new Error("BH_SCHEME and BH_API_KEY must be set in config or environment");
  }

  logger.info('Starting member sync from legacy system', {
    scheme,
    pageSize,
    retries,
    batchSize,
  });

  const startTime = Date.now();
  let totalUpserted = 0;
  let totalErrors = 0;
  let batch = [];

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Iterate through all members from legacy API
    for await (const member of getAllMembers({
      scheme,
      apiKey,
      pageSize,
      retries,
      log: (msg) => logger.info(msg),
    })) {
      batch.push(member);

      // Process in batches
      if (batch.length >= batchSize) {
        for (const m of batch) {
          try {
            await upsertMember(client, m);
            totalUpserted++;
          } catch (err) {
            totalErrors++;
            logger.error('Error upserting member', {
              memberId: m.memberId,
              memberNo: m.memberNo,
              error: err.message,
            });
          }
        }

        logger.info(`Progress: ${totalUpserted} members upserted (${totalErrors} errors)`);
        batch = [];
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      for (const m of batch) {
        try {
          await upsertMember(client, m);
          totalUpserted++;
        } catch (err) {
          totalErrors++;
          logger.error('Error upserting member', {
            memberId: m.memberId,
            memberNo: m.memberNo,
            error: err.message,
          });
        }
      }
    }

    await client.query('COMMIT');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info('Member sync completed successfully', {
      totalUpserted,
      totalErrors,
      durationSeconds: duration,
    });

    return {
      success: true,
      totalUpserted,
      totalErrors,
      durationSeconds: parseFloat(duration),
    };

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Member sync failed', {
      error: err.message,
      stack: err.stack,
      totalUpserted,
      totalErrors,
    });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get sync statistics
 */
async function getSyncStats() {
  const result = await db.query(`
    SELECT
      COUNT(*) as total_members,
      COUNT(*) FILTER (WHERE is_dependant = false) as principals,
      COUNT(*) FILTER (WHERE is_dependant = true) as dependants,
      COUNT(*) FILTER (WHERE member_status = 'Active') as active_members,
      COUNT(DISTINCT company) as unique_companies,
      MAX(synced_at) as last_sync,
      MIN(synced_at) as oldest_sync
    FROM members
  `);

  return result.rows[0];
}

/**
 * Clean up old members (optional maintenance task)
 */
async function cleanupOldMembers(daysOld = 90) {
  const result = await db.query(
    `DELETE FROM members
     WHERE synced_at < NOW() - INTERVAL '${daysOld} days'
     RETURNING id`,
  );

  logger.info(`Cleaned up ${result.rowCount} members older than ${daysOld} days`);
  return result.rowCount;
}

// CLI execution
if (require.main === module) {
  runSync()
    .then((stats) => {
      console.log('\n✅ Sync completed successfully!');
      console.log(`   Members upserted: ${stats.totalUpserted}`);
      console.log(`   Errors: ${stats.totalErrors}`);
      console.log(`   Duration: ${stats.durationSeconds}s`);

      return getSyncStats();
    })
    .then((stats) => {
      console.log('\n📊 Database statistics:');
      console.log(`   Total members: ${stats.total_members}`);
      console.log(`   Principals: ${stats.principals}`);
      console.log(`   Dependants: ${stats.dependants}`);
      console.log(`   Active: ${stats.active_members}`);
      console.log(`   Companies: ${stats.unique_companies}`);
      console.log(`   Last sync: ${stats.last_sync}`);

      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Sync failed:', err.message);
      process.exit(1);
    });
}

module.exports = {
  runSync,
  getSyncStats,
  cleanupOldMembers,
  upsertMember,
};
