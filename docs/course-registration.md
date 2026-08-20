# NTT Course Registration Explorer

## 1. Mục tiêu

Xây dựng một web con hỗ trợ xem dữ liệu đăng ký học phần của sinh viên NTT:

1. Lấy danh sách môn đang chờ đăng ký.
2. Lấy danh sách học phần đã đăng ký.
3. Lấy danh sách lớp của một môn.
4. Lấy chi tiết lịch học và giảng viên của từng lớp.
5. Tự động retry khi hệ thống NTT chậm, timeout hoặc trả lỗi HTTP tạm thời.
6. Hiển thị kết quả trên web và cho phép xuất JSON.

Web được đặt tại đường dẫn:

```text
/course-registration/
```

Mục **Course Registration** cũng đã được thêm vào nhóm **Tool** trong menu chính.

## 2. Các API đang sử dụng

### 2.1. Danh sách môn chờ đăng ký

```http
POST /SinhVienDangKy/MonHocPhanChoDangKy
```

Form data:

```text
param[IDDotDangKy]
param[IDLoaiDangKy]
```

Kết quả được dùng để tạo dropdown chọn môn và cố gắng tự động xác định:

- Mã môn học (`MaMonHoc`).
- Danh sách học phần được học (`DSHocPhanDuocHoc`).
- Mã môn cha (`MaMonCha`) nếu response cung cấp.
- Các dòng/bảng HTML gốc đã được chuẩn hóa thành dữ liệu JSON.

Nếu cấu trúc HTML của NTT thay đổi khiến parser không nhận diện được môn, người dùng vẫn có thể nhập các tham số trên bằng tay.

### 2.2. Học phần đã đăng ký

```http
POST /SinhVienDangKy/HocPhanDaDangKy
```

Form data:

```text
param[IDDotDangKy]
param[IDLoaiDangKy]
```

Response HTML được đọc dưới dạng bảng động. Header và số lượng cột không bị hard-code, nhằm hạn chế lỗi khi giao diện NTT thay đổi.

### 2.3. Danh sách lớp của môn

```http
POST /SinhVienDangKy/LopHocPhanChoDangKy
```

Form data:

```text
param[IDDotDangKy]
param[MaMonHoc]
param[DSHocPhanDuocHoc]
param[IsLHPKhongTrungLich]
param[LoaiDKHP]
param[MaMonCha]
```

Parser tìm thuộc tính `data-guidlhp` trong response. Mỗi GUID đại diện cho một lớp và được dùng để gọi API chi tiết.

Dữ liệu tóm tắt được tách gồm:

- GUID lớp.
- Mã lớp học phần.
- Khóa/lớp sinh viên.
- Tên môn.
- Trạng thái lớp.
- Sĩ số hiện tại và sĩ số tối đa.

Không có lớp trong response được xem là kết quả hợp lệ `0 lớp`, không phải lỗi parser.

### 2.4. Chi tiết từng lớp

```http
POST /SinhVienDangKy/ChiTietLopHocPhanChoDangKy
```

Form data:

```text
param[GuidIDLopHocPhan]
param[MaMonCha]
```

Parser chi tiết tách riêng:

- Loại lịch học: lý thuyết hoặc thực hành (`LT`/`TH`).
- Thứ học.
- Tiết bắt đầu và kết thúc.
- Cơ sở.
- Dãy nhà.
- Phòng.
- Nhóm thực hành.
- Tên giảng viên.
- Ngày bắt đầu và kết thúc.
- Sĩ số hiện tại và tối đa của từng nhóm.

Tên giảng viên được tách khỏi chuỗi ngày tháng và sĩ số. Parser đã được đối chiếu với file dữ liệu thực tế, nhận đủ 21/21 mã lớp và 28/28 dòng giảng viên trong mẫu kiểm tra.

Ngoài bảng lịch học, response chi tiết còn có các cảnh báo dạng `<p>` nằm **ngoài**
`<table>`, ví dụ:

