# Keys playbook — một passphrase chủ, mỗi bề mặt một key

Repo này public: mọi file dưới `public/data/` ai cũng `GET` được. Dữ liệu
riêng (lịch, mục Gazl Try theo công ty, catalog phim, X) vì vậy chỉ lên git
dưới dạng **ciphertext**; bản gốc nằm trong `secret/` (gitignored, mode 700).
File này là chủ sở hữu duy nhất của cơ chế key; các playbook khác trỏ về đây.

## Mô hình

```
secret/app.key  (hoặc env GAZLL_KEY)          ← passphrase CHỦ — thứ duy nhất bạn nhớ
        │ mở
        ▼
public/data/keyring.enc.json                  ← mỗi scope một key ngẫu nhiên ~129 bit
        │ schedule · interviews · fshare · x
        ▼
public/data/schedule/private.enc.json         ← scope schedule
public/data/interviews/private.enc.json       ← scope interviews
public/data/fshare-movie/catalog.enc.json     ← scope fshare
public/data/fshare-x/catalog.enc.json         ← scope x
```

- **Bạn** gõ passphrase chủ một lần (máy: `secret/app.key`; trình duyệt: ô
  passphrase, "Nhớ trên thiết bị này" nếu muốn). Mọi trang mở được hết.
- **Người khác** không bao giờ thấy passphrase chủ. Cấp quyền theo **scope**
  trong sheet `access`; họ đăng nhập Google và backend đưa đúng key của scope
  đó. Gia đình được `schedule` thì **không** mở được `fshare`.
- Mã hoá: AES-256-GCM, khoá dẫn xuất bằng PBKDF2-SHA-256 **600.000 vòng**
  (con số OWASP hiện hành). Trang chỉ chấp nhận đúng các profile site từng
  ghi, nên file bị sửa số vòng sẽ bị từ chối.

## Sang máy khác

1. Clone repo.
2. Tạo `secret/app.key` — một dòng, đúng passphrase chủ — rồi `chmod 600`.
   (Hoặc `export GAZLL_KEY=…` cho một phiên.)
3. Lấy lại bản gốc từ ciphertext khi cần sửa:
   `node tools/schedule-seal.mjs unseal`, `node tools/interview-seal.mjs unseal`.
   Catalog phim/X thì envelope chỉ là **projection** đã rút gọn, không phải
   catalog làm việc đầy đủ — catalog thật vẫn sống ở `secret/fshare-*` trên NAS.

Không cần sao lưu gì khác: keyring nằm trong git, passphrase chủ mở được nó.

## Lệnh

| Việc | Lệnh |
|---|---|
| tạo key cho scope mới / lần đầu | `node tools/keyring.mjs init` |
| chuyển envelope cũ (seal thẳng bằng master) sang key scope | `node tools/keyring.mjs migrate` |
| xem envelope nào mở bằng key nào | `node tools/keyring.mjs status` |
| in key một scope để cài lên backend | `node tools/keyring.mjs show schedule` |
| thu hồi một scope (đổi key, seal lại file đó) | `node tools/keyring.mjs rotate schedule` |
| đổi passphrase chủ (chỉ seal lại keyring) | `node tools/rekey.mjs` hoặc `--generate` |
| seal lại tất cả ở KDF hiện hành, giữ nguyên key | `node tools/rekey.mjs --same` |

`rekey` từ chối passphrase chủ dưới 20 ký tự. `--generate` sinh ~129 bit và in
**một lần** — chạy nó trong terminal riêng, không qua công cụ ghi lại output.

## Lỡ quên passphrase chủ

1. **Tìm lại trước:** `secret/app.key` trên NAS chính là passphrase chủ;
   password manager là bản thứ hai. Còn một trong hai thì không mất gì.
2. **Mất cả hai, nhưng `secret/` còn bản gốc:** đặt passphrase chủ mới vào
   `secret/app.key` (dài ≥ 20 ký tự), chạy `node tools/keyring.mjs reset --force`
   — tạo keyring mới với key scope mới — rồi seal lại từng bề mặt từ `secret/`
   (`schedule-seal seal`, `interview-seal seal`, `fshare-movie seal`,
   `fshare-x seal`), commit keyring cùng mọi envelope, và cài lại
   `KEY_<SCOPE>` cho scope đang chia sẻ. `reset` từ chối chạy khi passphrase
   hiện tại vẫn mở được keyring.
3. **Mất passphrase lẫn `secret/`:** chỉ scope đang chia sẻ còn cứu được — key
   của nó nằm trong Script Properties (`KEY_SCHEDULE`), mở bằng
   `node -e` + `unseal` hoặc đăng nhập tài khoản được cấp. Scope chỉ-chủ
   (`interviews`, `fshare`, `x`) mất hẳn: không có cửa sau, đó là cái giá của
   "chỉ mình mở được".

`secret/` không được sao lưu tự động. Muốn trường hợp 3 không xảy ra, sao lưu
`secret/schedule.json` và `secret/interviews.json` ra chỗ riêng tư (không phải
git, không phải Sheet chia sẻ).

## Chia sẻ một scope qua đăng nhập

1. `node tools/keyring.mjs show schedule` → copy key.
2. Sheet: menu **gazl → Cài key cho một scope** → scope `schedule`, dán key.
   Key nằm trong Script Property `KEY_SCHEDULE`, không bao giờ trong ô Sheet.
   Scope không cài key = **chỉ chủ** (backend không có gì để đưa). `fshare` và
   `x` cố ý để trống.
3. Sheet `access`: một dòng `email · scope · name · note · granted_at`. `scope`
   là `schedule`, `interviews`, `fshare`, `x`, hoặc `*`. Admin trong
   `profiles` luôn được.
4. Deploy → Manage deployments → **New version**.

Lần đầu chuyển sang mô hình này: menu **gazl → Chuyển schedule_access sang
access** chép các dòng cũ thành scope `schedule`; **Kiểm tra các key** báo nếu
`SCHEDULE_KEY` cũ còn — nó chứa passphrase **chủ**, phải xoá trong Project
Settings → Script Properties. Trong lúc chưa redeploy, trang vẫn gọi
`schedule.key` cũ nên gia đình không bị khoá ngoài.

## Giới hạn phải nói thẳng

- **Thu hồi là mềm.** Key phải tới trình duyệt mới giải mã được, nên người đã
  được cấp có thể giữ lại. Xoá dòng `access` chặn lần đưa key sau; muốn chắc
  thì `rotate` scope đó.
- **Lịch sử git không rút lại được.** Mọi phiên bản envelope và keyring cũ vẫn
  nằm trong git, mở được bằng key/passphrase của thời đó. Đổi key chỉ bảo vệ
  từ nay về sau — vì vậy passphrase chủ phải mạnh ngay từ đầu, và giữ cả
  passphrase cũ trong password manager (nó mở các commit cũ).
- **Không đưa `GAZLL_KEY` lên GitHub Secrets.** CI không seal, không mở
  envelope nào (bản gốc không có trong repo), nên nó không cần key. Một bản
  passphrase chủ trên GitHub là thêm một nơi có thể lộ — mọi workflow, mọi
  action bên thứ ba trong pipeline đều chạy cạnh nó — mà không đổi lại gì.
