# `docs/`

Bốn nhóm, và chúng khác nhau về vòng đời — đó là lý do tách thư mục.

| Đường dẫn | Là gì | Vòng đời |
|---|---|---|
| `content-playbook.md` · `schedule-playbook.md` · `fshare-movie-playbook.md` · `course-registration.md` | **Playbook** — quy trình đang dùng, đọc trước khi sửa nội dung tương ứng | sống, cập nhật khi quy trình đổi |
| `todo/` | **Việc còn phải làm** — mỗi file một đợt, xoá khi đóng | tạm |
| `english-speaking-os-complete-2026.md` | ⚠️ **không phải tài liệu — đây là dữ liệu được ship** | xem cảnh báo dưới |

## ⚠️ `english-speaking-os-complete-2026.md` không được di chuyển

`server/api/content/english-study.get.ts` đọc file này bằng đường dẫn cứng, và
`tests/english-study.test.mjs` cũng vậy. Nó nằm trong `docs/` nhưng là **nội
dung của site**, không phải tài liệu nội bộ. Đổi tên hoặc chuyển chỗ là gãy
route `/english-study`.

## `research/` — đã gỡ (2026-09-12)

Từng có 46 record đơn vị + 16 dossier, là dẫn chứng đằng sau nội dung. Đợt rà
tháng 9/2026 đã áp 226/235 đề xuất sửa vào `public/data/`, chuyển 120 claim
kèm nguồn vào `public/data/content-reviews.json`, rồi gỡ thư mục. Ledger nguồn
đầy đủ (605 dòng, ~1.000 URL, ngày review từng nguồn) vẫn nằm trong git:
lấy commit gỡ bằng `git log -1 --format=%h --diff-filter=D -- docs/research/index.md`, rồi `git show <commit>^:docs/research/units/topics/01-java-core-jvm.md` cho từng unit. 141 câu
hỏi mở / falsifier của các unit đã thành khối *"What would change this answer"*
ở item mở đầu của 14 topic và lens thứ tư của 6 case study — không còn todo.

## `todo/` — xoá khi xong

Một file cho một đợt việc. **Đóng xong thì xoá file**, đừng để lại file toàn
`[x]` — trạng thái đã đóng thuộc về git history, không phải ở
đây. File dài hạn không có ngày; file theo đợt thì đặt kèm tháng
(`content-review-2026-09.md`). Thư mục trống là trạng thái bình thường —
2026-09-12 cả ba file đều đã đóng và xoá; quyết định rút ra nằm trong
CLAUDE.md ("Things that break easily") và các playbook.

Không đặt file `.todo.md` bên ngoài thư mục này nữa — hậu tố đó đã từng làm
hồ sơ nghiên cứu đã đóng trông như việc đang treo.

## Tài liệu ở root, không nằm trong `docs/`

Ba file markdown ở gốc repo, mỗi file trả lời một câu hỏi khác nhau. Chúng
không nằm ở đây vì công cụ và quy ước đều tìm chúng ở gốc.

| File | Trả lời câu hỏi | Ghi chú |
|---|---|---|
| `CLAUDE.md` | *luật của repo là gì* — lệnh nào chạy, code viết theo style nào, cái gì dễ vỡ và vì sao | dài nhất, nguồn chuẩn (`AGENTS.md` cũ đã gộp vào mục Conventions) |
| `DESIGN.md` | *token thị giác là gì* — màu, chữ, layout, elevation | xem ràng buộc dưới |
| `PRODUCT.md` | *sản phẩm này phục vụ ai, cam kết gì* | thứ duy nhất nói về sản phẩm chứ không phải kỹ thuật |

`DESIGN.md` và `PRODUCT.md` do công cụ **Impeccable** sinh ra. Bản thân công cụ
không còn được cấu hình ở máy này (`.impeccable/` đã gitignore vì nó lưu đường
dẫn tuyệt đối của máy chạy gần nhất), nhưng **hai file kết quả vẫn đúng và vẫn
được giữ**.

> **`DESIGN.md` phải khớp `public/styles.css`.** 25 token màu trong front-matter
> của nó hiện khớp chính xác 25/25 với giá trị thật trong `styles.css`. Sửa màu ở
> một bên thì phải sửa bên kia — lệch nhau là tài liệu nói dối. Riêng ngưỡng
> contrast thì `tests/a11y.contrast.test.mjs` mới là thứ có thẩm quyền, không
> phải file này.

## Không nằm ở đây

- `case-study-drafts/` — **gitignored**; từng chứa dữ liệu nội bộ chưa ẩn
  danh và 9,5MB workbook, đã xoá sau khi bài 12 publish. Dòng `.gitignore`
  giữ lại để bản nháp mới không bao giờ lọt vào repo.
- `public/data/projects/calebzone/docs/` — snapshot tài liệu được **ship** cho
  Project SRS, không phải tài liệu của repo.
- `public/vendor/` — code upstream, không đụng vào.
- `.impeccable/` — **gitignored**, state của công cụ sinh `DESIGN.md`/`PRODUCT.md`.
