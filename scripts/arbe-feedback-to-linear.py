#!/usr/bin/env python3
"""Import new Arbe feedback into Linear.

Runs as a bb script automation. Asks arbe for feedback newer than the last
import and stays silent when there is none. New notes all go to one
cheap bb thread that dedupes against Linear and creates the missing
issues over the Linear MCP connector. The cursor only moves once that thread
reports success, so a failed batch is simply offered again next run; the
"Arbe feedback ID: <id>" line in each issue keeps the retry from duplicating.

State lives in ~/.local/state/arbe-feedback-to-linear/state.json:
  cursor   newest created_at already imported
  seen     {id: created_at} imported within OVERLAP of the cursor, so rows that
           commit late with an older timestamp are still picked up exactly once
  pending  the batch thread in flight, so a timed-out run resumes waiting on it
           instead of spawning a second one
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

ENDPOINT = "https://arbe.0sk.ar/api/feedback"
KEY_FILE = Path.home() / ".config/arbe/feedback-read-key"
STATE_DIR = Path.home() / ".local/state/arbe-feedback-to-linear"
STATE_FILE = STATE_DIR / "state.json"
WORKSPACE = STATE_DIR / "workspace"  # empty dir: the thread loads no repo context

# The notes are untrusted text, so the thread may use the two Linear tools it
# needs without asking, and nothing that touches the shell, files, the web or
# other connectors.
WORKSPACE_SETTINGS = {
    "permissions": {
        "allow": ["mcp__claude_ai_Linear__list_issues", "mcp__claude_ai_Linear__save_issue"],
        "deny": [
            "Bash", "Read", "Glob", "Grep", "Edit", "Write", "NotebookEdit",
            "WebFetch", "WebSearch", "Agent",
            "mcp__claude_ai_Firecrawl", "mcp__claude_ai_Claude_Docs", "mcp__claude_ai_Gmail",
            "mcp__claude_ai_Google_Drive", "mcp__claude_ai_Google_Calendar", "mcp__claude_ai_Shopify",
        ],
    }
}

BB = os.environ.get("BB_CLI") or "bb"
BB_PROJECT = "proj_eum2dh3nwu"  # arbe
MODEL = "claude-haiku-4-5-20251001"
OVERLAP = timedelta(minutes=5)
THREAD_TIMEOUT = 12 * 60  # the automation itself times out at 15m

# bb runs a snapshot of this script, so the prompt is read from the repo on
# every run: edits to it apply without refreshing the automation.
PROMPT_FILE = Path.home() / "oskarrough/robots/scripts/arbe-feedback-to-linear.md"


def ts(value: str) -> datetime:
    return datetime.fromisoformat(value)


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"cursor": None, "seen": {}, "pending": None}


def save_state(state: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2) + "\n")
    tmp.replace(STATE_FILE)


def bb(*args: str, stdin: str | None = None) -> dict:
    result = subprocess.run([BB, *args, "--json"], input=stdin, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"bb {args[0]} {args[1]} failed: {(result.stdout or result.stderr).strip()[:500]}")
    return json.loads(result.stdout)


def fetch(since: datetime | None) -> list[dict]:
    url = ENDPOINT + (f"?{urllib.parse.urlencode({'since': since.isoformat()})}" if since else "")
    request = urllib.request.Request(url, headers={
        "x-feedback-key": KEY_FILE.read_text().strip(),
        # Cloudflare answers Python's default user agent with 403 / error 1010.
        "user-agent": "arbe-feedback-to-linear/1",
    })
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        body = error.read().decode(errors="replace")[:300]
        try:
            recoverable = json.loads(body).get("recoverable", True)
        except ValueError:
            recoverable = True
        if error.code >= 500 and recoverable is not False:
            # Transient: say so, but exit 0 so a blip doesn't pause the automation.
            print(f"Feedback endpoint unavailable ({error.code}), trying again next run.")
            sys.exit(0)
        sys.exit(f"Feedback endpoint refused ({error.code}): {body}")
    except (urllib.error.URLError, TimeoutError) as error:
        print(f"Feedback endpoint unreachable ({error}), trying again next run.")
        sys.exit(0)


def settle(state: dict) -> None:
    """Wait for the pending batch thread, then commit or drop its batch."""
    pending = state["pending"]
    thread = pending["thread"]
    deadline = time.monotonic() + THREAD_TIMEOUT
    try:
        while (status := bb("thread", "show", thread)["thread"]["status"]) not in ("idle", "error"):
            if time.monotonic() > deadline:
                bb("thread", "stop", thread)
                raise RuntimeError(f"Thread {thread} was still {status} after {THREAD_TIMEOUT // 60} minutes, stopped it.")
            time.sleep(5)
        output = (bb("thread", "output", thread).get("output") or "").strip()
    except RuntimeError as error:
        # The thread is gone or unreadable: drop it and offer the batch again next run.
        state["pending"] = None
        save_state(state)
        sys.exit(str(error))

    lines = [line.strip() for line in output.splitlines() if line.strip()]
    if status != "idle" or not lines or lines[-1] != "RESULT: ok":
        state["pending"] = None
        save_state(state)
        tail = lines[-1] if lines else "no output"
        sys.exit(f"Thread {thread} did not finish the import ({status}): {tail}")

    rows = pending["rows"]
    newest = max(map(ts, rows.values()))
    cursor = max(newest, ts(state["cursor"])) if state["cursor"] else newest
    seen = {**state["seen"], **rows}
    state["cursor"] = cursor.isoformat()
    state["seen"] = {id: at for id, at in seen.items() if ts(at) > cursor - OVERLAP}
    state["pending"] = None
    save_state(state)

    created = [line for line in lines[:-1] if re.match(r"^[A-Z]+-\d+ ", line)]
    if created:
        print("\n".join(created))
    try:
        bb("thread", "archive", thread)
    except RuntimeError as error:
        print(f"Imported, but could not archive thread {thread}: {error}")


def main() -> None:
    try:
        run()
    except RuntimeError as error:
        sys.exit(str(error))


def run() -> None:
    state = load_state()
    if state["pending"]:
        settle(state)

    cursor = ts(state["cursor"]) if state["cursor"] else None
    since = cursor - OVERLAP if cursor else None
    rows = [
        row
        for row in fetch(since)
        if row["id"] not in state["seen"] and (since is None or ts(row["created_at"]) > since)
    ]
    if not rows:
        return

    batch = sorted(rows, key=lambda row: ts(row["created_at"]))
    settings = WORKSPACE / ".claude/settings.json"
    settings.parent.mkdir(parents=True, exist_ok=True)
    settings.write_text(json.dumps(WORKSPACE_SETTINGS, indent=2) + "\n")
    thread = bb(
        "thread", "spawn",
        "--project", BB_PROJECT,
        "--environment", str(WORKSPACE),
        "--provider", "claude-code",
        "--model", MODEL,
        "--reasoning-level", "low",
        "--permission-mode", "accept-edits",
        "--title", f"Import {len(batch)} Arbe feedback {'note' if len(batch) == 1 else 'notes'} into Linear",
        "--prompt-file", "-",
        stdin=PROMPT_FILE.read_text() + json.dumps(batch, indent=2, ensure_ascii=False),
    )["id"]
    state["pending"] = {"thread": thread, "rows": {row["id"]: row["created_at"] for row in batch}}
    save_state(state)
    settle(state)


if __name__ == "__main__":
    main()
