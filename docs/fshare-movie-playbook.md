# Fshare movie catalog — playbook

Tab **Movie** trong `/fshare-tool` là một database link phim lấy từ các
Google Sheet cộng đồng và các site chia sẻ, đã kiểm tra với Fshare và giữ
lịch sử từng link. Tài liệu này là toàn bộ quy trình vận hành: một tool, ba
file, một chiều. **Đọc hết mục "Vòng lặp" và "Ba cửa validated" trước khi
chạy bất kỳ lệnh nào ghi catalog** — ngày 2026-09-16 đã bỏ qua đúng hai bước
và publish một catalog "validated" mà 5.881 folder chưa từng được liệt kê.

```text
secret/fshare-movie/raw/            export thô (CSV từng tab Sheet, list link dán tay)  GITIGNORED
secret/fshare-movie/sources.json    URL gốc của từng raw file                              GITIGNORED
secret/fshare-movie/catalog.json    DATABASE CHÍNH — header: version, sources, validation, shards   GITIGNORED
secret/fshare-movie/catalog/links-00.json … links-15.json   các dòng, mỗi dòng một link, shard theo hash(id)  GITIGNORED
secret/fshare-movie/catalog.json.bak · catalog/links-NN.json.bak   bản của lần ghi TRƯỚC (tự động)     GITIGNORED
public/data/fshare-movie/catalog.enc.json   projection đã seal: chỉ link đã check, gzip + AES-256-GCM   COMMIT
```

"Catalog" trong tài liệu này = header + 16 shard, và `readCatalogSnapshot` /
`writeCatalogFile` trong `tools/fshare-movie.mjs` là hai cửa duy nhất đọc/ghi
nó. Cắt nhỏ để không bao giờ phải dựng một chuỗi JSON to bằng cả database
trong RAM (lần crash 2026-09-16, xem "Bài học"); `grep CODE
secret/fshare-movie/catalog/` vẫn tìm được một dòng bằng tay.

```text
ingest / crawl:* ──► raw/ ──build──► catalog.json ──validate──► catalog.json ──audit──► seal ──► catalog.enc.json ──► deploy
                                        (pending)     folder: crawl đệ quy         validated: OK?    (validated: true/false)
                                                      file:   probe + 2nd opinion
```

Hai việc khác nhau, đừng gộp: **thu thập** (Sheet, site) chỉ tạo ra link để
`build`; **kiểm tra** là việc của `validate`, và với folder nó là duyệt đệ
quy, không phải một lần probe root.

## Vì sao ba file, và vì sao mã hoá

Repo này là user-pages nên public; mọi thứ dưới `public/data/` trả lời một
`GET` thường. Danh sách link cộng đồng không thuộc về nơi
đó ở dạng plaintext, nên file duy nhất được commit là ciphertext — cùng cơ
chế và **cùng passphrase** với lịch riêng (`docs/schedule-playbook.md`).
Passphrase lấy theo thứ tự: `GAZLL_SCHEDULE_KEY` → `secret/app.key` →
hỏi trên terminal. Hệ quả cần biết: ai được cấp `schedule_access` để mở lịch
thì cũng mở được catalog phim.

Raw và catalog tách nhau vì chúng khác vòng đời. Raw là thứ cộng đồng chia sẻ,
không bao giờ sửa, và **xoá được sau khi `build`** — catalog đã giữ mọi link,
còn `sources.json` giữ URL Sheet để `ingest` lại khi có tab mới (lần đầu đã
xoá 3 CSV sau khi seal). Catalog là thứ tool ghi: một
dòng cho **mỗi link** (không phải mỗi phim), `build` chỉ thêm, `validate` chỉ
cập nhật tại chỗ. Một link chết vẫn ở lại với `deadSince` — đó là dữ liệu,
không phải rác. Sợ "dư data" là đúng nếu lưu nhiều bản; ở đây catalog là bản
duy nhất, còn envelope là *projection* của nó (chỉ dòng đã check, bỏ các
field nội bộ), không phải bản sao.

## Một dòng trong catalog

```json
{
  "id": "fshare-folder-EXMPL0000001",        // kind + code — khoá ổn định, không đổi theo tên
  "kind": "folder", "code": "EXMPL0000001", "link": "https://www.fshare.vn/folder/EXMPL0000001",
  "name": "Mother Android (2021)", "aliases": ["Mother Android 2021 ViE"],
  "titleKey": "mother android 2021",         // hai link cùng phim → cùng titleKey, nằm cạnh nhau
  "origin": "raw",                            // raw: từ Sheet · crawl: tìm thấy khi duyệt folder cha
  "sourceIds": ["src-b8158ef538"],            // raw file nào nhắc tới nó
  "parents": [],                              // folder nào chứa nó (điền khi crawl)
  "path": "", "size": 0,
  "firstSeenAt": "…",
  "status": "pending",                        // pending · live · dead · unknown
  "checkedAt": null, "lastLiveAt": null, "deadSince": null,
  "via": "",                                  // probe · listing · crawl · web — bằng chứng của lần check cuối
  "error": "",
  "category": "movie",                        // movie · software · music — categoryOf(name), xem mục dưới
  "web": { "status": "dead", "error": "…" },  // chỉ dòng dead: ý kiến thứ hai của fshare.vn
  "children": null                            // folder: {folders, files, live, dead, unknown, pending, crawledAt}
                                              // null = chưa liệt kê; crawledAt là bằng chứng duy nhất đã liệt kê
}
```

