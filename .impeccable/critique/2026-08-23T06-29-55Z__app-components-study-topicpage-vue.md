---
target: app/components/study/TopicPage.vue
total_score: 29
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
timestamp: 2026-08-23T06-29-55Z
slug: app-components-study-topicpage-vue
---
Method: dual-agent (A: /root/ui_design_review · B: /root/ui_detector_review)

## Design Health Score

| # | Heuristic | Score | Nhận xét |
|---|---|---:|---|
| 1 | Visibility of System Status | 3/4 | Review, progress, locked calendar và selected day đã rõ; TOC chưa có active section. |
| 2 | Match System / Real World | 3/4 | Study/calendar vocabulary hợp ngữ cảnh; một số label phụ còn nặng tính kỹ thuật. |
| 3 | User Control and Freedom | 3/4 | Reviewed có thể bỏ chọn, popup có close/focus restore; qtop mobile đã bỏ sticky. |
| 4 | Consistency and Standards | 3/4 | Stable hooks, semantic roles và màu đọc nhất quán hơn; CSS vẫn còn nhiều scale ad-hoc. |
| 5 | Error Prevention | 3/4 | Touch targets và labels tốt hơn, note mở theo nhu cầu; calendar 320px vẫn cần browser pass. |
| 6 | Recognition Rather Than Recall | 3/4 | Topic picker, qprompt và semantic colors giúp scan; icon-only actions vẫn cần title/ARIA được kiểm tra trên thiết bị. |
| 7 | Flexibility and Efficiency | 3/4 | Keyboard, language switch, bulk expand và mobile layout hỗ trợ nhiều workflow. |
| 8 | Aesthetic and Minimalist Design | 3/4 | Hierarchy đã có chủ ý; release feed và article cards vẫn có thể nhẹ hơn khi archive dài. |
| 9 | Error Recovery | 3/4 | Loading/empty/error/locked states hiện diện; cần xác nhận focus và scroll trong browser thực. |
| 10 | Help and Documentation | 2/4 | Nhãn rõ hơn nhưng chưa có active TOC, filter/jump cho release archive hay hướng dẫn ngắn cho calendar. |
| **Total** |  | **29/40** | **Good — nền tảng tốt, còn thiếu vòng visual/mobile validation.** |

## Design Specificity Verdict

### LLM assessment

GAZLL đã có ngôn ngữ riêng: emerald cho hành động học, steel-blue cho top-inner, indigo cho blueprint và brass/sand cho migrated notes. Study Track ưu tiên câu hỏi và answer thay vì biến thành dashboard; đây là hướng đúng cho kỹ sư Java học dài trên điện thoại. Hệ thống vẫn hơi bị phân mảnh bởi stylesheet lớn với nhiều override nối tiếp và một số card/timeline có thể thuộc bất kỳ knowledge app nào.

### Deterministic scan

Assessment B quét các component chính và `public/styles.css`: 530 findings, gồm 529 advisory về font/color/radius scale, 15 side-tab, 5 layout-transition và 1 broken-image warning. Broken-image là false positive vì dòng bị bắt là comment chứa literal `<img>`; image thật có alt, kích thước và lazy loading. `Space Grotesk` là font heading có chủ ý. Các side-tab là accent semantic có chủ ý. Không có bằng chứng overflow ngang không được chứa trong các vùng đã kiểm tra. Không mass-rewrite 529 advisory vì sẽ làm mất hệ scale hiện tại.

## Overall Impression

Batch trước đã giải quyết đúng phần dễ gây khó chịu nhất: đọc bài trên mobile bị action rail và note editor chen ngang. Batch này tiếp tục đưa UI về content-first: qtop không sticky trên SP, note mở theo nhu cầu, action/ARIA song ngữ, focus quay về trigger, và article chrome dùng chung trục đọc. Cơ hội lớn nhất tiếp theo là một browser pass thật ở 320/360/390/430px để đo layout thay vì chỉ suy luận từ CSS.

## What's Working

- Study Track có hierarchy rõ: question là tín hiệu chính, qmeta là rail, answer dùng toàn bộ reading surface; reviewed toggle có thể đảo chiều.
- Semantic palette đã tách text normal/header/attention/link/code, migrated notes và top-inner không còn lẫn vào reading surface.
- Stable `id`/`data-ui` phủ header, question, release notes, system design, collection và calendar nên việc dev/prompt/regression dễ hơn.

## Priority Issues

- **[P1] Chưa có browser evidence cho mode SP.** CSS đã xử lý qmeta sticky, 44px controls, note on-demand và article gutter, nhưng chưa biết iOS/Chrome thực tế có clipping, scroll jump hay focus issue không. **Fix:** chạy visual pass ở 320/360/390/430px với một topic dài, một answer có code, một note đã lưu, system-design TOC và calendar month/year.

- **[P1] TOC dài chưa báo vị trí hiện tại.** Người đọc System Design/Collection phải nhớ mình đang ở section nào. **Fix:** IntersectionObserver đặt `aria-current="location"` cho link section đang đọc, đồng thời giữ mobile summary ngắn gọn.

- **[P1] Calendar month/year vẫn là vùng mật độ cao.** Grid 320px đã được cho cuộn riêng và year day có min-height mobile, nhưng category vẫn dựa nhiều vào màu/dots. **Fix:** xác nhận selected-day detail sau tap và bổ sung ký hiệu/label phụ khi event nhiều.

- **[P2] Release Notes sẽ nặng khi archive dài.** Day → release → change rail tạo nhiều lớp border/card trên mobile. **Fix:** giảm nesting ở mobile, thêm filter kind hoặc year/month jump và nút quay về latest.

- **[P2] Detector còn cảnh báo token drift.** Đây là tín hiệu bảo trì chứ chưa phải lỗi hiển thị. **Fix:** khi thêm surface mới, dùng token semantic/component chung; chỉ thêm giá trị ad-hoc nếu có lý do đo được và thêm regression test.

## Persona Red Flags

- **Alex — Java power user:** workflow học liên tục đã gọn hơn, nhưng System Design dài chưa có active TOC nên khó quay lại đúng section; answer rộng cần được kiểm tra trên desktop ultrawide.
- **Sam — mobile learner:** qmeta không còn che answer, note trống không còn kéo dài card, label VI rõ hơn; calendar 320px và icon-only action vẫn cần test bằng ngón tay thật.
- **Casey — maintainer/editor:** stable hooks tốt cho prompt/dev; stylesheet nhiều block override và 529 detector advisory khiến thay đổi sau này dễ drift nếu không giữ component-first.

## Minor Observations

- Topic picker đã dùng listbox/option và popup focus restore; cần kiểm tra keyboard arrow navigation sau khi có browser harness.
- qbody có region/hidden khi đóng, note textarea có label/ARIA; đây là thay đổi accessibility có tác động trực tiếp.
- Dialog lightbox collection đã có accessible name.
- Browser/Puppeteer không khả dụng trong environment này nên không kết luận về computed layout, iOS safe area hay focus trap.

## Questions to Consider

- Nếu active TOC luôn cho biết “đang ở đâu”, người đọc có bớt phải mở panel không?
- Release archive có cần giữ cảm giác timeline, hay nên ưu tiên tìm lại một mốc cụ thể?
- Calendar mobile có nên mặc định mở agenda/day list thay vì month grid ở viewport dưới 360px?
