#!/usr/bin/env bash
# Recon for arbe-system-overview. One call, every source, plain text.
# Usage: bash recon.sh [window_days] [--no-fetch]   (default 7, fetches remotes)
# Prints a sources verdict first, then a section per source. A source is only
# "ok" if it actually returned rows.

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
  for d in "$HOME/sites/notes" "$HOME/Dropbox/notes" "$HOME/notes" /mnt/d/dropbox/notes; do
    [ -d "$d/projects" ] && VAULT=$(cd "$d" && pwd) && break
  done
fi
[ -n "$VAULT" ] || { echo "vault: not found (set NOTES_VAULT)"; exit 1; }

# Repo roots. RECON_ROOTS (colon-separated) wins. Otherwise every candidate that
# is writable and holds at least one repo — machines disagree on names, and one
# had a root-owned empty ~/Sites decoy. Deduped by real path, so a
# case-insensitive filesystem doesn't scan ~/sites twice.
ROOTS=()
if [ -n "${RECON_ROOTS:-}" ]; then
  IFS=: read -r -a cands <<< "$RECON_ROOTS"
else
  cands=("$HOME/sites" "$HOME/Sites" "$HOME/code")
fi
seen_roots=" "
for d in "${cands[@]}"; do
  [ -d "$d" ] && [ -w "$d" ] || continue
  real=$(cd "$d" && pwd -P)
  case "$seen_roots" in *" $real "*) continue ;; esac
  n=0
  for g in "$d"/*/.git "$d"/*/*/.git; do [ -e "$g" ] && n=$((n+1)); done
  [ "$n" -gt 0 ] || continue
  seen_roots="$seen_roots$real "
  ROOTS+=("$d")
done

OUT=$(mktemp); ROWS=$(mktemp)
trap 'rm -f "$OUT" "$ROWS"' EXIT

{
echo "## env"
echo "today: $(date +%Y-%m-%d)"
echo "window: ${WINDOW}d (since $SINCE_DAY)"
echo "vault: $VAULT"
echo "roots: ${ROOTS[*]:-none}"
echo
} >> "$OUT"

# --- local repos -------------------------------------------------------------
# Only trust git-overview if it speaks --porcelain. An old build prints its usage
# to stdout, and those 13 lines once got counted as 13 repos.
GO=""
GO_NOTE=""
if command -v git-overview >/dev/null 2>&1; then
  if git-overview --help 2>&1 | grep -q -- --porcelain; then GO="git-overview"
  else GO_NOTE="git-overview lacks --porcelain, upgrade it; "
  fi
fi

# One row per repo: root|name|branch|state|flags|age|epoch
for root in "${ROOTS[@]}"; do
  if [ -n "$GO" ]; then
    $GO $FETCH --porcelain "$root" 2>/dev/null \
      | awk -F'|' -v r="$root" 'NF==6 { print r "|" $0 }' >> "$ROWS"
  else
    for g in "$root"/*/.git "$root"/*/*/.git; do
      [ -e "$g" ] || continue
      r=${g%/.git}
      dirty=$(git -C "$r" status --short 2>/dev/null | wc -l | tr -d ' ')
      printf '%s|%s|%s|%s|%s|%s|%s\n' "$root" "${r#$root/}" \
        "$(git -C "$r" branch --show-current 2>/dev/null)" \
        "$([ "$dirty" -gt 0 ] && echo dirty || echo clean)" \
        "$([ "$dirty" -gt 0 ] && echo "M:$dirty")" \
        "$(git -C "$r" log -1 --format=%cr 2>/dev/null | sed 's/ ago//')" \
        "$(git -C "$r" log -1 --format=%ct 2>/dev/null || echo 0)" >> "$ROWS"
    done
  fi
done

scanned=$(wc -l < "$ROWS" | tr -d ' ')
roots_short=$(for r in "${ROOTS[@]}"; do printf '%s ' "${r/#$HOME/\~}"; done)
roots_short=${roots_short% }
if [ "${#ROOTS[@]}" -eq 0 ]; then
  SRC_LOCAL="local: BLIND, no repo roots found (set RECON_ROOTS)"
elif [ "$scanned" -eq 0 ]; then
  SRC_LOCAL="local: BLIND, ${GO_NOTE}0 repos read from $roots_short"
elif [ -n "$GO" ]; then
  SRC_LOCAL="local: ok, $scanned repos in $roots_short${FETCH:+, fetched}"
else
  SRC_LOCAL="local: partial, $scanned repos in $roots_short (${GO_NOTE}no fetch, behind-counts unreliable)"
fi