- **`id` là khoá, tên không phải.** Hai link khác nhau cùng tên phim là hai
  dòng, chung `titleKey`; UI gom chúng dưới một tiêu đề. Đổi tên không làm mất
  trạng thái, đổi code là link khác.
- **`status` chỉ có bốn giá trị.** `pending` = chưa ai nhìn tới; `unknown` =
  đã hỏi mà Fshare/proxy không trả lời được (timeout, 5xx). Hai thứ đó khác
  nhau: `unknown` được phép tồn tại và sẽ được hỏi lại ở lần chạy sau, còn
  `pending` là một trong ba cửa của `validated` (xem "Ba cửa validated").
- **Folder nhớ con của nó.** File tìm thấy trong folder có `parents`; `children`
  của folder được đếm lại từ đó mỗi lần ghi. Tháng sau chạy lại, một folder
  hiện "40 file · 35 live · 5 dead" là đọc thẳng từ đây.

## Movie / Software / Music — một catalog, ba tab

Các nguồn (Sheet, thuviencine, Telegram) không phân loại nội dung — một group
chia sẻ phim thỉnh thoảng trộn cả crack phần mềm (Adobe, AutoCAD, game
-CODEX/-SKIDROW…) và nhạc (FLAC/WAV album) vào cùng một chỗ. `categoryOf(name)`
(`public/fshare-tool/lib/movie-db.js`) gán mỗi dòng một `category` ngay lúc
tạo (`newLink`) và mỗi khi tên đổi từ mã sang tên thật (`addName`):

1. **Đuôi file quyết định trước, chắc chắn.** `.mkv/.mp4/.avi/…` → `movie`,
   `.mp3/.flac/.wav/…` → `music`, `.exe/.apk/.dmg/…` → `software` — không đọc
   tên nữa. Đây là phần lớn: ~99.7% catalog 2026-09-18 (326.648 dòng) có đuôi
   quyết định được ngay.
2. **Phần còn lại** (`.iso/.rar/.zip`, không đuôi — folder, hoặc tên trần từ
   Telegram) đọc từ khoảng chục cụm từ đặc trưng mỗi loại (CODEX/SKIDROW/
   Adobe/Photoshop/AutoCAD cho software; FLAC/OST/CD1/TNCD cho music). Không
   đuôi thắng thì mặc định `movie` — sai lệch còn lại nghiêng về false
   negative (bỏ sót software/music) chứ không phải false positive (đá nhầm
   phim thật ra khỏi tab Movie), vì false positive vô hình cho tới khi có
   người tìm phim không thấy.
3. **Từ chung chung là bẫy, đã bắt được lúc hiệu chỉnh trên dữ liệu thật:**
   `driver`, `action`, `portable`, `remastered` từng đá "Taxi Driver (1976)",
   "Missing in Action (1984)", "The Portable Door 2023" và
   "Spider-Man Remastered" sang software/music vì đó là những từ tiếng Anh
   phổ biến trong tên phim/game/nhạc như nhau. Cả bốn đã bị bỏ khỏi danh sách
   marker; chỉ giữ những cụm đặc trưng riêng một ngành (thương hiệu phần mềm,
   tag nhóm crack, định dạng nhạc).
4. **`category: "movie"` (mặc định) không được ghi vào envelope** — cùng quy
   tắc với `aliases`/`parents` rỗng, đỡ vài trăm nghìn field lặp một giá trị
   trên gần như mọi dòng. Tab đọc thấy field vắng thì hiểu là `movie`
   (`normalizeMovieDatabase`).
5. **Đổi phân loại cho dữ liệu cũ:** `node tools/fshare-movie.mjs categorize`
   (mặc định dry-run, in trước/sau + mẫu tên sẽ đổi loại) rồi thêm `--apply`
   để ghi thật. Chạy lại an toàn: chỉ tính lại `categoryOf(name)` cho mọi
   dòng, không đụng `status`/`checkedAt`/lịch sử check.

Ba tab UI (`public/fshare-tool/views/movie.js`) đọc **chung một sealed
catalog** (`MOVIE_DB_URL`) lọc theo `category` phía client — khác X, X là một
catalog riêng hoàn toàn (xem "Thu thập từ Telegram" không áp dụng cho X; X vẫn
là import x.csv độc lập). Bấm "Software"/"Music" không mở khoá lại, không tải
lại gì — chỉ đổi bộ lọc trên dữ liệu đã có trong bộ nhớ.

## Ba cửa validated

`validated: true` trong envelope — và badge VALIDATED trên tab — chỉ đúng khi
**cả ba** đếm về 0. `status` và `audit` in đủ ba số; `seal` vẫn ghi khi còn
thiếu nhưng với `validated: false` và nói rõ thiếu gì.