```html
<p class="bold" lang="ctlhpchodangky-lhpcochianhom">Lớp học phần có chia nhóm
thực hành, vui lòng chọn lịch có nhóm.</p>
```

Bảng chi tiết còn mang dữ liệu trong thuộc tính mà bản parse cũ bỏ qua:

- `data-nhomth` — số nhóm thực hành, **là nguồn chuẩn**. Ô số trong bảng chỉ dùng
  làm fallback, vì dòng LT có ô nhóm rỗng và `directCells` loại bỏ ô rỗng.
- `data-chonnhom` — lớp có bắt buộc chọn nhóm hay không.
- `data-guididdk` — GUID dùng khi đăng ký.
- `<thead>` chứa `Trạng thái` (ví dụ `Mở lớp`) và `Sĩ số tối đa` của cả lớp;
  `parseDetailHeader` tách riêng hai giá trị này.

Đã kiểm tra với mẫu HTML thật: 4/4 dòng parse đúng (1 dòng LT không nhóm, 3 dòng
TH nhóm 1/2/3 với sĩ số riêng), trạng thái `Mở lớp`, sĩ số tối đa 100. Thực thể
HTML (`Đ&#224;o` → `Đào`) được `textContent` giải mã sẵn.

`parseDetail` chỉ duyệt `<tr>/<td>` nên trước đây bỏ sót hoàn toàn phần này.
`parseNotes` bắt riêng các `<p>` đó và gắn vào `class.notes`, hiển thị thành
banner cảnh báo trên card lớp. Khóa nhận diện là thuộc tính `lang` (ổn định),
không dựa vào `style="color:red"`. Một `<p>` khớp cả ba selector nên kết quả
được dedupe theo nội dung.

## 3. Luồng hoạt động

Khi người dùng chọn **Load registration data**, web thực hiện tuần tự:

```text
Danh sách môn chờ đăng ký
        ↓
Học phần đã đăng ký
        ↓
Danh sách lớp của môn đang chọn
        ↓
Chi tiết từng lớp (chạy song song có giới hạn)
        ↓
Hiển thị kết quả và xuất JSON
```

Ngoài luồng đầy đủ, nút **Load available courses** cho phép chỉ tải danh sách môn để chọn trước khi crawl.

## 4. Bridge và bảo mật

GitHub Pages là website tĩnh và chạy khác origin với `phongdaotao.ntt.edu.vn`. Vì vậy web không thể trực tiếp đọc response API NTT bằng cookie đăng nhập do giới hạn CORS của trình duyệt.

Giải pháp được triển khai là một bookmarklet bridge:

1. Người dùng kéo nút **NTT Course Explorer** lên bookmarks bar.
2. Người dùng đăng nhập và mở trang đăng ký học phần NTT.
3. Người dùng bấm bookmarklet trên tab NTT.
4. Bookmarklet mở web `/course-registration/` và giữ một bridge trong tab NTT.
5. Web gửi yêu cầu qua `postMessage`.
6. Bridge gọi API từ chính origin NTT bằng session hiện tại.
7. Bridge trả HTML response về web để parse.

Các biện pháp bảo mật:

- Không yêu cầu nhập cookie, token hoặc `ASP.NET_SessionId`.
- Không đọc cookie bằng JavaScript.
- Không lưu credential vào source code, repository hoặc `localStorage`.
- Không gửi cookie sang GitHub Pages, Google Apps Script hay backend khác.
- Bridge chỉ chấp nhận đúng origin của web đã mở.
- Web chỉ chấp nhận message từ `https://phongdaotao.ntt.edu.vn` và đúng cửa sổ opener.
- Mỗi phiên bridge sử dụng channel UUID riêng.
- Bridge chỉ cho gọi bốn endpoint NTT nằm trong allowlist.
- Request body bị giới hạn kích thước.
- HTML từ NTT chỉ được đọc bằng `DOMParser`; dữ liệu bên ngoài được render bằng `textContent`, không chèn trực tiếp bằng `innerHTML`.
- Web có Content Security Policy và `no-referrer`.
- Không ghi dữ liệu runtime ra console trong mã thuộc `public/`.

