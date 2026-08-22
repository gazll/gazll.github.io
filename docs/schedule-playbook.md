# The calendar and the private schedule

`/calendar` is two things stacked on one page. The **calendar** is public:
solar and lunar dates, can-chi pillars, and the Vietnamese public holidays,
five years ahead. The **schedule** is private: the reminders you actually want
tracked — an annual card fee, an oil change, a deworming dose, a giỗ — and it
ships encrypted because this repository is public.

## Why it is encrypted

`gazll.github.io` is a user-pages repository, so it must be public and
everything under `public/data/` answers a plain `GET`. Hiding a reminder list
behind a signed-in view would be the "hiding the Admin menu is cosmetic"
mistake with real consequences. So the file that ships is ciphertext, and the
passphrase is the only gate — sign-in is not one, because it would buy nothing
over ciphertext while locking you out whenever Google is unreachable.

## Where the data lives

| | |
|---|---|
| `secret/schedule.json` | The real file. Gitignored. This is what you edit. |
| `public/data/schedule/private.enc.json` | AES-256-GCM envelope. Committed. |
| `public/data/calendar/holidays.json` | Yearly ministry notices. Public, not sensitive. |
| Google Sheet `schedule_inbox` | Holding pen only. Never the source of truth. |

## The loop

```bash
node tools/schedule-seal.mjs init          # once: writes a starter secret/schedule.json
# edit secret/schedule.json
node tools/schedule-seal.mjs validate      # same rules, no passphrase, no output file
node tools/schedule-seal.mjs seal          # validates, then writes the envelope
git add public/data/schedule/private.enc.json && git commit
```

The passphrase is looked for in three places, in order: the
`GAZLL_SCHEDULE_KEY` environment variable, then `secret/schedule.key` (one
line, no quotes), then a prompt with the echo turned off. The key file is a
convenience for the machine that edits the content and is safe only because
`secret/` is gitignored — it is still a credential on disk, so the tool never
creates it for you and never prints it back.

### The hint

`"hint"` at the top of `secret/schedule.json` is copied into the envelope
**outside** the ciphertext, because a reminder you can only read after
unlocking is no reminder at all. It is therefore public, exactly as public as
the ciphertext beside it.

So write a hint that jogs your own memory and tells a stranger nothing. Burying
the few characters you need among noise is the trick: `4qJmz@r7t2kx6bw` reads
as a random string, while the person who chose the passphrase picks their
landmarks out of it at a glance. A hint that spells out part of the passphrase
does the opposite — it hands an attacker a shorter search.

On the page the hint is not shown by default: it costs a fetch of the envelope,
and a visitor who only wants a calendar should not pay for it. A **Quên
passphrase?** link reveals it, and a wrong attempt reveals it automatically —
which is the moment it is actually wanted.

### Recovery

This is the reason `unseal` exists. `secret/` is gitignored, so nothing backs
it up — but the envelope is in git, every version of it. On a fresh clone:

```bash
node tools/schedule-seal.mjs unseal        # envelope -> secret/schedule.json
node tools/schedule-seal.mjs --check       # opens, validates, and compares to secret/
```

`git log -- public/data/schedule/private.enc.json` lists every sealed version;
check one out and `unseal` it to recover an older schedule.

**The passphrase is the only unrecoverable part.** Keep it in a password
manager. Losing the laptop costs nothing; losing the passphrase costs
everything.

`--check` is deliberately **not** a `tools/check.mjs` stage: CI has neither the
passphrase nor `secret/`, so it would fail on every run.

## Letting other people in

Two ways to hold the key, and only the second one can be taken back.

**Give them the passphrase.** Works immediately, needs no setup, and cannot be
revoked without re-sealing under a new passphrase and telling everyone the new
one. Fine for one trusted person; poor as a habit.

**Grant the account instead**, so they never see a passphrase at all: they sign
in with Google and the page opens itself. Three steps, and the second is the
same gesture as making someone an admin.

1. **Store the passphrase in Apps Script, once.** Either Extensions → Apps
   Script → ⚙ Project Settings → Script properties → Add script property
   (`SCHEDULE_KEY`), or — better — Run → `setScheduleKey`, which asks in a
   dialog that closes. The second way keeps the passphrase out of a settings
   field and out of the version history Apps Script retains. It lives in a
   Script Property rather than a Sheet cell because a Sheet is the thing most
   likely to be shared by accident. `checkScheduleKey` confirms one is stored
   without printing it.