| Cửa | Là gì | Vì sao là cửa riêng | Đóng bằng |
|---|---|---|---|
| `pending` | link chưa ai hỏi | cửa gốc | `validate` (mặc định) |
| `uncrawled` | folder `live`/`unknown` mà `children.crawledAt` trống | probe root chỉ nói "folder tồn tại", không nói bên trong có gì; 5.881 folder Thuviencine đã ship như vậy | `validate --only uncrawled` |
| `unverified` | dòng `dead` mà `via !== 'web'` và `web.status !== 'dead'` | proxy 404 là **một** ý kiến; đã có file proxy 404 mà fshare.vn chuyển tiếp sang code mới | `validate --only unverified` |

`unknown` **không** phải cửa: đã hỏi, chưa có câu trả lời, lần sau hỏi lại.
Hai hàm `isUncrawled` / `isUnverifiedDead` trong `tools/fshare-movie.mjs` là
định nghĩa duy nhất; `merge` từ chối shard vi phạm (folder qua probe, dead
không có ý kiến thứ hai) ngay lúc gộp chứ không đợi tới `seal`.

## Vòng lặp

```bash
# 1. Nạp raw. Sheet phải share "anyone with the link"; mỗi tab (gid) là một CSV.
node tools/fshare-movie.mjs ingest "https://docs.google.com/spreadsheets/d/ID/edit#gid=123"
node tools/fshare-movie.mjs ingest "https://docs.google.com/spreadsheets/d/ID/edit" --gid 123,456
node tools/fshare-movie.mjs ingest https://www.fshare.vn/folder/ABCD1234 https://www.fshare.vn/file/EFGH5678
node tools/fshare-movie.mjs ingest ./export-tôi-tải-tay.csv
#    Hoặc thu thập từ một site (xem "Thu thập từ site") — cũng chỉ ghi vào raw/.
npm run crawl:thuviencine
#    Hoặc từ group Telegram mình là thành viên (xem "Thu thập từ Telegram").
npm run crawl:telegram

# 2. Raw → catalog. Link mới vào với status pending; link cũ giữ nguyên kết quả.
node tools/fshare-movie.mjs build
node tools/fshare-movie.mjs status

# 3. Kiểm tra — bước lâu nhất, chạy trên NAS, resumable (Ctrl+C rồi chạy lại).
#    Folder: duyệt đệ quy, file bên trong sống theo listing. File lẻ: probe,
#    dead thì hỏi fshare.vn lần hai. Một tiến trình duy nhất ghi catalog.
node tools/fshare-movie.mjs validate --concurrency 4
#    Rồi đóng hai cửa còn lại (thường chỉ khi shard/proxy đã để lại):
node tools/fshare-movie.mjs validate --only uncrawled,unverified --concurrency 4

# 4. Audit: ba cửa về 0 chưa, và thiếu ở nguồn nào. Không OK thì quay lại 3.
node tools/fshare-movie.mjs audit

# 5. Seal và commit. Chỉ dòng đã check được đưa vào; validated=true khi audit OK.
node tools/fshare-movie.mjs seal
git add public/data/fshare-movie/catalog.enc.json && git commit -m "reseal movie catalog"

# Kiểm tra envelope mở được và khớp catalog local (không phải stage của check.mjs)
node tools/fshare-movie.mjs --check
```

Mở khoá trong trình duyệt (Node đo hộ, 2026-09-17, 113.544 dòng): giải mã
~2,9 s + chuẩn hoá ~1,1 s + dựng index ~2,3 s ≈ **6,4 s** và ~190MB heap
(trước khi tối ưu: 10,3 s / 234MB). Điện thoại chậm hơn 3–5×; chú thích trên
form mở khoá nói đang ở bước nào. Bước tiếp nếu muốn nhanh nữa: đưa dựng
index vào Web Worker.

Search (Node đo hộ, cùng dữ liệu): một ký tự đầu "f" khớp 59k file / 8,6k
folder — trước 670 ms (sắp xếp toàn bộ 59k dòng theo size rồi gom nhóm để
hiện 150 dòng), sau 234 ms (chỉ xếp thứ tự NHÓM theo độ liên quan, xếp dòng
trong nhóm khi render); xoá ô tìm 866 → 158 ms và được cache. Search chạy
khi ngừng gõ 400 ms, Enter chạy ngay, Esc xoá, `/` nhảy vào ô tìm; từ khớp
được tô trong tên file và breadcrumb. Nhóm xếp theo: folder có tên/alias
chứa đủ từ khoá → folder chứa một phần → khớp qua tên file/ông bà; trong
nhóm nhỏ nhất trước.

