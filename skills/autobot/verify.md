# Verify

Rerun the reproduction steps against the branch: is the bug gone? For a change request, check the claim. A change proven by measurement gets the cheapest rerun you can do yourself; fix's logs aren't evidence. Run the full checks. Review the diff with arbe-review. If the change is visible, run the app (serve a build if the dev server is off-limits) in Playwright or whatever browser the machine has, and look: save before and after screenshots next to the report. If you can't get a browser, that's a blocker.

Before writing your section, close any browser or server you started (`agent-browser close`, kill what holds the port): a stray headless Chromium slows every other thread's tests.

Fixed and nothing in the review that has to change → next is PR. Otherwise → back to fix, with what you saw and the findings; output that looks wrong (a column that doesn't count what its name says) goes back too, not explained away. After two rounds back to fix, stop and hand it to Oskar.
