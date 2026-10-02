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
- [~] Lịch chạy lại: từ 2026-09-27 có vòng lặp hằng tuần trên NAS
      (`personal-vault/nas-operations/tasks/common/fshare-validate/loop.sh`
      → `telegram-weekly.sh`: crawl → build → validate tới khi hội tụ →
      categorize → move-to-x → audit; chạy với `TASK_DIR` =
      `tasks/20260926_fshare-validate/`, log ở `logs/telegram-YYYY-MM-DD.log`).
      Không seal/commit — `audit` đọc bằng mắt trước. DSM không cho user
      thường `crontab`, nên vòng lặp là `nohup`: **mất khi NAS reboot** — và
      đã mất: NAS reboot 2026-10-01 ~21h, `loop.pid` còn nhưng process chết,
      lần chạy hẹn 2026-10-03 sẽ không xảy ra. Cần một mục DSM Task Scheduler
      (boot-up, user `nas`, `cd …/tasks/20260926_fshare-validate && sh
      ../common/fshare-validate/loop.sh`) mới coi là xong.
      - 2026-09-26 (vòng lặp, lần 1): 2.786 link mới, `validated: OK`,
        2.768 dòng 18+ chuyển sang X.
      - 2026-09-23 (tay): 3 chat, 572 tin mới → 583 dòng raw → 541 dòng mới
        sau `build`; validate hội tụ sau 5 vòng, `validated: OK`, 373.791 link
        (`687f67a`). Cursor: fshare_group #84576 · t571 #42204 · t7407 #42203.
- [x] Dò topic còn lại của HDvietnam và 19 chat khác (2026-09-27, mẫu 400 tin
      mỗi chat/topic, 64 nơi): chỉ **Chia Sẻ Nhạc** (`-1002633694014/544`) có
      link (68/400) → đã thêm vào `chats`, crawl trọn 3.066 tin, 1.268 dòng.
      Mọi chat còn lại 0 link; "Chia sẻ phụ đề" 2 folder — không thêm.
- [x] Validate toàn bộ catalog 2026-09-26/27 (`e153192`): 376.645 link,
      314.805 live · 61.840 dead (Fshare thu hồi uploader 31/08), 8.393 dòng
      18+ sang X, `validated: OK`.
