# Gateway Architecture Overview

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  (Web Browser, Mobile App, Postman, curl, etc.)                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP/HTTPS Requests
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Port 8080)                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              GLOBAL FILTERS (Execution Order)              │  │
│  │  -3: DetailedLoggingFilter  → Request/Response logging     │  │
│  │  -2: RequestIdFilter        → Generate/forward Request ID  │  │
│  │  -1: LoggingFilter          → Standard logging             │  │
│  │   0: AuthenticationFilter   → JWT validation & forwarding  │  │
│  │   1: MetricsFilter          → Collect Prometheus metrics   │  │
│  │   2: SecurityHeadersFilter  → Add security headers         │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    ROUTE FILTERS                           │  │
│  │  • Rate Limiting (Redis)    • Circuit Breaker (Resilience)│  │
│  │  • Retry Logic              • Request/Response transform  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    ROUTE PREDICATES                        │  │
│  │  /auth/**  → Auth Service   (Public + Protected)          │  │
│  │  /air/**   → Air Service    (Protected)                   │  │
│  │  /ai/**    → AI Service     (Protected)                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────┬────────────┬─────────────┬──────────────────────────┘
           │            │             │
           │            │             │
    ┌──────▼──────┐ ┌──▼─────┐ ┌────▼─────┐
    │   Redis     │ │ Health │ │ Metrics  │
    │ (Rate Limit)│ │ Checks │ │Prometheus│
    │  Port 6479  │ └────────┘ └──────────┘
    └─────────────┘
           │
           │ Downstream Services
           │
    ┌──────┴───────────────────────────────────────┐
    │                                               │
    ▼                    ▼                          ▼
┌─────────┐        ┌─────────┐              ┌─────────┐
│  Auth   │        │   Air   │              │   AI    │
│ Service │        │ Service │              │ Service │
│  :8081  │        │  :8082  │              │  :8083  │
│         │        │         │              │         │
│ • Login │        │ • CRUD  │              │ • Image │
│ • Users │        │ • Feed  │              │   Recog │
│ • JWT   │        │ • Likes │              │ • Train │
└─────────┘        └─────────┘              └─────────┘
```

## 🔄 Request Flow

### 1. Authenticated Request Flow
```
Client Request
    │
    ├─→ [SecurityHeadersFilter] Add security headers
    │
    ├─→ [RequestIdFilter] Generate/extract request ID
    │
    ├─→ [LoggingFilter] Log request details
    │
    ├─→ [AuthenticationFilter] 
    │   ├─ Validate JWT token
    │   ├─ Extract user info
    │   └─ Forward to downstream
    │
    ├─→ [MetricsFilter] Collect metrics
    │
    ├─→ [Rate Limiter] Check rate limit
    │   └─ Fail: 429 Too Many Requests
    │
    ├─→ [Circuit Breaker] Check service health
    │   ├─ OPEN: Return fallback (503)
    │   └─ CLOSED/HALF_OPEN: Continue
    │
    ├─→ [Retry Logic] Attempt with backoff
    │
    └─→ Downstream Service
        └─→ Response
            └─→ Client
```

### 2. Public Endpoint Flow
```
Client Request (Public)
    │
    ├─→ [Global Filters] (No JWT validation)
    │
    ├─→ [Rate Limiter] IP-based limiting
    │
    ├─→ [Circuit Breaker]
    │
    └─→ Downstream Service
        └─→ Response
```

### 3. Circuit Breaker Flow
```
Normal Operation (CLOSED)
    │
    ├─→ Request passes through
    │
    └─→ Monitor failure rate
        │
        ├─ Failures < 50% → Stay CLOSED
        │
        └─ Failures ≥ 50% → Transition to OPEN
            │
            ├─→ Fail fast with fallback
            │
            └─→ Wait 30s → HALF_OPEN
                │
                ├─ Test requests succeed → CLOSED
                │
                └─ Test requests fail → OPEN
```

## 📊 Component Interaction

### Security Layer
```
JWT Token
    │
    ├─→ [JwtAuthenticationConverter]
    │   ├─ Decode token
    │   ├─ Verify signature (HMAC-SHA512)
    │   └─ Extract claims
    │
    ├─→ [SecurityConfig]
    │   ├─ Check endpoint security
    │   └─ Authorize access
    │
    └─→ [AuthenticationFilter]
        └─ Forward user info headers
```

### Resilience Layer
```
Incoming Request
    │
    ├─→ [Rate Limiter (Redis)]
    │   ├─ Check user/IP quota
    │   ├─ Decrement tokens
    │   └─ Allow/Reject
    │
    ├─→ [Circuit Breaker (Resilience4j)]
    │   ├─ Track success/failure
    │   ├─ Manage state transitions
    │   └─ Execute/Fallback
    │
    └─→ [Retry Logic]
        ├─ Attempt 1: Immediate
        ├─ Attempt 2: +100ms
        └─ Attempt 3: +500ms
```

### Monitoring Layer
```
Request Processing
    │
    ├─→ [MetricsFilter]
    │   ├─ Request counter
    │   ├─ Duration histogram
    │   └─ Status tracking
    │
    ├─→ [Health Indicators]
    │   ├─ Gateway health
    │   ├─ Service health
    │   └─ Redis health
    │
    └─→ [Actuator Endpoints]
        ├─ /actuator/health
        ├─ /actuator/metrics
        ├─ /actuator/prometheus
        └─ /actuator/circuitbreakers
```

## 🎯 Data Flow by Scenario

### Scenario 1: User Login
```
1. POST /auth/api/login
2. Gateway: Public endpoint (no JWT required)
3. Rate Limiter: 200 req/s (IP-based)
4. Circuit Breaker: Check auth service
5. Forward to Auth Service (8081)
6. Auth Service: Validate credentials
7. Auth Service: Generate JWT token
8. Return token to client
```

### Scenario 2: Create Article (Authenticated)
```
1. POST /air/api/articles + JWT token
2. Gateway: Protected endpoint
3. AuthenticationFilter: Validate JWT
4. Extract user info (userId, email)
5. Rate Limiter: 100 req/s (user-based)
6. Circuit Breaker: Check air service
7. Forward to Air Service with headers:
   - Authorization: Bearer <token>
   - X-Auth-User: username
   - X-Auth-User-Id: userId
   - X-Request-Id: uuid
8. Air Service: Process request
9. Return response to client
```

### Scenario 3: Service Down (Circuit Breaker)
```
1. Request to /air/api/articles
2. Circuit Breaker: OPEN state
3. Fail fast (no service call)
4. Return fallback response:
   {
     "status": 503,
     "message": "Air service is temporarily unavailable"
   }
5. Log circuit breaker event
```

### Scenario 4: Rate Limit Exceeded
```
1. Request from user (101st in 1 second)
2. Rate Limiter: Quota exceeded
3. Return 429 response:
   {
     "status": 429,
     "message": "Rate limit exceeded"
   }
4. Client must wait before retry
```

## 📈 Metrics Collection

```
Request → MetricsFilter
    │
    ├─→ gateway_requests_total (Counter)
    │   └─ Increment on each request
    │
    ├─→ gateway_requests_successful (Counter)
    │   └─ Increment on 2xx response
    │
    ├─→ gateway_requests_failed (Counter)
    │   └─ Increment on non-2xx response
    │
    └─→ gateway_requests_duration (Histogram)
        └─ Record processing time
            ├─ Tags: path, method, status
            └─ Buckets: 0.1s, 0.5s, 1s, 5s
```

## 🔒 Security Headers Applied

Every response includes:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Cache-Control: no-cache, no-store
Pragma: no-cache
Expires: 0
```

## 🎨 Technology Stack Visualization

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  • Spring Boot 3.5.7                    │
│  • Java 21                              │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│         Gateway Layer                   │
│  • Spring Cloud Gateway 2025.0.1        │
│  • Reactive WebFlux                     │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│         Security Layer                  │
│  • Spring Security OAuth2               │
│  • JWT Resource Server                  │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│         Resilience Layer                │
│  • Resilience4j Circuit Breaker         │
│  • Redis Rate Limiting                  │
│  • Retry with Backoff                   │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│         Observability Layer             │
│  • Micrometer Metrics                   │
│  • Prometheus Export                    │
│  • Spring Boot Actuator                 │
└─────────────────────────────────────────┘
```

---

**Last Updated**: January 11, 2026  
**Status**: Production Ready ✅

