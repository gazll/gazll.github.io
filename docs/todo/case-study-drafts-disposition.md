# `docs/case-study-drafts/` — rà soát trước khi xoá

Rà soát 2026-09-03. Thư mục **đã được gitignore** (`.gitignore:26`), nên nó
chưa từng vào git — xoá là mất vĩnh viễn, không `git revert` được.

## Kết luận ngắn

**Kiến thức đã migrate đủ, và không còn secret.** Bài đã publish:
`public/data/case-studies/articles/12-duplicate-booking-race-condition{,.vi}.html`.

Ba thứ đã kiểm và đều sạch:

- `bash download/check-leaks.sh` → **`Quét 31 file. OK — sạch.`** Script này quét
  cả bản nháp lẫn bài đã publish bằng danh sách tên thật (tên công ty, tên
  người, mã ticket, IP, tên GDS). Bản thân script chứa pattern tên thật nên nó
  nằm trong `download/` và không bao giờ vào repo public.
- Bản nháp **đã tự ẩn danh xong** — mục 9 "Phụ lục — những gì đã được ẩn danh"
  liệt kê từng thứ đã thay và từng thứ cố ý giữ (GDS, PNR, ITN, `HEAD`,
  optimistic locking… là từ vựng ngành, không định danh tổ chức).
- Quét độc lập bằng regex (Redmine/GitLab/Slack URL, email, IP, token, key)
  không ra kết quả nào ngoài chính dòng phụ lục mô tả việc đã lược bỏ.

## Một mâu thuẫn đã được giải quyết

`TODO.md` của thư mục này chốt ngày 2026-08-18: *"Nơi xuất bản — đã chốt:
giữ standalone, **chưa wire vào site**"*, kèm mục 8 khảo sát các ràng buộc chặn
bài first-party (khi đó `source_url` bị khoá cứng vào `engineering.tiki.vn`).

**Thông tin đó đã lỗi thời.** Cũng trong 2026-08-18 bài đã được publish
(`Add case studies on duplicate booking race condition…`), và contract
`first_party` đã được xây đúng như CLAUDE.md mô tả hiện nay. Không còn ràng
buộc nào đang chặn. `TODO.md` này không cần giữ.

Mục duy nhất còn mở trong đó cũng đã tự trả lời: *"số liệu giám sát production
của phase 2"* — **đã kiểm, không có trong 5 workbook**, phải lấy từ ticket.
Không lấy được từ file đang có, nên giữ thư mục cũng không giải quyết được.

## Thứ duy nhất đáng cân nhắc trước khi xoá

Bản nháp **phong phú hơn hẳn** bài publish, và đó là **quyết định biên tập có
chủ đích**, không phải migrate thiếu:

| | bản nháp | đã publish |
|---|---|---|
| heading | 35 | 10 |
| code block | 34 | 4 |
| dòng | 1.038 (VI) · 1.076 (EN) | ~12KB HTML mỗi bản |

Bài publish giữ đúng phần cốt lõi (invariant, atomic write, verify, rollback) và
cô đọng 10 bài học của bản nháp xuống 6 dòng "Review checklist". Chuẩn xác về
kỹ thuật, không mất gì về mặt đúng/sai.

Nhưng **4 bài học sau chỉ có trong bản nháp** và không xuất hiện ở bài publish.
Chúng là loại nhận định dùng được khi trả lời phỏng vấn:

1. **Làm một correctness bug hiếm đi không phải là sửa nó.**
2. **Chặn theo danh tính thì phải liệt kê vô hạn; chặn theo bản chất thì chỉ cần
   một lần.** (đây là bài học từ chỗ "Googlebot hoá ra không phải Googlebot")
3. **Cái tên bạn đặt cho nguyên nhân sẽ chọn hộ bạn giải pháp.**
4. **Khi không thể nâng độ tin cậy, hãy hạ chi phí sai.**

Cùng với đó, các chi tiết quy trình chỉ có trong nháp: ticket đi 17 tháng mới có
dev, 39 case IT của QA, 17 case UT chia theo tầng, vì sao không UAT được và thứ
được dùng thay thế.

## Đề xuất

Chọn một trong hai, **trước khi xoá**:

- **A — migrate 4 bài học rồi xoá.** Thêm chúng vào mục "Review checklist" của
  bài publish (cả `.html` và `.vi.html`, giữ cặp song ngữ cùng số mục). Đây là
  phần giá trị nhất còn sót lại; xong thì xoá cả thư mục không tiếc gì.
- **B — xoá luôn.** Chấp nhận mất 4 nhận định trên. Phần đúng/sai kỹ thuật của
  bài đã đầy đủ, nên đây là lựa chọn hợp lệ nếu muốn gọn.

Không khuyến nghị giữ nguyên trạng: thư mục nặng **9,5MB** (5 workbook xlsx dữ
liệu nội bộ), đã gitignore nên không ai khác thấy, và `TODO.md` bên trong đang
mô tả một trạng thái không còn đúng.
