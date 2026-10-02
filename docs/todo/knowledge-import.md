# Đưa ghi chú cũ (Java, kiến trúc) vào nội dung site

Trạng thái: **MỞ** · bắt đầu 2026-10-02 · xoá file này khi mọi mục dưới đã được
chuyển hoặc quyết định bỏ, và `secret/knowledge-import/` đã được dọn.

Nguồn nằm ở `secret/knowledge-import/` (gitignored, **chỉ có trên NAS** — chép từ
`personal-vault/notes` ngày 2026-10-02; bản cũ còn trong lịch sử git của
personal-vault). Đây là ghi chú tiếng Việt viết 2020–2021: phải viết lại theo
chuẩn hiện hành và theo `docs/content-playbook.md` (EN/VI cặp, nguồn gốc,
`content-reviews.json` cho claim theo phiên bản), không chép nguyên văn.
Ảnh không lấy từ nguồn ngoài; sơ đồ thì vẽ lại bằng Mermaid/SVG.

## Nguồn → đích đề xuất

| Nguồn | Nội dung | Đích |
|---|---|---|
| `java/pv-java.md` | câu hỏi phỏng vấn Java thường gặp, giải thuật, ghi chú theo từng công ty | câu hỏi kỹ thuật → topic 01 / 02 / 19; phần theo công ty → Gazl Try (`/gazl-try`), là dữ liệu cá nhân nên nhập qua Sheet chứ không vào `interviews.json` |
| `java/code rule for DDD.md` | quy tắc đặt tên, comment, xử lý null, hằng số; REST API best practices | coding rules → topic 22 (LLD/OOD); phần REST → topic 17 (đối chiếu, chỉ bổ sung cái còn thiếu) |
| `java/design-patterns/Design Pattern.md` + 6 ảnh | 23 mẫu GoF có xếp hạng mức dùng, sơ đồ, ví dụ | topic 12 (architecture patterns) / 22; xếp hạng ★ là ý kiến cá nhân, ghi rõ hoặc bỏ |
| `java/design-patterns/DesignPatternTutorial/` | project Java ví dụ cho 23 mẫu + AOP proxy (gốc: gpcoder) | không chép code của người khác; chỉ dùng làm ví dụ tham khảo khi viết đáp án |
| `java/images/*` | cheat sheet: so sánh các Map, functional interface, Java 8→11, cây Collection | dữ kiện → topic 01 / 02; vẽ lại, không dùng ảnh gốc |
| `architecture/System architecture.md` + `ResourceDocuments/` | microservice, DDD (domain, ubiquitous language, layer, entity/value/aggregate), development workflow | topic 24 (DDD) / 25 (microservice); đối chiếu cái đã có, chỉ thêm phần thiếu |
| `career/Home Test - Software Developer (Backend).pdf` | đề bài home test tuyển dụng backend | đề của công ty khác: không đăng nguyên văn; nếu dùng thì thành một prompt tự viết trong topic 11 / 22 |

## Việc

- [ ] Đọc từng nguồn, đánh dấu cái site **đã có** (cross-ref thay vì viết lại — "One owner per mechanism").
- [ ] Viết phần còn thiếu theo content-playbook, chạy đủ ba lệnh CI trước khi push.
- [ ] Dời `secret/knowledge-import/` vào `#recycle` khi xong.
