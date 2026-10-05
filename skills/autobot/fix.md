# Fix

A bug starts from the reproduction steps in the report: find the cause, then make the smallest change that stops it, proved the way AGENTS.md says (by default, a test that fails without the change). A change request takes the report's claim as the spec. Once the direction is chosen, fill in the details yourself: build the smallest version that works and list the choices you made in the report. If the direction itself isn't chosen, change nothing, post the open question on the issue, and stop.

Use the repo's existing test tooling. If it can't catch this change (a pure layout fix, say), write no test and let verify's browser check stand in.

When the change is tuned against a slow measurement (a benchmark, a simulation): take one baseline, probe with the cheapest run that answers the question, and stop after three tries. Keep the best and report what each try showed. If a result looks lopsided, rule out the measuring tool before tuning around it, and report whether you did. Wait on long commands in the foreground.

Run the repo's checks. Leave the result uncommitted and save its diff as `fix.diff` next to the report.

Report: the cause (`file:line`) or the choices, what changed, and the test or measurement.
