Clean Architecture:
- Traditional CA (theo Uncle Bob) đặt ưu Dependency Rule: 
phụ thuộc mã nguồn chỉ được hướng vào trong; 
các lớp lõi (entities/use cases) không biết gì về framework/DB/web và dùng ports (interfaces) để đảo chiều phụ thuộc. 
Mô hình này cho tính testability và khả năng thay thế hạ tầng rất tốt nhưng tăng boilerplate (ports/mappers/models) 
và chi phí tổ chức dự án.
- Pragmatic CA giữ tinh thần “framework là chi tiết” và “dependency hướng vào trong”, 
nhưng thực dụng ở chỗ: chỉ tạo ports/adapters cho các phụ thuộc thật sự “đắt”/dễ thay đổi (DB/Redis/Kafka/Feign), 
chấp nhận một số annotation của Spring tại “vành application” (ví dụ @Service, @Transactional, decorator cache), 
và tận dụng tooling như Spring Modulith để enforce boundary trong monolith thay vì multi-module nặng nề.

BÁO CÁO NGHIÊN CỨU CHIẾN LƯỢC: KIẾN TRÚC BACKEND SPRING BOOT CHO HỆ THỐNG OTA QUY MÔ LỚN1. Tổng quan và Phạm vi Nghiên cứuTrong bối cảnh ngành công nghiệp du lịch trực tuyến (Online Travel Agency - OTA) đang vận hành với tốc độ chóng mặt, nơi lưu lượng truy cập (traffic) có thể tăng đột biến gấp hàng trăm lần trong các mùa cao điểm và yêu cầu nghiệp vụ thay đổi theo từng giờ, kiến trúc phần mềm không chỉ đóng vai trò là khung xương kỹ thuật mà còn là yếu tố cốt lõi quyết định khả năng cạnh tranh của doanh nghiệp. Một hệ thống backend kém linh hoạt sẽ dẫn đến chi phí bảo trì khổng lồ, rủi ro lỗi cao khi tích hợp với các đối tác hàng không phức tạp như Sabre hay Amadeus, và khả năng mở rộng hạn chế.Báo cáo này được biên soạn nhằm cung cấp một phân tích sâu sắc và toàn diện về việc áp dụng các mô hình kiến trúc hiện đại vào môi trường Java Spring Boot, đặc biệt là sự kết hợp giữa Domain-Driven Design (DDD) và Clean/Hexagonal Architecture. Phạm vi của báo cáo bao gồm ba nhiệm vụ chiến lược:Phân tích so sánh chuyên sâu: Mổ xẻ ba mô hình kiến trúc phổ biến là Layered (Phân lớp), Hexagonal (Lục giác - Ports & Adapters), và Clean Architecture, đánh giá sự phù hợp của chúng đối với một hệ thống OTA có lưu lượng truy cập cao.Kiểm toán kiến trúc hiện tại: Đánh giá phê bình hai cấu trúc thư mục phổ biến mà hệ thống hiện tại có thể đang sử dụng, chỉ ra các điểm nghẽn (bottlenecks) và nợ kỹ thuật (technical debt) tiềm ẩn.Thiết kế giải pháp chi tiết: Xây dựng một bản thiết kế kiến trúc hoàn chỉnh cho module "Search Airline" – trái tim của hệ thống OTA – tích hợp các công nghệ phức tạp như Sabre, Database, Redis, RabbitMQ và gRPC.Báo cáo này không chỉ dừng lại ở lý thuyết mà đi sâu vào các chi tiết triển khai thực tế, từ cấu trúc gói (package structure), mã nguồn mẫu (code skeleton), cho đến chiến lược quản lý cấu hình và sơ đồ tương tác hệ thống.2. Phân tích So sánh Kiến trúc: Layered, Hexagonal và Clean ArchitectureĐể đưa ra quyết định kiến trúc chính xác cho một hệ thống OTA high traffic, chúng ta cần hiểu rõ bản chất, cơ chế vận hành và những giới hạn cốt tử của từng mô hình khi đối mặt với độ phức tạp của nghiệp vụ đặt vé máy bay và sự biến động của hạ tầng kỹ thuật.2.1. Layered Architecture (Kiến trúc Phân lớp)Kiến trúc phân lớp, hay còn gọi là N-tier architecture, là mô hình truyền thống và phổ biến nhất trong cộng đồng phát triển Java Spring Boot. Nó được xây dựng dựa trên nguyên tắc phân chia mối quan tâm (separation of concerns) theo chiều ngang kỹ thuật.2.1.1. Cấu trúc và Cơ chế Dòng chảyTrong một ứng dụng Spring Boot điển hình sử dụng kiến trúc phân lớp, hệ thống được chia thành ba lớp chính xếp chồng lên nhau:Presentation Layer (Web Layer): Chứa các Controllers, chịu trách nhiệm xử lý HTTP request/response, validate dữ liệu đầu vào và chuyển đổi DTO (Data Transfer Object).Business Logic Layer (Service Layer): Chứa các Service classes, nơi thực thi các quy tắc nghiệp vụ. Đây là nơi các transaction được quản lý.Data Access Layer (Persistence Layer): Chứa các Repositories, chịu trách nhiệm giao tiếp trực tiếp với cơ sở dữ liệu.Dòng chảy dữ liệu và sự phụ thuộc (dependency) đi theo một chiều duy nhất từ trên xuống dưới: Controller phụ thuộc vào Service, và Service phụ thuộc vào Repository.2.1.2. Phân tích E ngại trong bối cảnh OTA High TrafficMặc dù Layered Architecture mang lại lợi thế về sự đơn giản và tốc độ phát triển ban đầu (Time-to-market) cho các ứng dụng CRUD đơn giản, nó bộc lộ những nhược điểm chí mạng khi áp dụng cho một hệ thống OTA phức tạp:Vấn đề 1: Database-Driven Design (Thiết kế hướng Cơ sở dữ liệu)
Trong kiến trúc phân lớp, xu hướng tự nhiên của lập trình viên là thiết kế cơ sở dữ liệu trước (các bảng flights, bookings, passengers), sau đó ánh xạ trực tiếp các bảng này thành các JPA Entities và sử dụng chúng xuyên suốt các lớp. Điều này vi phạm nguyên lý cốt lõi của DDD, nơi nghiệp vụ (Domain) phải là trung tâm chứ không phải cấu trúc lưu trữ dữ liệu. Trong OTA, một "Hành trình bay" (Itinerary) là một khái niệm nghiệp vụ phức tạp bao gồm logic định giá, quy tắc hoàn hủy, và liên kết chuyến bay, nó không đơn thuần là một bản ghi trong database.Vấn đề 2: Hiệu ứng Lan truyền (Ripple Effect) và Sự mong manh
Do các lớp phụ thuộc trực tiếp vào lớp bên dưới, bất kỳ thay đổi nào ở tầng Database đều có nguy cơ ảnh hưởng ngược lên trên. Ví dụ, nếu bảng ticket thay đổi cấu trúc để hỗ trợ loại vé mới, Entity JPA sẽ thay đổi, dẫn đến Service bị lỗi, và thậm chí Controller cũng phải cập nhật. Trong một hệ thống high traffic cần sự ổn định cao, sự phụ thuộc chặt chẽ này tạo ra rủi ro hồi quy (regression risk) rất lớn mỗi khi release tính năng mới.Vấn đề 3: Sự phình to của Service Layer (Fat Services)
Đây là vấn đề phổ biến nhất. Trong hệ thống OTA, logic tìm kiếm vé không chỉ là truy vấn DB mà còn phải gọi API của Sabre/Amadeus, tính toán giá markup, kiểm tra cache Redis. Trong kiến trúc phân lớp, tất cả logic này thường bị nhồi nhét vào FlightService. Kết quả là các "God Classes" với hàng ngàn dòng code, chứa lẫn lộn logic nghiệp vụ, logic gọi API bên thứ ba, và logic truy xuất dữ liệu. Điều này khiến code trở nên khó đọc, khó bảo trì và cực kỳ khó test cô lập (unit test).2.2. Hexagonal Architecture (Kiến trúc Lục giác - Ports & Adapters)Được Alistair Cockburn giới thiệu nhằm giải quyết các vấn đề của kiến trúc phân lớp, Hexagonal Architecture thay đổi hoàn toàn tư duy về sự phụ thuộc. Thay vì chia theo lớp ngang (UI, Logic, Data), nó chia hệ thống thành hai vùng: Bên trong (Inside) và Bên ngoài (Outside).2.2.1. Nguyên lý Ports & AdaptersInside (Core/Domain): Chứa logic nghiệp vụ thuần túy và các Domain Objects. Vùng này hoàn toàn không biết gì về thế giới bên ngoài (không biết database là MySQL hay Mongo, không biết request đến từ REST hay gRPC).Ports (Cổng): Là các Interfaces định nghĩa cách giao tiếp giữa Inside và Outside.Primary/Driving Ports: Định nghĩa các hành động mà thế giới bên ngoài có thể yêu cầu Core thực hiện (ví dụ: ISearchFlightUseCase).Secondary/Driven Ports: Định nghĩa các hành động mà Core cần thế giới bên ngoài thực hiện giúp (ví dụ: IFlightRepository, ISabreClient).Adapters (Bộ chuyển đổi): Là các implement cụ thể nằm ở vùng Outside.Driving Adapters: Controller, gRPC Endpoint, CLI.Driven Adapters: JPA Repository Implementation, Sabre Rest Client, Redis Cache Handler.2.2.2. Ưu điểm chiến lược cho OTASự tách biệt này mang lại giá trị to lớn cho các công ty OTA:Khả năng thay thế hạ tầng (Infrastructure Swappability): OTA thường xuyên phải thay đổi đối tác công nghệ. Hôm nay bạn dùng Redis để cache, ngày mai có thể chuyển sang Hazelcast. Với Hexagonal, bạn chỉ cần viết một Adapter mới implement ICachePort mà không cần sửa một dòng code nào trong logic tìm kiếm vé. Tương tự với việc chuyển đổi từ Sabre sang Amadeus hoặc tích hợp song song cả hai.Khả năng kiểm thử cô lập (Testability): Do Core không phụ thuộc vào framework hay DB, bạn có thể viết Unit Test cho toàn bộ logic tính giá vé, tìm kiếm đường bay phức tạp mà không cần khởi động Spring Context hay kết nối Database thật. Điều này giúp chạy hàng nghìn test case trong vài giây, đảm bảo chất lượng phần mềm liên tục (CI/CD).2.3. Clean Architecture (Kiến trúc Sạch)Clean Architecture của Robert C. Martin (Uncle Bob) là sự tổng hợp và chuẩn hóa cao độ của các nguyên lý từ Hexagonal và Onion Architecture. Nó tổ chức code thành các vòng tròn đồng tâm với quy tắc bất di bất dịch: Dependency Rule – Sự phụ thuộc mã nguồn chỉ được phép hướng từ vòng ngoài vào vòng trong.2.3.1. Phân tầng chi tiếtEntities (Domain): Vòng trong cùng, chứa các Enterprise Business Rules. Đây là các quy tắc nghiệp vụ cốt lõi, bất biến, áp dụng cho toàn bộ doanh nghiệp (ví dụ: quy tắc tính thuế vé máy bay, định nghĩa về một chuyến bay hợp lệ).Use Cases (Application): Vòng tiếp theo, chứa Application Business Rules. Đây là các kịch bản cụ thể của ứng dụng (ví dụ: Luồng tìm kiếm vé -> lọc kết quả -> sắp xếp -> trả về). Use Case điều phối luồng dữ liệu đến và đi từ Entities.Interface Adapters: Chuyển đổi dữ liệu từ định dạng thuận tiện cho Use Case và Entity sang định dạng thuận tiện cho Database hoặc Web (ví dụ: Presenters, Gateways).Frameworks & Drivers: Vòng ngoài cùng, chứa chi tiết kỹ thuật như Database, Web Framework, Devices.2.3.2. Sự khác biệt tinh tế so với HexagonalMặc dù rất giống nhau về mục tiêu tách biệt, Clean Architecture đi sâu hơn vào việc phân tách chi tiết trong phần "Core". Nó buộc lập trình viên phân biệt rõ đâu là Entity (nghiệp vụ cốt lõi) và đâu là Use Case (nghiệp vụ ứng dụng). Trong bối cảnh OTA:Logic "Chuyến bay khứ hồi phải có ngày về sau ngày đi" thuộc về Entity.Logic "Khi user tìm kiếm, nếu không có kết quả cache thì gọi Sabre, sau đó lưu cache và bắn event log" thuộc về Use Case.2.4. Bảng So sánh Tổng hợp và Khuyến nghịĐể hình dung rõ hơn sự khác biệt và đưa ra lựa chọn, bảng dưới đây so sánh ba mô hình dựa trên các tiêu chí quan trọng của hệ thống OTA:Tiêu chíLayered ArchitectureHexagonal ArchitectureClean ArchitectureTrọng tâm thiết kếPhân chia kỹ thuật (Web, Logic, Data).Tách biệt Core và Infrastructure (Inside/Outside).Tách biệt Enterprise Logic và Application Logic.Chiều phụ thuộcTop-down (Trên xuống dưới).Hướng tâm (Vào trong Core).Hướng tâm (Vào trong Entities).Độ kết dính (Coupling)Cao. Dễ bị rò rỉ chi tiết hạ tầng vào logic.Thấp. Core độc lập hoàn toàn.Rất thấp. Phân tách rõ ràng các tầng logic.Khả năng Test (Testability)Khó. Cần Integration Test phức tạp.Dễ. Unit Test thuần túy cho Core.Rất dễ. Test Use Case và Entity độc lập.Chi phí phát triển ban đầuThấp. Cấu trúc đơn giản, ít boilerplate code.Trung bình. Cần định nghĩa Interfaces (Ports).Cao. Cần nhiều lớp chuyển đổi (DTO, Mappers).Khả năng duy trì (Maintainability)Giảm nhanh khi hệ thống lớn.Ổn định. Logic nghiệp vụ được bảo vệ.Rất cao. Cấu trúc rõ ràng, dễ mở rộng.Phù hợp với DDDKém. Dễ rơi vào Anemic Domain Model.Tốt. Hỗ trợ tốt cho Domain Model.Rất tốt. Tương thích hoàn toàn với chiến thuật DDD.Đánh giá cho OTA High TrafficKhông phù hợp. Rủi ro cao về hiệu năng và bảo trì khi logic phức tạp.Phù hợp. Giải quyết tốt bài toán tích hợp nhiều bên thứ 3 (Sabre, GDS).Tối ưu. Quản lý tốt nhất sự phức tạp của nghiệp vụ và thay đổi hạ tầng.Kết luận và Khuyến nghị Chiến lược:
Đối với dự án backend Java Spring Boot DDD cho công ty OTA high traffic, Clean Architecture (kết hợp tư duy Ports & Adapters của Hexagonal) là lựa chọn tối ưu nhất. Sự kết hợp này cho phép hệ thống "miễn nhiễm" với sự thay đổi của các nhà cung cấp bên ngoài (Sabre, Redis, DB) trong khi vẫn giữ cho logic cốt lõi (Tìm kiếm, Đặt vé) ổn định, dễ kiểm soát và tối ưu hóa hiệu năng. Mô hình này cho phép đội ngũ phát triển tập trung vào giá trị cốt lõi là nghiệp vụ du lịch, thay vì bị sa lầy vào các chi tiết kỹ thuật.3. Kiểm toán Kiến trúc Hiện tại: Phân tích & Cải thiệnDựa trên yêu cầu review cấu trúc thư mục hiện tại, và thực tế phổ biến trong các dự án Spring Boot, tôi sẽ tái hiện và phân tích hai mô hình cấu trúc mà bạn rất có thể đang sử dụng (hoặc cân nhắc), từ đó chỉ ra các điểm yếu (anti-patterns) cần khắc phục ngay lập tức để chuyển đổi sang Clean Architecture.3.1. Cấu trúc A: Package-by-Layer (Mô hình Phân lớp Cổ điển)Đây là cấu trúc mặc định mà hầu hết các hướng dẫn Spring Boot cơ bản hướng dẫn, và là cái bẫy đầu tiên của các dự án lớn.com.ota.backend├── config              // Chứa cấu hình chung├── controller          // Chứa TẤT CẢ Controllers (User, Flight, Hotel, Payment...)├── entity              // Chứa TẤT CẢ JPA Entities (lẫn lộn logic DB và Domain)├── repository          // Chứa TẤT CẢ Repositories└── service             // Chứa TẤT CẢ ServicesPhân tích Điểm yếu Chí mạng:Low Cohesion (Độ kết dính thấp): Các file liên quan đến một tính năng nghiệp vụ (ví dụ: "Search Flight") bị phân tán rải rác khắp nơi. Để sửa tính năng tìm kiếm, lập trình viên phải mở FlightController ở thư mục này, FlightService ở thư mục kia, và FlightRepository ở thư mục khác. Điều này làm giảm năng suất và tăng khả năng sai sót.No Modular Boundaries (Mất kiểm soát biên giới module): Trong cấu trúc này, không có rào cản vật lý nào ngăn cản FlightService gọi trực tiếp HotelRepository. Trong một hệ thống lớn, điều này tạo ra một "mớ bòng bong" (Big Ball of Mud) các phụ thuộc chéo. Khi cần tách module Flight ra thành Microservice riêng, đội ngũ sẽ gặp ác mộng vì code dính chặt vào nhau.Anemic Domain Model (Mô hình tên miền thiếu máu): Các class trong entity thường chỉ là các POJO với Getter/Setter, phục vụ cho Hibernate/JPA mapping hơn là chứa logic nghiệp vụ. Toàn bộ logic kiểm tra, tính toán bị đẩy vào Service Layer, dẫn đến việc Service phình to mất kiểm soát.3.2. Cấu trúc B: Package-by-Feature (Chia theo Tính năng - Phiên bản chưa hoàn thiện)Đây là bước cải tiến thường thấy khi team nhận ra vấn đề của Cấu trúc A, nhưng vẫn chưa thoát khỏi tư duy hướng dữ liệu.com.ota.backend├── flight│   ├── FlightController.java│   ├── FlightService.java│   ├── FlightRepository.java│   └── FlightEntity.java       // Vẫn là JPA Entity├── hotel│   ├──...└── user├──...Phân tích Điểm yếu Chí mạng:Vẫn bị ràng buộc bởi Framework (Tight Coupling): Mặc dù đã gom nhóm code tốt hơn, nhưng bên trong mỗi package flight, code vẫn thường được viết theo kiểu MVC chặt chẽ (Controller gọi Service, Service trả về Entity).Rò rỉ logic hạ tầng (Infrastructure Leakage): Vấn đề nghiêm trọng nhất là FlightService vẫn thường trả về FlightEntity (JPA Entity) cho Controller. Nếu bạn muốn đổi database từ MySQL sang MongoDB, bạn phải sửa cả Service và Controller vì FlightEntity mang các annotation của JPA (@Entity, @Table). Điều này vi phạm nguyên tắc Dependency Inversion của Clean Architecture.Thiếu tính biểu đạt nghiệp vụ (Lack of Screaming Architecture): Nhìn vào cấu trúc này, ta chỉ thấy các danh từ (Flight, Hotel) mà không thấy các hành động nghiệp vụ (Search, Book, Cancel). Một kiến trúc tốt phải "hét lên" (scream) chức năng của hệ thống, ví dụ: SearchFlightUseCase, BookFlightUseCase.3.3. Lộ trình Cải thiện và Chuyển đổiĐể chuyển đổi từ hai cấu trúc trên sang Clean/Hexagonal chuẩn DDD cho module "Search Airline", các bước cải tiến sau là bắt buộc:Cải thiện 1: Tách biệt tuyệt đối Domain Model và Persistence ModelHiện trạng: Sử dụng chung một class @Entity cho cả logic nghiệp vụ và lưu trữ DB.Giải pháp: Tạo hai lớp đối tượng riêng biệt.Flight (Domain Entity): Class POJO thuần Java, chứa logic nghiệp vụ (validate, calculate), không có bất kỳ annotation nào của Hibernate hay Spring.FlightJpaEntity (Persistence Entity): Class dùng để map với bảng DB, chứa @Entity, @Id, @Column.Sử dụng Mapper để chuyển đổi giữa hai đối tượng này tại tầng Adapter. Điều này giải phóng Domain khỏi các ràng buộc kỹ thuật của JPA (như Lazy Loading, Proxy, Default Constructor).Cải thiện 2: Đảo ngược sự phụ thuộc (Dependency Inversion)Hiện trạng: Service phụ thuộc trực tiếp vào Repository (Class/Interface của Spring Data).Giải pháp: Domain định nghĩa một Interface (Port), ví dụ LoadFlightPort. Tầng Infrastructure sẽ implement interface này bằng FlightJpaAdapter (sử dụng Spring Data Repository bên trong). Domain layer không còn biết Spring Data JPA tồn tại. Điều này cho phép dễ dàng mock repository khi test.Cải thiện 3: Giới thiệu lớp Use Case (Application Layer)Hiện trạng: Controller chứa logic điều hướng hoặc Service chứa quá nhiều trách nhiệm hỗn tạp.Giải pháp: Tạo các class SearchFlightsUseCase, BookFlightUseCase rõ ràng. Controller chỉ đóng vai trò nhận request, gọi Use Case và trả response. Use Case đóng vai trò nhạc trưởng điều phối các Port.4. Thiết kế Chi tiết Module "Search Airline" theo Clean/Hexagonal ArchitecturePhần này trình bày thiết kế kỹ thuật chi tiết cho module cốt lõi của OTA. Thiết kế này giải quyết bài toán tích hợp đa chiều: nhận request từ gRPC/REST, kiểm tra cache Redis, nếu miss thì gọi Sabre (SOAP/REST), lưu log vào RabbitMQ, và fallback về Database nếu cần.4.1. Tư duy Thiết kế DDD (Domain-Driven Design)Trước khi viết code, cần xác định rõ các khái niệm trong Bounded Context "Search":Bounded Context: SearchContext.Aggregate Root: FlightAvailability (Khả năng cung ứng chuyến bay). Đây là đối tượng trung tâm đảm bảo tính toàn vẹn dữ liệu của một kết quả tìm kiếm.Value Objects:SearchCriteria: Tiêu chí tìm kiếm (Điểm đi, điểm đến, ngày bay, số khách). Immutable.Itinerary: Hành trình chi tiết.Price: Giá tiền (đa tiền tệ).CabinClass: Hạng ghế (Economy, Business...).Domain Events: SearchPerformedEvent (Sự kiện đã tìm kiếm - dùng cho analytics/tracking).4.2. Cấu trúc Package (Text Tree)Cấu trúc này tuân thủ nguyên tắc: Domain nằm giữa, Infrastructure bao quanh.com.ota.search├── common                      // Các object dùng chung (Money, DateUtils)├── config                      // Cấu hình Spring (Beans, Security, Swagger)├── domain                      // THE CORE (Tuyệt đối KHÔNG phụ thuộc Spring/Hibernate)│   ├── model                   // Entities & Value Objects│   │   ├── FlightAvailability.java│   │   ├── Itinerary.java│   │   ├── SearchCriteria.java│   │   └── vo                  // Value Objects│   │       ├── OriginDestination.java│   │       ├── CabinClass.java│   │       └── Money.java│   ├── port                    // Ports (Interfaces)│   │   ├── in                  // Input Ports (Use Cases API)│   │   │   └── SearchFlightsUseCase.java│   │   └── out                 // Output Ports (Infrastructure Interfaces)│   │       ├── LoadFlightPort.java        // Load from GDS/DB│   │       ├── CacheFlightPort.java       // Load/Save to Cache│   │       └── PublishSearchEventPort.java // Publish Message│   ├── service                 // Domain Services (Logic nghiệp vụ phức tạp nếu có)│   │   └── FlightRankingService.java      // Logic xếp hạng chuyến bay ưu tiên│   └── exception               // Domain Exceptions│       └── FlightNotFoundException.java├── application                 // Application Layer (Orchestration)│   └── service│       └── SearchFlightsService.java      // Implements SearchFlightsUseCase├── infrastructure              // Adapters (Chi tiết kỹ thuật)│   ├── adapter│   │   ├── in                  // Driving Adapters (Entry points)│   │   │   ├── web             // REST API Adapter│   │   │   │   ├── SearchController.java│   │   │   │   └── dto│   │   │   │       ├── SearchRequest.java│   │   │   │       └── SearchResponse.java│   │   │   └── grpc            // gRPC Server Adapter│   │   │       └── SearchGrpcEndpoint.java│   │   └── out                 // Driven Adapters (External calls)│   │       ├── persistence     // Database Adapter│   │       │   ├── jpa│   │       │   │   ├── FlightJpaRepository.java (Spring Data Interface)│   │       │   │   └── entity│   │       │   │       └── FlightJpaEntity.java│   │       │   ├── mapper│   │       │   │   └── FlightPersistenceMapper.java│   │       │   └── FlightPersistenceAdapter.java (Implements LoadFlightPort)│   │       ├── sabre           // Sabre Integration (Anti-Corruption Layer)│   │       │   ├── client│   │       │   │   └── SabreRestClient.java│   │       │   ├── mapper│   │       │   │   └── SabreResponseMapper.java (ACL Mapper)│   │       │   └── SabreFlightAdapter.java (Implements LoadFlightPort)│   │       ├── cache           // Redis Adapter│   │       │   └── RedisFlightCacheAdapter.java (Implements CacheFlightPort)│   │       └── messaging       // RabbitMQ Adapter│   │           └── RabbitMqEventPublisher.java (Implements PublishSearchEventPort)└── SearchApplication.java4.3. Code Skeleton (Java Interface/Class)Mã nguồn dưới đây minh họa cách các thành phần kết nối với nhau, thể hiện rõ sự tách biệt giữa Domain và Infrastructure.4.3.1. Domain Layer (Pure Java)Đây là tầng quan trọng nhất. Chú ý rằng không có bất kỳ annotation nào của Spring (@Service, @Component) hay JPA (@Entity) ở đây.Value Object: SearchCriteriaSử dụng Java Record (Java 14+) để tạo immutable object ngắn gọn.Javapackage com.ota.search.domain.model;

