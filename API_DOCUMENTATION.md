# BHM API Documentation

Base URL: `https://your-worker.workers.dev`

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

Tokens are obtained through login or registration and are valid for 1 hour.

---

## Public Endpoints

### Health Check

Check API status

```http
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "worker": "bhm-api",
  "version": "1.0.0"
}
```

---

### Register User

Register a new user account

```http
POST /api/auth/register
```

**Request Body:**

```json
{
  "mode": "id",
  "idNumber": "8901015800084",
  "email": "john.doe@example.com",
  "username": "johndoe",
  "password": "SecurePass123"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| mode | string | Yes | Either "id" or "memberNumber" |
| idNumber | string | Conditional | Required if mode is "id" |
| memberNumber | string | Conditional | Required if mode is "memberNumber" |
| email | string | Yes | Valid email address |
| username | string | Yes | 3-50 characters |
| password | string | Yes | Minimum 8 characters |

**Response:** `201 Created`

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "johndoe",
    "email": "john.doe@example.com",
    "memberNumber": "BHM123456"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

- `400 Bad Request` - Invalid input
- `404 Not Found` - No active membership found
- `409 Conflict` - Username/email already exists or membership already registered

---

### Login

Authenticate user and receive JWT token

```http
POST /api/auth/login
```

**Request Body:**

```json
{
  "username": "johndoe",
  "password": "SecurePass123"
}
```

**Response:** `200 OK`

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "johndoe",
    "email": "john.doe@example.com",
    "memberNumber": "BHM123456",
    "firstName": "John",
    "lastName": "Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

- `400 Bad Request` - Missing username or password
- `401 Unauthorized` - Invalid credentials

---

## Authenticated Endpoints

All endpoints below require authentication via JWT token.

### Get Home Dashboard

Get aggregated dashboard data

```http
GET /api/home
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
  "member": {
    "memberNumber": "BHM123456",
    "firstName": "John",
    "lastName": "Doe",
    "status": "active"
  },
  "plan": {
    "id": "plan-001",
    "name": "Premium Health Plan",
    "description": "Comprehensive coverage for you and your family",
    "benefits": [
      "Unlimited GP visits",
      "Specialist consultations",
      "Hospitalization coverage",
      "Prescription medication"
    ]
  },
  "coverage": {
    "annualLimit": 50000,
    "used": 12500,
    "remaining": 37500
  },
  "dependants": {
    "count": 2,
    "list": [
      {
        "id": "dep-001",
        "firstName": "Jane",
        "lastName": "Doe",
        "relationship": "Spouse",
        "dateOfBirth": "1990-05-15",
        "status": "active"
      }
    ]
  },
  "recentClaims": {
    "count": 3,
    "list": [
      {
        "id": "claim-001",
        "claimNumber": "CLM-2024-001",
        "type": "Medical",
        "provider": "City Hospital",
        "date": "2024-01-10",
        "amount": 1500.00,
        "status": "approved",
        "description": "Consultation and tests"
      }
    ]
  },
  "quickActions": [
    { "id": "submit_claim", "label": "Submit Claim", "icon": "file-plus" },
    { "id": "find_provider", "label": "Find Provider", "icon": "search" },
    { "id": "view_card", "label": "View Card", "icon": "id-card" },
    { "id": "download_certificate", "label": "Certificate", "icon": "download" }
  ]
}
```

---

### Get Digital Card

Get digital membership card information

```http
GET /api/card
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
  "memberNumber": "BHM123456",
  "memberName": "John Doe",
  "planName": "Premium Health Plan",
  "effectiveDate": "2023-01-01",
  "expiryDate": "2024-12-31",
  "qrCode": "BHM:BHM123456:1705315800000",
  "barcode": "BHM123456"
}
```

---

### Get Dependants

List all dependants

```http
GET /api/dependants
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
  "principal": {
    "firstName": "John",
    "lastName": "Doe",
    "memberNumber": "BHM123456",
    "relationship": "Principal Member"
  },
  "dependants": [
    {
      "id": "dep-001",
      "firstName": "Jane",
      "lastName": "Doe",
      "relationship": "Spouse",
      "dateOfBirth": "1990-05-15",
      "status": "active"
    },
    {
      "id": "dep-002",
      "firstName": "Jack",
      "lastName": "Doe",
      "relationship": "Child",
      "dateOfBirth": "2015-08-20",
      "status": "active"
    }
  ]
}
```

---

### Search Providers

Search for healthcare providers

```http
GET /api/providers/search?query=hospital&location=Johannesburg
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | No | Search term (name, specialty) |
| location | string | No | City or province |
| type | string | No | Provider type (hospital, clinic, pharmacy) |
| specialty | string | No | Medical specialty |
| limit | number | No | Results per page (default: 50, max: 100) |
| offset | number | No | Pagination offset (default: 0) |

