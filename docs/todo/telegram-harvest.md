# Fshare movie catalog — đợt Telegram 2026-09-18

Trạng thái: **MỞ** · bắt đầu 2026-09-18 · xoá file này khi `audit` báo
`validated: OK`, envelope đã commit, và crawler Telegram đã có lịch chạy lại.

Quy trình chuẩn ở `docs/fshare-movie-playbook.md` ("Thu thập từ Telegram",
"Ba cửa validated", "Vòng lặp"). File này chỉ ghi: nguồn nào đã lấy, đang
đứng ở đâu, còn bước nào. Số đếm từ `audit --json` và `secret/telegram/report.json`,
không đếm tay.

## 1. Nguồn đã thu (`secret/telegram/config.json`)

Tài khoản đã `login` trên NAS (session ở `secret/telegram/session`; máy khác
phải `login` lại). Tool đọc trọn lịch sử cả ba, không dừng, không FloodWait.

| Nguồn | Tham chiếu | Đọc đến tin | Tin còn | Dòng raw | Rows | Pending | Ghi chú |
|---|---|---|---|---|---|---|---|
| FSHARE GROUP | `@fshare_group` | #84240 | 5.632 | 7.962 | 7.960 | 7.405 | bot search, gần như toàn **file lẻ** (7.957) — mỗi link một probe. Id tới 84k mà còn 5.6k tin: bot tự xoá kết quả cũ → phải chạy lại **hằng tuần** |
| HDvietnam Official › Chia sẻ phim | `-1002633694014/571` | #41663 | 10.319 | 5.362 | 3.450 | 2.157 | **3.141 folder** — phần tốn nhất và giá trị nhất của đợt này (phim bộ, bộ sưu tập) |
| HDvietnam Official › Yêu Cầu Phim/Nhạc | `-1002633694014/7407` | #41665 | 6.814 | 743 | 616 | 581 | nhỏ, nhiều link là trả lời câu hỏi (tên mượn từ câu hỏi) |

Raw: `secret/fshare-movie/raw/telegram-{fshare_group,c2633694014-t571,c2633694014-t7407}-2026-09-18.txt`.
`build` 2026-09-18: 14.067 dòng → **10.098 link mới** (`pending`), catalog
123.642 link. Phần còn lại catalog đã biết từ Sheet/thuviencine — ba nguồn
overlap với Sheet, dấu hiệu chúng cùng một cộng đồng.

## 2. Giới hạn của "đã lấy hết"

- Tin **đã xoá** thì không còn — bot FSHARE GROUP dọn kết quả cũ.
- Chỉ link trong text / text_link / nút inline / link preview. Link trong
  **file đính kèm** (`.txt`, ảnh) không đọc — tool không tải attachment.
- HDvietnam là forum, mới đọc **2 topic**. Chưa dò các topic khác.
- 19 chat còn lại trong tài khoản chưa quét (theo tên không phải nguồn phim).

## 3. Còn phải làm

- [x] `node tools/fshare-movie.mjs validate` — chạy trên NAS 2026-09-18
      15:02–18:10 (~3h08, wrapper "Chạy dài trên NAS", nohup + set -e + step
      log), 5 vòng `uncrawled,unverified` tới khi hội tụ. RAM node process ổn
      định ~350–480MB/3,5GB, CPU chờ mạng là chính (57s CPU thực trên 13m42s
      cho 100 folder đầu) — không nặng máy, chỉ chậm vì độ trễ Fshare.
- [x] `audit` → ba cửa về 0 (`pending 0 · uncrawled 0 · unverified 0`) →
      `validated: OK`. Catalog 123.642 → **326.648 link** (293.013 dòng là
      `(crawl-discovered)` — cây con phát hiện khi duyệt đệ quy folder, không
      phải link trực tiếp từ nguồn nào).
- [x] Trần ciphertext `lib/schedule-crypto.js` 8MB → **16MB** (326k link ~10,9MB
      gzip đã vượt 8MB); `MAX_ENVELOPE_JSON_CHARS` 12MB → 24MB theo tỉ lệ
      base64. `seal` → `public/data/fshare-movie/catalog.enc.json` (15,18MB).
- [x] Commit: `45ca813` (nới trần) · `3aabf8d` (seal envelope), cộng 4 commit
      trước đó (`5844602` tên theo đoạn · `2c6f6d9` topic · `8ca8f4b` playbook ·
      `5449887` todo này) — 6 commit, `check.mjs` + hai `--check` xanh trước
      mỗi lần commit. Push: xem log của phiên chạy việc này.
- [ ] Lịch chạy lại: `npm run crawl:telegram` hằng tuần (incremental theo
      `state.lastId`), rồi `build` → `validate --only pending`. Cân nhắc ghép
      vào "Chạy lại định kỳ" của playbook. **Còn mở — chưa có cron/lịch thật,
      chỉ là thao tác tay.** File này chưa xoá vì lý do đó.
- [ ] Dò topic còn lại của HDvietnam (`-1002633694014`) — đếm link mỗi topic
      rồi mới thêm vào `chats`; tool chưa có lệnh liệt kê topic.