import com.ota.search.domain.model.vo.OriginDestination;
import java.time.LocalDate;
# DDD + Spring Boot templates (Layered / Hexagonal / Clean)
```markdown
│   │   ├── domain/           # Domain Layer
│   │   │   ├── model/        # Domain Models (Entities, Value Objects, Aggregates)
│   │   │   ├── repository/   # Repository Interfaces
│   │   │   └── service/      # Domain Services
│   │   ├── application/      # Application Layer
│   │   │   ├── command/      # Commands (Use Case Input)
│   │   │   ├── query/        # Queries (Use Case Input)
│   │   │   ├── service/      # Application Services (Use Case Implementations)
│   │   │   └── dto/          # Application DTOs
│   ├── infra/                # [Secondary Adapter] (Infrastructure Layer)
│   │   ├── repository/       # Repository Implementations
│   │   ├── service/          # Infrastructure Services (e.g., Email, Payment)
│   │   └── config/           # Module-specific Configurations
└── ...                        # Other Modules
```
Demo feature: Flight Search  
Inbound: REST API (and sample gRPC server, RabbitMQ consumer)  
Outbound: Sabre partner (HTTP), Database (JPA), Redis cache, RabbitMQ publisher, gRPC client  

### Domain-Driven Design
> DDD is about domain model and clear boundary. Architecture is about code dependency.
> a software development approach that models applications based on complex business domains, ensuring the code structure and language reflect real-world business processes
DDD mapping (simple)

