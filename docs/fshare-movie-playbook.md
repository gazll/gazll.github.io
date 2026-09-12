# Fshare movie catalog — playbook

Tab **Movie** trong `/fshare-tool` là một database link phim lấy từ các
Google Sheet cộng đồng, đã kiểm tra với Fshare và giữ lịch sử từng link. Tài
liệu này là toàn bộ quy trình vận hành: một tool, ba file, một chiều.

```text
secret/fshare-movie/raw/            export thô (CSV từng tab Sheet, list link dán tay)  GITIGNORED
secret/fshare-movie/sources.json    URL gốc của từng raw file                              GITIGNORED
secret/fshare-movie/catalog.json    DATABASE CHÍNH — mọi link từng thấy + kết quả check    GITIGNORED
public/data/fshare-movie/catalog.enc.json   projection đã seal: chỉ link đã check, gzip + AES-256-GCM   COMMIT
```

```text
ingest ──► raw/ ──build──► catalog.json ──validate──► catalog.json ──seal──► catalog.enc.json ──► deploy
                               (pending)                (live/dead/unknown)     (validated: true/false)
```

## Vì sao ba file, và vì sao mã hoá

Repo này là user-pages nên public; mọi thứ dưới `public/data/` trả lời một
`GET` thường. Danh sách link cộng đồng không thuộc về nơi
đó ở dạng plaintext, nên file duy nhất được commit là ciphertext — cùng cơ
chế và **cùng passphrase** với lịch riêng (`docs/schedule-playbook.md`).
Passphrase lấy theo thứ tự: `GAZLL_SCHEDULE_KEY` → `secret/app.key` →
hỏi trên terminal. Hệ quả cần biết: ai được cấp `schedule_access` để mở lịch
thì cũng mở được catalog phim.

Raw và catalog tách nhau vì chúng khác vòng đời. Raw là thứ cộng đồng chia sẻ,
không bao giờ sửa, có thể xoá sau khi import. Catalog là thứ tool ghi: một
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
  "children": null                            // folder: {folders, files, live, dead, unknown, pending, crawledAt}
}
```

- **`id` là khoá, tên không phải.** Hai link khác nhau cùng tên phim là hai
  dòng, chung `titleKey`; UI gom chúng dưới một tiêu đề. Đổi tên không làm mất
  trạng thái, đổi code là link khác.
- **`status` chỉ có bốn giá trị.** `pending` = chưa ai nhìn tới; `unknown` =
  đã hỏi mà Fshare/proxy không trả lời được (timeout, 5xx). Hai thứ đó khác
  nhau: `validated` của cả database chỉ đúng khi **không còn `pending`**;
  `unknown` được phép tồn tại và sẽ được hỏi lại ở lần chạy sau.
- **Folder nhớ con của nó.** File tìm thấy trong folder có `parents`; `children`
  của folder được đếm lại từ đó mỗi lần ghi. Tháng sau chạy lại, một folder
  hiện "40 file · 35 live · 5 dead" là đọc thẳng từ đây.

## Vòng lặp

```bash
# 1. Nạp raw. Sheet phải share "anyone with the link"; mỗi tab (gid) là một CSV.
node tools/fshare-movie.mjs ingest "https://docs.google.com/spreadsheets/d/ID/edit#gid=123"
node tools/fshare-movie.mjs ingest "https://docs.google.com/spreadsheets/d/ID/edit" --gid 123,456
node tools/fshare-movie.mjs ingest https://www.fshare.vn/folder/ABCD1234 https://www.fshare.vn/file/EFGH5678
node tools/fshare-movie.mjs ingest ./export-tôi-tải-tay.csv

# 2. Raw → catalog. Link mới vào với status pending; link cũ giữ nguyên kết quả.
node tools/fshare-movie.mjs build
node tools/fshare-movie.mjs status

# 3. Kiểm tra. Xem docs/todo/fshare-movie-validate.md — đây là bước lâu nhất.
node tools/fshare-movie.mjs validate --concurrency 6