Số đo thật, 2026-09-16, qua proxy, concurrency 4: 5.747 folder root (kể cả
con) xong trong ~68 phút (~0,7 s/folder); 3.573 dead xong trong ~24 phút
(~0,4 s/dòng, sau khi `--only unverified` tự chọn lại đúng phần còn thiếu
nếu một lần chạy bị dừng giữa chừng). Không cần chạy song song nhiều tiến
trình cho cỡ này. Một số dòng `dead` cần chạy lại `validate --only
unverified` vài lần liên tiếp (concurrency 1) mới hội tụ về 0 — ý kiến thứ
hai từ fshare.vn không ổn định dưới tải đồng thời: cùng một code, hỏi dồn dập
có lúc trả về trang của MỘT FILE KHÁC (tiêu đề thật, `ownPage` sai), hỏi lại
thong thả thì đúng. Đây là hành vi phía fshare.vn/proxy, không phải bug —
`unverified` được thiết kế để giữ lại đúng những dòng này cho lần chạy sau
thay vì đoán.

**RAM và kích thước catalog.** Máy NAS có 3,5GB. Đo 2026-09-17 với 113.544
dòng: 16 shard tổng 112MB, object graph sau khi parse ~290MB, `status` đỉnh
RSS ~380MB, một lần `validate` load + save ~900MB. Ba lớp bảo vệ, theo thứ
tự chúng đã cứu được gì:

1. **Ghi stream, từng dòng** — không bao giờ có một chuỗi JSON to bằng cả
   database trong RAM. Đây là thứ đã OOM ngày 2026-09-16.
2. **Đọc theo shard** — 16 file ~7MB parse lần lượt, không phải một chuỗi
   141MB. Trần tiếp theo lẽ ra sẽ ở ~500MB file.
3. **Tự nới heap** — Node chọn giới hạn heap theo bảng, không theo máy. Tool
   tính `8 × byte catalog + 512MB`; nếu vượt giới hạn hiện tại và máy còn
   RAM (trần 75% `os.totalmem()`), nó tự chạy lại một lần với
   `--max-old-space-size`. Vì thế `node tools/fshare-movie.mjs …` là
   nguyên câu lệnh trên mọi máy; `GAZLL_MOVIE_REEXEC=1` tắt cơ chế này.

Lớp còn lại nếu catalog tăng thêm ~5×: `remote` (32MB, 25% file, snapshot
API của Fshare, chưa lệnh nào đọc) và `path` (13MB) là hai field kế tiếp
nên tách ra file phụ hoặc bỏ. Chưa làm vì chưa cần.

### Chạy dài trên NAS

Một đợt validate là vài giờ. Chạy trong `screen`/`tmux` hoặc `nohup`, qua
một wrapper `sh` có `set -e` để một bước hỏng thì chuỗi dừng ngay chứ
không `seal` đè lên kết quả dở; mỗi bước ghi mốc `started`/`finished` vào
một log để biết đang ở đâu mà không cần đọc từng dòng tiến độ:

```sh
#!/bin/sh
set -e
cd /volume1/0_System/project/gazll.github.io
LOG=/tmp/validate-run.log
step() { echo "--- $1 · $(date -u +%FT%TZ) ---" >> "$LOG"; }
step "uncrawled";  node tools/fshare-movie.mjs validate --only uncrawled  --concurrency 4 >> "$LOG" 2>&1
step "unverified"; node tools/fshare-movie.mjs validate --only unverified --concurrency 4 >> "$LOG" 2>&1
step "unknown";    node tools/fshare-movie.mjs validate --only unknown    --concurrency 4 >> "$LOG" 2>&1
step "audit";      node tools/fshare-movie.mjs audit >> "$LOG" 2>&1
step "done"
```

`nohup sh run.sh &` rồi `grep -- --- /tmp/validate-run.log` cho mốc,
`tail -3` cho tiến độ. Mọi bước đều resumable: chết giữa chừng thì chạy lại
đúng wrapper đó, không cần sửa gì. Không tự động `seal` trong wrapper —
`audit` phải đọc bằng mắt trước.

### Chạy lại định kỳ (tuần / tháng)

```bash
node tools/fshare-movie.mjs validate --stale 30d        # + pending/unknown như thường lệ
node tools/fshare-movie.mjs validate --only dead --stale 90d   # thỉnh thoảng hỏi lại link chết
node tools/fshare-movie.mjs seal && git commit -am "reseal movie catalog"
```

`--stale 30d` chọn thêm những dòng `checkedAt` cũ hơn 30 ngày. Mặc định
(không `--only`) chỉ chọn `pending,unknown`; `--only all` là mọi dòng.
`--only` nhận bốn status và hai cửa: `uncrawled`, `unverified`.

## Thu thập từ site

Một site chia sẻ (hiện có `tools/crawl-thuviencine.mjs`, `npm run
crawl:thuviencine`) là một **nguồn raw** như Sheet: crawler chỉ ghi
`raw/<site>-<ngày>.txt` (dòng `Tên phim https://www.fshare.vn/...`) và đăng ký
`originUrl` vào `sources.json`. Nó **không** chạm Fshare, không chạm catalog.

```bash
npm run crawl:thuviencine            # sitemap → trang phim → /download?id= → link Fshare
cat secret/fshare-movie/thuviencine-crawl-report.json   # movieFailures = downloadFailures = 0 mới đi tiếp
npm run crawl:thuviencine            # chạy lại = retry đúng các trang lỗi (state ngoài raw/)
```