Domain: business rules (entities, value objects, domain service)

* Application: use cases (orchestrate domain + ports)
* Infrastructure: DB, cache, MQ, partner API, gRPC client
* Presentation: REST controller, gRPC server, MQ listener

Basic rules
* Domain should be pure:
  * no Spring annotations
  * no HTTP/DB/Redis/RabbitMQ classes
  * no DTO from controller
* Mapping should happen at the edge:
  * REST DTO <-> UseCase input/output
  * Partner schema <-> Domain model
  * Entity (JPA) <-> Domain model
  * 
2) Demo flow (one search)

public record SearchCriteria(
OriginDestination route,
LocalDate departureDate,
int passengerCount,
String cabinClass
) {
public SearchCriteria {
if (passengerCount < 1) throw new IllegalArgumentException("Passengers must be at least 1");
if (departureDate.isBefore(LocalDate.now())) throw new IllegalArgumentException("Date cannot be in the past");
}
}
Input Port (Use Case Interface)Định nghĩa "Hệ thống làm được gì".Javapackage com.ota.search.domain.port.in;
Example REST endpoint: POST /api/v1/flights/search
High level steps:
1. Validate request
2. Build FlightSearchCriteria
3. Check Redis cache
4. Read DB (optional: last saved offers)
5. Call Sabre partner
6. Merge + sort offers
7. Save to DB (optional)
8. Put to Redis
9. Publish RabbitMQ event FlightSearchPerformed
10. Call gRPC client to enrich data (optional)