**Response:** `200 OK`

```json
{
  "providers": [
    {
      "id": "prov-001",
      "name": "City Hospital",
      "type": "hospital",
      "specialties": ["General", "Emergency", "Surgery"],
      "address": "123 Main Street",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2000",
      "phone": "+27 11 123 4567",
      "email": "info@cityhospital.co.za",
      "coordinates": { "lat": -26.2041, "lng": 28.0473 },
      "networkStatus": "in-network"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

### Get Claims

List user's claims

```http
GET /api/claims?limit=20&offset=0&status=approved
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Results per page (default: 50, max: 100) |
| offset | number | No | Pagination offset (default: 0) |
| status | string | No | Filter by status: pending, approved, rejected, processing |

**Response:** `200 OK`

```json
{
  "claims": [
    {
      "id": "claim-001",
      "claimNumber": "CLM-2024-001",
      "type": "Medical",
      "provider": "City Hospital",
      "date": "2024-01-10",
      "amount": 1500.00,
      "status": "approved",
      "description": "Consultation and tests",
      "documents": []
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

### Submit Claim

Submit a new claim

```http
POST /api/claims
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "type": "Medical",
  "providerName": "City Hospital",
  "serviceDate": "2024-01-15",
  "amount": 2500.00,
  "description": "Emergency consultation",
  "diagnosisCode": "R10.9"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Claim type (Medical, Dental, Optical, etc.) |
| providerId | string | No | Provider ID if known |
| providerName | string | Yes | Provider name |
| serviceDate | string | Yes | Date of service (ISO 8601) |
| amount | number | Yes | Claim amount (positive number) |
| description | string | No | Additional details (max 500 chars) |
| diagnosisCode | string | No | ICD-10 diagnosis code |

**Response:** `201 Created`

```json
{
  "id": "claim-002",
  "claimNumber": "CLM-2024-002",
  "type": "Medical",
  "provider": "City Hospital",
  "date": "2024-01-15",
  "amount": 2500.00,
  "status": "pending",
  "description": "Emergency consultation"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid input (missing fields, negative amount, future date)
- `401 Unauthorized` - Invalid or missing token

---

### Get Upload URL for Claim Document

Get a presigned URL for uploading claim documents

```http
POST /api/claims/:claimId/upload
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "fileName": "invoice.pdf",
  "fileType": "application/pdf",
  "fileSize": 524288
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fileName | string | Yes | Original file name |
| fileType | string | Yes | MIME type (application/pdf, image/jpeg, image/png) |
| fileSize | number | Yes | File size in bytes (max 10MB) |

**Response:** `200 OK`

```json
{
  "uploadUrl": "https://storage.example.com/upload?key=claims/...",
  "fileKey": "claims/user-id/claim-id/uuid-invoice.pdf",
  "expiresIn": 3600,
  "method": "PUT",
  "headers": {
    "Content-Type": "application/pdf"
  }
}
```

**Error Responses:**

- `400 Bad Request` - File too large or invalid type
- `404 Not Found` - Claim not found

---

### Get Membership Certificate

Get membership certificate data

```http
GET /api/membership-certificate
Authorization: Bearer <token>
```

**Response:** `200 OK`

```json
{
  "certificateNumber": "CERT-2024-BHM123456",
  "memberName": "John Doe",
  "memberNumber": "BHM123456",
  "planName": "Premium Health Plan",
  "effectiveDate": "2023-01-01",
  "expiryDate": "2024-12-31",
  "issueDate": "2024-01-15",
  "pdfUrl": "https://storage.example.com/certificates/..."
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "\"email\" must be a valid email"
    }
  ],
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 404 Not Found

```json
{
  "error": "Not found",
  "message": "Route GET /api/invalid not found",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 429 Too Many Requests

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Try again later.",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Rate Limiting

- **Unauthenticated requests**: 20 requests per minute per IP
- **Authenticated requests**: 100 requests per minute per user

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705315800
```

---

## Request IDs

All responses include an `X-Request-ID` header for debugging and support:

```
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

Include this ID when reporting issues.
