# NAS làm máy code từ xa (ttyd + tmux + Tailscale Funnel)

Mục tiêu: bật NAS → mở một trang web ở bất kỳ máy nào → có terminal vào tmux
(`claude` hoặc `codex`) → tắt NAS thì mọi thứ tắt theo. Không đánh thức ổ 14 TB / 8 TB.

`/volume1/0_System/project/` chứa nhiều project, nên tmux mở ở **thư mục cha** đó; vào project nào
thì `p <tên>` / `claude-project <tên>` / `codex-project <tên>` (hàm trong `~/.profile`, có Tab completion). Mỗi project Claude hỏi trust một lần.

## Thành phần

| Thứ | Ở đâu | Volume |
|---|---|---|
| `ttyd` 1.7.7 (web terminal) | `/volume1/0_System/project/home-nas/bin/ttyd` → `~/.local/bin/ttyd` | 1 |
| `tmux` | gói DiagnosisTool (`/var/packages/DiagnosisTool/target/tool/tmux`) | hệ thống |
| Tailscale ≥1.102 (Funnel) — cài spk từ pkgs.tailscale.com, bản Package Center 1.58 lỗi ingress | gói Tailscale (`/volume1/@appstore/Tailscale`) | 1 |
| Repo + `~/.claude ~/.codex ~/.codegraph ~/.npm ~/.cache` | `/volume1/0_System/project/` | 1 |
| Home (`~/.claude.json`, `.bash_history`, `.profile`) | `/volume2/homes/nas` — **còn trên ổ 14 TB** | 2 ⚠ |

## 1. Script khởi động (chạy bằng user `nas`)

`/volume1/0_System/project/home-nas/bin/nas-terminal` — tạo sẵn hai tmux session và bật ttyd.
Chọn session bằng tham số URL: `https://nas.<tailnet>.ts.net/?arg=claude` hoặc `?arg=codex`.

```sh
#!/bin/sh
# nas-terminal start|stop
H=/volume1/0_System/project/home-nas
PROJ=/volume1/0_System/project
# Task Scheduler starts this with no HOME/USER; git and every dotfile need them.
export HOME=/var/services/homes/nas USER=nas LOGNAME=nas
TMUX=/var/packages/DiagnosisTool/target/tool/tmux
TS=/var/packages/Tailscale/target/bin/tailscale
export PATH="$H/bin:/var/packages/Git/target/bin:$HOME/.local/bin:$PATH"
export HISTFILE=$H/.bash_history          # đừng ghi history lên /volume2/homes

case "$1" in
  stop)  $TMUX kill-session -t ttyd 2>/dev/null; pkill -x ttyd; $TMUX kill-server; exit 0 ;;
esac

umask 077
[ -s $H/ttyd.cred ] || echo "nas:$(head -c 30 /dev/urandom | base64 | tr -d '/+=' | cut -c1-24)" > $H/ttyd.cred

for s in claude codex; do
  $TMUX has-session -t $s 2>/dev/null || $TMUX new -d -s $s -c $PROJ
done

# ttyd runs INSIDE the tmux server (its own session), not as a child of
# whoever ran this script: a task "Run" from DSM's web UI lives under
# synoscgi, and restarting DSM killed ttyd that way once. The tmux server
# is started at boot and outlives every DSM service restart.
# -W ghi được, -O chặn origin lạ, -a nhận ?arg=<session>, tối đa 2 client
$TMUX kill-session -t ttyd 2>/dev/null; pkill -x ttyd 2>/dev/null
$TMUX new -d -s ttyd -c $H "exec $H/bin/ttyd -p 7681 -i 127.0.0.1 -W -O -a --max-clients 2 -c \"\$(cat $H/ttyd.cred)\" -t fontSize=15 -t titleFixed=NAS $H/bin/nas-attach >> $H/ttyd.log 2>&1"

# Funnel came back "on" after a reboot yet answered nothing: tailscaled
# dropped the ingress→peerapi packets ("no rules matched") until funnel was
# reset. Re-applying it is idempotent, so do it every start, once the node
# is actually Running (the boot task can fire before tailscaled is).
if [ -x $TS ]; then
  i=0
  while [ $i -lt 30 ] && [ "$($TS status --json 2>/dev/null | sed -n 's/.*"BackendState": *"\([A-Za-z]*\)".*/\1/p' | head -1)" != Running ]; do
    i=$((i+1)); sleep 2
  done
  $TS funnel reset >/dev/null 2>&1
  $TS funnel --bg 7681 >/dev/null 2>&1 && echo "funnel: https://nas.tail74216c.ts.net" || echo "funnel: FAILED (chạy tay: $TS funnel --bg 7681)"
fi
echo "ttyd :7681 (tmux session ttyd) → tmux [claude|codex] — login $(cat $H/ttyd.cred)"
```