## Layered Architecture (Controller → Service → Repository)
Purpose: Simple and easy. Good for small/medium service
Main idea 

Dependencies go “down” by layer:
* Presentation → Application → Domain
Infrastructure is “below” and is wired in by Spring (implementation detail).

Pros / Cons
 * ✅ very easy for team
 * ✅ fast to start
 * ❌ can become “big service class” if not careful
 * ❌ infra can leak into app layer if you skip ports/interfaces

One API flow (packages order)

presentation.flightsearch.controller
→ presentation.flightsearch.mapper
→ application.flightsearch.service
→ domain.flightsearch.service
→ domain.flightsearch.port.*
→ infrastructure.* (adapters: sabre/db/redis/mq/grpc)
→ back to controller response

```text
src/main/java/com/example/airsearch
├── AirSearchApplication.java
│
├── configuration
│   ├── config
│   │   ├── ApplicationConfiguration.java
│   │   ├── WebClientConfiguration.java
│   │   ├── ObjectMapperConfiguration.java
│   │   ├── RabbitMqConfiguration.java
│   │   ├── RedisConfiguration.java
│   │   ├── GrpcConfiguration.java
│   │   └── SwaggerConfiguration.java
│   ├── properties
│   │   ├── SabreProperties.java
│   │   ├── DatabaseProperties.java
│   │   ├── RedisProperties.java
│   │   ├── RabbitMqProperties.java
│   │   ├── GrpcProperties.java
│   │   └── SecurityProperties.java
│   ├── security
│   │   ├── SecurityConfiguration.java
│   │   ├── JwtAuthenticationFilter.java
│   │   ├── JwtTokenProvider.java
│   │   └── SecurityUtils.java
│   └── exception
│       ├── GlobalExceptionHandler.java
│       ├── ApiErrorResponse.java
│       └── ErrorCode.java
│
├── presentation
│   └── flightsearch
│       ├── controller
│       │   └── FlightSearchController.java
│       ├── grpc
│       │   └── FlightSearchGrpcServer.java
│       ├── mq
│       │   └── FlightSearchCommandListener.java
│       ├── dto
│       │   ├── FlightSearchRequest.java
│       │   └── FlightSearchResponse.java
│       ├── mapper
│       │   └── FlightSearchDtoMapper.java
│       └── validator
│           └── FlightSearchRequestValidator.java
│
├── application
│   └── flightsearch
│       ├── service
│       │   └── FlightSearchService.java
│       ├── command
│       │   └── FlightSearchCommand.java
│       └── result
│           └── FlightSearchResult.java
│
├── domain
│   └── flightsearch
│       ├── model
│       │   ├── FlightOffer.java
│       │   ├── FlightItinerary.java
│       │   ├── FlightSegment.java
│       │   ├── FlightSearchCriteria.java
│       │   ├── Money.java
│       │   └── Currency.java
│       ├── service
│       │   └── FlightSearchDomainService.java
│       ├── port
│       │   ├── FlightSupplierGateway.java
│       │   ├── FlightOfferRepository.java
│       │   ├── CacheGateway.java
│       │   ├── EventPublisherGateway.java
│       │   └── AirlineMetaGateway.java
│       └── exception
│           ├── DomainException.java
│           └── PartnerAccessException.java
│
└── infrastructure
    └── flightsearch
        ├── partner
        │   └── sabre
        │       ├── SabreFlightSupplierAdapter.java
        │       ├── SabreClient.java
        │       ├── SabreAuthClient.java
        │       ├── mapper
        │       │   ├── SabreSearchRequestMapper.java
        │       │   └── SabreSearchResponseMapper.java
        │       └── schema
        │           ├── SabreSearchRequest.java
        │           └── SabreSearchResponse.java
        ├── persistence
        │   ├── entity
        │   │   ├── FlightOfferEntity.java
        │   │   └── FlightSegmentEntity.java
        │   ├── repository
        │   │   └── SpringDataFlightOfferRepository.java
        │   ├── adapter
        │   │   └── FlightOfferRepositoryAdapter.java
        │   └── mapper
        │       └── FlightOfferEntityMapper.java
        ├── cache
        │   └── RedisCacheAdapter.java
        ├── messaging
        │   └── rabbitmq
        │       ├── FlightSearchEventPublisherRabbit.java
        │       └── message
        │           └── FlightSearchPerformedMessage.java
        └── grpc
            └── airline_meta
                ├── AirlineMetaGrpcAdapter.java
                └── AirlineMetaGrpcClient.java
```
---

