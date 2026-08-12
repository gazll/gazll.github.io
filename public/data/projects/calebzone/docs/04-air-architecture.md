# Air Module - Pragmatic Clean Architecture

## Architecture Overview

This module follows **Pragmatic Clean Architecture** principles (inspired by Milan Jovanović),
with clear separation of domain, application, and infrastructure layers.

```
┌──────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ adapters/in  │  │ adapters/out │  │ infrastructure/     │ │
│  │  /web        │  │  /cache      │  │  config/            │ │
│  │  (Controller,│  │  /client     │  │  (Redis, Exception, │ │
│  │   DTOs,      │  │  /persistence│  │   Utils)            │ │
│  │   Validator) │  │  /messaging  │  │                     │ │
│  └──────┬───────┘  └──────┬───────┘  └─────────────────────┘ │
│         │                 │                                    │
│  ┌──────▼─────────────────▼──────────────────────────────┐   │
│  │              configuration/                            │   │
│  │  (ApplicationConfig, ConnectionConfig, Properties)     │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────┬───────────────────────────────────┘
                           │ depends on
┌──────────────────────────▼───────────────────────────────────┐
│                    Application Layer                          │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ application/search/                                   │    │
│  ├── port/in/  → SearchFlightsUseCase (interface)    │    │
│  ├── port/out/ → FlightSupplierPort (interface)      │    │
│  │               FlightCachePort (interface)          │    │
│  │               FlightRepositoryPort (interface)     │    │
│  │               FlightQueryPort (interface)          │    │
│  │  ├── service/  → SearchFlightsService (impl)         │    │
│  │  └── mapper/   → SearchRequestMapper                 │    │
│  │                  SearchResponseMapper                 │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │ depends on
┌──────────────────────────▼───────────────────────────────────┐
│                      Domain Layer                             │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ domain/search/     (Entities & Value Objects)         │    │
│  │  SearchCriteria, FlightSearchResults,                 │    │
│  │  FlightItinerary, FlightLeg, FlightSegment,           │    │
│  │  PricingInfo, SearchMetadata, SearchPreferences,      │    │
│  │  TaxDetail                                            │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │ domain/common/     (Shared Value Objects)             │    │
│  │  Error, Warning, PassengerDetail                      │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │ domain/common/constant/  (Enums)                      │    │
│  │  TripType, CabinClass, PassengerType, Language        │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Dependency Rules

```
Infrastructure → Application → Domain
      ↓                ↓           ↓
   (adapters)    (use cases)   (entities)
```

1. **Domain** has ZERO dependencies on other layers
2. **Application** depends only on Domain
3. **Infrastructure** depends on Application and Domain

## Port In / Port Out Pattern

### Port-In (Primary/Driving Ports)
Interfaces that define what the application **can do** (use cases):

| Port | Description |
|------|-------------|
| `SearchFlightsUseCase` | Search flights with given criteria |

### Port-Out (Secondary/Driven Ports)
Interfaces that define what the application **needs** from external systems:

| Port | Adapter | Description |
|------|---------|-------------|
| `FlightSupplierPort` | `SabreFlightSupplierAdapter` | External GDS flight search |
| `FlightCachePort` | `RedisCacheAdapter` | Flight search result caching |
| `FlightRepositoryPort` | `FlightRepositoryAdapter` | Flight data persistence (write) |
| `FlightQueryPort` | *(pending)* | Flight data query (read) |

## Data Flow

```
HTTP Request
    │
    ▼
SearchController (adapters/in/web)
    │  ① FlightSearchRequest (DTO)
    │  ② SearchRequestMapper.toDomain() → SearchCriteria (domain)
    │
    ▼
SearchFlightsUseCase.search(criteria)  ← Port-In Interface
    │
    ▼
SearchFlightsService (application/search/service)
    │  ③ FlightCachePort.getCachedResults()     ← Port-Out
    │  ④ FlightSupplierPort.searchExternalFlights() ← Port-Out
    │  ⑤ FlightCachePort.cacheResults()         ← Port-Out
    │
    ▼
FlightSearchResults (domain)
    │
    ▼
SearchController
    │  ⑥ SearchResponseMapper.toResponse() → FlightSearchResponse (DTO)
    │
    ▼
HTTP Response
```

## Key Design Decisions

### 1. Controller depends on Use Case interface, NOT concrete service
```java
// ✅ Correct: Depends on port-in interface
private final SearchFlightsUseCase searchFlightsUseCase;

// ❌ Wrong: Depends on concrete implementation
private final SearchFlightsService searchFlightsService;
```

### 2. Mappers in Application layer (pragmatic)
`SearchRequestMapper` and `SearchResponseMapper` live in `application/search/mapper/`
because they bridge the DTO↔Domain boundary. This is a pragmatic choice.

### 3. Domain objects are pure - no framework dependencies
Domain entities like `SearchCriteria` contain business logic (`isValidSegments()`)
but have no Spring, JPA, or other framework annotations (only Lombok for brevity).

### 4. Sabre client code is untouched
The Sabre GDS client (`adapters/out/client/sabre/`) remains as-is.
Only the adapter class and mapper imports were updated to use new domain types.

### 5. CachingSearchFlightsDecorator (Decorator Pattern)
`CachingSearchFlightsDecorator` wraps `SearchFlightsUseCase` for transparent caching.
Currently disabled — enable by adding `@Primary` annotation.

## Package Structure

```
com.calebzone.air/
├── AirApp.java
├── domain/                          # DOMAIN LAYER (innermost)
│   ├── search/                      #   Flight search entities & value objects
│   └── common/                      #   Shared domain types
│       └── constant/                #   Domain enums
├── application/                     # APPLICATION LAYER (middle)
│   └── search/
│       ├── port/in/                 #   Primary ports (use cases)
│       ├── port/out/                #   Secondary ports (SPI)
│       ├── service/                 #   Use case implementations
│       └── mapper/                  #   DTO ↔ Domain mappers
├── adapters/                        # INFRASTRUCTURE LAYER (outermost)
│   ├── in/web/                      #   HTTP controllers, DTOs, validators
│   └── out/
│       ├── cache/redis/             #   Redis caching adapter
│       ├── client/sabre/            #   Sabre GDS client adapter
│       ├── persistence/             #   JPA persistence adapter
│       └── messaging/               #   Kafka/RabbitMQ adapters
├── configuration/                   # UNIFIED Spring Boot Configuration
│   ├── ApplicationConfiguration.java      #   Bean definitions
│   ├── ConnectionConfiguration.java       #   HTTP client beans
│   ├── GlobalExceptionHandler.java        #   Global exception handling
│   ├── WebConfigurer.java                 #   Web setup
│   ├── exception/
│   │   └── AirExceptionHandler.java       #   Module-specific exceptions
│   ├── properties/
│   │   ├── HttpHostsConfiguration.java    #   HTTP configuration
│   │   └── TemplateProperties.java        #   Template properties
│   └── util/
│       └── TravelportJacksonUtil.java     #   Configuration utilities
└── infrastructure/                  # Cross-cutting Infrastructure (optional)
    └── (Minimal or removed - use configuration/ for Spring beans)
```

