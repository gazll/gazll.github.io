# UI/UX Improvement TODO — session handoff

Đây là checklist và decision log rút ra từ session cải thiện UI. Mục tiêu là
giữ đúng ngữ cảnh khi tiếp tục trên máy khác, tránh quay lại các hướng đã thấy
không phù hợp.

Last reviewed: 2026-08-23

## Bối cảnh sản phẩm

- Người dùng chính là kỹ sư Java; nội dung học dài và thường được mở trên điện
  thoại.
- `mode SP` là surface ưu tiên. Mọi thay đổi desktop phải được kiểm tra lại ở
  mobile trước khi xem là hoàn tất.
- `calendar-schedule` là sub-tool có style riêng. Không cần ép giống page
  chính, nhưng vẫn phải đạt cùng chuẩn về đọc, khoảng cách, màu, trạng thái và
  accessibility.
- Nội dung, UI và tooling là ba phạm vi khác nhau. Không trộn một đợt chỉnh
  CSS với migration content nếu không cần thiết.

## Những nguyên tắc đã chốt

### 1. Reading surface là trung tâm

- [x] `answer-body`, `sd-article-body` và các vùng đọc chính dùng toàn bộ bề
  rộng hữu ích của div bao quanh; không để một cột nội dung vô tình chỉ chiếm
  khoảng 70% rồi bỏ trống phần còn lại.
- [x] Không dùng `text-align: justify`. Giữ rag tự nhiên để khoảng cách chữ
  không bị giãn, nhất là tiếng Việt trên màn hình hẹp.
- [x] Heading, lead, paragraph, list, table, code và metadata phải có nhịp
  riêng; không áp cùng một rule cho toàn bộ HTML được render.
- [x] Drop cap và thụt dòng chỉ áp dụng cho prose phù hợp, không áp dụng cho
  heading, list, bảng, card, code hoặc nhãn điều khiển.
- [ ] Kiểm tra lại bằng nội dung thật ở 320/360/390/430px và desktop rộng;
  không đánh giá bằng một đoạn text ngắn duy nhất.

### 2. Hierarchy của study question

- [x] Câu hỏi là tín hiệu thị giác lớn nhất; `type`/label là thông tin phụ và
  nằm theo trục dọc với câu hỏi.
- [x] `.qmeta` là action rail dọc, không phải một hàng ngang cạnh câu hỏi.
- [x] Answer dùng full reading surface; action và metadata không được làm
  prose bị bó hẹp hoặc kéo bài dài thêm vì khoảng trắng vô ích.
- [ ] Kiểm tra ở màn hình nhỏ xem rail có còn đủ rõ nhưng không chiếm quá nhiều
  chiều ngang hay không.

### 3. Tương tác phải an toàn và đảo chiều được

- [x] Nút `Reviewed` phải chuyển được cả checked và unchecked để sửa thao tác
  bấm nhầm.
- [x] Các toggle/summary phải giữ affordance rõ ràng, trạng thái focus và
  `aria-expanded`/`aria-controls` khi có vùng nội dung liên quan.
- [ ] Thử bằng bàn phím và touch; mọi target chính cần kích thước chạm hợp lý,
  không chỉ đẹp khi hover trên desktop.

### 4. Navigation và information architecture

- [x] Menu Kỹ thuật theo thứ tự ưu tiên: `topic question` → `system design` →
  `case studies`; `Gazl try` gần cuối; `Thống kê` ở cuối cùng.
- [x] `Lịch` thuộc menu Trải nghiệm, không thuộc menu Kỹ thuật.
- [ ] Mở menu ở mobile và desktop để xác nhận thứ tự, focus order, overflow và
  không có khoảng trống đầu menu.

### 5. Header và top-inner

- [x] `topic picker` là anchor chính nên được ưu tiên chiều rộng.
- [x] Search box phải đủ dài để nhận diện và thao tác nhanh; không dành một
  spacer lớn cho phần header không có thông tin.
- [x] Mobile giữ một hàng gọn, tránh đẩy topic/search xuống hàng thứ hai hoặc
  tạo vùng trống dọc.
- [ ] Xác nhận search vẫn usable khi title/topic dài và khi viewport có safe
  area.

### 6. System-design article layout

- [x] `sd-article-head`, `sd-article-body` và khối article dùng cùng một trục
  ngang/measure.
- [x] TOC không được giữ như một cột thường trực làm bó hẹp prose; control có
  thể mở theo hướng overlay/vertical để không tốn thêm chiều ngang hoặc chiều
  dọc không cần thiết.
- [ ] Rà soát lại `sd-article-grid` trên mobile: mở TOC không được làm nhảy
  layout, che heading hoặc tạo scroll ngang.
- [ ] Kiểm tra action button của article ở trạng thái đóng/mở và khi dịch sang
  tiếng Việt; placement phải ưu tiên đọc, không mở một panel ngang vô ích.

