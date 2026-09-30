# Fix

Start from the reproduction steps in the report. Find the cause, then make the smallest change that stops the bug, with a test that fails without it. For a change request, the report's claim is the spec. Once the direction is chosen, fill in the details yourself: build the smallest version that works and list the choices you made in the report. Stop only when the direction itself isn't chosen: then change nothing, post the open question as a comment on the issue, and stop.

Use the test tooling the repo already has. If it can't catch this change (a pure layout fix, say), write no test and let verify's browser check stand in; don't add dependencies or CI steps for it.

Run the repo's checks. Leave the result uncommitted on a branch named `autobot/<slug>`.

Report: the cause (`file:line`), what changed, and the test.
