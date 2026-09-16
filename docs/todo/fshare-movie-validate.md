# Fshare movie catalog — sửa đợt Thuviencine 2026-09-16

Trạng thái: **MỞ** · bắt đầu 2026-09-16 · xoá file này khi `audit` báo
`validated: OK` và envelope đã commit.

Quy trình chuẩn nằm ở `docs/fshare-movie-playbook.md` (đọc "Ba cửa validated"
và "Vòng lặp"). File này chỉ ghi: hôm nay sai ở đâu, code đã chặn gì, và còn
đúng những bước nào để sửa dữ liệu.

## 1. Hôm nay đã sai gì

Crawler Thuviencine chạy đúng (6.029 trang phim, 5.981 trang download, 0 lỗi,
10.641 link Fshare unique). Sai ở **sau** crawler — bước kiểm tra:

| # | Sai | Hậu quả trong catalog | Commit |
|---|---|---|---|
| 1 | Dùng `fshare-movie-shard.mjs --kind all` để "validate" 10.641 link, tức **probe root** cả folder | 5.752 folder `live via probe`, `children: null`, 0 file con được tìm; 4.493/4.498 file không có `parents` | `5351b7a` |
| 2 | Shard ghi `dead` thẳng từ proxy 404, **không hỏi fshare.vn** lần hai | 3.509 dòng `dead` một ý kiến (3.380 file + 129 folder). Mẫu 30 file: 29 chết thật, 1 (`ZKJPO2ZG3P2W29W`) proxy 404 nhưng fshare.vn chuyển tiếp sang `9M4FK884KCQC6NH` | `5351b7a` |
| 3 | `seal` khi `pending 0` và coi đó là xong; envelope publish `validated: true` | Tab hiện VALIDATED cho một catalog mà 5.881 folder chưa liệt kê | `5351b7a` |
| 4 | Commit "crawl thuviencine fshare catalog" gộp cả `interviews.json` restamp không liên quan | Vi phạm "one change per commit"; và restamp đó là bug của `stamp-content-dates` (hai dòng HSC chung `source.url` nên đẩy `updated_at` của nhau mỗi ngày) | `5351b7a` |
| 5 | Ghi todo crawler ở `docs/thuviencine-crawler-todo.md` (ngoài `docs/todo/`) và ghi kế hoạch bằng số đếm tay | `docs/README.md` cấm todo ngoài `docs/todo/`; số đếm tay lệch (5.881 = 5.752 live + 129 dead, hai cửa khác nhau) | `7d4a9dc` |

Hai lệnh `merge` đã nhận 25 shard (run2 3 file, run3 22 file) — merge không có
gì để từ chối vì lúc đó không có luật.

## 2. Code đã sửa (session 2026-09-16 tối)

- `tools/fshare-movie.mjs`
  - `summarize` đếm ba cửa: `pending`, `uncrawled` (`isUncrawled`),
    `unverified` (`isUnverifiedDead`); `validated` chỉ true khi cả ba = 0.
    Projection mang thêm `counts.uncrawled/unverified`.
  - `validate --only` nhận thêm `uncrawled`, `unverified`.
  - `checkFolder`: chỉ folder trả lời listing mới được `children.crawledAt`;
    folder proxy 404 hỏi thêm `probeFolderOnWeb` (mới) — web nói sống thì
    thành `unknown` (chưa liệt kê được), không bao giờ `live` rỗng.
  - `checkFile`: ý kiến thứ hai luôn được ghi vào `row.web`, kể cả khi là
    `unknown` (khi đó dòng vẫn `unverified`, lần sau hỏi lại).
  - `mergeShardResults` từ chối dòng folder và dòng `dead` không có `web`.
  - Lệnh `audit` (+ `--json`): bảng theo nguồn — folder / uncrawled / file /
    no-parent / live / dead / unverified / unknown / by via.
  - `seal` và `status` in đủ ba cửa.
- `tools/fshare-movie-shard.mjs`: chỉ nhận `--kind file`; dòng `dead` gọi
  `probeFileOnWeb` trước khi ghi; web nói sống → `live via web`.
- `public/fshare-tool/views/movie.js`: badge và meta nói rõ thiếu gì
  (`folders unlisted`, `dead unconfirmed`).
- `tests/fshare-movie.test.mjs`: pin ba cửa, hai luật từ chối của `merge`,
  `--kind all/folder` bị chặn, `probeFolderOnWeb`, shard dead mang `web`.
