# OpenAPI Implementation Status

This document tracks the implementation status of the Budget Health Medical Aid API against the provided OpenAPI 3.0.3 specification.

## ✅ Completed (Committed to Git)

### Authentication Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/auth/register/id` | POST | ✅ Complete | Registers user via national ID number |
| `/auth/register/membership` | POST | ✅ Complete | Registers user via membership number |
| `/auth/login` | POST | ✅ Complete | Returns tokens + user (matches LoginResponse) |
| `/auth/refresh` | POST | ✅ Complete | Refresh access token with rotation |
| `/auth/logout` | POST | ✅ Complete | Invalidates user sessions |

**Core API Routes:** `core-api/src/routes/auth.js` ✅
**Service Layer:** `core-api/src/services/authService.js` ✅
**Worker Handlers:** ❌ Need update to match new endpoints

---

## 🚧 Partially Implemented (Need OpenAPI Alignment)

### Home & Dashboard

| Endpoint | Method | Current Status | Required Changes |
|----------|--------|----------------|------------------|
| `/home` | GET | ✅ Implemented | Update response format to match `HomeSummary` schema |

**Current Implementation:**
- Returns: `{ member, plan, coverage, dependants, recentClaims, quickActions }`
- **Needs:** Add `hasDigitalCard` field, ensure `quickLinks` matches `QuickLink[]` schema

### Membership & Cards

| Endpoint | Method | Current Status | Required Changes |
|----------|--------|----------------|------------------|
| `/cards/digital` | GET | ✅ Implemented as `/api/card` | Rename endpoint, update response to match `DigitalCard` schema |
| `/memberships/certificate` | GET | ✅ Implemented | Update response format for PDF/JSON support |

**Current Implementation:**
- Digital card returns basic member info
- **Needs:** Add `qrCodeImageUrl`, `barcodeValue`, `issueDate`, `expiryDate`, `termsUrl`

### Providers

| Endpoint | Method | Current Status | Required Changes |
|----------|--------|----------------|------------------|
| `/providers` | GET | ✅ Implemented as `/api/providers/search` | Rename endpoint, add pagination, update response schema |

**Current Implementation:**
- Basic search by query, location, type, specialty
- **Needs:** Add lat/long search, `radiusKm`, `inNetwork` filter, pagination metadata

### Claims

| Endpoint | Method | Current Status | Required Changes |
|----------|--------|----------------|------------------|
| `/claims` | GET | ✅ Implemented | Add date range filters, pagination |
| `/claims` | POST | ✅ Implemented | Update to use multipart/form-data for file upload |

**Current Implementation:**
- Basic claim listing and submission
- **Needs:** OpenAPI spec requires multipart upload, not separate upload URL endpoint

### Dependants

| Endpoint | Method | Current Status | Required Changes |
|----------|--------|----------------|------------------|
| `/dependants` | GET | ✅ Implemented | Add pagination, update response format |

**Current Implementation:**
- Returns list of dependants with basic info
- **Needs:** Pagination, ensure schema matches `Dependant` object exactly

---

## ❌ Not Implemented (Required by OpenAPI Spec)

### User Profile Endpoints

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/me` | GET | Get current user profile | **HIGH** |
| `/me` | PATCH | Update current user profile | **HIGH** |

**Implementation Required:**
- New route file: `core-api/src/routes/users.js`
- Returns `BasicUser` schema
- Update fields: email, mobileNumber, fullName, communication preferences

### Package Information

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/packages/current` | GET | Get current medical aid package | **HIGH** |

**Implementation Required:**
- New route or update existing home dashboard
- Returns `PackageSummary` schema with premium, benefits, dates

### Physical Card Requests

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/cards/physical-requests` | GET | List physical card requests | **MEDIUM** |
| `/cards/physical-requests` | POST | Request new physical card | **MEDIUM** |

**Implementation Required:**
- New service: `cardRequestService.js`
- Database table for card requests
- Returns `CardRequest` schema

### Individual Resource Endpoints

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/claims/{claimId}` | GET | Get specific claim details | **MEDIUM** |
| `/dependants/{dependantId}` | GET | Get specific dependant | **MEDIUM** |
| `/dependants/{dependantId}` | PATCH | Update dependant info | **LOW** |
| `/dependants/{dependantId}` | DELETE | Remove dependant | **LOW** |
| `/dependants` | POST | Add new dependant | **LOW** |

**Implementation Required:**
- Add individual resource handlers to existing services
- CRUD operations for dependants (check business rules with HMS)

