# TODO — validate lần đầu catalog phim Fshare

Trạng thái lúc mở việc (2026-09-12): `secret/fshare-movie/catalog.json` có
**11.651 link (10.860 folder, 791 file), toàn bộ `pending`**, `validated: NO`.
Envelope `public/data/fshare-movie/catalog.enc.json` đã commit nhưng **rỗng**
(0 link, `validated: false`) — tab Movie mở được bằng passphrase và báo
"no checked links yet" cho tới khi bước 4 xong. Quy trình đầy đủ ở
`docs/fshare-movie-playbook.md`; file này là việc phải làm một lần, kèm mọi
điều đã biết khi chạy thử.

Xoá file này khi `status` báo `validated: OK` và envelope đã commit.

## 0. Tool dò cái gì, theo thứ tự nào

`validate` **không chạy theo file CSV**. Nó đọc một file duy nhất là
`secret/fshare-movie/catalog.json`, nơi `build` đã gộp cả 3 tab Sheet: link
trùng giữa các tab là **một dòng**, `sourceIds` ghi nó xuất hiện ở tab nào.
Mỗi dòng là một link; tool đi qua từng dòng theo thứ tự:

1. folder trước, file sau (folder crawl ra file bên trong → file đó sống theo
   listing, khỏi probe riêng);
2. trong cùng loại: `pending` → `unknown` → `dead` → `live`;
3. trong cùng status: theo `titleKey` (tên đã bỏ dấu), nên dòng đầu tiên là
   `0.0 MHz 2019`, rồi các bộ `007 James Bond`, …

Muốn chỉ dò link của **một tab** thì chưa có cờ (`--only` lọc theo status,
không theo source). Cần thì thêm `--source <tên tab>` — việc nhỏ.

Kết quả của mỗi dòng ghi thẳng vào chính dòng đó trong `catalog.json`
(`status`, `checkedAt`, `via`, `children` cho folder). Không có file output
riêng; `status` là cách xem tổng.

## 1. Chuẩn bị passphrase

Cùng passphrase với lịch riêng. Thứ tự tool tìm:

```bash
export GAZLL_SCHEDULE_KEY='…'          # 1. biến môi trường, phiên hiện tại
echo '…' > secret/app.key              # 2. file, gitignored — đã có trên laptop
# 3. không có cả hai → tool hỏi khi chạy seal (không echo)
```

`node tools/schedule-seal.mjs --check` mở được envelope lịch là passphrase
đúng — hai tool dùng chung một resolver (`tools/passphrase.mjs`).

## 2. Chạy thử nhỏ để nhìn hành vi

```bash
node tools/fshare-movie.mjs status
node tools/fshare-movie.mjs validate --limit 6 --concurrency 1 --dry-run
```

Đã chạy thử trên laptop ngày 12/09: 6 folder đầu → 6 `live`, phát hiện thêm
32 folder con + 76 file, 0 `unknown`, hết ~15 giây. Dry-run gọi API thật
nhưng **không ghi gì** — catalog vẫn 11.651 pending sau đó.

Dấu hiệu bất thường cần dừng: hàng loạt `unknown` (proxy
`fshare.annnekkk.com` bị chặn hoặc quá tải — mở URL đó trong tab để biết),
hoặc folder nào cũng `dead` (proxy đổi format trả lời).

## 3. Chạy thật

```bash
node tools/fshare-movie.mjs validate --concurrency 6      # khuyến nghị
node tools/fshare-movie.mjs validate --concurrency 1      # tuần tự, chậm hơn 4–6 lần
```

- **Ctrl+C là an toàn.** Checkpoint mỗi 25 dòng; chạy lại lệnh y hệt là tiếp
  tục từ `pending`. Một lần chạy nhiều giờ chết ở 90% không mất gì.
- **Xem tiến độ ở terminal khác**: `node tools/fshare-movie.mjs status` chỉ
  đọc, không đụng file đang được ghi.
- **Đừng kết luận tốc độ từ 25 dòng đầu.** Folder gốc của Sheet chứa gần như
  cả cây; dòng đó có thể mất hàng chục phút, sau đó phần lớn folder con được
  bỏ qua vì đã nằm trong cache của lần chạy.
- **Chỉ một tiến trình trên một `catalog.json`.** Hai tiến trình song song
  ghi đè checkpoint của nhau. Muốn chia thì chạy tuần tự các lát bằng
  `--limit`, hoặc `--only pending` trước rồi `--only unknown` sau khi cái đầu
  xong.
- `--concurrency` cao hơn 6 thì `unknown` tăng vì proxy reset kết nối, và
  những dòng đó phải chạy lại — không nhanh hơn thật.
