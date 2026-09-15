# TODO: crawl thuviencine.uk

Trạng thái hiện tại: đã có crawler và test parser; chưa chạy crawl toàn bộ
6.000+ trang để tránh tạo request lớn trong session này.

## Đã hoàn thành

- Đọc 7 post-sitemap từ sitemap index, không đệ quy nhầm các link phim liên quan.
- Mỗi post lấy các link cùng site dạng /download?id=....
- Mỗi trang download lấy và canonicalise mọi link Fshare file/folder.
- Có retry, timeout, giới hạn tốc độ, checkpoint/resume và báo cáo lỗi.
- Output là raw text tương thích với tools/fshare-movie.mjs; manifest được đăng ký tự động.

## Session kế tiếp

1. Chạy crawl toàn bộ:

   npm run crawl:thuviencine

2. Nếu report còn lỗi, chạy lại cùng lệnh để retry checkpoint; chỉ tiếp tục khi
   movieFailures và downloadFailures đều bằng 0.
3. Build database:

   node tools/fshare-movie.mjs build

4. Validate toàn bộ link pending, không bỏ qua folder:

   node tools/fshare-movie.mjs validate --only pending --concurrency 4

5. Kiểm tra pending 0, chạy seal và --check, sau đó test, commit và push.
6. Kiểm tra trên màn hình search: kết quả file vẫn sort size tăng dần.

State/report/raw nằm trong secret/ và không commit; chỉ sealed catalog trong
public/data/fshare-movie/catalog.enc.json được publish.

## Kinh nghiệm từ lần chạy mẫu

Lần chạy 3 URL đã hoàn tất với 3 trang phim, 3 trang download, 4
association Fshare, 4 link unique và 0 lỗi. Một số lưu ý để full crawl nhanh
và ổn định hơn:

- Sitemap của site trả loc dạng http dù site truy cập bằng https; phải so hostname
  rồi chuẩn hoá về HTTPS, không so origin cả protocol.
- Không đệ quy mọi link trong trang phim vì trang có danh sách phim liên quan;
  post-sitemap là nguồn URL chính xác và tránh bùng nổ số request.
- Chạy hai phase bounded-concurrency: fetch movie pages trước, dedupe download
  URL rồi fetch mỗi trang download một lần. Đây là điểm tiết kiệm lớn nhất.
- Giữ state checkpoint ngoài raw; lần chạy sau bỏ qua trang đã thành công và chỉ
  retry URL lỗi. Có thể tăng concurrency từng bước, nhưng hạ xuống khi gặp
  429/5xx thay vì tắt retry hoặc chạy vô hạn song song.
- Chỉ build database sau khi report có movieFailures = 0 và downloadFailures = 0;
  sau đó validate Fshare là phase riêng vì đây là các request chậm hơn.