2. **List who may open it.** In the Sheet, the `schedule_access` tab — created
   by `setup()` — takes one row per person: `email`, `name`, `note`,
   `granted_at`. The email must be the Google account they sign in with.
   Anyone with `role = admin` in `profiles` is always allowed, so clearing this
   sheet cannot lock you out of your own file.
3. **Redeploy.** Deploy → Manage deployments → New version. Apps Script serves
   the last deployed version, so nothing changes until you do.

They then open `/calendar`, sign in, and the schedule is simply there. The key
is used and dropped — never written to storage — so it is fetched fresh on
every visit.

**Revocation is soft, and it matters that you know why.** The key has to reach
the browser to decrypt anything, so anyone you have granted could have kept a
copy. Deleting their row stops the page handing it to them again, which is
enough for "they no longer work here"; it is not enough for "they must never
read this again". For that, re-seal under a new passphrase and update
`SCHEDULE_KEY`.

Everyone granted sees the whole file — there is no per-member view. The member
chips filter what is on screen; they are not a permission boundary.

## Members

Who a reminder belongs to. They are data, not a closed set in code, because a
household changes without a release:

```json
"members": [
  { "id": "minh", "name": "Minh" },
  { "id": "cho",  "name": "Chó" },
  { "id": "nha",  "name": "Cả nhà" }
]
```

An event's `member` must name one of them — `seal` refuses an unknown id, so a
typo cannot orphan a row into an owner that never appears under any filter.
One chip row filters the whole page at once: the dots on the grid, the agenda
and the standing notes all narrow together.

Content is written in whatever language you write it in. `title` and `note`
take a plain string, and an `{ en, vi }` pair only when a row is genuinely
worth translating — this is your own list, not a reader surface.

## Things owned

An inventory, not an agenda. A reminder answers "when must I do this again"; an
item answers "when did I buy this, what did it cost, is it still covered, how
old is the battery in it". Items never enter the agenda — eighty receipts would
bury the six things actually due this quarter — and live under their own tab.

They are split by **household**, not by member: a NAS belongs to the house
rather than to one of the people in it.

```json
"households": [
  { "id": "nha-a", "name": "Nhà A" },
  { "id": "nha-b", "name": "Nhà B" }
],
"groups": [
  { "id": "nas", "name": "NAS", "household": "nha-a" }
],
"items": [
  {
    "id": "o-cung-8tb",
    "name": "Ổ cứng 8TB",
    "group": "nas",
    "household": "nha-a",
    "bought": "2026-06-20",
    "price": "3.200.000đ",
    "warranty_months": 24,
    "note": "…"
  }
]
```

Only `id` and `name` are required. **`bought` may be absent** — a receipt nobody
kept is a real state, and inventing a date would make the history lie instead of
admitting the gap; the row simply shows no date and no age.

A group's date is its **newest** part, not its oldest: a NAS given a new drive
last month is something you touched last month, so it sorts there rather than
under its 2024 build date.

`warranty_months` is counted from `bought`, so a warranty needs one. The derived
end date shows on every row; anything lapsing within 60 days is lifted into a
**Sắp hết bảo hành** block at the top, which is the only list here worth acting
on.

### `service` — what was replaced inside a thing

```json
"service": [
  { "date": "2026-06-09", "what": "Pin 2 tai", "price": "360.000đ", "part": "pin" }
]
```

This is what makes the history answer the question actually being asked. A
four-year-old pair of earbuds whose battery was changed in June is **not** a
four-year-old battery, so a replacement resets the clock for its own `part`
while the item keeps its original purchase date. `date` and `what` are required;
`part` groups repeat replacements of the same component so only the latest one
counts as its age.

A vehicle is one item whose parts are its service log — bugi, lọc gió, acquy,
nhớt hộp số — not four unrelated purchases.

## Checklists

Named lists with tick boxes, for what gets prepared before a trip.

```json
"checklists": [
  { "id": "chuyen-ve-que", "name": "Mang về quê", "household": "nha-b",
    "items": [{ "id": "mua-men-vi-sinh", "text": "Bịch men vi sinh" }] }
]
```

**Tick state is not in the sealed file.** The file says what belongs on the
list; ticking is per-trip state that changes several times a trip and must not
need a commit. It lives in `localStorage` so it works signed out and offline,
and syncs to the Sheet through `schedule.check` when signed in — the later
timestamp wins if the two disagree.

An entry's `id` is the key that tick is stored under, exactly as `item_id` is a
stored Sheet key elsewhere. Rename one and its tick is orphaned, so `seal`
checks entry ids for uniqueness across **every** list, not just within one.

## Standing notes

