# API Gateway

API Gateway service using Spring Cloud Gateway with JWT Resource Server for authentication and routing requests to downstream microservices.

## Features

### Core Features
- **Spring Cloud Gateway**: Advanced routing and filtering of requests
- **JWT Resource Server**: JWT token authentication from Auth service
- **Circuit Breaker**: Resilience4j for fault tolerance and service resilience
- **Rate Limiting**: Redis-based rate limiting per user/IP
- **CORS Configuration**: Cross-Origin Resource Sharing support
- **Load Balancing**: Client-side load balancing for downstream services

### Monitoring & Observability
- **Request Logging**: Comprehensive logging of all requests and responses
- **Metrics**: Prometheus metrics for monitoring gateway performance
- **Health Checks**: Real-time health monitoring of downstream services
- **Request ID Tracking**: Unique request ID for distributed tracing

### Security Features
- **Authentication Filter**: Forwards JWT token and user info to downstream services
- **Security Headers**: Adds security headers to all responses
- **Global Error Handling**: Centralized error handling with custom error responses
- **Public/Protected Routes**: Flexible route security configuration

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│         API Gateway (Port 8080)         │
│  ┌────────────────────────────────┐    │
│  │  Global Filters                 │    │
│  │  - Request ID                   │    │
│  │  - Logging                      │    │
│  │  - Authentication               │    │
│  │  - Security Headers             │    │
│  │  - Metrics                      │    │
│  └────────────────────────────────┘    │
│  ┌────────────────────────────────┐    │
│  │  Route Filters                  │    │
│  │  - Rate Limiting                │    │
│  │  - Circuit Breaker              │    │
│  │  - Retry Logic                  │    │
│  └────────────────────────────────┘    │
└──────┬──────────┬──────────┬───────────┘
       │          │          │
       ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│   Auth   │ │   Air    │ │    AI    │