### 7. Màu và typography theo semantic role

- [x] Text thường dùng neutral có contrast cao; không dùng tím/indigo làm màu
  cho cả đoạn văn dài.
- [x] Tách role rõ ràng: `text-normal`, `text-header`, `text-meta`,
  `text-high-attention`, `text-link`, `text-code` và `surface-code`.
- [x] `migrated-notes` có tone nền, chữ và border riêng để báo đây là nội dung
  được chuyển từ surface khác; không trộn với reading surface chính.
- [x] `top-inner` có tone riêng, nhưng vẫn nằm trong cùng hệ token và phải giữ
  contrast/focus nhất quán.
- [ ] Chạy lại contrast review cho cả EN/VI, trạng thái hover/focus/disabled,
  code inline, placeholder và dark code block.

### 8. Stable targeting cho dev và prompt

- [x] Component/surface quan trọng có `id` ổn định và/hoặc `data-ui`:
  header, topic picker, search, question card/toggle/body/answer, release
  notes, system-design article/TOC/body, collection article/index và
  calendar surface/toolbar/view-panel/rail/inbox.
- [x] ID lặp theo item phải có namespace và giữ ID persistent cũ cho bookmark,
  progress và cross-reference.
- [ ] Khi thêm component mới, kiểm tra uniqueness trong DOM và tránh dùng lại ID
  của component khác chỉ vì selector cũ đang tiện.

## Checklist triển khai tiếp theo

### P0 — xác nhận UX chính

- [ ] Browser pass mobile-first cho `mode SP`: header, menu, question card,
  reviewed toggle, answer dài, note editor và loading/empty/error state.
- [x] Release Notes đã dùng shell full-bleed (`.rn-page { padding: 0 }`);
  gutter đọc được đặt lại ở header/list để không chạm mép màn hình.
- [ ] Browser pass cho release notes: `padding: 0` không làm mất gutter đọc;
  ngày, release item và change list vẫn phân cấp rõ trên mobile.
- [ ] Browser pass cho system-design: head/body/TOC/action cùng measure, không
  scroll ngang, không có khoảng trắng thừa ở đầu hoặc bên phải.
- [ ] Browser pass cho `calendar-schedule`; giữ bản sắc riêng nhưng sửa các
  lỗi cùng nhóm: touch target, density, contrast, overflow, focus và trạng
  thái selected.

### P1 — hệ thống và độ bền

- [ ] Gom mọi màu đọc vào token semantic; không thêm màu ad-hoc cho một page
  nếu role đã tồn tại.
- [ ] Giữ component-first: sửa component/token chung trước, chỉ thêm
  page-specific override khi có lý do đo được.
- [ ] Thêm regression test cho menu order, toggle hai chiều, stable IDs và
  mobile overflow nếu hành vi chưa được test.
- [ ] Kiểm tra `data-ui`/ID sau các thay đổi Vue có `v-for`, bilingual content
  hoặc route động.

### P1 — validation và handoff

- [x] Targeted UI/a11y tests pass: 78/78 (`native-surfaces`, `manual-review`,
  `a11y.contrast`).
- [x] `node tools/check.mjs --only tests` pass 241/241.
- [x] `npm.cmd run generate` pass và prerender được 167 routes.
- [x] `node tools/check.mjs` pass đủ các stage: content, diagrams, syntax,
  console và 241/241 tests.
- [ ] Nếu gate fail vì content migration hoặc file thiếu, ghi rõ blocker; không
  chữa bằng cách restore/reset thay đổi của người khác và không xem đó là lỗi
  UI.
- [ ] Review `git diff --check`, `git status` và tách commit UI khỏi commit
  content/research.
- [ ] Commit + push branch để máy khác có thể `clone/pull`; local Codex session
  và file chưa commit không phải là cơ chế đồng bộ.

## Rút kinh nghiệm về quy trình

- Bắt đầu từ usage scene (học bài dài trên điện thoại), sau đó mới chọn grid,
  spacing và màu; không bắt đầu bằng việc đổi từng selector rời rạc.
- Kiểm tra mobile cùng batch với desktop. Một khoảng trống nhỏ ở header hoặc
  action rail sẽ phóng đại rõ trên màn hình hẹp.
- Tách “đọc tốt hơn” khỏi “trang trí nhiều hơn”: hierarchy, line-height,
  contrast và trạng thái tương tác quan trọng hơn accent mới.
- Hook `PostToolUse`/stop hook là lớp tooling riêng. Khi hook exit code 1,
  lưu output và chạy gate thủ công để phân biệt lỗi hook với lỗi ứng dụng; không
  lặp vô hạn cùng một thao tác khiến hook fail tiếp.
