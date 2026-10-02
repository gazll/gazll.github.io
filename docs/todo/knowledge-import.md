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

## Kết quả rà 2026-10-02

Phần lớn ghi chú đã có trên site, thường sâu hơn bản gốc — không viết lại:
HashMap/ArrayList/LinkedList/Set, OOP + overload/override + interface vs
abstract (`01…language-fundamentals.q9`), Java 8→11 (`02`), `@Async`/`@Scheduled`
qua N replica (`03…q6`, `25…08-operational-concerns.q4`), REST (`17`, `04`),
OpenAPI, DDD chiến lược/chiến thuật (`24`, `12`), read-after-write trên replica
(`06…q2`), gateway auth/permission trong token/revocation (`27`, `13`), CI/CD (`14`),
DP/backtracking/DFS (`19`). Ghi chú cũ có hai chỗ sai đã sửa trong bản mới:
DCL thiếu `volatile`, và "hash 3 lần là tối ưu" (k tối ưu = (m/n)·ln 2).

Đã thêm 10 mục + 1 đoạn deep (EN/VI, `content-reviews.json`, release note):

| Nguồn | Mục mới |
|---|---|
| `pv-java.md` | `01…language-fundamentals.q10` pass-by-value · `01…collections-data-structures.q8` Comparator/sort · `19…the-patterns-that-keep-coming-up.q9` 10M key / 10 MB · `18…rewriting-the-query-reshaping-the-model.q7` INNER/LEFT JOIN · StringBuffer vào `01…q2` |
| `code rule for DDD.md` | `22…patterns-in-interview-code.q8` coding convention · `03…auto-configuration-build.q18` `@Scheduled` vs Quartz |
| `Design Pattern.md` | `22…patterns-in-interview-code.q7` singleton/DCL · `12…patterns-principles.q7` bản đồ 23 mẫu GoF |
| `Replication_database.jpg` | `03…auto-configuration-build.q17` route read-only sang replica (cơ chế chung, không chép code của dự án cũ) |
| Home test PDF | `22…the-lld-framework-classic-problems.q5` — đề tự viết lại, không nêu tên công ty |

## Còn lại

- [ ] Phần theo công ty trong `pv-java.md` (Finbase, MoMo, ZaloPay, Luxoft — JD và câu PV của MoMo) → Gazl Try **qua Sheet**, do operator tự nhập vì là dữ liệu cá nhân.
- [ ] Dời `secret/knowledge-import/` vào `#recycle` sau khi nhập xong mục trên, rồi xoá file này.
