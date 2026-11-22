# Overview

## Design Principal

- Color: use pantone color year (2024 - Peach Fuzz)
- Always `final` whenever possible
- Always package private class whenever possible
- **Always test every package, class, method, instruction in codes**
  - Except for some boilerplate `equals` and `hashcode` method
  - This is validated by [jacoco-gradle-plugin](https://docs.gradle.org/current/userguide/jacoco_plugin.html).
  - Coverage verification in [`./test.gradle`](./test.gradle)
- Try to avoid including additional dependencies as much as possible
  - Implements JWT generation / validation logic without 3rd party library [#3](https://github.com/raeperd/realworld-springboot-java/issues/3)
- Try to maintain codes in domain package remain POJO
  - Except for special spring annotations like `@Service`, `@Repository`, `@Transactional`
  - Prohibit use of lombok in domain package
- Try to follow all modern best practices for spring-boot project

- Exception:

+ Error constant class: chua error code & status code
title = error code (validate_001)
detail = error code + message source -> message error translated (Invalid param)
errors list = validate exception
    code: user.empty
    message: user rong (co translate & params)

```json
{
    "type": "about:blank",
    "title": "validate_001",
    "status": 400,
    "detail": "Invalid request content",
    "instance": "/public/register",
    "errors": [
        {
            "code": "firstName",
            "message": "Invalid format"
        },
        {
            "code": "username",
            "message": "must be a well-formed email address"
        }
    ]
}
```

### Test
> title = code, detail = message in message source
+ validate request - MethodArgumentNotValidException
> (error param list: code = field, message = message default or message source)
  + validate use validator ✅
  + validate use validator & custom reject field ✅
  + custom reject with param ✅
+ Internal Exception service oke ✅
> print log & 500
+ parse json request ✅
+ bad request khong dung validator ✅
+ unauth ✅
> return 403 & don't have body

```json
{
    "type": "about:blank",
    "title": "validate_001",
    "status": 400,
    "detail": "Invalid request content (MethodArgumentNotValidException)",
    "instance": "/public/register",
    "errors": [
        {
            "code": "username",
            "message": "must be a well-formed email address"
        }
    ]
}
```

## Diagrams

- You can open full diagram file in [`realworld.drawio`](./realworld.drawio) using [draw.io](https://app.diagrams.net/)

## Performance

![performance](./doc/image/performance.png)

- Result of [`./doc/run-api-tests.sh`](./doc/run-api-tests.sh)

## Structure

```markdown
com.company.project
├── common/                       # Value Object dùng chung (Money, Email, UserId...)
├── config/                       # Global Spring config (Jackson, OpenAPI/Swagger...)
└── modules/                      # Bounded Contexts (cắt dọc theo nghiệp vụ)
    ├── air/                      # Module Air search
    │   ├── api/                  # [Primary Adapter] (Presentation Layer)
    │   │   ├── controller/       # REST Controllers
    │   │   ├── dto/              # Request/Response (Records/DTOs)
    │   │   └── mapper/           # DTO <-> UseCase Command/Query Mapper
    │   ├── core/                 # (Domain + Application Layer)
    │   │   ├── model/            # Domain Models (Aggregates)
    │   │   │   ├── AirSearchQuery.java # domain model for air request
    │   │   │   ├── AirOfferResult.java # Aggregate Root (pure Java, logic giàu)
    │   │   │   ├── Isbn.java     # Value Object
    │   │   │   └── BookStatus.java  # Enum
    │   │   ├── port/             # [Ports] Interface giao tiếp
    │   │   │   ├── inbound/      # [Use Case interfaces] application API
    │   │   │       └── SearchAirUseCase (interface with domain model param)
    │   │   │           └── List<AirOffer> search(AirSearchQuery query)
    │   │   │   └── outbound/     # [Repository & Client interfaces] infra API
    │   │   │       └── AirOfferRepository (from DB)
    │   │   │           └── List<AirOffer> searchFromDb(AirSearchQuery query)
    │   │   │       └── AirPartnerSearchPort (from partner system)
    │   │   │           └── List<AirOffer> searchFromPartner(AirSearchQuery query)
    │   │   ├── service/          # [Application Services] (implements inbound ports)
    │   │       └── SearchAirService implements SearchAirUseCase. Logic for search method
    │   │   └── exception/        # [Domain exceptions] (InsufficientFundsException...)
    │   └── infra/                # [Infrastructure Layer]
    │       ├── adapter/          # Implement outbound ports
    │       │   ├── postgres/
    │       │   │   ├── entity/   # JPA Entities (@Entity)
    │       │   │   ├── mapper/   # Domain <-> Entity mapper
    │       │   │   └── AirOfferRepositoryAdapter implements AirOfferRepository. Logic for searchFromDb method
    │       │   └── elasticsearch/ # Ví dụ adapter tìm kiếm
    │       │   └── partner/ # Ví dụ adapter tìm kiếm
    │       │       └── AirPartnerSearchAdapter.java
    │       │       └── PartnerApiClient.java
    │       │       └── PartnerOfferMapper.java
    │       └── config/           # Spring config riêng của module catalog
    └── lending/                  # Module Mượn trả (cấu trúc tương tự)
        ├── api/
        ├── core/
        └── infra/
```