{
echo "## local repos (this machine only; dirty, or committed inside the window)"
while IFS='|' read -r root name branch state flags age epoch; do
  # A vendored checkout is only interesting when it holds OUR work (local edits
  # or unpushed commits). Being thousands of commits behind upstream is normal.
  case "$name" in 3rdparty/*|thirdparty/*)
    case "$flags" in *M:*|*S:*|*U:*|*↑*) ;; *) continue ;; esac ;;
  esac
  commit=$(git -C "$root/$name" log -1 --format=%cr 2>/dev/null | sed 's/ ago//')
  cepoch=$(git -C "$root/$name" log -1 --format=%ct 2>/dev/null || echo 0)
  if [ "$state" = "dirty" ] || [ "${cepoch:-0}" -ge "$SINCE" ]; then
    printf '%s\t%s\t%s\t%s\tlast commit %s\n' "$state" "${root##*/}/$name" "$branch" "${flags:--}" "${commit:-?}"
  fi
done < "$ROWS" | sort -k1,1 | column -t -s $'\t'
echo
} >> "$OUT"

# --- github ------------------------------------------------------------------
GH_OK=""
command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1 && GH_OK=1
GH=""
[ -n "$GH_OK" ] && GH=$(gh repo list oskarrough --limit 100 --json name,pushedAt,description \
  --jq "map(select(.pushedAt >= \"$SINCE_ISO\")) | sort_by(.pushedAt) | reverse | .[] | \"\(.pushedAt[:10])  \(.name)  \(.description // \"\")\"")
{
echo "## github pushes since $SINCE_DAY (all machines)"
echo "${GH:-nothing}"
echo
} >> "$OUT"
if [ -z "$GH_OK" ]; then SRC_GH="github: not reachable, gh missing or not logged in"
else SRC_GH="github: ok, $(printf '%s' "$GH" | grep -c .) repos pushed"
fi

# --- linear ------------------------------------------------------------------
# No key is not a dead source: the agent reads Linear through its connector.
KEY="${LINEAR_API_KEY:-}"
if [ -z "$KEY" ] && [ -f "$HOME/.config/fish/conf.d/secrets.fish" ]; then
  KEY=$(sed -nE "s/.*LINEAR_API_KEY[ =]+[\"']?([^\"' ]+).*/\\1/p" "$HOME/.config/fish/conf.d/secrets.fish" | head -1)
fi
{
echo "## linear (team OSK: in progress, or open and updated since $SINCE_DAY)"
if [ -z "$KEY" ]; then
  echo "no key for the script. Read it through the Linear connector: team OSK in state"
  echo "started, then team OSK updated since $SINCE_DAY, minus completed and canceled."
  SRC_LINEAR="linear: via connector"
else
  Q='query($since: DateTimeOrDuration!){ issues(first:100, orderBy:updatedAt, filter:{ team:{key:{eq:"OSK"}}, or:[ {state:{type:{eq:"started"}}}, {and:[{updatedAt:{gt:$since}},{state:{type:{nin:["completed","canceled"]}}}]} ] }){ nodes{ identifier title updatedAt state{name} project{name} } } }'
  LIN=$(curl -s https://api.linear.app/graphql -H "Authorization: $KEY" -H 'Content-Type: application/json' \
    --data "$(jq -cn --arg q "$Q" --arg s "$SINCE_ISO" '{query:$q, variables:{since:$s}}')" \
  | jq -r 'if .errors then "linear: error " + (.errors[0].message) else .data.issues.nodes[] | "\(.updatedAt[:10])  \(.identifier)  [\(.state.name)]  \(.project.name // "no project")  \(.title)" end')
  echo "${LIN:-nothing}"
  case "$LIN" in
    "linear: error"*|"") SRC_LINEAR="linear: failed, try the connector" ;;
    *) SRC_LINEAR="linear: ok" ;;
  esac
fi
echo
} >> "$OUT"

# --- weekly ------------------------------------------------------------------
{
echo "## weekly.md, last log entry"
if [ -f "$VAULT/weekly.md" ]; then
  awk '/^### 20[0-9][0-9]-/{ if (n++) exit } n' "$VAULT/weekly.md"
else
  echo "weekly: not found"
fi
echo
} >> "$OUT"
if [ -f "$VAULT/weekly.md" ]; then SRC_VAULT="vault: ok"; else SRC_VAULT="vault: no weekly.md"; fi

# --- project notes -----------------------------------------------------------
{
echo "## project notes matching active repos (first 10 lines each)"
names=$( { awk -F'|' -v s="$SINCE" '$4=="dirty" || $7>=s {print $2}' "$ROWS";
           printf '%s\n' "$GH" | awk 'NF {print $2}'; } \
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
} >> "$OUT"

echo "## sources"
printf '%s\n' "$SRC_LOCAL" "$SRC_GH" "$SRC_LINEAR" "$SRC_VAULT"
echo
cat "$OUT"
