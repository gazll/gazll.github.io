# API Gateway - API Documentation

## Overview

The API Gateway serves as the single entry point for all client requests to the CalebZone microservices architecture.

**Base URL**: `http://localhost:8080` (Development)

## Table of Contents

1. [Authentication](#authentication)
2. [Gateway Endpoints](#gateway-endpoints)
3. [Service Routes](#service-routes)
4. [Error Responses](#error-responses)
5. [Headers](#headers)

---

## Authentication

### JWT Token Authentication

All protected endpoints require a valid JWT token in the `Authorization` header.

**Header Format**:
```
Authorization: Bearer <JWT_TOKEN>
```

### Obtaining a Token

**Endpoint**: `POST /auth/api/login`

**Request**:
```json
{
  "username": "user@example.com",
  "password": "your-password"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzUxMiJ9...",
  "user": {
    "id": 1,
    "username": "user@example.com",
    "email": "user@example.com"
  }
}
```

---

## Gateway Endpoints

### 1. Gateway Information

Get information about the gateway service.

**Endpoint**: `GET /gateway/info`

**Auth Required**: No

**Response**:
```json
{
  "service": "API Gateway",
  "timestamp": "2026-01-11T10:30:00",
  "status": "UP",
  "version": "0.0.1-SNAPSHOT",
  "buildTime": "2026-01-11T08:00:00Z"
}
```

---

### 2. Routes Summary

Get a summary of all configured routes.

**Endpoint**: `GET /gateway/routes/summary`

**Auth Required**: No

**Response**:
```json
{
  "totalRoutes": 5,
  "routes": [
    {
      "id": "auth-service-public",
      "uri": "http://localhost:8081",
      "predicates": [...]
    },
    {
      "id": "air-service",
      "uri": "http://localhost:8082",
      "predicates": [...]
    }
  ]
}
```

---

### 3. Health Check

Check the health status of the gateway and downstream services.

**Endpoint**: `GET /actuator/health`

**Auth Required**: No

**Response**:
```json
{
  "status": "UP",
  "components": {
    "gateway": {
      "status": "UP"
    },
    "authService": {
      "status": "UP",
      "details": {
        "service": "auth-service",
        "url": "http://localhost:8081"
      }
    },
    "airService": {
      "status": "UP",
      "details": {
        "service": "air-service",
        "url": "http://localhost:8082"
      }
    },
    "aiRecognitionService": {
      "status": "DOWN",
      "details": {
        "service": "ai-recognition-service",
        "url": "http://localhost:8083",
        "error": "Connection refused"
      }
    },
    "redis": {
      "status": "UP"
    }
  }
}
```

---

### 4. Metrics

Get Prometheus-formatted metrics.

**Endpoint**: `GET /actuator/prometheus`

**Auth Required**: No

**Response**: Prometheus metrics format

```
# HELP gateway_requests_total Total number of requests
# TYPE gateway_requests_total counter
gateway_requests_total 1250.0

# HELP gateway_requests_duration_seconds Request duration
# TYPE gateway_requests_duration_seconds histogram
gateway_requests_duration_seconds_bucket{path="/auth/api/users",method="GET",status="200",le="0.1"} 95.0
```

---

### 5. Circuit Breaker Status

Get circuit breaker status for all services.

**Endpoint**: `GET /actuator/circuitbreakers`

**Auth Required**: No

**Response**:
```json
{
  "circuitBreakers": {
    "auth-service-cb": {
      "state": "CLOSED",
      "failureRate": "5.2%",
      "slowCallRate": "0.0%",
      "bufferedCalls": 100,
      "failedCalls": 5,
      "notPermittedCalls": 0
    },
    "air-service-cb": {
      "state": "OPEN",
      "failureRate": "65.0%",
      "waitDurationInOpenState": "30s"
    }
  }
}
```

---

## Service Routes

### Auth Service Routes

**Base Path**: `/auth/api`

**Upstream**: `http://localhost:8081`

#### Public Endpoints (No Authentication)

- `POST /auth/api/login` - User login
- `POST /auth/api/register` - User registration
- `POST /auth/api/users/login` - Alternative login endpoint
- `GET /auth/api/users` - List users (public view)
- `GET /auth/api/profiles/{username}` - Get user profile

#### Protected Endpoints (Authentication Required)

- `GET /auth/api/user` - Get current user
- `PUT /auth/api/user` - Update current user
- `GET /auth/api/users/{id}` - Get user by ID
- `PUT /auth/api/users/{id}` - Update user
- `DELETE /auth/api/users/{id}` - Delete user

**Rate Limit**: 
- Public: 200 req/s, burst 400
- Protected: 100 req/s, burst 200

---

### Air Service Routes

**Base Path**: `/air/api`

**Upstream**: `http://localhost:8082`

#### All Endpoints (Authentication Required)

- `GET /air/api/articles` - List articles
- `POST /air/api/articles` - Create article
- `GET /air/api/articles/{slug}` - Get article
- `PUT /air/api/articles/{slug}` - Update article
- `DELETE /air/api/articles/{slug}` - Delete article
- `GET /air/api/articles/feed` - Get user feed
- `POST /air/api/articles/{slug}/favorite` - Favorite article
- `DELETE /air/api/articles/{slug}/favorite` - Unfavorite article
- `POST /air/api/articles/{slug}/comments` - Add comment
- `GET /air/api/articles/{slug}/comments` - Get comments
- `DELETE /air/api/articles/{slug}/comments/{id}` - Delete comment

**Rate Limit**: 100 req/s, burst 200

---

### AI Recognition Service Routes

**Base Path**: `/ai/api`

**Upstream**: `http://localhost:8083`

#### All Endpoints (Authentication Required)

- `POST /ai/api/recognize` - Recognize image
- `POST /ai/api/recognize/batch` - Batch recognition
- `GET /ai/api/recognize/history` - Get recognition history
- `GET /ai/api/models` - List available models
- `POST /ai/api/train` - Train model (admin only)

**Rate Limit**: 50 req/s, burst 100

**Circuit Breaker**: Custom configuration with 30s timeout

---

## Error Responses

### Standard Error Format

All errors follow this format:

```json
{
  "success": false,
  "status": 401,
  "error": "Unauthorized",
  "errorCode": "UNAUTHORIZED",
  "message": "Authentication failed: Invalid token",
  "path": "/air/api/articles",
  "timestamp": "2026-01-11T10:30:00"
}
```

### HTTP Status Codes

| Code | Description | Meaning |
|------|-------------|---------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request format |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 502 | Bad Gateway | Upstream service error |
| 503 | Service Unavailable | Service down or circuit breaker open |
| 504 | Gateway Timeout | Request timeout |

---

## Headers

### Request Headers

#### Required for Protected Endpoints
- `Authorization: Bearer <token>` - JWT authentication token

#### Optional
- `Content-Type: application/json` - Request content type
- `Accept: application/json` - Response content type
- `X-Request-Id: <uuid>` - Custom request ID (auto-generated if not provided)

### Response Headers

#### Standard Headers
- `Content-Type: application/json` - Response content type
- `X-Request-Id: <uuid>` - Request tracking ID
- `X-Gateway-Request: true` - Indicates request passed through gateway
- `X-Gateway-Response: true` - Indicates response from gateway

#### Security Headers (All Responses)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Cache-Control: no-cache, no-store, max-age=0, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`

---

## Rate Limiting

### Headers

When rate limited, responses include:
- `X-RateLimit-Remaining: 50` - Remaining requests
- `X-RateLimit-Retry-After: 30` - Seconds until retry

### Rate Limit Error Response

```json
{
  "success": false,
  "status": 429,
  "error": "Too Many Requests",
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded. Please try again later.",
  "path": "/air/api/articles",
  "timestamp": "2026-01-11T10:30:00"
}
```

---

## Circuit Breaker

### Fallback Response

When a circuit breaker is open:

```json
{
  "success": false,
  "status": 503,
  "error": "Service Unavailable",
  "message": "The service is temporarily unavailable. Please try again later.",
  "path": "/air/api/articles"
}
```

### Circuit Breaker States

1. **CLOSED**: Normal operation, requests pass through
2. **OPEN**: Service unavailable, requests fail immediately with fallback
3. **HALF_OPEN**: Testing service recovery, limited requests allowed

---

## Examples

### Example 1: Login and Access Protected Resource

```bash
# 1. Login
curl -X POST http://localhost:8080/auth/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"password123"}'

# Response:
# {"token":"eyJhbGci...","user":{...}}

# 2. Use token to access protected resource
curl -X GET http://localhost:8080/air/api/articles \
  -H "Authorization: Bearer eyJhbGci..."
```

### Example 2: Check Service Health

```bash
curl http://localhost:8080/actuator/health
```

### Example 3: View Gateway Routes

```bash
curl http://localhost:8080/gateway/routes/summary
```

### Example 4: Monitor Metrics

```bash
curl http://localhost:8080/actuator/prometheus | grep gateway_requests
```

---

## Support

For issues or questions, please refer to:
- Main documentation: `/README.md`
- Implementation summary: `/IMPLEMENTATION_SUMMARY.md`
- Gateway health: `http://localhost:8080/actuator/health`

