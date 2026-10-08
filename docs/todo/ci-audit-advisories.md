# Deploy đỏ vì `audit-gate` — advisory của dependency (2026-10-03 → 10-08)

Trạng thái: **ĐANG MỞ** · xoá file này khi `braces` có bản vá, mục allowlist đã
gỡ, và một deploy xanh đã đưa `version.json` lên commit mới.

## Vấn đề

- Run #198 (2026-10-03) trở đi đều đỏ (#198–#202), site đứng ở `4372a92`
  (deploy 2026-10-02) nên catalog mới chưa lên.
- Không phải do commit nào: `tools/audit-gate.mjs` chạy đầu workflow và chặn khi
  có advisory high/critical ở dependency production. Cơ sở dữ liệu advisory đổi,
  code thì không. 9 advisory mới: `simple-git` (+ `@simple-git/argv-parser`),
  `shell-quote`, `@vue/server-renderer`, `braces`, `seroval`, `source-map-js`.
- Phần lớn là package con của Nuxt, chỉ chạy lúc build/dev, không có trong site
  prerender. Gate vẫn tính vì nó audit toàn bộ `--omit=dev`.

## Đã giải quyết

- `npm audit fix`: `@vue/server-renderer`, `seroval`, `shell-quote`, `source-map-js`.
- `overrides: { "simple-git": "^4.0.2" }` trong `package.json`:
  `@nuxt/devtools` vẫn kéo 3.x (dính lỗi), 4.0.2 đã vá.
- Nuxt `4.5.2` → `4.6.0` (ghim cứng; `npm update` không tự lên được).
- `braces` (GHSA-vfj7-8cjw-p6xm): **chưa có bản vá** (3.0.3 là mới nhất, 2024).
  Chuỗi `nuxt → nitropack → globby → micromatch → braces`; `micromatch` 4.0.8 và
  `fast-glob` 3.3.3 đã là bản mới nhất, nên không ép được. Thêm vào `ALLOWED` của
  `audit-gate.mjs` đến **2026-11-01**, cùng kỳ hạn với `node-forge`. Lý do: chỉ
  mở glob do build tự viết, không có input lúc request.

## Còn lại

- Xác nhận run CI sau commit này xanh và `https://gazll.github.io/version.json`
  mang đúng commit. Nuxt 4.6.0 **chưa từng được build** trước đó.
- **NAS không build được site**: `npm run generate` segfault (exit 139) sau
  "Generating types", cả trên 4.5.2 lẫn 4.6.0 (kernel 4.4). Build kiểm tra phải
  chạy trên laptop hoặc CI; `check.mjs` thì chạy được trên NAS.
- Khi `braces` ra bản vá (theo dõi `micromatch/braces#70`) hoặc nitropack bỏ nó:
  nâng, rồi **xoá mục `GHSA-vfj7-8cjw-p6xm` khỏi `ALLOWED`**. Mục hết hạn
  2026-11-01 sẽ làm gate đỏ lại để nhắc; hết hạn mà chưa có bản vá thì đánh giá
  lại rủi ro rồi gia hạn, không gia hạn mù.
- Nên bỏ ghim cứng `nuxt` (hoặc lên lịch nâng định kỳ) để các lần sau không phải
  dò tay: advisory mới có thể làm CI đỏ bất cứ lúc nào mà không ai đổi gì.
