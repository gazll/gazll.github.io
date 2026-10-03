# Migrate tài liệu tech + job từ OneDrive Workspace

Trạng thái: **CHƯA BẮT ĐẦU** · tạo 2026-10-02 · xoá file này khi mọi mục bên
dưới đã vào gazll (hoặc đã quyết định để lại NAS) và `2_tech/` chỉ còn file
nhị phân không đưa lên.

Nguồn: `\\nas\99_Drives\OneDrive-minhtran0918\Workspace\2_tech\`
(= `/volume2/99_Drives/OneDrive-minhtran0918/Workspace/2_tech/`, 4.6G). Gom ngày
2026-10-02 khi dọn Workspace; `1_Project/` (code calebzone, icerthub,
Skeleton) để nguyên ở ngoài, không thuộc đợt này.

Nguyên tắc: chỉ ghi chú/text (.md) và nội dung tự viết vào repo. PDF, ebook,
zip/rar dự án cũ giữ trên NAS — repo chỉ ghi chỗ để.

## 1. Job

- [ ] `Job/interview/check-key-10-trieu-bloom-filter.md` — đề phỏng vấn đã
      chép sang text (từ `Screenshot (2).png`); viết lời giải (dàn ý: `docs/todo/interview-bloom-filter.md`; bit array +
      hash + sort / Bloom filter) rồi đưa vào gazll.
- [ ] `Job/JD - Test/`, `Java_API_Test.pdf`, `JD_ Java Developer … CMC Global.pdf`
      — đề test/JD cũ: tóm tắt đề thành text, file gốc để NAS.
- [ ] `Job/PXL_20230524_*.jpg`, `IMG_0958.JPG` — ảnh chụp đề? xem rồi chép
      text hoặc bỏ.
- [ ] `Top 27 Common Job Interview Questions….pdf` — tài liệu ngoài, để NAS.

## 2. Tech

- [ ] `Document/` — API (Alepay), DB design, UnitTest_RK, BRD Square Root,
      báo cáo security, ảnh kiến trúc (API types, gRPC flow, System Design).
      Lọc cái nào là ghi chú tự viết → text.
- [ ] `Ví dụ cải tiến kiến trúc (Layered + DIP, Hexagonal, Clean)….pdf` —
      tóm tắt thành ghi chú kiến trúc.
- [ ] `Ebook/` (2.3G) — chỉ cần danh sách sách (reading list), file để NAS.
- [ ] `Stored/` — zip dự án cũ (RK, Morphotech, Momo, OTA, craftymetaverse,
      fin-automation-test), `Data/` (danh mục hành chính, ward.sql),
      `University/`. Quyết định giữ/bỏ từng cái.

## 3. Không còn

`0_everything-doc/` (ghi chú Java, `#Note`, DDD, design pattern…) đã vào
`#recycle` NAS ngày 2026-10-02:
`/volume2/99_Drives/#recycle/OneDrive-minhtran0918/Workspace/0_everything-doc/`.
Nếu cần ghi chú nào trong đó thì lấy ra **trước khi thùng rác bị dọn**.
Lưu ý: `.git` của nó còn lịch sử chứa mật khẩu — không push, không copy `.git`.