Nếu bookmarklet không chạy do chính sách trình duyệt, nút **Copy bridge script** cho phép sao chép script để lưu thủ công làm URL của bookmark.

Channel UUID được lưu trong `sessionStorage` (chỉ trong tab đó, xoá khi đóng tab)
nên reload trang explorer không làm mất bridge. Trước đây hash `#bridge=` bị xoá
ngay khi load, nên chỉ cần reload là bridge đứt và mọi request chi tiết rơi vào
vòng retry vô ích.

Lỗi "bridge không kết nối" được đánh dấu `permanent` + `fatal`: đây là lỗi trạng
thái kết nối, retry không bao giờ cứu được, nên crawler dừng ngay thay vì thử lại
từng lớp.

## 5. Retry, timeout và giới hạn tải

Tất cả API sử dụng chung cơ chế retry.

Các trường hợp được retry:

- HTTP `408 Request Timeout`.
- HTTP `425 Too Early`.
- HTTP `429 Too Many Requests`.
- Toàn bộ lỗi HTTP `5xx`, bao gồm `520`, `502`, `503` và `504`.
- Lỗi mạng.
- Request timeout.
- Bridge không phản hồi kịp thời.

Cơ chế chờ giữa các lần gọi:

- Exponential backoff.
- Thêm jitter để các request không retry đồng loạt.
- Tôn trọng header `Retry-After` nếu server cung cấp.
- Thời gian chờ tối đa giữa hai lần retry là 30 giây.

Cấu hình mặc định trên giao diện:

- Tối đa 5 lần thử cho mỗi request.
- Có thể cấu hình từ 1 đến 10 lần.
- Mặc định 2 request chi tiết chạy song song.
- Cho phép tối đa 4 request song song.
- Timeout API trong bridge là 45 giây.
- Timeout chờ phản hồi bridge là 52 giây.
- Có khoảng nghỉ 250 ms giữa hai lớp trong cùng worker.

Lỗi xác thực/session hết hạn không được retry. Khi phát hiện trang đăng nhập trong response, crawler dừng để tránh gửi thêm request không cần thiết.

Việc nhận diện trang đăng nhập chỉ dựa vào markup form thật (`<input type=password>`
hoặc `<form action=".../dang-nhap|login">`). Trước đây parser bắt cả chuỗi
`dang-nhap` ở bất kỳ đâu, mà menu NTT luôn có link `/dang-nhap.html`, nên response
chi tiết hợp lệ bị hiểu nhầm là hết phiên và crawl dừng oan.

Các lớp tải chi tiết thất bại vẫn được giữ trong kết quả với trường `error`. Nút **Retry failed requests** cho phép gọi lại:

- Danh sách môn nếu bước này lỗi.
- Học phần đã đăng ký nếu bước này lỗi.
- Chi tiết các lớp bị lỗi.

Nút **Stop** ngừng xếp thêm request và chờ các request đang chạy hoàn tất.

## 6. Giao diện

Web hiện cung cấp:

- Trạng thái kết nối bridge.
- Hướng dẫn cài bookmarklet.
- Dropdown danh sách môn chờ đăng ký.
- Form nhập/fallback cho các tham số API.
- Tick box **Hide classes that clash with my timetable** (`IsLHPKhongTrungLich`):
  bật để chỉ lấy lớp không trùng lịch, tắt để lấy toàn bộ lớp kể cả lớp trùng.