### Support & Contact

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/support/contact-options` | GET | Get support contact info | **HIGH** |
| `/support/queries` | GET | List support queries | **LOW** |
| `/support/queries` | POST | Submit new support query | **MEDIUM** |
| `/support/queries/{queryId}` | GET | Get specific query details | **LOW** |

**Implementation Required:**
- New service: `supportService.js`
- Database table for support queries
- Static contact information endpoint

---

## 📋 Implementation Priority

### Phase 1: Critical for MVP (Week 1)

1. ✅ **Authentication** - Complete with refresh tokens
2. 🚧 **Update Worker** to proxy new auth endpoints
3. ❌ **User Profile** (`/me` GET/PATCH) - Required for account management
4. ❌ **Package Information** (`/packages/current`) - Core feature
5. ❌ **Contact Options** (`/support/contact-options`) - User support

### Phase 2: Core Features (Week 2)

6. 🚧 **Update response formats** to match OpenAPI exactly
7. ❌ **Individual claim details** (`/claims/{id}`)
8. ❌ **Individual dependant details** (`/dependants/{id}`)
9. 🚧 **Add pagination** to all list endpoints
10. ❌ **Physical card requests** (GET/POST)

### Phase 3: Enhanced Features (Week 3+)

11. ❌ **Dependant management** (POST/PATCH/DELETE)
12. ❌ **Support queries** system
13. ❌ **Advanced provider search** (geolocation, radius)
14. 🚧 **Claims multipart upload** (replace current upload URL approach)

---

## 🔧 Technical Debt & Improvements Needed

### Response Format Updates

All responses need to match OpenAPI schemas exactly:

- **BasicUser** - Add/ensure all required fields
- **HomeSummary** - Add `hasDigitalCard`, update `quickLinks` format
- **PackageSummary** - New schema implementation needed
- **DigitalCard** - Add QR image URL, barcode value, dates
- **Provider** - Add distance, rating, coordinates
- **Claim** - Add reference number, reimbursement fields
- **Dependant** - Ensure gender, status enums match spec

### Pagination

Implement consistent pagination across all list endpoints:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalItems": 100,
  "totalPages": 5
}
```

### Error Responses

Standardize error responses to match `ErrorResponse` schema:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input",
  "details": {},
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

### Worker Updates Required

| File | Changes Needed |
|------|----------------|
| `worker/src/index.js` | Update route matching for new endpoints |
| `worker/src/handlers/auth.js` | Split into `/register/id` and `/register/membership` |
| `worker/src/handlers/*.js` | Add missing handlers for new endpoints |

---

## 📊 Current Coverage

- **Authentication:** 100% ✅
- **Core Features:** 60% 🚧
- **User Management:** 0% ❌
- **Support Features:** 0% ❌
- **Enhanced Features:** 20% ❌

**Overall Completion:** ~35%

---

## 🚀 Next Steps

### Immediate (Today)

1. Update Worker to proxy new auth endpoints
2. Add `/me` GET/PATCH endpoints
3. Add `/packages/current` endpoint
4. Add `/support/contact-options` endpoint

### Short Term (This Week)

5. Update all response formats to match OpenAPI exactly
6. Add pagination to list endpoints
7. Implement individual resource endpoints (`/claims/{id}`, `/dependants/{id}`)
8. Add physical card request endpoints

### Medium Term (Next Week)

9. Implement dependant management (POST/PATCH/DELETE)
10. Implement support queries system
11. Add advanced provider search features
12. Add comprehensive error handling

---

## 📝 Notes

- **Legacy System Integration:** All endpoints should use synced member database for fast lookups, fall back to legacy API for real-time data when needed
- **Security:** All authenticated endpoints require JWT bearer token
- **Caching:** Worker KV caching strategy should be implemented for read-heavy endpoints
- **File Uploads:** OpenAPI spec uses multipart/form-data; current implementation uses separate upload URL approach (needs update)
- **Business Rules:** Dependant management (add/update/delete) may require approval workflow with HMS

---

## ✅ Quality Checklist

For each endpoint implementation:

- [ ] Route defined in Core API
- [ ] Service method implemented
- [ ] Request validation with Joi
- [ ] Response matches OpenAPI schema exactly
- [ ] Error handling with proper status codes
- [ ] Worker handler created
- [ ] Worker route proxies to Core API
- [ ] Logging added
- [ ] Database queries optimized
- [ ] Tests written (if applicable)

---

**Last Updated:** 2024-01-15
**Current Branch:** `claude/api-architecture-design-01XwG9LV45n2DKDafnd1yqCQ`
**Latest Commit:** Update authentication to match OpenAPI specification
