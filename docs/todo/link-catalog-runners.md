# Gom runner của link catalog về repo này

Mở 2026-10-15. Xoá file này khi xong.

## Vì sao

Việc vận hành catalog phim đang nằm ở hai nơi:

- **Repo này** giữ code (`tools/fshare-movie.mjs`, `crawl-telegram.mjs`,
  `crawl-thuviencine.mjs`), quy tắc (`docs/fshare-movie-playbook.md`), dữ
  liệu (`secret/fshare-movie/`) và bước seal/commit.
- **Vault** `0_personal-vault/nas-operations/link-catalog/` giữ các shell
  runner gọi lại tool ở trên, cùng log từng lần chạy (`runs/`).

Hai nơi cùng ghi cách chạy, nên đã lệch nhau. Ví dụ, "validate tới khi ba
cửa về 0 rồi categorize → move-to-x → audit" có trong playbook và có một
bản riêng trong `telegram-weekly.sh`. Chủ kho muốn chỉ một nơi chịu trách
nhiệm.

## Việc

1. Đưa `crawl/telegram/telegram-weekly.sh` và `validate/fshare/validate-all.sh`
   vào `tools/` dưới dạng một runner có tham số, ví dụ `tools/fshare-run.sh
   telegram|validate-all|add`. Runner có `set -e`, ghi mốc bước vào log, và
   không bao giờ seal.
2. Log ghi vào `/volume1/0_System/nas-state/link-catalog/runs/YYYYMMDD_<việc>/`.
   Log không vào git của repo nào.
3. Thay mục "Chạy dài trên NAS" của playbook bằng lệnh của runner, rồi bỏ bản
   wrapper chép tay trong đó.
4. Bên vault:
   - `link-catalog/README.md` chỉ còn một đoạn trỏ sang playbook.
   - `run-validate-all.sh`, `monitor-fshare-validation.sh` (bản shard 2026-09-27)
     và `history/` chuyển sang `#recycle`, hoặc để nguyên làm lịch sử. Không `rm`.
   - `runs/` cũ: chuyển sang nas-state cùng các run mới.
   - Vault còn hai commit chưa push: push hoặc xử lý chúng trước khi sửa.
5. `movie-library/` (vault) chỉ dùng catalog, không quản lý nó, nên giữ nguyên.
   Thêm một dòng ghi rõ điều đó.
