# NAS làm máy code từ xa (ttyd + tmux + Tailscale Funnel)

Mục tiêu: bật NAS → mở một trang web ở bất kỳ máy nào → có terminal vào tmux
(`claude` hoặc `codex`) → tắt NAS thì mọi thứ tắt theo. Không đánh thức ổ 14 TB / 8 TB.

## Thành phần

| Thứ | Ở đâu | Volume |
|---|---|---|
| `ttyd` 1.7.7 (web terminal) | `/volume1/0_System/project/home-nas/bin/ttyd` → `~/.local/bin/ttyd` | 1 |
| `tmux` | gói DiagnosisTool (`/var/packages/DiagnosisTool/target/tool/tmux`) | hệ thống |
| Tailscale 1.58 (Funnel) | gói Tailscale (`/volume1/@appstore/Tailscale`) | 1 |
| Repo + `~/.claude ~/.codex ~/.codegraph ~/.npm ~/.cache` | `/volume1/0_System/project/` | 1 |
| Home (`~/.claude.json`, `.bash_history`, `.profile`) | `/volume2/homes/nas` — **còn trên ổ 14 TB** | 2 ⚠ |

## 1. Script khởi động (chạy bằng user `nas`)

`/volume1/0_System/project/home-nas/bin/nas-terminal` — tạo sẵn hai tmux session và bật ttyd.
Chọn session bằng tham số URL: `https://nas.<tailnet>.ts.net/?arg=claude` hoặc `?arg=codex`.

```sh
#!/bin/sh
# nas-terminal start|stop
H=/volume1/0_System/project/home-nas
REPO=/volume1/0_System/project/gazll.github.io
TMUX=/var/packages/DiagnosisTool/target/tool/tmux
export PATH="/var/packages/Git/target/bin:$HOME/.local/bin:$PATH"
export HISTFILE=$H/.bash_history          # đừng ghi history lên /volume2/homes

case "$1" in
  stop)  pkill -x ttyd; $TMUX kill-server; exit 0 ;;
esac

umask 077
[ -s $H/ttyd.cred ] || echo "nas:$(head -c 30 /dev/urandom | base64 | tr -d '/+=' | cut -c1-24)" > $H/ttyd.cred

for s in claude codex; do
  $TMUX has-session -t $s 2>/dev/null || $TMUX new -d -s $s -c $REPO
done

# -W ghi được, -O chặn origin lạ, -a nhận ?arg=<session>, tối đa 2 client
pkill -x ttyd 2>/dev/null
nohup ttyd -p 7681 -i 127.0.0.1 -W -O -a --max-clients 2 -c "$(cat $H/ttyd.cred)" \
  -t fontSize=15 -t titleFixed=NAS \
  $H/bin/nas-attach > $H/ttyd.log 2>&1 &
echo "ttyd :7681 → tmux [claude|codex] — login $(cat $H/ttyd.cred)"
```

`/volume1/0_System/project/home-nas/bin/nas-attach`:

```sh
#!/bin/sh
exec /var/packages/DiagnosisTool/target/tool/tmux new -A -s "${1:-claude}" -c /volume1/0_System/project/gazll.github.io
```

`chmod 700` cả hai. `-i 127.0.0.1` để ttyd **không** nghe trên LAN/WAN — chỉ Tailscale mới với tới.

## 2. Tailscale Funnel (làm một lần, cần root)

1. Admin console <https://login.tailscale.com/admin/acls> → thêm vào policy:
   ```json
   "nodeAttrs": [{ "target": ["autogroup:member"], "attr": ["funnel"] }]
   ```
2. Trên NAS (SSH, `sudo -i`):
   ```sh
   TS=/var/packages/Tailscale/target/bin/tailscale
   $TS set --operator=nas          # user nas được điều khiển tailscale, khỏi sudo về sau
   $TS funnel --bg 7681            # https://nas.<tailnet>.ts.net → 127.0.0.1:7681
   $TS funnel status
   ```
   Cấu hình serve/funnel được lưu, **sống qua reboot**; gói Tailscale tự khởi động cùng DSM.
   Tắt khi không cần: `tailscale funnel --https=443 off` (hoặc `tailscale funnel reset`).
3. Chỉ dùng trong tailnet (iPad/laptop có Tailscale) mà không public: thay `funnel` bằng `serve`.

## 3. DSM Task Scheduler

Control Panel → Task Scheduler → Create → Triggered Task → User-defined script:
- Event **Boot-up**, user **nas**, script: `sh /volume1/0_System/project/home-nas/bin/nas-terminal start`
- (Không cần task shutdown — tắt NAS là process chết theo.)

Bật NAS từ xa: Hardware & Power → Power Schedule, hoặc WOL (`ether-wake`) từ máy cùng LAN.

## 4. Quy trình dùng

1. Mở `https://nas.<tailnet>.ts.net/?arg=claude` → nhập user/pass (`ttyd.cred`).
2. `claude-gazl` (alias: cd repo, `git pull`, chạy claude) → trong claude bật remote control như vẫn làm với `tmux-claude`.
3. Đóng tab web — tmux vẫn giữ claude chạy; code tiếp bằng Claude Code web.
4. Codex: `?arg=codex` → `codex-gazl`, gõ lệnh trực tiếp trong tab web.
5. Tab bị rớt mạng → mở lại URL là về đúng session (`tmux new -A`).

## 5. Không đánh thức ổ to

Đã đo (2026‑09‑17, 10 phút): repo + Claude/Codex trên volume1 → 3 ổ đều 0 read/0 write suốt 8 phút liền.
Còn lại các thứ **vẫn ghi lên `/volume2/homes/nas`** (ổ 14 TB):

- `~/.claude.json` — Claude Code ghi mỗi khi đổi trạng thái (thấy lúc 10:38).
- `~/.bash_history` — bash ghi khi thoát shell (script trên đã đổi `HISTFILE`).
- `.profile`/`.bashrc` chỉ đọc, không sao.

→ Chuyển User Home sang Volume 1 (Control Panel → User & Group → Advanced → User Home → Volume 1).
DSM **dừng mọi service** trong lúc chuyển (mất tmux/Tailscale/Claude vài phút) nên làm khi đang ngồi
cạnh máy hoặc có SSH LAN, không làm qua remote. Sau khi chuyển: `ls -la ~` xem symlink còn nguyên,
`git push` thử, `tailscale funnel status`.

Mấy thứ ghi hệ thống khác (log DSM, `thumbd`, `synoelasticd`) nằm trên phân vùng hệ thống mirror
cả 3 ổ — nếu `/var/log/hibernation.log` (đã bật) báo ổ thức mà không phải do ta, xem log đó để tìm tên process.

## An toàn

- Funnel = **public internet**. Lớp bảo vệ duy nhất là basic‑auth của ttyd → mật khẩu dài ngẫu nhiên
  (script sinh 24 ký tự), `--max-clients 2`, `-O`. Tắt Funnel khi không dùng dài ngày.
- ttyd chạy bằng user `nas`, không phải root; DSM admin vẫn cần đăng nhập riêng.
- Đừng bao giờ bind ttyd ra `0.0.0.0` hay mở port router — mật khẩu basic‑auth đi HTTP thuần.
