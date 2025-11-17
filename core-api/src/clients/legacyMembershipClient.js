/**
 * Legacy Membership API Client
 * Reusable module for fetching members from Budget Health legacy system
 * Can be used for both CSV export and database sync
 */

"use strict";

const https = require("https");
const { URL } = require("url");
const logger = require("../config/logger");

const DEFAULT_BASE_URL = "https://budgethealth.webportal.co.zw/api/v2";
const DEFAULT_ENDPOINT = "membership/members";
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_TIMEOUT = 10000;

/**
 * Trim leading and/or trailing slashes from a string
 */
function trimSlashes(s, leading = true, trailing = true) {
  let r = s;
  if (leading) r = r.replace(/^\/+/, "");
  if (trailing) r = r.replace(/\/+$/, "");
  return r;
}

/**
 * Make a single page request to the legacy API
 */
function makePageRequest({ baseUrl, endpoint, page, pageSize, scheme, apiKey, timeout }) {
  return new Promise((resolve) => {
    const base = trimSlashes(baseUrl, false, true);
    const ep = trimSlashes(endpoint, true, true);
    const full = `${base}/${ep}/${encodeURIComponent(page)}/${encodeURIComponent(pageSize)}`;
    const url = new URL(full);

    const options = {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Scheme": scheme,
        "x-api-key": apiKey,
      },
    };

    const req = https.request(url, options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const status = res.statusCode || 0;
        let parsed = null;
        let parseErr = null;

        if (data && data.trim()) {
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parseErr = e;
          }
        }

        resolve({
          ok: status >= 200 && status < 300 && !parseErr,
          status,
          data: parsed,
          error: parseErr ? new Error(`JSON parse error: ${parseErr.message}`) : null,
          bodyText: data,
          headers: res.headers,
        });
      });
    });

    req.setTimeout(timeout, () => {
      req.destroy(new Error("Request timeout"));
    });

    req.on("error", (err) => {
      resolve({
        ok: false,
        status: 0,
        data: null,
        error: err,
        bodyText: "",
        headers: {}
      });
    });

    req.end();
  });
}

/**
 * Check if an error is retryable
 */
function isRetryable(status, err) {
  if (err) return true;
  if (status === 429) return true; // Rate limit
  if (status >= 500 && status <= 599) return true; // Server errors
  return false;
}

/**
 * Fetch a page with automatic retries and exponential backoff
 */
async function fetchPageWithRetry(params, retries = 1, log = logger.warn) {
  let attempt = 0;
  let last;

  while (attempt <= retries) {
    last = await makePageRequest(params);

    if (last.ok) return last;

    const retryable = isRetryable(last.status, last.error);
    if (!retryable || attempt === retries) break;

    const backoff = Math.min(500 * Math.pow(2, attempt), 8000);
    const errorMsg = last.error ? last.error.message : `HTTP ${last.status}`;
    log(`Retrying page ${params.page} after ${errorMsg} in ${backoff}ms`);

    await new Promise((r) => setTimeout(r, backoff));
    attempt++;
  }

  return last;
}

/**
 * Async generator that yields all members from the legacy API
 * Handles pagination automatically
 *
 * @example
 * for await (const member of getAllMembers({ scheme, apiKey })) {
 *   console.log(member.memberNo, member.firstname, member.surname);
 * }
 */