- Điều chỉnh concurrency và số lần retry.
- Thanh tiến trình tổng, **ghim (sticky) ngay dưới header** và nằm trên cùng
  của `<main>`, nên khi cuộn xuống xem danh sách lớp vẫn thấy tiến độ. Offset
  dùng biến `--topbar-h` được đo bằng `ResizeObserver` lúc chạy, vì header cao
  thêm một dòng ở màn hình ≤ 760px; giá trị dự phòng trong CSS (`76px`) khớp
  đúng `min-height` của `.topbar`. `z-index` của card là 4 — dưới header (5) và
  dưới toast (10). Lưu ý: `main`/`body` không được đặt `overflow`, nếu không
  `position: sticky` sẽ mất tác dụng.
- Thanh tiến trình riêng cho bước tải chi tiết lớp: số lớp xong / lỗi / còn lại,
  phần trăm và tên lớp đang gọi. Panel này không bị message retry ghi đè, nên
  luôn thấy được đã chạy tới đâu.
- Thống kê số môn, học phần đã đăng ký, lớp, giảng viên, lịch học và lỗi.
- Ba tab kết quả: **Available classes** (mặc định), **My enrolled classes** và
  **Registered courses**. Học phần đã đăng ký ít thay đổi nên được tách sang tab
  riêng, kèm nút **Refresh registered** gọi lại một mình API đó mà không phải
  crawl lại.
- Thanh **freshness** trên tab Available classes: hiện dữ liệu chi tiết lấy lúc
  nào (`x min ago` + giờ cụ thể) và nút **Refresh class details** để gọi lại
  toàn bộ chi tiết khi cần. Sĩ số thay đổi chậm nên mặc định không tự gọi lại;
  nhãn chuyển màu cảnh báo khi dữ liệu quá 15 phút.
