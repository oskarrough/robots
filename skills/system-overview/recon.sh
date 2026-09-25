#!/usr/bin/env bash
# Recon for arbe-system-overview. One call, every source, plain text.
# Usage: bash recon.sh [window_days] [--no-fetch]   (default 7, fetches remotes)
# Prints a section per source. A missing source prints "<source>: not reachable" and moves on.

WINDOW="${1:-7}"
case "$WINDOW" in --*) WINDOW=7 ;; esac
FETCH="--fetch"
for a in "$@"; do [ "$a" = "--no-fetch" ] && FETCH=""; done
NOW=$(date +%s)
SINCE=$(( NOW - WINDOW*86400 ))
SINCE_ISO=$(date -u -d "@$SINCE" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r "$SINCE" +%Y-%m-%dT%H:%M:%SZ)
SINCE_DAY=${SINCE_ISO:0:10}

# The vault lives in a different place on every machine. NOTES_VAULT wins.
VAULT="${NOTES_VAULT:-}"
if [ -z "$VAULT" ]; then
  for d in "$HOME/oskarrough/notes" "$HOME/Dropbox/notes" "$HOME/notes" /mnt/d/dropbox/notes; do
    [ -d "$d/projects" ] && VAULT=$(cd "$d" && pwd) && break
  done
fi
[ -n "$VAULT" ] || { echo "vault: not found (set NOTES_VAULT)"; exit 1; }

# Machines disagree on the name: some have ~/sites, some ~/Sites, one had both
# (a root-owned empty decoy). Don't trust name order — count repos in each
# candidate and take the fullest. A dir we can't write, or that holds no repo,
# scores nothing. On case-insensitive filesystems the duplicates collapse.
SITES=""
best=0
for d in "$HOME/sites" "$HOME/Sites" "$HOME/code"; do
  [ -d "$d" ] && [ -w "$d" ] || continue
  n=0
  for g in "$d"/*/.git "$d"/*/*/.git; do [ -e "$g" ] && n=$((n+1)); done
  [ "$n" -gt "$best" ] && best=$n && SITES="$d"
done

echo "## env"
echo "today: $(date +%Y-%m-%d)"
echo "window: ${WINDOW}d (since $SINCE_DAY)"
echo "vault: $VAULT"
echo "sites: ${SITES:-none}"
echo

# --- local repos -------------------------------------------------------------
echo "## local repos (this machine only; dirty, or committed inside the window)"
GO=""
if command -v git-overview >/dev/null 2>&1; then GO="git-overview"
elif [ -n "$SITES" ] && [ -x "$SITES/git-overview/git-overview" ]; then GO="$SITES/git-overview/git-overview"
elif [ -n "$SITES" ] && [ -f "$SITES/git-overview/git-overview" ]; then GO="bash $SITES/git-overview/git-overview"
fi

# Scan once, with a fetch, so the ahead/behind columns reflect the real remote.
# Without --fetch these are measured against stale refs and "behind" is invisible.
ROWS=""
if [ -n "$GO" ] && [ -n "$SITES" ]; then
  ROWS=$(mktemp)
  $GO $FETCH --porcelain "$SITES" 2>/dev/null > "$ROWS"
  trap 'rm -f "$ROWS"' EXIT
fi

ACTIVE_LOCAL=""
if [ -z "$SITES" ]; then
  echo "local repos: not reachable (no sites folder)"
elif [ -n "$GO" ]; then
  scanned=$(wc -l < "$ROWS")
  if [ "$scanned" -eq 0 ]; then
    echo "local repos: SCANNED 0 REPOS under $SITES — the source is blind, do not read this as clean"
  fi
  echo "scanned: $scanned repos under $SITES${FETCH:+ (fetched)}"
  # name|branch|state|flags|age|epoch
  cat "$ROWS" | while IFS='|' read -r name branch state flags age epoch; do
    # A vendored checkout is only interesting when it holds OUR work (local edits
    # or unpushed commits). Being thousands of commits behind upstream is normal.
    case "$name" in 3rdparty/*|thirdparty/*)
      case "$flags" in *M:*|*S:*|*U:*|*↑*) ;; *) continue ;; esac ;;
    esac
    commit=$(git -C "$SITES/$name" log -1 --format=%cr 2>/dev/null | sed 's/ ago//')
    cepoch=$(git -C "$SITES/$name" log -1 --format=%ct 2>/dev/null || echo 0)
    if [ "$state" = "dirty" ] || [ "${cepoch:-0}" -ge "$SINCE" ]; then
      printf '%s\t%s\t%s\t%s\tlast commit %s\n' "$state" "$name" "$branch" "${flags:--}" "${commit:-?}"
    fi
  done | sort -k1,1 | column -t -s $'\t'
else
  for g in "$SITES"/*/.git "$SITES"/*/*/.git; do
    [ -d "$g" ] || continue
    r=${g%/.git}; n=${r#$SITES/}
    case "$n" in 3rdparty/*|thirdparty/*) continue ;; esac
    epoch=$(git -C "$r" log -1 --format=%ct 2>/dev/null || echo 0)
    dirty=$(git -C "$r" status --short 2>/dev/null | wc -l)
    if [ "$dirty" -gt 0 ] || [ "$epoch" -ge "$SINCE" ]; then
      printf '%s\t%s\t%s\t%s\n' "$([ "$dirty" -gt 0 ] && echo dirty || echo clean)" "$n" "$(git -C "$r" branch --show-current 2>/dev/null)" "$(git -C "$r" log -1 --format=%cr 2>/dev/null)"
    fi
  done | sort | column -t -s $'\t'
  echo "scanned: $(ls -d "$SITES"/*/.git "$SITES"/*/*/.git 2>/dev/null | wc -l) repos under $SITES (no git-overview; no fetch, so behind-counts are unreliable)"