Kinh nghiệm đã trả giá, giữ để crawler sau không lặp lại:

- Sitemap trả `loc` dạng `http` dù site chạy `https` — so hostname rồi chuẩn
  hoá về HTTPS, đừng so nguyên origin.
- Không đệ quy mọi link trong trang phim (có danh sách phim liên quan);
  post-sitemap là index chính xác và chặn bùng nổ request.
- Hai phase bounded-concurrency: fetch trang phim, dedupe URL download, rồi
  mỗi trang download một lần. Checkpoint ngoài `raw/`; 429/5xx là hạ
  concurrency, không phải tắt retry.
- **Thu thập link ≠ duyệt folder.** Crawler xong chỉ có `pending`; folder vẫn
  phải qua `validate` (đệ quy). Root probe không thay được bước này — đó chính
  là sai lầm 2026-09-16.

## Thu thập từ Telegram

`tools/crawl-telegram.mjs` (`npm run crawl:telegram`) đọc lịch sử group/channel
**bằng chính tài khoản của bạn** qua MTProto (GramJS) — là thành viên thì đọc
được, không cần bot, không cần admin. Cũng là một nguồn raw như site: ghi
`raw/telegram-<chat>-<ngày>.txt`, đăng ký `originUrl` (`https://t.me/<user>`
hoặc `t.me/c/<id>`) vào `sources.json`, không chạm Fshare, không chạm catalog.

Code nằm trong repo và không chứa gì riêng tư. Mọi thứ nhận diện bạn nằm ở
`secret/telegram/` (gitignored, **không có backup**):

| File | Là gì |
|---|---|
| `config.json` | `{ "apiId": 123, "apiHash": "…", "chats": ["@name", -1001234567890, "-1002633694014/571"] }` — apiId/apiHash lấy ở https://my.telegram.org → *API development tools*. `id/topic` (hoặc link `t.me/c/<id>/<topic>`) là **một topic** trong group dạng forum — HDvietnam là forum, và chỉ vài topic có link |
| `session` | phiên đăng nhập MTProto, mode 600. **Là credential**: ai có file này là đăng nhập được tài khoản Telegram của bạn |
| `state.json` | message id cuối đã đọc mỗi chat — chạy lại chỉ đọc phần mới |
| `report.json` | lần chạy gần nhất tìm được gì |

```bash
node tools/crawl-telegram.mjs login          # một lần mỗi máy: số điện thoại, code, 2FA
node tools/crawl-telegram.mjs chats          # liệt kê group/channel → chép id vào config.json
npm run crawl:telegram                       # mọi chat trong config.json; lần đầu đọc cả lịch sử
npm run crawl:telegram -- --chat @name --limit 200   # thử nhỏ một chat
npm run crawl:telegram -- --full             # bỏ state, đọc lại từ đầu
cat secret/telegram/report.json
```

Bốn điều đã quyết, để khỏi làm lại:

- **Đăng nhập là việc của người, `login` làm một lần mỗi máy.** Tool không bao
  giờ in session hay apiHash ra, và từ chối ghi `session` nếu `git check-ignore`
  không nhận đường dẫn đó — một clone mất dòng `secret/` trong `.gitignore` sẽ
  commit credential ở lần `git add -A` kế. Đem qua máy khác: pull code rồi
  `login` lại ở đó (một session mới trong *Active sessions* của Telegram), đừng
  chép file `session` qua chat/mail. Thu hồi: Telegram → Settings → Devices →
  terminate phiên đó, hoặc xoá file.
- **Đọc từ cũ → mới, `state.lastId` là con trỏ.** Ctrl+C giữa chừng vẫn đúng:
  phần trước con trỏ đã ghi ra raw, phần sau đọc tiếp lần sau. Thứ tự mới → cũ
  thì không resume được (đã đọc đầu, chưa đọc đuôi, không có con trỏ nào đúng).
- **Link không chỉ nằm trong text, và tên là của đoạn chứ không phải của tin.**
  Một *text link* giấu URL sau chữ hiển thị, nút inline chỉ có `url`, link
  preview giữ URL trên `media.webpage`; tool gộp cả bốn chỗ rồi mới lọc Fshare.
  Tin chia thành đoạn theo dòng trống và mỗi link lấy dòng đầu của **đoạn**
  chứa nó (bỏ URL, hashtag, số thứ tự `1.`, emoji đầu/cuối) — FSHARE GROUP là
  bot search, một tin là 5 file mỗi file một đoạn, dòng đầu tin chỉ là câu
  query; lần chạy đầu 308 dòng đều mang tên query. Đoạn không có tên rơi về
  tên tin; một file trong album không có caption, hay một link trả lời post,
  **mượn** tên của album/post đó — resolve sau khi đọc xong vì caption có thể
  đứng trước hoặc sau link trong lịch sử.
- **FloodWait là bình thường.** `floodSleepThreshold: 300` — tool tự ngủ tới 5
  phút thay vì ném lỗi; lâu hơn thế thì Ctrl+C và chạy lại sau. Đừng thêm
  concurrency: một tài khoản người dùng đọc tuần tự là đúng tốc độ Telegram
  cho phép.

