# `docs/`

Bốn nhóm, và chúng khác nhau về vòng đời — đó là lý do tách thư mục.

| Đường dẫn | Là gì | Vòng đời |
|---|---|---|
| `content-playbook.md` · `schedule-playbook.md` · `course-registration.md` | **Playbook** — quy trình đang dùng, đọc trước khi sửa nội dung tương ứng | sống, cập nhật khi quy trình đổi |
| `todo/` | **Việc còn phải làm** — mỗi file một đợt, xoá khi đóng | tạm |
| `research/` | **Hồ sơ dẫn chứng** cho nội dung đang live | lưu trữ, chỉ đọc |
| `english-speaking-os-complete-2026.md` | ⚠️ **không phải tài liệu — đây là dữ liệu được ship** | xem cảnh báo dưới |

## ⚠️ `english-speaking-os-complete-2026.md` không được di chuyển

`server/api/content/english-study.get.ts` đọc file này bằng đường dẫn cứng, và
`tests/english-study.test.mjs` cũng vậy. Nó nằm trong `docs/` nhưng là **nội
dung của site**, không phải tài liệu nội bộ. Đổi tên hoặc chuyển chỗ là gãy
route `/english-study`.

## `research/` — hồ sơ đã đóng, giữ để tra cứu

Toàn bộ **46/46** record đơn vị ở trạng thái `INTEGRATED`: nội dung đã vào
`public/data/` rồi. Giữ lại vì đây là dẫn chứng đằng sau các claim đang hiển thị
— khi cần biết "câu này dựa vào nguồn nào" thì tra ở đây.

- `index.md` — bảng trạng thái từng đơn vị, là nguồn trạng thái chuẩn
- `units/topics/` (28) · `units/case-studies/` (18) — một record cho mỗi đơn vị
- `dossiers/` — tổng hợp theo chủ đề, so sánh chéo nhiều đơn vị

Nhãn `DEPLOYMENT INPUTS OPEN` trên vài file **không phải việc chưa xong**: đó là
các tham số phụ thuộc môi trường triển khai (provider, version, traffic, SLO),
cố ý để mở thay vì bịa một con số cho có.

## `todo/` — xoá khi xong

Một file cho một đợt việc. **Đóng xong thì xoá file**, đừng để lại file toàn
`[x]` — trạng thái đã đóng thuộc về `research/` hoặc git history, không phải ở
đây. File dài hạn (như `ui-improvement.md`) không có ngày; file theo đợt thì đặt
kèm tháng (`content-review-2026-09.md`).

Không đặt file `.todo.md` bên ngoài thư mục này nữa — hậu tố đó đã từng làm
hồ sơ nghiên cứu đã đóng trông như việc đang treo.

## Tài liệu ở root, không nằm trong `docs/`

Bốn file markdown ở gốc repo, mỗi file trả lời một câu hỏi khác nhau. Chúng
không nằm ở đây vì công cụ và quy ước đều tìm chúng ở gốc.

| File | Trả lời câu hỏi | Ghi chú |
|---|---|---|
| `CLAUDE.md` | *luật của repo là gì* — cái gì dễ vỡ, vì sao nó được quyết như vậy | dài nhất, nguồn chuẩn |
| `AGENTS.md` | *lệnh nào chạy, code viết theo style nào* | ngắn, theo quy ước agent chung |
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

- `case-study-drafts/` — **gitignored**, chứa dữ liệu nội bộ chưa ẩn danh và
  9,5MB workbook. Xem `todo/case-study-drafts-disposition.md`.
- `public/data/projects/calebzone/docs/` — snapshot tài liệu được **ship** cho
  Project SRS, không phải tài liệu của repo.
- `public/vendor/` — code upstream, không đụng vào.
- `.impeccable/` — **gitignored**, state của công cụ sinh `DESIGN.md`/`PRODUCT.md`.