- `tools/stamp-content-dates.mjs`: khoá interview = `name|role` thay vì
  `source.url` (sửa lỗi #4); `interviews.json` restamp về `2026-09-03`.
- Envelope đã **seal lại với `validated: false`** để site thôi nói dối trong
  lúc chờ chạy lại — tab hiện NOT VALIDATED · 5.752 folders unlisted · 3.573
  dead unconfirmed.
- Playbook có mục "Ba cửa validated", "Thu thập từ site", bước `audit`; todo
  crawler cũ đã gỡ, nội dung còn dùng được nằm trong playbook.

## 3. Số hiện tại (từ `node tools/fshare-movie.mjs audit`, 2026-09-16 22:40)

```text
93032 links (24320 folders, 68712 files) · pending 0 · live 88690 · dead 4342 · unknown 0
· uncrawled folders 5752 · unverified dead 3573 · validated: NO

thuviencine-2026-09-16   10641 rows · 6143 folders (5752 uncrawled) · 4498 files (4493 no parent)
                         7130 live · 3511 dead (3509 unverified) · via: probe 10372, crawl 262, listing 5, web 2
ba nguồn Sheet cũ        98 + 738 + 431 dead, trong đó 9 + 58 + 31 unverified (dead folder via crawl, chưa có web)
```

`unverified` 3.573 = 3.509 Thuviencine + 64 của các nguồn cũ (folder dead qua
crawl từ trước khi có `probeFolderOnWeb`, và 22 file dead qua shard cũ).

## 4. Còn phải làm — theo đúng thứ tự

Chạy trên NAS, trong `screen`/`tmux`; mọi lệnh đều resumable (Ctrl+C rồi
chạy lại). **Không** chạy `build`, `merge` hay một `validate` thứ hai song
song — một tiến trình ghi catalog.

```bash
# 0. Snapshot trước khi đụng (chỉ để so sánh; catalog.json là bản duy nhất)
sha256sum secret/fshare-movie/catalog.json > secret/fshare-movie/catalog.before-recrawl.sha256
node tools/fshare-movie.mjs audit --json > secret/fshare-movie/audit-before.json

# 1. Smoke: 5 folder, có ghi. Kiểm tra một folder vừa crawl có children.crawledAt và file con có parents.
node tools/fshare-movie.mjs validate --only uncrawled --limit 5 --concurrency 2
node tools/fshare-movie.mjs status

# 2. Đóng cửa uncrawled: 5.752 folder root Thuviencine, đệ quy. Ước ~2–3 giờ ở concurrency 4.
node tools/fshare-movie.mjs validate --only uncrawled --concurrency 4

# 3. Đóng cửa unverified: 3.573 dòng dead hỏi fshare.vn lần hai. Ước ~1,5 giờ.
node tools/fshare-movie.mjs validate --only unverified --concurrency 4

# 4. Những gì hai bước trên để lại là unknown (timeout, 5xx, folder web-sống-proxy-404): hỏi lại một lượt.
node tools/fshare-movie.mjs validate --only unknown --concurrency 4

# 5. Audit. Chỉ đi tiếp khi dòng cuối là "validated: OK".
node tools/fshare-movie.mjs audit
node tools/fshare-movie.mjs audit --json > secret/fshare-movie/audit-after.json

# 6. Seal, check, commit envelope, push, xác nhận deploy.
node tools/fshare-movie.mjs seal
node tools/fshare-movie.mjs --check
git add public/data/fshare-movie/catalog.enc.json && git commit -m "reseal movie catalog after thuviencine recrawl"
node tools/build-content-index.mjs --check && node tools/stamp-content-dates.mjs --check && node tools/check.mjs 2>&1 | tail -3
git push && curl -s https://gazll.github.io/version.json
```

Đọc kết quả bước 5 như sau:

- `uncrawled` phải = 0. Folder nào web nói sống mà proxy 404 sẽ nằm ở
  `unknown` — chấp nhận được, nhưng ghi số đó vào commit message.
- `filesWithoutParent` của nguồn Thuviencine **không** cần về 0: 4.498 file là
  link file đứng một mình trên trang download, không phải con của folder nào
  trong nguồn. Số này chỉ giảm nếu folder crawl tình cờ chứa chúng.
- `unknown` được phép còn; `unverified` thì không.
- So `audit-after.json` với `audit-before.json`: `live` của Thuviencine không
  được giảm ngoài phần chuyển sang `dead` có `web.status = dead`.

## 5. Sau khi xong

- Xoá `secret/fshare-movie/shards/thuviencine-2026-09-16-*.json` (25 file,
  ~17MB; đã merge, và code mới không gộp lại được chúng nữa).
- Xoá `secret/fshare-movie/thuviencine-collection-report.tsv` và
  `-summary.json` — báo cáo ad-hoc của lần chạy sai, `audit --json` thay thế.
- Giữ `thuviencine-crawl-state.json` + `-report.json`: đó là checkpoint của
  crawler, chạy lại tháng sau sẽ chỉ fetch trang mới.
- Ghi vào `docs/fshare-movie-playbook.md` con số thực đo được (giờ chạy, tỷ
  lệ unknown) thay cho ước lượng ở mục "Vòng lặp".
- Xoá file này.

## 6. Mở, chưa làm (không chặn đóng todo)

- **`movedTo`**: file proxy 404 mà fshare.vn chuyển tiếp sang code khác
  hiện là `unknown` mãi. Mô hình cần một trường ghi code mới và tab cần hiện
  "đã chuyển → CODE". Tìm bằng
  `jq '.links[] | select(.web.error | test("did not show the file page"))'`.
- **Runner đệ quy song song**: `validate` là một tiến trình. 5.752 folder ở
  2–3 giờ chưa cần; nếu một site sau đem về 50k folder thì cần shard cho
  folder — output là các dòng mới (`origin: crawl`) nên `merge` phải học cách
  upsert, không chỉ update. Chưa viết; đừng dùng `fshare-movie-shard.mjs`
  thay thế.