Xong crawler chỉ có `pending`; quy tắc cuối của "Thu thập từ site" vẫn đúng ở
đây — folder phải qua `validate`.

## `validate` làm gì, và làm gì để không tốn gấp mười

1. **Folder trước, file sau; chưa check trước, cũ sau.** Folder crawl đệ quy
   (`crawlMovieFolder` dùng chung với tab Browse) tìm ra file bên trong, và một
   file nằm trong listing còn sống thì **sống theo listing** (`via: listing`)
   — Fshare không liệt kê thứ đã xoá. Probe riêng chỉ tốn cho link file đứng
   một mình trong Sheet, và cho file *đã từng* thấy trong folder mà lần này
   listing không còn nhắc tới.
2. **Một listing cache cho cả lần chạy.** Sheet liệt kê folder gốc lẫn từng
   folder con thành dòng riêng; không có cache thì mỗi cây bị duyệt một lần
   cho mỗi tổ tiên. Folder nào đã được liệt kê trong lần chạy (bởi bất kỳ tổ
   tiên nào) thì dòng của nó bỏ qua.
3. **`dead` phải qua hai ý kiến.** Proxy trả 404 → hỏi thẳng `fshare.vn/file/CODE`
   và đọc `<title>`: `Không tìm thấy - Fshare` là chết thật, tên file là proxy
   sai. Chỉ Node làm được (browser bị CORS). `--no-web` tắt bước này.
4. **Checkpoint mỗi 25 dòng và khi Ctrl+C.** Một lần chạy nhiều giờ chết ở
   90% không mất gì; chạy lại tiếp từ chỗ `pending`.
5. **`--concurrency N`** (mặc định 4) chạy N dòng song song, chia sẻ cache.
   Proxy đo được 6 là sạch với tab Browse; cao hơn thì `unknown` tăng vì bị
   reset, và những dòng đó phải chạy lại.

## Chạy song song bằng shard — chỉ cho FILE

`validate` ghi `catalog.json` tại chỗ nên chỉ được **một tiến trình**. Muốn
chia việc ra nhiều tiến trình/máy thì dùng `tools/fshare-movie-shard.mjs`: nó
đọc một snapshot catalog, probe một tập con **rời nhau và xác định** theo
`--shard-index/--shard-count`, ghi kết quả ra file riêng và **không bao giờ
ghi `catalog.json`**. Ghi vào catalog chỉ xảy ra một lần, ở `merge`.

Shard **chỉ nhận `--kind file`**. Folder được chứng minh bằng listing, và
listing là việc của `validate` (`crawlMovieFolder`, một cache cho cả lần chạy);
probe một folder chỉ trả lời "tồn tại". Chế độ `--kind all` từng có và đã
bị gỡ sau khi nó ship 5.881 folder `live` với `children: null`. Một dòng
`dead` từ shard cũng mang sẵn ý kiến thứ hai của fshare.vn (`web`); `merge`
từ chối cả hai loại dòng sai đó, nên một shard cũ chạy bằng code cũ không
gộp được nữa.

```bash
# thử nhỏ trước
node tools/fshare-movie-shard.mjs --catalog secret/fshare-movie/catalog.json   --output secret/fshare-movie/shards/smoke.json --kind file --status live --limit 20 --concurrency 4

# bốn shard song song, cùng MỘT snapshot catalog, concurrency mỗi tiến trình thấp
for i in 0 1 2 3; do
  node tools/fshare-movie-shard.mjs --catalog secret/fshare-movie/catalog.json     --output secret/fshare-movie/shards/files-$i.json     --kind file --status live --shard-index $i --shard-count 4 --concurrency 2 &
done; wait

# gộp một lần, sau khi mọi tiến trình xong
node tools/fshare-movie.mjs merge secret/fshare-movie/shards/files-{0,1,2,3}.json
```

`merge` kiểm tra mọi shard cùng một SHA-256 snapshot, id/code bất biến, không
trùng dòng, rồi ghi catalog **một lần**. Nếu `build` hay `validate` đã đổi
catalog trong lúc shard chạy, `merge` dừng và phải chạy lại shard. Không chạy
`build`/`validate`/`merge` khi lệnh khác đang ghi catalog. Timeout/retry kết
thúc là `unknown`, không bị gọi là `dead`. Output shard nằm dưới `secret/`,
xoá sau khi merge.

Mỗi response API thành công cũng lưu snapshot `remote` (size, path, mimetype,
created/modified, downloadcount, cờ truy cập) và `keywords` đã chuẩn hoá trên
dòng — chỉ trong catalog, không vào envelope (xem "Những thứ dễ hỏng").

## Làm trên máy khác (NAS)

