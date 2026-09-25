#!/usr/bin/env bash
# Recon for arbe-project-overview: one project. Note → links → local clone → remote → Linear.
# Usage: bash recon.sh <project name> [--no-fetch]
# Prints a section per source. A missing source prints "<source>: not reachable" and moves on.

Q=""; FETCH=1
for a in "$@"; do
  case "$a" in --no-fetch) FETCH="" ;; *) Q="${Q:+$Q }$a" ;; esac
done
[ -n "$Q" ] || { echo "usage: recon.sh <project name> [--no-fetch]"; exit 1; }

# The vault lives in a different place on every machine. NOTES_VAULT wins.
VAULT="${NOTES_VAULT:-}"
if [ -z "$VAULT" ]; then
  for d in "$HOME/oskarrough/notes" "$HOME/Dropbox/notes" "$HOME/notes" /mnt/d/dropbox/notes; do
    [ -d "$d/projects" ] && VAULT=$(cd "$d" && pwd) && break
  done
fi
[ -n "$VAULT" ] || { echo "vault: not found (set NOTES_VAULT)"; exit 1; }
norm() { tr '[:upper:]' '[:lower:]' | tr -d ' _.-'; }
q=$(printf %s "$Q" | norm)

# --- note ----------------------------------------------------------------------
# Match on filename, then frontmatter title, then repo slug. Exact before partial.
NOTE=""
for pass in exact partial; do
  for f in "$VAULT"/projects/*.md; do
    base=$(basename "$f" .md | norm)
    title=$(sed -n '1,10s/^title: *//p' "$f" | head -1 | norm)
    slug=$(grep -oE 'github\.com/[^/ ]+/[^/ )]+' "$f" | head -1 | sed 's|.*/||' | norm)
    for c in "$base" "$title" "$slug"; do
      [ -n "$c" ] || continue
      if [ $pass = exact ] && [ "$c" = "$q" ]; then NOTE=$f; break 3; fi
      if [ $pass = partial ] && case "$c" in *"$q"*) true ;; *) false ;; esac; then NOTE=$f; break 3; fi
    done
  done
done

echo "## env"
echo "today: $(date +%Y-%m-%d)   host: $(hostname)   query: $Q"
echo

echo "## note"
if [ -z "$NOTE" ]; then
  echo "note: none in projects/ for \"$Q\""
  matches=$(grep -rli --include='*.md' -- "$Q" "$VAULT" 2>/dev/null | grep -v '/Clippings/' | head -8)
  [ -n "$matches" ] && echo "mentioned in:" && echo "$matches" | sed "s|$VAULT/|  |"
else
  echo "file: ${NOTE#$VAULT/}   modified: $(date -r "$NOTE" +%Y-%m-%d)   $(wc -l < "$NOTE") lines"
  sed -n '1,25p' "$NOTE"
fi
echo

# --- links ---------------------------------------------------------------------
REPOS=""
if [ -n "$NOTE" ]; then
  echo "## links from the note"
  grep -oE '\[\[[^]]+\]\]' "$NOTE" | sort -u | while read -r l; do
    t=${l#[[}; t=${t%]]}; t=${t%%|*}; t=${t%%#*}
    hit=$(find "$VAULT" -name "$t.md" -not -path '*/.*' 2>/dev/null | head -1)
    if [ -n "$hit" ]; then echo "  $l  → ${hit#$VAULT/}"; else echo "  $l  (missing)"; fi
  done
  grep -oE 'https?://[^ )>"]+' "$NOTE" | sort -u | sed 's/^/  /'
  echo "backlinks:"
  n=$(basename "$NOTE" .md)
  grep -rlF --include='*.md' "[[$n" "$VAULT" 2>/dev/null | grep -v '/Clippings/' | sed "s|$VAULT/|  |" | head -10
  # Every github repo the note names, frontmatter first. Old names count too:
  # a local clone may still point at the pre-rename URL.
  REPOS=$(grep -oE 'github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+' "$NOTE" | sed 's|github\.com/||; s|\.git$||' | awk '!s[$0]++')
  echo
fi
[ -n "$REPOS" ] || REPOS="oskarrough/$(printf %s "$Q" | tr '[:upper:]' '[:lower:]' | tr -d ' ')"

# --- local ---------------------------------------------------------------------
echo "## local clones on $(hostname)"
found=""
for root in "$HOME/sites" "$HOME/Sites" "$HOME/code" "$HOME/oskarrough"; do
  [ -d "$root" ] || continue
  for g in "$root"/*/.git "$root"/*/*/.git; do
    [ -e "$g" ] || continue
    r=${g%/.git}
    url=$(git -C "$r" remote get-url origin 2>/dev/null)
    for slug in $REPOS; do
      name=${slug#*/}
      case "$url" in *"/$slug"|*"/$slug.git"|*":$slug"|*":$slug.git") ;;
        *) [ "$(basename "$r" | norm)" = "$(printf %s "$name" | norm)" ] || continue ;; esac
      case " $found " in *" $r "*) continue ;; esac
      found="$found $r"
      [ -n "$FETCH" ] && git -C "$r" fetch --quiet 2>/dev/null
      vcs=git; [ -d "$r/.jj" ] && vcs="jj+git"
      echo "-- $r   ($vcs, origin $url)"
      b=$(git -C "$r" branch --show-current); echo "branch: ${b:-detached}   $(git -C "$r" rev-list --left-right --count '@{u}...HEAD' 2>/dev/null | awk '{print "ahead " $2 ", behind " $1}')${FETCH:- (not fetched)}"
      git -C "$r" status --short | head -15
      if [ -d "$r/.jj" ] && command -v jj >/dev/null 2>&1; then
        echo "jj, unpushed (trunk()..@):"
        jj -R "$r" log --no-graph --ignore-working-copy -r 'trunk()..@' --limit 8 \
          -T 'separate(" ", "  " ++ change_id.short(), bookmarks, if(empty, "(empty)"), description.first_line()) ++ "\n"' 2>/dev/null
      fi
      echo "last commits:"
      git -C "$r" log -5 --format='  %cs %h %s' 2>/dev/null
      stash=$(git -C "$r" stash list 2>/dev/null | wc -l); [ "$stash" -gt 0 ] && echo "stashes: $stash"
      echo "other branches:"
      git -C "$r" for-each-ref --sort=-committerdate --format='  %(committerdate:short) %(refname:short)' refs/heads refs/remotes | grep -v -E 'HEAD| origin$|/main$|/master$' | head -6
    done
  done