# 4. Seal và commit. Chỉ dòng đã check được đưa vào; validated=true khi hết pending.
node tools/fshare-movie.mjs seal
git add public/data/fshare-movie/catalog.enc.json && git commit -m "reseal movie catalog"

# Kiểm tra envelope mở được và khớp catalog local (không phải stage của check.mjs)
node tools/fshare-movie.mjs --check
```

### Chạy lại định kỳ (tuần / tháng)

```bash
node tools/fshare-movie.mjs validate --stale 30d        # + pending/unknown như thường lệ
node tools/fshare-movie.mjs validate --only dead --stale 90d   # thỉnh thoảng hỏi lại link chết
node tools/fshare-movie.mjs seal && git commit -am "reseal movie catalog"
```

`--stale 30d` chọn thêm những dòng `checkedAt` cũ hơn 30 ngày. Mặc định
(không `--only`) chỉ chọn `pending,unknown`; `--only all` là mọi dòng.

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

## Làm trên máy khác (NAS)

Job validate dài giờ nên chạy trên NAS hợp lý hơn laptop. Repo clone được từ
git; những gì **không** nằm trong git phải copy tay, và `catalog.json` là
**bản duy nhất** — bên nào chạy tiếp thì bên đó giữ, xong thì copy ngược lại
trước khi `seal`, không được seal từ bản cũ.

```bash
scp -r secret public/config.js nas@nas:/volume2/99_Drives/Project/gazll.github.io/
ssh nas@nas 'cd /volume2/99_Drives/Project/gazll.github.io   && git pull && mv config.js public/config.js   && npm ci --legacy-peer-deps --no-audit --no-fund   && node -v && node tools/fshare-movie.mjs status'
```

| File | Vì sao cần |
|---|---|
| `secret/app.key` | passphrase — thiếu là không `seal` được |
| `secret/fshare-movie/catalog.json` | state đang validate |
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

- Mất `secret/`: `node tools/fshare-movie.mjs unseal` lấy lại **projection**
  (các dòng đã check) từ envelope trong git vào `catalog.unsealed.json`.
  Không phải catalog đầy đủ — `pending` và các field nội bộ không nằm trong
  envelope. Ghép vào `catalog.json` theo `id`, hoặc `ingest` lại raw rồi
  `build`, rồi copy trạng thái sang.
- Mất passphrase: mất envelope. Không có đường khác.

## Những thứ dễ hỏng

- **`seal` ghi cả khi còn pending**, với `validated: false` và chỉ dòng đã
  check. Đó là chủ ý (site hiển thị "NOT VALIDATED" thay vì trống), nhưng
  đừng coi đó là bản chính thức — bản chính thức là lần seal đầu tiên
  `status` báo `validated: OK`.
- **Đừng chạy `tools/fshare-movie.mjs --check` trong `check.mjs`.** CI không
  có passphrase, giống `schedule-seal.mjs`.
- **Trần ciphertext là 8MB sau gzip** (`lib/schedule-crypto.js`), đã nới
  từ 2MB một lần vì lần chạy thật ra 74k dòng (~2,4MB gzip sau khi đã cắt
  `remote`, `path`, `keywords`, `id`, `titleKey` khỏi projection — ba field
  đầu chiếm 39MB trong 70MB). Vượt trần thì cắt field trong `projectCatalog`
  trước; `normalizeMovieDatabase` dựng lại id/titleKey/keywords khi load.
- **Folder `public: 0` trả listing rỗng** — cả proxy lẫn API của chính
  fshare.vn. Không phân biệt được "trống" với "chủ không public", nên tab hiện
  "nothing listed" thay vì không hiện gì. Lần chạy đầu có 5.368 folder như vậy.
- **`titleKey` không gộp chất lượng.** `Dune.2021.1080p` và `Dune.2021.2160p`
  là hai key gần nhau, không phải một; gộp thêm là đoán, và đoán sai thì hai
  phim khác nhau dính vào nhau.