│ Service  │ │ Service  │ │ Service  │
│  :8081   │ │  :8082   │ │  :8083   │
└──────────┘ └──────────┘ └──────────┘
```

## Routes Configuration

Gateway routes requests to the following services:

| Path Prefix | Service | Port | Description | Circuit Breaker |
|------------|---------|------|-------------|-----------------|
| `/auth/**` | Auth Service | 8081 | Authentication & User management | ✓ |
| `/air/**` | Air Service | 8082 | Air application | ✓ |
| `/ai/**` | AI Recognition Service | 8083 | AI Recognition features | ✓ |

## Port

- Gateway runs on port: **8080**

## Public Endpoints (No JWT Required)

The following endpoints do not require authentication:
- `/auth/api/login`
- `/auth/api/register`
- `/auth/api/users/login`
- `/auth/api/users` (GET, POST)
- `/auth/api/profiles/**`
- `/actuator/**`
- `/gateway/**`
- `/swagger-ui/**`
- `/v3/api-docs/**`

## Secured Endpoints

All other endpoints require a valid JWT token in the header:
```
Authorization: Bearer <JWT_TOKEN>
```

## How to Use

### 1. Get JWT Token from Auth Service
```bash
curl -X POST http://localhost:8080/auth/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your-username",
    "password": "your-password"
  }'
```

### 2. Use Token to Call Secured Endpoints
```bash
curl -X GET http://localhost:8080/air/api/some-endpoint \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### 3. Check Gateway Health
```bash
curl http://localhost:8080/actuator/health
```

### 4. View Gateway Routes
```bash
curl http://localhost:8080/gateway/routes/summary
```

## Rate Limiting

Gateway uses Redis for rate limiting:

| Service | Replenish Rate | Burst Capacity | Description |
|---------|----------------|----------------|-------------|
| Auth Service (Public) | 200 req/s | 400 | Login, register endpoints |
| Auth Service (Protected) | 100 req/s | 200 | Authenticated endpoints |
| Air Service | 100 req/s | 200 | Standard rate limit |
| AI Service | 50 req/s | 100 | Lower rate due to heavy processing |

Rate limiting key resolver:
- Authenticated users: Based on username
- Anonymous users: Based on IP address

## Circuit Breaker

Resilience4j circuit breaker configuration:

### Default Configuration
- **Sliding Window**: 10 requests (COUNT_BASED)
- **Failure Rate Threshold**: 50%
- **Minimum Calls**: 5
- **Wait Duration (Open State)**: 30 seconds
- **Half-Open Calls**: 3
- **Timeout**: 10 seconds

### AI Service Configuration (Custom)
- **Sliding Window**: 20 requests
- **Failure Rate Threshold**: 60%
- **Minimum Calls**: 10
- **Wait Duration (Open State)**: 60 seconds
- **Timeout**: 30 seconds

Circuit breaker states:
- **CLOSED**: Normal operation
- **OPEN**: Service unavailable, requests fail fast with fallback
- **HALF_OPEN**: Testing if service recovered

## Global Filters

Filters execute in the following order:

1. **DetailedLoggingFilter** (Order: -3) - Debug request/response logging
2. **RequestIdFilter** (Order: -2) - Generate/forward request ID
3. **LoggingFilter** (Order: -1) - Log requests and responses
4. **AuthenticationFilter** (Order: 0) - Forward JWT and user info
5. **MetricsFilter** (Order: 1) - Collect Prometheus metrics
6. **SecurityHeadersFilter** (Order: 2) - Add security headers

## Monitoring & Metrics

### Actuator Endpoints

Available at `/actuator`:
- `/actuator/health` - Gateway and downstream services health
- `/actuator/metrics` - Micrometer metrics
- `/actuator/prometheus` - Prometheus metrics endpoint
- `/actuator/gateway/routes` - List all routes
- `/actuator/circuitbreakers` - Circuit breaker status
- `/actuator/circuitbreakerevents` - Circuit breaker events

### Custom Metrics

- `gateway.requests.total` - Total requests count
- `gateway.requests.successful` - Successful requests count
- `gateway.requests.failed` - Failed requests count
- `gateway.requests.duration` - Request duration histogram (by path, method, status)

### Health Indicators

Custom health indicators for downstream services:
- `authService` - Auth service health
- `airService` - Air service health
- `aiRecognitionService` - AI service health

## Security Headers

All responses include the following security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Cache-Control: no-cache, no-store, max-age=0, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`

## Configuration

### Environment Variables (Production)

```bash
# Server
SERVER_PORT=8080

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Service URLs
AUTH_SERVICE_URL=http://auth-service:8081
AIR_SERVICE_URL=http://air-service:8082
AI_SERVICE_URL=http://ai-recognition-service:8083

# JWT Secret (must match auth service)
JWT_SECRET=your-base64-encoded-secret
```

### Application Profiles

- `dev` - Development environment (localhost services)
- `test` - Testing environment
- `prod` - Production environment (containerized services)

## Dependencies

- **Spring Cloud Gateway** - API Gateway framework
- **Spring Security OAuth2 Resource Server** - JWT authentication
- **Resilience4j** - Circuit breaker and resilience patterns
- **Spring Data Redis Reactive** - Reactive Redis for rate limiting
- **Micrometer** - Metrics collection
- **Spring Boot Actuator** - Health checks and monitoring
- **Spring Cloud Load Balancer** - Client-side load balancing

## Running the Gateway

### Development Mode

```bash
cd gateway
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

Or use the provided script:
```bash
./start.sh  # Linux/Mac
start.bat   # Windows
```

### Docker Mode

```bash
docker build -t gateway:latest .
docker run -p 8080:8080 -e SPRING_PROFILES_ACTIVE=prod gateway:latest
```

### Docker Compose

See `docker-compose.yml` for multi-service deployment.

## Testing

### Health Check
```bash
curl http://localhost:8080/actuator/health
```

### Route Testing
```bash
# Test public endpoint
curl http://localhost:8080/auth/api/users

# Test with authentication
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:8080/air/api/articles
```

### Circuit Breaker Testing
```bash
# View circuit breaker status
curl http://localhost:8080/actuator/circuitbreakers

# Trigger circuit breaker by stopping a service
# Then make requests to see fallback behavior
```

## Error Responses

Standard error response format:
```json
{
  "success": false,
  "status": 500,
  "error": "Internal Server Error",
  "errorCode": "INTERNAL_SERVER_ERROR",
  "message": "Detailed error message",
  "path": "/api/endpoint",
  "timestamp": "2026-01-11T10:30:00"
}
```

## Troubleshooting

### Common Issues

1. **503 Service Unavailable**
   - Check if downstream services are running
   - Check circuit breaker status
   - Verify service URLs in configuration

2. **401 Unauthorized**
   - Verify JWT token is valid
   - Check JWT secret matches auth service
   - Ensure token is not expired

3. **429 Too Many Requests**
   - Rate limit exceeded
   - Wait before retrying
   - Check Redis connection

4. **504 Gateway Timeout**
   - Increase timeout in circuit breaker config
   - Check downstream service performance
   - Review network latency

## Development Notes

- JWT secret must match the auth service configuration
- Redis is required for rate limiting (can be disabled in dev)
- Circuit breaker fallbacks return 503 with descriptive messages
- Request IDs are forwarded to all downstream services for tracing
- Metrics are exposed on `/actuator/prometheus` for Prometheus scraping

## License

Internal project - CalebZone Application
## Configuration Files

- `application.yml`: Cấu hình chung
- `application-dev.yml`: Cấu hình cho môi trường development

## Filters

### Global Filters
1. **LoggingFilter**: Log tất cả requests/responses
2. **AuthenticationFilter**: Forward JWT token và user info đến downstream services

### Route Filters
- **RequestRateLimiter**: Rate limiting per service
- **DedupeResponseHeader**: Remove duplicate headers
- **Custom headers**: Add X-Gateway-Request header

## Security Configuration

JWT verification sử dụng cùng secret key với Auth service. Secret key được cấu hình trong `application.yml`:
```yaml
application:
  security:
    authentication:
      jwt:
        base64-secret: <SAME_SECRET_AS_AUTH_SERVICE>
```

## Monitoring

Health check và monitoring endpoints:
- Health: `http://localhost:8080/actuator/health`
- Gateway routes: `http://localhost:8080/actuator/gateway/routes`

## Development

Chạy service:
```bash
mvn spring-boot:run
```

Hoặc build và chạy:
```bash
mvn clean package
java -jar target/gateway-0.0.1-SNAPSHOT.jar
```

```markdown
com.company.gateway 
├── config 
│ ├── GatewayConfig.java // Cấu hình RouteLocator (Java DSL) │ ├── SecurityConfig.java // Cấu hình OAuth2 Login, CSRF, CORS │ └── WebClientConfig.java // Cấu hình WebClient (Timeout, Retry) ├── filter │ ├── global // Các filter chạy cho mọi request (Logging, Metrics) │ │ ├── GlobalLoggingFilter.java │ │ └── RequestIdFilter.java │ └── factory // Các filter tùy biến cho từng route cụ thể │ └── CustomRateLimitGatewayFilterFactory.java ├── handler // Xử lý lỗi tập trung │ └── GlobalErrorWebExceptionHandler.java // Trả về JSON lỗi chuẩn hóa ├── client // Các Client gọi ra ngoài (Reactive Only!) │ ├── auth // Gọi sang Auth Service (nếu cần introspection) │ │ ├── AuthWebClient.java // Sử dụng WebClient, KHÔNG dùng Feign │ │ └── dto // DTO cho Auth response │ └── monitoring // Gọi sang hệ thống giám sát └── health // Custom Health Indicators └── UpstreamServiceHealthIndicator.java
```