async function* getAllMembers({
  scheme,
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  endpoint = DEFAULT_ENDPOINT,
  pageSize = DEFAULT_PAGE_SIZE,
  timeout = DEFAULT_TIMEOUT,
  maxPages,
  maxItems,
  retries = 1,
  log = logger.info,
} = {}) {
  if (!scheme || !apiKey) {
    throw new Error("scheme and apiKey are required");
  }

  let currentPage = 1;
  let fetchedPages = 0;
  let fetchedItems = 0;

  while (true) {
    // Check limits
    if (maxPages !== undefined && fetchedPages >= maxPages) {
      log(`Reached max pages limit: ${maxPages}`);
      break;
    }
    if (maxItems !== undefined && fetchedItems >= maxItems) {
      log(`Reached max items limit: ${maxItems}`);
      break;
    }

    // Fetch page
    const res = await fetchPageWithRetry(
      { baseUrl, endpoint, page: currentPage, pageSize, scheme, apiKey, timeout },
      retries,
      log
    );

    if (!res.ok) {
      const snippet = (res.bodyText || "").slice(0, 200).replace(/\s+/g, " ");
      const msg = res.error
        ? res.error.message
        : `HTTP ${res.status}${snippet ? " - " + snippet : ""}`;
      throw new Error(`Failed to fetch page ${currentPage}: ${msg}`);
    }

    const body = res.data;
    const results = Array.isArray(body?.results) ? body.results : [];
    const hasMore = !!body?.hasMore;

    log(`Page ${currentPage}: ${results.length} item(s), hasMore=${hasMore}`);

    // Yield members
    for (const member of results) {
      if (maxItems !== undefined && fetchedItems >= maxItems) break;
      fetchedItems++;
      yield member;
    }

    fetchedPages++;

    // Check if we're done
    if (!hasMore || results.length === 0) {
      log(`Completed: fetched ${fetchedItems} members across ${fetchedPages} pages`);
      break;
    }

    currentPage++;
  }
}

/**
 * Fetch all members as an array (use with caution for large datasets)
 */
async function getAllMembersArray(options) {
  const members = [];
  for await (const member of getAllMembers(options)) {
    members.push(member);
  }
  return members;
}

/**
 * Legacy client class (for compatibility with existing code)
 */
class LegacyMembershipClient {
  constructor({ scheme, apiKey, baseUrl, timeout } = {}) {
    this.scheme = scheme;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
    this.timeout = timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Get all members as async generator
   */
  getAllMembers(options = {}) {
    return getAllMembers({
      scheme: this.scheme,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      ...options,
    });
  }

  /**
   * Find member by ID number (searches through all members)
   * WARNING: This is slow - use synced DB instead for production
   */
  async findMemberByIdNumber(idNumber) {
    logger.warn('findMemberByIdNumber: Searching through legacy API - consider using synced DB');

    for await (const member of this.getAllMembers({ pageSize: 100 })) {
      if (member.nationalIdNo === idNumber && !member.isDependant) {
        return this._normalizeMember(member);
      }
    }
    return null;
  }

  /**
   * Find member by member number (searches through all members)
   * WARNING: This is slow - use synced DB instead for production
   */
  async findMemberByMemberNumber(memberNumber) {
    logger.warn('findMemberByMemberNumber: Searching through legacy API - consider using synced DB');

    for await (const member of this.getAllMembers({ pageSize: 100 })) {
      if (member.memberNo === memberNumber && !member.isDependant) {
        return this._normalizeMember(member);
      }
    }
    return null;
  }

  /**
   * Get member details (mock implementation)
   */
  async getMemberDetails(legacyMemberId) {
    logger.warn('getMemberDetails: Not implemented - using synced DB instead');
    throw new Error('getMemberDetails not implemented - use membership service with synced DB');
  }

  /**
   * Get member dependants (mock implementation)
   */
  async getMemberDependants(legacyMemberId) {
    logger.warn('getMemberDependants: Not implemented - using synced DB instead');
    throw new Error('getMemberDependants not implemented - use membership service with synced DB');
  }

  /**
   * Normalize member data from legacy format
   */
  _normalizeMember(legacyMember) {
    return {
      id: legacyMember.memberId,
      memberNumber: legacyMember.memberNo,
      idNumber: legacyMember.nationalIdNo,
      firstName: legacyMember.firstname,
      lastName: legacyMember.surname,
      dateOfBirth: legacyMember.dateOfBirth,
      status: legacyMember.memberStatus,
      planId: legacyMember.plan,
      planName: legacyMember.plan,
      isDependant: legacyMember.isDependant,
      company: legacyMember.company,
    };
  }
}

module.exports = {
  getAllMembers,
  getAllMembersArray,
  LegacyMembershipClient,
  DEFAULT_BASE_URL,
  DEFAULT_ENDPOINT,
  DEFAULT_PAGE_SIZE,
};
