#!/bin/sh
# Long movie-catalog jobs on the NAS, one entrypoint (was four hand-copied wrappers in the personal vault).
#   sh tools/fshare-run.sh telegram       incremental Telegram crawl → build → close gates → categorize → move-to-x → audit
#   sh tools/fshare-run.sh validate-all   re-check every row (files probed, folders re-listed) → close gates → audit
#   sh tools/fshare-run.sh add            after `fshare-movie.mjs ingest …`: build → move-to-x → close gates → categorize → move-to-x → audit
#   sh tools/fshare-run.sh recrawl A,B    re-list named folders that keep growing → close gates → categorize → move-to-x → audit
#   sh tools/fshare-run.sh loop           `telegram` now, then every 14 days; only when the owner asks, dies with a reboot on purpose
# Run under nohup (`nohup sh tools/fshare-run.sh validate-all >/dev/null 2>&1 &`): a validate pass is hours.
# Never seals: the audit is read by a person first (docs/fshare-movie-playbook.md). Every step is resumable, so a
# crashed job is restarted with the same command. Logs live outside every repo:
#   $RUNS/YYYYMMDD_<job>/logs/<job>.log — `grep -- --- <log>` for the step marks, `tail -3` for progress.
set -e
JOB=${1:?usage: fshare-run.sh telegram|validate-all|add|recrawl CODES|loop}
case $JOB in telegram|validate-all|add|recrawl|loop) ;; *) echo "unknown job: $JOB" >&2; exit 2 ;; esac
REPO=$(cd "$(dirname "$0")/.." && pwd)
RUNS=${RUNS:-/volume1/0_System/nas-state/link-catalog/runs}
DIR=${RUN_DIR:-$RUNS/$(date +%Y%m%d)_$JOB}
LOG=$DIR/logs/$JOB.log
mkdir -p "$DIR/logs"
cd "$REPO"
M="node tools/fshare-movie.mjs"
step() { echo "--- $1 · $(date -u +%FT%TZ) ---" >> "$LOG"; }

# The four gates (pending, unknown, uncrawled folders, unverified dead) usually close in two or three passes:
# each pass lists folders found by the one before. `status` says `validated: OK` once all four are 0;
# five passes without that means something is stuck (Fshare blocking the IP, 2026-09-27) and is worth a look.
gates() {
  for i in 1 2 3 4 5; do
    $M status 2>&1 | grep -q 'validated: OK' && return 0
    step "gates $i"; $M validate --only pending,unknown,uncrawled,unverified --concurrency 4 >> "$LOG" 2>&1
  done
  $M status 2>&1 | grep -q 'validated: OK' || { step "gates still open after 5 passes"; return 1; }
}

case $JOB in
  telegram)
    step "crawl"; node tools/crawl-telegram.mjs >> "$LOG" 2>&1
    step "build"; $M build >> "$LOG" 2>&1
    gates
    step "categorize"; $M categorize --apply >> "$LOG" 2>&1
    step "move-to-x"; $M move-to-x --apply >> "$LOG" 2>&1 ;;
  validate-all)
    step "all"; $M validate --only all --concurrency 4 >> "$LOG" 2>&1
    gates ;;
  add)
    step "build"; $M build >> "$LOG" 2>&1
    # pasted folders may hold links already moved to the X catalog: move them before spending requests on them
    step "move-to-x"; $M move-to-x --apply >> "$LOG" 2>&1
    gates
    step "categorize"; $M categorize --apply >> "$LOG" 2>&1
    step "move-to-x 2"; $M move-to-x --apply >> "$LOG" 2>&1 ;;
  recrawl)
    CODES=${2:?usage: fshare-run.sh recrawl CODE,CODE}
    step "recrawl $CODES"; $M validate --codes "$CODES" --concurrency 4 >> "$LOG" 2>&1
    gates
    step "categorize"; $M categorize --apply >> "$LOG" 2>&1
    step "move-to-x"; $M move-to-x --apply >> "$LOG" 2>&1 ;;
  loop)
    PID=$RUNS/loop.pid
    [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null && { echo "already running (pid $(cat "$PID"))"; exit 0; }
    echo $$ > "$PID"
    set +e  # one failed round must not end the loop; it is logged and the next round runs
    while true; do
      RUN_DIR= sh "$0" telegram || echo "telegram round failed $(date -u +%FT%TZ)" >> "$LOG"
      echo "next round after $(date -u -d @$(( $(date +%s) + 1209600 )) +%FT%TZ)" >> "$LOG"
      sleep 1209600
    done ;;
esac
step "audit"; $M audit >> "$LOG" 2>&1
step "done"