import com.ota.search.domain.model.FlightAvailability;
import com.ota.search.domain.model.SearchCriteria;
import java.util.List;

public interface SearchFlightsUseCase {
List<FlightAvailability> search(SearchCriteria criteria);
}
Output Ports (Infrastructure Interfaces)Định nghĩa "Hệ thống cần gì từ bên ngoài".Javapackage com.ota.search.domain.port.out;

import com.ota.search.domain.model.FlightAvailability;
import com.ota.search.domain.model.SearchCriteria;
import com.ota.search.domain.event.SearchPerformedEvent;
import java.util.List;

public interface LoadFlightPort {
// Port này trừu tượng hóa việc lấy dữ liệu chuyến bay
// Không quan tâm lấy từ Sabre, Amadeus hay Database
List<FlightAvailability> fetchFlights(SearchCriteria criteria);
}

public interface CacheFlightPort {
List<FlightAvailability> get(SearchCriteria criteria);
void put(SearchCriteria criteria, List<FlightAvailability> flights);
}

public interface PublishSearchEventPort {
void publish(SearchPerformedEvent event);
}
4.3.2. Application Layer (Orchestration Logic)Tầng này kết nối các Port lại với nhau. Đây là nơi duy nhất trong Core có thể sử dụng Spring (@Service, @Transactional) để quản lý luồng, nhưng tốt nhất vẫn nên hạn chế phụ thuộc framework nếu muốn strict purity.Javapackage com.ota.search.application.service;

import com.ota.search.domain.model.*;
import com.ota.search.domain.port.in.SearchFlightsUseCase;
import com.ota.search.domain.port.out.*;
import com.ota.search.domain.event.SearchPerformedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
@RequiredArgsConstructor
public class SearchFlightsService implements SearchFlightsUseCase {

    // Dependency Injection qua Constructor (Spring tự động inject các Adapter tương ứng)
    private final LoadFlightPort sabreAdapter; // Inject Sabre Adapter implementation
    private final CacheFlightPort cachePort;
    private final PublishSearchEventPort eventPort;
    private final Logger logger = LoggerFactory.getLogger(SearchFlightsService.class);

