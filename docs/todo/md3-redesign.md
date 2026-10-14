# M3 Expressive redesign — whole site (branch `preview/md3`)

Trạng thái: **XONG TRÊN BRANCH — chờ chủ kho duyệt merge** · bắt đầu 2026-10-14 · xoá file này khi branch đã merge
vào `main`, deploy xanh và `DESIGN.md` đã viết lại theo MD3.

Chủ kho chốt (2026-10-14): **full Material Design 3** (không chỉ token), font
mới được (Roboto Flex + Roboto Mono, self-host), dark mode + tuỳ chọn đọc làm
luôn, ảnh chụp Playwright trong CI. Tiêu chuẩn chốt được ghi vào `DESIGN.md`.

## Cách kiểm tra (NAS không build được)

Push `preview/md3` → `preview-build.yml` đẩy bản build lên `build/preview/md3`
→ `git fetch origin build/preview/md3 && git archive FETCH_HEAD | tar -x -C <dir>`
→ `. ~/.cache/ms-playwright/env.sh && node tools/screenshots.mjs <dir> <out> --axe`.
Ảnh "trước" = chụp `https://gazll.github.io`. Phải NHÌN ảnh, không chỉ đọc log.

## Quyết định đã chốt

- Màu: `tools/md3-tokens.mjs`, seed `#0B6E4F`, SchemeTonalSpot; custom groups
  (indigo, teal, clay, brass, violet, slate[neutral], rose, steel) cũng TonalSpot
  — customColor() của MCU cho container neon. MCU 0.4.0 (mới nhất) nạp qua esbuild vì ESM của nó thiếu đuôi .js. Luôn dùng bản lib mới nhất.
- Dark: `prefers-color-scheme` trừ khi `<html data-theme>` đặt rõ.
- Token cũ (`--paper`, `--ink`, `--emerald`…) thành alias trỏ vào role MD3, nên
  không phải sửa 3.300 dòng một lúc; xoá alias ở phase 7.

## Phase

- [x] 0 hạ tầng: preview build, screenshots + axe, pr-check (merged trên branch)
- [x] 1 token: màu MD3 light/dark + alias, type scale, shape, motion, state
- [x] 2 font + chữ: self-host Roboto Flex/Mono, gom cỡ chữ, bỏ chữ < 11px, rem
- [x] 3 component: button, chip, card, top app bar, drawer, search, dialog, segmented
- [x] 4 dark mode: bỏ màu viết cứng, nút theme, Mermaid/DSA/code theo token
- [x] 5 đọc: breakout, progress bar, scrollspy TOC, xem trước link chéo, in ấn
- [x] 6 chuyển động: View Transitions, loading MD3, error-container (container query: chưa cần — ghi trong DESIGN.md)
- [x] 7 dọn: DESIGN.md viết lại theo MD3; token cũ GIỮ làm lớp app token (quyết định trong DESIGN.md); gỡ cờ hydration; data-ui + ?ui

## Còn mở

- [x] Hydration mismatch `NUXT_E1005`: href/aria-current dựng từ route.path có dấu / cuối trên Pages — sửa bằng routePath (9016ca6).
- Không dùng `@layer`: CSS của fshare-tool/course-registration không layer, sẽ thắng mọi xung đột và token `:root` của chúng đè lên header.
- [x] Vòng rà soát 2: bỏ 516 khai báo bị ghi đè (ảnh 72 shot giống từng byte) + class chết; zoom sơ đồ 44px trên mobile; `:target` đánh dấu thẻ khi mở link sâu; corner `<th>` rỗng → `td.corner`; code cuộn ngang focus được; tên cho nút icon-only trên mobile; listbox search; "offline" lặp; nút EN/VI tràn 3px. Axe sạch 12 route × 2 theme + drawer/search/thẻ mở ở 390px.
- [x] Vòng 3 — chuyển sang **M3 Expressive** (chủ kho chốt 2026-10-14: "apply full md3 của google"): màu spec 2025, shape morph, spring motion (bảng chuyển đổi web của Material), spacing 8px (I/O 2026), drawer → navigation rail mở rộng dạng modal, segmented → connected button group, pager → floating toolbar, menu/list Expressive, loading indicator đổi hình. Token lấy từ `androidx.compose.material3.tokens` (Material Web không có bản Expressive). Sửa kèm: drawer không đánh dấu trang hiện tại (aria-current "page" vs "true"); nút EN/VI trên thẻ tràn mép ở 390px.