done
[ -n "$found" ] || echo "not cloned on this machine (looked in ~/sites ~/Sites ~/code ~/oskarrough)"
echo

# --- github --------------------------------------------------------------------
echo "## github"
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  for slug in $REPOS; do
    info=$(gh repo view "$slug" --json nameWithOwner,pushedAt,homepageUrl,isArchived,defaultBranchRef \
      --jq '"\(.nameWithOwner)  pushed \(.pushedAt[:10])  default \(.defaultBranchRef.name)\(if .isArchived then "  ARCHIVED" else "" end)  \(.homepageUrl // "")"' 2>/dev/null) || continue
    # A renamed repo resolves to its new name; skip it if we already showed that.
    real=${info%% *}
    case " $shown " in *" $real "*) continue ;; esac
    shown="$shown $real"
    echo "-- $info"
    echo "recent commits on default branch:"
    gh api "repos/$real/commits?per_page=5" --jq '.[] | "  \(.commit.committer.date[:10]) \(.sha[:7]) \(.commit.message | split("\n")[0])"' 2>/dev/null
    echo "open PRs:"
    gh pr list -R "$real" --limit 10 --json number,title,updatedAt,isDraft --jq '.[] | "  #\(.number) \(.updatedAt[:10]) \(if .isDraft then "[draft] " else "" end)\(.title)"' 2>/dev/null
    echo "open issues:"
    gh issue list -R "$real" --limit 10 --json number,title,updatedAt --jq '.[] | "  #\(.number) \(.updatedAt[:10]) \(.title)"' 2>/dev/null
    echo "last CI runs:"
    gh run list -R "$real" --limit 3 --json conclusion,status,displayTitle,createdAt --jq '.[] | "  \(.createdAt[:10]) \(.conclusion // .status) \(.displayTitle)"' 2>/dev/null
  done
  [ -n "$shown" ] || echo "github: no repo found for: $REPOS"
else
  echo "github: not reachable (gh missing or not logged in)"
fi
echo

# --- site ----------------------------------------------------------------------
URL=$( [ -n "$NOTE" ] && sed -n '1,10s/^url: *//p' "$NOTE" | head -1)
if [ -n "$URL" ]; then
  echo "## site"
  echo "$URL  $(curl -s -o /dev/null -L --max-time 10 -w 'HTTP %{http_code}' "$URL" || echo unreachable)"
  echo
fi

# --- linear --------------------------------------------------------------------
echo "## linear (team OSK, open issues mentioning \"$Q\")"
KEY="${LINEAR_API_KEY:-}"
if [ -z "$KEY" ] && [ -f "$HOME/.config/fish/conf.d/secrets.fish" ]; then
  KEY=$(sed -nE "s/.*LINEAR_API_KEY[ =]+[\"']?([^\"' ]+).*/\\1/p" "$HOME/.config/fish/conf.d/secrets.fish" | head -1)
fi
if [ -z "$KEY" ]; then
  echo "linear: not reachable (no LINEAR_API_KEY)"
else
  GQ='query($q: String!){ issues(first:20, orderBy:updatedAt, filter:{ team:{key:{eq:"OSK"}}, state:{type:{nin:["completed","canceled"]}}, or:[ {title:{containsIgnoreCase:$q}}, {description:{containsIgnoreCase:$q}}, {project:{name:{containsIgnoreCase:$q}}} ] }){ nodes{ identifier title updatedAt state{name} project{name} } } }'
  curl -s https://api.linear.app/graphql -H "Authorization: $KEY" -H 'Content-Type: application/json' \
    --data "$(jq -cn --arg q "$GQ" --arg s "$Q" '{query:$q, variables:{q:$s}}')" \
  | jq -r 'if .errors then "linear: error " + (.errors[0].message) elif (.data.issues.nodes | length) == 0 then "nothing open" else .data.issues.nodes[] | "  \(.updatedAt[:10])  \(.identifier)  [\(.state.name)]  \(.project.name // "no project")  \(.title)" end'
fi
echo

# --- weekly --------------------------------------------------------------------
echo "## weekly.md mentions"
[ -f "$VAULT/weekly.md" ] && { grep -n -i -- "$Q" "$VAULT/weekly.md" | tail -5; true; } || echo "weekly: not found"
