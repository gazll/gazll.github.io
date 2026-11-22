# Gateway Quick Start Guide

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Java 21 or higher
- Redis (optional for dev, required for rate limiting)
- Maven (or use IDE)

### Option 1: Quick Start (Development)

**Windows:**
```powershell
# Start Redis (optional)
docker run -d -p 6479:6379 redis:7-alpine

# Start Gateway
cd gateway
.\start.bat
```

**Linux/Mac:**
```bash
# Start Redis (optional)
docker run -d -p 6479:6379 redis:7-alpine

# Start Gateway
cd gateway
chmod +x start.sh
./start.sh
```

Gateway will be available at: **http://localhost:8080**

### Option 2: Docker Compose (Recommended)

```bash
cd gateway
docker-compose up -d
```

### Verify Installation

**Quick Health Check:**
```bash
curl http://localhost:8080/actuator/health
```

**Run Test Suite:**
```powershell
# Windows
.\test-gateway.ps1

# Linux/Mac
chmod +x test-gateway.sh
./test-gateway.sh
```

## 📖 Common Tasks

### 1. Check Gateway Info
```bash
curl http://localhost:8080/gateway/info
```

### 2. View All Routes
```bash
curl http://localhost:8080/gateway/routes/summary
```

### 3. View Metrics
```bash
curl http://localhost:8080/actuator/metrics
curl http://localhost:8080/actuator/prometheus
```

### 4. Check Circuit Breaker Status
```bash
curl http://localhost:8080/actuator/circuitbreakers
```

### 5. Test Public Endpoint
```bash
curl http://localhost:8080/auth/api/users
```

### 6. Test Protected Endpoint (requires token)
```bash
# First get token from auth service
TOKEN=$(curl -s -X POST http://localhost:8080/auth/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"password"}' \
  | jq -r '.token')

# Use token to access protected endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/air/api/articles
```

## 🔧 Configuration

### Change Port
Edit `application-dev.yml`:
```yaml
server:
  port: 9000  # Change from 8080
```

### Update Service URLs
Edit `application-dev.yml`:
```yaml
services:
  auth:
    url: http://localhost:8081
  air:
    url: http://localhost:8082
  ai-recognition:
    url: http://localhost:8083
```

### Disable Rate Limiting (for development)
Edit `application-dev.yml`:
```yaml
spring:
  cloud:
    gateway:
      routes:
        # Remove RequestRateLimiter filter from routes
```

## 🐛 Troubleshooting

### Issue: Gateway won't start
**Solution:**
1. Check if port 8080 is available
2. Verify Java 21 is installed: `java -version`
3. Check logs in console output

### Issue: 503 Service Unavailable
**Solution:**
1. Check if downstream services are running
2. Verify service URLs in configuration
3. Check circuit breaker status: `curl http://localhost:8080/actuator/circuitbreakers`

### Issue: 401 Unauthorized
**Solution:**
1. Verify JWT token is valid
2. Check if token is expired
3. Ensure JWT secret matches auth service
4. Check if endpoint requires authentication

### Issue: 429 Too Many Requests
**Solution:**
1. Rate limit exceeded - wait and retry
2. Check Redis is running: `docker ps | grep redis`
3. Increase rate limits in `application-dev.yml`

### Issue: Redis connection error
**Solution:**
1. Start Redis: `docker run -d -p 6479:6379 redis:7-alpine`
2. Check Redis connection: `redis-cli -h localhost -p 6479 ping`
3. For dev without rate limiting, remove rate limit filters from config

## 📚 Documentation

- **User Guide**: [README.md](README.md)
- **API Reference**: [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **Implementation Details**: [IMPLEMENTATION_SUMMARY_NEW.md](IMPLEMENTATION_SUMMARY_NEW.md)
- **Checklist**: [DEVELOPMENT_CHECKLIST.md](DEVELOPMENT_CHECKLIST.md)

## 🔗 Useful URLs

| URL | Description |
|-----|-------------|
| http://localhost:8080/actuator/health | Health check |
| http://localhost:8080/gateway/info | Gateway information |
| http://localhost:8080/gateway/routes/summary | All routes |
| http://localhost:8080/actuator/metrics | Metrics |
| http://localhost:8080/actuator/prometheus | Prometheus format |
| http://localhost:8080/actuator/circuitbreakers | Circuit breaker status |

## 🎯 Next Steps

1. ✅ Gateway is running
2. 📝 Read [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for API details
3. 🧪 Run test suite to verify functionality
4. 🔐 Configure JWT secret for production
5. 🐳 Deploy with Docker Compose for full setup

## 💡 Tips

- Use `dev` profile for development (default)
- Use `prod` profile for production deployment
- Enable detailed logging by setting `ENABLE_BODY_LOGGING=true` in `DetailedLoggingFilter.java`
- Monitor metrics at `/actuator/prometheus` with Prometheus/Grafana
- Check circuit breaker status regularly during development

## 📞 Support

For issues or questions:
1. Check logs in console output
2. Review documentation files
3. Check actuator health endpoints
4. Verify downstream services are running

---

**Happy coding!** 🚀