Máy NAS thật sự là **ASRock J3455-ITX** chạy DSM (báo DS920+/DS918+): Celeron
J3455 4 nhân 1,5GHz, **4GB DDR3L** trong 2 khe SO-DIMM (tối đa 16GB = 2×8GB
DDR3L-1866 1,35V — không phải DDR4 như DS920+ thật, đừng mua D4NESO). Với 4GB
tổng, Node tự đặt trần heap ~1,8GB — đó là con số OOM 2026-09-16; `ensureHeap`
nới được tới 75% RAM máy. Idle đã dùng ~1,4GB + 0,5GB swap (Claude/Codex
session ~430MB mỗi cái, postgres, transmission), nên một lần validate cạnh
một session AI là chạm swap. CPU không nâng được; mọi số đo "Node" trong
tài liệu này là trên CPU này, laptop nhanh gấp 3–4 lần.


Job validate dài giờ nên chạy trên NAS hợp lý hơn laptop. Repo clone được từ
git; những gì **không** nằm trong git phải copy tay, và catalog (header + `catalog/`) là
**bản duy nhất** — bên nào chạy tiếp thì bên đó giữ, xong thì copy ngược lại
trước khi `seal`, không được seal từ bản cũ.

```bash
scp -r secret public/config.js nas@nas:/volume1/0_System/project/gazll.github.io/
ssh nas@nas 'cd /volume1/0_System/project/gazll.github.io   && git pull && mv config.js public/config.js   && npm ci --legacy-peer-deps --no-audit --no-fund   && node -v && node tools/fshare-movie.mjs status'
```

| File | Vì sao cần |
|---|---|
| `secret/app.key` | passphrase — thiếu là không `seal` được |
| `secret/fshare-movie/catalog.json` + `catalog/` | state đang validate — header VÀ thư mục shard, cả hai |
| `secret/fshare-movie/raw/` + `sources.json` | để `build` lại khi Sheet có tab mới |
| `public/config.js` | `GOOGLE_CLIENT_ID` + `SCRIPT_URL` cho dev local |

`secret/schedule.json` không cần copy (`schedule-seal.mjs unseal` lấy lại từ
envelope). Node phải ≥ 18 (`CompressionStream`, `structuredClone`).

## Trước khi push

Ba lệnh CI như thường lệ. Hai thứ đã làm CI đỏ mà không liên quan code:
`stamp-content-dates --check` lệch (chạy không `--check` rồi commit), và bước
`Audit production dependencies` (`npm audit --omit=dev --audit-level=high`)
khi có advisory mới trên dependency transitive — `npm audit fix` rồi commit
`package-lock.json`. Sau push, xác nhận deploy bằng
`https://gazll.github.io/version.json` mang đúng commit.

## Khôi phục

- Crash giữa lúc ghi (OOM, mất điện, Ctrl+C sai lúc): không mất gì. Mỗi file
  được ghi ra `.tmp` rồi rename vào, bản trước giữ lại thành `.bak`. Shard
  nào hỏng thì lần load sau tự đọc `.bak` của nó và in cảnh báo; chạy lại
  `validate` là đủ vì nó resumable. Xoá các `.bak` khi thấy chật đĩa — chúng
  được ghi đè ở mỗi lần save nên không bao giờ nhiều hơn một bản.
- Mất `secret/`: `node tools/fshare-movie.mjs unseal` lấy lại **projection**
  (các dòng đã check) từ envelope trong git vào `catalog.unsealed.json`.
  Không phải catalog đầy đủ — `pending` và các field nội bộ không nằm trong
  envelope. Ghép vào `catalog.json` theo `id`, hoặc `ingest` lại raw rồi
  `build`, rồi copy trạng thái sang.
- Mất passphrase: mất envelope. Không có đường khác.

## Bài học 2026-09-16 → 17

Một đợt thu thập 10.641 link, ba lỗi quy trình, một crash. Ghi lại để lần
sau đọc trước khi chạy:

1. **Probe root không phải validate folder.** "Folder trả lời" ≠ "biết bên
   trong có gì". 5.881 folder đã ship như thế với `validated: true`. Giờ
   `uncrawled` là một cửa, `--kind all` của shard đã gỡ, `merge` từ chối
   folder qua probe.
2. **Một 404 của proxy là một ý kiến.** Ý kiến thứ hai từ fshare.vn bắt buộc;
   `unverified` là cửa thứ ba. Và ý kiến thứ hai đó **không ổn định dưới
   tải**: hỏi dồn (concurrency 4) có lúc nhận trang của file khác; hỏi lại
   chậm (concurrency 1) vài lượt thì đúng — 113 → 110 → 46 → 1 → 0. Đừng
   nới luật để "cho xong"; chạy lại chậm.
3. **Một 404 thật từ fshare.vn thì ngược lại là kết luận.** Code
   `M7VL29SY6AVENGERS` — nguồn đã dính tên phim vào code — cả hai phía đều
   404. `webPage()` giờ coi 404/410 là `dead`, chỉ 5xx mới `unknown`.
4. **`pending 0` không phải "xong".** `audit` mới là câu trả lời, và phải
   `validated: OK` trước khi `seal`.
5. **Không đếm tay.** Số trong todo lệch ngay (5.881 = 5.752 + 129, hai cửa
   khác nhau). Mọi con số trong tài liệu lấy từ `audit --json`.