- Cảnh báo gốc của NTT trong mỗi lớp (ví dụ "Lớp học phần có chia nhóm thực hành,
  vui lòng chọn lịch có nhóm") được hiển thị ngay trên card lớp đó.
- Danh sách lớp và lịch học chi tiết.
- Retry các request thất bại.
- Dừng crawl.
- Xuất kết quả JSON.

Giao diện của tool này dùng **tiếng Việt**, là ngoại lệ có chủ ý so với quy ước
"UI luôn tiếng Anh" của study site (đã ghi trong `CLAUDE.md`). Lý do: tool phản
ánh một hệ thống nguồn tiếng Việt, nên từ ngữ lấy đúng theo web NTT gốc, dựa vào
các thuộc tính `lang="dkhp-*"` trong markup của NTT:

| `lang`                          | Nhãn dùng trong tool |
| ------------------------------- | -------------------- |
| `dkhp-lichhoc`                  | Lịch học             |
| `dkhp-coso`                     | Cơ sở                |
| `dkhp-daynha`                   | Dãy nhà              |
| `dkhp-phong`                    | Phòng                |
| `dkhp-nhom`                     | Nhóm                 |
| `dkhp-gv`                       | GV                   |
| `siso-nhom` / `dkhp-sisomax`    | Sĩ số / Sĩ số tối đa |
| `dkhp-trangthai`                | Trạng thái           |
| `ctlhpchodangky-tabletitle`     | Chi tiết lớp học phần |

Ngoại lệ này chỉ áp dụng cho `public/course-registration/`.

Giao diện dùng tone sáng (nền trắng). Toàn bộ màu khai báo bằng CSS custom
property ở `:root`, kèm `--hairline`/`--tint` thay cho các lớp phủ
`rgba(255,255,255,…)` của theme tối cũ — các lớp phủ trắng đó vô hình trên nền
trắng. Mọi cặp màu chữ/nền đã được kiểm tra đạt WCAG AA (≥ 4.5:1).

Tab **My enrolled classes** đối chiếu `classCode` của các lớp đã tải với nội dung
bảng học phần đã đăng ký — bảng đó là nguồn đáng tin, thay vì đoán theo chữ
trong cột trạng thái. Lớp không có `classCode` không bao giờ được match.

## 7. Cấu trúc JSON xuất ra

Tên file:

```text
ntt-classes-{MaMonHoc}.json
```

Cấu trúc cấp cao:

```json
{
  "generatedAt": "ISO-8601 timestamp",
  "query": {},
  "availableCourses": {
    "tables": [],
    "rowCount": 0,
    "courses": [],
    "message": "",
    "error": ""
  },
  "registered": {
    "tables": [],
    "rowCount": 0,
    "message": "",
    "error": ""
  },
  "teachers": [],
  "classes": []
}
```

Mỗi phần tử `classes` chứa dữ liệu tóm tắt lớp, danh sách giảng viên, các buổi học đã parse, các dòng chi tiết gốc đã chuẩn hóa và lỗi cuối cùng nếu request thất bại.

## 8. Các file đã tạo hoặc thay đổi

### Web chính

- `app/pages/course-registration.vue`: route Nuxt, metadata và CSP của công cụ.
- `public/shells/course-registration.html`: cấu trúc giao diện, form và kết quả phía client.
- `public/course-registration/style.css`: giao diện responsive cho desktop/mobile.
- `public/course-registration/app.js`: bridge, API transport, retry, parser, render và export.
- `public/app.js`: thêm liên kết **Course Registration** vào menu Tool.

### Công cụ thử nghiệm ban đầu

- `tools/ntt-teachers-console.js`: script chạy trực tiếp trong Chrome DevTools trên trang NTT; lấy danh sách lớp, gọi chi tiết, retry và xuất JSON.

Script DevTools không chứa cookie hard-code và vẫn có thể dùng làm phương án chẩn đoán/fallback độc lập với web.

## 9. Kiểm tra đã thực hiện

- Kiểm tra cú pháp JavaScript bằng `node --check`.
- Kiểm tra whitespace/diff bằng `git diff --check`.
- Quét mã web để bảo đảm không chứa cookie/token đã từng dùng thử.
- Quét và bảo đảm không có runtime `console.*` trong web public.
- Chạy các regression test bảo mật và asset versioning của dự án.
- Trước khi thêm API danh sách môn, toàn bộ 67 regression test hiện có đã pass.
- Sau các thay đổi API gần nhất, nhóm test bảo mật và deployment liên quan tiếp tục pass.

## 10. Hạn chế và hướng phát triển

- Parser danh sách môn sử dụng nhiều dấu hiệu như data attribute, mã môn 6 chữ số và mã học phần 10 chữ số. Nếu NTT thay đổi hoàn toàn HTML, dropdown có thể không tự nhận diện được; form nhập tay vẫn hoạt động và JSON vẫn giữ các bảng đã parse để chẩn đoán.
- Bridge phụ thuộc tab NTT còn mở và còn đăng nhập.
- Bookmarklet có thể bị hạn chế bởi chính sách riêng của một số trình duyệt; có thể dùng DevTools snippet làm fallback.
- Crawler hiện chỉ đọc dữ liệu, chưa thực hiện thao tác đăng ký hoặc hủy học phần.
- Chưa có parser theo schema cố định cho bảng học phần đã đăng ký vì response thực tế có thể thay đổi số cột; hiện tại bảng được giữ ở dạng động.
- Khi có response HTML/JSON mới, nên bổ sung fixture đã loại bỏ dữ liệu cá nhân và unit test riêng cho từng parser.

## 11. Lưu ý vận hành

- Không chia sẻ cookie đăng nhập hoặc file JSON chứa dữ liệu cá nhân công khai.
- Nếu cookie từng bị gửi vào chat/log, nên đăng xuất rồi đăng nhập lại để vô hiệu hóa phiên cũ.
- Giữ concurrency thấp, ưu tiên giá trị mặc định 2 vì server NTT phản hồi chậm và từng trả lỗi `520`/`503`.
- Không tăng số lần retry và concurrency cùng lúc nếu server đang có dấu hiệu quá tải.