    @Override
    public List<FlightAvailability> search(SearchCriteria criteria) {
        // 1. Check Cache (Redis) - Chiến lược ưu tiên tốc độ
        List<FlightAvailability> cachedResults = cachePort.get(criteria);
        if (cachedResults!= null &&!cachedResults.isEmpty()) {
            logger.info("Cache hit for criteria: {}", criteria);
            return cachedResults;
        }

        // 2. Call Sabre (Main Source) - Nếu cache miss
        // Đây là nơi sức mạnh của Port phát huy: Use Case không cần biết về SOAP/XML
        logger.info("Cache miss. Fetching from GDS/Sabre...");
        List<FlightAvailability> freshResults = sabreAdapter.fetchFlights(criteria);

        // 3. Business Logic (Optional Domain Service call)
        // Ví dụ: Lọc bỏ các chuyến bay hãng hàng không bị cấm
        // freshResults = flightFilteringService.filter(freshResults);

        // 4. Async Save to Cache (Redis)
        if (!freshResults.isEmpty()) {
            cachePort.put(criteria, freshResults);
        }
        
        // 5. Publish Event (RabbitMQ) for Analytics/Tracking
        // Việc này không được phép làm chậm response trả về cho user -> Fire & Forget
        eventPort.publish(new SearchPerformedEvent(criteria, freshResults.size()));

        return freshResults;
    }
}
4.3.3. Infrastructure Layer (Implementation Details & ACL)Đây là nơi "bẩn" nhất của hệ thống, nơi code phải đối mặt với thực tế hỗn loạn của các API bên ngoài.Sabre Adapter - Lớp Chống Tham Nhũng (Anti-Corruption Layer - ACL)
Sabre API (đặc biệt là Bargain Finder Max) trả về cấu trúc XML/JSON cực kỳ phức tạp và khó hiểu. Nếu để cấu trúc này lọt vào Domain, hệ thống sẽ bị "nhiễm độc". Adapter này đóng vai trò là ACL, chuyển đổi dữ liệu bẩn thành dữ liệu sạch.Javapackage com.ota.search.infrastructure.adapter.out.sabre;

import com.ota.search.domain.model.FlightAvailability;
import com.ota.search.domain.model.SearchCriteria;
import com.ota.search.domain.port.out.LoadFlightPort;
import com.ota.search.infrastructure.adapter.out.sabre.mapper.SabreResponseMapper;
import com.sabre.api.BargainFinderMaxRequest; // Sabre SDK/Generated classes
import com.sabre.api.BargainFinderMaxResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SabreFlightAdapter implements LoadFlightPort {

    private final SabreRestClient sabreClient;
    private final SabreResponseMapper mapper; // ACL Mapper

    @Override
    public List<FlightAvailability> fetchFlights(SearchCriteria criteria) {
        // 1. Convert Domain Criteria -> Sabre Request (Translation)
        BargainFinderMaxRequest request = mapper.toSabreRequest(criteria);

        // 2. Call External API (I/O Operation)
        BargainFinderMaxResponse response;
        try {
            response = sabreClient.postBargainFinderMax(request);
        } catch (Exception e) {
            // Xử lý lỗi kết nối, timeout, circuit breaker ở đây
            throw new ExternalSystemException("Failed to call Sabre", e);
        }

        // 3. Check Sabre-specific Errors
        if (response.hasErrors()) {
            // Log lỗi chi tiết của Sabre nhưng throw lỗi chung của Domain
            throw new ExternalSystemException("Sabre API Error: " + response.getErrors());
        }

        // 4. Convert Sabre Response -> Domain Model (ACL Translation)
        // Đây là bước quan trọng nhất: Lọc bỏ rác, chuẩn hóa dữ liệu
        return mapper.toDomain(response);
    }
}
gRPC Adapter (Driving Adapter)Ví dụ về việc module Search cung cấp API qua gRPC cho các microservice nội bộ khác.Javapackage com.ota.search.infrastructure.adapter.in.grpc;

import com.ota.search.domain.model.SearchCriteria;
import com.ota.search.domain.port.in.SearchFlightsUseCase;
import com.ota.proto.search.SearchServiceGrpc;
import com.ota.proto.search.SearchRequest;
import com.ota.proto.search.SearchResponse;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import lombok.RequiredArgsConstructor;

@GrpcService // Annotation của thư viện grpc-spring-boot-starter
@RequiredArgsConstructor
public class SearchGrpcEndpoint extends SearchServiceGrpc.SearchServiceImplBase {

    private final SearchFlightsUseCase searchUseCase;

    @Override
    public void searchFlights(SearchRequest request, StreamObserver<SearchResponse> responseObserver) {
        // 1. Map Proto Request -> Domain Value Object
        // Adapter chịu trách nhiệm validate input từ gRPC
        SearchCriteria criteria = new SearchCriteria(
            mapOrigin(request.getOrigin()), 
            mapDestination(request.getDestination()), 
            //... mapping logic
        );

        // 2. Execute Use Case (Call into the Hexagon)
        var results = searchUseCase.search(criteria);

        // 3. Map Domain -> Proto Response
        SearchResponse response = mapToProto(results);

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}
4.4. Biểu đồ Minh họa (Class & Sequence)4.4.1. Class Diagram (Dependency Inversion)Biểu đồ này sử dụng cú pháp Mermaid để minh họa nguyên lý Dependency Inversion. Chú ý rằng mũi tên phụ thuộc (dependency) của SabreFlightAdapter hướng vào trong Interface LoadFlightPort của Domain, thay vì Domain phụ thuộc ra ngoài.Thành phầnVai tròPhụ thuộc vàoSearchControllerDriving AdapterSearchFlightsUseCase (In Port)SearchFlightsServiceApplication ServiceSearchFlightsUseCase (Implements), LoadFlightPort (Uses)LoadFlightPortOutput Port (Interface)Không phụ thuộc ai (Pure Domain)SabreFlightAdapterDriven AdapterLoadFlightPort (Implements), SabreRestClient4.4.2. Sequence Diagram (Luồng tìm kiếm thực tế)Biểu đồ tuần tự mô tả luồng xử lý phức tạp của một request tìm kiếm vé máy bay trong kiến trúc đề xuất.Đoạn mãsequenceDiagram
participant User
participant Controller as SearchController (Web/gRPC)
participant UseCase as SearchFlightsService
participant Cache as RedisFlightAdapter
participant Sabre as SabreFlightAdapter
participant Event as RabbitMqPublisher

    User->>Controller: GET /api/search?from=HAN&to=SGN
    Controller->>UseCase: search(SearchCriteria)
    
    UseCase->>Cache: get(SearchCriteria)
    alt Cache Hit (Có dữ liệu trong Redis)
        Cache-->>UseCase: List<Flight>
        Note right of UseCase: Trả về ngay lập tức (Latency < 50ms)
    else Cache Miss (Không có dữ liệu)
        UseCase->>Sabre: fetchFlights(SearchCriteria)
        Sabre->>SabreAPI: HTTP POST /BargainFinderMax (SOAP/REST)
        SabreAPI-->>Sabre: Phản hồi XML/JSON phức tạp
        Note right of Sabre: Chuyển đổi dữ liệu (ACL Mapper)
        Sabre-->>UseCase: List<Flight> (Clean Domain Objects)
        
        par Async Tasks (Xử lý song song không block)
            UseCase->>Cache: put(SearchCriteria, results)
            UseCase->>Event: publish(SearchPerformedEvent)
        end
    end