- Kết thúc: `status` in tổng. `unknown` còn lại → đợi vài giờ rồi
  `validate --only unknown --concurrency 2`.
- `dead` của file đã qua hai ý kiến (proxy 404 + `<title>` trang
  `fshare.vn`), nên một `dead` là chết thật; `--no-web` tắt bước hai nếu
  fshare.vn chặn IP.

## 4. Seal, commit, deploy

```bash
node tools/fshare-movie.mjs status         # phải thấy validated: OK
node tools/fshare-movie.mjs seal
node tools/fshare-movie.mjs --check
git add public/data/fshare-movie/catalog.enc.json
git commit -m "seal movie catalog"
```

Rồi ba lệnh CI như thường lệ trước khi push:

```bash
node tools/build-content-index.mjs --check
node tools/stamp-content-dates.mjs --check
node tools/check.mjs 2>&1 | tail -3
```

Hai thứ đã làm CI đỏ trong ngày 12/09, cả hai **không liên quan code**:
`stamp-content-dates --check` lệch (chạy không `--check` để restamp rồi
commit), và bước `Audit production dependencies` (`npm audit --omit=dev
--audit-level=high`) — advisory mới trên dependency transitive; `npm audit
fix` rồi commit `package-lock.json`. Sau push, xác nhận deploy bằng
`https://gazll.github.io/version.json` mang đúng commit; nếu không, xem run
ở `https://api.github.com/repos/gazll/gazll.github.io/actions/runs?per_page=1`.

Mở `/fshare-tool` → tab Movie → nhập passphrase — meta line phải hiện
`VALIDATED`. Passphrase nhớ trong session (tick "Remember" thì localStorage),
cùng key với `/calendar`, nên mở một bên là mở cả hai; nút **Lock** xoá cả
hai.

## 5. Làm trên NAS thay vì laptop

Job dài giờ nên chạy trên NAS hợp lý hơn (tắt laptop không ảnh hưởng). Trên
NAS đã có clone tại `/volume2/99_Drives/Project/gazll.github.io`. Những gì
**không nằm trong git** phải copy tay (ssh tới `nas@nas` hỏi password nên
chạy từ máy có password):

```bash
scp -r secret public/config.js nas@nas:/volume2/99_Drives/Project/gazll.github.io/
ssh nas@nas 'cd /volume2/99_Drives/Project/gazll.github.io \
  && git pull && mv config.js public/config.js \
  && npm ci --legacy-peer-deps --no-audit --no-fund \
  && node -v && node tools/fshare-movie.mjs status'
```

| File | Vì sao cần |
|---|---|
| `secret/app.key` | passphrase — thiếu là không `seal` được |
| `secret/fshare-movie/catalog.json` (7.5MB) | state đang validate — **bản duy nhất**, bên nào chạy tiếp thì bên đó giữ |
| `secret/fshare-movie/raw/` (3 CSV) | để `build` lại khi Sheet có tab mới |
| `secret/fshare-movie/sources.json` | URL Sheet gốc |
| `public/config.js` | `GOOGLE_CLIENT_ID` + `SCRIPT_URL` cho dev local |

- `secret/schedule.json` **không** cần copy: `node tools/schedule-seal.mjs
  unseal` lấy lại từ envelope trong git.
- Node trên NAS phải ≥ 18 (`CompressionStream`, `structuredClone`); laptop
  đang dùng 24.
- **Sau khi validate xong ở NAS, copy `catalog.json` ngược về laptop** (hoặc
  chỉ làm việc trên NAS) — không được để hai bản lệch nhau rồi `seal` từ bản
  cũ.

## 6. Đặt lịch chạy lại

Mỗi tuần hoặc tháng (tự nhắc, hoặc thêm một event `rolling` vào lịch riêng):

```bash
node tools/fshare-movie.mjs validate --stale 30d --concurrency 6
node tools/fshare-movie.mjs seal && git commit -am "reseal movie catalog" && git push
```

`--stale 30d` chọn thêm những dòng `checkedAt` cũ hơn 30 ngày; mặc định chỉ
chọn `pending,unknown`. Folder crawl lại sẽ tự phát hiện file mới bên trong
(thành dòng mới, `origin: crawl`) và file biến mất khỏi listing (được probe
riêng → `dead` với `deadSince`).

## Việc còn mở sau khi validate xong

- [ ] Quyết định có hỏi lại link `dead` định kỳ không (`--only dead --stale 90d`).
- [ ] Thêm cờ `--source <tab>` nếu thật sự cần dò theo từng tab Sheet.
- [ ] Nếu Sheet cộng đồng có tab mới: `ingest` với `--gid`, rồi `build` (chỉ
      link mới thành `pending`), rồi `validate` như thường.
