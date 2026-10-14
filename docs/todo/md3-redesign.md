# MD3 redesign — whole site (branch `preview/md3`)

Trạng thái: **ĐANG LÀM** · bắt đầu 2026-10-14 · xoá file này khi branch đã merge
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
- [ ] 6 chuyển động: View Transitions, container query, empty/loading/error
- [ ] 7 dọn: xoá alias, viết lại DESIGN.md, test contrast theo role MD3

## Còn mở

- Hydration mismatch `NUXT_E1005` trên mọi trang (có từ trước, không còn làm trắng trang).
- Không dùng `@layer`: CSS của fshare-tool/course-registration không layer, sẽ thắng mọi xung đột và token `:root` của chúng đè lên header.
- `nuxt.config.ts` đang bật TẠM `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__` để tìm NUXT_E1005 — gỡ trước khi merge.
