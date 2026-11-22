# Exception Handling & i18n Configuration Summary

## What Was Implemented

### 1. **Core Module** - Base Infrastructure

#### Files Created/Updated:
- `GlobalExceptionHandler.java` - Enhanced with extensibility and i18n support
- `MessageSourceConfiguration.java` - Auto-configuration for i18n
- `messages.properties` - English translations
- `messages_vi.properties` - Vietnamese translations
- `org.springframework.boot.autoconfigure.AutoConfiguration.imports` - Registered auto-configurations

#### Key Features:
- **Protected methods** allow child modules to override behavior
- **i18n message resolution** with fallback support
- **Validation error handling** with field-level messages
- **Custom exception support** via `ErrorResponseException`
- **RFC 7807 Problem Details** format for all errors

### 2. **Air Module** - Flight Search Specific

#### Files Created:
- `AirExceptionHandler.java` - Extends GlobalExceptionHandler
- `messages_en.properties` - Air module English messages
- `messages_vi.properties` - Air module Vietnamese messages

#### Key Features:
- Inherits all core exception handling
- Ready for GDS-specific exception handlers
- Module-specific error messages

### 3. **Auth Module** - Security Specific

#### Files Created:
- `AuthExceptionHandler.java` - Security exception handling
- Handlers for:
  - `BadCredentialsException`
  - `DisabledException`
  - `LockedException`
  - `AccessDeniedException`
  - Generic `AuthenticationException`

#### Key Features:
- **Highest precedence** for security exceptions
- Spring Security integration
- Auth-specific error messages

## Architecture Benefits

### ✅ **Code Reuse**
- Core module provides base functionality
- All modules inherit i18n and exception handling
- No duplication of error handling logic

### ✅ **Extensibility**
- Modules can add custom exception handlers
- Protected methods allow behavior customization
- Message overrides at module level

### ✅ **Maintainability**
- Centralized error handling in core
- Consistent error format across all modules
- Easy to add new languages

### ✅ **i18n Support**
- Multiple language support (EN, VI, easily add more)
- Message fallback chain
- Module-specific messages override core messages

## How To Use

### In Core Module
Everything is automatic - just use `ErrorConstants` and throw exceptions:

```java
throw new BadRequestException(ErrorConstants.REQUEST_VALIDATION);
```

### In Air Module
Add custom handlers for air-specific exceptions:

```java
@ExceptionHandler(FlightSearchException.class)
protected ResponseEntity<Object> handleFlightSearch(
        FlightSearchException ex, WebRequest request) {
    return handleExceptionInternal(ex, AirErrorConstants.FLIGHT_SEARCH_FAILED, request);
}
```

### In Auth Module
Already configured for Spring Security exceptions. Add more as needed:

```java
@ExceptionHandler(CustomAuthException.class)
protected ResponseEntity<Object> handleCustomAuth(
        CustomAuthException ex, WebRequest request) {
    // Custom handling
}
```

## Message Resolution Order

1. Module-specific messages (e.g., `air/i18n/messages_vi.properties`)
2. Core messages (e.g., `core/i18n/messages_vi.properties`)
3. Error code as fallback

## Error Response Format

All errors follow RFC 7807:

```json
{
  "type": "about:blank",
  "title": "validate_001",
  "status": 400,
  "detail": "Invalid request content",
  "instance": "/api/flights/search",
  "code": "validate_001",
  "message": "Invalid request content",
  "errors": [
    {
      "field": "departureDate",
      "message": "Departure date is required."
    }
  ]
}
```

## Testing Different Languages

```bash
# English
curl -H "Accept-Language: en" http://localhost:8080/api/...

# Vietnamese
curl -H "Accept-Language: vi" http://localhost:8080/api/...
```

## Next Steps

1. ✅ Core infrastructure is ready
2. ✅ Air and Auth modules configured
3. 📝 Add module-specific exception classes as needed
4. 📝 Add more language translations if needed
5. 📝 Customize validation messages per module

## Documentation

See `doc/EXCEPTION_HANDLING_I18N.md` for complete guide including:
- Creating custom exceptions
- Adding new languages
- Best practices
- Testing guide
- FAQ