fi
echo

# --- github ------------------------------------------------------------------
echo "## github pushes since $SINCE_DAY (all machines)"
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh repo list oskarrough --limit 100 --json name,pushedAt,description \
    --jq "map(select(.pushedAt >= \"$SINCE_ISO\")) | sort_by(.pushedAt) | reverse | .[] | \"\(.pushedAt[:10])  \(.name)  \(.description // \"\")\""
else
  echo "github: not reachable (gh missing or not logged in)"
fi
echo

# --- linear ------------------------------------------------------------------
echo "## linear (team OSK: in progress, or open and updated since $SINCE_DAY)"
KEY="${LINEAR_API_KEY:-}"
if [ -z "$KEY" ] && [ -f "$HOME/.config/fish/conf.d/secrets.fish" ]; then
  KEY=$(sed -nE "s/.*LINEAR_API_KEY[ =]+[\"']?([^\"' ]+).*/\\1/p" "$HOME/.config/fish/conf.d/secrets.fish" | head -1)
fi
if [ -z "$KEY" ]; then
  echo "linear: not reachable (no LINEAR_API_KEY)"
else
  Q='query($since: DateTimeOrDuration!){ issues(first:100, orderBy:updatedAt, filter:{ team:{key:{eq:"OSK"}}, or:[ {state:{type:{eq:"started"}}}, {and:[{updatedAt:{gt:$since}},{state:{type:{nin:["completed","canceled"]}}}]} ] }){ nodes{ identifier title updatedAt state{name} project{name} } } }'
  curl -s https://api.linear.app/graphql -H "Authorization: $KEY" -H 'Content-Type: application/json' \
    --data "$(jq -cn --arg q "$Q" --arg s "$SINCE_ISO" '{query:$q, variables:{since:$s}}')" \
  | jq -r 'if .errors then "linear: error " + (.errors[0].message) else .data.issues.nodes[] | "\(.updatedAt[:10])  \(.identifier)  [\(.state.name)]  \(.project.name // "no project")  \(.title)" end'
fi
echo

# --- weekly ------------------------------------------------------------------
echo "## weekly.md, last log entry"
if [ -f "$VAULT/weekly.md" ]; then
  awk '/^### 20[0-9][0-9]-/{ if (n++) exit } n' "$VAULT/weekly.md"
else
  echo "weekly: not found"
fi
echo

# --- project notes -----------------------------------------------------------
echo "## project notes matching active repos (first 10 lines each)"
names=$( { [ -n "$ROWS" ] && awk -F'|' -v s="$SINCE" '$3=="dirty" || $6>=s {print $1}' "$ROWS";
           command -v gh >/dev/null 2>&1 && gh repo list oskarrough --limit 100 --json name,pushedAt --jq "map(select(.pushedAt >= \"$SINCE_ISO\")) | .[].name" 2>/dev/null; } \
         | grep -v -E '^(notes|3rdparty|thirdparty)' | sort -u )
found=0; seen=""
for n in $names; do
  f=$(find "$VAULT/projects" -maxdepth 1 -iname "${n##*/}.md" | head -1)
  [ -n "$f" ] || [ "${n%%/*}" = "$n" ] || f=$(find "$VAULT/projects" -maxdepth 1 -iname "${n%%/*}.md" | head -1)
  [ -n "$f" ] || { echo "-- $n: no project note"; continue; }
  case " $seen " in *" $f "*) continue ;; esac
  seen="$seen $f"
  found=1
  echo "-- ${f##*/}"
  sed -n '1,8p' "$f" | grep -v '^\s*$'
done
[ "$found" = 1 ] || echo "nothing"
