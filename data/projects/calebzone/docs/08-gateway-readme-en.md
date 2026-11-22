# API Gateway Service

Spring Cloud Gateway with OAuth2 Resource Server (JWT) for the Calebzone microservices platform.

## Overview

This gateway service acts as a single entry point for all microservices, providing:
- **JWT-based authentication** using OAuth2 Resource Server
- **Routing** to downstream services (Auth, Air, AI Recognition)
- **Rate limiting** using Redis
- **CORS** configuration for cross-origin requests
- **Request tracing** with request ID
- **Retry and circuit breaker** patterns
- **Global exception handling**

## Architecture

```
Client → Gateway (Port 8080) → Microservices
                               ├─ Auth Service (8081)
                               ├─ Air Service (8082)
                               └─ AI Recognition Service (8083)
```

## Features

### 1. JWT Resource Server
- Validates JWT tokens using HMAC-SHA512 algorithm
- Extracts user information and authorities from JWT claims
- Forwards authentication context to downstream services via headers:
  - `X-Auth-User`: Username
  - `X-Auth-User-Id`: User ID
  - `X-Auth-Email`: User email
  - `X-Auth-Token`: Full Authorization header

### 2. Route Configuration

#### Public Routes (No Authentication Required)
- `POST /auth/api/login` - User login
- `POST /auth/api/register` - User registration
- `POST /auth/api/users/login` - Alternative login endpoint
- `GET /auth/api/users` - List users
- `GET /auth/api/profiles/**` - Public profile access
- `GET /gateway/health` - Gateway health check
- `GET /gateway/info` - Gateway information

#### Protected Routes (Authentication Required)
- `/auth/api/**` - Auth service endpoints
- `/air/api/**` - Air service endpoints
- `/ai/api/**` - AI Recognition service endpoints

### 3. Rate Limiting
Redis-based rate limiting per user/IP:
- **Auth Service Public**: 200 req/sec (burst: 400)
- **Auth Service Protected**: 100 req/sec (burst: 200)
- **Air Service**: 100 req/sec (burst: 200)
- **AI Recognition**: 50 req/sec (burst: 100)

### 4. Global Filters
- **RequestIdFilter**: Adds unique request ID for tracing
- **AuthenticationFilter**: Extracts and forwards user context
- **LoggingFilter**: Logs all requests and responses

### 5. Error Handling
Standardized error responses with:
- Success flag
- HTTP status code
- Error message
- Request path
- Timestamp

## Configuration

### JWT Secret
Both Gateway and Auth service must share the same JWT secret:

```yaml
application:
  security:
    authentication:
      jwt:
        base64-secret: <your-base64-encoded-secret>
```

### Redis Configuration
```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6479
      password:
```

### Service URLs
```yaml
services:
  auth:
    url: http://localhost:8081
  air:
    url: http://localhost:8082
  ai-recognition:
    url: http://localhost:8083
```

## Running the Gateway

### Prerequisites
- Java 17+
- Redis server running on port 6479
- Auth service running on port 8081

### Start the Gateway
```bash
mvn spring-boot:run
```

### Or with specific profile
```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

## Testing

### Health Check
```bash
curl http://localhost:8080/gateway/health
```

### Login (Public)
```bash
curl -X POST http://localhost:8080/auth/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password"
  }'
```

### Protected Endpoint (with JWT)
```bash
curl http://localhost:8080/auth/api/user \
  -H "Authorization: Bearer <your-jwt-token>"
```

## Development

### Project Structure
```
gateway/
├── src/main/java/com/calebzone/gateway/
│   ├── GatewayApplication.java          # Main application class
│   ├── config/                          # Configuration classes
│   │   ├── SecurityConfig.java          # OAuth2 Resource Server config
│   │   ├── GatewayRoutesConfig.java     # Route definitions
│   │   ├── RateLimitConfig.java         # Rate limiting config
│   │   ├── CorsConfig.java              # CORS configuration
│   │   ├── JwtAuthenticationConverter.java # JWT converter
│   │   ├── WebClientConfig.java         # WebClient configuration
│   │   └── JacksonConfig.java           # Jackson JSON config
│   ├── filter/                          # Global filters
│   │   ├── AuthenticationFilter.java    # Auth context forwarding
│   │   ├── LoggingFilter.java          # Request/response logging
│   │   └── RequestIdFilter.java        # Request ID generation
│   ├── exception/                       # Exception handling
│   │   ├── GlobalExceptionHandler.java
│   │   └── GlobalErrorAttributes.java
│   ├── client/                          # Service clients
│   │   └── AuthServiceClient.java       # Auth service client
│   ├── controller/                      # Gateway controllers
│   │   └── GatewayHealthController.java # Health endpoints
│   └── dto/                             # Data transfer objects
│       ├── ApiResponse.java             # Standard response wrapper
│       └── ErrorResponse.java           # Error response DTO
└── src/main/resources/
    ├── application.yml                  # Main configuration
    └── application-dev.yml              # Dev profile configuration
```

### Adding New Routes

1. **Programmatic Configuration** (GatewayRoutesConfig.java):
```java
.route("new-service", r -> r
    .path("/new/api/**")
    .filters(f -> f
        .addRequestHeader("X-Gateway-Request", "true")
        .retry(config -> config.setRetries(2))
    )
    .uri("http://localhost:8084")
)
```

2. **YAML Configuration** (application-dev.yml):
```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: new-service
          uri: http://localhost:8084
          predicates:
            - Path=/new/api/**
          filters:
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 100
                redis-rate-limiter.burstCapacity: 200
```

## Security Considerations

1. **JWT Secret**: Use a strong, randomly generated secret (minimum 512 bits for HS512)
2. **CORS**: Configure specific origins in production (avoid using `*`)
3. **Rate Limiting**: Adjust limits based on your requirements
4. **HTTPS**: Use HTTPS in production
5. **Redis Security**: Enable Redis authentication in production

## Monitoring

### Actuator Endpoints
- `/actuator/health` - Health status
- `/actuator/info` - Application info
- `/actuator/gateway/routes` - List all routes

### Logging
Configure logging levels in `application.yml`:
```yaml
logging:
  level:
    com.calebzone.gateway: DEBUG
    org.springframework.cloud.gateway: DEBUG
    org.springframework.security: DEBUG
```

## Troubleshooting

### Common Issues

1. **JWT Validation Fails**
   - Verify JWT secret matches between gateway and auth service
   - Check token expiration
   - Ensure correct algorithm (HS512)

2. **Rate Limiting Not Working**
   - Verify Redis is running and accessible
   - Check Redis connection configuration

3. **Routes Not Working**
   - Verify downstream services are running
   - Check route predicates and filters
   - Review gateway logs for routing errors

## Dependencies

Key dependencies:
- Spring Cloud Gateway
- Spring Security OAuth2 Resource Server
- Spring Boot WebFlux (reactive)
- Spring Data Redis Reactive
- Spring Cloud LoadBalancer

See `pom.xml` for complete dependency list.

## License

Copyright (c) 2026 Calebzone