6. **RAM là một ràng buộc thiết kế, không phải sự cố.** Catalog lớn dần theo
   từng đợt; thứ hôm nay vừa đủ thì tháng sau OOM. Stream khi ghi, shard khi
   đọc, bỏ field không ai đọc (`keywords`, −17%), và đo (`/usr/bin/time -v`)
   thay vì đoán.
7. **Crash không được phép làm mất dữ liệu.** Ghi `.tmp` + rename + giữ
   `.bak`. Lần OOM 2026-09-16 may mắn rơi vào giữa hai checkpoint; nếu rơi
   giữa lúc ghi thì bản duy nhất đã cụt.
8. **Một commit một việc, kể cả khi đang vội.** `interviews.json` restamp lọt
   vào commit crawl và che một bug thật của `stamp-content-dates`.
9. **Todo nằm trong `docs/todo/`, xoá khi đóng.** Kinh nghiệm thì nằm ở đây
   và ở CLAUDE.md; file todo không phải nơi giữ bài học.

## Những thứ dễ hỏng

- **`seal` ghi cả khi chưa validated**, với `validated: false` và chỉ dòng đã
  check. Đó là chủ ý (site hiển thị "NOT VALIDATED" thay vì trống), nhưng
  đừng coi đó là bản chính thức — bản chính thức là lần seal đầu tiên
  `audit` báo `validated: OK`. `pending 0` **không** đồng nghĩa OK: xem
  "Ba cửa validated".
- **Đừng "kiểm tra nhanh" folder bằng probe root.** Kết quả trông đầy đủ
  (`live`, có `path`, có `checkedAt`) nhưng `children` trống và không file
  con nào được tìm thấy — tab search không có gì để hiện dưới folder đó.
  `isUncrawled` đếm chính xác các dòng này.
- **`dead` phải có hai ý kiến, kể cả folder.** File: proxy 404 + trang
  `fshare.vn/file/CODE` tiêu đề "Không tìm thấy". Folder: proxy 404 + trang
  `fshare.vn/folder/CODE` tiêu đề rơi về slogan "Dịch vụ lưu trữ…" (folder
  sống có tiêu đề `Fshare - <tên> - Fshare`). Web nói sống mà proxy 404 →
  file thành `live via web`, folder thành `unknown` (chưa liệt kê được) —
  không bao giờ thành `live` với `children: null`. Có file proxy 404 nhưng
  fshare.vn chuyển tiếp sang code khác (`ZKJPO2ZG3P2W29W` → `9M4FK884KCQC6NH`):
  hiện là `unknown`, mô hình chưa có chỗ ghi `movedTo`.
- **Đừng chạy `tools/fshare-movie.mjs --check` trong `check.mjs`.** CI không
  có passphrase, giống `schedule-seal.mjs`.
- **Trần ciphertext là 16MB sau gzip** (`lib/schedule-crypto.js`), đã nới
  từ 8MB một lần nữa: thêm ba nguồn Telegram ngày 2026-09-18 đưa catalog lên
  326k link, ~10,9MB gzip sau khi đã cắt `remote`, `path`, `keywords`, `id`,
  `titleKey` khỏi projection (trần 8MB trước đó tự nó đã nới từ 2MB ở mốc
  74k link/~2,4MB). Vượt trần thì cắt field trong `projectCatalog` trước;
  `normalizeMovieDatabase` dựng lại id/titleKey/keywords khi load.
  `MAX_ENVELOPE_JSON_CHARS` (bound base64 JSON, kiểm trước khi decode) nới
  cùng lúc, theo tỉ lệ base64 (4/3 dung lượng nhị phân).
- **Folder liệt kê rỗng là `dead`, với `error: "empty listing"`.** Folder
  `public: 0` trả listing rỗng — cả proxy lẫn API của chính fshare.vn — và
  không phân biệt được với folder trống thật. Với mục đích của catalog thì
  như nhau: không có gì để tìm. `markEmptyFolders` chạy ở mỗi lần save:
  folder đã crawl, 0 folder con, 0 file → `dead via listing` (listing chính là
  bằng chứng, không cần ý kiến thứ hai). 2026-09-17: 12.843 / 25.428 folder
  đã crawl là như vậy. `--only dead --stale 90d` hỏi lại; chủ mở public thì
  lần crawl sau tự sống lại.
- **Search chỉ trả về FILE; folder là tiêu đề nhóm.** Mọi folder đã được crawl
  đệ quy, nên một dòng folder trong kết quả chỉ là một cú click để biết bên
  trong có gì. File khớp theo tên nó HOẶC theo tên/alias của mọi folder phía
  trên (`movieHaystack`) — "xứ cát" tìm ra `Dune.1984.mkv` qua alias tiếng
  Việt của folder cha. Kết quả gom theo folder chứa nó, nhỏ nhất trước.
- **`titleKey` không gộp chất lượng.** `Dune.2021.1080p` và `Dune.2021.2160p`
  là hai key gần nhau, không phải một; gộp thêm là đoán, và đoán sai thì hai
  phim khác nhau dính vào nhau.