    UseCase-->>Controller: List<Flight>
    Controller-->>User: JSON Response (DTO)
4.5. Định nghĩa Vị trí các File ConfigViệc tổ chức các file cấu hình đúng chỗ là rất quan trọng để tránh "config hell" và đảm bảo tính đóng gói của kiến trúc.Loại ConfigVị trí Đề xuấtLý do Kiến trúcSecurity Configinfrastructure.config.security.SecurityConfig.javaSecurity là mối quan tâm của hạ tầng (Web/Framework). Domain không nên biết về JWT, OAuth2 filters hay Spring Security Context.Exception Handlinginfrastructure.adapter.in.web.exception.GlobalExceptionHandler.javaViệc map DomainException (ví dụ: NoFlightFound) sang HTTP 404 là nhiệm vụ của Adapter Web. Adapter gRPC sẽ có một exception handler riêng để map sang gRPC Status code.Common Configinfrastructure.config.AppConfig.javaChứa các Bean hạ tầng chung như RestTemplate, ObjectMapper.Redis/RabbitMQ Configinfrastructure.config.RedisConfig.javaCấu hình kết nối, serializers cho Redis/RabbitMQ thuộc về chi tiết triển khai hạ tầng.Domain Constantsdomain.model.constant.FlightConstants.javaCác hằng số nghiệp vụ (ví dụ: MAX_PASSENGERS = 9) phải nằm trong Domain.5. Chiến lược Tích hợp và Tối ưu hóa cho High Traffic5.1. Chiến lược Sabre Integration với ACLTích hợp với Sabre là thách thức lớn nhất của module Search. API của Sabre rất mạnh nhưng cũng rất khó dùng.Vấn đề: Sabre sử dụng các mã (codes) khó hiểu (ví dụ: R cho Request, K cho Confirmed), cấu trúc XML lồng nhau sâu.Giải pháp ACL: Layer Mapper trong SabreFlightAdapter phải thực hiện biên dịch ngôn ngữ (Translation). Ví dụ: Chuyển đổi mã sân bay, xử lý logic ghép chuyến (interline tickets), và quan trọng nhất là "Flat hóa" (flatten) cấu trúc dữ liệu để Domain dễ xử lý.5.2. Chiến lược Caching Đa tầng với RedisTrong OTA, tỷ lệ Look-to-Book (Tìm kiếm trên Đặt vé) thường là 100:1 hoặc cao hơn. Nghĩa là hệ thống tìm kiếm chịu tải cực lớn. Gọi Sabre mỗi lần user search là không khả thi vì chi phí (Sabre tính phí per transaction) và độ trễ (2-5 giây/request).Key Design: SEARCH:{ORIGIN}:{DEST}:{DEPART_DATE}:{ADULT_COUNT}:{CABIN}.TTL Động (Dynamic TTL):Tìm kiếm cho ngày xa (ví dụ: > 30 ngày): Cache TTL 60 phút (Giá ít biến động).Tìm kiếm cho ngày gần (ví dụ: < 3 ngày): Cache TTL 5 phút (Giá biến động mạnh).Compression: Sử dụng Snappy hoặc GZIP nén dữ liệu trước khi lưu vào Redis để tiết kiệm RAM và băng thông mạng.5.3. Xử lý Bất đồng bộ với RabbitMQModule Search không nên trực tiếp ghi log tìm kiếm vào Database để tránh nghẽn I/O Database, làm chậm phản hồi cho user.Cơ chế: Service bắn event SearchPerformedEvent vào Exchange search.events.Consumers:Analytics Queue: Lưu log vào ElasticSearch/Data Warehouse để phân tích xu hướng thị trường.Personalization Queue: Cập nhật hồ sơ sở thích người dùng để gợi ý chuyến bay sau này.Reliability: Cấu hình RabbitMQ với cơ chế Publisher Confirms để đảm bảo không mất event quan trọng.6. Kết luậnViệc chuyển dịch từ Layered Architecture sang Clean/Hexagonal Architecture cho dự án OTA không đơn thuần là tái cấu trúc mã nguồn, mà là một bước chuyển mình về tư duy thiết kế: từ Database-Centric sang Domain-Centric.Mô hình kiến trúc được đề xuất trong báo cáo này cung cấp một nền tảng vững chắc để:Bảo vệ tài sản trí tuệ cốt lõi: Logic tìm kiếm và xử lý vé máy bay được cách ly hoàn toàn khỏi sự thay đổi của công nghệ.Tăng cường khả năng thích ứng: Dễ dàng tích hợp thêm các GDS mới (như Amadeus, Travelport) hoặc các kênh bán hàng mới (gRPC cho Partner, REST cho Mobile App).Đảm bảo hiệu năng High Traffic: Thông qua chiến lược Caching thông minh và xử lý bất đồng bộ, hệ thống có thể chịu tải hàng triệu request mỗi ngày mà vẫn duy trì độ trễ thấp.Đây là lộ trình kỹ thuật cần thiết để đưa hệ thống OTA hiện tại lên tầm cao mới, sẵn sàng cho sự mở rộng quy mô và cạnh tranh khốc liệt trên thị trường du lịch toàn cầu.
## Hexagonal Architecture (Ports and Adapters)
Purpose: Clear boundaries between domain and outside world. Good for complex service
Make the core independent from frameworks and external systems.

Main idea: Core = domain + application
* Define ports (interfaces)
* Implement ports in adapters
* Inbound adapters call the app (REST/gRPC/MQ)
* Outbound adapters talk to DB/Redis/Sabre/RabbitMQ/gRPC client

Pros / Cons
* ✅ very good for many integrations
* ✅ easy to replace partner / DB tech
* ✅ easier to unit test core
* ❌ more files, more “ceremony”
* ❌ team must follow the port rules

![Flow](image/hexagonal-architecture-flow.png)

One API flow (packages order)
adapter.in.rest.FlightSearchController
→ application.flightsearch.port.in.SearchFlightsUseCase
→ application.flightsearch.service.SearchFlightsService
→ domain.flightsearch.service.FlightSearchDomainService (optional)
→ application.flightsearch.port.out.*
→ adapter.out.* (sabre/db/redis/mq/grpc)
→ back to controller response

```text
src/main/java/com/example/airsearch
├── AirSearchApplication.java
│
├── config
│   ├── ApplicationConfiguration.java
│   ├── WebClientConfiguration.java
│   ├── ObjectMapperConfiguration.java
│   ├── RabbitMqConfiguration.java
│   ├── RedisConfiguration.java
│   ├── GrpcConfiguration.java
│   ├── SecurityConfiguration.java
│   ├── JwtAuthenticationFilter.java
│   ├── JwtTokenProvider.java
│   ├── GlobalExceptionHandler.java
│   └── SwaggerConfiguration.java
│
├── properties
│   ├── SabreProperties.java
│   ├── DatabaseProperties.java
│   ├── RedisProperties.java
│   ├── RabbitMqProperties.java
│   ├── GrpcProperties.java
│   └── SecurityProperties.java
│
├── domain
│   └── flightsearch
│       ├── model
│       │   ├── FlightOffer.java
│       │   ├── FlightItinerary.java
│       │   ├── FlightSegment.java
│       │   ├── FlightSearchCriteria.java
│       │   ├── Money.java
│       │   └── Currency.java
│       ├── service
│       │   └── FlightSearchDomainService.java
│       └── exception
│           ├── DomainException.java
│           └── PartnerAccessException.java
│
├── application
│   └── flightsearch
│       ├── port
│       │   ├── in
│       │   │   └── SearchFlightsUseCase.java
│       │   └── out
│       │       ├── FlightSupplierPort.java
│       │       ├── FlightOfferRepositoryPort.java
│       │       ├── CachePort.java
│       │       ├── EventPublisherPort.java
│       │       └── AirlineMetaPort.java
│       ├── model
│       │   ├── SearchFlightsCommand.java
│       │   └── SearchFlightsResult.java
│       └── service
│           └── SearchFlightsService.java
│
└── adapter
    ├── in
    │   ├── rest
    │   │   ├── FlightSearchController.java
    │   │   ├── dto
    │   │   │   ├── FlightSearchRequest.java
    │   │   │   └── FlightSearchResponse.java
    │   │   └── mapper
    │   │       └── FlightSearchRestMapper.java
    │   ├── grpc
    │   │   ├── FlightSearchGrpcServer.java
    │   │   └── mapper
    │   │       └── FlightSearchGrpcMapper.java
    │   └── mq
    │       └── FlightSearchCommandListener.java
    │
    └── out
        ├── sabre
        │   ├── SabreFlightSupplierAdapter.java
        │   ├── SabreClient.java
        │   ├── SabreAuthClient.java
        │   ├── mapper
        │   │   ├── SabreSearchRequestMapper.java
        │   │   └── SabreSearchResponseMapper.java
        │   └── schema
        │       ├── SabreSearchRequest.java
        │       └── SabreSearchResponse.java
        ├── persistence
        │   ├── entity
        │   │   ├── FlightOfferEntity.java
        │   │   └── FlightSegmentEntity.java
        │   ├── repository
        │   │   └── SpringDataFlightOfferRepository.java
        │   ├── mapper
        │   │   └── FlightOfferEntityMapper.java
        │   └── FlightOfferPersistenceAdapter.java
        ├── redis
        │   └── RedisCacheAdapter.java
        ├── rabbitmq
        │   ├── FlightSearchEventPublisherAdapter.java
        │   └── message
        │       └── FlightSearchPerformedMessage.java
        └── grpc
            └── airline_meta
                ├── AirlineMetaGrpcAdapter.java
                └── AirlineMetaGrpcClient.java
```

---
## Clean Architecture
Purpose: Very strict “inside-out” rule. Similar to Hexagonal, but uses “rings”.

Rings (simple words)

1. Entities (Domain model)
2. Use cases (Application rules)
3. Interface adapters (controllers, presenters, gateways, mappers)
4. Frameworks / drivers (Spring, DB, MQ, Redis, HTTP client)
   
Pros / Cons
* ✅ strongest separation
* ✅ core can be moved out of Spring later
* ❌ more strict + more code to wire
* ❌ team must be disciplined

* ![Flow](image/clean-architecture-flow.png)

One API flow (packages order)
adapter.in.web.FlightSearchController
→ core.usecase.flightsearch.SearchFlightsUseCase
→ core.usecase.flightsearch.SearchFlightsInteractor
→ core.usecase.flightsearch.gateway.* (interfaces)
→ adapter.out.* (impl + frameworks)
→ back to controller response

```text
src/main/java/com/example/airsearch
├── AirSearchApplication.java
│
├── framework
│   ├── config
│   │   ├── ApplicationConfiguration.java
│   │   ├── WebClientConfiguration.java
│   │   ├── ObjectMapperConfiguration.java
│   │   ├── RabbitMqConfiguration.java
│   │   ├── RedisConfiguration.java
│   │   ├── GrpcConfiguration.java
│   │   └── SwaggerConfiguration.java
│   ├── security
│   │   ├── SecurityConfiguration.java
│   │   ├── JwtAuthenticationFilter.java
│   │   ├── JwtTokenProvider.java
│   │   └── SecurityUtils.java
│   ├── exception
│   │   └── GlobalExceptionHandler.java
│   └── properties
│       ├── SabreProperties.java
│       ├── DatabaseProperties.java
│       ├── RedisProperties.java
│       ├── RabbitMqProperties.java
│       ├── GrpcProperties.java
│       └── SecurityProperties.java
│
├── core
│   ├── entity
│   │   └── flightsearch
│   │       ├── FlightOffer.java
│   │       ├── FlightItinerary.java
│   │       ├── FlightSegment.java
│   │       ├── FlightSearchCriteria.java
│   │       ├── Money.java
│   │       └── Currency.java
│   └── usecase
│       └── flightsearch
│           ├── SearchFlightsInput.java
│           ├── SearchFlightsOutput.java
│           ├── SearchFlightsUseCase.java
│           ├── SearchFlightsInteractor.java
│           └── gateway
│               ├── FlightSupplierGateway.java
│               ├── FlightOfferRepositoryGateway.java
│               ├── CacheGateway.java
│               ├── EventPublisherGateway.java
│               └── AirlineMetaGateway.java
│
└── adapter
    ├── in
    │   ├── web
    │   │   ├── FlightSearchController.java
    │   │   ├── dto
    │   │   │   ├── FlightSearchRequest.java
    │   │   │   └── FlightSearchResponse.java
    │   │   └── mapper
    │   │       └── FlightSearchWebMapper.java
    │   ├── grpc
    │   │   ├── FlightSearchGrpcServer.java
    │   │   └── mapper
    │   │       └── FlightSearchGrpcMapper.java
    │   └── mq
    │       └── FlightSearchCommandListener.java
    │
    └── out
        ├── sabre
        │   ├── SabreFlightSupplierGatewayImpl.java
        │   ├── SabreClient.java
        │   ├── SabreAuthClient.java
        │   ├── mapper
        │   │   ├── SabreSearchRequestMapper.java
        │   │   └── SabreSearchResponseMapper.java
        │   └── schema
        │       ├── SabreSearchRequest.java
        │       └── SabreSearchResponse.java
        ├── persistence
        │   ├── entity
        │   │   ├── FlightOfferEntity.java
        │   │   └── FlightSegmentEntity.java
        │   ├── repository
        │   │   └── SpringDataFlightOfferRepository.java
        │   ├── mapper
        │   │   └── FlightOfferEntityMapper.java
        │   └── FlightOfferRepositoryGatewayImpl.java
        ├── redis
        │   └── RedisCacheGatewayImpl.java
        ├── rabbitmq
        │   ├── RabbitMqEventPublisherGatewayImpl.java
        │   └── message
        │       └── FlightSearchPerformedMessage.java
        └── grpc
            └── airline_meta
                ├── AirlineMetaGatewayImpl.java
                └── AirlineMetaGrpcClient.java
```

### Quick Comparison of Hexagonal vs Clean Architecture
| Item                                  | Layered       | Hexagonal | Clean     |
| ------------------------------------- | ------------- |-----------|-----------|
| Easy to start                         | ✅✅✅          | ✅✅       | ✅         |
| Many integrations (partner, MQ, gRPC) | ✅             | ✅✅✅      | ✅✅✅       |
| Keep core clean from Spring           | ✅ (if careful)| ✅✅       | ✅✅✅       |
| Number of files                       | Low           | Medium    | High      |
| Team discipline needed                | Medium        | High      | Very high |
