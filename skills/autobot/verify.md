# Verify

Rerun the reproduction steps against the branch: is the bug gone? For a change request, check the claim. A change proven by measurement gets the cheapest rerun you can do yourself; fix's logs aren't evidence. Run the full checks. Review the diff with arbe-review. If the change is visible, look once at the view the claim is about, at the zoom and setting a player would use, in whatever browser the machine has; reuse the running dev server or one fix already started. If it changes how something looks (layout, colour, copy), take one before and one after screenshot next to the report. For behaviour (state, timing, data), the reproduction steps are the evidence; skip screenshots. Don't tour every view: the diff review covers the rest. If you can't get a browser, that's a blocker.

Before writing your section, close any browser or server you started (`agent-browser close`, kill what holds the port): a stray headless Chromium slows every other thread's tests.

Fixed and nothing in the review that has to change → next is PR. Otherwise → back to fix, with what you saw and the findings; output that looks wrong (a column that doesn't count what its name says) goes back too, not explained away. After two rounds back to fix, stop: write `Next: waiting on <the one open question>` yourself, not another fix.