What is true but not dated: what is in the cupboard, why a schedule is on
hold. They are not events, so they never get a date, a status, or a place in
the agenda — they sit in their own panel in the rail.

```json
"notes": [
  { "id": "kho-nhot", "member": "nha", "category": "vehicle",
    "title": "Kho nhớt", "body": "3 bình nhớt xe số, 0 bình nhớt xe tay ga." }
]
```

Only `id` and `body` are required. Reach for a note when there is nothing to
put on a calendar; reach for a `once` event when there is something to do by
some date, even a date you invented — say so in the note when you did.

## Writing an event

```json
{
  "id": "the-a-phi-thuong-nien",
  "title": { "vi": "Phí thường niên thẻ A", "en": "Card A annual fee" },
  "category": "finance",
  "severity": "critical",
  "repeat": { "kind": "yearly", "anchor": "2024-11-18" },
  "lead_days": 45,
  "cost": "500.000đ",
  "note": { "vi": "Gọi tổng đài xin miễn phí trước ngày cắt.", "en": "Call for a waiver before the cut-off." },
  "history": ["2025-11-18"]
}
```

`id` kebab-case and unique · `category` one of `finance` `vehicle` `health`
`pet` `home` `device` `document` `family` `subscription` · `severity` one of `critical`
`normal` `optional` (default `normal`) · `title` and `note` are a string or an
`{ en, vi }` pair.

### The five recurrence kinds

| `repeat.kind` | Fields | For |
|---|---|---|
| `once` | `on: "YYYY-MM-DD"` | A single dated obligation |
| `yearly` | `anchor: "YYYY-MM-DD"` | Annual fees, insurance, đăng kiểm |
| `lunar-yearly` | `day` 1–30, `month` 1–12 | Giỗ, lunar birthdays, rằm |
| `monthly` | `day` 1–31 (clamped) | Statements, rent |
| `rolling` | `every`, `unit: day\|month\|year` | Oil changes, deworming, vaccines |

**Fixed versus rolling is the distinction that matters.** A *fixed* event
(`once`, `yearly`, `lunar-yearly`, `monthly`) happens on a date the calendar
decides; paying it late does not move next year. A *rolling* event is measured
from the last time it was actually done, so skipping one shifts everything
after it. A rolling event therefore needs `repeat.anchor` or at least one
`history` entry — with no starting point there is nothing to count from.

That difference also decides how long a missed occurrence stays live:

- **rolling** — one live date, and it stays overdue however long you leave it.
  An oil change three weeks late is still the oil change you owe.
- **fixed** — live for `lead_days` after its date, then the next occurrence
  takes over. A statement date two months gone is history.

### `history`

Completion dates, newest first. For a rolling event it is the input the next
date is computed from. For a fixed event it only marks which occurrences are
settled, matched within half a period (capped at 45 days) so paying early or a
little late settles the right year.

### `lead_days`

How early the warning starts. Defaults follow `severity`: 30 · 14 · 7.

### `odometer` — optional

```json
"odometer": { "every_km": 5000, "per_month": 1400, "km_since": 1200 }
```

Distance and time are two due dates and the earlier one wins. Only the time
half is a fact, so a distance-driven row is always marked as an estimate and
keeps the calendar date beside it.

## Holidays

The eleven statutory days off are computed from Bộ luật Lao động 2019 Điều 112
in `lib/vn-holidays.js` and are correct for any year — do not repeat them in
data. What cannot be computed is the yearly ministry notice: the extra days a
given Tết is granted, the Saturdays worked in exchange, and which side of 02/09
the second National Day falls on. That goes in
`public/data/calendar/holidays.json`, one entry per year:

```json
"years": {
  "2027": {
    "national_day_extra": "after",
    "extra": [{ "date": "2027-02-09", "kind": "compensatory", "vi": "Nghỉ bù Tết", "en": "Tet compensatory day" }],
    "workdays": ["2027-02-20"],
    "source": "Thông báo .../TB-BLĐTBXH"
  }
}
```

A year with no entry falls back to the statutory rules, which is a correct
calendar — just not the announced one.

## The inbox

For reminders you think of away from the repository. It lives in the Sheet
under `schedule_inbox`, reachable only while signed in, and every row is
transcribed into `secret/schedule.json` and then marked merged. **Copy JSON**
on a row emits a skeleton event ready to paste.

Keep it a holding pen. Nothing in the Sheet should ever be the only copy —
losing the Sheet must cost at most the notes not yet transcribed.

The `schedule.*` actions need an Apps Script redeploy (Deploy → Manage
deployments → New version). Until then the inbox says so and the rest of the
page is unaffected.