- Worktree có thể đang chứa migration/research của phiên khác. Luôn ghi nhận
  baseline, không reset/restore bừa, và báo blocker cụ thể khi build bị ảnh
  hưởng bởi file content ngoài phạm vi UI.

## Trạng thái tại điểm bàn giao

- [x] Các thay đổi UI chính và stable targeting hooks đã được ghi nhận trong
  code hiện tại.
- [x] Release Notes full-bleed shell và calendar targeting hooks đã được thêm;
  visual browser pass vẫn còn trong P0.
- [x] Checklist này là nguồn tiếp tục cho session mới.
- [x] Full gate đã sạch sau khi body case-study giữ caveat nguồn nhưng không
  nhúng publisher-mirror URL; source chính vẫn nằm ở metadata được allowlist.

## Review bổ sung 2026-08-23

### Calendar instrument pass 2026-08-23

- [x] Tách calendar thành public date surface và private schedule lane; toolbar có
  stable hooks cho date nav, view tabs, lock/unlock, month grid, rail và inbox.
- [x] Mobile/tablet có today strip để ngày hiện tại không bị chôn trong rail; rail
  today card ẩn khi strip đã hiện, unlock card đưa lên trước khi lịch riêng khoá.
- [x] Ngày đã chọn hiện chi tiết inline trên mobile; cell có event count/holiday
  marker không chỉ dựa vào màu; `aria-current`, `aria-pressed`, legend và selected
  regions được gán đầy đủ.
- [x] Category private schedule giữ raw value trong storage nhưng hiển thị nhãn
  EN/VI; category label được dùng cả trong agenda, selected detail và `aria-label`.
- [x] Touch target mobile cho prev/next/today/lock/view/filter/checklist/inbox action
  dùng mức 44px; grid 320px cuộn theo cụm thay vì ép cột quá hẹp.
- [x] `node tools/check.mjs` pass 241/241; `npm.cmd run generate` pass 167 routes;
  browser pass vẫn chưa thực hiện được vì environment không có Playwright/Puppeteer.
- [x] Click holiday trong agenda/year và nút Today trên mobile luôn chuyển về month
  rồi reveal ngày đang chọn; tránh trạng thái đã chọn nhưng không nhìn thấy chi tiết.
- [x] Inbox serialize các mutation bằng busy state, disable action đang chạy và báo lỗi
  với `role="alert"`; relock cũng xoá password/error cũ để không giữ trạng thái stale.
- [x] Form unlock xoá hint cũ khi relock và khoá input/toggle trong lúc decrypt để không
  đổi state giữa chừng.
- [x] Calendar card dùng inset accent 2px thay cho border màu dày trên cạnh bo tròn;
  giữ semantic color nhưng giảm cảm giác nặng và tránh làm hẹp content width.

### Mobile adaptation pass 2026-08-23

- [x] Study Track chuyển qmeta từ rail dọc sang action row full-width trên phone;
  câu hỏi giữ trọn chiều ngang và nút Reviewed vẫn có nhãn nhìn thấy.
- [x] Header mobile bỏ progress ring không thiết yếu dưới 600px để topic/search/
  language/account không tranh width với nhau.
- [x] TOC mobile của System Design, Case Studies và Project dùng link tối thiểu 44px;
  article surface bỏ shadow/card chrome dư trên màn hình hẹp.
- [x] Calendar đưa selected-day detail lên trước legend để thông tin sau khi tap
  xuất hiện ngay trong vùng đọc tiếp theo.

- [x] Mobile Study Track không còn sticky toàn bộ `qtop`; action rail không che gần
  hết viewport khi đang đọc answer.
- [x] Note editor chuyển sang on-demand: card trống chỉ hiện `Thêm ghi chú`, note đã
  có nội dung tự mở lại; textarea có label/ARIA và placeholder EN/VI.
- [x] Review/copy/language labels có localize cho Study, System Design và Case Studies;
  qbody có `role="region"`, `aria-labelledby` và `hidden` khi đóng.
- [x] Topic picker dùng listbox/option đúng target; drawer/topic popup khôi phục
  focus về control mở nó sau khi đóng.
- [x] Topic section dùng heading `h2`, toolbar có role, pager và bulk action có nhãn
  song ngữ.
- [x] Calendar year day/inbox controls có accessible name, legend không còn bị ẩn
  với screen reader; mobile day grid có target phù hợp hơn.
- [x] Mở rộng touch target qmeta, TOC summary, topic stepper và menu close lên
  44px ở mobile; calendar 320px cho phép cuộn riêng grid thay vì ép chữ quá nhỏ.
- [x] TOC System Design/Case Studies có active location state theo viewport;
  calendar ngày đã chọn hiển thị category và đưa category vào accessible name.
- [x] Release Notes mobile bỏ nested card chrome, giữ timeline/divider để tăng
  chiều rộng cho nội dung dài và bản dịch tiếng Việt.

