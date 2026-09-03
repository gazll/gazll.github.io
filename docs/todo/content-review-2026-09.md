# Rà soát tài liệu — System Design & Case Studies

Khảo sát ngày 2026-09-03. Lần chạm nội dung gần nhất của cả hai surface là
2026-08-23 (`integrate research evidence`).

Kết luận chung: **cấu trúc không có nợ kỹ thuật.** Điều cần làm là công việc
biên tập, không phải sửa lỗi. Chi tiết những gì đã kiểm và kết quả nằm ở
"Đã kiểm, không cần làm gì" cuối file — đọc phần đó trước khi mở lại một mục,
để không kiểm lại thứ đã sạch.

---

## 1. Xác minh link — cần khung giờ mạng không bị chặn

Ba link ngoài trong body case study đã lưu trữ không trả `200`. Luật trong
CLAUDE.md: một citation chết thì **bỏ thẻ `<a>`, giữ URL lại dạng `<code>`** —
trích dẫn còn, lời hứa gãy thì bỏ. Không xoá câu văn, không thay bằng nguồn
khác: đó là provenance của bài gốc, không phải của mình.

Chưa sửa gì cả, vì `403`/`000` có thể chỉ là WAF chặn `curl` chứ không phải
link chết thật. **Phải mở bằng trình duyệt thật rồi mới quyết định.**

| Trạng thái | Link | Nằm ở |
|---|---|---|
| `404` (khá chắc đã chết) | `towardsdatascience.com/beta-distribution-intuition-examples-and-derivation-cf00f4db57af` | `02-a-b-testing-in-tiki-search{,.vi}.html:74` |
| `000` — curl bị chặn hoàn toàn | `youtu.be/ObzlKVCiBqI` | `02-a-b-testing-in-tiki-search{,.vi}.html:424` |
| `403` — nhiều khả năng WAF của CISA | `cisa.gov/sites/default/files/2025-08/joint-advisory-cisa-identifies-…-508c.pdf` | `17-ssh-server-hardening-lessons{,.vi}.html:91` |

Lưu ý khi sửa: cả ba đều tồn tại ở **cả hai** bản EN và VI, cùng số dòng. Sửa
một bên mà quên bên kia là làm lệch cặp bài song ngữ.

Lệnh quét lại toàn bộ (17 link ngoài, chạy vài giây):

```bash
node -e "
const fs=require('fs'); const dir='public/data/case-studies/articles/'; const set=new Set();
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.html'))){
  const t=fs.readFileSync(dir+f,'utf8');
  for(const m of t.matchAll(/href=\"(https:\/\/[^\"]+)\"/g)) if(!m[1].includes('gazll.github.io')) set.add(m[1]);
}
console.log([...set].join('\n'));" > /tmp/links.txt
while read -r u; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 12 -A 'Mozilla/5.0' "$u")
  [ "$code" = "200" ] || echo "$code  $u"
done < /tmp/links.txt
```

---

## 2. `reviewed_at` gần như trống ở cả hai surface

Đây là phát hiện có giá trị nhất của đợt rà soát.

Cơ chế đã có sẵn và **đang chạy**: `public/lib/content-dates.js` in nhãn
`Đã kiểm chứng kỹ thuật` / `Technically reviewed`, view blueprint đã gọi
`contentDateFacts(design.value, …)`, `CollectionIndex.vue` đã dùng
`reviewed_at` để xếp "Latest updates", và `tests/libraries.test.mjs` đã có sẵn
assertion chờ field này (dạng optional). Chỉ thiếu **dữ liệu**:

- blueprint có `reviewed_at`: **1/20** (`multi-tenant-rabbitmq-fairness`)
- case study có `reviewed_at`: **3/18** (`shopify-mysql-inventory-reservations`,
  `ssh-server-hardening-lessons`, `some-simple-economics-of-agi`)

Hệ quả: 19 blueprint và 15 case study hiện ngày `Cập nhật` nhưng không hiện
`Đã kiểm chứng kỹ thuật` — đúng cái phân biệt "claim đã kiểm" với "claim thừa
kế" mà mục *Content standards* đặt ra.

Cũng lưu ý: `public/data/content-reviews.json` có 163 claim nhưng **không có
một key nào** cho system-design hay case-studies — toàn bộ là item id của
topics. Hai surface này dùng `reviewed_at` đặt thẳng trên row (như 4 row đang
có), không đi qua file đó.

**Việc cần làm** — đây là rà soát nội dung thật, không phải điền ngày hàng
loạt. Điền `reviewed_at` cho row nào đã thực sự đọc lại và đối chiếu nguồn
gốc. Điền cả 20 dòng trong một commit thì cái nhãn đó thành vô nghĩa.

Ưu tiên theo thứ tự (blueprint nhiều người đọc + có claim ghim version trước):

1. `api-gateway-identity-edge` — xem mục 3 bên dưới, có claim version cần đối chiếu.
2. Ba blueprint `foundations` core: `design-review-framework`,
   `traffic-caching-building-blocks`, `surviving-high-load`.
3. Phần còn lại, cuốn chiếu.

---

## 3. Hai claim ghim version cần đối chiếu lại

Quét toàn bộ 20 blueprint chỉ tìm được **2** chỗ ghim version cụ thể — nội dung
viết ở mức nguyên lý nên rất ít bề mặt lỗi thời. Cả hai đều ở
`api-gateway-identity-edge`:

- `Spring Boot 4`
- `Resilience4j 2.4.0`

Cần mở `docs.spring.io` và `resilience4j.readme.io` (cả hai đã có trong
`REFERENCE_ORIGINS`) xác nhận còn là bản hiện hành, rồi đặt `reviewed_at` +
`target_versions` cho row này. Đây là ứng viên số 1 của mục 2.

---

## 4. Sơ đồ `flash-sale-booking-inventory-bottleneck` — cạnh không mang cơ chế

CLAUDE.md: *"the edge carries the mechanism"*. Đo tỉ lệ cạnh có nhãn trên cả 20
sơ đồ:

- `flash-sale-booking-inventory-bottleneck`: **7%** (2 nhãn / 30 cạnh)
- `chat-messaging`: 85% — đây là chuẩn để đối chiếu
- trung vị: khoảng 55%

Hai cái thấp còn lại (`api-gateway-identity-edge` 24%,
`design-review-framework` 29%) **đã kiểm và không cần sửa**: nhãn của chúng nằm
đúng chỗ quyết định (`IdP down: cached keys still verify`,
`peak = 20x average, tier named`), phần cạnh trần là các bước tuần tự nên để
trần là đúng.

Flash-sale thì khác hẳn: là blueprint dài nhất (6.890 ký tự prose, 13 dòng
capacity, 16 trade-off) nhưng sơ đồ chỉ là danh sách hộp nối với nhau — đúng
"thế hệ cũ" mà CLAUDE.md mô tả. Prose đã có sẵn cơ chế để đưa lên cạnh: điều
kiện `UPDATE … WHERE`, TTL của hold, ngưỡng admission control, tên MQ topic.

Ràng buộc khi sửa: nhãn **node** phải ≤ 41 ký tự (`htmlLabels:false` không
xuống dòng). Hiện `maxLabel` toàn bộ 20 sơ đồ đều ≤ 41 — đừng làm vỡ.

Sau khi sửa phải chạy `node tools/check.mjs --only diagrams` (xem mục 6 về
`jsdom`).

---

## 5. `flash-sale` thiếu peak/day trong `capacity`

19/20 blueprint viết capacity đúng dạng chuẩn `250 rps peak (1M req/day)`.
Riêng `flash-sale-booking-inventory-bottleneck` không có cặp peak/day nào trong
`capacity` — trong khi 13 dòng capacity là nhiều nhất bộ.

Sửa theo bảng bốn tier ở CLAUDE.md, đủ **cả hai** ngôn ngữ (`en` và `vi`).

---

## 6. Hai công cụ không chạy được vì thiếu package

Không phải lỗi nội dung, nhưng chặn việc kiểm tra ở hai mục trên:

```bash
npm i -D jsdom sharp
```

- thiếu `jsdom` → `node tools/check.mjs` **FAILED: diagrams** (stage này không
  chạy được; đã xác nhận fail y hệt trên `main` sạch, không phải do thay đổi nào
  gần đây). Cần có để kiểm mục 4.
- thiếu `sharp` → `node tools/optimize-images.mjs --check` không chạy. Đây là
  check duy nhất `check.mjs` không tự chạy hộ, và CLAUDE.md yêu cầu chạy trước
  khi push thay đổi ảnh.

---

## Đã kiểm, không cần làm gì

Ghi lại để lần sau không kiểm lại:

- **Song ngữ EN/VI**: `audit-content.mjs` báo `no drift`, không rò rỉ ngôn ngữ.
- **Thước đo bốn tier**: 19/20 blueprint có cả `peak` lẫn `/day` trong capacity
  (trừ flash-sale, mục 5). Bốn verdict EN (`not needed`/`worth it`/`mandatory`/
  `needs its own scaling story`) và bốn verdict VI (`không cần`/`nên có`/
  `bắt buộc`/`cần scale riêng`) dùng nhất quán, không có biến thể trôi.
- **`failure_review`**: đủ 5 câu ở cả 20/20 blueprint, cả hai ngôn ngữ.
- **Ghép production case ↔ case study**: khớp **hai chiều tuyệt đối** — 6 bài
  `systems-architecture` ↔ 6 `case_overviews`, không bài nào thiếu lens, không
  lens nào mồ côi.
- **Research packs**: 14 pack, phủ đủ 20/20 blueprint, không pack nào không
  được gán.
- **Link trong body lưu trữ**: không có link `http://` nào (36 file), không còn
  funnel tuyển dụng của publisher.
- **`cover_thumb`**: 6 row thiếu thumb đều là ảnh `.svg` — đúng quy tắc bỏ qua
  SVG, không phải thiếu sót.
- **Độ dày prose**: phân bố đều, không blueprint nào mỏng bất thường (thấp nhất
  `high-traffic-booking-search` 2.294 ký tự, cao nhất flash-sale 6.890).
- **`maxLabel` node trong sơ đồ**: cả 20 đều ≤ 41 ký tự.
- **Ba lệnh CI**: `build-content-index --check` và `stamp-content-dates --check`
  xanh; `check.mjs` xanh ở `content`, `syntax`, `console`, `tests` (chỉ
  `diagrams` fail vì thiếu `jsdom`, xem mục 6).
