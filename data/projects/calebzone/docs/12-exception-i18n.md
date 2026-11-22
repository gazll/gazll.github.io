# Exception Handling & Internationalization (i18n) Guide

## Overview

This project uses a modular approach to exception handling and internationalization that allows code reuse across modules (core, air, auth) while maintaining flexibility for module-specific customizations.

## Architecture

### Core Module
The `core` module provides base exception handling and i18n infrastructure that can be inherited by all other modules:

- **GlobalExceptionHandler**: Base exception handler with i18n support
- **MessageSourceConfiguration**: Configures message sources for i18n
- **ErrorConstants**: Standard error codes and HTTP status mappings
- Message files in `core/src/main/resources/i18n/`

### Module-Specific Handlers
Each module (air, auth) can extend the core functionality:

- Inherits all core exception handling and i18n messages
- Can add module-specific exception handlers
- Can override or extend message translations
- Uses `@Order` annotation to control handler precedence

## How It Works

### 1. Exception Handler Hierarchy

```
GlobalExceptionHandler (core) - @Order(Ordered.LOWEST_PRECEDENCE)
    ↑ extends
    |
    +-- AuthExceptionHandler (auth) - @Order(Ordered.HIGHEST_PRECEDENCE)
    |
    +-- AirExceptionHandler (air) - @Order(Ordered.HIGHEST_PRECEDENCE + 10)
```

**Precedence Rules:**
- Lower order number = Higher precedence
- Child handlers are checked first before falling back to parent
- This allows modules to override specific exceptions while inheriting default behavior

### 2. Message Resolution

Messages are resolved in this order:
1. Module-specific messages (e.g., `air/i18n/messages_vi.properties`)
2. Core messages (e.g., `core/i18n/messages_vi.properties`)
3. Code as fallback if no message found

**Supported Languages:**
- English (default): `messages.properties` or `messages_en.properties`
- Vietnamese: `messages_vi.properties`

## Usage Examples

### Core Module (Automatic)

The core module is automatically configured. No additional setup needed in application modules.

**GlobalExceptionHandler** handles:
- Validation errors (`MethodArgumentNotValidException`)
- Request format errors (`HttpMessageNotReadableException`)
- Custom exceptions (`ErrorResponseException`, `BadRequestException`)
- Generic unhandled exceptions

### Air Module

1. **Create custom exception handler** (optional):

```java
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class AirExceptionHandler extends GlobalExceptionHandler {
    
    public AirExceptionHandler(MessageSource messageSource) {
        super(messageSource);
    }
    
    @ExceptionHandler(FlightSearchException.class)
    protected ResponseEntity<Object> handleFlightSearchException(
            FlightSearchException ex, WebRequest request) {
        return handleExceptionInternal(ex, AirErrorConstants.FLIGHT_SEARCH_FAILED, request);
    }
}
```

2. **Add module-specific messages**:

Create `air/src/main/resources/i18n/messages_en.properties`:
```properties
air.search.no_results=No flights found for the specified criteria.
air.booking.price_changed=The price has changed. Current price: {0} {1}.
```

Create `air/src/main/resources/i18n/messages_vi.properties`:
```properties
air.search.no_results=Không tìm thấy chuyến bay phù hợp.
air.booking.price_changed=Giá đã thay đổi. Giá hiện tại: {0} {1}.
```

### Auth Module

1. **Create custom exception handler** for Spring Security:

```java
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AuthExceptionHandler extends GlobalExceptionHandler {
    
    @ExceptionHandler(BadCredentialsException.class)
    protected ResponseEntity<Object> handleBadCredentials(
            BadCredentialsException ex, WebRequest request) {
        return handleExceptionInternal(ex, ErrorConstants.AUTH_BAD_CREDENTIAL, request);
    }
    
    @ExceptionHandler(AccessDeniedException.class)
    protected ResponseEntity<Object> handleAccessDenied(
            AccessDeniedException ex, WebRequest request) {
        return handleExceptionInternal(ex, ErrorConstants.AUTH_NO_PERMISSION, request);
    }
}
```

