# Viết lời giải: check key trong 10 triệu key, RAM 10MB

Trạng thái: **CHƯA BẮT ĐẦU** · tạo 2026-10-03 · xoá file này khi bài viết đã lên gazll.

Đề (đã chép text): `\\nas\99_Drives\OneDrive-minhtran0918\Workspace\2_tech\Job\interview\check-key-10-trieu-bloom-filter.md`
— phỏng vấn live coding HackerRank CodePair 2022-07-20. 10 triệu key cố định (100MB, file), server trả lời "key có tồn tại?",
đa số request là key **không** tồn tại, giới hạn 10MB RAM. Gợi ý: bits array + hash + sort.

## Dàn ý lời giải

- [ ] **Vì sao không nạp hết:** 100MB key > 10MB; HashSet còn tốn hơn (overhead object/pointer).
- [ ] **Bloom filter** cho nhánh "không tồn tại": m = 8·10⁶ byte = 64M bit cho n = 10⁷ → ~6.4 bit/key,
      k tối ưu ≈ (m/n)·ln2 ≈ 4 hàm hash, tỉ lệ dương tính giả ≈ (1−e^(−kn/m))^k ≈ 4.7%. Ghi công thức và tính số thật.
      "Không" là chắc chắn → trả lời ngay bằng RAM, không chạm đĩa.
- [ ] **Nhánh "có thể có":** file key **đã sort** trên đĩa + chỉ mục thưa trong RAM (ví dụ 1 key mỗi 4KB block ≈ 25k mục)
      → binary search trong RAM rồi đọc đúng 1 block để xác nhận. Đây là phần "sort" của gợi ý.
- [ ] Phương án thay thế để so: bitmap trực tiếp nếu key là số nguyên trong miền nhỏ; hash → bit array một hàm (= Bloom k=1);
      cuckoo filter / xor filter (ít bit/key hơn với cùng tỉ lệ lỗi); SSTable của LevelDB/RocksDB (Bloom + sparse index — đúng kiểu này).
- [ ] Code mẫu Java: `BitSet` + double hashing (`h1 + i·h2`, từ một murmur3 128-bit), build một lần lúc khởi động từ file.
- [ ] Độ phức tạp, ngân sách RAM chi tiết (filter 8MB + index ~1–2MB), chuyện key không đổi → không cần xoá (Bloom không xoá được).

## Đưa lên gazll

- [ ] Viết bài vào chỗ ghi chú kỹ thuật của gazll (cùng đợt `tech-job-migrate.md` §1), cập nhật mục đó.