`/volume1/0_System/project/home-nas/bin/nas-attach`:

```sh
#!/bin/sh
# ttyd (from Task Scheduler) has no locale; without UTF-8 here tmux mangles Vietnamese.
export LANG=en_US.utf8 LC_ALL=en_US.utf8 TERM=xterm-256color
# ttyd itself lives in a tmux session, so every connection inherits $TMUX and
# tmux would refuse to "nest"; this is a fresh client, not a nested one.
unset TMUX TMUX_PANE
exec /var/packages/DiagnosisTool/target/tool/tmux -u new -A -s "${1:-claude}" -c /volume1/0_System/project
```

`chmod 700` cả hai. `-i 127.0.0.1` để ttyd **không** nghe trên LAN/WAN — chỉ Tailscale mới với tới.

## 2. Tailscale Funnel (làm một lần, cần root)

Phần trên web admin (<https://login.tailscale.com/admin>):

1. **DNS** tab → *MagicDNS* = Enabled, *HTTPS Certificates* = Enable (Funnel bắt buộc cả hai;
   tên máy sẽ là `nas.<tailnet-name>.ts.net`, tailnet name hiện ngay đầu tab DNS).
2. **Access Controls** tab → sửa policy file, thêm khối (ngang hàng với `"acls"`):
   ```json
   "nodeAttrs": [{ "target": ["autogroup:member"], "attr": ["funnel"] }]
   ```
   Save. (Quên bước này thì lệnh `tailscale funnel` sẽ in ra link dẫn thẳng tới đây.)
3. **Machines** tab → máy `nas` → ⋯ → *Disable key expiry*, khỏi phải đăng nhập lại sau 180 ngày.

Không có nút bật Funnel cho từng máy trên web — bước đó làm bằng CLI trên NAS:

4. Trên NAS (SSH, `sudo -i`):
   ```sh
   TS=/var/packages/Tailscale/target/bin/tailscale
   $TS set --operator=nas          # user nas được điều khiển tailscale, khỏi sudo về sau
   $TS funnel --bg 7681            # https://nas.<tailnet>.ts.net → 127.0.0.1:7681
   $TS funnel status
   ```
   Cấu hình serve/funnel được lưu, **sống qua reboot**; gói Tailscale tự khởi động cùng DSM.
   `nas-terminal start` vẫn `funnel reset` + bật lại mỗi lần boot (xem sự cố 19:00 bên dưới).
   Tắt khi không cần: `tailscale funnel --https=443 off` (hoặc `tailscale funnel reset`).
5. Chỉ dùng trong tailnet (iPad/laptop có Tailscale) mà không public: thay `funnel` bằng `serve`.

### Funnel "on" nhưng web báo ERR_TIMED_OUT (2026-09-17 19:00, sau reboot)

Triệu chứng: `tailscale funnel status` = on, DNS đúng, cert đúng, `curl 127.0.0.1:7681` = 401,
nhưng `https://nas.<tailnet>.ts.net` treo ở TLS ClientHello (không có ServerHello) — lúc được lúc không.
Log tailscaled: `Drop: TCP{[fd7a:…:ab12:4843:cd96:…]:… > [fd7a:…:c501:c158]:34042} no rules matched`.

Nguyên nhân: `tailscale debug netmap` cho thấy rule cấp quyền ingress (`Caps: …/cap/ingress`)
chỉ liệt kê các node `funnel-ingress-node` kiểu địa chỉ cũ (`fd7a:115c:a1e0::xxxx:xxxx`), còn
các ingress node mới (`fd7a:115c:a1e0:ab12:…`) có trong peer list nhưng **không có trong rule**,
nên client 1.58.2 (01/2024) drop. Tên DNS trỏ tới 2 ingress host trong region → ~50 % request treo.

Sửa:
1. Tạm: `tailscale funnel reset && tailscale funnel --bg 7681` — làm ingress reconnect, đỡ được
   một phần; `nas-terminal start` giờ tự làm bước này sau khi tailscale Running (idempotent).
2. Triệt để: **nâng gói Tailscale** — bản trong Package Center quá cũ. File đã tải sẵn
   `/volume1/0_System/project/home-nas/tailscale-x86_64-1.102.4-700102004-dsm7.spk`
   (từ `https://pkgs.tailscale.com/stable/`). Package Center → *Manual Install* → chọn file →
   Next tới hết. Sau đó kiểm: `tailscale version`, `tailscale funnel status`, mở URL 5 lần liên tiếp.
   Setting `--operator=nas` và cấu hình funnel nằm trong `tailscaled.state` nên **giữ nguyên qua nâng cấp**;
   nếu mất: chạy lại bước 4 ở §2.

## 3. DSM Task Scheduler

Control Panel → Task Scheduler → Create → Triggered Task → User-defined script:
- Event **Boot-up**, user **nas**, script: `sh /volume1/0_System/project/home-nas/bin/nas-terminal start`
- (Không cần task shutdown — tắt NAS là process chết theo.)

Bật NAS từ xa: Hardware & Power → Power Schedule, hoặc WOL (`ether-wake`) từ máy cùng LAN.

## 4. Quy trình dùng

1. Mở `https://nas.<tailnet>.ts.net/?arg=claude` → nhập user/pass (`ttyd.cred`).
2. `claude-project <project>` (cd, `git pull --ff-only`, chạy claude; `claude-project <project> --continue` để tiếp phiên cũ) → trong claude bật remote control như vẫn làm với `tmux-claude`.
3. Đóng tab web — tmux vẫn giữ claude chạy; code tiếp bằng Claude Code web.
4. Codex: `?arg=codex` → `codex-project <project>`, gõ lệnh trực tiếp trong tab web.
6. Shell riêng không đụng hai session kia: `?arg=shell` (tên bất kỳ đều tạo session mới).
7. Chạy ngầm không cần mở tab: `tmux send-keys -t codex "codex-project <project>" Enter`.
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

## Những gì còn chạm ổ to sau khi dọn (2026-09-17)

### DSM PostgreSQL (`@database/pgsql`) — dời sang volume1 (làm 2026-09-17)

DSM đặt DB hệ thống ở volume có nhiều chỗ trống nhất lúc khởi tạo (`/var/services/pgsql → /volume2/@database/pgsql`
từ 2025-08-15). Download Station ghi vào đó liên tục khi tải/seed → 14 TB không ngủ (`block_dump`: 186 write/10 phút; 0 khi DS stop).
Script: `home-nas/bin/move-pgsql.sh` (`sudo sh …`), có kiểm tra và rollback. Nó làm:
stop DS → stop `pgsql-adapter` + `pgsql` → nếu postgres còn (unit có `KillMode=none`; một lần start ngoài systemd
để lại process mồ côi) thì `kill -INT <postmaster>` (= `pg_ctl -m fast`) → `cp -a` → `servicetool --set-service-data-store-path pgsql <dst>`
→ symlink → start `pgsql` rồi `pgsql-adapter` → đổi tên bản cũ `pgsql.moved-YYYYMMDD`, để symlink ở chỗ cũ.
Kiểm: `readlink /var/services/pgsql` = `/volume1/@database/pgsql`, `servicetool --get-service-volume pgsql` = `/volume1`,
`systemctl is-active pgsql pgsql-adapter`. Sau một reboot còn đúng → `rm -rf /volume2/@database/pgsql.moved-*`.
Bài học: DSM **không có `pgrep`** (dùng `pidof`); `synosystemctl stop pgsql` không giết postgres mà nó không quản.
Rollback: stop 2 unit → `servicetool --unset-service-data-store-path pgsql` → symlink về bản cũ → start.

- 2026-09-17: `SYNO.Core.Syslog` ghi md0 mỗi 60 s **khi DSM web đang mở** — kiểm chứng: logout DSM → 0 lần. Quy tắc: logout DSM.
- 2026-09-17: Postgres của DSM (Download Station) ghi volume2 mỗi checkpoint → dời `@database/pgsql` sang volume1 (mục trên).
- 2026-09-17: SMB transfer log (`.SMBXFERDB` trong `/volume2/@database/synolog`) ghi khi copy qua SMB → tắt ở SMB → Advanced nếu không cần.
- SynoFinder (`@SynoFinder-log/etc-volume`) tự chọn volume nhiều chỗ trống nhất, dời tay là nó dời lại; nó chỉ ghi lúc khởi động/re-index → bỏ qua.

## An toàn

- Funnel = **public internet**. Lớp bảo vệ duy nhất là basic‑auth của ttyd → mật khẩu dài ngẫu nhiên
  (script sinh 24 ký tự), `--max-clients 2`, `-O`. Tắt Funnel khi không dùng dài ngày.
- ttyd chạy bằng user `nas`, không phải root; DSM admin vẫn cần đăng nhập riêng.
- Đừng bao giờ bind ttyd ra `0.0.0.0` hay mở port router — mật khẩu basic‑auth đi HTTP thuần.

## Sổ tay hibernate (những gì đã tìm ra, theo thứ tự)

Cách đo chuẩn, cần root (`sudo -i` trong tab `?arg=shell`), 10 phút, ra tên process + file + ổ:

```sh
OUT=/volume1/0_System/project/home-nas/blockdump.txt
dmesg -c > /dev/null; echo 1 > /proc/sys/vm/block_dump; sleep 600; echo 0 > /proc/sys/vm/block_dump
dmesg | grep -E 'WRITE|dirtied' > $OUT; chown nas $OUT
```
Đọc: `dm-8` = volume1, `dm-7` = volume2/3, `md0` = phân vùng hệ thống DSM (mirror trên **cả 3 ổ**:
`sata1p1 sata2p1 sata3p1`) — ghi vào `md0` là cả 14 TB lẫn 8 TB thức. `hdparm -C /dev/sata1 /dev/sata3` xem ổ đang ngủ chưa.

1. **scemd.log** (06/09/2026) — scemd ghi `/var/log/scemd.log` liên tục. Fix: symlink về `/dev/null`.
   **Mất sau mỗi lần update DSM** (`/var/log` nằm trên md0, bị ghi đè). Sau update kiểm tra:
   ```sh
   ls -l /var/log/scemd.log          # phải thấy -> /dev/null
   sudo rm -f /var/log/scemd.log && sudo ln -sf /dev/null /var/log/scemd.log && sudo synosystemctl restart syslog-ng
   ```
   Dấu hiệu quên: điện vọt lên ~30 W vì 2 ổ to không ngủ.
2. **Repo + Claude/Codex/home trên volume2** (16–17/09/2026) — chuyển hết sang volume1 (`/volume1/0_System/project`, User Home → Volume 1).
   Sau đó `block_dump` xác nhận Claude/ttyd/tmux chỉ ghi `dm-8`.
3. **Log Center SQLite** (17/09/2026, chưa xong) — `SYNO.Core.Syslog` ghi `.SYNOSYSDB-wal` / `.SYNOCONNDB-wal`
   (`/var/log/synolog/`, trên md0) đúng **mỗi 60 s** → jbd2 flush md0 → 3 ổ thức mỗi phút. Không symlink được
   (SQLite). Phải tắt nguồn sự kiện: xem Log Center → Connection / System, dòng nào lặp mỗi phút.
   Nghi: Cloud Sync (daemon vẫn gọi `SYNO.CloudSync_*` mỗi phút dù đang suspended) hoặc phiên DSM qua QuickConnect.