### Bằng chứng review

- Independent design review: P0 là qmeta sticky/viewport density; P1 là note on-demand,
  bilingual labels/ARIA, article alignment và TOC state; P2 là calendar cell density.
- Independent detector pass (trước batch fix): 530 findings, trong đó 529 advisory
  token-ramp trong `public/styles.css`; không mass-rewrite vì phần lớn là intentional
  design-system values. Batch này đã xử lý các missing labels/touch target chính.
- Browser pass trực tiếp chưa có trong environment này (không có Playwright/
  Puppeteer); cần verify 320/360/390/430px trên device thực, nhất là qmeta,
  note toggle, TOC và calendar grid.

### Retrieval and continuation pass 2026-08-23

- [x] Study Track hiển thị tiến độ reviewed ngay trong toolbar và có nút `Continue studying`
  để mở, cuộn và đặt hash vào câu chưa ôn tiếp theo; giữ nguyên reduced-motion.
- [x] Release Notes có filter archive theo năm và loại thay đổi, có reset, empty state,
  live status và touch target 44px trên mobile; summary toàn kho không bị mất khi lọc.
- [x] Note editor báo `Saving/Saved` theo debounce và flush khi blur, giúp người học biết
  ghi chú đã được lưu mà không thêm dialog hay bước xác nhận.

### Confidence and orientation pass 2026-08-23

- [x] Fully reviewed topics hiển thị trạng thái hoàn tất thay vì để toolbar mobile trống hành động.
- [x] Release Notes hiển thị số ngày/bản phát hành/thay đổi còn lại sau khi lọc, không chỉ thông báo ngầm cho screen reader.
- [x] Calendar inbox yêu cầu một bước xác nhận inline gần nút cho thao tác xoá và xoá toàn bộ mục đã chuyển.
- [x] Nhãn `Topic` ở pager được localize sang tiếng Việt.

### Continuity, keyboard and thumb clarity pass 2026-08-23

- [x] Topic picker dùng Arrow/Home/End để đi qua các kết quả đang lọc, không bắt người dùng
  Tab qua toàn bộ header trước khi tới topic cần mở.
- [x] Mobile TOC của System Design, Case Studies và Project hiển thị section hiện tại; Project
  cũng đã có `aria-current="location"` trên cả rail desktop và menu mobile.
- [x] Đổi ngôn ngữ ở header giữ lại viewport đang đọc; đổi ngôn ngữ ngay trong study card giữ
  cạnh trên của card ổn định và thông báo ngôn ngữ mới cho screen reader.
- [x] Lịch tháng dùng một điểm Tab cho cả grid, hỗ trợ phím mũi tên/Home/End để di chuyển theo
  ngày và vẫn giữ selected-day detail làm điểm xác nhận bằng mắt.
- [x] Release Notes có nút xoá bộ lọc ngay trong empty state, giúp quay lại archive mà không cần
  cuộn lên phần filter.
- [x] Calendar announced view/month changes to assistive technology, disabled previous/next at
  the supported date boundaries, and Study Track announces reviewed-count changes.
- [x] Review and copy actions expose concise live announcements after the action completes.

- [x] Search dialog giữ focus trong modal khi dùng Tab/Shift+Tab, khôi phục focus về nút mở
  và tự cuộn theo kết quả đang chọn bằng phím mũi tên.
- [x] Navigation drawer và topic picker giữ focus trong vùng đang mở, tránh tab rơi ra nền trang.
- [x] Study Track mobile hiển thị tiến độ reviewed thay vì ẩn hoàn toàn; action rail có nhãn ngắn
  cho Review/Link/EN-VI để giảm việc phải đoán icon trên màn hình nhỏ.

- [x] Search overlay có combobox/listbox semantics, keyboard selection được screen reader nhận biết và có nút retry khi index lỗi mạng.
- [x] TOC mobile của System Design, Case Studies và Project tự đóng sau khi chọn section để không che vùng đọc.
- [x] Static tools có thông báo lỗi thân thiện, nút retry và copy loading song ngữ thay vì lộ exception kỹ thuật.

### Focus, recovery and mobile affordance pass 2026-08-23

- [x] Headroom reveal header khi keyboard focus rơi vào control đang bị ẩn; có fallback `:focus-within` để focus ring không bị mất.
- [x] Topic picker xoá filter cũ khi đóng; language switch nói rõ người dùng sẽ chuyển sang EN/VI nào.
- [x] Search history có aria-label song ngữ, focus ring và target 44px trên mobile; overlay dùng `100dvh` và safe-area padding.
- [x] Lightbox article restore focus về nút mở sau khi đóng, bắt Escape an toàn, và nút close 44px trên mobile.
- [x] Mermaid actions/zoom và navigation drawer tôn trọng safe-area, có hit-area thumb-friendly trên phone.
