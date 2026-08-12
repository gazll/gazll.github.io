/* Curated from primary vendor documentation and original engineering guidance.
   Packs are shared deliberately: the same invariant should be reviewed the same
   way when it appears in payments, booking, feeds or messaging. */
export const SYSTEM_DESIGN_RESEARCH = {
  assignments: {
    'design-review-framework': ['reliability', 'observability'],
    'traffic-caching-building-blocks': ['caching', 'reliability'],
    'surviving-high-load': ['reliability', 'rate-limiting'],
    'distributed-rate-limiter': ['rate-limiting', 'observability'],
    'payment-ledger': ['transactions', 'messaging'],
    'notification-service': ['messaging', 'observability'],
    'url-shortener': ['caching', 'observability'],
    'news-feed': ['messaging', 'search-ranking'],
    'realtime-leaderboard': ['search-ranking', 'caching'],
    'distributed-cache': ['caching', 'reliability'],
    'chat-messaging': ['messaging', 'observability'],
    'autocomplete-typeahead': ['search-ranking', 'caching'],
    'object-storage-large-upload': ['object-storage', 'observability'],
    'ota-flight-booking': ['transactions', 'reliability'],
    'high-traffic-booking-search': ['transactions', 'messaging'],
    'scaling-1m-to-10m-requests': ['transactions', 'messaging', 'caching', 'search-ranking', 'data-evolution', 'reliability'],
    'scaling-technique-catalogue': ['data-evolution', 'observability'],
    'flash-sale-booking-inventory-bottleneck': ['flash-sale', 'elastic-scaling', 'transactions', 'rate-limiting'],
    'api-gateway-identity-edge': ['reliability', 'rate-limiting', 'identity-edge']
  },
  packs: {
    'flash-sale': {
      en: {
        title: 'Flash-sale capacity and hot-key contention',
        intro: 'A campaign is an open-loop burst against one scarce key. Measure the serialized reservation path, then admit no faster than it can safely drain.',
        sections: [
          { title: 'Find the knee, not a vendor TPS', items: [
            'Replay the real reservation transaction with hot-key skew and target-rate arrivals. Track schedule lag, lock wait, deadlock/serialization retry, WAL latency and pool occupancy together.',
            'The first nonlinear rise in p99 or schedule lag is the saturation knee. Keep production admission below it with headroom; rerun after schema, index, hardware or durability changes.'
          ]},
          { title: 'Separate popularity from correctness', items: [
            'Browse reads use a cached projection and may show an availability band. Only the hold command touches authoritative stock, so a refresh storm cannot become a row-lock storm.',
            'A Redis reservation script is atomic inside Redis but still needs an explicit durability/recovery contract. For zero-oversell inventory, a database invariant or fenced single-writer authority remains the final judge.'
          ]},
          { title: 'Bound demand before work starts', items: [
            'Issue admission tokens per campaign/SKU, cap concurrent holds and give the queue a maximum waiting age. Reject when estimated drain time exceeds the useful checkout window.',
            'Load-test client retries and bots, not only cooperative users. A timeout without Retry-After or a truthful pending state can multiply attempts exactly when capacity is lowest.'
          ]}
        ]
      },
      vi: {
        title: 'Capacity flash sale và contention trên hot key',
        intro: 'Campaign là open-loop burst đánh vào một key khan hiếm. Phải đo reservation path serialized rồi chỉ admit ở rate mà nó drain an toàn.',
        sections: [
          { title: 'Find the knee, không dùng vendor TPS', items: [
            'Replay transaction reservation thật với hot-key skew và target-rate arrival. Theo dõi đồng thời schedule lag, lock wait, deadlock/serialization retry, WAL latency và pool occupancy.',
            'Điểm p99 hoặc schedule lag bắt đầu tăng phi tuyến là saturation knee. Đặt admission production thấp hơn có headroom; benchmark lại sau thay đổi schema, index, hardware hoặc durability.'
          ]},
          { title: 'Separate popularity khỏi correctness', items: [
            'Browse read dùng cached projection và có thể hiện availability band. Chỉ hold command chạm stock authoritative để refresh storm không biến thành row-lock storm.',
            'Redis reservation script atomic bên trong Redis nhưng vẫn cần durability/recovery contract. Với inventory không chấp nhận oversell, database invariant hoặc fenced single-writer authority vẫn là quyết định cuối.'
          ]},
          { title: 'Bound demand trước khi tạo work', items: [
            'Phát admission token theo campaign/SKU, cap concurrent hold và đặt maximum waiting age. Reject khi estimated drain time vượt checkout window còn hữu ích.',
            'Load-test cả client retry và bot, không chỉ cooperative user. Timeout thiếu Retry-After hoặc pending state trung thực sẽ nhân số attempt đúng lúc capacity thấp nhất.'
          ]}
        ]
      },
      sources: [
        ['PostgreSQL — pgbench target-rate and schedule lag', 'https://www.postgresql.org/docs/17/pgbench.html'],
        ['Redis — Real-time inventory reservation', 'https://redis.io/tutorials/inventory-reservation-in-real-time-with-redis/'],
        ['Azure — Queue-based load leveling', 'https://learn.microsoft.com/en-us/azure/architecture/patterns/queue-based-load-leveling']
      ]
    },
    'elastic-scaling': {
      en: {
        title: 'Elastic capacity across the traffic lifecycle',
        intro: 'Scale-out is useful only for work that can run in parallel. Known peaks need scheduled warm capacity; quiet periods need deliberate, drain-safe scale-in rather than an indiscriminate scale-to-zero policy.',
        sections: [
          { title: 'Pre-warm known peaks; bound unknown spikes', items: [
            'For a scheduled campaign, raise the critical-path floor before launch using measured startup, cache warm-up and connection-pool time. Reactive autoscaling begins after demand is observed, so admission control must cover the warm-up gap.',
            'For surprise traffic, scale gateway, read path and stateless APIs from concurrency/request signals, but issue no more checkout work than the inventory, database and PSP budgets can safely drain.'
          ]},
          { title: 'Use one scaling signal per component', items: [
            'UI/API capacity follows request concurrency or requests per healthy target; queue consumers need oldest-message age, input/output rate and partition skew; payment workers also need a provider-concurrency cap.',
            'A hot SKU, shared row, database lock or one ordered partition is a synchronization point. More replicas reduce surrounding work but do not raise that key’s serialized rate; use admission, quotas, cells or a single-writer lane instead.'
          ]},
          { title: 'Scale in after drain, not merely after CPU falls', items: [
            'Scale down only after the campaign/recovery window ends and queue, outbox, payment-pending and expiry signals are healthy through a cooldown. Stop pulling work, finish or checkpoint the current item, then release its lease before termination.',
            'Scale-to-zero fits intermittent analytics, reindex and bulk notifications. Retain a safe floor for checkout, inventory authority, outbox, expiry, reconciliation, provider callback handling and observability because their idle cost buys correctness and recovery time.'
          ]}
        ]
      },
      vi: {
        title: 'Elastic capacity xuyên suốt traffic lifecycle',
        intro: 'Scale-out chỉ hữu ích cho work chạy song song được. Peak biết trước cần warm capacity theo lịch; lúc yên cần scale-in có drain an toàn thay vì scale-to-zero vô điều kiện.',
        sections: [
          { title: 'Pre-warm peak biết trước; bound spike không biết trước', items: [
            'Campaign có lịch phải nâng critical-path floor trước giờ mở theo startup, cache warm-up và connection-pool time đã đo. Reactive autoscale chỉ bắt đầu sau khi demand xuất hiện, nên admission control phải che khoảng warm-up.',
            'Traffic bất ngờ có thể scale gateway, read path và API stateless theo concurrency/request signal, nhưng không được admit checkout vượt budget mà inventory, database và PSP có thể drain an toàn.'
          ]},
          { title: 'Mỗi component dùng một scaling signal', items: [
            'UI/API theo request concurrency hoặc requests trên healthy target; queue consumer cần oldest-message age, input/output rate và partition skew; payment worker còn cần provider-concurrency cap.',
            'Hot SKU, shared row, database lock hoặc ordered partition là synchronization point. Replica nhiều hơn chỉ giảm work xung quanh chứ không tăng serialized rate của key đó; phải dùng admission, quota, cell hoặc single-writer lane.'
          ]},
          { title: 'Scale-in sau drain, không chỉ khi CPU hạ', items: [
            'Chỉ scale down sau campaign/recovery window và khi queue, outbox, payment-pending, expiry signal khỏe qua cooldown. Stop pulling work, finish/checkpoint item hiện tại rồi release lease trước terminate.',
            'Scale-to-zero phù hợp analytics, reindex và bulk notification gián đoạn. Giữ safe floor cho checkout, inventory authority, outbox, expiry, reconciliation, provider callback và observability vì idle cost của chúng mua correctness cùng recovery time.'
          ]}
        ]
      },
      sources: [
        ['Azure — Design to scale out and scale in', 'https://learn.microsoft.com/en-us/azure/architecture/guide/design-principles/scale-out'],
        ['Azure — Background jobs and graceful scale-in', 'https://learn.microsoft.com/en-us/azure/architecture/best-practices/background-jobs'],
        ['AWS — Target tracking, warm-up and gradual scale-in', 'https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html']
      ]
    },
    reliability: {
      en: {
        title: 'Reliability, overload and recovery',
        intro: 'Reliability is a user-visible contract. Capacity, retries and failover must be designed as bounded control loops rather than emergency switches.',
        sections: [
          { title: 'Prevent positive feedback', items: [
            'Give every call an end-to-end deadline; derive shorter per-hop timeouts from the remaining budget and cancel work the caller no longer needs.',
            'Retry only classified transient failures, cap attempts, add exponential backoff with jitter and enforce a retry budget so recovery traffic cannot become the outage.'
          ]},
          { title: 'Degrade deliberately', items: [
            'Use admission control, bounded queues, concurrency limits and load shedding before saturation; queue depth without oldest-age is not enough to see stalled work.',
            'Define which features fail closed, fail open, serve stale data or become read-only. Test the degraded contract with dependency latency, partial-region loss and bad configuration.'
          ]},
          { title: 'Prove recovery', items: [
            'Set RTO and RPO per journey, automate restore/failover where safe, and regularly restore production-shaped backups into an isolated environment.',
            'Roll out by canary or cell, compare user SLIs, and keep rollback independent of the failing control plane. A failover plan that has never been exercised is an assumption.'
          ]}
        ]
      },
      vi: {
        title: 'Reliability, overload và recovery',
        intro: 'Reliability là contract nhìn từ user. Capacity, retry và failover phải là control loop có giới hạn, không phải công tắc dùng khi khẩn cấp.',
        sections: [
          { title: 'Prevent positive feedback', items: [
            'Đặt deadline end-to-end cho mỗi call; timeout từng hop phải ngắn hơn budget còn lại và cần cancel phần việc mà caller không còn cần.',
            'Chỉ retry lỗi transient đã phân loại, giới hạn số lần, exponential backoff có jitter và retry budget để traffic phục hồi không biến thành nguyên nhân outage.'
          ]},
          { title: 'Degrade deliberately', items: [
            'Dùng admission control, bounded queue, concurrency limit và load shedding trước saturation; queue depth mà thiếu oldest-age không phát hiện được work bị kẹt.',
            'Ghi rõ feature nào fail closed, fail open, trả stale hoặc chuyển read-only. Test contract này với dependency chậm, mất một phần region và config lỗi.'
          ]},
          { title: 'Prove recovery', items: [
            'Đặt RTO/RPO theo từng journey, tự động restore/failover khi an toàn và thường xuyên restore backup có kích thước gần production trong môi trường cô lập.',
            'Rollout theo canary/cell, so user SLI và giữ rollback độc lập với control plane đang lỗi. Kế hoạch failover chưa diễn tập vẫn chỉ là assumption.'
          ]}
        ]
      },
      sources: [
        ['Google SRE — Addressing Cascading Failures', 'https://sre.google/sre-book/addressing-cascading-failures/'],
        ['AWS — Retry with backoff pattern', 'https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html']
      ]
    },
    'rate-limiting': {
      en: {
        title: 'Policy and distributed enforcement', intro: 'A limiter protects a scarce resource; its key, cost model and failure mode matter more than the counter algorithm.',
        sections: [
          { title: 'Model the budget', items: [
            'Scope by authenticated tenant/user/API key before IP where possible. Charge weighted cost for expensive queries instead of pretending every request costs one token.',
            'Separate sustained rate, burst capacity and concurrency. Version policy and shadow new rules before enforcement to measure false positives.'
          ]},
          { title: 'Bound distributed error', items: [
            'Use atomic server-side updates for a precise shared bucket; use local token leases only when bounded overshoot is acceptable and measurable.',
            'Choose fail-open or fail-closed per endpoint. Authentication, checkout and public reads have different abuse risk and availability cost.'
          ]},
          { title: 'Operate the control', items: [
            'Track allowed, rejected and shadow decisions by policy version plus limiter latency, hot keys and degraded-mode duration—without putting user IDs in metric labels.',
            'Return a stable error contract and Retry-After where meaningful; combine rate limits with quotas, bot controls and origin concurrency protection.'
          ]}
        ]
      },
      vi: {
        title: 'Policy và distributed enforcement', intro: 'Limiter bảo vệ resource khan hiếm; key, cost model và failure mode quan trọng hơn việc chọn counter algorithm.',
        sections: [
          { title: 'Model the budget', items: [
            'Ưu tiên scope theo tenant/user/API key đã authenticate trước IP. Tính weighted cost cho query đắt thay vì coi mọi request tốn đúng một token.',
            'Tách sustained rate, burst capacity và concurrency. Version policy và chạy shadow trước khi enforce để đo false positive.'
          ]},
          { title: 'Bound distributed error', items: [
            'Dùng update atomic phía server cho shared bucket chính xác; chỉ cấp token lease local khi bounded overshoot được chấp nhận và đo được.',
            'Chọn fail-open/fail-closed theo endpoint. Authentication, checkout và public read có abuse risk cùng availability cost khác nhau.'
          ]},
          { title: 'Operate the control', items: [
            'Theo dõi allow/reject/shadow theo policy version, limiter latency, hot key và thời gian degraded mode; không đưa user ID vào metric label.',
            'Trả error contract ổn định và Retry-After khi phù hợp; kết hợp rate limit với quota, bot control và concurrency protection tại origin.'
          ]}
        ]
      },
      sources: [
        ['Cloudflare — Rate limiting best practices', 'https://developers.cloudflare.com/waf/rate-limiting-rules/best-practices/'],
        ['Redis — Sorted sets', 'https://redis.io/docs/latest/develop/data-types/sorted-sets/']
      ]
    },
    transactions: {
      en: {
        title: 'Correctness across money and inventory', intro: 'The database protects local invariants; idempotency, state machines and reconciliation protect the workflow around it.',
        sections: [
          { title: 'Make commands repeatable', items: [
            'Persist idempotency key, request fingerprint and original response together. Reject key reuse with different parameters and define retention from the maximum retry window.',
            'Represent pending and unknown outcomes explicitly. After a timeout, query authoritative provider state before retrying or compensating an irreversible action.'
          ]},
          { title: 'Keep invariants local', items: [
            'Put uniqueness, balance and legal state transitions in one transaction and enforce them with constraints, conditional updates or locks—not a cache lock.',
            'Choose isolation from the anomaly to prevent. Serializable transactions can abort under contention, so the whole transaction needs a bounded retry path.'
          ]},
          { title: 'Close the distributed gap', items: [
            'Write business state and an outbox record atomically; consumers deduplicate effects. Exactly-once inside one platform does not make an external PSP or airline atomic.',
            'Reconcile independent statements, retain immutable audit history and repair by compensating entries. Monitor aged pending states and unmatched totals as correctness SLIs.'
          ]}
        ]
      },
      vi: {
        title: 'Correctness xuyên suốt money và inventory', intro: 'Database bảo vệ invariant local; idempotency, state machine và reconciliation bảo vệ workflow bao quanh nó.',
        sections: [
          { title: 'Make commands repeatable', items: [
            'Lưu idempotency key, request fingerprint và response gốc cùng nhau. Từ chối dùng lại key với parameter khác và đặt retention theo retry window dài nhất.',
            'Biểu diễn pending/unknown thành state thật. Sau timeout phải query state authoritative từ provider trước khi retry hoặc compensate hành động khó đảo ngược.'
          ]},
          { title: 'Keep invariants local', items: [
            'Đưa uniqueness, balance và legal state transition vào một transaction, enforce bằng constraint, conditional update hoặc lock; không dùng cache lock cho correctness.',
            'Chọn isolation theo anomaly cần chặn. Serializable có thể abort khi contention, vì vậy toàn transaction cần bounded retry path.'
          ]},
          { title: 'Close the distributed gap', items: [
            'Ghi business state và outbox atomically; consumer deduplicate effect. Exactly-once trong một platform không làm PSP hay airline bên ngoài trở thành atomic.',
            'Reconcile các statement độc lập, giữ audit history immutable và repair bằng compensating entry. Theo dõi pending quá tuổi và unmatched total như correctness SLI.'
          ]}
        ]
      },
      sources: [
        ['Stripe — Idempotent requests', 'https://docs.stripe.com/api/idempotent_requests'],
        ['PostgreSQL — Transaction isolation', 'https://www.postgresql.org/docs/current/transaction-iso.html']
      ]
    },
    messaging: {
      en: {
        title: 'Asynchronous delivery and replay', intro: 'Moving work off the request path trades immediate failure for lag, duplicates, ordering constraints and operational backlog.',
        sections: [
          { title: 'Define delivery semantics', items: [
            'Assume at-least-once at service boundaries. Give each event a stable ID, partition key, schema version and event time; make every side effect idempotent.',
            'Guarantee order only within the business entity that needs it. Global order limits parallelism and usually encodes no useful invariant.'
          ]},
          { title: 'Treat lag as user impact', items: [
            'Observe oldest-message age, input/output rate, retry count, poison messages and partition skew. Queue depth alone hides slow old work behind new small messages.',
            'Use retry topics or delayed queues with expiry and a DLQ; DLQ is not resolution until it has ownership, alerting and a safe replay tool.'
          ]},
          { title: 'Evolve safely', items: [
            'Use backward/forward-compatible schemas and tolerant readers. Deploy consumers before producers when adding fields and preserve raw events for bounded replay.',
            'Replay into an isolated output or shadow consumer first; throttle it so historical traffic cannot starve live processing or repeat external effects.'
          ]}
        ]
      },
      vi: {
        title: 'Async delivery và replay', intro: 'Đưa work ra khỏi request path đổi immediate failure lấy lag, duplicate, ordering constraint và backlog vận hành.',
        sections: [
          { title: 'Define delivery semantics', items: [
            'Giả định at-least-once tại service boundary. Mỗi event cần ID ổn định, partition key, schema version, event time; mọi side effect phải idempotent.',
            'Chỉ guarantee order trong business entity thực sự cần. Global order giới hạn parallelism và thường không bảo vệ invariant hữu ích.'
          ]},
          { title: 'Treat lag as user impact', items: [
            'Quan sát oldest-message age, input/output rate, retry count, poison message và partition skew. Queue depth đơn lẻ che work cũ chậm phía sau message mới nhỏ.',
            'Dùng retry topic/delayed queue có expiry và DLQ; DLQ chưa phải resolution nếu thiếu owner, alert và công cụ replay an toàn.'
          ]},
          { title: 'Evolve safely', items: [
            'Dùng schema backward/forward-compatible và tolerant reader. Deploy consumer trước producer khi thêm field, giữ raw event để replay có giới hạn.',
            'Replay vào output cô lập hoặc shadow consumer trước; throttle để traffic lịch sử không làm đói live work hay lặp external effect.'
          ]}
        ]
      },
      sources: [
        ['Apache Kafka 4.1 — Consumer groups and subscriptions', 'https://kafka.apache.org/41/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html'],
        ['Apache Kafka 4.1 — Producer idempotence and transactions', 'https://kafka.apache.org/41/javadoc/org/apache/kafka/clients/producer/KafkaProducer.html'],
        ['RabbitMQ — Reliability and data safety', 'https://www.rabbitmq.com/docs/reliability'],
        ['RabbitMQ — Dead Letter Exchanges', 'https://www.rabbitmq.com/docs/dlx'],
        ['Azure — Competing Consumers pattern', 'https://learn.microsoft.com/en-us/azure/architecture/patterns/competing-consumers']
      ]
    },
    caching: {
      en: {
        title: 'Caching as a bounded copy', intro: 'A cache is a disposable, stale copy with a failure mode. Its key, TTL and origin-protection plan are part of correctness.',
        sections: [
          { title: 'Choose what may be stale', items: [
            'Include tenant, authorization dimension and schema version in keys. Never cache a security or monetary decision unless the product defines acceptable staleness.',
            'Use cache-aside for simple reads, versioned keys for safe rollout and randomized TTLs to avoid synchronized expiry; cap negative-cache lifetime.'
          ]},
          { title: 'Protect the origin', items: [
            'Coalesce concurrent misses, refresh hot values ahead of expiry and bound rebuild concurrency. A cache outage must not instantly multiply origin load by the hit ratio.',
            'Monitor hit ratio by key class, eviction, memory fragmentation, hot keys, fill latency and origin amplification—not only cache latency.'
          ]},
          { title: 'Compare tiers', items: [
            'L1 removes a network hop but multiplies stale copies; shared L2 centralizes data and invalidation but adds a network dependency and hotspot risk.',
            'Choose LRU/LFU/TTL from access distribution and object value. If eviction loses authoritative state, the component is a database wearing a cache label.'
          ]}
        ]
      },
      vi: {
        title: 'Cache là bản sao có giới hạn', intro: 'Cache là bản sao stale có thể bỏ và có failure mode. Key, TTL cùng kế hoạch bảo vệ origin là một phần của correctness.',
        sections: [
          { title: 'Choose what may be stale', items: [
            'Đưa tenant, authorization dimension và schema version vào key. Không cache security/money decision nếu product chưa định nghĩa staleness chấp nhận được.',
            'Dùng cache-aside cho read đơn giản, versioned key để rollout an toàn và randomized TTL chống synchronized expiry; giới hạn negative-cache lifetime.'
          ]},
          { title: 'Protect the origin', items: [
            'Coalesce concurrent miss, refresh hot value trước expiry và giới hạn rebuild concurrency. Cache outage không được lập tức nhân origin load theo tỷ lệ hit.',
            'Theo dõi hit ratio theo key class, eviction, memory fragmentation, hot key, fill latency và origin amplification; không chỉ cache latency.'
          ]},
          { title: 'Compare tiers', items: [
            'L1 bỏ network hop nhưng nhân số stale copy; L2 shared gom data/invalidation nhưng thêm network dependency và hotspot risk.',
            'Chọn LRU/LFU/TTL theo access distribution và giá trị object. Nếu eviction làm mất authoritative state thì đây là database mang nhãn cache.'
          ]}
        ]
      },
      sources: [
        ['Redis — Cache-aside', 'https://redis.io/docs/latest/develop/use-cases/cache-aside/'],
        ['Redis — Key eviction', 'https://redis.io/docs/latest/develop/reference/eviction/'],
        ['Redis — Client-side caching', 'https://redis.io/docs/latest/develop/clients/client-side-caching/']
      ]
    },
    'search-ranking': {
      en: {
        title: 'Indexes, ranking and freshness', intro: 'Fast ranking comes from a bounded candidate set and a versioned derived index, not from querying the source of truth on every keystroke or feed read.',
        sections: [
          { title: 'Separate retrieval from ranking', items: [
            'Retrieve a bounded candidate set using prefix, graph, time or score indexes; rank it with a versioned rule/model and keep a deterministic fallback.',
            'Store the ranking/model version and stable tie-break key so pagination, audits and experiments can reproduce an ordering.'
          ]},
          { title: 'Control index freshness', items: [
            'Measure event-to-searchable lag by percentile and entity class. Rebuild into a new version, validate counts/checksums, then atomically switch readers.',
            'Re-check authorization, deletion and hard availability constraints at read time; an eventually consistent candidate index must not bypass current policy.'
          ]},
          { title: 'Bound cost and abuse', items: [
            'Debounce typeahead, cap prefix/fuzzy expansion and cache popular anonymous prefixes. Personalization reduces cacheability and increases privacy review.',
            'Track empty-result rate, candidate count, ranking latency, index size, stale-result complaints and quality metrics separately from availability.'
          ]}
        ]
      },
      vi: {
        title: 'Index, ranking và freshness', intro: 'Ranking nhanh đến từ candidate set hữu hạn và derived index có version, không phải query source of truth ở mỗi keystroke hay feed read.',
        sections: [
          { title: 'Separate retrieval khỏi ranking', items: [
            'Retrieve candidate set hữu hạn bằng prefix, graph, time hoặc score index; rank bằng rule/model có version và giữ deterministic fallback.',
            'Lưu ranking/model version cùng stable tie-break key để pagination, audit và experiment tái tạo được thứ tự.'
          ]},
          { title: 'Control index freshness', items: [
            'Đo event-to-searchable lag theo percentile và entity class. Rebuild sang version mới, kiểm count/checksum rồi atomically chuyển reader.',
            'Re-check authorization, deletion và hard availability constraint lúc read; candidate index eventual không được bypass policy hiện tại.'
          ]},
          { title: 'Bound cost and abuse', items: [
            'Debounce typeahead, giới hạn prefix/fuzzy expansion và cache popular anonymous prefix. Personalization giảm cacheability và tăng privacy review.',
            'Theo dõi empty-result rate, candidate count, ranking latency, index size, stale-result complaint và quality metric tách khỏi availability.'
          ]}
        ]
      },
      sources: [
        ['Elasticsearch — Near real-time search', 'https://www.elastic.co/docs/manage-data/data-store/near-real-time-search'],
        ['Elasticsearch — Optimistic concurrency control', 'https://www.elastic.co/docs/reference/elasticsearch/rest-apis/optimistic-concurrency-control'],
        ['Elasticsearch — Search-as-you-type field', 'https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/search-as-you-type'],
        ['Redis — Compare data types', 'https://redis.io/docs/latest/develop/data-types/compare-data-types/']
      ]
    },
    'object-storage': {
      en: {
        title: 'Object integrity and lifecycle', intro: 'Separate strongly consistent metadata from bulk bytes and make upload completion a verified state transition.',
        sections: [
          { title: 'Secure direct upload', items: [
            'Issue short-lived, narrowly scoped presigned operations for one object/session; bind expected size, content type, checksum and tenant ownership in metadata.',
            'Treat a presigned URL as a bearer capability. Restrict signature age, prevent key overwrite unless intended and never trust a client-declared MIME type alone.'
          ]},
          { title: 'Verify and finalize', items: [
            'Record every part and checksum idempotently, require consecutive parts, then verify full size/checksum before changing the object from uploading to available.',
            'Do not treat multipart ETag as the full-object MD5. Persist the selected checksum algorithm/value and verify it again during repair or critical download.'
          ]},
          { title: 'Operate the lifecycle', items: [
            'Expire abandoned sessions and orphan parts, quarantine malware scans, version metadata changes and make retention/legal hold override ordinary deletion.',
            'Measure incomplete bytes, finalize latency, checksum failures, replication/repair backlog and restore sampling; durability claims require periodic verification.'
          ]}
        ]
      },
      vi: {
        title: 'Object integrity và lifecycle', intro: 'Tách metadata strong-consistent khỏi bulk byte và biến upload completion thành state transition đã xác minh.',
        sections: [
          { title: 'Secure direct upload', items: [
            'Cấp presigned operation sống ngắn, scope hẹp cho một object/session; bind expected size, content type, checksum và tenant ownership trong metadata.',
            'Xem presigned URL như bearer capability. Giới hạn signature age, chặn overwrite key ngoài ý muốn và không tin MIME type do client khai báo.'
          ]},
          { title: 'Verify and finalize', items: [
            'Ghi từng part/checksum idempotently, yêu cầu part liên tiếp rồi verify full size/checksum trước khi chuyển object từ uploading sang available.',
            'Không xem multipart ETag là MD5 toàn object. Lưu checksum algorithm/value đã chọn và verify lại khi repair hoặc critical download.'
          ]},
          { title: 'Operate the lifecycle', items: [
            'Expire abandoned session/orphan part, quarantine malware scan, version metadata change và để retention/legal hold ưu tiên hơn delete thông thường.',
            'Đo incomplete byte, finalize latency, checksum failure, replication/repair backlog và restore sampling; durability claim cần kiểm chứng định kỳ.'
          ]}
        ]
      },
      sources: [
        ['Amazon S3 — Checking object integrity', 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html'],
        ['AWS — Presigned URL guardrails', 'https://docs.aws.amazon.com/prescriptive-guidance/latest/presigned-url-best-practices/additional-guardrails.html']
      ]
    },
    observability: {
      en: {
        title: 'Observability and security review', intro: 'Instrumentation should explain user impact and the responsible dependency without leaking identity or creating unbounded telemetry cost.',
        sections: [
          { title: 'Start from user SLIs', items: [
            'Define success, latency, freshness and correctness SLIs at the system boundary; alert on error-budget burn, then use dependency metrics for diagnosis.',
            'Correlate traces, metrics and structured logs with trace/span IDs. Preserve request, policy and schema versions but redact secrets and sensitive payloads.'
          ]},
          { title: 'Keep telemetry bounded', items: [
            'Never use user ID, object ID or raw URL as a metric label. Use logs/traces for high-cardinality detail and explicitly monitor cardinality overflow.',
            'Sample by value: retain errors, slow paths and rare business failures at higher rates while keeping predictable storage and query cost.'
          ]},
          { title: 'Review the trust boundary', items: [
            'Authorize the object and action on every request, use least-privilege service identities and short-lived credentials, encrypt in transit/at rest and audit privileged changes.',
            'Threat-model abuse, replay, enumeration, tenant crossover and data retention. Security controls need degraded behavior and recovery drills like every other dependency.'
          ]}
        ]
      },
      vi: {
        title: 'Review observability và security', intro: 'Instrumentation phải giải thích user impact và dependency chịu trách nhiệm mà không leak identity hay tạo telemetry cost vô hạn.',
        sections: [
          { title: 'Start from user SLIs', items: [
            'Định nghĩa success, latency, freshness và correctness SLI tại system boundary; alert theo error-budget burn rồi dùng dependency metric để chẩn đoán.',
            'Correlate trace, metric và structured log bằng trace/span ID. Giữ request/policy/schema version nhưng redact secret và sensitive payload.'
          ]},
          { title: 'Keep telemetry bounded', items: [
            'Không dùng user ID, object ID hay raw URL làm metric label. Dùng log/trace cho high-cardinality detail và theo dõi cardinality overflow rõ ràng.',
            'Sample theo giá trị: giữ error, slow path và rare business failure ở tỷ lệ cao hơn nhưng vẫn giới hạn storage/query cost.'
          ]},
          { title: 'Review the trust boundary', items: [
            'Authorize object và action ở mỗi request, dùng service identity least-privilege và credential sống ngắn, encrypt transit/rest, audit privileged change.',
            'Threat-model abuse, replay, enumeration, tenant crossover và retention. Security control cũng cần degraded behavior và recovery drill như dependency khác.'
          ]}
        ]
      },
      sources: [
        ['OpenTelemetry — Metrics and cardinality', 'https://opentelemetry.io/docs/concepts/signals/metrics/'],
        ['AWS — Security Pillar', 'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html']
      ]
    },
    'identity-edge': {
      en: {
        title: 'Identity controls at the gateway boundary',
        intro: 'Authentication, authorization and key distribution are separate decisions. The edge can reject cheap failures early, but a service must still own its resource invariant and trust boundary.',
        sections: [
          { title: 'Verify the token, then verify the context', items: [
            'Validate issuer, signature algorithm, key id, audience and time claims before using a JWT. A cached JWKS is verification material, not proof that a user may access a particular object.',
            'Use the gateway for coarse route policy and let the resource service verify the original token or a signed internal assertion. Strip client identity headers before adding trusted context.'
          ]},
          { title: 'Treat keys and policy as dependencies', items: [
            'Refresh an unknown key id once with backoff, overlap old and new signing keys during rotation, and keep the last valid key set only for the documented degraded window.',
            'Cache policy decisions with a key that includes principal, tenant, action, resource class and policy version. A stale allow is a security decision, not an ordinary cache hit.'
          ]},
          { title: 'Choose degraded behavior per risk', items: [
            'Short-lived JWTs can keep low-risk reads available during a bounded IdP outage; high-risk writes should fail closed when introspection or policy evidence is unavailable.',
            'Measure verification p99, JWKS miss and refresh rates, PDP latency, deny/allow changes and key-id distribution. These signals reveal an identity bottleneck before a global gateway outage.'
          ]}
        ]
      },
      vi: {
        title: 'Identity control tại gateway boundary',
        intro: 'Authentication, authorization và key distribution là các decision khác nhau. Edge có thể reject lỗi rẻ sớm, nhưng service vẫn phải sở hữu resource invariant và trust boundary.',
        sections: [
          { title: 'Verify token rồi verify context', items: [
            'Validate issuer, signature algorithm, key id, audience và time claim trước khi dùng JWT. JWKS cache là verification material, không phải bằng chứng user được đọc object cụ thể.',
            'Dùng gateway cho coarse route policy và để resource service verify original token hoặc signed internal assertion. Strip identity header từ client trước khi thêm context trusted.'
          ]},
          { title: 'Coi key và policy là dependency', items: [
            'Refresh key id lạ một lần có backoff, overlap key cũ và mới trong rotation, rồi chỉ giữ key set hợp lệ cuối cùng trong degraded window đã ghi.',
            'Cache policy decision với key gồm principal, tenant, action, resource class và policy version. Stale allow là security decision, không phải cache hit bình thường.'
          ]},
          { title: 'Chọn degraded behavior theo risk', items: [
            'JWT ngắn hạn có thể giữ low-risk read sống qua IdP outage có giới hạn; high-risk write nên fail closed khi thiếu introspection hoặc policy evidence.',
            'Đo verification p99, JWKS miss/refresh rate, PDP latency, allow/deny change và key-id distribution. Các signal này lộ identity bottleneck trước gateway outage toàn cục.'
          ]}
        ]
      },
      sources: [
        ['Spring Cloud Gateway — Reference', 'https://docs.spring.io/spring-cloud-gateway/reference/index.html'],
        ['Spring Security — Resource Server JWT', 'https://docs.spring.io/spring-security/reference/reactive/oauth2/resource-server/jwt.html'],
        ['RFC 9700 — OAuth 2.0 Security BCP', 'https://www.rfc-editor.org/rfc/rfc9700.html'],
        ['RFC 8725 — JWT Best Current Practices', 'https://www.rfc-editor.org/rfc/rfc8725.html'],
        ['OpenID Connect Discovery 1.0', 'https://openid.net/specs/openid-connect-discovery-1_0.html'],
        ['Resilience4j — CircuitBreaker', 'https://resilience4j.readme.io/docs/circuitbreaker'],
        ['Open Policy Agent — REST API', 'https://www.openpolicyagent.org/docs/latest/rest-api/']
      ]
    },
    'data-evolution': {
      en: {
        title: 'Evolution without premature distribution', intro: 'Scale by measured bottleneck and preserve a reversible path; every new datastore creates consistency and on-call obligations.',
        sections: [
          { title: 'Use the cheapest lever first', items: [
            'Fix query shape and indexes, bound connection pools, add replicas/caches, then asynchronous read models before partitioning or sharding the source of truth.',
            'Record the metric and threshold that justify each step. A component without a removal criterion tends to become permanent architecture.'
          ]},
          { title: 'Separate models only when needed', items: [
            'CQRS can share one store first. Split physical stores only when read/write load, model or security boundaries demand independent scaling.',
            'Treat every derived model as rebuildable: version transformations, retain a replay source, compare counts/checksums and rehearse backfill under live load.'
          ]},
          { title: 'Partition around invariants', items: [
            'Choose a key that keeps the common transaction local and spreads writes; quantify skew before rollout and define how hot tenants/entities are isolated.',
            'Use expand-migrate-contract for schema and dual-read verification for data moves. Avoid unbounded dual writes; give migration a completion SLI and rollback point.'
          ]}
        ]
      },
      vi: {
        title: 'Evolution không phân tán quá sớm', intro: 'Scale theo bottleneck đã đo và giữ đường đi reversible; mỗi datastore mới tạo thêm nghĩa vụ consistency và on-call.',
        sections: [
          { title: 'Use the cheapest lever first', items: [
            'Sửa query/index, giới hạn connection pool, thêm replica/cache rồi async read model trước khi partition hoặc shard source of truth.',
            'Ghi metric và threshold biện minh cho mỗi bước. Component không có removal criterion thường trở thành kiến trúc vĩnh viễn.'
          ]},
          { title: 'Separate models only when needed', items: [
            'CQRS có thể dùng chung một store trước. Chỉ tách physical store khi load, model hoặc security boundary của read/write cần scale độc lập.',
            'Xem mọi derived model là rebuildable: version transform, giữ replay source, so count/checksum và diễn tập backfill khi live load.'
          ]},
          { title: 'Partition around invariants', items: [
            'Chọn key giữ common transaction local và phân tán write; định lượng skew trước rollout, định nghĩa cách cô lập hot tenant/entity.',
            'Dùng expand-migrate-contract cho schema và dual-read verification khi chuyển data. Tránh dual write vô hạn; migration cần completion SLI và rollback point.'
          ]}
        ]
      },
      sources: [
        ['Azure — CQRS pattern', 'https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs'],
        ['AWS Well-Architected — Reliability design principles', 'https://docs.aws.amazon.com/wellarchitected/2024-06-27/framework/rel-dp.html']
      ]
    }
  }
};