2. **Add auth-specific messages**:

Create `auth/src/main/resources/i18n/messages_en.properties`:
```properties
auth.jwt.invalid=Invalid or expired JWT token.
auth.jwt.missing=JWT token is required.
auth.2fa.required=Two-factor authentication is required.
```

## Creating Custom Exceptions

### 1. Define Error Constant

Add to your module's ErrorConstants enum:

```java
public enum AirErrorConstants {
    FLIGHT_SEARCH_FAILED(HttpStatus.BAD_REQUEST, "air.search.failed"),
    BOOKING_EXPIRED(HttpStatus.GONE, "air.booking.expired");
    
    private final HttpStatus status;
    private final String code;
    // ... getters
}
```

### 2. Create Exception Class

```java
public class FlightSearchException extends ErrorResponseException {
    public FlightSearchException(AirErrorConstants error) {
        super(error.getStatus(), 
              ExceptionTranslatorUtils.asProblemDetail(error), 
              null, error.getCode(), null);
    }
}
```

### 3. Add i18n Messages

```properties
# messages_en.properties
air.search.failed=Flight search failed. Please try again.

# messages_vi.properties
air.search.failed=Tìm kiếm chuyến bay thất bại. Vui lòng thử lại.
```

### 4. Throw Exception

```java
throw new FlightSearchException(AirErrorConstants.FLIGHT_SEARCH_FAILED);
```

## Protected Methods for Customization

The `GlobalExceptionHandler` provides protected methods that can be overridden:

- `resolveMessage(code, args, locale)`: Custom message resolution logic
- `getCurrentLocale()`: Custom locale resolution
- `buildValidationErrors(ex, locale)`: Custom validation error formatting
- `handleExceptionInternal(...)`: Custom error response structure

## Best Practices

1. **Always use i18n messages**: Never hardcode error messages in exceptions
2. **Use appropriate HTTP status codes**: Follow REST API conventions
3. **Log appropriately**: 
   - INFO/WARN for expected errors (validation, auth)
   - ERROR for unexpected errors (system failures)
4. **Provide context**: Include relevant information in error messages (use {0}, {1} placeholders)
5. **Keep error codes consistent**: Use a naming convention (module.category.specific)
6. **Test all languages**: Ensure all error codes have translations

## Configuration Properties

You can disable core exception handling if needed:

```properties
# application.properties
core.web.errors.enabled=false  # Disables GlobalExceptionHandler
```

## Testing i18n

Test different locales by setting the `Accept-Language` header:

```bash
# English (default)
curl -H "Accept-Language: en" http://localhost:8080/api/endpoint

# Vietnamese
curl -H "Accept-Language: vi" http://localhost:8080/api/endpoint
```

## Error Response Format

All errors follow RFC 7807 Problem Details format:

```json
{
  "type": "about:blank",
  "title": "validate_001",
  "status": 400,
  "detail": "Invalid request content. Please check the validation errors below.",
  "instance": "/api/flights/search",
  "code": "validate_001",
  "message": "Invalid request content. Please check the validation errors below.",
  "errors": [
    {
      "field": "departureDate",
      "message": "Departure date is required."
    }
  ]
}
```

## FAQ

**Q: Can I have multiple exception handlers in the same module?**
A: Yes, but be careful with `@Order`. Make sure they don't conflict.

**Q: How do I add a new language?**
A: Create `messages_XX.properties` files where XX is the language code (e.g., `messages_ja.properties` for Japanese).

**Q: Can I override core messages in my module?**
A: Yes! Just define the same message code in your module's message file. Module messages take precedence.

**Q: How do I pass parameters to i18n messages?**
A: Use placeholders like `{0}`, `{1}` in your message and pass args array to `resolveMessage()`.
