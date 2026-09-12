# TODO — validate lần đầu catalog phim Fshare

Trạng thái lúc mở việc (2026-09-12): `secret/fshare-movie/catalog.json` có
**11.651 link (10.860 folder, 791 file), toàn bộ `pending`**, `validated: NO`.
Chưa có envelope nào được seal — tab Movie báo "No sealed catalog is published
yet" cho tới khi bước 4 xong. Quy trình đầy đủ ở
`docs/fshare-movie-playbook.md`; file này chỉ là việc phải làm một lần.

Xoá file này khi `status` báo `validated: OK` và envelope đã commit.

## 1. Chuẩn bị passphrase

Cùng passphrase với lịch riêng. Một trong ba:

```bash
export GAZLL_SCHEDULE_KEY='…'          # phiên hiện tại
echo '…' > secret/app.key         # máy này, gitignored
# hoặc để tool hỏi khi chạy seal (không echo)
```

## 2. Chạy thử nhỏ để nhìn hành vi

```bash
node tools/fshare-movie.mjs status
node tools/fshare-movie.mjs validate --limit 20 --concurrency 2 --dry-run
```

Dry-run gọi API thật nhưng không ghi. Kiểm tra: folder → `live` kèm số file,
file lẻ → `live`/`dead`, và không có hàng loạt `unknown` (dấu hiệu proxy
`fshare.annnekkk.com` đang bị chặn hoặc quá tải).

## 3. Chạy thật, song song, để chạy nền

```bash
node tools/fshare-movie.mjs validate --concurrency 6
```

- Có checkpoint mỗi 25 dòng; **Ctrl+C là an toàn**, chạy lại lệnh y hệt sẽ
  tiếp tục từ `pending`.
- Folder gốc của Sheet chứa gần như cả cây: dòng đầu tiên có thể
  mất hàng chục phút, sau đó phần lớn folder con được bỏ qua vì đã nằm trong
  cache của lần chạy. Đừng kết luận tốc độ từ 25 dòng đầu.
- Muốn chia máy/chia phiên để nhanh hơn: chạy nhiều tiến trình trên **cùng
  một** `catalog.json` là *không* an toàn (mỗi tiến trình ghi đè checkpoint
  của nhau). Cách đúng là chạy tuần tự các lát bằng `--limit`, hoặc tách
  `--only pending` (một tiến trình) và `--only unknown` (tiến trình khác chạy
  sau khi cái đầu xong).
- Khi kết thúc, `status` in tổng. `unknown` còn lại → chạy lại
  `validate --only unknown --concurrency 2` sau vài giờ.

## 4. Seal, commit, deploy

```bash
node tools/fshare-movie.mjs status         # phải thấy validated: OK
node tools/fshare-movie.mjs seal
node tools/fshare-movie.mjs --check
git add public/data/fshare-movie/catalog.enc.json
git commit -m "seal movie catalog"
```

Rồi ba lệnh CI như thường lệ (`build-content-index --check`,
`stamp-content-dates --check`, `check.mjs`) và push. Mở `/fshare-tool`, tab
Movie, nhập passphrase — meta line phải hiện `VALIDATED`.

## 5. Đặt lịch chạy lại

Mỗi tuần hoặc tháng (tự nhắc, hoặc thêm một event `rolling` vào lịch riêng):

```bash
node tools/fshare-movie.mjs validate --stale 30d --concurrency 6
node tools/fshare-movie.mjs seal && git commit -am "reseal movie catalog" && git push
```

## Việc còn mở sau khi validate xong

- [ ] Quyết định có hỏi lại link `dead` định kỳ không (`--only dead --stale 90d`).
- [ ] Nếu Sheet cộng đồng có tab mới: `ingest` với `--gid`, rồi `build` (chỉ
      link mới thành `pending`), rồi `validate` như thường.
